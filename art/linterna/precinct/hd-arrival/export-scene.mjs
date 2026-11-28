import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptSimplifier} from 'meshoptimizer';
import {buildStage, buildMaterials, loadStatues, terrain, foliageMaterials, prepareMaterials, NOISE, KINDS} from 'approved-hd-source';

const maxPart=768*1024;
const maxParts=6;
const reviewViews={
  hall:{eye:[0,1.68,11.35],target:[0,1.80,-9],fov:58},
  garden:{eye:[-3,1.65,1.9],target:[-4.2,1.53,-8],fov:58},
};
const assetNames=['hall','hall-detail','temples','landscape','planting','foliage'];
const privateMaterials = buildMaterials();
Object.assign(privateMaterials,{foliage:foliageMaterials()});
// Initialize the materials with the same settings as the source walkthrough.
prepareMaterials(privateMaterials);
const scene=buildStage('precinct',privateMaterials,await loadStatues());
scene.group.updateMatrixWorld(true);
await MeshoptSimplifier.ready;
const fullGroup=scene.group;
const materialCache=new Map();
const bakedMaps=new Map();
const opt={shaders:[]};
const normal=new T.Vector3(), position=new T.Vector3(), color=new T.Color();
const categories=Object.fromEntries(assetNames.map(name=>[name,[]]));
const shaderRenderer=new T.WebGLRenderer({preserveDrawingBuffer:true,alpha:false,antialias:false});
shaderRenderer.setSize(256,256,false);
shaderRenderer.setPixelRatio(1);
shaderRenderer.toneMapping=T.NoToneMapping;
const viewGeometry=new T.PlaneGeometry(2,2);
const bakeScene=new T.Scene();
const bakeMesh=new T.Mesh(viewGeometry);
bakeScene.add(bakeMesh);
const bakeCamera=new T.Camera();

