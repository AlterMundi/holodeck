// The world owns spatial entrances; Nexus owns media, notes and native review.
// Receiving configuration contains selected private content references, not this source.
export const CONTENT_NODE=Object.freeze({id:'reading-room',title:'Sala de presentaciones',position:{x:-22,y:.1,z:3}});
const slug=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value);
// Authored public entrances, not research documents or another mutable world.
// The receiving owner must select labels/assets suitable for every room reader.
export function validateContentNodes(nodes=[CONTENT_NODE]){
 if(!Array.isArray(nodes)||!nodes.length||nodes.length>8)throw Error('Select one to eight public content entrances');
 const ids=new Set();
 const selected=nodes.map(node=>{
  if(!node||Object.keys(node).some(key=>!['id','title','position','model'].includes(key))
   ||typeof node.id!=='string'||!(node.id===CONTENT_NODE.id||/^research-[a-z0-9-]{1,40}$/.test(node.id))||ids.has(node.id)
   ||typeof node.title!=='string'||!node.title.trim()||node.title.length>80||/[\u0000-\u001f\u007f]/.test(node.title)
   ||!node.position||Object.keys(node.position).sort().join(',')!=='x,y,z'
   ||!['x','y','z'].every(key=>Number.isFinite(node.position[key])&&Math.abs(node.position[key])<=30)
   ||(node.model!==undefined&&(typeof node.model!=='string'||!/^[-a-zA-Z0-9_]{1,80}\.glb$/.test(node.model))))throw Error('Invalid public content entrance');
  if(node.id===CONTENT_NODE.id&&(node.title!==CONTENT_NODE.title||node.model!==undefined
   ||!['x','y','z'].every(key=>node.position[key]===CONTENT_NODE.position[key])))throw Error('Preserve the existing reading-room entrance');
  ids.add(node.id);return Object.freeze({...node,position:Object.freeze({...node.position})});
 });
 if(!ids.has(CONTENT_NODE.id))throw Error('Keep the existing reading-room entrance');
 if(new TextEncoder().encode(JSON.stringify(selected)).length>2048)throw Error('Public entrance metadata exceeds its two-KiB situation budget');
 return Object.freeze(selected);
}
export function nearestContentNode(nodes,entries,position){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z)
  ||(position.y!==undefined&&!Number.isFinite(position.y)))return null;
 const allowed=new Set(entries.map(entry=>entry.node));let nearest=null,distance=5;
 for(const node of nodes){
  if(!allowed.has(node.id))continue;
  const next=Math.hypot(position.x-node.position.x,(position.y??node.position.y)-node.position.y,position.z-node.position.z);
  if(next<=distance&&(!nearest||next<distance)){nearest=node;distance=next;}
 }
 return nearest;
}
export function validateContentVisits(entries=[],nodes=[CONTENT_NODE]){
 if(!Array.isArray(entries)||entries.length>8)throw Error('Select at most eight existing content visits for this entrance');
 const ids=new Set(),nodeIds=new Set(validateContentNodes(nodes).map(node=>node.id));
 return entries.map(entry=>{
  if(!entry||Object.keys(entry).some(k=>!['id','node','entry','descriptor','pin','discoverActors'].includes(k))
   ||!slug(entry.id)||ids.has(entry.id)||!nodeIds.has(entry.node)
   ||!validVisitPin(entry.pin)
   ||!Array.isArray(entry.discoverActors)||!entry.discoverActors.length||entry.discoverActors.length>32
   ||!entry.discoverActors.every(a=>typeof a==='string'&&a.startsWith('human:')&&a.length<200))throw Error('Invalid selected content visit');
  for(const path of [entry.entry,entry.descriptor]){
   if(typeof path!=='string'||path.length>1200||!path.startsWith('/nexus/')||/[\\\u0000-\u0020]/.test(path))throw Error('Use an existing same-origin Nexus route');
   const parsed=new URL(path,'https://world.invalid');if(parsed.origin!=='https://world.invalid'||!parsed.pathname.startsWith('/nexus/')||parsed.hash)throw Error('Use an existing same-origin Nexus route');
  }
  if(!visitEntryMatches(entry.entry,entry.pin))throw Error('Pin the selected edition in its viewer entrance');
  ids.add(entry.id);return structuredClone(entry);
 });
}
export function visitsForActor(entries,actor){
 return entries.filter(entry=>entry.discoverActors.includes(actor.id)).map(({discoverActors,...entry})=>structuredClone(entry));
}
export const visitVersion=pin=>pin?.kind==='context'?3:pin?.kind==='artifact_review'?2:1;
export function validVisitPin(pin){
 if(!pin||typeof pin!=='object'||Array.isArray(pin))return false;
 const version=visitVersion(pin),keys=version===3?['kind','tableId','contextId','revision']:version===2?['kind','tableId','reviewId','revision','adapter']:['tableId','reportId','revision'];
 return Object.keys(pin).length===keys.length&&keys.every(k=>slug(pin[k]))
  &&(version!==2||['interactive_3d','video'].includes(pin.adapter));
}
export function sameVisitPin(a,b){return validVisitPin(a)&&validVisitPin(b)&&visitVersion(a)===visitVersion(b)&&Object.keys(a).every(k=>a[k]===b[k]);}
export function knownVisitState(value){return !!value&&['dirty','recording','processing','playing'].every(key=>typeof value[key]==='boolean');}
export function visitResponseMatches(event,{source,origin,id,visitId,pin}){
 const value=event.data;
 return event.source===source&&event.origin===origin&&value?.schema===`dm.holodeck-visit/response-v${visitVersion(pin)}`
  &&value.id===id&&value.visitId===visitId&&sameVisitPin(value.pin,pin);
}

