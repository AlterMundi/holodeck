// Use extra screen density for the world up to a fixed framebuffer budget.
// The browser keeps the original CSS sizing and device density for the HUD.
const WORLD_PIXELS=2500000;
const MAX_RATIO=2;

export function capWorldPixelRatio(renderer){
  // MML 0.28 sends both resize paths through this WebGL renderer. Capping
  // here also avoids allocating a full-density buffer on every resize.
  const webgl=renderer.composer?.renderer;
  if(!webgl)return;
  const setPixelRatio=webgl.setPixelRatio.bind(webgl);
  webgl.setPixelRatio=requested=>{
    const parent=webgl.domElement.parentElement;
    const pixels=(parent?.clientWidth??0)*(parent?.clientHeight??0);
    const ratio=Math.min(requested,MAX_RATIO,pixels>0?Math.sqrt(WORLD_PIXELS/pixels):Infinity);
    if(ratio!==webgl.getPixelRatio())setPixelRatio(ratio);
  };
  renderer.fitContainer();
}
