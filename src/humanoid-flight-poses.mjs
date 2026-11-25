import {Euler,Matrix4,Quaternion,Vector3} from 'three';
import {keyed} from './avatar-motion-curves.mjs';

// Original keyed phrases. Directions use the Y-up body frame for the left
// side. The right side mirrors across X before retargeting to the skeleton.
// Lanes: upper arm, forearm, thigh, calf, foot, spine and head. The last two
// hold pitch, yaw and roll in radians. Times are seconds, repeats are holds.
const pose=(upper,fore,thigh,calf,foot,spine=[0,0,0],head=[0,0,0])=>[...upper,...fore,...thigh,...calf,...foot,...spine,...head];
const drift=[
  pose([.33,-.93,.13],[.15,-.82,.55],[.10,-.93,.36],[.05,-.92,-.38],[.02,-.58,.81],[.05,.05,.02],[-.04,-.04,-.01]),
  pose([.42,-.90,.02],[.22,-.90,.37],[.08,-.99,.08],[.04,-.97,-.24],[0,-.70,.71],[.09,0,-.02],[-.08,.02,.01]),
  pose([.50,-.86,.06],[.24,-.80,.55],[.11,-.99,-.02],[.05,-.95,-.31],[.02,-.78,.62],[.04,-.06,-.02],[-.03,.05,.02]),
  pose([.40,-.91,.12],[.13,-.80,.58],[.10,-.96,.25],[.04,-.91,-.41],[.02,-.64,.77],[.08,-.01,.02],[-.07,-.03,-.01]),
];
const sweep=[
  pose([.66,-.56,-.50],[.66,-.45,-.60],[.08,-.98,-.20],[.04,-.97,-.24],[0,-.90,.44],[-.04,0,.02],[-.40,0,-.02]),
  pose([.72,-.48,-.50],[.72,-.36,-.60],[.06,-.99,-.12],[.03,-.95,-.32],[0,-.92,.40],[-.08,.03,0],[-.36,-.02,0]),
  pose([.68,-.54,-.49],[.68,-.44,-.59],[.08,-.97,-.24],[.04,-.98,-.18],[0,-.88,.47],[-.04,0,-.02],[-.40,0,.02]),
  pose([.62,-.60,-.50],[.62,-.50,-.61],[.07,-.98,-.17],[.04,-.96,-.28],[0,-.90,.44],[-.02,-.03,0],[-.42,.02,0]),
];
const coil=pose([.30,-.86,-.42],[.18,-.95,-.24],[.13,-.84,.53],[.10,-.79,-.61],[0,-.12,.99],[.34,0,0],[-.22,0,0]);
const spring=pose([.28,-.94,-.18],[.16,-.98,-.12],[.07,-.99,-.08],[.04,-.99,-.12],[0,-.95,.31],[-.16,0,0],[-.26,0,0]);
const tuck=pose([.54,-.76,.36],[.24,-.60,.76],[.13,-.72,.68],[.08,-.78,-.62],[.02,-.50,.86],[.14,0,0],[-.12,0,0]);
const flare=pose([.72,-.60,.34],[.42,-.50,.76],[.14,-.82,.55],[.08,-.88,-.47],[0,.05,1],[-.12,0,0],[.10,0,0]);
const reachDown=pose([.60,-.78,.16],[.40,-.82,.42],[.11,-.95,.28],[.06,-.98,-.16],[0,.02,1],[-.04,0,0],[.14,0,0]);
const brake=pose([.50,-.82,.28],[.30,-.70,.64],[.10,-.99,.05],[.06,-.99,-.08],[0,-.1,1],[.10,0,0],[-.06,0,0]);
const rest=pose([.24,-.97,.05],[.14,-.96,.24],[.10,-.99,.02],[.06,-.99,-.08],[0,-.1,1]);
const tread=[
  pose([.56,-.80,.20],[.42,-.55,.72],[.16,-.80,.58],[.14,-.90,-.42],[.06,-.60,.80],[.07,.05,.03],[-.05,-.04,-.02]),
  pose([.72,-.68,.12],[.70,-.52,.50],[.24,-.82,.52],[.24,-.96,.10],[.16,-.45,.88],[.05,.02,-.02],[-.03,-.01,.01]),
  pose([.64,-.76,.12],[.60,-.68,.42],[.18,-.94,.28],[-.08,-.99,.06],[.02,-.62,.78],[.07,-.05,-.03],[-.05,.04,.02]),
  pose([.46,-.86,.22],[.16,-.62,.77],[.14,-.90,.40],[.04,-.82,-.57],[.02,-.72,.69],[.09,-.02,.02],[-.07,.01,-.01]),
];
// Reach and hold, catch, press, gather under the chest, then kick and shoot.
const long=pose([.17,.86,.48],[.07,.93,.36],[.07,-.99,-.08],[.04,-.99,-.10],[0,-.97,.24],[-.05,0,0],[-.50,0,0]);
const stroke=[
  [0,long],[.62,long],
  [.92,pose([.68,.55,.48],[.62,.42,.66],[.08,-.99,-.04],[.04,-.98,-.18],[0,-.95,.31],[-.09,0,0],[-.56,0,0])],
  [1.18,pose([.78,-.20,.58],[.34,-.46,.82],[.10,-.98,.16],[.06,-.93,-.36],[0,-.88,.47],[-.14,0,0],[-.66,0,0])],
  [1.44,pose([.32,-.74,.58],[-.05,.30,.95],[.30,-.70,.64],[.20,-.42,-.88],[.26,-.30,.60],[-.05,0,0],[-.50,0,0])],
  [1.68,pose([.14,.34,.93],[.03,.74,.67],[.36,-.86,.35],[.30,-.86,-.40],[.24,-.60,.76],[.02,0,0],[-.40,0,0])],
  [1.90,pose([.16,.82,.54],[.07,.92,.38],[.12,-.99,.02],[.08,-.99,-.08],[0,-.92,.38],[-.03,0,0],[-.50,0,0])],
];
const wade=[
  pose([.82,-.52,.22],[.60,-.10,.79],[.1,-1,0],[.05,-1,0],[0,-.1,1],[.08,.06,0],[-.05,-.04,0]),
  pose([.76,-.60,.02],[.64,-.20,.74],[.1,-1,0],[.05,-1,0],[0,-.1,1],[.08,0,0],[-.05,0,0]),
  pose([.80,-.56,.12],[.62,-.14,.77],[.1,-1,0],[.05,-1,0],[0,-.1,1],[.08,-.06,0],[-.05,.04,0]),
];
const even=(poses,seconds)=>poses.map((value,index)=>[index*seconds/poses.length,value]);
const clips={
  hover:{keys:even(drift,3.8),loop:3.8,alternate:true},
  glide:{keys:even(sweep,2.2),loop:2.2,alternate:true},
  lift:{keys:[[0,rest],[.07,coil],[.12,coil],[.24,spring],[.34,spring],[.52,tuck],[.72,drift[0]]]},
  descend:{keys:[[0,drift[1]],[.20,flare],[.42,flare],[.80,reachDown]]},
  land:{keys:[[0,reachDown],[.10,brake],[.18,brake],[.46,rest]]},
  tread:{keys:even(tread,1.8),loop:1.8,alternate:true},
  stroke:{keys:stroke,loop:2.15},
  wade:{keys:even(wade,1.3),loop:1.3,alternate:true},
};

