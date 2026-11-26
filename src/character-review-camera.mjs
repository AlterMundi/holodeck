import {Vector3} from 'three';
import {MatterFlight,matterAvatarScale} from './matter-flight.mjs';

// Both projections use the same framing, expressed in units of the web rig.
export const characterReviewCamera=Object.freeze({
  rigHeight:1.48,fov:36,front:0,angle:.62,side:Math.PI/2,
  eyeHeight:1.95,targetHeight:.78,distance:4.4,compactDistance:4.7,
  minDistance:2.2,maxDistance:8,maxPolarAngle:Math.PI*.56,
});

const reviewCameraFields=['fov','targetFOV','minFOV','maxFOV','maxPolarAngle','zoomScale'];

export class CharacterReviewFlight extends MatterFlight{
  constructor(camera){
    super(camera);
    this.reviewStart=new Vector3();
    this.followedReviewTarget=new Vector3();
  }

  set reviewTarget(target){this.reviewAnchor=target;}

  get reviewTarget(){
    if(!this.reviewAnchor||!this.active||!this.returnPose)return this.reviewAnchor;
    // Carry the initial framing by the actual miniature travel after collisions.
    const feet=this.returnPose.controller.config.position;
    return this.followedReviewTarget.copy(feet).sub(this.reviewStart).add(this.reviewAnchor);
  }

  enter(controller,bench,{reviewTarget=null,reviewScale=matterAvatarScale}={}){
    if(!super.enter(controller,bench,{reviewTarget}))return false;
    if(!reviewTarget)return true;
    for(const field of reviewCameraFields)this.cameraRanges[field]=this.camera[field];
    this.reviewStart.copy(controller.config.position);
    const {distance,eyeHeight,targetHeight,minDistance,maxDistance,maxPolarAngle,fov,angle}=characterReviewCamera;
    const radius=Math.hypot(distance,eyeHeight-targetHeight)*reviewScale;
    Object.assign(this.camera,{fov,targetFOV:fov,minFOV:fov,maxFOV:fov,maxPolarAngle,minDistance:minDistance*reviewScale,maxDistance:maxDistance*reviewScale,
      distance:radius,targetDistance:radius,desiredDistance:radius});
    if(Number.isFinite(this.cameraRanges.zoomScale))this.camera.zoomScale=this.cameraRanges.zoomScale*reviewScale;
    this.setReviewAngle(angle);
    return true;
  }

  setReviewAngle(angle){
    if(!this.reviewAnchor)return;
    const {distance,eyeHeight,targetHeight}=characterReviewCamera;
    this.camera.setOrbitAngle(Math.PI/2-angle);
    this.camera.targetPhi=Math.atan2(distance,eyeHeight-targetHeight);
  }
}
