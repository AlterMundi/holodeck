import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

import {estate,makeArrivalCourt} from './arrival-court.mjs';

const sourceBase=estate.threshold-estate.sourceDoor*estate.scale;
const manifest=await fetch('/edition/manifest.json').then(r=>r.json());
const models=manifest.cells.arrival.models;
const background=new T.Color(0x9bb7c5);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1400,900,false);
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=background;
scene.fog=new T.FogExp2(0xaebfca,.0035);
const key=new T.DirectionalLight(0xffe6bd,2.5);
key.position.set(-39,45,36);
key.castShadow=true;
Object.assign(key.shadow.camera,{near:1,far:155,left:-51,right:51,bottom:-51,top:51});
key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.035;key.shadow.bias=-.00018;
const fill=new T.HemisphereLight(0xc9dfee,0x727354,1.6);
scene.add(key,key.target,fill);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const palace=(await loader.loadAsync('/residencia.glb')).scene;
const estateGroup=new T.Group();
const art=new T.Group();
let terrainFinish;
for(const model of models){
  const file=(await loader.loadAsync('/edition/'+model.file)).scene;
  const skip=[];
  file.updateMatrixWorld(true);
  file.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const size=new T.Box3().setFromObject(mesh).getSize(new T.Vector3());
    if(size.x>400||size.z>400){skip.push(mesh);return;}
    if(size.x>64&&size.z>64&&size.y<30){
      terrainFinish=mesh.material;
      skip.push(mesh);
    }
  });
  skip.forEach(mesh=>mesh.removeFromParent());
  art.add(file);
}
art.position.z=sourceBase;
art.scale.setScalar(estate.scale);
estateGroup.add(art);

estateGroup.add(makeArrivalCourt());
function previewGround(color,width,depth,y,z){
  const surface=new T.Mesh(new T.PlaneGeometry(width,depth).rotateX(-Math.PI/2),
    new T.MeshStandardMaterial({color,roughness:.88}));
  surface.position.set(0,y,z);
  surface.receiveShadow=true;
  scene.add(surface);
  return surface;
}
const surroundings=previewGround(0x556449,240,240,-.09,0);
const approach=previewGround(0xd0bb96,7.4,19,.008,37.7);
const palaceGround=previewGround(0x5d6848,260,260,-.22,0);
function materialsForShadows(obj){obj.traverse(node=>{if(node.isMesh){
  node.receiveShadow=true;
  node.castShadow=!(node.material?.side===T.DoubleSide||node.material?.transparent);
}});}
materialsForShadows(estateGroup);
materialsForShadows(palace);
scene.add(estateGroup,palace);
estateGroup.updateMatrixWorld(true);
const parcelBounds=new T.Box3().setFromObject(estateGroup);
const values=point=>point.toArray().map(value=>Number(value.toFixed(3)));
const side=estate.parcelWidth/2;
const halfDepth=estate.parcelDepth/2;
if([parcelBounds.min.x,parcelBounds.max.x].some(x=>Math.abs(x)>side+.01)||
   [parcelBounds.min.z,parcelBounds.max.z].some(z=>Math.abs(z)>halfDepth+.01))
  {
  const oversized=[];
  estateGroup.traverse(node=>{
    if(!node.isMesh)return;
    const b=new T.Box3().setFromObject(node);
    if(Math.max(Math.abs(b.min.x),Math.abs(b.max.x),Math.abs(b.min.z),Math.abs(b.max.z))>36.01)
      oversized.push({name:node.name,min:values(b.min),max:values(b.max),instances:node.isInstancedMesh});
  });
  throw Error('Exterior geometry crosses the measured parcel boundary '+JSON.stringify(oversized.slice(0,12)));
}
const pavers=2.9, porticoClearance=3.84-1.15/2;
if(porticoClearance<pavers+.24||Math.abs(sourceBase+estate.sourceDoor*estate.scale-estate.threshold)>.001)
  throw Error('Approach axis no longer matches the existing threshold');
window.survey={parcel:[estate.parcelWidth,estate.parcelDepth],bounds:{min:values(parcelBounds.min),max:values(parcelBounds.max)},
  porticoClearWidth:porticoClearance*2,pathWidth:estate.path.width,threshold:estate.threshold,sourceScale:estate.scale};
const cameras={
  approach:{pos:[-7,1.68,42.2],look:[0,2.6,18],fov:59},
  threshold:{pos:[-.7,1.68,24.3],look:[0,2.35,-7],fov:62},
  corner:{pos:[-48,41,50],look:[0,1.4,0],fov:53},
  plan:{pos:[0,74,0],look:[0,0,0],ortho:true},
  palace:{pos:[-22,17,90],look:[0,13,0],fov:59},
};
const templeAnchor=(x,z)=>[x*estate.scale,1,z*estate.scale+sourceBase];
const labels={portico:[0,1,25.7],patio:[0,.1,17],door:[0,.1,estate.threshold],
  athena:templeAnchor(-13.5,-12.8),hefesto:templeAnchor(0,-22),apollo:templeAnchor(13.5,-12.8),
  edge:[36,.1,36],opposite:[-36,.1,-36]};
window.paint=(name)=>{
  const v=cameras[name];
  estateGroup.visible=name!=='palace';palace.visible=name==='palace';
  surroundings.visible=name!=='palace'&&name!=='plan';
  approach.visible=name!=='palace';palaceGround.visible=name==='palace';
  const ratio=1400/900, half=38;
  const camera=v.ortho?new T.OrthographicCamera(-half*ratio,half*ratio,half,-half,.1,250):
    new T.PerspectiveCamera(v.fov,ratio,.1,250);
  if(v.ortho)camera.up.set(0,0,1);
  camera.position.set(...v.pos);camera.lookAt(...v.look);
  renderer.render(scene,camera);
  const projected={};
  for(const [id,v] of Object.entries(labels)){
    const point=new T.Vector3(...v).project(camera);
    projected[id]=[Math.round((point.x+1)*700),Math.round((1-point.y)*450)];
  }
  return {render:{...renderer.info.render},projected,terrainSubstituted:Boolean(terrainFinish)};
};
window.done=window.paint('approach');