const torso=['pelvis','spine_01','spine_02','spine_03','spine_04','spine_05',
  'neck_01','neck_02','head','clavicle_l','clavicle_r'];
const tracks=[
  ['upperarm','lowerarm'],['lowerarm','hand'],
  ['thigh','calf'],['calf','foot'],['foot','ball'],
];

export function bindHumanoidFlightRig(mesh){
  let skeleton;
  mesh.traverse(object=>{if(!skeleton&&object.isSkinnedMesh)skeleton=object.skeleton;});
  if(!skeleton)return null;
  const indexes=new Map(skeleton.bones.map((bone,index)=>[bone,index]));
  const joints=new Map(skeleton.bones.map(bone=>[bone.name,bone]));
  const position=new Vector3(),scale=new Vector3();
  const modelBind=new Matrix4(),localBind=new Matrix4();
  function binding(bone){
    const index=indexes.get(bone),parent=indexes.get(bone?.parent);
    if(index===undefined||parent===undefined)return null;
    modelBind.copy(skeleton.boneInverses[index]).invert();
    const rotation=new Quaternion(),restPosition=new Vector3().setFromMatrixPosition(modelBind);
    modelBind.decompose(position,rotation,scale);
    localBind.multiplyMatrices(skeleton.boneInverses[parent],modelBind);
    const restLocal=new Quaternion(),restOffset=new Vector3();
    localBind.decompose(restOffset,restLocal,scale);
    return {bone,rotation,restPosition,restLocal,restOffset,
      previous:new Quaternion(),previousOffset:new Vector3()};
  }
  const body=torso.map(name=>binding(joints.get(name))).filter(Boolean);
  for(const bone of skeleton.bones){
    if(/^(hand|upperarm_twist|lowerarm_twist|thigh_twist|calf_twist)_/.test(bone.name)){
      const item=binding(bone);
      if(item)body.push(item);
    }
  }
  for(const item of body){
    const name=item.bone.name;
    item.group=/^(pelvis|thigh|calf)/.test(name)?'lower':/^(hand|upperarm|lowerarm|clavicle)/.test(name)?'arm':'torso';
  }
  const limbs=['l','r'].map(side=>tracks.map(([start,end])=>{
    const item=binding(joints.get(start+'_'+side));
    const tip=binding(joints.get(end+'_'+side));
    if(!item||!tip)return null;
    const span=tip.restPosition.sub(item.restPosition);
    return {...item,length:span.length(),direction:span.normalize()};
  }));
  if(limbs.some(side=>side.some(item=>!item)))return null;

  const bodyWorld=new Quaternion(),bodyInverse=new Quaternion(),parentWorld=new Quaternion(),target=new Quaternion();
  const direction=new Vector3(),aim=new Vector3();
  const hinge=new Vector3(),cross=new Vector3(),projected=new Vector3();
  const swing=new Quaternion();
  const sideAxis=new Vector3(),normal=new Vector3(),basis=new Matrix4();
  function frame(forward,result){
    sideAxis.set(1,0,0).addScaledVector(forward,-forward.x).normalize();
    normal.crossVectors(sideAxis,forward);
    basis.makeBasis(sideAxis,forward,normal);
    return result.setFromRotationMatrix(basis);
  }
  for(const side of limbs){
    for(const limb of side){
      limb.restFrameInverse=frame(limb.direction,new Quaternion()).invert();
      limb.frameOffset=limb.restFrameInverse.clone().multiply(limb.rotation);
      limb.aim=new Vector3();
      limb.drawn=new Vector3();
    }
    for(const lane of [1,3]){
      side[lane].hinge=new Vector3().crossVectors(side[lane-1].direction,side[lane].direction).normalize();
    }
  }
  const modified=[];
  function applyTransform(item,rotation,weight){
    const {bone,previous,previousOffset,restOffset}=item;
    previous.copy(bone.quaternion);
    previousOffset.copy(bone.position);
    bone.quaternion.slerp(rotation,weight);
    bone.position.lerp(restOffset,weight);
    modified.push(item);
  }
  const sides=[new Array(21),new Array(21)],mixed=new Array(21);
  const at=(name,time,side)=>time+(clips[name].alternate&&side?clips[name].loop/2:0);
  function sample(name,time){
    for(const [side,out] of sides.entries())keyed(clips[name].keys,at(name,time,side),out,clips[name].loop);
  }
  function blend(name,time,amount){
    if(amount<=0)return;
    for(const [side,out] of sides.entries()){
      keyed(clips[name].keys,at(name,time,side),mixed,clips[name].loop);
      for(let index=0;index<out.length;index++)out[index]+=(mixed[index]-out[index])*amount;
    }
  }
  const spine=['spine_01','spine_02','spine_03','spine_04','spine_05'].map(name=>joints.get(name)).filter(Boolean);
  const neck=['neck_01','neck_02','head'].map(name=>joints.get(name)).filter(Boolean);
  const accent=new Quaternion(),share=new Quaternion(),angles=new Euler(0,0,0,'YXZ');
  // Turn a chain in the body frame, spread over its joints from the base up.
  function bendChain(chain,pitch,yaw,roll,amount){
    if(!chain.length||amount<=0)return;
    const part=amount/chain.length;
    accent.setFromEuler(angles.set(pitch*part,yaw*part,roll*part)).premultiply(bodyWorld).multiply(bodyInverse);
    for(const bone of chain){
      bone.parent.getWorldQuaternion(parentWorld);
      share.copy(parentWorld).invert().multiply(accent).multiply(parentWorld);
      bone.quaternion.premultiply(share);
    }
  }
  const shoulder=new Vector3(),waterUp=new Vector3();
  // Rotate an aim toward the bed until the far joint is under the surface.
  function submerge(forward,height,length,ceiling){
    const limit=Math.max(-.97,Math.min(.97,(ceiling-height)/length));
    const along=forward.dot(waterUp);
    if(along<=limit)return height+along*length;
    forward.addScaledVector(waterUp,-along);
    if(forward.lengthSq()<1e-4)forward.set(0,0,1).addScaledVector(waterUp,-waterUp.z);
    forward.setLength(Math.sqrt(1-limit*limit)).addScaledVector(waterUp,limit);
    return height+limit*length;
  }
  return {
    restore(){
      for(let index=modified.length-1;index>=0;index--){
        const {bone,previous,previousOffset}=modified[index];
        bone.quaternion.copy(previous);
        bone.position.copy(previousOffset);
      }
      modified.length=0;
    },
    reset(){
      for(const limb of limbs.flat())limb.aim.set(0,0,0);
    },
    // water is {up, point} in world space while hands must stay submerged.
    apply(character,{mode,time,forward=0,weight,lowerWeight=weight,torsoWeight=weight,step,bank=0,
      stroke:strokeWeight=0,strokeTime=time,water=null}){
      if(weight<=0&&lowerWeight<=0)return;
      const name=mode==='swim'?'tread':clips[mode]?mode:'hover';
      sample(name,time);
      if(name==='hover')blend('glide',time,forward);
      if(name==='tread')blend('stroke',strokeTime,strokeWeight);
      for(const item of body){
        const amount=item.group==='lower'?lowerWeight:item.group==='arm'?weight:torsoWeight;
        if(amount>0)applyTransform(item,item.restLocal,amount);
      }
      character.getWorldQuaternion(bodyWorld);
      bodyInverse.copy(bodyWorld).invert();
      const [values]=sides;
      bendChain(spine,values[15],values[16]+bank*.55,values[17]+bank*.30,torsoWeight);
      bendChain(neck,values[18],values[19]+bank*.50,values[20]-bank*.45,torsoWeight);
      const size=character.getWorldScale(shoulder).x;
      if(water)waterUp.copy(water.up).applyQuaternion(bodyInverse);
      for(let side=0;side<limbs.length;side++){
        let height=0;
        if(water){
          limbs[side][0].bone.getWorldPosition(shoulder).sub(water.point);
          height=shoulder.dot(water.up)/size;
        }
        for(let lane=0;lane<tracks.length;lane++){
          const item=limbs[side][lane];
          direction.fromArray(sides[side],lane*3);
          // Reach along the outer wing and fold the inner one into the turn.
          if(lane<2)direction.y+=(side?-1:1)*bank*.75;
          if(side===1)direction.x=-direction.x;
          direction.normalize();
          if(item.aim.lengthSq()<.001)item.aim.copy(direction);
          else item.aim.lerp(direction,1-Math.exp(-step*18)).normalize();
          aim.copy(item.aim);
          if(item.hinge){
            const parent=limbs[side][lane-1];
            swing.copy(frame(parent.drawn,target)).multiply(parent.restFrameInverse);
            hinge.copy(item.hinge).applyQuaternion(swing);
            projected.copy(aim).addScaledVector(hinge,-aim.dot(hinge)).normalize();
            cross.crossVectors(parent.drawn,projected);
            const flex=Math.atan2(cross.dot(hinge),parent.drawn.dot(projected));
            aim.copy(parent.drawn).applyAxisAngle(hinge,Math.max(.10,Math.min(lane===1?1.9:2.0,flex)));
          }
          if(water&&lane<2)height=submerge(aim,height,item.length,lane===1?-.12:Math.max(-.06,height-.86*item.length));
          item.drawn.copy(aim);
          const amount=lane<2?weight:lowerWeight;
          if(amount<=0)continue;
          item.bone.parent.getWorldQuaternion(parentWorld);
          frame(aim,target).multiply(item.frameOffset)
            .premultiply(bodyWorld).premultiply(parentWorld.invert());
          applyTransform(item,target,amount);
        }
      }
    },
  };
}
