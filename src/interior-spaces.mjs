import {EXHIBIT_LABEL,EXHIBIT_POSITION} from './room-exhibits.mjs';
import {passageAt,passageMarkup,roomFloor} from './interior-geometry.mjs';
import {exteriorDoor} from './houses.mjs';
import {attribute} from './workshop-projection.mjs';

export const FOYER_DOOR = Object.freeze({x:0,y:.11,z:4.9});
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

  releaseDeniedPosition(actor) {
    if (this.fenced) return;
    const saved=this.positions.find(entry=>entry.actor===actor.id);
    if (saved && !this.allows(actor,saved.space))
      this.savePositions(this.positions.filter(entry=>entry!==saved));
  }

  approach(actor,destination) {
    const target=this.rooms.get(destination),from=this.current(actor);
    if(this.fenced||!target||from===destination||!this.allows(actor,destination))return null;
    const seen=new Set([from]),queue=[{id:from,first:null}];
    for(const {id,first} of queue){
      if(id===destination)return {from,to:first};
      const room=this.rooms.get(id);
      const adjacent=this.view(actor,id);
      const neighbors=room?[
        ...adjacent.exits.map(exit=>exit.to),
        ...(adjacent.exitDoor||adjacent.emergencyExit?[OUTSIDE]:[]),
      ]:adjacent.entrances.filter(entry=>this.rooms.get(entry.id).house===target.house).map(entry=>entry.id);
      for(const next of neighbors){
        if(seen.has(next))continue;
        seen.add(next);queue.push({id:next,first:first??next});
      }
    }
    return null;
  }

  canMove(actor,request) {
    if (this.fenced || !exact(request,'from,to') || !allowedActor(actor?.id) ||
        typeof request.to!=='string' || this.current(actor)!==request.from ||
        request.from===request.to || !this.allows(actor,request.to)) return false;
    if (request.from===OUTSIDE) return this.rooms.get(request.to)?.entry===true;
    return request.to===OUTSIDE || this.rooms.get(request.from)?.links.some(link=>link.to===request.to);
  }

  move(actor, request) {
    if (!this.canMove(actor,request)) return null;
    const there=this.rooms.get(request.to);
    const now=this.clock();
    const positions=this.positions.filter(p=>p.actor!==actor.id&&now-p.at<WINDOW_MS);
    if (there) {
      if (positions.length>=MAX_ACTIVE) return null;
      positions.push({actor:actor.id,space:there.id,at:now});
    }
    this.savePositions(positions);
    return this.view(actor);
  }

  savePositions(positions) {
    try {
      this.persist?.({schema:'holodeck.spaces/v1',positions});
    } catch(error) {
      if(error.commitUncertain)this.fenced=true;
      throw error;
    }
    this.positions=positions;
  }

  clearRestoredGuestPositions(definitions,owner) {
    const rooms=new Map(definitions.map(room=>[room.id,room]));
    const positions=this.positions.filter(({actor,space})=>{
      const previous=this.rooms.get(space),next=rooms.get(space);
      return actor===owner||!previous||!next?.guests.includes(actor)||previous.guests.includes(actor);
    });
    // These entries are already denied under the current layout. Discard them
    // before restoring a grant, so a lost layout save cannot evict an admitted guest.
    if(positions.length!==this.positions.length)this.savePositions(positions);
  }

  canReachEntrance(actor, start) {
    const seen = new Set([start]);
    const queue = [start];
    for (const id of queue) {
      const room = this.rooms.get(id);
      if (room.entry) return true;
      for (const link of room.links) {
        if (seen.has(link.to) || !this.allows(actor,link.to)) continue;
        seen.add(link.to);
        queue.push(link.to);
      }
    }
    return false;
  }

  passages(actor,room) {
    return room.links.flatMap((link,index)=>{
      if(!this.allows(actor,link.to))return [];
      const destination=this.rooms.get(link.to);
      return [{...passageAt(room,link,index,destination),title:destination.title}];
    });
  }

  view(actor,current=this.current(actor)) {
    const room=this.allows(actor,current)&&this.rooms.get(current);
    const houses = new Map(this.houses.directory().map(house=>[house.id,house]));
    if (!room) return {id:OUTSIDE,entrances:[...this.rooms.values()]
      .filter(r=>r.entry&&this.allows(actor,r.id)).map(({id,house})=>{
        const selected=houses.get(house);
        return {id,title:selected.facade.title,door:exteriorDoor(selected)};
      })};
    return {id:current,title:room.title,level:room.level,house:room.house,objects:[ROOM_MARKER],
      exteriorDoor:exteriorDoor(houses.get(room.house)),
      ...(room.entry?{exitDoor:FOYER_DOOR}:!this.canReachEntrance(actor,current)?{emergencyExit:true}:{}),
      exits:this.passages(actor,room)};
  }
}

