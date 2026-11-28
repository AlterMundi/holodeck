// Mash flight and ground keys and report how fast the drawn body turns.
// A connected avatar leans and settles; it never whips around.
import {runSequence} from './sequence.mjs';
const keys=[{forward:1},{right:1},{forward:-1},{right:-1},{forward:1,right:1},{},{forward:-1,right:1},{right:-1,sprint:true},{forward:1,sprint:true}];
export async function keyMash({flight=true,file='avatar/explorer-hero-v29.glb'}={}){
  const route=[['launch',flight?1.2:.2,flight?{flight:true,vertical:1}:{}],
    ...keys.flatMap((input,index)=>[[`k${index}`,.35,{...input,flight}],[`h${index}`,.25,{flight}]])];
  let previous=null,worst=0,sum=0,count=0;
  await runSequence({file,route,pilot:true,onFrame({name,root,dt}){
    if(name==='launch'){previous=null;return;}
    const q=root.quaternion.clone();
    if(previous){const rate=previous.angleTo(q)/dt;worst=Math.max(worst,rate);sum+=rate;count++;}
    previous=q;
  }});
  return {worst,mean:sum/count};
}
if(import.meta.url===`file://${process.argv[1]}`){
  console.log('flight',JSON.stringify(await keyMash({flight:true})));
  console.log('ground',JSON.stringify(await keyMash({flight:false})));
}
