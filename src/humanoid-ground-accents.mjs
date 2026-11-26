import {Euler,Quaternion} from 'three';

// Lean and lead with the trunk. The pelvis and legs keep the mixer's contacts.
export function bindHumanoidGroundAccents(mesh){
  const skeleton=mesh.getObjectByProperty('isSkinnedMesh',true)?.skeleton;
  const find=list=>list.map(name=>skeleton?.getBoneByName(name)).filter(Boolean);
  const trunk=find(['spine_01','spine_02','spine_03','spine_04']),neck=find(['neck_01','head']);
  if(!trunk.length||!neck.length)return null;
  const joints=[...trunk,...neck],neutral=joints.map(()=>new Quaternion());
  const body=new Quaternion(),inverse=new Quaternion(),parent=new Quaternion();
  const turn=new Quaternion(),share=new Quaternion(),angles=new Euler(0,0,0,'YXZ');
  let applied=false;
  function bend(chain,pitch,yaw,roll){
    const part=1/chain.length;
    turn.setFromEuler(angles.set(pitch*part,yaw*part,roll*part)).premultiply(body).multiply(inverse);
    for(const joint of chain){
      joint.parent.getWorldQuaternion(parent);
      share.copy(parent).invert().multiply(turn).multiply(parent);
      joint.quaternion.premultiply(share);
    }
  }
  return {
    apply(character,pitch,yaw,roll,headPitch=0){
      if(applied||Math.abs(pitch)+Math.abs(yaw)+Math.abs(roll)+Math.abs(headPitch)<.002)return;
      joints.forEach((joint,index)=>neutral[index].copy(joint.quaternion));
      character.getWorldQuaternion(body);
      inverse.copy(body).invert();
      bend(trunk,pitch,yaw*.6,roll);
      // Keep the eyes on the line of travel while the chest works.
      bend(neck,headPitch-pitch*.65,yaw*.4,-roll*.6);
      applied=true;
    },
    restore(){
      if(!applied)return;
      joints.forEach((joint,index)=>joint.quaternion.copy(neutral[index]));
      applied=false;
    },
  };
}
