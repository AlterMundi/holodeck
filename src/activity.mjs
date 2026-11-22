// Read-only public projection of the existing Room event ring. Never serialize
// arbitrary event.detail: the journal also contains private native references.
import {LIMITS} from './room.mjs';
import {validNodeRepresentation} from './node-representations.mjs';
export const ACTIVITY_LIMIT=20,ACTIVITY_BYTES=32768;
const TYPES=new Set(['garden.place','garden.update','garden.remove','bridge.set','node.place','node.update','node.remove','focus.set','focus.clear','projection.changed','participant.joined','participant.left']);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const number=value=>Number.isFinite(value)&&Math.abs(value)<=1e9;
const targetId=value=>typeof value==='string'&&(value==='bridge'||/^(garden|node)-[a-z0-9-]{1,40}$/.test(value));
const reference=value=>typeof value==='string'&&value.length>0&&value.length<=200?value:null;
const position=value=>value&&number(value.x)&&number(value.z)?{x:value.x,z:value.z}:null;
const colour=value=>typeof value==='string'&&/^(?:mint|amber|rose|violet|#[0-9a-fA-F]{6})$/.test(value)?value:null;
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
export class ActivityError extends Error{
 constructor(code,status,message){super(message);Object.assign(this,{code,status});}
}
function scalar(query,key,{minimum=0,maximum=Number.MAX_SAFE_INTEGER,fallback}={}){
 if(query[key]===undefined)return fallback;
 if(typeof query[key]!=='string'||!/^(0|[1-9][0-9]*)$/.test(query[key]))throw new ActivityError('query',400,'La página de actividad no es válida. Volvé a abrirla.');
 const value=Number(query[key]);
 if(!Number.isSafeInteger(value)||value<minimum||value>maximum)throw new ActivityError('query',400,'La página de actividad no es válida. Volvé a abrirla.');
 return value;
}
function playState(value){
 if(value?.schema!=='signal-garden/v1'||!Array.isArray(value.targets)||value.targets.length<1||value.targets.length>4
  ||!integer(value.minContributors)||value.minContributors<1||value.minContributors>8)return null;
 const targets=[];
 for(const target of value.targets){
  const at=position(target),color=colour(target?.color);
  if(!at||!color||!number(target.radius)||target.radius<.4||target.radius>1.5)return null;
  targets.push({...at,radius:target.radius,color});
 }
 return{schema:'signal-garden/v1',targets,minContributors:value.minContributors,requiredBridgeRaised:value.requiredBridgeRaised===true};
}
function objectState(id,value){
 if(!value||!integer(value.revision)||(value.id!==undefined&&value.id!==id))return null;
 if(id==='bridge')return typeof value.raised==='boolean'?{kind:'bridge',id,revision:value.revision,raised:value.raised}:null;
 if(id.startsWith('garden-')){
  const at=position(value),color=colour(value.color);
  return at&&color?{kind:'light',id,revision:value.revision,...at,color,deleted:value.deleted===true}:null;
 }
 if(!id.startsWith('node-')||typeof value.title!=='string'||value.title.length>40||/[\u0000-\u001f]/.test(value.title)
  ||!['portal','pedestal'].includes(value.shape)||!position(value.position))return null;
 const play=playState(value.play),links=[];
 if((value.play!==undefined&&!play)||!Array.isArray(value.links)||value.links.length>4)return null;
 for(const link of value.links){
  if(!targetId(link?.id)||!link.id.startsWith('node-')||!integer(link.revision))return null;
  links.push({id:link.id,revision:link.revision});
 }
 return{kind:'node',id,revision:value.revision,deleted:value.deleted===true,title:value.title,shape:value.shape,position:position(value.position),
  ...(validNodeRepresentation(value.representation)?{representation:value.representation}:{}),content:play?'game':value.result?'result':null,play,links};
}
function projectionState(value){
 if(!value||!['orb','beacon','avatar'].includes(value.form)||!position(value.position)||!number(value.position.y))return null;
 return{kind:'projection',position:{...position(value.position),y:value.position.y},form:value.form};
}
function comparison(state,recorded,revision=null,actionable=false){
 const status=!state?'unavailable':state.deleted?'deleted':revision!==null&&state.revision!==undefined
  ?state.revision===revision?'current':'revised':recorded?JSON.stringify(recorded)===JSON.stringify(state)?'current':'revised':'unavailable';
 return{revision:state?.revision??null,state,status,actionable:actionable&&!!state&&!state.deleted};
}
function projectEvent(event,room,actor,presence){
 const type=TYPES.has(event.type)?event.type:'unavailable',detail=event.detail;
 const author={ref:reference(event.actor),name:null,nameSource:null,isSelf:typeof event.actor==='string'&&event.actor===actor.id};
 let target=null,eventRevision=null,recorded=null,current=comparison(null,null);
 if(type.startsWith('garden.')||type==='bridge.set'||type.startsWith('node.')){
  const id=detail?.target;
  if(targetId(id)&&((type==='bridge.set'&&id==='bridge')||(type.startsWith('garden.')&&id.startsWith('garden-'))||(type.startsWith('node.')&&id.startsWith('node-')))){
   target=id;recorded=objectState(id,type.startsWith('node.')?detail.node:detail.entity);eventRevision=recorded?.revision??null;
   current=comparison(objectState(id,room.entities[id]??room.nodes[id]),recorded,eventRevision,true);
  }
 }else if(type==='focus.set'||type==='focus.clear'){
  if(targetId(detail?.target)&&integer(detail.revision)){
   target=detail.target;eventRevision=detail.revision;
   recorded={kind:'focus',target,revision:eventRevision,active:type==='focus.set'};
   current=comparison(objectState(target,room.entities[target]??room.nodes[target]),null,eventRevision,true);
  }
 }else if(type==='projection.changed'){
  recorded=projectionState(detail);current=comparison(projectionState(room.projections.get(event.actor)),recorded);
 }else if(type==='participant.joined'||type==='participant.left'){
  recorded={kind:'presence',present:type==='participant.joined'};
  current=comparison({kind:'presence',present:presence.has(event.actor)},recorded);
 }
 return{sequence:event.sequence,time:Number.isFinite(event.time)&&event.time>=0?event.time:null,type,author,target,eventRevision,
  detailStatus:recorded?'available':'unavailable',recorded,current};
}

export function readActivity(room,actor,query={}){
 if(!actor?.rights?.includes('observe'))throw new ActivityError('forbidden',403,'No tenés acceso a la actividad de este mundo.');
 if(room.commitUncertain)throw new ActivityError('recovery-required',503,'El taller necesita recuperar su último cambio antes de mostrar la actividad.');
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(key=>!['run','through','before','limit'].includes(key)))
  throw new ActivityError('query',400,'La página de actividad no es válida. Volvé a abrirla.');
 if(query.run!==undefined&&(typeof query.run!=='string'||!query.run.length||query.run.length>200))throw new ActivityError('query',400,'La página de actividad no es válida. Volvé a abrirla.');
 if(query.run!==undefined&&query.run!==room.run)throw new ActivityError('stale-run',409,'El mundo cambió. Abrí su actividad actual.');
 const paged=query.before!==undefined||query.through!==undefined;
 if(paged&&(query.before===undefined||query.through===undefined||query.run===undefined))throw new ActivityError('query',400,'Conservá la referencia de esta página o volvé a abrir la actividad.');
 const limit=scalar(query,'limit',{minimum:1,maximum:ACTIVITY_LIMIT,fallback:ACTIVITY_LIMIT});
 const through=scalar(query,'through',{maximum:room.sequence,fallback:room.sequence});
 const before=scalar(query,'before',{minimum:1,maximum:through===Number.MAX_SAFE_INTEGER?through:through+1,fallback:null});
 const events=room.events.filter(event=>integer(event.sequence)&&event.sequence>0),first=events[0]?.sequence??null,last=events.at(-1)?.sequence??null;
 const earlierUnavailable=first!==null?first>1:room.sequence>0;
 const selected=events.filter(event=>event.sequence<=through&&(before===null||event.sequence<before)).reverse();
 const presence=new Set(room.presence().map(value=>value.actor));
 const retention={limit:LIMITS.events,count:events.length,firstSequence:first,lastSequence:last,earlierUnavailable};
 const page={schema:'holodeck.activity/v1',observer:actor.id,run:room.run,edition:room.edition,through,currentThrough:room.sequence,capturedAt:room.clock(),items:[],nextBefore:null,retention,
  gaps:{earlierUnavailable,cursorEvicted:paged&&earlierUnavailable&&first!==null&&(through<first||before<=first),missingSequences:(last!==null&&last!==room.sequence)||(last===null&&room.sequence>0)||events.some((event,index)=>index>0&&event.sequence!==events[index-1].sequence+1)},byteLimited:false};
 // Construct only allowlisted records. The final response budget includes every
 // envelope field and cursor, not just an item-size estimate.
 for(const event of selected.slice(0,limit)){
  const item=projectEvent(event,room,actor,presence);page.items.push(item);
  page.nextBefore=selected.length>page.items.length?item.sequence:null;
  if(bytes(page)>ACTIVITY_BYTES){page.items.pop();page.byteLimited=true;break;}
 }
 page.nextBefore=selected.length>page.items.length&&page.items.length?page.items.at(-1).sequence:null;
 if(bytes(page)>ACTIVITY_BYTES)throw new ActivityError('capacity',503,'No pude preparar una página acotada de actividad.');
 return page;
}