function proceduralKind(source){
  const key=source.customProgramCacheKey();
  return Object.keys(KINDS).find(kind=>key.startsWith('hd-'+kind)
    && ['S','P','Sv','Pv'].includes(key.slice(3+kind.length)));
}
function texFrame(source,kind){
  const opts=source.userData.uniforms;
  if(kind==='ashlar'||kind==='slabs')return [opts.uBlock.value.x*4,opts.uBlock.value.y*8];
  if(kind==='ground'||kind==='gravel')return [8,8];
  if(kind==='metal'||kind==='wood'||kind==='bark')return [1.5,1.5];
  return [2.4,2.4];
}
function mapFor(source,kind,flat){
  const opts=source.userData.uniforms;
  const [width,height]=texFrame(source,kind);
  const name=source.uuid+':'+flat;
  if(bakedMaps.has(name))return bakedMaps.get(name);
  const uniformTypes=Object.entries(opts).map(([k,v])=>{
    const t=v.value.isColor||v.value.isVector3?'vec3':v.value.isVector2?'vec2':'float';
    return `uniform ${t} ${k};`;
  }).join('\n');
  // The author shader evaluates material on a representative plane in metres.
  // Use the same recipe and sources of variation, then encode standard sRGB.
  const projection=flat?'vec3(vUv.x*frame.x,0.,-vUv.y*frame.y)':'vec3(vUv.x*frame.x,vUv.y*frame.y,0.)';
  const shader=new T.ShaderMaterial({
    uniforms:{...opts,frame:{value:new T.Vector2(width,height)},uReviewFast:{value:0},uReviewNoise:{value:null}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`varying vec2 vUv; uniform vec2 frame; ${uniformTypes}
      ${NOISE}
      void main(){ vec3 p=${projection}; vec3 n=${flat?'vec3(0.,1.,0.)':'vec3(0.,0.,1.)'};
        vec3 col=vec3(1.); float rough=.5; float h=0.; float met=${(source.metalness??0).toFixed(3)};
        ${KINDS[kind]}
        gl_FragColor=vec4(clamp(col,0.,1.),1.);
        #include <colorspace_fragment>
      }`,
  });
  bakeMesh.material=shader;
  shaderRenderer.render(bakeScene,bakeCamera);
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  canvas.getContext('2d').drawImage(shaderRenderer.domElement,0,0);
  const tex=new T.CanvasTexture(canvas);
  tex.colorSpace=T.SRGBColorSpace;
  tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.userData.mimeType='image/jpeg';
  shader.dispose();
  bakedMaps.set(name,tex);
  opt.shaders.push(kind+(flat?' XZ':' vertical'));
  return tex;
}
function materialFor(source,flat,vertexColors){
  const kind=proceduralKind(source);
  const bake=kind&&['marble','ashlar','slabs','wood','ground','bark','terracotta','metal','stucco','gravel'].includes(kind);
  const key=source.uuid+':'+Boolean(flat&&bake)+':'+vertexColors;
  if(materialCache.has(key))return materialCache.get(key);
  const uniforms=source.userData.uniforms;
  const map=bake?mapFor(source,kind,flat):source.map??null;
  // Leave headroom for the shared world's brighter interior lighting.
  const brightStone=bake&&['marble','ashlar','slabs','stucco'].includes(kind);
  const color=map&&bake?(brightStone?0xe5dfd4:0xffffff):uniforms?.uColA?.value??source.color??0x697f40;
  const selected=new (source.isMeshBasicMaterial?T.MeshBasicMaterial:T.MeshStandardMaterial)({
    color,
    map,side:source.side,opacity:source.opacity,transparent:source.transparent,
    alphaTest:source.alphaTest,vertexColors,
    ...(!source.isMeshBasicMaterial?{
      roughness:uniforms?.uRough?.value??source.roughness??.86,
      metalness:Math.min(.65,source.metalness??0),
      normalMap:source.normalMap??null,normalScale:source.normalScale,
      emissive:source.emissive,emissiveIntensity:source.emissiveIntensity,
    }:{}),
  });
  if(map&&source.alphaTest&&source.map?.image instanceof HTMLCanvasElement){
    const image=document.createElement('canvas'); image.width=image.height=source===privateMaterials.foliage.olive?256:128;
    image.getContext('2d').drawImage(source.map.image,0,0,image.width,image.height);
    selected.map=new T.CanvasTexture(image);selected.map.colorSpace=T.SRGBColorSpace;
  }
  if(map&&!map.userData.mimeType&&!source.alphaTest)map.userData.mimeType='image/jpeg';
  if(selected.normalMap)selected.normalMap.userData.mimeType='image/jpeg';
  const mode=bake?(flat?'xz':'vertical'):null;
  materialCache.set(key,{selected,frame:bake?texFrame(source,kind):null,kind,mode});
  return materialCache.get(key);
}

function rewriteGeometry(geometry, matrix, target, error, select, verticesColored){
  const source=geometry.clone();
  for(const name of Object.keys(source.attributes)){
    if(!['position','normal','uv',...(verticesColored?['color']:[])].includes(name))source.deleteAttribute(name);
  }
  if(matrix)source.applyMatrix4(matrix);
  if(!source.getAttribute('normal'))source.computeVertexNormals();
  const geo=mergeVertices(source,.0002);
  source.dispose();
  const pos=geo.getAttribute('position'),nrm=geo.getAttribute('normal');
  const original=geo.index?.array;
  const uv=geo.getAttribute('uv');
  let chosen=original instanceof Uint32Array?original:Uint32Array.from(original);
  if(select.selected.alphaTest&&uv&&chosen.length%6===0&&chosen.length>target*3&&target>0){
    const quadCount=chosen.length/6, take=Math.floor(target/2);
    const sampled=new Uint32Array(take*6);
    for(let q=0;q<take;q++){
      const pick=Math.floor((q+.5)*quadCount/take)*6;
      sampled.set(chosen.subarray(pick,pick+6),q*6);
    }
    chosen=sampled;
  }else if(target>0&&chosen.length>target*3){
    // Normal attributes preserve architectural hard edges, ultraviolet seams
    // survive the initial weld, and geometry stays in the authored frame.
    const attrib=uv?new Float32Array(pos.count*5):nrm.array;
    if(uv)for(let i=0;i<pos.count;i++)attrib.set([nrm.getX(i),nrm.getY(i),nrm.getZ(i),uv.getX(i),uv.getY(i)],i*5);
    const [simple]=MeshoptSimplifier.simplifyWithAttributes(chosen,pos.array,3,attrib,uv?5:3,
      uv?[.4,.4,.4,.04,.04]:[.4,.4,.4],null,target*3,error);
    chosen=simple;
    if(chosen.length>target*4&&select.kind!=='bark'){
      const [simpleLoose]=MeshoptSimplifier.simplifySloppy(chosen,pos.array,3,null,target*3,error*1.6);
      if(simpleLoose.length>0&&simpleLoose.length<chosen.length)chosen=simpleLoose;
    }
  }
  const {remap,unique}=remapOf(chosen,pos.count);
  const coords=new Float32Array(unique*3), normals=new Float32Array(unique*3);
  const tex=new Float32Array(unique*2), colors=verticesColored?new Float32Array(unique*3):null;
  const vertexColor=geo.getAttribute('color');
  for(let i=0;i<remap.length;i++){
    const j=remap[i];if(j<0)continue;
    position.fromBufferAttribute(pos,i);normal.fromBufferAttribute(nrm,i).normalize();
    coords.set(position.toArray(),j*3);normals.set(normal.toArray(),j*3);
    if(select.mode==='xz')tex.set([position.x/select.frame[0],-position.z/select.frame[1]],j*2);
    else if(select.mode==='vertical'){
      const across=select.kind==='ashlar'&&Math.abs(normal.x)>Math.abs(normal.z)?-position.z:position.x;
      tex.set([across/select.frame[0],position.y/select.frame[1]],j*2);
    }
    else if(uv)tex.set([uv.getX(i),uv.getY(i)],j*2);
    if(colors&&vertexColor)colors.set([vertexColor.getX(i),vertexColor.getY(i),vertexColor.getZ(i)],j*3);
  }
  const out=new T.BufferGeometry();
  out.setAttribute('position',new T.BufferAttribute(coords,3));
  out.setAttribute('normal',new T.BufferAttribute(normals,3));
  if(uv||select.mode)out.setAttribute('uv',new T.BufferAttribute(tex,2));
  if(colors)out.setAttribute('color',new T.BufferAttribute(colors,3));
  out.setIndex(new T.BufferAttribute((unique<=65535?Uint16Array:Uint32Array).from(chosen,i=>remap[i]),1));
  geo.dispose();
  return out;
}

function remapOf(indices,count){
  const remap=new Int32Array(count).fill(-1);
  let unique=0;
  for(const i of indices)if(remap[i]<0)remap[i]=unique++;
  return {remap,unique};
}
const matrix=new T.Matrix4();
function bound(mesh){
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}
function kindOf(group,mesh){
  const name=group.name;
  const m=mesh.material;
  if(name==='Atlas')return 'hall';
  if(name==='apollo')return 'planting';
  if(name==='athena'||name==='hephaestus')return 'temples';
  if(group===fullGroup.children[1])return m.alphaTest?'foliage':'planting';
  return 'landscape';
}
function geometryForMesh(mesh,category,profile){
  const detail=mesh.userData.reviewDetail;
  const g=detail?.light&&(category!=='hall'||detail.radius===.3)?detail.light:mesh.geometry;
  const n=(g.index?.count??g.getAttribute('position').count)/3;
  const high=category.startsWith('hall');
  const limit=high?1450:category==='temples'?350:category==='planting'?475:350;
  if(category==='foliage'){
    const bounds=bound(mesh);
    const near=bounds.distanceToPoint(new T.Vector3(0,0,-3))<8;
    return {g,max:Math.min(n,near?Math.max(450,Math.floor(n*.52)):Math.max(120,Math.floor(n*.17))),error:.035};
  }
  const ratio=high?.25:.12;
  return {g,max:n<=300?n:Math.max(120,Math.ceil(Math.min(n*ratio,limit)*profile)),error:high?.020:.055};
}
function outsideArrival(bounds){return bounds.max.x< -28||bounds.min.x>28||bounds.max.z< -37||bounds.min.z>21;}
function attempt(profile){
  for(const arr of Object.values(categories))arr.length=0;
  const grassMatrices=[];
  for(const group of fullGroup.children)group.traverse(mesh=>{
    if(!mesh.isMesh||Array.isArray(mesh.material)||!mesh.visible)return;
    const cat=kindOf(group,mesh);
    const box=bound(mesh);
    if((mesh.userData.reviewDetail?.center||cat==='planting'||cat==='foliage')&&outsideArrival(box))return;
    const source=mesh.material;
    if(group.geometry?.type==='PlaneGeometry'&&group.geometry.parameters.width===640){
      const rebuilt=terrain(source,group.userData.heightAt,74,32);
      const pp=rebuilt.geometry.getAttribute('position');
      for(let i=0;i<pp.count;i++)pp.setY(i,mesh.userData.heightAt(pp.getX(i),pp.getZ(i)));
      rebuilt.geometry.computeVertexNormals();
      const sel=materialFor(source,true,false);
      const out=rewriteGeometry(rebuilt.geometry,null,0,.03,sel,false);
      categories.landscape.push(new T.Mesh(out,sel.selected));
      return;
    }
    if(mesh.isInstancedMesh){
      // Store one mesh plus per-placement transforms rather than decimal vertex copies.
      if(group===fullGroup.children.at(-1)){
        for(let i=0;i<mesh.count;i+=8){
          mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
          if(Math.abs(position.x)<16&&position.z<3&&position.z> -21)grassMatrices.push(matrix.clone());
        }
        return;
      }
      const {g,max,error}=geometryForMesh(mesh,cat,profile);
      const sel=materialFor(source,false,false);
      const geometry=rewriteGeometry(g,null,Math.min(200,max),error,sel,false);
      const instances=[];
      for(let i=0;i<mesh.count;i++){
        if(mesh.count>80&&i%2)continue;
        mesh.getMatrixAt(i,matrix);instances.push({mat:new T.Matrix4().multiplyMatrices(mesh.matrixWorld,matrix),i});
      }
      const object=new T.InstancedMesh(geometry,sel.selected,instances.length);
      instances.forEach(({mat,i},j)=>{
        object.setMatrixAt(j,mat);if(mesh.instanceColor){mesh.getColorAt(i,color);object.setColorAt(j,color);}
      });
      categories[cat].push(object);return;
    }
    const {g,max,error}=geometryForMesh(mesh,cat,profile);
    const flat=['slabs','ground'].includes(proceduralKind(source))||((box.max.y-box.min.y)<.26&&(box.max.x-box.min.x)+(box.max.z-box.min.z)>1.2);
    const sel=materialFor(source,flat,false);
    const out=rewriteGeometry(g,mesh.matrixWorld,max,error,sel,false);
    categories[cat].push(new T.Mesh(out,sel.selected));
  });
  if(grassMatrices.length){
    const plant=new T.PlaneGeometry(.015,.19).translate(0,.095,0);
    const grasstype=new T.MeshStandardMaterial({color:0x9caa55,side:T.DoubleSide,roughness:.86});
    const sparse=new T.InstancedMesh(plant,grasstype,grassMatrices.length);
    grassMatrices.forEach((m,i)=>sparse.setMatrixAt(i,m));
    categories.foliage.push(sparse);
  }
}

const q=(array,type,unit)=>type.from(array,v=>Math.round(T.MathUtils.clamp(v/unit,-1,1)*(type===Int16Array?32767:127)));
function compact(mesh){
  const g=mesh.geometry;
  if(mesh.isInstancedMesh)return mesh; // Child TRS and instancing use the real unscaled local vertex positions.
  const p=g.getAttribute('position'),n=g.getAttribute('normal');
  g.computeBoundingBox();
  const offset=g.boundingBox.getCenter(new T.Vector3());
  g.translate(-offset.x,-offset.y,-offset.z);
  const max=Math.max(.001,...g.boundingBox.getSize(new T.Vector3()).toArray())*.5001;
  g.setAttribute('position',new T.Int16BufferAttribute(q(p.array,Int16Array,max),3,true));
  g.setAttribute('normal',new T.Int8BufferAttribute(q(n.array,Int8Array,1),3,true));
  mesh.position.copy(offset);mesh.scale.setScalar(max);
  return mesh;
}
function batchByMaterial(meshes){
  const merged=new Map(), output=[];
  for(const m of meshes){
    if(m.isInstancedMesh){output.push(m);continue;}
    const tag=m.material.uuid+':'+Boolean(m.geometry.getAttribute('uv'));
    if(!merged.has(tag))merged.set(tag,[]);
    merged.get(tag).push(m);
  }
  for(const parts of merged.values()){
    const g=parts.length===1?parts[0].geometry:mergeGeometries(parts.map(m=>m.geometry));
    output.push(compact(new T.Mesh(g,parts[0].material)));
  }
  return output;
}
async function exportParts(profile){
  attempt(profile);
  const files=[];
  const hallDraws=batchByMaterial(categories.hall);
  const hall=[[],[]],weights=[0,0];
  const size=m=>m.geometry.index.array.byteLength+
    Object.values(m.geometry.attributes).reduce((n,x)=>n+x.array.byteLength,0)+
    (m.material.map?26000:0);
  for(const mesh of hallDraws.sort((a,b)=>size(b)-size(a))){
    const index=weights[0]<=weights[1]?0:1;hall[index].push(mesh);weights[index]+=size(mesh);
  }
  for(const name of assetNames){
    const group=new T.Scene();
    const lit=name==='hall'?hall[0]:name==='hall-detail'?hall[1]:batchByMaterial(categories[name]);
    group.add(...lit);
    const bytes=await new GLTFExporter().parseAsync(group,{binary:true,maxTextureSize:256});
    files.push({name,bytes,draws:lit.length,triangles:lit.reduce((n,m)=>n+((m.geometry.index?.count??m.geometry.attributes.position.count)/3)*(m.isInstancedMesh?m.count:1),0)});
  }
  return files;
}
const pack=await exportParts(Number(new URL(location.href).searchParams.get('ratio')??1));
window.summary=pack.map(({name,bytes,draws,triangles})=>({name,bytes:bytes.byteLength,draws,triangles}));
console.log(JSON.stringify(window.summary));
if(pack.length!==maxParts)throw Error('Arrival requires six bounded parts.');
const oversized=pack.filter(file=>file.bytes.byteLength>maxPart);
if(oversized.length)throw Error('Over budget: '+oversized.map(x=>x.name+' '+x.bytes.byteLength).join(', '));
for(const {name,bytes} of pack){
  const response=await fetch('out/'+name+'.glb',{method:'POST',body:bytes});
  if(!response.ok)throw Error('Local export refused '+name);
}
const obstacles=scene.obstacles.map(({inverse,half})=>{
  const transform=inverse.clone().invert();
  const center=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3();
  transform.decompose(center,quat,scale);
  const orientation=new T.Euler().setFromQuaternion(quat,'YXZ');
  return {position:center.toArray(),size:half.toArray().map(v=>v*2),rotationY:orientation.y};
});
await fetch('out/arrival-report.json',{method:'POST',body:JSON.stringify({files:window.summary,obstacles,shaders:opt.shaders})});

const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1050,660,false);
renderer.setPixelRatio(1);
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.06;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const light=new T.DirectionalLight(0xffe7c4,2.3);
light.position.set(-12,23,14);
light.castShadow=true;
Object.assign(light.shadow.camera,{left:-26,right:26,top:24,bottom:-26,near:.25,far:75});
light.shadow.mapSize.set(2048,2048);
light.shadow.normalBias=.036;
light.shadow.bias=-.00015;
const matched=new T.Scene();matched.background=new T.Color(0xb6c9d9);
matched.add(new T.HemisphereLight(0xd4e1ee,0x645444,1.42),light,light.target);
const again=new GLTFLoader();
for(const {bytes} of pack){const decoded=(await again.parseAsync(bytes,'')).scene;decoded.traverse(m=>{
  if(m.isMesh){m.receiveShadow=true;m.castShadow=m.material.side!==T.DoubleSide;}
});matched.add(decoded);}
const camera=new T.PerspectiveCamera(56,1050/660,.05,185);
window.paint=(name)=>{
  const v=reviewViews[name];camera.fov=v.fov;camera.updateProjectionMatrix();
  camera.position.set(...v.eye);camera.lookAt(...v.target);renderer.render(matched,camera);
  return {...renderer.info.render};
};
window.reviewViews=reviewViews;
window.done=window.paint('hall');
