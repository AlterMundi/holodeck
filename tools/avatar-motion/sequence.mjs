// One continuous route through the runtime modules: real locomotion, stock
// clips, human presentation and the companion controller. Samples what would
// be drawn. Usage: node sequence.mjs [avatar.glb] [out.json] [fps]
import {writeFileSync} from 'node:fs';
import {Matrix4,Quaternion,Vector3} from 'three';
import {humanAvatar,loadCompanion,presentation,stockLocomotion} from './rig.mjs';
import {bindFlightAvatarAnimation} from '../../src/flight-avatar-animation.mjs';
import {ToroidalLocomotion,toroidalRotation} from '../../src/toroidal-locomotion.mjs';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation,terrainPosition,terrainWaterDepth} from '../../src/toroidal-terrain.mjs';

const {waterLevel}=TOROIDAL_TERRAIN;
// [name, seconds, input, stop early when]
export const ROUTE=[
  ['idle',3,{}],
  ['walk',2.4,{forward:1,yaw:0}],
  ['run-turn',2.2,{forward:1,yaw:1.5,sprint:true}],
  ['stop',1.4,{yaw:1.5}],
  ['crouch',1.4,{yaw:1.5,crouch:true}],
  ['crouch-walk',1.4,{forward:1,yaw:1.5,crouch:true}],
  ['jump',1.5,{forward:1,yaw:1.5,jump:true}],
  ['settle',.8,{yaw:1.5}],
  ['launch',1.2,{yaw:1.5,flight:true,vertical:1}],
  ['hover',2.4,{yaw:1.5,flight:true}],
  ['glide',2.6,{forward:1,yaw:1.5,flight:true,sprint:true}],
  ['bank',1.8,{forward:1,yaw:0,flight:true,sprint:true}],
  ['flare',1.4,{yaw:0,flight:true}],
  ['descend',4,{yaw:0},m=>m.grounded],
  ['touchdown',1.4,{yaw:0}],
  ['shore',40,{forward:1,yaw:0,sprint:true},m=>terrainWaterDepth(m.u,m.v)>.5,{u:.0155,v:.234}],
  ['wade',20,{forward:1,yaw:0},m=>m.height<waterLevel-.90],
  ['surface-swim',5,{forward:1,yaw:0}],
  ['tread',2.6,{yaw:0}],
  ['surface-turn',2,{forward:1,yaw:1}],
  ['dive',2,{forward:1,yaw:1,vertical:-1}],
  ['submerged',3,{forward:1,yaw:1}],
  ['drift',2,{yaw:1}],
  ['ascend',4,{forward:1,yaw:1,vertical:1},m=>!m.swimming],
  ['return',60,{forward:1,yaw:0,sprint:true},m=>terrainWaterDepth(m.u,m.v)===0&&m.v>.26],
  ['ashore',2,{yaw:0}],
];

export async function runSequence({file='avatar-1-bodyA-skin01.glb',fps=60,reduced=false,start={u:.002,v:.245},onFrame=()=>{},peer=false}={}){
  const {root,mesh}=humanAvatar(file);
  const {mixer,clips}=await stockLocomotion(mesh);
  const document=presentation({reduced});
  const {avatar,scene}=await loadCompanion({document});
  scene.add(root);
  let motion=new ToroidalLocomotion(start);
  const rotation=new Quaternion();
  const actor={position:new Vector3(),animationState:0,animationWeights:{0:1}};
  const state={characters:new Map([[1,actor]]),localCharacterId:peer?99:1};
  const weights={idle:1,jog:0,run:0,air:0};
  let input={},planar=0,last=null;
  const peerPoses=new Map();
  const manager={loadedCharacters:new Map([[1,{character:root}]]),update(_,dt){
    const pose=motion.pose();
    root.position.set(pose.position.x,pose.position.y,pose.position.z);
    root.quaternion.copy(toroidalRotation(pose.position,pose.rotation.eulerY,rotation));
    if(last)planar+=(Math.min(12,root.position.distanceTo(last)/dt)-planar)*.25;
    last=root.position.clone();
    const aloft=input.flight||motion.swimming||!motion.grounded;
    const goal=aloft?'air':planar>6.4?'run':planar>.5?'jog':'idle';
    actor.animationState=aloft?4:goal==='run'?2:goal==='jog'?1:0;
    for(const name of Object.keys(weights)){
      weights[name]+=(Number(name===goal)-weights[name])*(1-Math.exp(-dt*9));
      clips[name].setEffectiveWeight(weights[name]);
    }
    actor.animationWeights={0:weights.idle};
    clips.jog.setEffectiveTimeScale(Math.max(.4,planar/5));
    mixer.update(dt);
  }};
  let clockTime=0;
  const release=bindFlightAvatarAnimation(manager,()=>({outdoor:true,flying:Boolean(input.flight),grounded:motion.grounded,
    crouch:Boolean(input.crouch&&motion.grounded),peerPoses,glanceMotion:!reduced}),{clock:()=>clockTime});
  let time=0;
  const cost={human:0,companion:0,frames:0};
  for(const [name,seconds,controls,until,place] of ROUTE){
    if(place)motion=new ToroidalLocomotion(place);
    let phase=0;
    while(phase<seconds){
      const dt=1/fps;
      input=controls;
      motion.update(dt,{...controls,crouch:Boolean(controls.crouch)});
      const pose=motion.pose();
      actor.position.set(pose.position.x,pose.position.y,pose.position.z);
      if(controls.flight)peerPoses.set(1,'fly');
      else if(controls.crouch&&motion.grounded)peerPoses.set(1,'crouch');
      else peerPoses.delete(1);
      clockTime+=dt*1000;
      let began=performance.now();
      manager.update(state,dt);
      cost.human+=performance.now()-began;
      const wet=motion.swimming?'submerged':motion.atSwimSurface()?'surface':null;
      began=performance.now();
      avatar.update({position:actor.position.clone(),yaw:pose.rotation.eulerY,outdoor:true,table:null,visible:true,seconds:dt,
        water:wet,explicitFlight:Boolean(controls.flight),grounded:!controls.flight&&motion.grounded,crouch:Boolean(controls.crouch)});
      cost.companion+=performance.now()-began;cost.frames++;
      time+=dt;phase+=dt;
      scene.updateMatrixWorld(true);
      onFrame({name,phase,time,dt,motion,root,mesh,actor,avatar,input:controls});
      if(until?.(motion))break;
    }
  }
  release();
  return {time,cost:{human:cost.human/cost.frames,companion:cost.companion/cost.frames}};
}

