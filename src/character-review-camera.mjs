import {Matrix4,Quaternion,Ray,Vector3} from 'three';
import {MatterFlight,matterAvatarScale,matterEyeHeight} from './matter-flight.mjs';
import {MatterContact} from './matter-contact.mjs';

// Both projections use the same framing, expressed in units of the web rig.
export const characterReviewCamera=Object.freeze({
  rigHeight:1.48,fov:36,front:0,angle:.62,side:Math.PI/2,
  eyeHeight:1.95,targetHeight:.78,tableTargetHeight:.69,distance:4.4,compactDistance:4.7,
  minDistance:2.2,maxDistance:8,maxPolarAngle:Math.PI*.56,
});

export const matterInspectionCamera=Object.freeze({
  startAtEye:true,minDistance:.22,maxDistance:2.2,maxPolarAngle:Math.PI/2,
});

const up=new Vector3(0,1,0);
const reviewCameraFields=['fov','targetFOV','minFOV','maxFOV','maxPolarAngle','zoomScale'];

export class CharacterReviewFlight extends MatterFlight{
  constructor(camera){
    super(camera);
    this.focus=new Vector3();
    this.previousFeet=new Vector3();
    this.requestedFeet=new Vector3();
    this.eye=new Vector3();
    this.look=new Matrix4();
    this.orientation=new Quaternion();
    this.contactEye=new Vector3();
    this.roomRay=new Ray();
    this.translateBy=new Vector3();
    this.forward=new Vector3();
    this.matterContact=new MatterContact();
  }

  set reviewTarget(target){
    this.reviewAnchor=target?this.focus.copy(target):null;
  }

  get reviewTarget(){return this.reviewAnchor;}

  enter(controller,bench,{reviewTarget=null,reviewScale=matterAvatarScale,cameraProfile=characterReviewCamera,inspectParts=null}={}){
    if(!super.enter(controller,bench,{reviewTarget}))return false;
    if(!reviewTarget)return true;
    const {startAtEye,minDistance,maxDistance,maxPolarAngle,fov,angle,distance,eyeHeight,targetHeight}=cameraProfile;
    for(const field of reviewCameraFields)this.cameraRanges[field]=this.camera[field];
    const farthest=maxDistance*(startAtEye?1:matterAvatarScale);
    if(startAtEye){
      this.requestedFeet.copy(controller.config.position);
    }else{
      const height=eyeHeight-targetHeight;
      const expectedRadius=Math.min(Math.hypot(distance,height)*reviewScale,farthest);
      const expectedPhi=Math.atan2(distance,height);
      // Frame the displayed rig from a legal tabletop eye point.
      this.requestedFeet.setFromSphericalCoords(expectedRadius,expectedPhi,angle).add(this.reviewAnchor);
      this.requestedFeet.y-=matterEyeHeight;
    }
    const feet=this.resolvePosition(controller,this.requestedFeet);
    this.inspectParts=startAtEye?inspectParts:null;
    this.eye.copy(feet).sub(this.reviewAnchor);
    this.eye.y+=matterEyeHeight;
    const radius=this.eye.length();
    const theta=Math.atan2(this.eye.z,this.eye.x);
    const phi=Math.atan2(Math.hypot(this.eye.x,this.eye.z),this.eye.y);
    const lens=startAtEye?this.cameraRanges.fov:fov;
    Object.assign(this.camera,{fov:lens,targetFOV:lens,minFOV:lens,maxFOV:lens,maxPolarAngle,
      minDistance:minDistance*(startAtEye?1:matterAvatarScale),
      maxDistance:startAtEye?Math.max(radius,farthest):farthest,theta,targetTheta:theta,phi,targetPhi:phi,
      distance:radius,targetDistance:radius,desiredDistance:radius});
    if(!startAtEye&&Number.isFinite(this.cameraRanges.zoomScale)){
      this.camera.zoomScale=this.cameraRanges.zoomScale*matterAvatarScale;
    }
    controller.config.position.copy(feet);
    return true;
  }

  exit(controller){
    super.exit(controller);
    this.inspectParts=null;
  }

  resolvePosition(controller,position){
    const feet=super.resolvePosition(controller,position);
    this.inspectionLimited=false;
    if(!this.inspectParts)return feet;
    const from=this.contactEye.copy(controller.config.position);
    from.y+=matterEyeHeight;
    this.eye.copy(feet);
    this.eye.y+=matterEyeHeight;
    const length=this.roomRay.direction.subVectors(this.eye,from).length();
    if(length<1e-6)return feet;
    this.roomRay.set(from,this.roomRay.direction.divideScalar(length));
    const clearance=controller.capsuleInfo.radius*matterAvatarScale;
    const wall=controller.config.collisionsManager.raycastFirst?.(this.roomRay,length+clearance);
    const roomFraction=wall?Math.max(0,Math.min(1,(wall[0]-clearance)/length)):1;
    const fraction=Math.min(roomFraction,this.matterContact.limit(this.inspectParts(),from,this.eye,this.camera));
    if(fraction<1){
      this.inspectionLimited=feet.distanceToSquared(controller.config.position)*(1-fraction)**2>1e-8;
      feet.lerp(controller.config.position,1-fraction);
    }
    return feet;
  }

