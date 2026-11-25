import {Euler,Quaternion} from 'three';

// Upper-body accents over the locomotion mixer. The hips and foot chains
// stay with the mixer, including on sloped and radial ground.
export function bindHumanoidStandingIdle(mesh){
  const skeleton=mesh.getObjectByProperty('isSkinnedMesh',true)?.skeleton;
  const joints=['spine_05','neck_01','head','clavicle_l','clavicle_r'].map(name=>skeleton?.getBoneByName(name));
  if(joints.some(bone=>!bone))return null;
  const neutral=joints.map(()=>new Quaternion());
  const reference=new Quaternion(),frame=new Quaternion(),inverse=new Quaternion(),delta=new Quaternion(),angles=new Euler();
  let applied=false;

  function rotate(index,pitch,yaw,roll,weight){
    const joint=joints[index];
    // Conjugate the authored body-space accent into this joint's current
    // frame. The two humanoid rigs use different local joint axes.
    joint.getWorldQuaternion(frame).normalize().invert().multiply(reference);
    inverse.copy(frame).invert();
    delta.setFromEuler(angles.set(pitch*weight,yaw*weight,roll*weight));
    joint.quaternion.multiply(frame.multiply(delta).multiply(inverse));
  }

  return {
    apply(character,time,weight){
      joints.forEach((bone,index)=>neutral[index].copy(bone.quaternion));
      character.getWorldQuaternion(reference).normalize();
      const breath=Math.sin(time*1.65);
      const shoulder=Math.sin(time*.89);
      const glance=Math.sin(time*.65)**7;
      rotate(0,.016*breath,0,.009*shoulder,weight);
      rotate(1,-.009*breath,0,-.006*shoulder,weight);
      rotate(2,-.007*breath+.009*glance,.088*glance,-.003*shoulder,weight);
      rotate(3,-.014*breath,0,-.013*breath-.010*shoulder,weight);
      rotate(4,-.014*breath,0,.013*breath-.010*shoulder,weight);
      applied=true;
    },
    restore(){
      if(!applied)return;
      joints.forEach((bone,index)=>bone.quaternion.copy(neutral[index]));
      applied=false;
    },
  };
}
