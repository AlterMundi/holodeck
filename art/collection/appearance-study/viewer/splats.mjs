import {
  DataTexture, FloatType, GLSL3, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, RGBAFormat, ShaderMaterial, BufferAttribute,
} from 'three';

const textureWidth = 1024;
const buckets = 1024;

export function createSplats(bytes) {
  const count = bytes.byteLength / 32;
  if (!Number.isInteger(count) || count < 1 || count > 160000) throw Error('Invalid splat catalog');
  const rows = Math.ceil(count * 3 / textureWidth);
  const data = new Float32Array(rows * textureWidth * 4);
  const source = new DataView(bytes);
  const fixed = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 32, o = i * 12;
    for (let axis = 0; axis < 6; axis++) data[o + axis] = source.getFloat32(p + axis * 4, true);
    for (let axis = 0; axis < 4; axis++) data[o + 6 + axis] = source.getUint8(p + 28 + axis) / 128 - 1;
    // Keep the base view and hybrid registration together. Suppress the
    // few samples that could occlude the actual moving archive platform.
    const [x,y,z] = data.subarray(o,o+3);
    if (!(Math.hypot(x-3.35,z+3.68) < .72 && y > .99 && y < 1.16)) fixed[i] = 1;
    data[o + 10] = source.getUint32(p + 24, true) & 0xffffff;
    data[o + 11] = source.getUint8(p + 27) / 255;
  }
  const texture = new DataTexture(data, textureWidth, rows, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  const ids = new Float32Array(count);
  const index = new InstancedBufferAttribute(ids, 1);
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
  function sort(camera, hybrid) {
    camera.updateMatrixWorld();
    const e=camera.matrixWorldInverse.elements, pose=[e[2],e[6],e[10],e[14],hybrid];
    if(pose.every((value,i)=>value===prior[i])) return;
    prior=pose;
    sizes.fill(0);
    for(let i=0;i<count;i++){
      const j=i*12;
      if(hybrid&&!fixed[i]) continue;
      const depth=-(e[2]*data[j]+e[6]*data[j+1]+e[10]*data[j+2]+e[14]);
      const bin=Math.min(buckets-1,Math.max(0,Math.floor(depth*(buckets/24))));
      depths[i]=bin;
      sizes[bin]++;
    }
    let total=0;
    for(let bin=buckets-1;bin>=0;bin--){cursor[bin]=total;total+=sizes[bin];}
    for(let i=0;i<count;i++) if(!hybrid||fixed[i]) ids[cursor[depths[i]]++]=i;
    geometry.instanceCount=total;
    index.needsUpdate=true;
  }
  return {mesh,sort};
}
