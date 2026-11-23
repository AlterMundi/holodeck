import {interiorArt} from './interior-art.mjs';
import {createHash} from 'node:crypto';
import {contentNodeId} from './content-nodes.mjs';
import {validVisitPin,visitRoutes} from './content-visits.mjs';

export const EXHIBIT_SAVE_BYTES=64*1024;
const schema='holodeck.exhibits/v1', maxReceipts=48, maxExhibits=24;
const commandId=value=>typeof value==='string'&&/^[a-z0-9-]{8,80}$/i.test(value);
const roomId=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(value);
const authorId=value=>typeof value==='string'&&/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>0;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===fields;

const validExhibit=exhibit=>exact(exhibit,'owner,pin,revision,room,source,sourceRevision')&&
  authorId(exhibit.owner)&&roomId(exhibit.room)&&validVisitPin(exhibit.pin)&&revision(exhibit.revision)&&
  contentNodeId(exhibit.source)&&revision(exhibit.sourceRevision);
const validReceipt=receipt=>exact(receipt,'fingerprint,id,result')&&commandId(receipt.id)&&
  /^[0-9a-f]{64}$/.test(receipt.fingerprint)&&validExhibit(receipt.result);

export const EXHIBIT_POSITION=Object.freeze({x:2.5,y:.1,z:1.25});
export const EXHIBIT_LABEL='Exposición';

export class RoomExhibits {
  constructor({state,spaces,houses,persist,artForRoom=interiorArt}){
    this.spaces=spaces;this.houses=houses;this.persist=persist;this.artForRoom=artForRoom;
    this.state=state??{schema,exhibits:[],receipts:[]};
    const {exhibits,receipts}=this.state;
    if(!exact(this.state,'exhibits,receipts,schema')||this.state.schema!==schema||
       !Array.isArray(exhibits)||exhibits.length>maxExhibits||!exhibits.every(validExhibit)||
       new Set(exhibits.map(exhibit=>exhibit.room)).size!==exhibits.length||
       !Array.isArray(receipts)||receipts.length>maxReceipts||!receipts.every(validReceipt)||
       new Set(receipts.map(receipt=>receipt.id)).size!==receipts.length)throw Error('Invalid exhibit checkpoint');
  }

  owns(actor, room){
    const selected=this.spaces.rooms.get(room);
    return !!selected&&actor?.kind==='daimon'&&actor.rights?.includes('edit')&&
      this.houses.directory().some(house=>house.id===selected.house&&house.owner===actor.id);
  }

  scoped(actor, room){
    if(this.spaces.current(actor)!==room)return null;
    return this.forRoom(room);
  }

  forRoom(room){
    return this.fenced?null:this.state.exhibits.find(exhibit=>exhibit.room===room)??null;
  }

  result(actor,id){
    if(this.fenced||!commandId(id))return null;
    const receipt=this.state.receipts.find(entry=>entry.id===id);
    return receipt?.result.owner===actor.id ? structuredClone(receipt.result) : null;
  }

  inspect(actor,room){
    if(this.fenced||!this.owns(actor,room)||this.spaces.current(actor)!==room)return null;
    return {room,exhibit:structuredClone(this.forRoom(room)),position:EXHIBIT_POSITION};
  }

  async put(actor,input,nodes,{preview=false,authorizeReview=null,canWrite=()=>true}={}){
    const directlyPinned=exact(input,'expectedRevision,id,pin,room,type');
    if(input?.type!=='exhibit.put'||!commandId(input.id)||!roomId(input.room)||
        !(input.expectedRevision===null||revision(input.expectedRevision)))return null;

    let source,sourceRevision,pin;
    if(directlyPinned){
      pin=input.pin;
      if(!validVisitPin(pin)||pin.kind!=='artifact_review'||pin.adapter!=='interactive_3d')return null;
      // Receivers predating direct placement require the v1 reference shape.
      // Only the pin is dereferenced. This stable reference creates no node.
      source='node-nexus-'+digest([pin.tableId,pin.reviewId,pin.revision,pin.adapter]).slice(0,34);
      sourceRevision=1;
    }else{
      if(!exact(input,'expectedRevision,id,room,source,sourceRevision,type')||
          !contentNodeId(input.source)||!revision(input.sourceRevision))return null;
      ({source,sourceRevision}=input);
    }
    const fingerprint=digest(directlyPinned?
      [actor.id,input.room,'review',pin.tableId,pin.reviewId,pin.revision,pin.adapter,input.expectedRevision]:
      [actor.id,input.room,source,sourceRevision,input.expectedRevision]);
    const inRoom=()=>!this.fenced&&this.owns(actor,input.room)&&this.spaces.current(actor)===input.room;
    const priorReceipt=()=>this.state.receipts.find(entry=>entry.id===input.id);
    const matchesRevision=current=>(current?.revision??null)===input.expectedRevision&&
      (current||this.state.exhibits.length<maxExhibits);
    if(!inRoom()||!canWrite())return null;
    const prior=priorReceipt();
    if(prior)return !preview&&prior.fingerprint===fingerprint?structuredClone(prior.result):null;
    if(!matchesRevision(this.forRoom(input.room)))return null;
    if(directlyPinned){
      if(await authorizeReview?.(actor,pin)!==true||!inRoom()||!canWrite())return null;
      const saved=priorReceipt();
      if(saved)return !preview&&saved.fingerprint===fingerprint?structuredClone(saved.result):null;
    }else{
      const node=nodes[source];
      pin=node?.result?.pin;
      if(!node||node.deleted||node.owner!==actor.id||node.revision!==sourceRevision||!validVisitPin(pin))return null;
    }
    const current=this.forRoom(input.room);
    if(!matchesRevision(current))return null;
    const result={owner:actor.id,room:input.room,source,sourceRevision,
      revision:(current?.revision??0)+1,pin:structuredClone(pin)};
    if(!validExhibit(result))return null;
    if(preview)return result;
    const next={schema,exhibits:[...this.state.exhibits.filter(exhibit=>exhibit.room!==input.room),result],
      receipts:[...this.state.receipts.slice(-(maxReceipts-1)),{id:input.id,fingerprint,result}]};
    try{this.persist?.(next);}catch(error){if(error.commitUncertain)this.fenced=true;throw error;}
    this.state=next;
    return structuredClone(result);
  }

  visit(actor,room){
    if(this.spaces.current(actor)!==room)return [];
    const station=this.artForRoom(this.spaces.rooms.get(room))?.station;
    const exhibit=this.forRoom(room);
    const localStation=station?{
      id:station.id,node:station.id,title:station.title,position:station.position,
      nodeRevision:station.revision,pin:structuredClone(station.pin),...visitRoutes(station.pin),
    }:null;
    const authoredExhibit=exhibit?{
      id:'house-exhibit',node:'house-exhibit',title:EXHIBIT_LABEL,position:EXHIBIT_POSITION,
      nodeRevision:exhibit.revision,pin:structuredClone(exhibit.pin),...visitRoutes(exhibit.pin),
    }:null;
    return [localStation,authoredExhibit].filter(Boolean);
  }
}
