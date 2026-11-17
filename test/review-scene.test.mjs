import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {Room} from '../src/room.mjs';
import {exportReviewScene} from '../tools/export-review-scene.mjs';
const scenery=readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url));
const actor={id:'review-scene-fixture',kind:'human',rights:['observe','edit']};
function command(room,type,target,args,expectedRevision){
 const observed=room.observe(actor);
 return room.command(actor,{id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observed.id,type,target,args,expectedRevision});
}
test('review meshes preserve metre anchors, valid triangles, stable entity parts and omit removed content',async()=>{
 const room=new Room();
 command(room,'garden.place','garden-first',{x:-2,z:1,color:'mint'},null);
 command(room,'garden.place','garden-second',{x:2,z:1,color:'rose'},null);
 const captured=room.observe(actor),before=await exportReviewScene(captured,scenery);
 const parts=before.scene.parts.filter(p=>p.id.startsWith('garden-second-'));
 assert.ok(parts.length>0);assert.equal(before.scene.units,'mm');assert.equal(before.source.scale,1000);
 const xs=parts.flatMap(p=>p.vertices.map(v=>v[0])),ys=parts.flatMap(p=>p.vertices.map(v=>v[1])),zs=parts.flatMap(p=>p.vertices.map(v=>v[2]));
 assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-2000)<.01);
 assert.ok(Math.abs((Math.min(...ys)+Math.max(...ys))/2+1000)<.01);
 assert.ok(Math.max(...zs)>500);assert.ok(Math.min(...zs)>=0);
 assert.equal(before.source.sourceUp,'Y');assert.equal(before.source.displayUp,'Z');
 assert.equal(before.source.run,captured.run);assert.equal(before.source.snapshotSha256.length,64);
 assert.ok(before.source.parts.some(p=>p.entity==='garden-second'&&p.revision===1));
 for(const part of before.scene.parts)for(const face of part.faces)assert.ok(face.every(i=>Number.isInteger(i)&&i>=0&&i<part.vertices.length));
 command(room,'garden.remove','garden-first',{},1);
 const after=await exportReviewScene(room.observe(actor),scenery);
 assert.ok(!after.source.parts.some(p=>p.entity==='garden-first'));
 assert.deepEqual(after.scene.parts.filter(p=>p.id.startsWith('garden-second-')),parts);
 assert.equal(before.source.parts.some(p=>p.entity==='garden-first'),true);
 assert.deepEqual(await exportReviewScene(captured,scenery),before);
 const deck=before.scene.parts.find(p=>p.id==='bridge-deck-1');assert.ok(deck);
 command(room,'bridge.set','bridge',{raised:true},0);
 const raised=await exportReviewScene(room.observe(actor),scenery);
 assert.ok(raised.scene.parts.some(p=>p.id===deck.id));
 assert.equal(raised.source.parts.find(p=>p.part===deck.id).revision,1);
});
test('generated review scene is accepted by the real installed gallery builder',{skip:!process.env.HOLODECK_REVIEW_BUILDER},async()=>{
 const {scene,source}=await exportReviewScene(new Room().observe(actor),scenery);
 const dir=mkdtempSync(join(tmpdir(),'holodeck-review-scene-'));
 try{
  const input=join(dir,'scene.json');writeFileSync(input,JSON.stringify({...scene,holodeckSource:source}));
  const script=process.env.HOLODECK_REVIEW_BUILDER;
  // Qualification explicitly selects an installed owning builder; generic CI
  // retains the geometric test without assuming another project's installation.
  const result=spawnSync('python3',[script,'--scene',input,'--out',join(dir,'index.html'),'--live'],{encoding:'utf8',timeout:20000,maxBuffer:16384});
  assert.equal(result.status,0,result.stderr);
  const gallery=JSON.parse(readFileSync(join(dir,'gallery.json'),'utf8'));
  assert.ok(JSON.stringify(gallery).includes('scenery--part-1'));
  assert.ok(readFileSync(join(dir,'review-live.json'),'utf8').includes('dm.review-live/v1'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
