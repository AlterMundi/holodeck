import {Quaternion,Vector3} from 'three';

// Feet that meet uneven ground. After the gait and every layered pose, each
// leg is solved analytically (two bones, thigh and calf) so the ankle lands
// on the terrain under it; the body drops just enough for the downhill leg
// to reach, and each foot keeps its animated world orientation. The solve
// is undone at the start of the next frame, like every other layer.

const LEGS=[['thigh_l','calf_l','foot_l'],['thigh_r','calf_r','foot_r']];
const REACH=.3; // metres of ground difference a leg will absorb

const v=()=>new Vector3();
const hip=v(),knee=v(),ankle=v(),target=v(),axis0=v(),axis1=v(),ah=v(),kh=v(),hk=v(),ak=v(),th=v();
const q0=new Quaternion(),q1=new Quaternion(),q2=new Quaternion(),thighWorld=new Quaternion(),calfWorld=new Quaternion(),
  footWorld=new Quaternion(),parentWorld=new Quaternion(),local=new Quaternion();
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b))));

// Rotate a joint by a world-space rotation while keeping it a local edit.
function rotateWorld(bone,rotation,world){
  // local' = local * (world^-1 * rotation * world)
  local.copy(world).invert().multiply(rotation).multiply(world);
  bone.quaternion.multiply(local);
}

export function solveTwoBone(thigh,calf,foot,goal,bendHint){
  thigh.getWorldPosition(hip);calf.getWorldPosition(knee);foot.getWorldPosition(ankle);
  const a=kh.subVectors(knee,hip).length(),b=ak.subVectors(ankle,knee).length();
  if(a<1e-4||b<1e-4)return false;
  const t=Math.max(1e-4,Math.min(a+b-1e-4,th.subVectors(goal,hip).length()));
  foot.getWorldQuaternion(footWorld);
  thigh.getWorldQuaternion(thighWorld);calf.getWorldQuaternion(calfWorld);
  ah.subVectors(ankle,hip).normalize();kh.normalize();hk.subVectors(hip,knee).normalize();ak.normalize();th.normalize();
  const acab0=angle(ah,kh),babc0=angle(hk,ak),acat0=angle(ah,th);
  const acab1=Math.acos(Math.max(-1,Math.min(1,(b*b-a*a-t*t)/(-2*a*t))));
  const babc1=Math.acos(Math.max(-1,Math.min(1,(t*t-a*a-b*b)/(-2*a*b))));
  axis0.crossVectors(ah,kh);
  if(axis0.lengthSq()<1e-8)axis0.copy(bendHint);
  axis0.normalize();
  axis1.crossVectors(ah,th);
  const swing=axis1.lengthSq()>1e-10;
  if(swing)axis1.normalize();
  q0.setFromAxisAngle(axis0,acab1-acab0);
  q1.setFromAxisAngle(axis0,babc1-babc0);
  rotateWorld(thigh,q0,thighWorld);
  rotateWorld(calf,q1,calfWorld);
  if(swing){q2.setFromAxisAngle(axis1,acat0);rotateWorld(thigh,q2,thighWorld);}
  // Keep the animated foot orientation in the world.
  foot.parent.updateWorldMatrix(true,false);
  foot.parent.getWorldQuaternion(parentWorld);
  foot.quaternion.copy(parentWorld.invert().multiply(footWorld));
  return true;
}

export function bindFootPlacement(mesh){
  const legs=LEGS.map(names=>names.map(name=>mesh.getObjectByName(name)))
    .filter(bones=>bones.every(bone=>bone?.isBone));
  if(legs.length!==2||!mesh.getObjectByName('pelvis')?.isBone)return null;
  const saved=legs.flat().map(bone=>({bone,rest:new Quaternion()}));
  // The body drops at the pelvis, so the mixer keeps owning the root.
  const pelvis=mesh.getObjectByName('pelvis');
  const shift=new Vector3(),feet=[new Vector3(),new Vector3()],hint=new Vector3();
  let applied=false;
  return {
    restore(){
      if(!applied)return;
      for(const {bone,rest} of saved)bone.quaternion.copy(rest);
      if(pelvis?.isBone)pelvis.position.sub(shift);
      shift.set(0,0,0);
      applied=false;
    },
    // heightAt(point) gives the ground under a world point relative to the
    // ground under the body, along up. right is the character's lateral axis.
    apply(character,up,right,heightAt,weight){
      if(weight<=.001)return;
      const offsets=legs.map(([, ,foot],index)=>{
        foot.getWorldPosition(feet[index]);
        const d=heightAt(feet[index]);
        return Number.isFinite(d)?Math.max(-REACH,Math.min(REACH,d))*weight:0;
      });
      if(Math.abs(offsets[0])<.004&&Math.abs(offsets[1])<.004)return;
      for(const {bone,rest} of saved)rest.copy(bone.quaternion);
      applied=true;
      // Drop the body so the lower foot can reach; the higher leg bends.
      const drop=Math.max(0,-Math.min(...offsets));
      if(drop>0&&pelvis?.isBone&&pelvis.parent){
        // Move the pelvis along the world up, expressed in its parent's frame.
        const parent=pelvis.parent;
        parent.updateWorldMatrix(true,false);
        const world=pelvis.getWorldPosition(v());
        const before=parent.worldToLocal(world.clone());
        const after=parent.worldToLocal(world.addScaledVector(up,-drop));
        shift.subVectors(after,before);
        pelvis.position.add(shift);
        pelvis.updateMatrixWorld(true);
      }
      for(const [index,[thigh,calf,foot]] of legs.entries()){
        target.copy(feet[index]).addScaledVector(up,offsets[index]);
        // Knees bend forward: the bend axis is the character's right.
        solveTwoBone(thigh,calf,foot,target,hint.copy(right));
        thigh.updateMatrixWorld(true);
      }
    },
  };
}
