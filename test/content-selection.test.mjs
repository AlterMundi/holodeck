import {JSDOM} from 'jsdom';
import {applyGallerySigns} from '../src/gallery-display.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ContentVisitor} from '../src/content-visitor.mjs';
const pin={kind:'artifact_review',tableId:'old-table',reviewId:'family',revision:'old-edition',adapter:'interactive_3d'};
const old={id:'node-published',node:'node-published',nodeRevision:2,pin};
function visitor(entries){
 const messages=[],frame={},value=Object.assign(Object.create(ContentVisitor.prototype),{
  entries,catalog:Promise.resolve(),frame,entry:old,visitId:'retained-visit',opening:false,
  window:{location:{origin:'https://world.test'}},selector:{disabled:false,value:old.id},say:text=>messages.push(text),
  reveal:()=>{throw Error('Do not reveal a different edition')},
 });return {value,messages,frame};
}
test('a selected runtime revision cannot silently reopen a newly revised node',async()=>{
 const {value,messages,frame}=visitor([{...old,nodeRevision:3}]);
 await value.openNode(old.node,{expectedRevision:2});
 assert.equal(value.frame,frame);assert.equal(value.entry,old);assert.equal(value.visitId,'retained-visit');assert.equal(messages.length,1);assert.match(messages[0],/Volvé a elegirlo/);
});
test('catalogue advancement while opening preserves the retained frame and rejects before any source read',async()=>{
 const entry={...old,id:'node-review',node:'node-review',descriptor:'/nexus/api/new-visit',entry:'/nexus/?table=new-table',pin:{...pin,tableId:'new-table',revision:'new-edition'}};
 const {value,messages,frame}=visitor([entry]);let resolve;value.catalog=new Promise(r=>{resolve=r});
 const opening=value.open(entry.id,{nodeRevision:2});value.entries=[{...entry,nodeRevision:3}];resolve();await opening;
 assert.equal(value.frame,frame);assert.equal(value.entry,old);assert.equal(value.opening,false);assert.equal(value.selector.disabled,false);assert.equal(value.selector.value,old.id);assert.match(messages[0],/Volvé a elegirlo/);
});
test('the selected runtime node requests its exact descriptor and denial preserves the prior content',async()=>{
 const entry={...old,id:'node-review',node:'node-review',nodeRevision:4,descriptor:'/nexus/api/new-visit',entry:'/nexus/?table=new-table',pin:{...pin,tableId:'new-table',revision:'new-edition'}};
 const {value,messages,frame}=visitor([old,entry]),previousFetch=globalThis.fetch,reads=[];
 globalThis.fetch=async(url,options)=>{reads.push({url:String(url),options});return{ok:false,status:403}};
 try{await value.openNode(entry.node,{expectedRevision:4});}finally{globalThis.fetch=previousFetch;}
 assert.equal(reads.length,1);assert.equal(reads[0].url,'https://world.test/nexus/api/new-visit');assert.equal(reads[0].options.credentials,'same-origin');assert.equal(value.frame,frame);assert.equal(value.entry,old);assert.equal(value.selector.value,old.id);assert.equal(messages.length,1);assert.match(messages[0],/necesita tu acceso/);
});
test('scoped model and plaque actions share the exact current edition and physical reach',()=>{
 const item={...old,id:'house-exhibit',galleryDisplay:true,position:{x:2,y:.1,z:0}};
 const {value}=visitor([item]);value.scoped=true;
 const model={},staleModel={},plaque={};
 const objects={targets:()=>[[model,item],[staleModel,{...item,pin:{...pin,revision:'expired'}}]]};
 const {window}=new JSDOM('<div id="scene"></div>');
 const scene=window.document.getElementById('scene');
 applyGallerySigns(scene,[item]);
 scene.querySelector('#house-exhibit-plaque').getContainer=()=>plaque;
 assert.deepEqual([...value.galleryTargets(objects,scene,{x:1,y:.1,z:0})],[[model,item],[plaque,item]]);
 assert.equal(value.galleryTargets(objects,scene,{x:-1,y:.1,z:0}).size,0);
 value.entries=[{...item,pin:{...item.pin,revision:'new-pin'}}];
 assert.equal(value.galleryTargets(objects,scene,{x:1,y:.1,z:0}).size,0);
 value.entries=[];
 assert.equal(value.galleryTargets(objects,scene,{x:1,y:.1,z:0}).size,0);
 window.close();
});
test('a gallery edition changed during authorization cannot open with a previous model pin',async()=>{
 const item={...old,id:'house-exhibit',galleryDisplay:true};
 const {value,messages,frame}=visitor([item]);value.scoped=true;
 value.loadCatalog=async()=>{value.entries=[{...item,pin:{...pin,revision:'other'}}];return true;};
 await value.openGallery(item);
 assert.equal(value.frame,frame);
 assert.equal(value.selector.disabled,false);
 assert.match(messages[0],/Volvé a elegirlo/);
});
