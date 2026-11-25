import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {Room} from '../src/room.mjs';import {worldDocument} from '../src/world.mjs';
import {AVATARS,COMPAII_BEING,avatarForActor} from '../src/avatar-registry.mjs';
import {avatarMarkers} from '../src/native-avatar.mjs';
const actor={id:COMPAII_BEING,ref:COMPAII_BEING,kind:'daimon',rights:['observe','project']};
test('only the registered native being selects its pinned appearance; old projections remain valid',()=>{
 const room=new Room();const position={x:1,y:.1,z:-16};
 room.project(actor,{position,form:'avatar'});
 assert.equal(room.projections.get(actor.id).appearance,'compaii-navegante-white-v1');
 const recovered=new Room({state:room.snapshot()});assert.deepEqual(recovered.projections.get(actor.id),room.projections.get(actor.id));
 assert.match(worldDocument(recovered),/data-holodeck-avatar="compaii-navegante-white-v1"/);
 assert.match(worldDocument(room),/data-holodeck-avatar="compaii-navegante-white-v1"/);
 for(const other of [{...actor,id:'other-being',ref:'other-being'},{...actor,kind:'human'},{...actor,ref:'forged'}]){
  assert.equal(avatarForActor(other),null);assert.throws(()=>room.project(other,{position,form:'avatar'}),/selected appearance/);
 }
 room.project({...actor,id:'other-being'},{position,form:'beacon'});
 assert.equal(room.projections.get('other-being').form,'beacon');
 room.project(actor,{position,form:'orb'});assert.doesNotMatch(worldDocument(room),/data-holodeck-avatar/);
});
test('public appearance is exact canonical data with bounded inert renderer closure, no account document',()=>{
 const p=JSON.parse(readFileSync(new URL('../public/assets/avatar/PROVENANCE.json',import.meta.url)));
 const entry=AVATARS['compaii-navegante-white-v1'];
 const bytes=readFileSync(new URL('../public/'+entry.design,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.ok(bytes.length<=entry.maxBytes);
 const design=JSON.parse(bytes);assert.equal(design.schema,'ascii-quest-design/v2');assert.equal(design.avatarModel.schema,'ascii-avatar-model/v2');
 assert.equal(design.avatarModel.nodes.length,45);assert.ok(!('versions' in design)&&!('human' in design));
 const renderer=readFileSync(new URL('../public/'+entry.renderer,import.meta.url));
 assert.equal(createHash('sha256').update(renderer).digest('hex'),p.rendererSha256);assert.ok(renderer.length<1024*1024);
 assert.equal(p.sourceInventory.length,24);
});
test('client marker admission requires an exact registered being and bounds instance count',()=>{
 const marker=(ref,being)=>({getAttribute:key=>key==='data-holodeck-avatar'?ref:being});
 const good=marker('compaii-navegante-white-v1',COMPAII_BEING);
 assert.equal(avatarMarkers({querySelectorAll:()=>[marker('https://foreign/avatar','foreign'),marker('compaii-navegante-white-v1','foreign'),good]}).length,1);
 assert.equal(avatarMarkers({querySelectorAll:()=>Array(20).fill(good)}).length,8);
});

test('the Blender companion keeps all authored clips and a free playback jaw',()=>{
 const entry=AVATARS['compaii-navegante-white-v1'];
 const design=JSON.parse(readFileSync(new URL('../public/'+entry.design,import.meta.url)));
 const glb=readFileSync(new URL('../public/'+entry.model,import.meta.url));
 assert.equal(createHash('sha256').update(glb).digest('hex'),entry.modelSha256);
 assert.equal(glb.toString('ascii',0,4),'glTF');
 const contents=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
 const jaw=contents.nodes.findIndex(node=>node.name==='anchor-mouth');
 assert.equal(contents.skins.length,1);
 assert.ok(contents.skins[0].joints.includes(jaw));
 assert.ok(contents.nodes.some(node=>node.skin===0));
 assert.deepEqual(contents.animations.map(animation=>animation.name),[...Object.keys(design.avatarModel.animations),'walk','hover','glide','lift','landing']);
 for(const {name,channels,samplers} of contents.animations){
  assert.ok(channels.length>0);
  assert.ok(channels.every(channel=>channel.target.node!==jaw));
  assert.ok(channels.every(channel=>contents.skins[0].joints.includes(channel.target.node)));
  assert.ok(samplers.every(({input})=>contents.accessors[input].min[0]===0));
  if(['walk','hover','glide','lift','landing'].includes(name))for(const leg of ['leg-left','leg-right','shin-left','shin-right']){
   assert.ok(channels.some(({target})=>contents.nodes[target.node].name===leg&&target.path==='rotation'));
  }
 }
});