  syncInspectionOrbit(eye,distance){
    this.forward.subVectors(this.reviewAnchor,eye).normalize();
    const radius=Math.min(this.camera.maxDistance,Math.max(this.camera.minDistance,distance));
    if(radius!==distance)this.reviewAnchor.copy(eye).addScaledVector(this.forward,radius);
    const theta=Math.atan2(-this.forward.z,-this.forward.x);
    const phi=Math.acos(Math.max(-1,Math.min(1,-this.forward.y)));
    Object.assign(this.camera,{theta,targetTheta:theta,phi,targetPhi:phi,
      distance:radius,targetDistance:radius,desiredDistance:radius});
  }

  translateInspection(controller,x,y,inward=0){
    if(!this.inspectParts||controller!==this.returnPose?.controller)return;
    const {fov,aspect,rotation}=this.camera.getMainCameraState();
    this.orientation.copy(rotation);
    const height=Math.tan(fov*Math.PI/360);
    this.forward.set(0,0,-1).applyQuaternion(this.orientation);
    this.translateBy.set(x*height*aspect,y*height,-inward);
    if(inward){
      this.translateBy.x*=inward;
      this.translateBy.y*=inward;
    }else{
      this.translateBy.multiplyScalar(this.camera.distance);
    }
    this.requestedFeet.copy(controller.config.position).add(this.translateBy.applyQuaternion(this.orientation));
    const feet=this.resolvePosition(controller,this.requestedFeet);
    const progress=this.translateBy.subVectors(feet,controller.config.position).dot(this.forward);
    const distance=Math.max(this.camera.minDistance,Math.min(this.camera.maxDistance,this.camera.distance-progress));
    this.reviewAnchor.copy(feet).addScaledVector(this.forward,distance);
    this.reviewAnchor.y+=matterEyeHeight;
    this.contactEye.copy(feet);
    this.contactEye.y+=matterEyeHeight;
    this.syncInspectionOrbit(this.contactEye,distance);
    controller.config.position.copy(feet);
  }

  dollyInspection(controller,delta,x,y,hit){
    const {position,rotation}=this.camera.getMainCameraState();
    this.forward.set(0,0,-1).applyQuaternion(rotation);
    const depth=hit?.point?this.translateBy.copy(hit.point).sub(position).dot(this.forward):this.camera.distance;
    const step=Math.max(-.24,Math.min(.24,Math.max(.12,depth)*-Math.expm1(delta*.0018)));
    if(Math.abs(step)>1e-5)this.translateInspection(controller,x,y,step);
  }

  move(controller,seconds,inputAllowed){
    const feet=controller.config.position;
    this.previousFeet.copy(feet);
    super.move(controller,seconds,inputAllowed);
    if(this.reviewAnchor)this.reviewAnchor.add(this.previousFeet.subVectors(feet,this.previousFeet));
  }

  placeReviewEye(state,controller){
    if(!this.reviewAnchor||!this.active||controller!==this.returnPose?.controller)return;
    const {position:feet,quaternion}=controller.config;
    // Orbit and dolly drive the miniature through the same tabletop colliders
    // as keyboard movement. The rendered view starts at its resolved eyes.
    this.requestedFeet.copy(state.position);
    this.requestedFeet.y-=matterEyeHeight;
    this.resolvePosition(controller,this.requestedFeet);
    this.eye.copy(this.point);
    this.eye.y+=matterEyeHeight;
    if(this.eye.distanceToSquared(this.reviewAnchor)<1e-8)return;
    if(this.inspectionLimited)this.syncInspectionOrbit(this.eye,this.eye.distanceTo(this.reviewAnchor));
    feet.copy(this.point);
    state.position.set(this.eye.x,this.eye.y,this.eye.z);
    this.orientation.setFromRotationMatrix(this.look.lookAt(this.eye,this.reviewAnchor,up));
    state.rotation.set(this.orientation.x,this.orientation.y,this.orientation.z,this.orientation.w);
    this.yaw=Math.atan2(this.reviewAnchor.x-this.eye.x,this.reviewAnchor.z-this.eye.z);
    quaternion.setFromAxisAngle(up,this.yaw);
    controller.updateNetworkState();
  }

  setReviewAngle(angle){
    if(!this.reviewAnchor)return;
    const {distance,eyeHeight,targetHeight}=characterReviewCamera;
    this.camera.setOrbitAngle(Math.PI/2-angle);
    this.camera.targetPhi=Math.atan2(distance,eyeHeight-targetHeight);
  }
}
