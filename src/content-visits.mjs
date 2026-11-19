// The world owns spatial entrances; Nexus owns media, notes and native review.
// Receiving configuration contains selected private content references, not this source.
export const CONTENT_NODE=Object.freeze({id:'reading-room',title:'Sala de presentaciones',position:{x:-3,y:.1,z:3}});
const slug=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value);
export function validateContentVisits(entries=[]){
 if(!Array.isArray(entries)||entries.length>1)throw Error('Select one existing content visit for this entrance');
 const ids=new Set();
 return entries.map(entry=>{
  if(!entry||Object.keys(entry).some(k=>!['id','node','entry','descriptor','pin','discoverActors'].includes(k))
   ||!slug(entry.id)||ids.has(entry.id)||entry.node!==CONTENT_NODE.id
   ||!entry.pin||Object.keys(entry.pin).some(k=>!['tableId','reportId','revision'].includes(k))
   ||!Object.values(entry.pin).every(slug)||!['tableId','reportId','revision'].every(k=>slug(entry.pin[k]))
   ||!Array.isArray(entry.discoverActors)||!entry.discoverActors.length||entry.discoverActors.length>32
   ||!entry.discoverActors.every(a=>typeof a==='string'&&a.startsWith('human:')&&a.length<200))throw Error('Invalid selected content visit');
  for(const path of [entry.entry,entry.descriptor]){
   if(typeof path!=='string'||path.length>1200||!path.startsWith('/nexus/')||/[\\\u0000-\u0020]/.test(path))throw Error('Use an existing same-origin Nexus route');
   const parsed=new URL(path,'https://world.invalid');if(parsed.origin!=='https://world.invalid'||!parsed.pathname.startsWith('/nexus/')||parsed.hash)throw Error('Use an existing same-origin Nexus route');
  }
  const entrance=new URL(entry.entry,'https://world.invalid');
  if(entrance.searchParams.get('table')!==entry.pin.tableId||entrance.searchParams.get('report_revision')!==entry.pin.revision)throw Error('Pin the selected report edition in its viewer entrance');
  ids.add(entry.id);return structuredClone(entry);
 });
}
export function visitsForActor(entries,actor){
 return entries.filter(entry=>entry.discoverActors.includes(actor.id)).map(({discoverActors,...entry})=>structuredClone(entry));
}
export function sameVisitPin(a,b){return !!a&&!!b&&['tableId','reportId','revision'].every(k=>a[k]===b[k]);}
export function knownVisitState(value){return !!value&&['dirty','recording','processing','playing'].every(key=>typeof value[key]==='boolean');}
export function visitResponseMatches(event,{source,origin,id,visitId,pin}){
 const value=event.data;
 return event.source===source&&event.origin===origin&&value?.schema==='dm.holodeck-visit/response-v1'
  &&value.id===id&&value.visitId===visitId&&sameVisitPin(value.pin,pin);
}
