import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const estate={
  parcelWidth:72,parcelDepth:72,
  portico:{z:25.7,width:15.6,depth:4.4,height:7},
  threshold:2.45,scale:.74,sourceDoor:12.4,
  path:{width:5.8,outside:31},
};
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

function stoneTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#d8c7a9';ctx.fillRect(0,0,128,128);
  let state=112516;
  for(let i=0;i<3800;i++){
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    const x=state&127,y=(state>>>16)&127;
    ctx.fillStyle=i%3===0?'rgba(250,243,224,.20)':'rgba(106,86,60,.13)';
    ctx.fillRect(x,y,1+((state>>>8)&3),1+((state>>>24)&1));
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  return texture;
}
const stoneMap=stoneTexture();
const mat=(col,roughness=.84,metalness=0)=>new T.MeshStandardMaterial({color:col,roughness,metalness});
const ivory=new T.MeshStandardMaterial({color:0xf4ead5,map:stoneMap,roughness:.75});
const lime=new T.MeshStandardMaterial({color:0xd9caab,map:stoneMap,roughness:.84});
const base=new T.MeshStandardMaterial({color:0xab9772,map:stoneMap,roughness:.84});
const terracotta=mat(0xa34d29,.84);
const darkRoof=mat(0x753018,.86);
const bronze=mat(0x514629,.55,.46);
const glass=new T.MeshStandardMaterial({color:0xffcc6e,emissive:0xffa324,emissiveIntensity:.64,roughness:.4});
const soil=mat(0x4b633b,.96);
const green=[mat(0x344522,.93),mat(0x435b30,.9),mat(0x566a41,.83)];
const water=mat(0x337d83,.33,.14);
const tile=[0xbca582,0xd0bb96,0xc8ad84,0xbfa98d,0xdac6a5].map(value=>mat(value));
function mesh(geo,material,x,y,z,parent=estateGroup){
  const object=new T.Mesh(geo,material);object.position.set(x,y,z);
  object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
}
function block(material,x,y,z,w,h,d,parent=estateGroup){return mesh(new T.BoxGeometry(w,h,d),material,x,y,z,parent);}
function cylinder(material,x,y,z,top,bottom,h,n=24){return mesh(new T.CylinderGeometry(top,bottom,h,n),material,x,y,z);}
function col(x,z){
  block(base,x,.12,z,1.15,.24,1.08);
  cylinder(lime,x,.31,z,.47,.56,.15);
  cylinder(ivory,x,.44,z,.39,.47,.13);
  const shaft=new T.CylinderGeometry(.326,.408,4.21,72,8,true);
  const a=shaft.attributes.position;
  for(let i=0;i<a.count;i++){
    const theta=Math.atan2(a.getX(i),a.getZ(i)),r=Math.hypot(a.getX(i),a.getZ(i));
    const flute=.018*(1-Math.cos(18*theta))/2;
    a.setX(i,a.getX(i)*(r-flute)/r);a.setZ(i,a.getZ(i)*(r-flute)/r);
  }
  shaft.computeVertexNormals();
  mesh(shaft,ivory,x,2.602,z);
  cylinder(lime,x,4.766,z,.405,.33,.155);
  for(const side of [-1,1]){
    const coil=mesh(new T.TorusGeometry(.18,.055,8,24),ivory,x+side*.284,4.91,z+.07);coil.rotation.y=side*.10;
  }
  block(ivory,x,5.061,z,.94,.185,.76);
}
const g=estate.portico, gz=g.z;
for(const z of [gz-1.40,gz+1.40]) for(const x of [-6.7,-3.84,3.84,6.7])col(x,z);
block(lime,0,5.25,gz,15.1,.20,3.8);
block(ivory,0,5.48,gz,15.6,.26,4.28);
block(lime,0,5.69,gz,15.85,.16,4.48);
for(const z of [gz-2.15,gz+2.15]){
  for(let x=-7.45;x<=7.45;x+=.47)block(ivory,x,5.58,z,.16,.12,.19);
  const profile=new T.Shape();
  profile.moveTo(-7.75,0);profile.lineTo(7.75,0);profile.lineTo(0,1.02);profile.closePath();
  mesh(new T.ExtrudeGeometry(profile,{depth:.16,bevelEnabled:false}),lime,0,5.76,z-.08);
}
for(const s of [-1,1]){
  const roof=block(terracotta,s*3.96,6.34,gz,8.1,.18,4.72);
  roof.rotation.z=-s*.13;
  for(let j=0;j<11;j++){
    const x=s*(.38+j*.7),y=6.85-.13*Math.abs(x);
    const tileRow=mesh(new T.CylinderGeometry(.045,.045,4.76,9),j%4===0?darkRoof:terracotta,x,y,gz);
    tileRow.rotation.x=Math.PI/2;
  }
}
const ridge=mesh(new T.CylinderGeometry(.077,.077,4.65,15),darkRoof,0,6.98,gz);ridge.rotation.x=Math.PI/2;
cylinder(bronze,0,4.81,gz,.026,.026,1.39,12);
cylinder(bronze,0,4.10,gz,.43,.34,.12,6);
cylinder(glass,0,3.815,gz,.276,.276,.51,6);
cylinder(bronze,0,3.515,gz,.32,.39,.105,6);
for(let side=0;side<6;side++){
  const angle=side*Math.PI/3;
  cylinder(bronze,Math.cos(angle)*.285,3.81,gz+Math.sin(angle)*.285,.023,.023,.54,8);
}

