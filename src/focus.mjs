import {WORKSHOP} from './workshop.mjs';
export const MAX_FOCUS=16;
export function focusState(focuses,entities){
 return [...focuses.values()].map(signal=>{
  const entity=entities[signal.target],currentRevision=entity?.revision??null;
  return {...signal,currentRevision,status:!entity||entity.deleted?'deleted':currentRevision===signal.revision?'current':'revised'};
 });
}
export function validFocusEntry([actor,value]){
 return value&&Object.keys(value).every(key=>['actor','kind','name','target','revision','sequence','time'].includes(key))&&typeof actor==='string'&&actor.length<=200&&value?.actor===actor&&['human','daimon'].includes(value.kind)
  &&typeof value.target==='string'&&(value.target==='bridge'||/^garden-[a-z0-9-]{1,40}$/.test(value.target))
  &&Number.isSafeInteger(value.revision)&&value.revision>=0&&Number.isSafeInteger(value.sequence)&&value.sequence>=1
  &&Number.isFinite(value.time)&&(value.name===null||typeof value.name==='string'&&value.name.length<=40);
}
export const entityLabel=id=>id==='bridge'?'el puente':'una luz';
export function focusAnchor(id,entity){
 return id==='bridge'?{...WORKSHOP.anchors['bridge-control'],y:2}: {x:entity.x,y:1.65,z:entity.z};
}
