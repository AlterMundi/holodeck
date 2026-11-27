const tau=2*Math.PI;
const turnRate=2.35;
const minimumSpeed=8;
const smooth=value=>{
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
};

// The flight path owns the phase. Input requests a sustained pull and the
// body and camera sample the tangent of the same path.
export class VerticalFlightLoop {
  constructor(){this.cancel();}

  cancel(){
    this.arc=null;
    this.held=0;
    this.authorized=false;
  }

  arm(seconds,{pull,ring,cross,vertical=0,aboveGround,belowCeiling}){
    if(this.arc)return;
    if(!pull){this.held=0;this.authorized=false;return;}
    if(this.authorized)return;
    this.held+=seconds;
    const planar=Math.hypot(ring,cross);
    const speed=Math.hypot(planar,vertical);
    if(speed<minimumSpeed||planar<minimumSpeed*.65){this.held=0;return;}
    const start=Math.max(-.68,Math.min(.68,Math.atan2(vertical,planar)));
    if(this.held<.18)return;
    const radius=speed/turnRate;
    const climb=radius*(1+pull*Math.cos(start));
    const drop=radius*(1-pull*Math.cos(start));
    if(belowCeiling<climb+3||aboveGround<drop+2.6)return;
    this.authorized=true;
    this.arc={yaw:Math.atan2(ring,cross),start,pull,speed,turned:0};
  }

  step(seconds){
    const arc=this.arc;
    if(!arc)return null;
    const turn=Math.min(tau-arc.turned,seconds*turnRate);
    const middle=arc.start+arc.pull*(arc.turned+.5*turn);
    // When the final step straddles the end, spend its remaining time
    // departing along the tangent at the same speed.
    const active=turn/(seconds*turnRate);
    const along=arc.speed*(Math.cos(middle)*active+Math.cos(arc.start)*(1-active));
    const vertical=arc.speed*(Math.sin(middle)*active+Math.sin(arc.start)*(1-active));
    arc.turned+=turn;
    if(arc.turned>=tau-1e-8)this.arc=null;
    return {ring:along*Math.sin(arc.yaw),cross:along*Math.cos(arc.yaw),vertical};
  }

  get pose(){
    const arc=this.arc;
    if(!arc)return null;
    return {yaw:arc.yaw,pitch:arc.start+arc.pull*arc.turned,turned:arc.turned,
      blend:smooth(arc.turned/.72)*smooth((tau-arc.turned)/.95)};
  }
}
