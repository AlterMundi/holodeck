import {Matrix4,Quaternion,Vector3} from 'three';

// Each keyed attitude gives directions in the Y-up body frame. Left/right
// limbs mirror across X before retargeting against the actual skeleton.
const hover=[
  [[.30,-.94,.10],[.13,-.83,.54],[.09,-.97,.13],[.03,-.99,-.18],[0,-.26,1]],
  [[.37,-.92,.04],[.11,-.86,.48],[.11,-.96,.24],[.04,-.98,-.23],[0,-.31,1]],
];
const glide=[
  [[.71,-.49,-.51],[.79,-.35,-.51],[.10,-.97,-.14],[.05,-.99,-.14],[0,-.60,.8]],
  [[.66,-.52,-.53],[.77,-.42,-.51],[.09,-.97,-.12],[.05,-.97,-.20],[0,-.57,.8]],
];
const lift=[
  [[.22,-.96,.1],[.10,-.93,.34],[.09,-.98,.05],[.03,-.99,-.11],[0,-.08,1]],
  [[.44,-.83,.26],[.17,-.71,.63],[.12,-.91,.36],[.07,-.93,-.35],[0,-.4,1]],
  hover[0],
];
const descend=[
  [[.52,-.78,.24],[.26,-.72,.54],[.13,-.97,.12],[.08,-.97,-.12],[0,-.03,1]],
  [[.38,-.89,.10],[.28,-.83,.44],[.12,-.97,.07],[.07,-.99,-.03],[0,0,1]],
];
const land=[
  descend[1],
  [[.28,-.91,.25],[.14,-.85,.45],...descend[1].slice(2)],
  [[.23,-.97,.07],[.11,-.94,.29],...descend[1].slice(2)],
];
const swim=[
  [[.38,.06,.92],[.23,.29,.92],[.09,-.98,-.12],[.06,-.98,-.16],[0,-.75,.62]],
  [[.82,-.39,.36],[.65,-.45,.58],[.09,-.99,.1],[.07,-.95,-.29],[0,-.72,.65]],
  [[.36,-.91,-.18],[.19,-.94,-.19],[.11,-.96,-.23],[.05,-.99,-.05],[0,-.83,.61]],
  [[.48,-.56,.68],[.23,.40,.89],[.08,-.97,.14],[.07,-.99,-.13],[0,-.69,.68]],
];

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
  const limbs=['l','r'].map(side=>tracks.map(([start,end])=>{
    const item=binding(joints.get(start+'_'+side));
    const tip=binding(joints.get(end+'_'+side));
    if(!item||!tip)return null;
    return {...item,direction:tip.restPosition.sub(item.restPosition).normalize()};
  }));
  if(limbs.some(side=>side.some(item=>!item)))return null;

  const bodyWorld=new Quaternion(),parentWorld=new Quaternion(),target=new Quaternion();
  const direction=new Vector3(),next=new Vector3(),cruise=new Vector3();
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
  function sample(clip,phase,lane,loop,out){
    const last=clip.length-1;
    const at=loop?(phase%1)*clip.length:Math.min(1,Math.max(0,phase))*last;
    const frame=Math.floor(at);
    const following=loop?(frame+1)%clip.length:Math.min(last,frame+1);
    const blend=at-frame;
    return out.fromArray(clip[frame][lane]).lerp(next.fromArray(clip[following][lane]),blend*blend*(3-2*blend));
  }
  return {
    restore(){
      for(const {bone,previous,previousOffset} of modified){
        bone.quaternion.copy(previous);
        bone.position.copy(previousOffset);
      }
      modified.length=0;
    },
    reset(){
      for(const limb of limbs.flat())limb.aim.set(0,0,0);
    },
    apply(character,{mode,time,forward,weight,lowerWeight=weight,step}){
      if(weight<=0&&lowerWeight<=0)return;
      const clip=mode==='lift'?lift:mode==='descend'?descend:mode==='land'?land:mode==='swim'?swim:hover;
      const loop=clip===hover||clip===swim;
      for(const item of body){
        const amount=/^(pelvis|thigh|calf)/.test(item.bone.name)?lowerWeight:weight;
        if(amount>0)applyTransform(item,item.restLocal,amount);
      }
      character.getWorldQuaternion(bodyWorld);
      for(let side=0;side<limbs.length;side++){
        const phase=loop?time+side*.5:time;
        for(let lane=0;lane<tracks.length;lane++){
          const item=limbs[side][lane];
          sample(clip,phase,lane,loop,direction);
          if(clip===hover&&forward>0)direction.lerp(sample(glide,phase,lane,true,cruise),forward);
          if(side===1)direction.x=-direction.x;
          direction.normalize();
          if(item.aim.lengthSq()<.001)item.aim.copy(direction);
          else item.aim.lerp(direction,1-Math.exp(-step*14)).normalize();
          if(item.hinge){
            const parent=limbs[side][lane-1];
            swing.copy(frame(parent.aim,target)).multiply(parent.restFrameInverse);
            hinge.copy(item.hinge).applyQuaternion(swing);
            projected.copy(item.aim).addScaledVector(hinge,-item.aim.dot(hinge)).normalize();
            cross.crossVectors(parent.aim,projected);
            const flex=Math.atan2(cross.dot(hinge),parent.aim.dot(projected));
            item.aim.copy(parent.aim).applyAxisAngle(hinge,Math.max(.10,Math.min(lane===1?1.72:1.50,flex)));
          }
          const amount=lane<2?weight:lowerWeight;
          if(amount<=0)continue;
          item.bone.parent.getWorldQuaternion(parentWorld);
          frame(item.aim,target).multiply(item.frameOffset)
            .premultiply(bodyWorld).premultiply(parentWorld.invert());
          applyTransform(item,target,amount);
        }
      }
    },
  };
}
