import {
  DataTexture, FloatType, GLSL3, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, RGBAFormat, ShaderMaterial, BufferAttribute, DynamicDrawUsage,
} from 'three';

const textureWidth = 1024;
const buckets = 1024;

export function createSplats(bytes, compact = false, compactRadius = .022) {
  const stride = compact ? 12 : 32;
  const count = bytes.byteLength / stride;
  if (!Number.isInteger(count) || count < 1 || count > (compact ? 720000 : 260000)) {
    throw Error('Invalid splat catalog');
  }
  const rows = Math.ceil(count * 3 / textureWidth);
  const data = new Float32Array(rows * textureWidth * 4);
  const source = new DataView(bytes);
  const fixed = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * stride, o = i * 12;
    if (compact) {
      for (let axis = 0; axis < 3; axis++) data[o + axis] = source.getInt16(p + axis * 2, true) / 4096;
      data[o + 3] = data[o + 4] = compactRadius;
      data[o + 5] = .0032;
      const nx = source.getInt8(p + 9), ny = source.getInt8(p + 10), nz = source.getInt8(p + 11);
      const length = Math.hypot(nx, ny, nz);
      const w = length + nz;
      const qLength = Math.hypot(w, ny, nx);
      data[o + 6] = qLength ? w / qLength : 0;
      data[o + 7] = qLength ? -ny / qLength : 1;
      data[o + 8] = qLength ? nx / qLength : 0;
      data[o + 10] = source.getUint8(p + 6) | source.getUint8(p + 7) << 8 | source.getUint8(p + 8) << 16;
      data[o + 11] = .94;
    } else {
      for (let axis = 0; axis < 6; axis++) data[o + axis] = source.getFloat32(p + axis * 4, true);
      for (let axis = 0; axis < 4; axis++) data[o + 6 + axis] = source.getUint8(p + 28 + axis) / 128 - 1;
      data[o + 10] = source.getUint32(p + 24, true) & 0xffffff;
      data[o + 11] = source.getUint8(p + 27) / 255;
    }
    // Suppress samples around the moving archive platform in hybrid mode.
    const x = data[o], y = data[o + 1], z = data[o + 2];
    if (!(Math.hypot(x - 3.35, z + 3.68) < .72 && y > .99 && y < 1.16)) fixed[i] = 1;
  }
  const texture = new DataTexture(data, textureWidth, rows, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  const ids = new Float32Array(count);
  const index = new InstancedBufferAttribute(ids, 1).setUsage(DynamicDrawUsage);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    -1,-1,0, 1,-1,0, 1,1,0, -1,1,0,
  ]), 3));
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.setAttribute('splatIndex', index);
  const material = new ShaderMaterial({
    glslVersion: GLSL3, transparent:true, depthWrite:false,
    uniforms:{splatData:{value:texture}},
    vertexShader:`
      uniform sampler2D splatData;
      in float splatIndex;
      out vec2 local;
      out vec4 rgba;
      vec4 sampleData(int i){return texelFetch(splatData,ivec2(i%1024,i/1024),0);}
      vec3 rotate(vec4 q, vec3 p){return p + 2.0*cross(q.yzw,cross(q.yzw,p)+q.x*p);}
      vec2 differential(vec3 p,vec3 v){
        return vec2(projectionMatrix[0][0],projectionMatrix[1][1]) *
          (v.xy-p.xy*v.z/p.z) / -p.z;
      }
      void main(){
        int i=int(splatIndex)*3;
        vec4 a=sampleData(i), b=sampleData(i+1), c=sampleData(i+2);
        vec3 p=(viewMatrix*vec4(a.xyz,1.)).xyz;
        // The screen-space approximation is unstable close to the lens.
        if(p.z>=-.3){gl_Position=vec4(2.,2.,2.,1.);return;}
        vec4 q=normalize(vec4(b.zw,c.xy));
        mat3 worldToEye=mat3(viewMatrix);
        vec2 u=differential(p,worldToEye*rotate(q,vec3(a.w,0,0)));
        vec2 v=differential(p,worldToEye*rotate(q,vec3(0,b.x,0)));
        vec2 w=differential(p,worldToEye*rotate(q,vec3(0,0,b.y)));
        float xx=u.x*u.x+v.x*v.x+w.x*w.x+1.e-7;
        float xy=u.x*u.y+v.x*v.y+w.x*w.y;
        float yy=u.y*u.y+v.y*v.y+w.y*w.y+1.e-7;
        float major=sqrt(xx);
        float shear=xy/major;
        float minor=sqrt(max(1.e-7,yy-shear*shear));
        local=position.xy*2.7;
        vec2 offset=vec2(major*local.x,shear*local.x+minor*local.y);
        vec4 center=projectionMatrix*vec4(p,1.);
        gl_Position=center+vec4(clamp(offset,vec2(-.28),vec2(.28))*center.w,0.,0.);
        uint rgb=uint(c.z);
        rgba=vec4(vec3(rgb&255u,(rgb>>8u)&255u,(rgb>>16u)&255u)/255.,c.w);
      }`,
    fragmentShader:`
      in vec2 local;
      in vec4 rgba;
      out vec4 result;
      void main(){
        float r=dot(local,local);
        if(r>7.29)discard;
        result=vec4(rgba.rgb, rgba.a*exp(-.5*r));
      }`,
  });
  const mesh=new Mesh(geometry,material);
  mesh.frustumCulled=false;
  mesh.renderOrder=1;
  const depths=new Uint16Array(count), sizes=new Uint32Array(buckets), cursor=new Uint32Array(buckets);
  let prior=[];
  function sort(camera, hybrid, reduced = false) {
    camera.updateMatrixWorld();
    const e = camera.matrixWorldInverse.elements;
    const projection = camera.projectionMatrix.elements;
    const pose = compact ? [...e, projection[0], projection[5], reduced] : [e[2], e[6], e[10], e[14], hybrid];
    if(pose.every((value,i)=>value===prior[i])) return;
    prior=pose;
    sizes.fill(0);
    const step = compact && reduced ? 2 : 1;
    const outside = 65535;
    for (let i = 0; i < count; i += step) {
      const j = i * 12;
      const x = data[j], y = data[j + 1], z = data[j + 2];
      const depth = -(e[2]*x + e[6]*y + e[10]*z + e[14]);
      if (compact) {
        // Cull comfortably beyond the splat footprint before uploading indices.
        const eyeX = e[0]*x + e[4]*y + e[8]*z + e[12];
        const eyeY = e[1]*x + e[5]*y + e[9]*z + e[13];
        if (depth < .28 || Math.abs(eyeX) > depth / projection[0] + .35 ||
            Math.abs(eyeY) > depth / projection[5] + .35) {
          depths[i] = outside;
          continue;
        }
      }
      if (hybrid && !fixed[i]) {
        depths[i] = outside;
        continue;
      }
      const bin=Math.min(buckets-1,Math.max(0,Math.floor(depth*(buckets/24))));
      depths[i]=bin;
      sizes[bin]++;
    }
    let total=0;
    for(let bin=buckets-1;bin>=0;bin--){cursor[bin]=total;total+=sizes[bin];}
    for (let i = 0; i < count; i += step) if (depths[i] !== outside) ids[cursor[depths[i]]++] = i;
    geometry.instanceCount=total;
    if(total){
      index.clearUpdateRanges();
      index.addUpdateRange(0,total);
      index.needsUpdate=true;
    }
  }
  return {mesh,sort,dispose(){
    mesh.removeFromParent();
    geometry.dispose();
    material.dispose();
    texture.dispose();
  }};
}
