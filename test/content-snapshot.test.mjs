import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Room} from '../src/room.mjs';import {exportWorldSnapshot} from '../tools/export-world-snapshot.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const human={id:'snapshot-fixture',kind:'human',rights:['observe','edit']};
const scenery=readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url));
function document(bytes){assert.equal(bytes.readUInt32LE(8),bytes.length);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());}
test('GLB freezes semantic creation state with shared entity references and independent source hashes',async()=>{
 const room=new Room();const observation=room.observe(human);
 const proposal={id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observation.id,type:'garden.place',target:'garden-snapshot',expectedRevision:null,args:{x:2,z:1,color:'rose'}};
 room.command(human,proposal);const captured=room.observe(human);const glb=exportWorldSnapshot(captured,scenery);const result=document(glb);
 assert.ok(glb.length<2*1024*1024);assert.ok(result.nodes.some(node=>node.name==='garden-snapshot'));
 assert.equal(result.extras.holodeck.semanticSequence,1);assert.equal(result.extras.holodeck.participantsExported,false);
 assert.equal(result.extras.holodeck.scenerySha256.length,64);
 assert.equal(result.extras.holodeck.authoredProjectionSha256.length,64);
 assert.ok(result.nodes.some(node=>node.name==='bridge'&&node.extras.revision===0));
 const loaded=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 assert.ok(loaded.scene.getObjectByName('garden-snapshot'));
 assert.equal(loaded.scene.getObjectByName('bridge').userData.revision,0);
 for(const view of result.bufferViews)assert.ok(view.byteOffset+view.byteLength<=result.buffers[0].byteLength);
 room.command(human,{...proposal,id:crypto.randomUUID(),type:'garden.remove',observation:captured.id,expectedRevision:1,args:{}});
 assert.ok(!document(exportWorldSnapshot(room.observe(human),scenery)).nodes.some(node=>node.name==='garden-snapshot'));
 assert.ok(result.nodes.some(node=>node.name==='garden-snapshot'));
});
test('unrecognized content cannot inject files or arbitrary runtime geometry into a snapshot',()=>{
 const room=new Room();const observation=room.observe(human);observation.entities['garden-invalid']={x:Infinity,z:0,color:'mint'};
 assert.throws(()=>exportWorldSnapshot(observation,scenery),/Unsupported creation/);
 const otherEdition=new Room({edition:'different-authored-world@1'}).observe(human);
 assert.throws(()=>exportWorldSnapshot(otherEdition,scenery),/bounded workshop situation/);
});

test('actual shared-capacity snapshot bounds, sphere error and winding are qualified for raised and lowered bridge',async t=>{
 const {MAX_WORLD_ELEMENTS}=await import('../src/world-limits.mjs');
 const {Vector3,Triangle}=await import('three');
 const {workshopColour}=await import('../src/workshop.mjs');
 const room=new Room();
 for(let i=0;i<MAX_WORLD_ELEMENTS-1;i++){
  const o=room.observe(human),result=room.command(human,{id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:o.id,type:'garden.place',target:'garden-'+String(i).padEnd(40,'x'),expectedRevision:null,args:{x:15.5+(i%7)*2,z:-5+Math.floor(i/7)*1.1,color:['mint','amber','rose','violet'][i%4]}});
  assert.equal(result.status,'completed');
 }
 for(const raised of [false,true]){
  if(raised){const o=room.observe(human);assert.equal(room.command(human,{id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:o.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}}).status,'completed');}
  const captured=room.observe(human),glb=exportWorldSnapshot(captured,scenery),doc=document(glb);
  assert.ok(glb.length<=2*1024*1024);assert.equal(Object.keys(captured.entities).length,MAX_WORLD_ELEMENTS);
  assert.equal(doc.extras.holodeck.meshApproximation.sphere.widthSegments,12);assert.equal(doc.extras.holodeck.meshApproximation.sphere.heightSegments,8);
  const loaded=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');let spheres=0,maxError=0;
  try{
   loaded.scene.traverse(mesh=>{
    if(!mesh.isMesh||mesh.userData.analyticPrimitive?.kind!=='sphere')return;
    spheres++;const analytic=mesh.userData.analyticPrimitive,center=new Vector3(...analytic.center),radius=analytic.radius,geometry=mesh.geometry,positions=geometry.getAttribute('position');geometry.computeBoundingBox();
    for(const axis of ['x','y','z']){assert.ok(Math.abs(geometry.boundingBox.min[axis]-(center[axis]-radius))<2e-6);assert.ok(Math.abs(geometry.boundingBox.max[axis]-(center[axis]+radius))<2e-6);}
    for(let i=0;i<positions.count;i+=3){
     const a=new Vector3().fromBufferAttribute(positions,i),b=new Vector3().fromBufferAttribute(positions,i+1),c=new Vector3().fromBufferAttribute(positions,i+2),triangle=new Triangle(a,b,c);
     for(const vertex of [a,b,c])assert.ok(Math.abs(vertex.distanceTo(center)-radius)<2e-6);
     assert.ok(triangle.getNormal(new Vector3()).dot(triangle.getMidpoint(new Vector3()).sub(center))>0,'sphere faces retain outward winding');
     maxError=Math.max(maxError,(radius-triangle.closestPointToPoint(center,new Vector3()).distanceTo(center))/radius);
    }
    if(mesh.name.startsWith('garden-')){const id=mesh.name.slice(0,-'-light'.length),entity=captured.entities[id];assert.ok(entity);assert.equal(mesh.material.color.getHexString(),workshopColour(entity.color).slice(1));assert.ok(Math.abs(center.x-entity.x)<1e-10);assert.ok(Math.abs(center.z-entity.z)<1e-10);assert.equal(radius,.34);}
   });
   assert.equal(spheres,MAX_WORLD_ELEMENTS);assert.ok(maxError<=doc.extras.holodeck.meshApproximation.sphere.maxRelativeRadialError);
   t.diagnostic(JSON.stringify({raised,entities:MAX_WORLD_ELEMENTS,glbBytes:glb.length,spheres,maxRelativeSphereError:maxError}));
  }finally{loaded.scene.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}});}
 }
 const overflow=room.observe(human);overflow.entities['garden-overflow']={id:'garden-overflow',revision:1,x:0,z:0,color:'mint'};
 assert.throws(()=>exportWorldSnapshot(overflow,scenery),/bounded workshop situation/);
});
