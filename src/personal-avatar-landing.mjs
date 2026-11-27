import {Quaternion,Vector3} from 'three';

export function bindPersonalAvatarLanding(mesh){
  const clip=mesh.animations?.find(action=>action.name==='hero_landing');
  if(!clip||clip.duration<=0)return;
  const channels=[];
  for(const track of clip.tracks){
    const match=/^([^\.]+)\.(quaternion|position)$/.exec(track.name);
    if(!match)continue;
    const [,name,property]=match;
    if(property==='position'&&name!=='root'&&name!=='pelvis')continue;
    const bone=mesh.getObjectByName(name);
    if(!bone?.isBone)continue;
    channels.push({
      target:bone[property],
      sample:property==='quaternion'?new Quaternion():new Vector3(),
      rest:bone[property].clone(),
      evaluate:track.createInterpolant(),
      rotation:property==='quaternion',
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
        if(channel.rotation)channel.target.slerp(channel.sample,weight);
        else channel.target.lerp(channel.sample,weight);
      }
      applied=true;
    },
  };
}
