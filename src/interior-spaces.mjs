import {attribute} from './workshop-projection.mjs';

export const OUTSIDE = 'outside';
export const SPACE_SAVE_BYTES = 16 * 1024;
const MAX_SPACES = 24;
const MAX_ACTIVE = 32;
const HOUSE = /^house-[a-f0-9]{64}$/;
const SPACE = /^[a-z][a-z0-9-]{0,47}$/;
const ACTOR = /^(?:human:[A-Za-z0-9:_-]{1,130}|dm:being:v1:[A-Za-z0-9_-]{43})$/;
const WINDOW_MS = 30 * 60 * 1000;
const ROOM_MARKER = Object.freeze({id:'room-marker',kind:'cylinder',
  position:Object.freeze({x:0,y:.45,z:-2}),radius:.55,height:.7});

const exact = (value, keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join(',') === keys;
const allowedActor = value => typeof value === 'string' && ACTOR.test(value);
const label = value => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= 60 && !/[\u0000-\u001f\u007f]/.test(value);

export class InteriorSpaces {
  constructor({definitions = [], houses, state, persist, clock = Date.now, guestAccess}) {
    if (!Array.isArray(definitions) || definitions.length > MAX_SPACES)
      throw Error('Select bounded authored interior rooms');
    this.houses = houses;
    this.persist = persist;
    this.clock = clock;
    this.guestAccess = guestAccess;
    this.rooms = new Map();
    for (const d of definitions) {
      if (!exact(d,'entry,guests,house,id,level,links,title') ||
          typeof d.id !== 'string' || d.id === OUTSIDE || !SPACE.test(d.id) || this.rooms.has(d.id) ||
          typeof d.house !== 'string' || !HOUSE.test(d.house) || !label(d.title) ||
          !Number.isSafeInteger(d.level) || Math.abs(d.level)>1000 || typeof d.entry !== 'boolean' ||
          !Array.isArray(d.guests) || d.guests.length > 16 || !d.guests.every(allowedActor) ||
          new Set(d.guests).size !== d.guests.length ||
          !Array.isArray(d.links) || d.links.length > 6 ||
          !d.links.every(link=>exact(link,'kind,to') && typeof link.to === 'string' &&
            SPACE.test(link.to) && link.to !== d.id && ['door','stair','portal'].includes(link.kind)) ||
          new Set(d.links.map(link=>link.to)).size !== d.links.length)
        throw Error('Invalid authored interior room');
      this.rooms.set(d.id,structuredClone(d));
    }
    for (const d of this.rooms.values()) {
      for (const edge of d.links) {
        const other=this.rooms.get(edge.to);
        if (!other || other.house!==d.house ||
            !other.links.some(rev=>rev.to===d.id&&rev.kind===edge.kind) ||
            (edge.kind==='door'&&other.level!==d.level) ||
            (edge.kind==='stair'&&Math.abs(other.level-d.level)!==1))
          throw Error('Interior links must join reciprocal rooms in the same house');
      }
    }
    for (const house of new Set([...this.rooms.values()].map(room=>room.house))) {
      const rooms=[...this.rooms.values()].filter(room=>room.house===house);
      const doors=rooms.filter(room=>room.entry);
      if(doors.length!==1)throw Error('Choose exactly one exterior entrance per interior');
      const reached=new Set(), queue=[doors[0].id];
      while(queue.length){
        const id=queue.pop();
        if(reached.has(id))continue;
        reached.add(id);
        queue.push(...this.rooms.get(id).links.map(edge=>edge.to));
      }
      if(reached.size!==rooms.length)throw Error('Every interior room needs a route to the entrance');
    }
    const positions=state?.positions ?? [];
    if ((state!=null&&(!exact(state,'positions,schema')||state.schema!=='holodeck.spaces/v1')) ||
        !Array.isArray(positions) || positions.length>MAX_ACTIVE ||
        !positions.every(p=>exact(p,'actor,at,space')&&allowedActor(p.actor)&&
          typeof p.space==='string'&&SPACE.test(p.space)&&Number.isSafeInteger(p.at)&&p.at>=0) ||
        new Set(positions.map(p=>p.actor)).size!==positions.length)
      throw Error('Invalid active-space checkpoint');
    this.positions = positions;
  }

  allows(actor, id) {
    if (id===OUTSIDE) return true;
    const room=this.rooms.get(id);
    if (!room || !allowedActor(actor?.id)) return false;
    const house=this.houses.directory().find(h=>h.id===room.house);
    if (!house) return false;
    if (house.owner===actor.id && actor.kind==='daimon') return true;
    if (!room.guests.includes(actor.id)) return false;
    return this.guestAccess ? this.guestAccess(actor,room.id)===true : true;
  }

  current(actor) {
    const p=this.positions.find(entry=>entry.actor===actor?.id);
    if (!p || this.clock()-p.at>=WINDOW_MS || !this.allows(actor,p.space)) return OUTSIDE;
    return p.space;
  }

  move(actor, request) {
    if (this.fenced || !exact(request,'from,to') || !allowedActor(actor?.id) ||
        typeof request.to!=='string' || this.current(actor)!==request.from ||
        request.from===request.to || !this.allows(actor,request.to)) return null;
    const here=this.rooms.get(request.from), there=this.rooms.get(request.to);
    if (request.from===OUTSIDE ? !there?.entry :
        request.to!==OUTSIDE && !here?.links.some(link=>link.to===request.to)) return null;
    const now=this.clock();
    const positions=this.positions.filter(p=>p.actor!==actor.id&&now-p.at<WINDOW_MS);
    if (there) {
      if (positions.length>=MAX_ACTIVE) return null;
      positions.push({actor:actor.id,space:there.id,at:now});
    }
    try {
      this.persist?.({schema:'holodeck.spaces/v1',positions});
    } catch(error) {
      if(error.commitUncertain)this.fenced=true;
      throw error;
    }
    this.positions=positions;
    return this.view(actor);
  }

  view(actor) {
    const current=this.current(actor), room=this.rooms.get(current);
    if (!room) return {id:OUTSIDE,entrances:[...this.rooms.values()]
      .filter(r=>r.entry&&this.allows(actor,r.id)).map(({id,title})=>({id,title}))};
    return {id:current,title:room.title,level:room.level,house:room.house,objects:[ROOM_MARKER],
      exits:room.links.filter(link=>this.allows(actor,link.to)).map(link=>({...link,title:this.rooms.get(link.to).title}))};
  }
}

// Each server-authorized room has its own local collision and render document.
export function interiorDocument(room) {
  const {id,position:{x,y,z},radius,height}=ROOM_MARKER;
  return `<m-group id="${room.id}">
    <m-cube x="0" y="0" z="0" width="12" height=".2" depth="12" color="#9b8a72"></m-cube>
    <m-cube x="-6" y="1.65" z="0" width=".2" height="3.3" depth="12" color="#3f5962"></m-cube>
    <m-cube x="6" y="1.65" z="0" width=".2" height="3.3" depth="12" color="#3f5962"></m-cube>
    <m-cube x="0" y="1.65" z="-6" width="12" height="3.3" depth=".2" color="#506b72"></m-cube>
    <m-cube x="0" y="1.65" z="6" width="12" height="3.3" depth=".2" color="#506b72"></m-cube>
    <m-label x="0" y="2.3" z="-5.87" width="4" height=".65" font-size="26" content="${attribute(room.title)}" collide="false"></m-label>
    <m-cylinder id="${id}" x="${x}" y="${y}" z="${z}" radius="${radius}" height="${height}" color="#af956a"></m-cylinder>
  </m-group>`;
}
