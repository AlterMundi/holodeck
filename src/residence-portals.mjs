// Chamber thresholds of the Residencia that open existing rooms of CompAII's house.
// Centres come from the Blender export (residencia-holodeck.json, palace-local
// metres); a visitor stands on the corridor side, facing the threshold.
import {residenceWorld, TOROIDAL_RESIDENCE} from './toroidal-terrain.mjs';

export const RESIDENCE_PORTALS=Object.freeze([
  Object.freeze({portal:'camara-07',role:'matter',centre:[7.47,-16.79]}),
  Object.freeze({portal:'camara-08',role:'character',centre:[-13.66,-12.3]}),
  Object.freeze({portal:'camara-06',role:'lab',centre:[13.66,-12.3]}),
]);
const STAND=1.1;

// The public hall of the palace is the exterior threshold of the existing house.
export function residenceHouseDoor(){
  const [x,y,z]=residenceWorld(0,-21,TOROIDAL_RESIDENCE.floor);
  return {x,y,z,yaw:180};
}

export function residencePortalDoor({centre:[x,y]}){
  const r=Math.hypot(x,y),k=(r-STAND)/r;
  const [wx,wy,wz]=residenceWorld(x*k,y*k,TOROIDAL_RESIDENCE.floor);
  return {x:wx,y:wy,z:wz,portal:true};
}

// rooms: {matter, character, lab} room ids present in this house edition.
export function residenceEntrances(rooms,titleOf){
  return RESIDENCE_PORTALS.filter(item=>rooms[item.role]).map(item=>({
    id:rooms[item.role],title:titleOf(rooms[item.role]),door:residencePortalDoor(item),portal:item.portal,
  }));
}
