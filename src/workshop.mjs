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
  creationArea:{minX:-7,maxX:7,minZ:-6,maxZ:6},
  operations:['bridge.set','garden.place','garden.remove'],
  perception:'structured-authored-world-overview',
  evidence:'selected-virtual-workshop-definition'
});
