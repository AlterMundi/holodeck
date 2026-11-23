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

  put(actor,input,nodes){
    if(this.fenced||!exact(input,'expectedRevision,id,room,source,sourceRevision,type')||input.type!=='exhibit.put'||
        !commandId(input.id)||!roomId(input.room)||!contentNodeId(input.source)||!revision(input.sourceRevision)||
        !(input.expectedRevision===null||revision(input.expectedRevision))||
        !this.owns(actor,input.room)||this.spaces.current(actor)!==input.room)return null;
    const fingerprint=digest([actor.id,input.room,input.source,input.sourceRevision,input.expectedRevision]);
    const prior=this.state.receipts.find(entry=>entry.id===input.id);
    if(prior)return prior.fingerprint===fingerprint?structuredClone(prior.result):null;
    const current=this.scoped(actor,input.room);
    if((current?.revision??null)!==input.expectedRevision||(!current&&this.state.exhibits.length>=maxExhibits))return null;
    const source=nodes[input.source],pin=source?.result?.pin;
    if(!source||source.deleted||source.owner!==actor.id||source.revision!==input.sourceRevision||!validVisitPin(pin))return null;
    const result={owner:actor.id,room:input.room,source:source.id,sourceRevision:source.revision,
      revision:(current?.revision??0)+1,pin:structuredClone(pin)};
    if(!validExhibit(result))return null;
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
