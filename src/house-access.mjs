// An owner-selected house audience. Room audiences can only narrow it.
import {validRoomGuests} from './interior-spaces.mjs';

const schema='holodeck.house-access/v1';
const houseId=/^house-[a-f0-9]{64}$/;
const roomId=/^[a-z][a-z0-9-]{0,47}$/;
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===fields;
const validOverrides=rooms=>Array.isArray(rooms)&&rooms.length<=24&&
  rooms.every(room=>exact(room,'guests,id')&&typeof room.id==='string'&&roomId.test(room.id)&&validRoomGuests(room.guests))&&
  new Set(rooms.map(room=>room.id)).size===rooms.length;

const listed=(guests,actor)=>guests[0]==='*'||guests.includes(actor.id);

export class HouseAccess {
  constructor({state,houses,rooms,persist}){
    this.state=state??{schema,entries:[]};
    const {entries}=this.state;
    if(!exact(this.state,'entries,schema')||this.state.schema!==schema||!Array.isArray(entries)||entries.length>8||
      !entries.every(entry=>exact(entry,'guests,house,revision,rooms')&&typeof entry.house==='string'&&
        houseId.test(entry.house)&&Number.isSafeInteger(entry.revision)&&entry.revision>0&&
        validRoomGuests(entry.guests)&&validOverrides(entry.rooms))||
      new Set(entries.map(entry=>entry.house)).size!==entries.length)
      throw Error('Invalid house access checkpoint');
    this.houses=houses;
    this.rooms=rooms;
    this.persist=persist;
  }

  entry(house){
    return this.state.entries.find(entry=>entry.house===house);
  }

  guestAllowed(actor,room){
    const entry=this.entry(room.house);
    if(!entry)return null;
    const override=entry.rooms.find(candidate=>candidate.id===room.id);
    return listed(entry.guests,actor)&&(!override||listed(override.guests,actor));
  }

  current(actor,house){
    if(!this.houses.canManage(actor,house))return null;
    const entry=this.entry(house);
    if(entry)return structuredClone(entry);
    const rooms=[...this.rooms().values()].filter(room=>room.house===house);
    const foyer=rooms.find(room=>room.entry);
    const guests=foyer?.guests??[];
    return structuredClone({house,revision:null,guests,rooms:rooms.filter(room=>!room.entry&&
      (room.guests.length!==guests.length||room.guests.some(guest=>!guests.includes(guest))))
      .map(({id,guests})=>({id,guests}))});
  }

  put(actor,input){
    if(!exact(input,'expectedRevision,guests,house,rooms,type')||!this.persist||
      !this.houses.canManage(actor,input.house)||!validRoomGuests(input.guests)||!validOverrides(input.rooms)||
      !input.rooms.every(room=>this.rooms().get(room.id)?.house===input.house))return null;
    const existing=this.entry(input.house);
    const revision=(existing?.revision??0)+1;
    if((existing?.revision??null)!==input.expectedRevision||!Number.isSafeInteger(revision))return null;
    const value=structuredClone({house:input.house,revision,guests:input.guests,rooms:input.rooms});
    const next={schema,entries:[...this.state.entries.filter(entry=>entry!==existing),value]};
    this.persist(next);
    this.state=next;
    return structuredClone(value);
  }
}
