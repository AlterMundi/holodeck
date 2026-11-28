import {Quaternion,Vector3} from 'three';
import {clamp} from './avatar-motion-curves.mjs';

// Resolve where the body travels relative to where it faces. Sideways and
// diagonal travel turn the hips and legs into the line of travel while the
// chest and head stay mostly with the view; past the side the legs face the
// other way and the gait runs in reverse, so the body backs away.
const BACK_ENTER=1.95,BACK_LEAVE=1.25; // radians of travel off the facing
const LEG_LIMIT=1.62;

export function travelAngle(right,forward){
  return Math.atan2(right,forward);
}

// Lower body yaw for a travel angle, with hysteresis around the side.
export function gaitDirection(angle,wasBackward=false,leaveBackward=BACK_LEAVE){
  const back=Math.abs(angle);
  const backward=wasBackward?back>leaveBackward:back>BACK_ENTER;
  const turned=backward?angle-Math.sign(angle||1)*Math.PI:angle;
  return {backward,hips:clamp(turned,-LEG_LIMIT,LEG_LIMIT)};
}

export function bindHumanoidDirectionalGait(mesh){
  const skeleton=mesh.getObjectByProperty('isSkinnedMesh',true)?.skeleton;
  const find=names=>names.map(name=>skeleton?.getBoneByName(name)).filter(Boolean);
  const [pelvis]=find(['pelvis']);
  const spine=find(['spine_01','spine_02','spine_03','spine_04','spine_05']);
  const neck=find(['neck_01','head']);
  if(!pelvis||spine.length<3||!neck.length)return null;
  const joints=[pelvis,...spine,...neck],neutral=joints.map(()=>new Quaternion());
  const body=new Quaternion(),inverse=new Quaternion(),parent=new Quaternion();
  const turn=new Quaternion(),share=new Quaternion(),up=new Vector3(0,1,0);
  let applied=false;
  // Turn a chain about the body's own up axis, shared over its joints.
  function twist(chain,angle){
    if(!angle)return;
    turn.setFromAxisAngle(up,angle/chain.length).premultiply(body).multiply(inverse);
    for(const joint of chain){
      joint.parent.getWorldQuaternion(parent);
      share.copy(parent).invert().multiply(turn).multiply(parent);
      joint.quaternion.premultiply(share);
    }
  }
  return {
    // hips: yaw of the legs off the facing. The chest keeps a third of it
    // and the head a tenth, so the look stays on the view.
    apply(character,hips){
      if(applied||Math.abs(hips)<.002)return;
      joints.forEach((joint,index)=>neutral[index].copy(joint.quaternion));
      character.getWorldQuaternion(body);
      inverse.copy(body).invert();
      twist([pelvis],hips);
      twist(spine,-hips*.68);
      twist(neck,-hips*.22);
      applied=true;
    },
    restore(){
      if(!applied)return;
      joints.forEach((joint,index)=>joint.quaternion.copy(neutral[index]));
      applied=false;
    },
  };
}
