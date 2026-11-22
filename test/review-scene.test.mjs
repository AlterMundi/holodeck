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
 assert.equal(before.source.parts.find(p=>p.part==='bridge-control-orb').entity,'bridge');
 assert.equal(before.scene.parts.find(p=>p.id==='bridge-control-orb').label,'Puente · Mando · esfera');
 assert.ok(parts.every(p=>p.label.startsWith('Luz rosada')));
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
test('creation review excludes only the named ambient horizon while retaining all source geometry in its full snapshot',async()=>{
 const room=new Room();command(room,'garden.place','garden-detail',{x:2,z:1,color:'violet'},null);
 const observation=room.observe(actor),full=await exportReviewScene(observation,scenery,{includeAmbientEnvironment:true});
 const review=await exportReviewScene(observation,scenery);
 assert.deepEqual(full.source.excludedEnvironment,[]);assert.equal(review.source.excludedEnvironment.length,1);
 assert.equal(review.source.excludedEnvironment[0].material,'water');
 const excluded=new Set(review.source.excludedEnvironment.map(part=>part.part));
 assert.deepEqual(review.scene.parts,full.scene.parts.filter(part=>!excluded.has(part.id)));
 assert.deepEqual(review.source.parts,full.source.parts.filter(part=>!excluded.has(part.part)));
 assert.equal(review.source.snapshotSha256,full.source.snapshotSha256);
 assert.ok(review.source.parts.some(part=>part.entity==='garden-detail'));
 const extent=scene=>{const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const part of scene.parts)for(const v of part.vertices)for(let i=0;i<2;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}return Math.max(...max.map((value,i)=>value-min[i]));};
 assert.equal(extent(full.scene),220000);assert.ok(extent(review.scene)<100000);
});
test('generated review scene is accepted by the real installed gallery builder',{skip:!process.env.HOLODECK_REVIEW_BUILDER},async()=>{
 const {scene,source}=await exportReviewScene(new Room().observe(actor),scenery);
 const dir=mkdtempSync(join(tmpdir(),'holodeck-review-scene-'));
 try{
  const input=join(dir,'scene.json');writeFileSync(input,JSON.stringify({...scene,holodeckSource:source}));
  const script=process.env.HOLODECK_REVIEW_BUILDER;
  // Qualification explicitly selects an installed owning builder; generic CI
  // retains the geometric test without assuming another project's installation.
  const result=spawnSync('python3',[script,'--scene',input,'--out',join(dir,'index.html'),'--live','--defer-gallery','--bootstrap-gallery'],{encoding:'utf8',timeout:20000,maxBuffer:16384});
  assert.equal(result.status,0,result.stderr);
  const gallery=JSON.parse(readFileSync(join(dir,'gallery.json'),'utf8'));
  assert.ok(JSON.stringify(gallery).includes('scenery--part-1'));
  const html=readFileSync(join(dir,'index.html'),'utf8');
  const embedded=JSON.parse(html.match(/const SCENES=(.*?);\n/)[1]);
  assert.equal(embedded[0].bootstrap,true);assert.deepEqual(embedded[0].parts,[]);
  assert.ok(readFileSync(join(dir,'review-live.json'),'utf8').includes('dm.review-live/v1'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('actual shared-capacity creation fits snapshot, review and complete publisher stage through the installed builder',{skip:!process.env.HOLODECK_REVIEW_BUILDER},async t=>{
 const {MAX_WORLD_ELEMENTS}=await import('../src/world-limits.mjs');
 const {exportWorldSnapshot}=await import('../tools/export-world-snapshot.mjs');
 const {createHash}=await import('node:crypto');
 const room=new Room();
 for(let i=0;i<MAX_WORLD_ELEMENTS-1;i++)assert.equal(command(room,'garden.place','garden-'+String(i).padEnd(40,'x'),{x:15.5+(i%7)*2,z:-5+Math.floor(i/7)*1.1,color:['mint','amber','rose','violet'][i%4]},null).status,'completed');
 const native={id:'dm:being:v1:'+'s'.repeat(43),kind:'daimon',rights:['observe','edit']};
 const o=room.observe(native);assert.equal(room.command(native,{id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:o.id,nativeRequest:'export-format-fixture',type:'node.place',target:'node-game',expectedRevision:null,args:{title:'Captured recipe',shape:'pedestal',position:{x:22,z:4},links:[],play:{schema:'signal-garden/v1',targets:[{x:19,z:-1,radius:.8,color:'mint'}],minContributors:2}}}).status,'completed');
 for(const raised of [false,true]){
  if(raised)assert.equal(command(room,'bridge.set','bridge',{raised:true},0).status,'completed');
  const observation=room.observe(actor),snapshot=exportWorldSnapshot(observation,scenery),{scene,source}=await exportReviewScene(observation,scenery);
  const inputBytes=JSON.stringify({...scene,holodeckSource:source});assert.ok(Buffer.byteLength(inputBytes)<=8*1024*1024);assert.ok(snapshot.length<=2*1024*1024);assert.ok(scene.parts.length<=256);assert.ok(scene.parts.reduce((n,p)=>n+p.faces.length,0)<=50000);
  assert.equal(source.snapshotSha256,createHash('sha256').update(snapshot).digest('hex'));assert.ok(source.parts.every(p=>p.entity!=='node-game'));assert.equal(source.meshApproximation.sphere.widthSegments,12);
  const dir=mkdtempSync(join(tmpdir(),'holodeck-capacity-export-'));
  try{
   const site=join(dir,'site');const {mkdirSync}=await import('node:fs');mkdirSync(site);
   const input=join(dir,'scene.json'),capture=join(dir,'observation.json');writeFileSync(input,inputBytes);writeFileSync(capture,JSON.stringify(observation));writeFileSync(join(site,'snapshot.glb'),snapshot);
   const built=spawnSync('python3',[process.env.HOLODECK_REVIEW_BUILDER,'--scene',input,'--out',join(site,'index.html'),'--live','--defer-gallery','--bootstrap-gallery'],{encoding:'utf8',timeout:20000,maxBuffer:16384});assert.equal(built.status,0,built.stderr);
   const publisher=new URL('../tools/publish-review-draft.py',import.meta.url).pathname;
   const qualified=spawnSync('python3',['-c',`import json,runpy,sys\nfrom pathlib import Path\nm=runpy.run_path(sys.argv[1]);root=Path(sys.argv[2]);site=root/'site';scene=root/'scene.json';observation=json.loads((root/'observation.json').read_text());value=m['creation_source'](observation,json.loads(scene.read_text()),site/'snapshot.glb',m['digest'](scene));(site/'creation.json').write_text(json.dumps(value,separators=(',',':'),ensure_ascii=False));files=m['files_in'](site);total=m['stage_bytes'](root);assert total+16384<=m['STAGE_LIMIT'];assert len(value['entities'])==m['MAX_WORLD_ELEMENTS'];assert value['activity']['nodes']['node-game']['play']==observation['nodes']['node-game']['play'];assert len(files)==5;print(json.dumps({'preparedBytes':total,'siteBytes':sum(p.stat().st_size for p in files),'galleryBytes':(site/'gallery.json').stat().st_size,'creationBytes':(site/'creation.json').stat().st_size,'historyLimit':m['HISTORY_LIMIT']}))`,publisher,dir],{encoding:'utf8',timeout:10000,maxBuffer:16384});assert.equal(qualified.status,0,qualified.stderr);
   t.diagnostic(JSON.stringify({raised,entities:MAX_WORLD_ELEMENTS,snapshotBytes:snapshot.length,sceneBytes:Buffer.byteLength(inputBytes),parts:scene.parts.length,triangles:scene.parts.reduce((n,p)=>n+p.faces.length,0),...JSON.parse(qualified.stdout)}));
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
