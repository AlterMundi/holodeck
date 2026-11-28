// The explorer's heroic repertoire: launch, every double-jump trick, boost
// styles with their brakes, a running skid, the stealth crouch and the
// torpedo swim.
//   node heroics.mjs out.json
import {writeFileSync} from 'node:fs';
import {terrainWaterDepth} from '../../src/toroidal-terrain.mjs';
import {TOROIDAL_TERRAIN} from '../../src/toroidal-terrain.mjs';
import {runSequence,drawnSkeleton,localFrame,localPatch} from './sequence.mjs';
import {TRICKS} from '../../src/flight-avatar-animation.mjs';

const {waterLevel}=TOROIDAL_TERRAIN;
const ground=m=>m.grounded;
export const HEROIC_ROUTE=[
  ['still',1,{}],
  ...TRICKS.flatMap((trick,index)=>[[`hop-${index}`,.22,{jump:true}],[`trick-${index}`,1.2,{doubleJump:true}],[`land-${index}`,1.4,{},null]]),
  ['sprint',1.6,{forward:1,sprint:true}],
  ['skid',1,{}],
  ['crouch',1.6,{crouch:true}],
  ['sneak',1.6,{crouch:true,forward:1}],
  ['sneak-side',1.4,{crouch:true,right:1}],
  ['rise',.8,{}],
  ['launch',1.1,{flight:true,vertical:1}],
  ['hover-still',24,{flight:true}],
  ['hover-look-up',1.6,{flight:true,pitch:.6}],
  ...[0,1,2,3,4].flatMap(index=>[[`cruise-${index}`,1.6,{flight:true,forward:1}],[`boost-${index}`,1.4,{flight:true,forward:1,sprint:true}],[`brake-${index}`,.8,{flight:true}]]),
  ['descend',4,{},ground],
  ['shore',40,{forward:1,sprint:true},m=>terrainWaterDepth(m.u,m.v)>.5,{u:.0155,v:.234}],
  ['wade',20,{forward:1},m=>m.height<waterLevel-.90],
  ['surface-swim',3,{forward:1}],
  ['tread',24,{}],
  ['dive',1.6,{forward:1,vertical:-1}],
  ['submerged',2.4,{forward:1}],
];
const shots=Object.fromEntries([
  ...TRICKS.map((_,index)=>[`trick-${index}`,[.12,.26,.40,.54]]),
  ['skid',[.1,.22]],['crouch',[1.2]],['sneak',[.8,1.1]],['sneak-side',[.9]],['launch',[.12,.22,.4]],
  ...[0,1,2,3,4].flatMap(index=>[[`cruise-${index}`,[1.4]],[`boost-${index}`,[1.2]],[`brake-${index}`,[.25]]]),
  ['surface-swim',[1.6,1.9,2.2]],['hover-still',[2,6,10,14,18,22]],['hover-look-up',[1.4]],['tread',[2,6,10,14,18,22]],['submerged',[1.4,1.7,2.0]],
]);

if(import.meta.url===`file://${process.argv[1]}`){
  const [,,out,file='avatar/explorer-hero-v30.glb']=process.argv;
  const frames=[],taken=new Map();
  const result=await runSequence({file,route:HEROIC_ROUTE,pilot:true,onFrame({name,phase,root,actor,avatar}){
    const index=taken.get(name)??0;
    if(!(phase>=(shots[name]?.[index]??Infinity)))return;
    taken.set(name,index+1);
    const local=localFrame(actor);
    frames.push({name:`${name}-${index}`,human:drawnSkeleton(root,local),robot:drawnSkeleton(avatar.figure.root,local),...localPatch(actor.position,local)});
  }});
  console.log(JSON.stringify({...result,frames:frames.length}));
  if(out)writeFileSync(out,JSON.stringify({file,frames}));
}
