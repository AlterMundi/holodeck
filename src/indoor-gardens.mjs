import {createHash} from 'node:crypto';
import {signalGardenProgress} from './playable-creations.mjs';
import {workshopColour} from './workshop.mjs';
import {indoorGardenTemplates,validIndoorGardenRecipe} from './indoor-garden-recipe.mjs';

export const INDOOR_GARDEN_BYTES=64*1024;
const SCHEMA='holodeck.indoor-gardens/v1';
const MAX_ROOMS=24;
const MAX_RECEIPTS=64;
const ACTOR=/^(?:dm:being:v1:[A-Za-z0-9_-]{43}|human:[A-Za-z0-9:_-]{1,130})$/;
const ID=/^[A-Za-z0-9_-]{8,80}$/;
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===fields;
const stamp=value=>Number.isSafeInteger(value)&&value>0;
const title=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=48&&!/[\u0000-\u001f\u007f]/.test(value);

const COLORS=new Set(['mint','amber','rose','violet'].map(workshopColour));
const validSignal=value=>value===null||exact(value,'actor,color,sequence')&&
  typeof value.actor==='string'&&ACTOR.test(value.actor)&&stamp(value.sequence)&&
  COLORS.has(value.color);
const safeId=value=>typeof value==='string'&&ID.test(value);

export function situatedGardenCommandId(interactionId,id){
  if(!safeId(interactionId)||!safeId(id))return null;
  return 'turn-'+createHash('sha256').update(JSON.stringify([interactionId,id])).digest('hex');
}

export class IndoorGardens {
  constructor({state,spaces,houses,legacyRooms,persist,authoredRooms=()=>spaces.rooms}){
    this.spaces=spaces;this.authoredRooms=authoredRooms;this.houses=houses;this.legacyRooms=legacyRooms;this.persist=persist;this.fenced=false;
    this.state=state??{schema:SCHEMA,gardens:[],receipts:[]};
    const {gardens,receipts}=this.state;
    if(!exact(this.state,'gardens,receipts,schema')||this.state.schema!==SCHEMA||
       !Array.isArray(gardens)||gardens.length>MAX_ROOMS||
       !gardens.every(value=>this.validGarden(value))||
       new Set(gardens.map(value=>value.room)).size!==gardens.length||
       !Array.isArray(receipts)||receipts.length>MAX_RECEIPTS||
       !receipts.every(value=>this.validReceipt(value,gardens))||
       new Set(receipts.map(value=>value.actor+':'+value.id)).size!==receipts.length)
      throw Error('Invalid indoor garden checkpoint');
  }

  owner(room,rooms=this.spaces.rooms){
    const cell=rooms.get(room);
    return cell&&!this.legacyRooms.has(room)?this.houses.directory().find(house=>house.id===cell.house)?.owner:null;
  }

  validGarden(value){
    return exact(value,'play,revision,room,sequence,signals,title')&&this.owner(value.room,this.authoredRooms())&&
      title(value.title)&&validIndoorGardenRecipe(value.play)&&stamp(value.revision)&&
      Number.isSafeInteger(value.sequence)&&value.sequence>=0&&Array.isArray(value.signals)&&
      value.signals.length===value.play.targets.length&&value.signals.every(signal=>validSignal(signal)&&
        (signal===null||signal.sequence<=value.sequence));
  }

  validReceipt(value,gardens){
    if(!exact(value,'actor,fingerprint,id,result')||!safeId(value.id)||typeof value.actor!=='string'||
       !ACTOR.test(value.actor)||typeof value.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(value.fingerprint)||
       !exact(value.result,'revision,room,sequence')||!stamp(value.result.revision)||
       !Number.isSafeInteger(value.result.sequence)||value.result.sequence<0)return false;
    return gardens.some(current=>current.room===value.result.room&&current.revision>=value.result.revision&&
      current.sequence>=value.result.sequence);
  }

  inRoom(actor,room){
    return !this.fenced&&actor?.rights?.includes('observe')&&this.spaces.current(actor)===room&&!!this.owner(room);
  }

  current(room){return this.state.gardens.find(garden=>garden.room===room)??null;}

  view(actor,room){
    if(!this.inRoom(actor,room))return null;
    return this.observe(actor,room);
  }

