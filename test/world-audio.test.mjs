import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorldAudio} from '../src/world-audio.mjs';
class Param{constructor(){this.value=0;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node{
 constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.started=0;this.stopped=0;this.connected=false;}
 connect(){this.connected=true;return this;}disconnect(){this.connected=false;}start(){this.started++;}stop(at){this.stopped++;if(at===undefined&&this.onended)this.onended();}
}
class Context extends EventTarget{
 static created=0;
 constructor(){super();Context.created++;this.state='suspended';this.currentTime=1;this.destination={};this.made=[];}
 create(kind){const node=new Node(kind);this.made.push(node);return node;}
 createGain(){return this.create('gain');}createOscillator(){return this.create('oscillator');}createBiquadFilter(){return this.create('filter');}createBufferSource(){return this.create('buffer-source');}
 createBuffer(channels,length,rate){this.buffer={channels,length,rate,data:new Float32Array(length)};return {getChannelData:()=>this.buffer.data};}
 async resume(){this.state='running';this.dispatchEvent(new Event('statechange'));}
 async suspend(){this.state='suspended';this.dispatchEvent(new Event('statechange'));}
 async close(){this.state='closed';this.dispatchEvent(new Event('statechange'));}
}
const state=(sequence,raised=false,garden={})=>({run:'run-a',edition:'edition-a',sequence,entities:{bridge:{revision:sequence,raised},...garden}});
function setup(){let time=1000;const audio=new WorldAudio({Context,now:()=>time});return {audio,advance(ms=1000){time+=ms;if(audio.context)audio.context.currentTime+=ms/1000;}};}
test('default off allocates no context; opt-in starts one bounded bed without replaying initial state',async()=>{
 const before=Context.created,{audio}=setup();audio.observe(state(5,true));assert.equal(Context.created,before);assert.equal(audio.status().active,false);
 await audio.enableFromGesture();assert.equal(Context.created,before+1);assert.equal(audio.status().active,true);
 assert.equal(audio.context.buffer.data.byteLength,176400);assert.equal(audio.status().ownedNodes,8);
 audio.observe(state(8,false));assert.equal(audio.status().cueCount,0);
 await audio.dispose();assert.equal(audio.status().contextState,'closed');assert.equal(audio.status().ownedNodes,0);
});
test('only newly observed bridge/light revisions cue; repeated snapshots and history do not replay',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();audio.observe(state(0));advance();
 assert.equal(audio.observe(state(1,true)),'bridge-open');assert.equal(audio.status().cueCount,1);
 audio.observe(state(1,true));advance();audio.observe(state(1,true));assert.equal(audio.status().cueCount,1);
 advance();const lamp={'garden-one':{revision:1,x:1,z:1,color:'mint'}};
 assert.equal(audio.observe(state(2,true,lamp)),'light-place');assert.equal(audio.status().cueCount,2);
 advance();audio.breakContinuity();audio.observe(state(9,false,{'garden-history':{revision:1,x:2,z:1,color:'rose'}}));assert.equal(audio.status().cueCount,2);
 advance();audio.observe({...state(10,true),run:'run-b'});assert.equal(audio.status().cueCount,2);
 await audio.dispose();
});
test('hidden suspends/mutes and clears cues; visible requires another user selection and a fresh baseline',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();audio.observe(state(0));advance();audio.observe(state(1,true));
 assert.ok(audio.status().activeCueNodes>0);await audio.setVisibility(false);
 assert.equal(audio.status().contextState,'suspended');assert.equal(audio.status().activeCueNodes,0);assert.equal(audio.master.gain.value,0);
 await audio.setVisibility(true);assert.equal(audio.status().active,false);assert.equal(audio.status().paused,true);
 advance();await audio.enableFromGesture();audio.observe(state(12,false));assert.equal(audio.status().cueCount,1);
 await audio.disable();assert.equal(audio.status().active,false);assert.equal(audio.status().contextState,'suspended');await audio.dispose();
});
test('long delivery gaps baseline silently, and missing entities are not invented deletion events',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();const lamp={'garden-one':{revision:1,x:1,z:1,color:'mint'}};
 audio.observe(state(0,false,lamp));advance(6000);audio.observe(state(1,true,lamp));assert.equal(audio.status().cueCount,0);
 advance();audio.observe(state(2,true));assert.equal(audio.status().cueCount,0);
 advance();audio.observe(state(3,true,{'garden-old-tombstone':{revision:2,deleted:true}}));assert.equal(audio.status().cueCount,0);await audio.dispose();
});
test('rapid actual changes are coalesced and graph disposal stops every owned source',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();audio.observe(state(0));advance();
 for(let i=1;i<20;i++){advance(10);audio.observe(state(i,i%2===1));}
 assert.equal(audio.status().cueCount,1);assert.ok(audio.status().activeCueNodes<=4);assert.ok(audio.status().ownedNodes<=16);
 const context=audio.context;await audio.dispose();assert.ok(context.made.filter(n=>n.started).every(n=>n.stopped));assert.ok(context.made.every(n=>!n.connected));assert.equal(context.state,'closed');
});
test('failed autoplay/context resume creates no playing bed and can be retried explicitly',async()=>{
 class Refused extends Context{async resume(){throw Error('fixture browser policy');}}
 const audio=new WorldAudio({Context:Refused});await audio.enableFromGesture();assert.equal(audio.status().active,false);assert.equal(audio.status().ownedNodes,0);assert.equal(audio.status().selected,false);await audio.dispose();
});
test('a closed context is replaced without retaining its old source graph',async()=>{
 const {audio}=setup();await audio.enableFromGesture();const old=audio.context;
 await old.close();await audio.enableFromGesture();
 assert.notEqual(audio.context,old);assert.equal(audio.status().active,true);assert.equal(audio.status().ownedNodes,8);
 assert.ok(old.made.every(node=>!node.connected));await audio.dispose();
});
test('out-of-order snapshots cannot regress the baseline or replay a previous cue',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();audio.observe(state(0));advance();
 audio.observe(state(3,true));assert.equal(audio.status().cueCount,1);
 advance();audio.observe(state(2,false));advance();audio.observe(state(3,true));
 assert.equal(audio.status().cueCount,1);assert.equal(audio.baseline.sequence,3);
 advance();audio.observe(state(4,false));assert.equal(audio.status().cueCount,2);await audio.dispose();
});
test('healthy equal-cursor polls keep continuity during idle time',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();audio.observe(state(0));
 for(let i=0;i<10;i++){advance(1500);audio.observe(state(0));}
 advance();audio.observe(state(1,true));assert.equal(audio.status().cueCount,1);await audio.dispose();
});
test('a response begun before a continuity break cannot seed the new baseline',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();audio.observe(state(0));
 const previous=audio.continuityVersion;audio.breakContinuity();
 audio.observe(state(0),{continuityVersion:previous});assert.equal(audio.baseline,null);
 advance();audio.observe(state(3,true));assert.equal(audio.status().cueCount,0);
 advance();audio.observe(state(4,false));assert.equal(audio.status().cueCount,1);await audio.dispose();
});
test('an actual newer light edit cues once while same-revision repeats stay silent',async()=>{
 const {audio,advance}=setup();await audio.enableFromGesture();
 audio.observe(state(1,false,{'garden-one':{revision:1,x:1,z:1,color:'mint'}}));advance();
 const edited=state(2,false,{'garden-one':{revision:2,x:2,z:-1,color:'rose'}});
 assert.equal(audio.observe(edited),'light-place');assert.equal(audio.status().cueCount,1);
 advance();audio.observe(edited);assert.equal(audio.status().cueCount,1);await audio.dispose();
});
