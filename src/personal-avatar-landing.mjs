import {Quaternion} from 'three';
import {clamp,smooth} from './avatar-motion-curves.mjs';

export function landingBlendWeight(age,duration,speed,gaitWeight){
  const travel=Math.max(clamp(speed/4.5),clamp(gaitWeight));
  return smooth(age/.09)*smooth((duration-age)/.23)*(1-travel*.96*smooth(age/.28));
}

export function bindPersonalAvatarLanding(mesh){
  const clip=mesh.animations?.find(action=>action.name==='hero_landing');
  if(!clip||clip.duration<=0)return;
  const channels=[];
  for(const track of clip.tracks){
    const match=/^([^\.]+)\.quaternion$/.exec(track.name);
    if(!match)continue;
    // Travel and floor contact are owned by locomotion. The studio can
    // play the authored root track when examining the standalone asset.
    const [,name]=match;
    const property='quaternion';
    const bone=mesh.getObjectByName(name);
    if(!bone?.isBone)continue;
    channels.push({
      target:bone[property],
      sample:new Quaternion(),
      rest:bone[property].clone(),
      evaluate:track.createInterpolant(),
    });
  }
  if(!channels.length)return;
  let applied=false;
  return {
    duration:clip.duration,
    restore(){
      if(!applied)return;
      for(const channel of channels)channel.target.copy(channel.rest);
      applied=false;
    },
    apply(time,weight){
      if(time>=clip.duration||weight<=0)return;
      for(const channel of channels){
        channel.rest.copy(channel.target);
        channel.sample.fromArray(channel.evaluate.evaluate(time));
        channel.target.slerp(channel.sample,weight);
      }
      applied=true;
    },
  };
}
