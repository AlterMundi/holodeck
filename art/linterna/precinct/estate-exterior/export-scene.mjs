import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {plot,buildExterior,batchExterior,collisionScene} from './geometry.mjs';

const near=buildExterior(),far=buildExterior(true);
function boundsOf(scene){
  scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(scene);
  const cap=(axis,half)=>box.min[axis]>=-half-.002&&box.max[axis]<=half+.002;
  if(!cap('x',plot.width/2)||!cap('z',plot.depth/2))throw Error('Exterior crosses the parcel boundary');
  return {min:box.min.toArray(),max:box.max.toArray()};
}
function free(x,z,radius){
  return near.boxes.every(({position:[a,y,b],size:[w,h,d],rotationY})=>{
    if(y+h/2<.13||y-h/2>1.78)return true;
    const angle=rotationY*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    return Math.abs(c*(x-a)-s*(z-b))>=w/2+radius||Math.abs(s*(x-a)+c*(z-b))>=d/2+radius;
  });
}
const path=Array.from({length:351},(_,i)=>35+(plot.stand[2]-35)*i/350);
for(const x of [-.40,0,.40])for(const z of path)
  if(!free(x,z,.26))throw Error('The existing outside standing point is blocked at '+[x,z]);
const sealed=near.boxes.find(box=>box.id==='recibidor-shell-closed-door');
if(!sealed||free(0,sealed.position[2],.26)||plot.stand[2]-sealed.position[2]<.85)
  throw Error('The public walk reaches the native doorway without a closed shell');

const views=['near','distance','collision'];
const versions=[
  batchExterior(near.group),batchExterior(far.group),collisionScene(near.boxes),
];
const loader=new GLTFLoader(),exporter=new GLTFExporter();
const limits=[6*1024*1024,768*1024,128*1024];
const statistics=[];
let reloaded;
for(const [i,scene] of versions.entries()){
  boundsOf(scene);
  const binary=await exporter.parseAsync(scene,{binary:true,maxTextureSize:512});
  if(binary.byteLength>limits[i])throw Error(views[i]+' exterior exceeds its selected budget');
  const loaded=await loader.parseAsync(binary,'');
  const bounds=boundsOf(loaded.scene);
  if(loaded.parser.json.buffers.some(value=>value.uri)||
      (loaded.parser.json.images??[]).some(value=>!Number.isInteger(value.bufferView)))
    throw Error('Use self-contained models');
  let triangles=0,primitives=0;
  loaded.scene.traverse(m=>{
    if(!m.isMesh)return;
    triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
    primitives++;
  });
  statistics.push({role:views[i],bytes:binary.byteLength,triangles,primitives,bounds});
  if(i===0)reloaded=loaded.scene;
  const response=await fetch('/result/'+views[i]+'.glb',{method:'POST',body:binary});
  if(!response.ok)throw Error('Exporter could not write '+views[i]);
}
if(statistics[1].triangles>statistics[0].triangles*.45)
  throw Error('The distance model still carries too much near geometry');
const check={plot,standMetresFromDoor:.85,pathSamples:path.length*3,boxes:near.boxes,assets:statistics};
const response=await fetch('/result/geometry.json',{method:'POST',body:JSON.stringify(check)});
if(!response.ok)throw Error('Exporter could not write its geometry evidence');

const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,800,false);
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.16;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0xa9c0cf);scene.fog=new T.FogExp2(0xb3c8d3,.003);
const ground=new T.Mesh(new T.PlaneGeometry(240,240).rotateX(-Math.PI/2),
  new T.MeshStandardMaterial({color:0x546441,roughness:.97}));
ground.position.y=-.091;ground.receiveShadow=true;
scene.add(ground,new T.HemisphereLight(0xcde0ec,0x938765,1.8));
const connector=new T.Mesh(new T.PlaneGeometry(7.4,12).rotateX(-Math.PI/2),
  new T.MeshStandardMaterial({color:0xcbb798,roughness:.88}));
connector.position.set(0,-.011,35.7);connector.receiveShadow=true;scene.add(connector);
const sun=new T.DirectionalLight(0xffe7c7,2.2);
sun.position.set(-30,43,31);sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-37,right:37,top:37,bottom:-37,near:1,far:115});
sun.shadow.mapSize.set(4096,4096);sun.shadow.normalBias=.04;sun.shadow.bias=-.00030;
scene.add(sun,sun.target,reloaded);
reloaded.traverse(m=>{if(m.isMesh){m.receiveShadow=true;m.castShadow=true;}});
const placements={
  arrival:{eye:[-6,1.68,40.5],aim:[0,2.8,15],fov:58},
  doorway:{eye:[-.25,1.68,12.9],aim:[0,2.15,1.6],fov:57},
};
window.paint=(key)=>{
  const {eye,aim,fov}=placements[key];
  const camera=new T.PerspectiveCamera(fov,1280/800,.12,200);
  camera.position.set(...eye);camera.lookAt(...aim);renderer.render(scene,camera);
};
window.paint('arrival');window.done=statistics;
