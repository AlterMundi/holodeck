/** Convert the same frozen creation meshes to the existing shared review format.
 * Explicit metres -> millimetres; static display, never a running-world replay.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {exportWorldSnapshot} from './export-world-snapshot.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function exportReviewScene(observation,scenery,{includeAmbientEnvironment=false}={}){
 const glb=exportWorldSnapshot(observation,scenery);
 const snapshotSource=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12))).extras.holodeck;
 const loaded=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 loaded.scene.updateMatrixWorld(true);
 const parts=[],references=[],excludedEnvironment=[],counts=new Map();let triangles=0;
 try{
  loaded.scene.traverse(object=>{
   if(!object.isMesh)return;
   let owner=object;
   while(owner&&!Object.hasOwn(observation.entities,owner.userData.holodeckEntity))owner=owner.parent;
   const entity=owner?.userData.holodeckEntity??(/^bridge-control-(base|ring|orb)$/.test(object.name)?'bridge':'scenery');
   const ordinal=(counts.get(entity)||0)+1;
   counts.set(entity,ordinal);
   const id=entity!=='scenery'&&object.name.startsWith(entity+'-')&&/^[a-z0-9-]+$/.test(object.name)
    ?object.name:`${entity}--part-${ordinal}`;
   // The authored horizon disk spans220m; including it in CAD-style autofit
   // makes the actual islands/creation unreadably small. Keep it in the full
   // GLB snapshot, and explicitly omit only this named ambient material from
   // the creation review. Never filter semantic entities or guess by size.
   if(!includeAmbientEnvironment&&entity==='scenery'&&object.material.name==='water'){
    excludedEnvironment.push({part:id,material:'water',reason:'Ambient horizon backdrop; retained in the full GLB snapshot.'});return;
   }
   if(parts.some(part=>part.id===id))throw Error('Review part identities must be unique');
   const geometry=object.geometry,position=geometry.getAttribute('position');
   if(!position||position.count>65535||Array.isArray(object.material))throw Error('Unsupported review mesh');
   const vertices=[],faces=[],point=new Vector3();
   for(let index=0;index<position.count;index++){
    point.fromBufferAttribute(position,index).applyMatrix4(object.matrixWorld).multiplyScalar(1000);
    // The shared CAD/review renderer is Z-up; the world is Y-up. This proper
    // rotation preserves triangle winding: (x,y,z)m -> (x,-z,y)mm.
    const xyz=[point.x,-point.z,point.y];if(xyz.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9))throw Error('Review vertex exceeds its coordinate bound');
    vertices.push(xyz);
   }
   const count=geometry.index?.count??position.count;
   if(count%3)throw Error('Review mesh must retain triangle topology');
   for(let index=0;index<count;index+=3){
    const face=[0,1,2].map(offset=>geometry.index?geometry.index.getX(index+offset):index+offset);
    if(face.some(n=>!Number.isSafeInteger(n)||n<0||n>=vertices.length))throw Error('Invalid review triangle');
    faces.push(face);
   }
   triangles+=faces.length;
   if(triangles>50000||parts.length>=256)throw Error('Review scene exceeds its display budget');
   let label=`Paisaje · pieza ${ordinal}`;
   if(entity==='bridge'){
    const deck=/^bridge-deck-(\d+)$/.exec(id),post=/^bridge-post-(\d+)-(left|right)$/.exec(id);
    const named={'bridge-control-base':'Mando · base','bridge-control-ring':'Mando · aro','bridge-control-orb':'Mando · esfera',
     'bridge-rail-left':'Baranda izquierda','bridge-rail-right':'Baranda derecha'};
    label='Puente · '+(named[id]||(deck?`Tablón ${Number(deck[1])+1}`:post?`Poste ${Number(post[1])+1} ${post[2]==='left'?'izquierdo':'derecho'}`:`pieza ${ordinal}`));
   }else if(entity!=='scenery'){
    const color=({mint:'verde',amber:'ámbar',rose:'rosada',violet:'violeta'}[observation.entities[entity].color]||'de color personalizado');
    const component=id.endsWith('-base')?'base':id.endsWith('-stem')?'tallo':id.endsWith('-light')?'esfera':`pieza ${ordinal}`;
    label=`Luz ${color} · ${component}`;
   }
   parts.push({id,label,color:'#'+object.material.color.getHexString(),vertices,faces});
   references.push({part:id,entity,revision:entity==='scenery'?null:observation.entities[entity].revision});
  });
  const scene={id:'holodeck-workshop',title:'Holodeck · creación compartida',units:'mm',
   note:'Esta captura conserva la forma de la creación en el momento seleccionado.',
   scope:'Islas, puente y luces creadas.',status:'Edición para revisión.',parts};
  const source={schema:'holodeck.review-source/v1',run:observation.run,edition:observation.edition,
   semanticSequence:observation.source.through,sourceUnits:'m',displayUnits:'mm',scale:1000,sourceUp:'Y',displayUp:'Z',
   displayFromWorld:[[1000,0,0,0],[0,0,-1000,0],[0,1000,0,0],[0,0,0,1]],
   evidence:'Captured semantic state projected through the selected authored source; not a running simulation or human-view capture.',
   snapshotSha256:sha(glb),scenerySha256:sha(scenery),authoredProjectionSha256:snapshotSource.authoredProjectionSha256,parts:references,excludedEnvironment};
  if(!parts.length||Buffer.byteLength(JSON.stringify(scene))>8*1024*1024)throw Error('Review scene exceeds its eight-MiB bound');
  return {scene,source};
 }finally{
  loaded.scene.traverse(object=>{if(object.isMesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output,option]=process.argv.slice(2);
 if(!input||!output||process.argv.length>5||(option&&option!=='--include-environment'))throw Error('Usage: node tools/export-review-scene.mjs SITUATION.json SCENE.json [--include-environment]');
 const bytes=readFileSync(input);if(bytes.length>256*1024)throw Error('Situation input exceeds256KiB');
 const value=JSON.parse(bytes);if(value.ok===false)throw Error('Select a confirmed world observation');
 const result=await exportReviewScene(value.result||value.observation||value,readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url)),{includeAmbientEnvironment:option==='--include-environment'});
 // One bounded self-contained source document. The shared builder accepts its
 // scene fields; source metadata also survives in this editable handoff.
 const document=JSON.stringify({...result.scene,holodeckSource:result.source});
 if(Buffer.byteLength(document)>8*1024*1024)throw Error('Review source exceeds its eight-MiB bound');
 writeFileSync(output,document,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({bytes:Buffer.byteLength(document),sha256:sha(document),parts:result.scene.parts.length}));
}
