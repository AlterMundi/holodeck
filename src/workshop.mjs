import {CONTENT_NODE} from './content-visits.mjs';
// Shared semantic anchors for the selected authored workshop, in world meters.
// These describe the authored virtual place; they are not real-world sensor data.
export const WORKSHOP = Object.freeze({
  id:'island-workshop',name:'El taller de las islas',
  frame:{units:'meters',up:'y',origin:{x:0,y:0,z:0},north:'negative-z'},
  anchors:{
    'workshop-center':{x:0,y:.1,z:0},
    'bridge-control':{x:0,y:1.15,z:0},
    bridge:{x:0,y:.2,z:-12.1},
    'far-island':{x:0,y:.1,z:-17}
  },
  contents:[CONTENT_NODE],
  creationArea:{minX:-7,maxX:7,minZ:-6,maxZ:6},
  operations:['bridge.set','garden.place','garden.update','garden.remove'],
  perception:'structured-authored-world-overview',
  evidence:'selected-virtual-workshop-definition'
});

// The semantic palette stays backward compatible; custom colours are literal
// RGB bytes only, never CSS expressions or markup. Null means unsupported.
const COLOURS=Object.freeze({mint:'#8ce4c2',amber:'#efc87a',rose:'#e8a2b9',violet:'#a77bea'});
export function workshopColour(value){
  if(typeof value!=='string')return null;
  if(Object.hasOwn(COLOURS,value))return COLOURS[value];
  return /^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():null;
}