// Native JSON carries typed numbers; HTTP query strings remain strict strings.
export function nativeActivityQuery(args){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['run','through','before','limit'].includes(key)))
  throw new ActivityError('query',400,'La página de actividad no es válida.');
 const query={};
 for(const[key,value]of Object.entries(args)){
  if(key!=='run'&&typeof value==='number'){
   if(!Number.isSafeInteger(value))throw new ActivityError('query',400,'La página de actividad no es válida.');
   query[key]=String(value);
  }else if(typeof value==='string')query[key]=value;
  else throw new ActivityError('query',400,'La página de actividad no es válida.');
 }
 return query;
}

export const SELECTED_ACTIVITY_BYTES=2048;
export function resolveHistoryReference(room,actor,value){
 if(!actor?.rights?.includes('observe'))throw new ActivityError('forbidden',403,'No tenés acceso a la actividad de este mundo.');
 const selected={schema:'holodeck.selected-activity/v1',status:'invalid',reference:null,source:'canonical-room-journal',
  selectionEvidence:'client-reported reference; not attention or event authorship',event:null,omissions:{}};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='edition,explicit,panelVisible,run,schema,sequence'
  ||value.schema!=='holodeck.history-reference/v1'||typeof value.run!=='string'||!value.run.length||value.run.length>200
  ||typeof value.edition!=='string'||!value.edition.length||value.edition.length>200||!integer(value.sequence)||value.sequence<1
  ||typeof value.panelVisible!=='boolean'||typeof value.explicit!=='boolean'||(!value.panelVisible&&!value.explicit)
  ||bytes(value)>512)return selected;
 selected.reference={schema:value.schema,run:value.run,edition:value.edition,sequence:value.sequence,panelVisible:value.panelVisible,explicit:value.explicit};
 if(value.run!==room.run||value.edition!==room.edition){selected.status='different-run';return selected;}
 const event=room.events.find(event=>event.sequence===value.sequence);
 if(!event){selected.status='unavailable';return selected;}
 const projected=projectEvent(event,room,actor,new Set());
 const {current,...record}=projected;selected.status='retained';selected.event=record;
 if(bytes(selected)>SELECTED_ACTIVITY_BYTES&&record.recorded?.play){delete record.recorded.play;selected.omissions.recipe=true;}
 if(bytes(selected)>SELECTED_ACTIVITY_BYTES&&record.recorded?.links){delete record.recorded.links;selected.omissions.links=true;}
 if(bytes(selected)>SELECTED_ACTIVITY_BYTES){record.recorded=null;record.detailStatus='omitted';selected.omissions.recordedDetail=true;}
 if(bytes(selected)>SELECTED_ACTIVITY_BYTES){
  // A malformed legacy identity/edition may exceed even the essential envelope.
  // Keep the exact bounded reference and uncertainty; never block an original.
  selected.status='unavailable';selected.event=null;selected.omissions.recordedDetail=true;
 }
 return selected;
}
