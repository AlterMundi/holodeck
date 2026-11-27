import {Quaternion,Ray,Vector3} from 'three';

const NEAR=.1; // Matches the MML Three.js main camera.
const CLEARANCE=.07;
// Avoid framing the avatar inside its close-range screen-door fade.
const EYE_ENTER=.72;
const EYE_EXIT=.98;

// MML's collision pass follows the previous boom direction. Recheck the new
// frame after orbit/zoom, including the corners of the rendered near plane.
export function constrainInteriorCamera({coreCameraManager:camera,collisionsManager},getRoom,firstPerson=()=>false,getArrival=()=>null){
  const update=camera.update.bind(camera);
  const adjust=camera.adjustCameraPosition;
  if(adjust)camera.adjustCameraPosition=function(...args){
    if(firstPerson()||getRoom())this.targetDistance=this.desiredDistance;
    else adjust.apply(this,args);
  };
  const rotation=new Quaternion();
  const back=new Vector3(),right=new Vector3(),up=new Vector3(),focus=new Vector3();
  const ray=new Ray(),destination=new Vector3();
  const samples=[[0,0],[-1,-1],[-1,1],[1,-1],[1,1]];
  let lastRoom,lastDistance,eyeView=false;

  function eyeFrustumIsClear(halfHeight,aspect){
    for(const [x,y] of samples){
      destination.copy(back).multiplyScalar(-NEAR)
        .addScaledVector(right,x*halfHeight*aspect).addScaledVector(up,y*halfHeight);
      const length=destination.length();
      ray.set(focus,destination.multiplyScalar(1/length));
      if(collisionsManager.raycastFirst(ray,length+CLEARANCE))return false;
    }
    return true;
  }

  camera.update=(...args)=>{
    update(...args);
    const room=getRoom();
    if(firstPerson()||!room||camera.isFlyCameraOn()){
      lastRoom=lastDistance=undefined;
      eyeView=false;
      return;
    }
    const {position,rotation:q,fov,aspect}=camera.getMainCameraState();
    const boom=camera.distance;
    if(!Number.isFinite(boom)||boom<=0||!Number.isFinite(aspect)||aspect<=0)return;
    rotation.set(q.x,q.y,q.z,q.w);
    back.set(0,0,1).applyQuaternion(rotation);
    right.set(1,0,0).applyQuaternion(rotation);
    up.set(0,1,0).applyQuaternion(rotation);
    if(camera.target)focus.copy(camera.target);
    else focus.set(position.x,position.y,position.z).addScaledVector(back,-boom);
    const halfHeight=NEAR*Math.tan(fov*Math.PI/360);
    let limit=boom;
    for(const [x,y] of samples){
      destination.copy(focus).addScaledVector(right,x*halfHeight*aspect).addScaledVector(up,y*halfHeight);
      ray.set(destination,back);
      const hit=collisionsManager.raycastFirst(ray,boom+CLEARANCE);
      if(hit)limit=Math.min(limit,Math.max(0,hit[0]-CLEARANCE));
    }
    // Door art and its physics representation can be mounted separately.
    // Keep the boom on the receiving side of the threshold during arrival.
    const arrival=getArrival();
    if(arrival){
      const heading=arrival.yaw*Math.PI/180;
      const inwardX=Math.sin(heading),inwardZ=Math.cos(heading);
      const dx=focus.x-arrival.x,dz=focus.z-arrival.z;
      const inward=dx*inwardX+dz*inwardZ;
      const lateral=dx*inwardZ-dz*inwardX;
      const towardDoor=-back.x*inwardX-back.z*inwardZ;
      if(Math.abs(lateral)<1.3&&inward>-.55&&inward<2.6&&towardDoor>.05){
        limit=Math.min(limit,Math.max(0,inward+.62)/towardDoor);
      }
    }
    if(room!==lastRoom)eyeView=false;
    if(room!==lastRoom||lastDistance===undefined||limit<=lastDistance)lastDistance=limit;
    else lastDistance=Math.min(limit,lastDistance+.18);
    lastRoom=room;

    // Keep the orbit (and its movement heading) intact. Zoom alone keeps
    // its usual behavior. A retracted boom can temporarily render at the
    // eye only if every corner of the actual forward near plane is clear.
    const blocked=limit<boom-1e-4;
    const useEye=eyeView?lastDistance<EYE_EXIT&&(blocked||boom>EYE_ENTER)
      :blocked&&limit<EYE_ENTER;
    eyeView=useEye&&eyeFrustumIsClear(halfHeight,aspect);
    if(eyeView){
      position.set(focus.x,focus.y,focus.z);
      return;
    }
    position.set(focus.x+back.x*lastDistance,focus.y+back.y*lastDistance,focus.z+back.z*lastDistance);
  };
}
