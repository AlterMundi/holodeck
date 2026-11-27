import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchModel} from '../precinct/batch.mjs';
import {comparisonSurfaces,createFinishedWorkshop,worktable} from './model.mjs';

const canvas=document.querySelector('canvas');
const state=document.querySelector('output');
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.26;
const scene=new T.Scene();
scene.background=new T.Color('#c7d4c5');
const camera=new T.PerspectiveCamera(52,1,.075,70);

function daylight(){
  scene.add(new T.HemisphereLight('#e7f0f5','#ccb08d',1.85));
  scene.add(new T.AmbientLight('#ffedd6',.46));
  const sun=new T.DirectionalLight('#ffe4ba',4);
  sun.position.set(-15,5.6,6.4);
  sun.target.position.set(0,0,.18);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.near=1;
  sun.shadow.camera.far=40;
  Object.assign(sun.shadow.camera,{left:-8,right:8,bottom:-7,top:7});
  sun.shadow.bias=-.00024;
  sun.shadow.normalBias=.026;
  scene.add(sun,sun.target);
  const roomBounce=new T.DirectionalLight('#f4cdab',.58);
  roomBounce.position.set(5.3,2.4,4.6);
  scene.add(roomBounce);
  const windowBounce=new T.DirectionalLight('#ffdfae',.79);
  windowBounce.position.set(-4.8,2.96,3.2);
  scene.add(windowBounce);
}

function gardenContext(){
  // Review-only scenery, outside the asset boundary.
  const treeGeo=new T.IcosahedronGeometry(1,2);
  const leafInk=['#5e753b','#728343','#8a9550','#9b9d53']
    .map(color=>new T.MeshStandardMaterial({color,roughness:.98}));
  const bark=new T.MeshStandardMaterial({color:'#715437',roughness:.88});
  const earth=new T.Mesh(new T.BoxGeometry(32,.22,38),new T.MeshStandardMaterial({color:'#848c52'}));
  earth.position.set(-22,-.13,0);
  scene.add(earth);
  for(let i=0;i<14;i++){
    const x=-8.2-(i%4)*2.37,z=-7.4+i*1.58,height=3.1+(i*23%5)*.38;
    const tree=new T.Mesh(new T.CylinderGeometry(.095,.18,height*.77,9),bark);
    tree.position.set(x,height*.40,z);
    tree.rotation.z=(i%2?.076:-.091);
    scene.add(tree);
    for(let j=0;j<13;j++){
      const angle=i*1.91+j*2.4;
      const leaves=new T.Mesh(treeGeo,leafInk[(i+j)%leafInk.length]);
      const distance=.1+(j%5)*.26;
      leaves.position.set(x+Math.cos(angle)*distance,height*.56+j*.124,z+Math.sin(angle)*distance);
      leaves.scale.set(.59+(j%3)*.15,.69+(j%2)*.13,.58+(i%3)*.18);
      leaves.rotation.y=angle*.24;
      // Let sunlight pass the leafy reference scenery and reach the actual sash.
      scene.add(leaves);
    }
  }
}

function previewPiece(project,anchor,height,color,turn){
  const piece=new T.Group();
  const geometryGroup=new T.Group();
  for (const item of project.objects.filter(item=>item.visible)){
    const meshData=new T.BufferGeometry();
    meshData.setAttribute('position',new T.Float32BufferAttribute(item.positions,3));
    meshData.setIndex(item.indices);
    meshData.computeVertexNormals();
    const tone=color??item.color;
    const mesh=new T.Mesh(meshData,new T.MeshStandardMaterial({color:tone,roughness:.78}));
    mesh.position.set(...item.position);
    mesh.scale.setScalar(item.scale);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    geometryGroup.add(mesh);
  }
  const bounds=new T.Box3().setFromObject(geometryGroup);
  const center=bounds.getCenter(new T.Vector3());
  geometryGroup.position.set(-center.x,-bounds.min.y,-center.z);
  piece.add(geometryGroup);
  piece.scale.setScalar(height/(bounds.max.y-bounds.min.y));
  piece.position.set(...anchor);
  piece.rotation.y=turn;
  scene.add(piece);
}

const views={
  room:{eye:[2.76,1.78,5.84],focus:[-.50,1.28,-1.25],lens:58},
  table:{eye:[1.82,1.64,.65],focus:[-.16,1.20,-2.04],lens:49},
};

function chooseView(name){
  const {eye,focus,lens}=views[name];
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;
  camera.position.set(...eye);
  camera.lookAt(...focus);
  camera.fov=lens;
  camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate=true;
  renderer.render(scene,camera);
  state.dataset.view=name;
}

async function mount(){
  const source=await createFinishedWorkshop();
  const art=batchModel(source,{retainUV:true});
  const data=await new GLTFExporter().parseAsync(art,{binary:true,maxTextureSize:512});
  const reopened=await new GLTFLoader().parseAsync(data,'');
  const room=reopened.scene;
  room.traverse(node=>{
    if (node.isMesh) {
      node.castShadow=node.material.name!=='Oak floor';
      node.receiveShadow=true;
      if(node.material.map)node.material.map.anisotropy=8;
    }
  });
  scene.add(room);
  daylight();
  gardenContext();
  // A designated sculpture fixture can be used for the review. It is brought
  // in after export and stays outside the GLB, just like a workspace object.
  const sample=new URLSearchParams(location.search).has('sample')&&
    await fetch('./sample.sculpt',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw Error('The selected review sculpture is unavailable.');
      return response.json();
    });
  if (sample){
    const project=typeof sample.document==='string'?JSON.parse(sample.document):sample.document;
    previewPiece(project,worktable.turntable,.49,null,0);
    previewPiece(project,comparisonSurfaces[0],.29,'#d0ab83',.72);
    previewPiece(project,comparisonSurfaces[1],.31,'#aa644b',-.61);
  }
  const stats={bytes:data.byteLength,materials:art.children.length,triangles:art.children.reduce((total,node)=>
    total+(node.geometry.index?.count??node.geometry.attributes.position.count)/3,0),worktable,
    bounds:new T.Box3().setFromObject(room),draws:renderer.info.render.calls};
  window.workshopReview={
    stats,chooseView,
    save(){
      const link=document.createElement('a');
      link.download='Hefesto-Taller-Claymon.glb';
      link.href=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));
      link.click();
      setTimeout(()=>URL.revokeObjectURL(link.href),500);
    },
  };
  chooseView('room');
  stats.draws=renderer.info.render.calls;
  state.hidden=true;
}

mount().catch(error=>{
  state.textContent=error.message;
  throw error;
});