// Pinned knowledge contexts stay at their owning Nexus. Room keeps one spatial
// entrance, never a copied evidence graph or a fabricated report identity.
export function visitEntryMatches(value,pin){
 if(!validVisitPin(pin)||typeof value!=='string'||value.length>1200||!value.startsWith('/nexus/')||/[\\\u0000-\u0020]/.test(value))return false;
 let url;try{url=new URL(value,'https://world.invalid');}catch{return false;}
 if(url.origin!=='https://world.invalid'||url.pathname!=='/nexus/'||url.hash||url.searchParams.getAll('table').length!==1||url.searchParams.get('table')!==pin.tableId)return false;
 const exactQuery=(key,expected)=>url.searchParams.getAll(key).length===1&&url.searchParams.get(key)===expected;
 if(visitVersion(pin)===1)return exactQuery('report_revision',pin.revision);
 if(visitVersion(pin)===3)return exactQuery('context_id',pin.contextId)&&exactQuery('context_version',pin.revision);
 return true;
}
export function visitRoutes(pin){
 if(!validVisitPin(pin))throw Error('Select an exact supported Nexus pin');
 const version=visitVersion(pin),query=new URLSearchParams({table:pin.tableId,entry:'web'}),part=encodeURIComponent;
 let branch,id;
 if(version===3){branch='contexts';id=pin.contextId;query.set('context_id',id);query.set('context_version',pin.revision);}
 else if(version===2){branch='artifact-review';id=pin.reviewId;}
 else{branch='reports';id=pin.reportId;query.set('report_revision',pin.revision);}
 return {entry:'/nexus/?'+query,descriptor:`/nexus/api/tables/${part(pin.tableId)}/${branch}/${part(id)}/${part(pin.revision)}/visit`};
}
export function contextVisitSnapshotMatches(context,pin){
 if(visitVersion(pin)!==3)return true;
 const ref=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value);
 return !!context&&context.context_status==='acknowledged-client-view'
  &&(context.pin===undefined||sameVisitPin(context.pin,pin))&&ref(context.visit_id)
  &&Number.isSafeInteger(context.view_revision)&&context.view_revision>=1
  &&ref(context.focus)&&(context.selection===null||context.selection&&Object.keys(context.selection).sort().join(',')==='kind,object_id'
    &&['node','relation'].includes(context.selection.kind)&&ref(context.selection.object_id))
  &&knownVisitState(context.state);
}
