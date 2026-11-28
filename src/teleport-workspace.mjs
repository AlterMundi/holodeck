import {Group, Matrix4, PerspectiveCamera, Quaternion, Ray, Vector3} from 'three';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const movement=new Set(['KeyA','KeyD','KeyW','KeyS','Space','AltLeft','AltRight','ShiftLeft','ShiftRight']);

export class TeleportWorkspace {
  constructor(invalidate,anchor){
    this.invalidate=invalidate;
    this.readAnchor=anchor;
    this.camera=new PerspectiveCamera(48,1,.075,10000);
    this.place=new Group();
    this.place.name='Invoked teleport station';
    this.keys=new Set();
    this.localEye=new Vector3();
    this.eye=new Vector3();
    this.focus=new Vector3();
    this.from=new Vector3();
    this.aim=new Vector3();
    this.ray=new Ray();
    this.savedPosition=new Vector3();
    this.savedRotation=new Quaternion();
  }

  enter(group,scene){
    const anchor=this.readAnchor();
    if(!anchor||!scene)return false;
    const {feet,up,forward,colliders}=anchor;
    this.colliders=colliders;
    const from=feet.clone().addScaledVector(up,.86);
    const direction=forward.clone();
    const chosen=[0,.63,-.63,1.21,-1.21,Math.PI].some(angle=>{
      direction.copy(forward).applyAxisAngle(up,angle);
      return [2.8,2.15,1.5].some(distance=>{
        this.ray.set(from,direction);
        if(colliders?.raycastFirst(this.ray,distance+.25))return false;
        this.place.position.copy(feet).addScaledVector(direction,distance);
        this.initialDistance=distance;
        return true;
      });
    });
    if(!chosen)return false;
    const right=new Vector3().crossVectors(direction,up).normalize();
    const z=direction.clone().negate();
    this.ray.set(this.place.position.clone().addScaledVector(up,.85),up.clone().negate());
    const floor=colliders?.raycastFirst(this.ray,1.85);
    if(floor)this.place.position.copy(this.ray.at(floor[0],this.eye));
    this.place.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right,up,z));
    this.camera.up.copy(up);
    scene.add(this.place);
    this.group=group;
    this.place.add(group);
    group.matrixAutoUpdate=true;
    group.position.set(0,1.65,0);
    group.rotation.set(0,0,0);
    group.scale.setScalar(.88);
    this.place.updateMatrixWorld(true);
    this.focus.set(0,.96,.10);
    this.place.localToWorld(this.focus);
    this.reset();
    return true;
  }

  leave(parent){
    if(this.group&&parent)parent.add(this.group);
    this.place.removeFromParent();
    this.group=null;
    this.clearInput();
    this.drag=null;
  }

  clearInput(){this.keys.clear();this.lastFrame=null;}

  reset(){
    this.localEye.set(0,1.52,this.initialDistance);
    this.pitchOffset=0;
    this.lastFrame=null;
    // Aim from the existing world position. Back off slightly on tall displays.
    const target=this.localEye.clone();
    target.z=Math.max(this.initialDistance,Math.min(4.4,2.65/(this.aspect??1)));
    this.tryPosition(target);
    this.updateCamera();
  }

  resize(aspect){
    if(this.aspect===aspect)return;
    this.aspect=aspect;
    this.camera.aspect=aspect;
    this.camera.updateProjectionMatrix();
  }

  tryPosition(next){
    const radius=Math.hypot(next.x,next.z);
    const limited=clamp(radius,1.15,5);
    if(radius<.0001)return;
    next.x*=limited/radius;next.z*=limited/radius;
    next.y=clamp(next.y,.52,3.25);
    this.from.copy(this.localEye);this.place.localToWorld(this.from);
    this.eye.copy(next);this.place.localToWorld(this.eye);
    const distance=this.ray.direction.subVectors(this.eye,this.from).length();
    if(distance>.0001){
      this.ray.origin.copy(this.from);
      this.ray.direction.multiplyScalar(1/distance);
      if(this.colliders?.raycastFirst(this.ray,distance+.16))return;
    }
    this.localEye.copy(next);
  }

  updateCamera(){
    this.eye.copy(this.localEye);this.place.localToWorld(this.eye);
    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.aim.copy(this.focus).addScaledVector(this.camera.up,this.pitchOffset));
    this.camera.updateMatrixWorld(true);
    this.invalidate();
  }

  orbit(dx,dy){
    const next=this.localEye.clone();
    const angle=Math.atan2(next.x,next.z)+dx;
    const radius=Math.hypot(next.x,next.z);
    next.set(Math.sin(angle)*radius,next.y+dy*3.5,Math.cos(angle)*radius);
    this.tryPosition(next);
    this.updateCamera();
  }

  approach(amount){
    const next=this.localEye.clone(),newDistance=Math.exp(amount);
    next.x*=newDistance;next.z*=newDistance;
    this.tryPosition(next);
    this.updateCamera();
  }

  key(event,down){
    if(!movement.has(event.code)||down&&(event.metaKey||event.ctrlKey))return false;
    if(down)this.keys.add(event.code);else this.keys.delete(event.code);
    return true;
  }

  advance(now){
    const dt=this.lastFrame===null?0:Math.min(.045,(now-this.lastFrame)/1000);
    this.lastFrame=now;
    if(!this.keys.size||!dt)return;
    const forward=Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'));
    const strafe=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
    const lift=Number(this.keys.has('Space'))-Number(this.keys.has('AltLeft')||this.keys.has('AltRight'));
    const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3.2:1.75;
    const forwardAxis=new Vector3(-this.localEye.x,0,-this.localEye.z).normalize();
    const rightAxis=new Vector3(-forwardAxis.z,0,forwardAxis.x);
    const direction=forwardAxis.multiplyScalar(forward).addScaledVector(rightAxis,strafe);
    direction.y=lift;
    if(direction.lengthSq()){
      this.tryPosition(this.localEye.clone().addScaledVector(direction.normalize(),dt*speed));
      this.updateCamera();
    }
  }

  withCamera(main,draw){
    this.savedPosition.copy(main.position);
    this.savedRotation.copy(main.quaternion);
    const savedFov=main.fov;
    main.position.copy(this.camera.position);
    main.quaternion.copy(this.camera.quaternion);
    main.fov=this.camera.fov;
    main.updateProjectionMatrix();
    main.updateMatrixWorld(true);
    try{return draw();}
    finally{
      main.position.copy(this.savedPosition);
      main.quaternion.copy(this.savedRotation);
      main.fov=savedFov;
      main.updateProjectionMatrix();
      main.updateMatrixWorld(true);
    }
  }
}
