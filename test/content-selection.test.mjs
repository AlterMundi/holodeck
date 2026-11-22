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