// Each server-authorized room has its own local collision and render document.
export function interiorDocument(room,passages=[],exhibit=null,art=null,passageAsset=()=>null,houseDoor=false) {
  const {id,position:{x,y,z},radius,height}=ROOM_MARKER;
  const walls=art?.replacesShell||art?.replacesWalls?' opacity="0" cast-shadows="false"':'';
  const ceiling=art?.ceiling??3.3,wallCenter=ceiling/2;
  const station=art?.station;
  const stationMarkup=station?`<m-group id="${station.id}" x="${station.position.x}" z="${station.position.z}">
    ${station.authoredSign?'':`<m-label y="1.21" z=".52" width="2.33" height=".32" font-size="20" content="${attribute(station.title)}" collide="false"></m-label>
    <m-label y="1.21" z="-.52" ry="180" width="2.33" height=".32" font-size="20" content="${attribute(station.title)}" collide="false"></m-label>`}
  </m-group>`:'';
  // The Blender benches already carry their own physical nameplates.
  const controlAnchors=(art?.controls??[]).map(control=>
    `<m-group id="${control.id}" x="${control.position.x}" z="${control.position.z}"></m-group>`).join('');
  const {floor,wall,end} = art?.palette ?? (room.entry ? {floor:'#aa9376',wall:'#486966',end:'#557675'} :
    room.level<0 ? {floor:'#657378',wall:'#415666',end:'#4c6376'} :
    room.level>0 ? {floor:'#bfaa86',wall:'#667b86',end:'#7a8890'} :
    {floor:'#b5a28e',wall:'#5b7471',end:'#668581'});
  return `<m-group id="${room.id}">
    ${roomFloor(passages,art&&!art.palette?'#746d61':floor,!art?.replacesShell)}
    ${stationMarkup}${controlAnchors}
    ${art?'<m-model id="room-art" src="'+attribute(art.src)+'" collide="false"></m-model>'+art.colliders+
      (art.dressing??'')+(art.lightRig??''):''}
    <m-cube x="-6" y="${wallCenter}" z="0" width=".2" height="${ceiling}" depth="12" color="${wall}"${walls}></m-cube>
    <m-cube x="6" y="${wallCenter}" z="0" width=".2" height="${ceiling}" depth="12" color="${wall}"${walls}></m-cube>
    <m-cube x="0" y="${wallCenter}" z="-6" width="12" height="${ceiling}" depth=".2" color="${end}"${walls}></m-cube>
    <m-cube x="0" y="${wallCenter}" z="6" width="12" height="${ceiling}" depth=".2" color="${end}"${walls}></m-cube>
    <m-cube id="room-ceiling-collider" y="${ceiling+.1}" width="12.2" height=".2" depth="12.2" opacity="0" cast-shadows="false"></m-cube>
    ${exhibit?`<m-group id="house-exhibit" data-exhibit-revision="${exhibit.revision}" x="${EXHIBIT_POSITION.x}" z="${EXHIBIT_POSITION.z}">
      ${art?.authoredExhibitBase?'':`<m-cylinder y=".48" radius=".69" height=".76" color="#526b66"></m-cylinder>
      <m-cube y="1.10" width="1.34" height=".49" depth=".77" color="#b89165"></m-cube>`}
      ${art?.gallerySigns?'':`<m-label y="1.74" z=".41" width="1.6" height=".36" font-size="20" content="${EXHIBIT_LABEL}" collide="false"></m-label>`}
    </m-group>`:''}
    ${passages.map(p=>passageMarkup({...p,label:attribute(p.title)},{
      visibleSteps:!art?.authoredStairs,authoredPortal:art?.authoredPortal,
      authoredDoor:art?.authoredDoor,authoredPassages:art?.authoredPassages,
      portalAsset:passageAsset(p),houseDoor,existingDoor:houseDoor&&art?.authoredDoor&&p.slot===0})).join('')}
    ${room.entry?'<m-group id="house-exit"><m-cube y="1.13" z="5.86" width="1.35" height="2.06" depth=".08" color="#c8a36d" collide="false"></m-cube><m-cube x=".45" y="1.05" z="5.79" width=".06" height=".14" depth=".08" color="#343e40" collide="false"></m-cube><m-label y="2.53" z="5.81" ry="180" width="1.55" height=".37" font-size="19" content="Salida" collide="false"></m-label></m-group>':''}
    ${art&&!art.palette?'':`<m-label x="0" y="2.3" z="-5.87" width="4" height=".65" font-size="26" content="${attribute(room.title)}"${art?.palette?' color="#163b3f" font-color="#f6edda"':''} collide="false"></m-label>`}
    ${art?.replacesShell||art?.hideMarker?'':`<m-cylinder id="${id}" x="${x}" y="${y}" z="${z}" radius="${radius}" height="${height}" color="#af956a"></m-cylinder>`}
  </m-group>`;
}
