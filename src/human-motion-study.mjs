import {AnimationMixer,Group,Quaternion,Vector3} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {AnimationMixer as MotionMixer,AnimationState} from '@mml-io/3d-web-client-core';
import {bindFlightAvatarAnimation} from './flight-avatar-animation.mjs';
import {TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';
import {ToroidalLocomotion,toroidalRotation} from './toroidal-locomotion.mjs';

export const motionStudyRate=30;
const walkRelease=1.9;
export const humanMotionStudies=Object.freeze({
  'estudio-vuelo':{label:'Despegue, giro y aterrizaje',duration:6,u:.002,v:.245,wet:false,
    chapters:[
      {id:'ground',label:'Apoyo en tierra',when:({frame,grounded})=>frame===0&&grounded},
      {id:'lift',label:'Despegue',when:({input,grounded})=>input.flight&&!grounded},
      {id:'hover',label:'Vuelo en el lugar',when:({input,grounded})=>input.flight&&!grounded&&!input.vertical&&!input.forward},
      {id:'turn',label:'Inicio del giro',when:({input,previousInput})=>input.flight&&input.yaw!==previousInput.yaw},
      {id:'land',label:'Contacto con el suelo',when:({input,grounded,wasGrounded})=>!input.flight&&grounded&&!wasGrounded},
    ],
    input(time){
      const flying=time>=.72&&time<3.2;
      return {flight:flying,vertical:flying&&time<1.2?1:0,
        forward:flying&&time>=1.45?1:0,yaw:time>=2.14?.9:0};
    }},
  'estudio-aceleracion':{label:'Vuelo rápido y regreso a flotación',duration:7,u:.002,v:.245,wet:false,
    chapters:[
      {id:'ground',label:'Apoyo en tierra',when:({frame,grounded})=>frame===0&&grounded},
      {id:'lift',label:'Despegue',when:({input,grounded})=>input.flight&&!grounded},
      {id:'hover',label:'Vuelo en el lugar',when:({input,grounded})=>input.flight&&!grounded&&!input.vertical&&!input.forward},
      {id:'cruise',label:'Vuelo normal',when:({input})=>input.flight&&input.forward&&!input.sprint},
      {id:'boost',label:'Entrar en vuelo rápido',when:({input,previousInput})=>input.flight&&input.sprint&&!previousInput.sprint},
      {id:'fast',label:'Vuelo rápido',when:({input,time})=>input.sprint&&time>=2.64},
      {id:'release',label:'Soltar la aceleración',when:({input,previousInput})=>input.flight&&!input.sprint&&previousInput.sprint},
      {id:'float',label:'Volver a flotar',when:({input,time})=>input.flight&&!input.forward&&time>=4.46},
      {id:'turn',label:'Inicio del giro',when:({input,previousInput})=>input.flight&&input.yaw!==previousInput.yaw},
      {id:'land',label:'Contacto con el suelo',when:({input,grounded,wasGrounded})=>!input.flight&&grounded&&!wasGrounded},
    ],
    input(time){
      const flying=time>=.72&&time<5.10;
      return {flight:flying,vertical:flying&&time<1.2?1:0,
        forward:flying&&time>=1.45&&time<4.46?1:0,sprint:flying&&time>=2.22&&time<3.50,yaw:time>=2.90?.9:0};
    }},
  'estudio-nado':{label:'Remada, inmersión y ascenso',duration:6,u:.0155,v:.26,wet:true,
    input(time){
      return {forward:time>=.55?1:0,yaw:time>=3.4?1.05:0,
        vertical:time>=1.9&&time<2.95?-1:time>=3.5&&time<4.8?1:0};
    }},
  'estudio-marcha':{label:'Marcha, frenada y reposo',duration:3.2,u:.002,v:.245,walking:true,wet:false,
    chapters:[
      {id:'ground',label:'Apoyo en tierra',when:({frame,grounded})=>frame===0&&grounded},
      {id:'walk',label:'Inicio de marcha',when:({input,grounded})=>input.forward>0&&grounded},
      {id:'brake',label:'Soltar el paso',when:({input,previousInput,grounded})=>!input.forward&&previousInput.forward>0&&grounded},
      {id:'settled',label:'Reposo tras la frenada',when:({time,speed,grounded})=>time>=walkRelease&&speed<.14&&grounded},
    ],
    input(time){return {forward:time>=.55&&time<walkRelease?1:0};}},
});

function relevantNodes(mesh){
  const nodes=[mesh];
  mesh.traverse(node=>{if(node.isBone)nodes.push(node);});
  return nodes;
}

/** Sample the same active pose adapter as the game. The turntable follows
 * translation so the player can inspect the rig at a fixed camera distance. */
export function createHumanMotionStudy(template,stock,scenario,walkingClip){
  if(scenario.walking&&!walkingClip)throw Error('Walking study needs the live walking clip');
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
  const blend=scenario.walking?new MotionMixer(AnimationState.idle):null;
  const walking=blend?mixer.clipAction(walkingClip).play():null;
  const manager={loadedCharacters:new Map([[0,{character:subject}]]),update(_,dt){
    subject.position.copy(actor.position);
    toroidalRotation(actor.position,motion.yaw,subject.quaternion);
    mixer.update(dt);
  }};
  let input={};
  const unbind=bindFlightAvatarAnimation(manager,()=>({
    outdoor:true,flying:Boolean(input.flight),boosting:Boolean(input.flight&&input.sprint&&input.forward),grounded:motion.grounded,glanceMotion:true,
  }));
  const nodes=relevantNodes(mesh);
  const count=Math.round(scenario.duration*motionStudyRate);
  const samples=new Float32Array((count+1)*(5+7*nodes.length));
  const rotation=new Quaternion(),dt=1/motionStudyRate;
  let offset=0;
  const chapters=[],landmarks=[],pending=new Set(scenario.chapters);
  try{
    for(let frame=0;frame<=count;frame++){
      const previousInput=input,wasGrounded=motion.grounded;
      const time=frame*dt;
      input=scenario.input(time);
      if(frame&&Object.keys({...previousInput,...input}).some(key=>input[key]!==previousInput[key]))landmarks.push(frame);
      if(frame)motion.update(dt,input);
      const pose=motion.pose().position;
      const speed=Math.hypot(motion.ringSpeed,motion.crossSpeed);
      for(const chapter of pending){
        if(!chapter.when({frame,time,input,previousInput,grounded:motion.grounded,wasGrounded,speed}))continue;
        chapters.push({id:chapter.id,label:chapter.label,frame});
        pending.delete(chapter);
      }
      actor.position.set(pose.x,pose.y,pose.z);
      if(blend){
        const {idle:rest,walking:walk}=AnimationState;
        blend.setTargetState(input.forward?walk:rest);
        blend.update(frame?dt:0);
        actor.animationState=blend.getPrimaryState();
        actor.animationWeights=blend.getWeights();
        const times=blend.getAnimationTimes();
        idle.time=times[rest]%stock.duration;
        walking.time=times[walk]%walkingClip.duration;
        idle.setEffectiveWeight(actor.animationWeights[rest]);
        walking.setEffectiveWeight(actor.animationWeights[walk]);
      }else{
        actor.animationState=motion.grounded?0:4;
        actor.animationWeights[0]=Number(motion.grounded);
        idle.setEffectiveWeight(actor.animationWeights[0]);
      }
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
  return {count,chapters,landmarks,apply(target,offsetTarget,frame){
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
