import {Quaternion,Vector3} from 'three';

const forwardAxis=new Vector3(0,0,1);
const upAxis=new Vector3(0,1,0);
const rightAxis=new Vector3(1,0,0);

// Lower the hips over the SDK's current footsteps. Solving against the ankle
// positions keeps the stock standing and walking contacts, including yaw.
export function bindHumanoidCrouch(mesh){
  const find=name=>mesh.getObjectByName(name);
  const pelvis=find('pelvis'),spine=find('spine_01');
  const legs=['l','r'].map(side=>({
    hip:find('thigh_'+side),knee:find('calf_'+side),ankle:find('foot_'+side),
    hipPosition:new Vector3(),ankleTarget:new Vector3(),stockKnee:new Vector3(),stockAxis:new Vector3(),stockPole:new Vector3(),
    ankleOrientation:new Quaternion(),
  }));
  if(!pelvis?.isBone||!pelvis.parent||legs.some(({hip,knee,ankle})=>
    !hip?.isBone||!knee?.isBone||!ankle?.isBone||knee.parent!==hip||ankle.parent!==knee))return null;

  const joints=[pelvis,...(spine?.isBone?[spine]:[]),...legs.flatMap(({hip,knee,ankle})=>[hip,knee,ankle])];
  const snapshots=joints.map(joint=>({joint,rotation:new Quaternion(),position:new Vector3()}));
  const bodyOrientation=new Quaternion(),world=new Quaternion(),parent=new Quaternion(),swing=new Quaternion();
  const forward=new Vector3(),up=new Vector3(),right=new Vector3(),point=new Vector3();
  const axis=new Vector3(),pole=new Vector3(),authoredPole=new Vector3(),kneeTarget=new Vector3();
  const from=new Vector3(),to=new Vector3();
  let posed=false;

  function orient(bone,rotation){
    bone.parent.getWorldQuaternion(parent);
    bone.quaternion.copy(parent.invert()).multiply(rotation);
  }
  function aim(bone,child,destination){
    bone.getWorldPosition(point);
    child.getWorldPosition(from).sub(point).normalize();
    to.copy(destination).sub(point).normalize();
    bone.getWorldQuaternion(world);
    world.premultiply(swing.setFromUnitVectors(from,to));
    orient(bone,world);
  }

  return {
    restore(){
      if(!posed)return;
      for(const {joint,rotation,position} of snapshots){
        joint.quaternion.copy(rotation);
        joint.position.copy(position);
      }
      posed=false;
    },
    apply(character,weight){
      if(posed||weight<.002)return;
      let totalLength=0;
      for(const leg of legs){
        leg.hip.getWorldPosition(leg.hipPosition);
        leg.knee.getWorldPosition(leg.stockKnee);
        leg.ankle.getWorldPosition(leg.ankleTarget);
        leg.ankle.getWorldQuaternion(leg.ankleOrientation);
        leg.upper=leg.hipPosition.distanceTo(leg.stockKnee);
        leg.lower=leg.stockKnee.distanceTo(leg.ankleTarget);
        leg.stockAxis.subVectors(leg.ankleTarget,leg.hipPosition).normalize();
        leg.stockPole.subVectors(leg.stockKnee,leg.hipPosition);
        leg.stockPole.addScaledVector(leg.stockAxis,-leg.stockPole.dot(leg.stockAxis));
        if(Math.min(leg.upper,leg.lower)<.001)return;
        totalLength+=leg.upper+leg.lower;
      }
      for(const {joint,rotation,position} of snapshots){
        rotation.copy(joint.quaternion);
        position.copy(joint.position);
      }
      posed=true;
      character.getWorldQuaternion(bodyOrientation);
      up.copy(upAxis).applyQuaternion(bodyOrientation);
      forward.copy(forwardAxis).applyQuaternion(bodyOrientation);
      right.copy(rightAxis).applyQuaternion(bodyOrientation);
      const depth=totalLength*.12*weight*weight;
      pelvis.getWorldPosition(point).addScaledVector(up,-depth).addScaledVector(forward,-depth*.18);
      pelvis.position.copy(pelvis.parent.worldToLocal(point));

      for(const leg of legs){
        leg.hip.getWorldPosition(leg.hipPosition);
        axis.subVectors(leg.ankleTarget,leg.hipPosition);
        const distance=axis.length();
        const chain=leg.upper+leg.lower,epsilon=.0001*chain;
        if(distance<epsilon)continue;
        axis.divideScalar(distance);
        const reach=Math.max(Math.abs(leg.upper-leg.lower)+epsilon,Math.min(distance,chain-epsilon));
        const along=(leg.upper**2+reach**2-leg.lower**2)/(2*reach);
        const bend=Math.sqrt(Math.max(0,leg.upper**2-along**2));
        authoredPole.copy(forward).addScaledVector(axis,-forward.dot(axis));
        if(authoredPole.lengthSq()<.000001)authoredPole.crossVectors(axis,right);
        authoredPole.normalize();
        pole.copy(leg.stockPole).addScaledVector(axis,-leg.stockPole.dot(axis));
        const stockInfluence=Math.min(1,pole.length()/(chain*.006))*(1-Math.min(1,weight*2.5));
        if(pole.dot(authoredPole)>0)pole.normalize().lerp(authoredPole,1-stockInfluence);
        else pole.copy(authoredPole);
        kneeTarget.copy(leg.hipPosition).addScaledVector(axis,along).addScaledVector(pole.normalize(),bend);
        aim(leg.hip,leg.knee,kneeTarget);
        aim(leg.knee,leg.ankle,leg.ankleTarget);
        orient(leg.ankle,leg.ankleOrientation);
      }
      if(spine?.isBone&&spine.parent){
        spine.getWorldQuaternion(world).premultiply(swing.setFromAxisAngle(right,.20*weight));
        orient(spine,world);
      }
    },
  };
}
