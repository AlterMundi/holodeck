import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,CylinderGeometry,SphereGeometry,MeshStandardMaterial,Vector3} from 'three';
import {createHash} from 'node:crypto';
import {workshopProjection} from '../src/workshop-projection.mjs';
import {verifyWorkshopGeometry,AppliedGeometryProbe} from '../src/applied-geometry.mjs';
function fixture(entities={bridge:{id:'bridge',revision:0,raised:false}}){
 const scene=new Group(),objects=new Map(),elements=new Map(),attrs={'data-run':'run-a','data-edition':'edition-a','data-semantic-sequence':'0','data-geometry-state':JSON.stringify(entities)};
 function element(id,object,parent=scene,attributes={}){
  parent.add(object);objects.set(id,object);
  const e={id,isConnected:true,tagName:'M-GROUP',getContainer:()=>object,getVisible:()=>true,isDisabled:()=>false,
   getAttribute:name=>attributes[name]??null,getWorldPosition:()=>object.getWorldPosition(new Vector3())};elements.set(id,e);return e;
 }
 const root=element('workshop',new Group(),scene,attrs);
 root.querySelector=selector=>elements.get(selector.slice(5,-2))||null;
 root.getInitiatedRemoteDocument=()=>({getDocumentAddress:()=> 'ws://fixture/world'});
 const scenery=element('island-scenery',new Group(),root.getContainer());
 scenery.getContainer().add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));
 scenery.modelGraphics={hasLoadedModel:()=>true};scenery.getContentBounds=()=>({});
 for(const entity of workshopProjection(entities))if(!entity.deleted){
  const group=element(entity.id,new Group(),root.getContainer(),{'data-entity-revision':String(entity.revision)});
  for(const n of [...entity.nodes,...(entity.controls||[])]){
   const object=new Group();object.position.set(...n.position);
   const e=element(n.id,object,group.getContainer(),{color:n.color});e.tagName='M-'+n.kind.toUpperCase();
   const geometry=n.kind==='cube'?new BoxGeometry():n.kind==='cylinder'?new CylinderGeometry(.5,.5,1):new SphereGeometry(.5);
   const material=new MeshStandardMaterial();material.color.setRGB(...[1,3,5].map(i=>parseInt(n.color.slice(i,i+2),16)/255));
   const mesh=new Mesh(geometry,material);mesh.scale.set(...(n.kind==='cube'?n.size:n.kind==='cylinder'?[n.size[0]*2,n.size[1],n.size[0]*2]:Array(3).fill(n.size[0]*2)));object.add(mesh);
  }
 }
 scene.updateMatrixWorld(true);
 return {root,scene,attrs,objects,elements,document:{visibilityState:'visible',querySelector:()=>root}};
}
const inspect=f=>verifyWorkshopGeometry(f.root,f.scene,{expectedDocumentURL:'ws://fixture/world'});
test('scene evidence requires actual attached matching primitive meshes, not only revision labels',()=>{
 const f=fixture();assert.deepEqual(inspect(f).entityRefs,[['bridge',0,'attached']]);
 const mesh=f.objects.get('bridge-deck-0').children[0];mesh.scale.y=5;
 assert.equal(inspect(f),null);mesh.scale.y=.2;
 mesh.material.color.r=0;assert.equal(inspect(f),null);
});
test('detached geometry, unloaded scenery, wrong source and stale garden presence remain unknown',()=>{
 const f=fixture({bridge:{revision:2,raised:true},'garden-one':{revision:2,deleted:true}});
 assert.deepEqual(inspect(f).entityRefs,[['bridge',2,'attached'],['garden-one',2,'not-in-document']]);
 f.root.getInitiatedRemoteDocument=()=>({getDocumentAddress:()=> 'blob:private-preview'});assert.equal(inspect(f),null);
 const g=fixture();g.elements.get('island-scenery').modelGraphics.hasLoadedModel=()=>false;assert.equal(inspect(g),null);
 const h=fixture();h.scene.remove(h.root.getContainer());assert.equal(inspect(h),null);
});
test('proof is emitted only after render callback/digest and invalidates on run, age or context loss',async()=>{
 const f=fixture();let mono=10,wall=1000;
 const canvas=new EventTarget();
 const probe=new AppliedGeometryProbe({...f,canvas,expectedDocumentURL:'ws://fixture/world',now:()=>wall,monotonic:()=>mono,
  hash:async text=>createHash('sha256').update(text).digest('hex')});
 assert.equal(probe.snapshot(),null);probe.afterRender();await Promise.resolve();await Promise.resolve();
 const evidence=probe.snapshot();assert.equal(evidence.run,'run-a');assert.equal(evidence.schema,'holodeck.applied-geometry/v1');
 assert.equal(evidence.displayedSequence,undefined);assert.equal(evidence.framePresented,undefined);
 f.attrs['data-run']='run-b';assert.equal(probe.snapshot(),null);f.attrs['data-run']='run-a';
 mono+=2001;assert.equal(probe.snapshot(),null);mono=20;
 canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(probe.snapshot(),null);probe.dispose();
});
test('a delayed digest cannot acknowledge a superseded edition',async()=>{
 const f=fixture();let finish;
 const probe=new AppliedGeometryProbe({...f,expectedDocumentURL:'ws://fixture/world',hash:()=>new Promise(r=>finish=r)});
 probe.afterRender();f.attrs['data-edition']='edition-b';finish('hash-of-old-edition');await Promise.resolve();await Promise.resolve();
 assert.equal(probe.snapshot(),null);probe.dispose();
});

test('capture rechecks actual geometry even when no DOM observer fired',async()=>{
 const f=fixture();const probe=new AppliedGeometryProbe({...f,expectedDocumentURL:'ws://fixture/world',hash:async()=> 'a'.repeat(64)});
 probe.afterRender();await Promise.resolve();await Promise.resolve();assert.ok(probe.snapshot());
 f.objects.get('bridge-deck-0').children[0].scale.x=99;
 assert.equal(probe.snapshot(),null);probe.dispose();
});
test('all bounded entities are verified while transmitted references stay compact',async()=>{
 const entities={bridge:{revision:1,raised:true}};
 for(let i=0;i<31;i++)entities[`garden-${i}`]={revision:1,x:0,z:0,color:'mint'};
 const f=fixture(entities),probe=new AppliedGeometryProbe({...f,expectedDocumentURL:'ws://fixture/world',hash:async()=> 'b'.repeat(64)});
 probe.afterRender();await Promise.resolve();await Promise.resolve();const proof=probe.snapshot();
 assert.equal(proof.entityCount,32);assert.equal(proof.entityRefs.length,8);assert.equal(proof.omittedEntityRefs,24);
 assert.ok(Buffer.byteLength(JSON.stringify(proof))<2048);
 f.objects.get('garden-30-light').children[0].scale.x=42;
 assert.equal(probe.snapshot(),null);probe.dispose();
});
test('a tombstone reports document absence without claiming a former Three object detached',()=>{
 const f=fixture({bridge:{revision:0,raised:false},'garden-one':{revision:1,x:0,z:0,color:'mint'}});
 const old=f.objects.get('garden-one');
 f.elements.delete('garden-one');
 f.attrs['data-geometry-state']=JSON.stringify({bridge:{revision:0,raised:false},'garden-one':{revision:2,deleted:true}});
 const result=inspect(f);
 assert.ok(old.parent); // A deliberately lingering scene object: no detach claim.
 assert.deepEqual(result.entityRefs.at(-1),['garden-one',2,'not-in-document']);
 assert.equal(result.entityRefs.some(ref=>ref[2]==='detached'||ref[2]==='absent'),false);
});
