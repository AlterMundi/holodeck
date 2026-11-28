// Directional travel and idle repertoire study for the explorer. The body
// faces the view (yaw 0) and the input moves it in every direction, as the
// live controller does. Usage:
//   node directional.mjs out.json [avatar/explorer-hero-v29.glb] [pilot]
import {writeFileSync} from 'node:fs';
import {runSequence,drawnSkeleton,localFrame,localPatch} from './sequence.mjs';

export const DIRECTIONAL_ROUTE=[
  ['idle',3,{}],
  ['walk-right',1.6,{right:1}],
  ['walk-back',1.6,{forward:-1}],
  ['walk-diagonal',1.6,{forward:1,right:-1}],
  ['run-left',1.6,{right:-1,sprint:true}],
  ['run-back-diagonal',1.6,{forward:-1,right:1,sprint:true}],
  ['stop',1.2,{}],
  ['launch',1.2,{flight:true,vertical:1}],
  ['hover',1.4,{flight:true}],
  ['fly-right',1.8,{flight:true,right:1}],
  ['boost-left',1.8,{flight:true,right:-1,sprint:true}],
  ['fly-back',1.8,{flight:true,forward:-1}],
  ['boost-diagonal',1.8,{flight:true,forward:1,right:1,sprint:true}],
  ['rise',1.4,{flight:true,vertical:1}],
  ['sink',1.4,{flight:true,vertical:-1}],
  ['descend',4,{},m=>m.grounded],
  ['settle',1.5,{}],
  ['long-idle',56,{}],
];
const shots={idle:[1.5],'walk-right':[.8,1.1],'walk-back':[.8,1.1],'walk-diagonal':[.8,1.1],'run-left':[.8,1.0],
  'run-back-diagonal':[.8,1.0],stop:[.6],launch:[.5],hover:[1],'fly-right':[1.2],'boost-left':[1.2],'fly-back':[1.2],
  'boost-diagonal':[1.2],rise:[1],sink:[1],settle:[1.2],
  'long-idle':Array.from({length:55},(_,i)=>i+.5)};

if(import.meta.url===`file://${process.argv[1]}`){
  const [,,out,file='avatar/explorer-hero-v29.glb',pilot='pilot']=process.argv;
  const frames=[],taken=new Map(),feet=[];
  const result=await runSequence({file,route:DIRECTIONAL_ROUTE,pilot:pilot==='pilot',onFrame({name,phase,root,actor,avatar}){
    const index=taken.get(name)??0;
    if(!(phase>=(shots[name]?.[index]??Infinity)))return;
    taken.set(name,index+1);
    const local=localFrame(actor);
    frames.push({name:`${name}-${index}`,human:drawnSkeleton(root,local),robot:drawnSkeleton(avatar.figure.root,local),...localPatch(actor.position,local)});
  }});
  console.log(JSON.stringify(result));
  if(out)writeFileSync(out,JSON.stringify({file,frames}));
}
