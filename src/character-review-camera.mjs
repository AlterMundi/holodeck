import {Matrix4,Quaternion,Vector3} from 'three';
import {MatterFlight,matterAvatarScale,matterEyeHeight} from './matter-flight.mjs';

// Both projections use the same framing, expressed in units of the web rig.
export const characterReviewCamera=Object.freeze({
  rigHeight:1.48,fov:36,front:0,angle:.62,side:Math.PI/2,
  eyeHeight:1.95,targetHeight:.78,distance:4.4,compactDistance:4.7,
  minDistance:2.2,maxDistance:8,maxPolarAngle:Math.PI*.56,
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
  }

  set reviewTarget(target){
    this.reviewAnchor=target?this.focus.copy(target):null;
  }

  get reviewTarget(){return this.reviewAnchor;}

  enter(controller,bench,{reviewTarget=null}={}){
    if(!super.enter(controller,bench,{reviewTarget}))return false;
    if(!reviewTarget)return true;
    for(const field of reviewCameraFields)this.cameraRanges[field]=this.camera[field];
    const {distance,eyeHeight,targetHeight,minDistance,maxDistance,maxPolarAngle,fov,angle}=characterReviewCamera;
    const radius=Math.hypot(distance,eyeHeight-targetHeight)*matterAvatarScale;
    Object.assign(this.camera,{fov,targetFOV:fov,minFOV:fov,maxFOV:fov,maxPolarAngle,minDistance:minDistance*matterAvatarScale,maxDistance:maxDistance*matterAvatarScale,
      distance:radius,targetDistance:radius,desiredDistance:radius});
    if(Number.isFinite(this.cameraRanges.zoomScale))this.camera.zoomScale=this.cameraRanges.zoomScale*matterAvatarScale;
    this.setReviewAngle(angle);
    this.camera.theta=this.camera.targetTheta;
    this.camera.phi=this.camera.targetPhi;
    return true;
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
