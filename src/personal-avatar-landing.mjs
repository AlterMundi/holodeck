import {Quaternion,Vector3} from 'three';
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
  const feet=['foot_l','foot_r','ball_l','ball_r']
    .map(name=>mesh.getObjectByName(name)).filter(bone=>bone?.isBone);
  const up=new Vector3(),world=new Vector3(),localOrigin=new Vector3(),offset=new Vector3();
  const lowestSupport=()=>Math.min(...feet.map(foot=>foot.getWorldPosition(world).dot(up)));
  let support=null;
  let applied=false;
  return {
    duration:clip.duration,
    captureSupport(character){
      if(!feet.length||!mesh.parent)return;
      // Sample the underlying ground gait before the remaining air pose
      // and authored landing rotate the planted legs.
      up.set(0,1,0).applyQuaternion(character.getWorldQuaternion(channels[0].sample));
      support=lowestSupport();
    },
    restore(){
      if(support!==null){
        mesh.position.sub(offset);
        offset.set(0,0,0);
        support=null;
      }
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
    plant(){
      if(support===null)return;
      // Convert the world-normal correction into the mesh's parent frame.
      // The collision body and camera still follow the original locomotion.
      const correction=support-lowestSupport();
      const parent=mesh.parent;
      localOrigin.copy(parent.getWorldPosition(world));
      offset.copy(up).multiplyScalar(correction).add(world);
      parent.worldToLocal(offset).sub(parent.worldToLocal(localOrigin));
      mesh.position.add(offset);
    },
  };
}
