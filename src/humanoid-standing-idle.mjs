import {Euler,Quaternion} from 'three';
import {keyed} from './avatar-motion-curves.mjs';

// Upper-body accents over the locomotion mixer. The hips and foot chains
// stay with the mixer, including on sloped and radial ground.
const names=['spine_02','spine_05','neck_01','head','clavicle_l','clavicle_r','upperarm_l','lowerarm_l','upperarm_r','lowerarm_r'];
// Each phrase is [seconds, [chest pitch yaw roll, head pitch yaw roll,
// left arm lift and flex, right arm lift and flex, shoulder rise]].
const none=[0,0,0,0,0,0,0,0,0,0,0];
const phrases=[
  // A long look to one side, a beat, then past centre before settling.
  {length:5.6,keys:[[0,none],[.34,[0,0,0,.05,-.06,0,0,0,0,0,0]],[.86,[0,.10,0,-.05,.44,.03,0,0,0,0,.02]],
    [1.9,[-.01,.15,.01,-.07,.48,.04,0,0,0,0,.02]],[2.5,[0,-.04,0,.04,-.18,-.02,0,0,0,0,0]],
    [2.95,[.01,-.10,0,.02,-.36,-.03,0,0,0,0,0]],[4.1,[.01,-.12,-.01,.01,-.38,-.03,0,0,0,0,0]],[5.0,[0,.01,0,-.01,.03,0,0,0,0,0,0]],[5.6,none]]},
  // Lift a hand, consider it, let it fall.
  {length:4.8,keys:[[0,none],[.28,[.02,0,0,.06,.04,0,0,0,.10,.12,0]],[.95,[.05,-.06,0,.30,-.22,-.02,0,0,.62,1.16,.03]],
    [1.5,[.05,-.06,0,.33,-.22,-.05,0,0,.60,1.24,.03]],[2.0,[.06,-.07,0,.30,-.24,.02,0,0,.64,1.10,.03]],
    [2.9,[.05,-.06,0,.32,-.22,-.02,0,0,.62,1.18,.03]],[3.35,[-.05,.02,0,-.12,.06,0,0,0,.26,.50,.05]],[4.1,[-.01,0,0,-.04,.01,0,0,0,.03,.08,-.01]],[4.8,none]]},
  // Draw a full breath, roll the shoulders and drop them.
  {length:4.2,keys:[[0,none],[.9,[-.10,0,0,-.12,0,0,.10,.06,.10,.06,.15]],[1.35,[-.11,0,.01,-.13,.02,.05,.12,.08,.12,.08,.17]],
    [2.0,[.07,0,0,.12,0,-.04,.01,.02,.01,.02,-.05]],[2.7,[.05,0,0,.10,0,-.09,0,0,0,0,-.04]],[3.3,[.02,0,0,.02,0,.06,0,0,0,0,0]],[4.2,none]]},
  // Shift through the waist and settle the other way.
  {length:5.0,keys:[[0,none],[.7,[.02,.08,.07,0,-.10,-.07,.02,.06,.06,.16,.02]],[1.9,[.02,.09,.07,-.02,-.16,-.06,.02,.06,.06,.18,.02]],
    [2.7,[.01,-.07,-.06,.02,.10,.06,.06,.14,.02,.05,.02]],[3.9,[.01,-.08,-.06,-.02,.14,.05,.06,.16,.02,.05,.02]],[5.0,none]]},
];
const scatter=index=>{const x=Math.sin(index*78.233+1.618)*43758.5453;return x-Math.floor(x);};

export function bindHumanoidStandingIdle(mesh){
  const skeleton=mesh.getObjectByProperty('isSkinnedMesh',true)?.skeleton;
  const joints=names.map(name=>skeleton?.getBoneByName(name));
  if(joints.some(bone=>!bone))return null;
  const neutral=joints.map(()=>new Quaternion());
  const reference=new Quaternion(),frame=new Quaternion(),inverse=new Quaternion(),delta=new Quaternion(),angles=new Euler(0,0,0,'YXZ');
  const gesture=new Array(11);
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

  // Alternate rest and gesture. Each avatar keeps its own order and spacing.
  let start=0,index=0,pick=null,last=-1;
  function choose(dwell,phase){
    const seed=Math.floor(phase);
    gesture.fill(0);
    if(dwell<last||!pick){
      index=0;
      start=3.4+2.2*scatter(seed);
      pick=phrases[Math.floor(scatter(seed+.7)*phrases.length)];
    }
    last=dwell;
    if(dwell>=start+pick.length){
      index++;
      start=dwell+3.2+4.6*scatter(index+17.3+seed);
      const following=phrases.filter(phrase=>phrase!==pick);
      pick=following[Math.floor(scatter(index*3.1+seed)*following.length)];
    }else if(dwell>start)keyed(pick.keys,dwell-start,gesture);
  }

  return {
    apply(character,time,weight,dwell=0,phase=0){
      joints.forEach((bone,index)=>neutral[index].copy(bone.quaternion));
      character.getWorldQuaternion(reference).normalize();
      choose(dwell,phase);
      const [chestPitch,chestYaw,chestRoll,headPitch,headYaw,headRoll,leftLift,leftFlex,rightLift,rightFlex,shrug]=gesture;
      const breath=Math.sin(time*1.65);
      const shoulder=Math.sin(time*.89);
      const glance=Math.sin(time*.65)**7;
      rotate(0,chestPitch*.5,chestYaw*.5,chestRoll*.5,weight);
      rotate(1,.016*breath+chestPitch*.5,chestYaw*.5,.009*shoulder+chestRoll*.5,weight);
      rotate(2,-.009*breath+headPitch*.35,headYaw*.35,-.006*shoulder+headRoll*.35,weight);
      rotate(3,-.007*breath+.009*glance+headPitch*.65,.088*glance+headYaw*.65,-.003*shoulder+headRoll*.65,weight);
      rotate(4,-.014*breath,0,-.013*breath-.010*shoulder+shrug,weight);
      rotate(5,-.014*breath,0,.013*breath-.010*shoulder-shrug,weight);
      rotate(6,-leftLift,0,0,weight);
      rotate(7,-leftFlex,0,0,weight);
      rotate(8,-rightLift,0,0,weight);
      rotate(9,-rightFlex,0,0,weight);
      applied=true;
    },
    restore(){
      if(!applied)return;
      joints.forEach((bone,index)=>bone.quaternion.copy(neutral[index]));
      applied=false;
    },
  };
}