function gardenGround(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const u=x/512*Math.PI*2,v=y/512*Math.PI*2;
    const moss=.46*Math.sin(7*u+Math.cos(9*v))+.28*Math.cos(17*v+Math.cos(7*u))
      +.18*Math.sin(29*u+38*v)+.09*Math.cos(93*u-99*v);
    const i=(512*y+x)*4;
    data.data.set([60+13*moss,82+14*moss,43+10*moss,255],i);
  }
  ctx.putImageData(data,0,0);
  const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t;
}
const plotFinish=new T.MeshStandardMaterial({map:gardenGround(),roughness:.96});
const parcelBase=mesh(new T.PlaneGeometry(72,72).rotateX(-Math.PI/2),plotFinish,0,-.022,0);
parcelBase.castShadow=false;
const surroundings=mesh(new T.PlaneGeometry(240,240).rotateX(-Math.PI/2),mat(0x556449),0,-.09,0,scene);
surroundings.castShadow=false;
for(let z=27.9;z>=estate.threshold-.07;z-=1.04)for(let col=0;col<6;col++){
  const x=(col-2.5)*.96, pattern=((col*17+Math.floor(z*13))%5+5)%5;
  const slab=block(tile[pattern],x,.014,z,.938,.047,1.016);
  slab.castShadow=false;
}
for(const s of [-1,1]){
  for(const z of [20,11]){
    block(lime,s*8.5,.10,z,8.8,.19,5.3);
    block(soil,s*8.5,.20,z,8.35,.05,4.85);
    for(const x of [s*5.2,s*12.0]){
      cylinder(bronze,x,.40,z,.14,.21,.42,12);
      mesh(new T.SphereGeometry(.35,9,7),green[1],x,.85,z);
    }
  }
  block(lime,s*20.1,.49,gz+.48,12.8,1.0,.48);
  block(ivory,s*20.1,1.03,gz+.48,13,.10,.61);
  for(const z of [23,16,8]){
    const x=s*(15.5+(z%2)*1.75);
    cylinder(bronze,x,.78,z,.14,.23,1.65,11);
    const cypress=mesh(new T.LatheGeometry([[0,0],[.52,.27],[.65,1.29],[.63,2.3],[.49,3.48],[.22,4.83],[0,5.63]].map(([r,y])=>new T.Vector2(r,y)),20),green[(z%3)],x,.85,z);
    cypress.rotation.y=z*.113;
    for(let j=0;j<4;j++){
      const bush=mesh(new T.IcosahedronGeometry(.52+(j%2)*.16,2),green[j%3],x+s*(j*.88-2),.355,z-(j%2)*.62);
      bush.scale.y=.65;
    }
  }
}
const approach=block(tile[1],0,-.012,37.7,7.4,.04,19,scene);approach.castShadow=false;
const palaceGround=mesh(new T.PlaneGeometry(260,260).rotateX(-Math.PI/2),mat(0x5d6848),0,-.22,0,scene);
palaceGround.castShadow=false;
const bowlBorder=mat(0xb69f7c,.80);
for(const s of [-1,1]){
  const x=s*9.0,z=21.5;
  cylinder(bowlBorder,x,.105,z,1.74,1.73,.20,48);
  cylinder(water,x,.248,z,1.56,1.56,.024,48);
  const ring=mesh(new T.TorusGeometry(1.66,.085,8,52),ivory,x,.284,z);
  ring.rotation.x=-Math.PI/2;
}
// The actual door sits on the Recibidor wall, behind the open portico.
// A compact stone order distinguishes that second threshold at walking height.
const entryZ=estate.threshold+.86;
for(const x of [-2.29,-1.46,1.46,2.29]){
  block(base,x,.087,entryZ,.53,.174,.62);
  cylinder(lime,x,1.392,entryZ,.168,.223,2.49,24);
  block(ivory,x,2.675,entryZ,.51,.22,.51);
}
block(ivory,0,2.855,entryZ-.25,5.04,.18,1.65);
block(lime,0,3.013,entryZ-.25,5.16,.12,1.72);
const vestibuleGable=new T.Shape();
vestibuleGable.moveTo(-2.62,0);vestibuleGable.lineTo(2.62,0);
vestibuleGable.lineTo(0,.54);vestibuleGable.closePath();
mesh(new T.ExtrudeGeometry(vestibuleGable,{depth:.11,bevelEnabled:false}),ivory,0,3.073,entryZ+.65);
for(const side of [-1,1]){
  const tileRoof=block(terracotta,1.35*side,3.41,entryZ-.25,2.84,.13,1.89);
  tileRoof.rotation.z=-side*.20;
}
for(const side of [-1,1]){
  const lanternX=1.03*side;
  cylinder(bronze,lanternX,2.16,entryZ+.16,.10,.08,.045,10);
  cylinder(glass,lanternX,2.04,entryZ+.16,.065,.065,.20,6);
  cylinder(bronze,lanternX,1.92,entryZ+.16,.08,.102,.05,8);
}
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