// Skinning transforms in a local frame with its origin at the player's feet.
export function drawnSkeleton(root,local){
  let skinned;
  root.traverse(object=>{if(!skinned&&object.isSkinnedMesh)skinned=object;});
  const {bones,boneInverses}=skinned.skeleton;
  return Object.fromEntries(bones.map((bone,index)=>[bone.name,
    new Matrix4().multiplyMatrices(local,bone.matrixWorld).multiply(boneInverses[index]).elements.map(v=>+v.toFixed(5))]));
}

export function localPatch(position,local,size=15,step=.8){
  const {u,v}=terrainCoordinates(position.toArray());
  const ground=[];
  const inverse=local.clone().invert(),point=new Vector3();
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    point.set((i-(size-1)/2)*step,0,(j-(size-1)/2)*step).applyMatrix4(inverse);
    const at=terrainCoordinates(point.toArray());
    point.fromArray(terrainPosition(at.u,at.v,terrainElevation(at.u,at.v))).applyMatrix4(local);
    ground.push(point.toArray().map(value=>+value.toFixed(3)));
  }
  point.fromArray(terrainPosition(u,v,waterLevel)).applyMatrix4(local);
  return {size,ground,water:+point.y.toFixed(3),depth:terrainWaterDepth(u,v)};
}

export function localFrame(actor){
  const position=new Vector3().copy(actor.position);
  return new Matrix4().compose(position,toroidalRotation(actor.position,0),new Vector3(1,1,1)).invert();
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [,,file='avatar-1-bodyA-skin01.glb',out,fps='60']=process.argv;
  const frames=[],taken=new Map();
  const shots={idle:[.5,2.6],walk:[.6,1,1.4,1.8],'run-turn':[.15,.3,.5,.9,1.3],stop:[.1,.2,.4,.9],crouch:[.2,.9],'crouch-walk':[.6,1],
    jump:[.15,.35,.62,.75,1.1],launch:[.08,.2,.35,.55,.9],hover:[.6,1.4,2.2],glide:[.4,.9,1.8],bank:[.12,.28,.45,.7,1.1],flare:[.2,.5,1.0],
    descend:[.15,.4,.7],touchdown:[.04,.10,.18,.3,.5,.9],shore:[1.5,1.7],wade:[.16,.5,1.2,2.4],'surface-swim':[.15,.4,.8,1.4,2.2,2.6,3,3.4,3.8],tread:[.3,.8,1.4,2.2],
    'surface-turn':[.3,.7],dive:[.2,.5,1,1.6],submerged:[.6,1,1.4,1.8,2.2],drift:[.6,1.4],ascend:[.5,1.2],ashore:[.3,1.2]};
  const result=await runSequence({file,fps:Number(fps),onFrame({name,phase,root,actor,avatar,dt}){
    const index=taken.get(name)??0;
    if(!(phase>=(shots[name]?.[index]??Infinity)))return;
    taken.set(name,index+1);
    const local=localFrame(actor);
    frames.push({name:`${name}-${index}`,human:drawnSkeleton(root,local),robot:drawnSkeleton(avatar.figure.root,local),...localPatch(actor.position,local)});
  }});
  console.log(JSON.stringify(result));
  if(out)writeFileSync(out,JSON.stringify({file,frames}));
}
