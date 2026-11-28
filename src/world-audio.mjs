import {MAX_WORLD_ELEMENTS} from './world-limits.mjs';
// Authored opt-in workshop sound. Owns one WebAudio context and no device input,
// voice, network, media file or model activity. Never replays snapshot history.
const GAP_MS=5000,COOLDOWN_SECONDS=.35,MAX_CUE_NODES=4;
// Body sounds for the explorer's own actions, shaped from the ambient bed's
// noise buffer: no files. Each kind has its own spacing; a small node cap
// keeps a sprint or a splash-heavy swim from piling up.
const MAX_EFFECT_NODES=12;
export const BODY_SOUNDS=Object.freeze({
  'step-grass':{gap:.1,filter:'bandpass',from:2600,to:1400,q:.8,length:.09,level:.05},
  'step-dirt':{gap:.1,filter:'bandpass',from:900,to:420,q:1.1,length:.08,level:.07},
  'step-stone':{gap:.1,filter:'highpass',from:2400,to:1800,q:.7,length:.045,level:.05,tone:190},
  'step-water':{gap:.12,filter:'bandpass',from:700,to:1500,q:2.2,length:.16,level:.07},
  boost:{gap:.6,filter:'bandpass',from:300,to:2600,q:.9,length:.7,level:.16,tone:62},
  splash:{gap:.25,filter:'lowpass',from:2400,to:500,q:.6,length:.45,level:.14},
});
function snapshot(state){
  if(!state||typeof state.run!=='string'||typeof state.edition!=='string'||!Number.isSafeInteger(state.sequence)||state.sequence<0)return null;
  const entries=Object.entries(state.entities||{});if(entries.length>MAX_WORLD_ELEMENTS)return null;
  const bridge=state.entities?.bridge;
  if(!bridge||!Number.isSafeInteger(bridge.revision)||bridge.revision<0||typeof bridge.raised!=='boolean')return null;
  const garden=new Map();
  for(const[id,e]of entries)if(id.startsWith('garden-')){
    if(!e||!Number.isSafeInteger(e.revision)||e.revision<1)return null;
    garden.set(id,{revision:e.revision,deleted:e.deleted===true,x:e.x,z:e.z,color:e.color});
  }
  return {run:state.run,edition:state.edition,sequence:state.sequence,bridge:{revision:bridge.revision,raised:bridge.raised},garden};
}
export class WorldAudio{
  constructor({Context=globalThis.AudioContext||globalThis.webkitAudioContext,now=()=>performance.now(),onChange=()=>{}}={}){
    Object.assign(this,{Context,now,onChange});this.context=null;this.selected=false;this.paused=true;this.visible=true;this.disposed=false;
    this.nodes=new Set();this.cues=new Set();this.sources=[];this.baseline=null;this.lastObservation=-Infinity;this.lastCue=-Infinity;this.cueCount=0;this.generation=0;this.lastContextState=null;this.continuityVersion=0;
  }
  status(){return {supported:typeof this.Context==='function',selected:this.selected,
    active:!this.disposed&&this.selected&&!this.paused&&this.visible&&this.context?.state==='running',
    paused:this.selected&&this.paused,contextState:this.context?.state||this.lastContextState,
    ownedNodes:this.nodes.size,activeCueNodes:this.cues.size,cueCount:this.cueCount,disposed:this.disposed};}
  notify(){try{this.onChange(this.status());}catch{}}
  breakContinuity(){this.baseline=null;this.lastObservation=-Infinity;this.continuityVersion++;}
  node(value){this.nodes.add(value);return value;}
  stopCues(){for(const cue of [...this.cues]){try{cue.osc.stop();}catch{}cue.osc.disconnect();cue.gain.disconnect();cue.panner?.disconnect();this.nodes.delete(cue.panner);this.nodes.delete(cue.osc);this.nodes.delete(cue.gain);this.cues.delete(cue);}}
  stopEffects(){for(const effect of [...(this.effects??[])]){for(const node of effect.nodes){if(typeof node.stop==='function')try{node.stop();}catch{}try{node.disconnect();}catch{}this.nodes.delete(node);}this.effects.delete(effect);}}
  mute(){
    if(this.master&&this.context){try{this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(0,this.context.currentTime);}catch{}}
    this.stopCues();this.stopEffects();
  }
  clearGraph(){
    this.mute();
    for(const node of this.nodes){if(typeof node.stop==='function')try{node.stop();}catch{}try{node.disconnect();}catch{}}
    this.nodes.clear();this.sources=[];this.master=null;
  }
  async enableFromGesture(){
    if(this.disposed||!this.visible||typeof this.Context!=='function')return this.status();
    const generation=++this.generation;this.selected=true;this.paused=true;this.breakContinuity();
    try{
      if(!this.context||this.context.state==='closed'){
        this.clearGraph();this.context?.removeEventListener('statechange',this.stateChanged);
        const context=this.context=new this.Context();
        this.stateChanged=()=>{this.lastContextState=context.state;if(context.state!=='running'){this.paused=true;this.mute();this.breakContinuity();}this.notify();};
        context.addEventListener('statechange',this.stateChanged);
      }
      await this.context.resume();
      if(generation!==this.generation||this.disposed||!this.visible)return this.status();
      if(this.context.state!=='running'){this.notify();return this.status();}
      if(!this.master)this.startAmbient();
      this.paused=false;this.lastCue=-Infinity;this.master.gain.setValueAtTime(0,this.context.currentTime);this.master.gain.setTargetAtTime(.55,this.context.currentTime,.08);this.notify();return this.status();
    }catch{
      if(generation===this.generation){this.selected=false;this.paused=true;this.clearGraph();this.notify();}
      return this.status();
    }
  }
  startAmbient(){
    const context=this.context;
    this.master=this.node(context.createGain());this.master.gain.value=0;this.master.connect(context.destination);
    // One reusable 2s mono buffer at22.05kHz:176400 bytes at every hardware rate.
    const buffer=context.createBuffer(1,44100,22050),data=buffer.getChannelData(0);let seed=0x57494747;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
    const source=this.node(context.createBufferSource());source.buffer=buffer;source.loop=true;
    const wind=this.node(context.createBiquadFilter());wind.type='lowpass';wind.frequency.value=850;wind.Q.value=.4;
    const water=this.node(context.createBiquadFilter());water.type='bandpass';water.frequency.value=240;water.Q.value=.65;
    const windGain=this.node(context.createGain()),waterGain=this.node(context.createGain());windGain.gain.value=.012;waterGain.gain.value=.014;
    source.connect(wind);wind.connect(windGain);windGain.connect(this.master);source.connect(water);water.connect(waterGain);waterGain.connect(this.master);
    const drift=this.node(context.createOscillator()),depth=this.node(context.createGain());drift.type='sine';drift.frequency.value=.075;depth.gain.value=.005;drift.connect(depth);depth.connect(windGain.gain);
    source.start();drift.start();this.sources=[source,drift];
  }
  async disable(){
    ++this.generation;this.selected=false;this.paused=true;this.breakContinuity();this.mute();
    if(this.context&&this.context.state!=='closed')try{await this.context.suspend();}catch{}
    this.notify();return this.status();
  }
  async setVisibility(visible){
    this.visible=visible;this.breakContinuity();
    if(!visible){++this.generation;this.paused=true;this.mute();if(this.context&&this.context.state!=='closed')try{await this.context.suspend();}catch{}}
    // Returning to a visible tab never restarts sound. The selected user clicks
    // Reanudar, allowing normal browser gesture policy to decide actual resume.
    this.notify();return this.status();
  }
  observe(state,{continuityVersion=this.continuityVersion}={}){
    if(continuityVersion!==this.continuityVersion)return null;
    const next=snapshot(state),now=this.now(),old=this.baseline,last=this.lastObservation;
    if(next&&old&&next.run===old.run&&next.edition===old.edition&&next.sequence<=old.sequence){
      if(next.sequence===old.sequence)this.lastObservation=now;
      return null;
    }
    this.baseline=next;this.lastObservation=now;
    if(!next||!old||next.run!==old.run||next.edition!==old.edition||next.sequence<=old.sequence||now-last>GAP_MS||!this.status().active)return null;
    let cue=null;
    if(next.bridge.revision>old.bridge.revision&&next.bridge.raised!==old.bridge.raised)cue=next.bridge.raised?'bridge-open':'bridge-close';
    if(!cue)for(const[id,e]of next.garden){
      const previous=old.garden.get(id);
      if((!previous&&!e.deleted)||(previous&&e.revision>previous.revision&&(e.deleted!==previous.deleted||(!e.deleted&&(e.x!==previous.x||e.z!==previous.z||e.color!==previous.color))))){cue=e.deleted?'light-remove':'light-place';break;}
    }
    try{if(cue&&this.playCue(cue))return cue;}catch{this.stopCues();this.notify();}
    return null;
  }
  playCue(kind,{pan=0}={}){
    if(!this.status().active||this.context.currentTime-this.lastCue<COOLDOWN_SECONDS)return false;
    const signal=kind==='pending-new';
    const frequencies=signal?[523.25,783.99]:kind==='teleport-select'?[659.25,987.77]:kind==='bridge-open'?[392,587.33]:kind==='bridge-close'?[587.33,392]:kind==='light-remove'?[440]:[659.25];
    if(this.cues.size+frequencies.length>MAX_CUE_NODES)return false;
    this.lastCue=this.context.currentTime;
    frequencies.forEach((frequency,index)=>{
      const osc=this.node(this.context.createOscillator()),gain=this.node(this.context.createGain());const at=this.context.currentTime+index*(signal?.075:.09),end=at+(signal?.115:.2);
      osc.type=signal?'triangle':'sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.035,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,end);
      osc.connect(gain);
      const panner=signal&&this.context.createStereoPanner?this.node(this.context.createStereoPanner()):null;
      if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan||0));gain.connect(panner);panner.connect(this.master);}
      else gain.connect(this.master);
      const cue={osc,gain,panner};this.cues.add(cue);
      osc.onended=()=>{osc.disconnect();gain.disconnect();panner?.disconnect();this.nodes.delete(panner);this.nodes.delete(osc);this.nodes.delete(gain);this.cues.delete(cue);};
      osc.start(at);osc.stop(end+.02);
    });
    this.cueCount++;return true;
  }
  // strength 0..1 scales level and brightness.
  playBody(kind,{strength=1}={}){
    const sound=BODY_SOUNDS[kind],source=this.sources[0];
    if(!sound||!source?.buffer||!this.status().active)return false;
    this.lastBody??={};
    const now=this.context.currentTime;
    if(now-(this.lastBody[kind]??-Infinity)<sound.gap)return false;
    this.effects??=new Set();
    const needed=sound.tone?4:3;
    if(this.effects.size*3+needed>MAX_EFFECT_NODES)return false;
    this.lastBody[kind]=now;
    const level=sound.level*(.45+.55*Math.max(0,Math.min(1,strength)));
    const context=this.context,end=now+sound.length;
    const noise=this.node(context.createBufferSource());noise.buffer=source.buffer;
    const filter=this.node(context.createBiquadFilter()),gain=this.node(context.createGain());
    filter.type=sound.filter;filter.Q.value=sound.q;
    filter.frequency.setValueAtTime(sound.from*(.8+.4*strength),now);filter.frequency.exponentialRampToValueAtTime(sound.to,end);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+Math.min(.012,sound.length*.2));
    gain.gain.exponentialRampToValueAtTime(.0001,end);
    noise.connect(filter);filter.connect(gain);gain.connect(this.master);
    const nodes=[noise,filter,gain];
    if(sound.tone){
      const osc=this.node(context.createOscillator()),body=this.node(context.createGain());
      osc.type='sine';osc.frequency.setValueAtTime(sound.tone*1.6,now);osc.frequency.exponentialRampToValueAtTime(sound.tone,now+sound.length*.6);
      body.gain.setValueAtTime(.0001,now);body.gain.linearRampToValueAtTime(level*.9,now+.015);body.gain.exponentialRampToValueAtTime(.0001,now+sound.length*.6);
      osc.connect(body);body.connect(this.master);osc.start(now);osc.stop(end+.02);nodes.push(osc,body);
    }
    const effect={nodes};this.effects.add(effect);
    noise.onended=()=>{for(const node of nodes){try{node.disconnect();}catch{}this.nodes.delete(node);}this.effects.delete(effect);};
    // Start at a random place in the shared noise so steps do not repeat.
    noise.start(now,(Math.imul(this.cueCount+Object.keys(this.lastBody).length,2654435761)>>>0)%1000/1000*1.5,sound.length+.02);
    return true;
  }
  async dispose(){
    if(this.disposed)return this.status();
    ++this.generation;this.disposed=true;this.selected=false;this.paused=true;this.breakContinuity();this.clearGraph();
    const context=this.context;
    if(context){context.removeEventListener('statechange',this.stateChanged);if(context.state!=='closed')try{await context.close();}catch{}this.lastContextState=context.state;if(context.state==='closed')this.context=null;}
    this.notify();return this.status();
  }
}
