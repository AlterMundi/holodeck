import {Quaternion,Ray,Vector3} from 'three';

const NEAR=.1; // Matches the MML Three.js main camera.
const CLEARANCE=.07;

// MML's collision pass follows the previous boom direction. Recheck the new
// frame after orbit/zoom, including the corners of the rendered near plane.
export function constrainInteriorCamera({coreCameraManager:camera,collisionsManager},getRoom){
  const update=camera.update.bind(camera);
  const rotation=new Quaternion();
  const back=new Vector3(),right=new Vector3(),up=new Vector3(),focus=new Vector3();
  const ray=new Ray(),destination=new Vector3();
  const samples=[[0,0],[-1,-1],[-1,1],[1,-1],[1,1]];
  let lastRoom,lastDistance;

  camera.update=(...args)=>{
    update(...args);
    const room=getRoom();
    if(!room||camera.isFlyCameraOn()){
      lastRoom=lastDistance=undefined;
      return;
    }
    const {position,rotation:q,fov,aspect}=camera.getMainCameraState();
    const boom=camera.distance;
    if(!Number.isFinite(boom)||boom<=NEAR||!Number.isFinite(aspect)||aspect<=0)return;
    rotation.set(q.x,q.y,q.z,q.w);
    back.set(0,0,1).applyQuaternion(rotation);
    right.set(1,0,0).applyQuaternion(rotation);
    up.set(0,1,0).applyQuaternion(rotation);
    focus.set(position.x,position.y,position.z).addScaledVector(back,-boom);
    ray.origin.copy(focus);
    const halfHeight=NEAR*Math.tan(fov*Math.PI/360);
    let limit=boom;
    for(const [x,y] of samples){
      const length=destination.copy(back).multiplyScalar(boom)
        .addScaledVector(right,x*halfHeight*aspect).addScaledVector(up,y*halfHeight).length();
      ray.direction.copy(destination).multiplyScalar(1/length);
      const hit=collisionsManager.raycastFirst(ray,length+CLEARANCE);
      if(hit)limit=Math.min(limit,Math.max(NEAR,(hit[0]-CLEARANCE)*boom/length));
    }
    if(room!==lastRoom||lastDistance===undefined||limit<=lastDistance)lastDistance=limit;
    else lastDistance=Math.min(limit,lastDistance+.18);
    lastRoom=room;
    position.set(focus.x+back.x*lastDistance,focus.y+back.y*lastDistance,focus.z+back.z*lastDistance);
  };
}
