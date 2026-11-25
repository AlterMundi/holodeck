import {AnimationMixer,Group,Quaternion,Vector3} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {bindFlightAvatarAnimation} from './flight-avatar-animation.mjs';
import {TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';
import {ToroidalLocomotion,toroidalRotation} from './toroidal-locomotion.mjs';

export const motionStudyRate=30;
export const humanMotionStudies=Object.freeze({
  'estudio-vuelo':{label:'Despegue, giro y aterrizaje',duration:6,u:.002,v:.245,wet:false,
    input(time){
      const flying=time>=.72&&time<3.2;
      return {flight:flying,vertical:flying&&time<1.2?1:0,
        forward:flying&&time>=1.45?1:0,yaw:time>=2.14?.9:0};
    }},
  'estudio-nado':{label:'Remada, inmersión y ascenso',duration:6,u:.0155,v:.26,wet:true,
    input(time){
      return {forward:time>=.55?1:0,yaw:time>=3.4?1.05:0,
        vertical:time>=1.9&&time<2.95?-1:time>=3.5&&time<4.8?1:0};
    }},
});

function relevantNodes(mesh){
  const nodes=[mesh];
  mesh.traverse(node=>{if(node.isBone)nodes.push(node);});
  return nodes;
}

/** Sample the same active pose adapter as the game. The turntable follows
 * translation so the player can inspect the rig at a fixed camera distance. */
export function createHumanMotionStudy(template,stock,scenario){
  const mesh=clone(template);
  const subject=new Group();
  subject.add(mesh);
  subject.getMesh=()=>mesh;
  const motion=new ToroidalLocomotion(scenario);
  const initial=motion.pose().position;
  const inverseFrame=toroidalRotation(new Vector3(initial.x,initial.y,initial.z),0).invert();
  const actor={position:new Vector3(),animationState:0,animationWeights:{0:1}};
  const state={characters:new Map([[0,actor]]),localCharacterId:0};
  const mixer=new AnimationMixer(mesh);
  const idle=mixer.clipAction(stock).play();
  const manager={loadedCharacters:new Map([[0,{character:subject}]]),update(_,dt){
    subject.position.copy(actor.position);
    toroidalRotation(actor.position,motion.yaw,subject.quaternion);
    mixer.update(dt);
  }};
  let input={};
  const unbind=bindFlightAvatarAnimation(manager,()=>({
    outdoor:true,flying:Boolean(input.flight),grounded:motion.grounded,glanceMotion:true,
  }));
  const nodes=relevantNodes(mesh);
  const count=Math.round(scenario.duration*motionStudyRate);
  const samples=new Float32Array((count+1)*(5+7*nodes.length));
  const rotation=new Quaternion(),dt=1/motionStudyRate;
  let offset=0;
  try{
    for(let frame=0;frame<=count;frame++){
      input=scenario.input(frame*dt);
      if(frame)motion.update(dt,input);
      const pose=motion.pose().position;
      actor.position.set(pose.x,pose.y,pose.z);
      actor.animationState=motion.grounded?0:4;
      actor.animationWeights[0]=Number(motion.grounded);
      idle.setEffectiveWeight(actor.animationWeights[0]);
      manager.update(state,frame?dt:0);
      rotation.copy(inverseFrame).multiply(subject.quaternion).toArray(samples,offset);
      offset+=4;
      samples[offset++]=scenario.wet?TOROIDAL_TERRAIN.waterLevel-motion.height:NaN;
      for(const node of nodes){
        node.position.toArray(samples,offset);
        node.quaternion.toArray(samples,offset+3);
        offset+=7;
      }
    }
  }finally{
    unbind();
    mixer.stopAllAction();
    mixer.uncacheRoot(mesh);
  }
  const targets=new WeakMap();
  return {count,apply(target,offsetTarget,frame){
    let destination=targets.get(target);
    if(!destination){destination=relevantNodes(target);targets.set(target,destination);}
    if(destination.length!==nodes.length)throw Error('Motion study needs the sampled rig');
    let offset=Math.max(0,Math.min(count,Math.round(frame)))*(5+7*nodes.length);
    offsetTarget.quaternion.fromArray(samples,offset);
    offset+=4;
    const waterHeight=samples[offset++];
    for(const node of destination){
      node.position.fromArray(samples,offset);
      node.quaternion.fromArray(samples,offset+3);
      offset+=7;
    }
    return waterHeight;
  }};
}
