export const clamp=(value,low=0,high=1)=>Math.max(low,Math.min(high,value));
export const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
export const ease=(seconds,rate)=>1-Math.exp(-Math.max(0,seconds)*rate);

// Exact critically damped follower. It is stable at any frame step, keeps
// velocity across target changes and does not overshoot from rest.
export class Follower{
  constructor(rate){this.rate=rate;this.reset();}
  reset(value=0){this.value=value;this.velocity=0;return this;}
  update(target,seconds,rate=this.rate){
    if(seconds<=0)return this.value;
    const offset=this.value-target;
    const drive=(this.velocity+rate*offset)*seconds;
    const decay=Math.exp(-rate*seconds);
    this.velocity=(this.velocity-rate*drive)*decay;
    return this.value=target+(offset+drive)*decay;
  }
}

// Timed one-shot: rise to one, hold, then settle with zero slope at each end.
export const pulse=(time,rise,hold,settle)=>time<0||time>=rise+hold+settle?0:
  time<rise?smooth(time/rise):time<rise+hold?1:1-smooth((time-rise-hold)/settle);

// Keyed values [[seconds,[...]],...] with monotone cubic spacing. A repeated
// value is an exact hold. The result array is caller-owned.
export function keyed(keys,time,out,loop=0){
  const count=keys.length;
  let at=loop?((time%loop)+loop)%loop:Math.max(keys[0][0],Math.min(keys[count-1][0],time));
  let index=0;
  while(index<count-1&&keys[index+1][0]<=at)index++;
  if(!loop&&index===count-1)index=count-2;
  const moment=k=>loop?keys[((k%count)+count)%count][0]+loop*Math.floor(k/count):keys[k][0];
  const value=(k,lane)=>keys[loop?((k%count)+count)%count:k][1][lane];
  const slope=(k,lane)=>{
    if(!loop&&(k<=0||k>=count-1))return 0;
    const left=(value(k,lane)-value(k-1,lane))/(moment(k)-moment(k-1));
    const right=(value(k+1,lane)-value(k,lane))/(moment(k+1)-moment(k));
    return left*right<=0?0:2*left*right/(left+right);
  };
  const start=moment(index),span=moment(index+1)-start;
  const s=(at-start)/span,s2=s*s,s3=s2*s;
  for(let lane=0;lane<out.length;lane++)
    out[lane]=(2*s3-3*s2+1)*value(index,lane)+(s3-2*s2+s)*span*slope(index,lane)+
      (3*s2-2*s3)*value(index+1,lane)+(s3-s2)*span*slope(index+1,lane);
  return out;
}
