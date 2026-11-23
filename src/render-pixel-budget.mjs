// Keep CSS dimensions and input coordinates at their original device density.
const WORLD_PIXELS=2500000;
const TIERS=[2,1.5,1,.85,.7,.55];
const SLOW_MS=45;
const FAST_MS=21;
const STEP_INTERVAL_MS=1600;
const RECOVER_MS=18000;

export function capWorldPixelRatio(renderer,{adaptive=false,startAtNative=false,clock=()=>performance.now(),visibility=globalThis.document}={}){
  // Both pinned MML resize paths use this Three.js renderer, which reallocates
  // the drawing buffer without changing CSS layout when its ratio changes.
  const webgl=renderer.composer?.renderer;
  if(!webgl)return {sample(){},dispose(){}};
  const setPixelRatio=webgl.setPixelRatio.bind(webgl);
  const shadowMap=webgl.shadowMap;
  const shadowsEnabled=shadowMap?.enabled===true;
  let requested=1,width=0,height=0,tier=adaptive&&startAtNative?TIERS.indexOf(1):0;
  let previousFrame=null,slow=0,fast=0;
  let nextStep=0,recoverAfter=tier>0?clock()+RECOVER_MS:0;

  const resetSamples=()=>{
    previousFrame=null;slow=0;fast=0;
  };
  const ratioFor=index=>{
    const pixels=width*height;
    return Math.min(requested,TIERS[index],pixels>0?Math.sqrt(WORLD_PIXELS/pixels):Infinity);
  };
  const applyRatio=()=>{
    const ratio=ratioFor(tier);
    if(ratio!==webgl.getPixelRatio())setPixelRatio(ratio);
    // The lowest tier also saves the scene's extra shadow pass. Keep all
    // materials, lights, navigation and HUD at their ordinary settings.
    if(adaptive&&shadowsEnabled)shadowMap.enabled=tier<TIERS.length-1;
  };
  webgl.setPixelRatio=value=>{
    const parent=webgl.domElement.parentElement;
    const nextWidth=parent?.clientWidth??0,nextHeight=parent?.clientHeight??0;
    if(nextWidth!==width||nextHeight!==height||requested!==value)resetSamples();
    requested=value;width=nextWidth;height=nextHeight;applyRatio();
  };
  renderer.fitContainer();
  if(adaptive)visibility?.addEventListener('visibilitychange',resetSamples);

  function sample(ready){
    if(!adaptive)return;
    if(!ready){resetSamples();return;}
    const now=clock(),interval=previousFrame===null?0:now-previousFrame;
    previousFrame=now;
    slow=interval>=SLOW_MS?slow+1:0;
    fast=interval>0&&interval<=FAST_MS?fast+1:0;
    if(now<nextStep)return;
    if(slow>=4){
      // Skip tiers that cannot reduce this display's current buffer.
      const lower=TIERS.findIndex((_,index)=>index>tier&&ratioFor(index)<ratioFor(tier));
      if(lower<0)return;
      tier=lower;
    }else if(tier>0&&fast>=120&&now>=recoverAfter){
      tier--;
    }else return;
    applyRatio();
    resetSamples();
    nextStep=now+STEP_INTERVAL_MS;
    recoverAfter=now+RECOVER_MS;
  }
  return {sample,dispose(){
    if(adaptive)visibility?.removeEventListener('visibilitychange',resetSamples);
    if(adaptive&&shadowsEnabled)shadowMap.enabled=true;
  }};
}
