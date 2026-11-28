// Stance-foot speed per travel direction: a planted foot should not slide.
import {Vector3} from 'three';
import {runSequence} from './sequence.mjs';
const legs=[['walk-forward',2,{forward:1}],['walk-right',2,{right:1}],['walk-back',2,{forward:-1}],['walk-diagonal',2,{forward:1,right:-1}],
  ['run-forward',2,{forward:1,sprint:true}],['run-left',2,{right:-1,sprint:true}],['run-back-diagonal',2,{forward:-1,right:1,sprint:true}]];
const stats={};let prev=null;
await runSequence({file:'avatar/explorer-hero-v29.glb',route:legs,pilot:true,onFrame({name,phase,mesh,dt}){
  if(phase<.7){prev=null;return;}
  const feet=['ball_l','ball_r'].map(n=>mesh.getObjectByName(n).getWorldPosition(new Vector3()));
  const up=new Vector3(0,1,0).applyQuaternion(mesh.parent.quaternion);
  const h=feet.map(f=>f.dot(up));const low=h[0]<h[1]?0:1;
  if(prev&&prev.low===low){const s=stats[name]??={slide:0,n:0};s.slide+=feet[low].distanceTo(prev.feet[low])/dt;s.n++;}
  prev={low,feet};
}});
for(const [k,v] of Object.entries(stats))console.log(k.padEnd(20),'stance foot speed m/s',(v.slide/v.n).toFixed(2));