  observe(actor,room){
    if(this.fenced||!actor?.rights?.includes('observe')||!this.spaces.allows(actor,room)||!this.owner(room))return null;
    const current=this.current(room);
    if(!current)return null;
    const {play,revision,title,signals,sequence}=current;
    const entities={},editors={};
    signals.forEach((signal,index)=>{
      if(!signal)return;
      const id='garden-'+index,target=play.targets[index];
      entities[id]={color:signal.color,x:target.x,z:target.z,revision:signal.sequence};
      editors[id]={actorRef:signal.actor,revision:signal.sequence};
    });
    return {room,revision,sequence,title,targets:structuredClone(play.targets),
      signals:signals.map(signal=>signal?{color:signal.color}:null),
      progress:signalGardenProgress(play,{entities,editors,sequence}),
      canPlay:actor.rights.includes('edit')&&this.spaces.current(actor)===room};
  }

  result(actor,id){
    if(this.fenced||!actor?.rights?.includes('observe')||!safeId(id))return null;
    const receipt=this.state.receipts.find(entry=>entry.id===id&&entry.actor===actor.id);
    return receipt&&this.spaces.allows(actor,receipt.result.room)?structuredClone(receipt.result):null;
  }

  draft(actor,input){
    if(this.fenced||actor?.kind!=='daimon'||!actor.rights?.includes('observe')||
       !actor.rights.includes('edit')||this.owner(input.room)!==actor.id)return null;
    if(input.type==='garden.templates'&&exact(input,'room,type'))
      return {room:input.room,templates:indoorGardenTemplates()};
    if(input.type!=='garden.draft'||!exact(input,'id,room,template,type'))return null;
    const preset=indoorGardenTemplates().find(template=>template.id===input.template);
    if(!preset)return null;
    const command={type:'garden.put',id:input.id,room:input.room,expectedRevision:this.current(input.room)?.revision??null,
      title:preset.title,play:preset.play};
    return this.act(actor,command,{preview:true})?{command}:null;
  }

  act(actor,input,{preview=false,delegated=false}={}){
    if(this.fenced||!safeId(input?.id)||!actor?.rights?.includes('observe')||!actor.rights.includes('edit')||
       typeof actor.id!=='string'||!ACTOR.test(actor.id))return null;
    const author=input.type==='garden.put';
    const {room,id,expectedRevision}=input,current=this.current(room);
    const owner=this.owner(room);
    if(!owner||!this.spaces.allows(actor,room))return null;
    if(author){
      const nativeOwner=actor.kind==='daimon'&&actor.id===owner;
      const pairedEditor=actor.kind==='human'&&delegated&&this.inRoom(actor,room);
      if((!nativeOwner&&!pairedEditor)||!exact(input,'expectedRevision,id,play,room,title,type')||
         !title(input.title)||!validIndoorGardenRecipe(input.play))return null;
    }else if(preview||input.type!=='garden.signal'||!this.inRoom(actor,room)||
       !exact(input,'color,expectedRevision,id,index,room,type')||!current||
       !Number.isInteger(input.index)||input.index<0||input.index>=current.play.targets.length||
       !COLORS.has(workshopColour(input.color)))return null;
    const fingerprint=createHash('sha256').update(JSON.stringify(author?
      [room,expectedRevision,input.title,input.play]:
      [room,expectedRevision,input.index,workshopColour(input.color)])).digest('hex');
    const prior=this.state.receipts.find(entry=>entry.id===id&&entry.actor===actor.id);
    if(prior)return !preview&&prior.fingerprint===fingerprint?structuredClone(prior.result):null;
    if((current?.revision??null)!==expectedRevision)return null;
    const sequence=(current?.sequence??0)+1;
    const next=author?{room,title:input.title,revision:(current?.revision??0)+1,sequence,
      play:structuredClone(input.play),signals:input.play.targets.map(()=>null)}:
      {...current,sequence,signals:current.signals.map((old,index)=>index===input.index?
        {actor:actor.id,color:workshopColour(input.color),sequence}:old)};
    if(!this.validGarden(next))return null;
    if(preview)return next;
    const result={room,revision:next.revision,sequence};
    const checkpoint={schema:SCHEMA,gardens:[...this.state.gardens.filter(garden=>garden.room!==room),next],
      receipts:[...this.state.receipts.slice(1-MAX_RECEIPTS),{actor:actor.id,id,fingerprint,result}]};
    try{this.persist(checkpoint);}catch(error){if(error.commitUncertain)this.fenced=true;throw error;}
    this.state=checkpoint;
    return {...result};
  }
}
