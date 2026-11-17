// One browser-session frozen intent per domain. These are recovery copies, not
// canonical native history. Never store authentication or capability material.
export const INTENT_LIMIT=16384;
const bytes=value=>new TextEncoder().encode(value).length;
export function saveIntent(storage,key,value,limit=INTENT_LIMIT){
  const text=JSON.stringify(value);
  if(bytes(text)>limit)throw Error('Intent exceeds local recovery bound');
  storage.setItem(key,text);
  return JSON.parse(text); // The retry owns the exact frozen copy, not live UI data.
}
export function loadIntent(storage,key,limit=INTENT_LIMIT){
  const text=storage.getItem(key);
  if(!text||bytes(text)>limit)return null;
  return JSON.parse(text);
}
export function archiveIntent(storage,key,value){
  const old=loadIntent(storage,key,131072)||[];
  if(!Array.isArray(old)||old.length>=8)throw Error('Recovery archive is full');
  const next=[...old,{...value,trackingClosed:true,closedAt:Date.now()}];
  saveIntent(storage,key,next,131072);
}
export function sameActor(record,actorRef){
  return !!record?.actorRef&&!!actorRef&&record.actorRef===actorRef;
}
export function nativeRetryRoute(record,classification){
  if(classification==='not-retained'&&record?.body)return 'interactions';
  return `interactions/${record.id}/retry`;
}
