import {createHash} from 'node:crypto';

export const DESIGN_SAVE_BYTES=32*1024;
const SCHEMA='holodeck.room-designs/v1';
const MAX_ROOMS=24;
const MAX_RECEIPTS=48;
const BEING=/^dm:being:v1:[A-Za-z0-9_-]{43}$/;
const COMMAND=/^[A-Za-z0-9_-]{8,80}$/;
const exact=(value, fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===fields;
const revision=value=>Number.isSafeInteger(value)&&value>0;
const textMatches=(value,pattern)=>typeof value==='string'&&pattern.test(value);

export class RoomDesigns {
  constructor({state,spaces,houses,legacyRooms,kits,persist}){
    this.spaces=spaces;
    this.houses=houses;
    this.legacyRooms=legacyRooms;
    this.kits=kits;
    this.persist=persist;
    this.fenced=false;
    this.state=state??{schema:SCHEMA,designs:[],receipts:[]};
    const {designs,receipts}=this.state;
    if(!exact(this.state,'designs,receipts,schema')||this.state.schema!==SCHEMA||
       !Array.isArray(designs)||designs.length>MAX_ROOMS||
       !designs.every(value=>this.validDesign(value))||
       new Set(designs.map(value=>value.room)).size!==designs.length||
       !Array.isArray(receipts)||receipts.length>MAX_RECEIPTS||
       !receipts.every(value=>exact(value,'fingerprint,id,result')&&textMatches(value.id,COMMAND)&&
         textMatches(value.fingerprint,/^[a-f0-9]{64}$/)&&this.validDesign(value.result)&&
         designs.some(current=>current.room===value.result.room&&current.revision>=value.result.revision))||
       new Set(receipts.map(value=>value.result.owner+':'+value.id)).size!==receipts.length)
      throw Error('Invalid room design checkpoint');
  }

  owner(room){
    const cell=this.spaces.rooms.get(room);
    if(!cell||this.legacyRooms.has(room))return null;
    return this.houses.directory().find(house=>house.id===cell.house)?.owner??null;
  }

  validDesign(value){
    return exact(value,'kit,owner,revision,room')&&textMatches(value.owner,BEING)&&
      typeof value.room==='string'&&this.owner(value.room)===value.owner&&
      this.kits.has(value.kit)&&revision(value.revision);
  }

  forRoom(room){
    return this.state.designs.find(value=>value.room===room)??null;
  }

  canEdit(actor){
    return !this.fenced&&actor.kind==='daimon'&&textMatches(actor.id,BEING)&&
      ['observe','edit'].every(right=>actor.rights?.includes(right));
  }

  inspect(actor,room){
    if(!this.canEdit(actor)||this.owner(room)!==actor.id)return null;
    const design=this.forRoom(room);
    const kits=[...this.kits.entries()].filter(([,kit])=>kit.publishable!==false)
      .map(([id,{title}])=>({id,title}));
    return structuredClone({design,kits});
  }

  result(actor,id){
    if(!this.canEdit(actor)||!textMatches(id,COMMAND))return null;
    const receipt=this.state.receipts.find(value=>value.result.owner===actor.id&&value.id===id);
    return structuredClone(receipt?.result??null);
  }

  put(actor,input,preview=false){
    if(!this.canEdit(actor)||!exact(input,'expectedRevision,id,kit,room,type')||
        !textMatches(input.id,COMMAND)||input.type!=='design.put'||
        !this.kits.has(input.kit)||this.owner(input.room)!==actor.id||
        !(input.expectedRevision===null||revision(input.expectedRevision)))return null;
    const fingerprint=createHash('sha256').update(JSON.stringify([input.room,input.kit,input.expectedRevision])).digest('hex');
    const prior=this.state.receipts.find(value=>value.result.owner===actor.id&&value.id===input.id);
    if(prior)return !preview&&prior.fingerprint===fingerprint?structuredClone(prior.result):null;
    if(this.kits.get(input.kit).publishable===false)return null;
    const current=this.forRoom(input.room);
    if((current?.revision??null)!==input.expectedRevision||current?.kit===input.kit)return null;
    const result={room:input.room,kit:input.kit,owner:actor.id,revision:(current?.revision??0)+1};
    if(!this.validDesign(result))return null;
    if(!preview){
      const next={schema:SCHEMA,designs:[...this.state.designs.filter(value=>value.room!==result.room),result],
        receipts:[...this.state.receipts.slice(1-MAX_RECEIPTS),{id:input.id,fingerprint,result}]};
      try{this.persist(next);}catch(error){if(error.commitUncertain)this.fenced=true;throw error;}
      this.state=next;
    }
    return structuredClone(result);
  }
}
