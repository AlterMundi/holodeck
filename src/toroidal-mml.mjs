import {Line3, Quaternion, Vector3} from 'three';
import {createAvatarHeadroom} from './avatar-headroom.mjs';
import {createToroidalCameraClearance} from './toroidal-camera-clearance.mjs';
import {ToroidalLocomotion, toroidalRotation} from './toroidal-locomotion.mjs';
import {TOROIDAL_SPAWN, terrainCoordinates, terrainFrame, terrainPosition} from './toroidal-terrain.mjs';

// The MML host still owns input, network cadence, interpolation, avatar
// animation and the orbit camera. Only the selected exterior uses a radial
// surface and reconstructs the world-space orientation from tangent yaw.
export function bindToroidalMml(manager, camera, enabled, flight=()=>false, firstDoor=null, onMovementMode=()=>{}) {
  const updateCharacters = manager.update;
  const updateCamera = camera.update;
  const adjustCamera = camera.adjustCameraPosition;
  const clearance = createToroidalCameraClearance();
  const rotation = new Quaternion();
  const viewRotation = new Quaternion();
  const viewOffset = new Vector3();
  const radialAxis = new Vector3(),right=new Vector3(),side=new Vector3(),feet=new Vector3();
  const headroom=createAvatarHeadroom(),contact=new Vector3();
  const capsule = new Line3();
  const originalStart = new Vector3(),sweepStart=new Vector3(),sweepEnd=new Vector3();
  let motion, lastLocal, lastPosition;

  function walk(controller, seconds) {
    const {position, quaternion, keyInputManager, additionalInputProvider} = controller.config;
    const touch=additionalInputProvider?.getOutput()??null;
    const control = keyInputManager.getOutput() || touch;
    if (lastLocal !== controller || !lastPosition ||
        Math.hypot(position.x - lastPosition.x, position.y - lastPosition.y, position.z - lastPosition.z) > .001) {
      let start = terrainCoordinates([position.x, position.y, position.z]);
      // A cell handoff can leave one planar pose before exterior spawn.
      // The toroidal chart excludes the symmetry axis and tube center.
      if (!Number.isFinite(start.height) || Math.abs(start.height) > 180) {
        start = terrainCoordinates([TOROIDAL_SPAWN.x, TOROIDAL_SPAWN.y, TOROIDAL_SPAWN.z]);
      }
      let yaw=2*Math.atan2(quaternion.y,quaternion.w);
      if(firstDoor){
        const door=firstDoor;
        firstDoor=null;
        if(Math.hypot(position.x-TOROIDAL_SPAWN.x,position.y-TOROIDAL_SPAWN.y,position.z-TOROIDAL_SPAWN.z)<.6){
          const {alongRing,aroundTube}=terrainFrame(start.u,start.v);
          viewOffset.set(door.x-position.x,door.y-position.y,door.z-position.z);
          const along=viewOffset.dot(right.fromArray(alongRing));
          const across=viewOffset.dot(side.fromArray(aroundTube));
          if(Math.hypot(along,across)>1){
            yaw=Math.atan2(along,across);
            // MML input reports forward as PI in its azimuth convention.
            camera.setOrbitAngle(3*Math.PI/2-yaw);
            camera.theta=camera.targetTheta;
          }
        }
      }
      motion = new ToroidalLocomotion({...start,yaw});
    }
    lastLocal = controller;
    const moving = Number.isFinite(control?.direction);
    const yaw = moving ? Math.PI / 2 - camera.theta + control.direction : motion.yaw;
    const flying=flight();
    const wet=motion.atSwimSurface();
    const touchVertical=touch?.vertical??Number(Boolean(touch?.jump));
    const vertical=flying||motion.swimming||wet?
      Math.max(-1,Math.min(1,Number(Boolean(keyInputManager.getJump()))-
        Number(keyInputManager.isKeyPressed('shift'))+touchVertical)):0;
    const jump=!flying&&!motion.swimming&&Boolean(control?.jump||touch?.jump||(wet&&vertical>0));
    const previousHeight=motion.height;
    if(flying)sweepStart.fromArray(terrainPosition(motion.u,motion.v,motion.height));
    motion.update(seconds, {forward: moving ? 1 : 0, yaw,
      sprint:flying?keyInputManager.isKeyPressed('r')||keyInputManager.isKeyPressed('control')||touch?.isSprinting:control?.isSprinting,
      jump,flight:flying,vertical,crouch:!flying&&!wet&&keyInputManager.isKeyPressed('alt')});
    let state = motion.pose();
    const radius = controller.capsuleInfo.radius;
    const height = controller.capsuleInfo.segment.end.y;
    let point = state.position;
    toroidalRotation(point,0,rotation);
    radialAxis.set(0,1,0).applyQuaternion(rotation);
    right.set(1,0,0).applyQuaternion(rotation);
    side.set(0,0,1).applyQuaternion(rotation);
    controller.config.collisionsManager.setCharacterPosition(point);
    feet.set(point.x,point.y,point.z);
    const rise=motion.height-previousHeight;
    const allowed=headroom(feet,rise,controller.capsuleInfo,controller.config.collisionsManager,radialAxis,right,side);
    if(allowed<rise){
      motion.applyCollision(feet.addScaledVector(radialAxis,allowed-rise));
      motion.radialSpeed=0;
      state=motion.pose();
      point=state.position;
    }
    const collisions=controller.config.collisionsManager;
    function checkCapsule(p,report){
      capsule.start.copy(p).addScaledVector(radialAxis,radius);
      capsule.end.copy(capsule.start).addScaledVector(radialAxis,height);
      originalStart.copy(capsule.start);
      collisions.setCharacterPosition(p);
      if(report)collisions.applyColliders(capsule,radius);
      else for(const collider of collisions.collisionMeshState.values()){
        if(!collisions.cullingEnabled||collisions.isMeshWithinCullingDistance(collider))
          collisions.applyCollider(capsule,radius,collider);
      }
    }
    // During a long display frame, boost may move farther than the capsule
    // radius. Check intermediate poses before accepting the endpoint.
    sweepEnd.copy(point);
    const stride=radius*.65,travel=flying?sweepStart.distanceTo(sweepEnd):0;
    const checks=Math.max(1,Math.min(14,Math.ceil(travel/stride)));
    if(travel>stride*checks){
      sweepEnd.lerpVectors(sweepStart,sweepEnd,stride*checks/travel);
      motion.applyCollision(sweepEnd);
      state=motion.pose();
      sweepEnd.copy(state.position);
    }
    for(let index=1;index<checks;index++){
      feet.copy(sweepStart).lerp(sweepEnd,index/checks);
      checkCapsule(feet,false);
      if(capsule.start.distanceToSquared(originalStart)>1e-10){
        contact.subVectors(capsule.start,originalStart);
        const wallRing=contact.dot(right),wallCross=contact.dot(side);
        const lateral=wallRing*wallRing+wallCross*wallCross;
        const into=motion.ringSpeed*wallRing+motion.crossSpeed*wallCross;
        if(lateral>1e-8&&into<0){
          motion.ringSpeed-=into*wallRing/lateral;
          motion.crossSpeed-=into*wallCross/lateral;
        }
        sweepEnd.copy(capsule.start).addScaledVector(radialAxis,-radius);
        motion.applyCollision(sweepEnd);
        state=motion.pose();
        sweepEnd.copy(state.position);
        break;
      }
    }
    checkCapsule(sweepEnd,true);
    if (capsule.start.distanceToSquared(originalStart) > 1e-10) {
      motion.applyCollision(capsule.start.addScaledVector(radialAxis, -radius));
      state = motion.pose();
    }
    lastPosition = state.position;
    position.set(lastPosition.x, lastPosition.y, lastPosition.z);
    const facing = toroidalRotation(lastPosition, state.rotation.eulerY, rotation);
    quaternion.set(facing.x, facing.y, facing.z, facing.w);
    controller.controlState = control;
    controller.characterOnGround = state.grounded;
    controller.currentHeight = flying||state.swimming ? 2 : motion.height-motion.supportAt(motion.u,motion.v);
    controller.characterVelocity.set(0, motion.radialSpeed, 0);
    controller.networkState = {
      position: state.position, rotation: state.rotation, state: controller.getTargetAnimation(),
    };
    onMovementMode(state.swimming?'swim':flying?'flight':wet?'surface':'ground');
  }

  function characterUpdate(...args) {
    const local = this.localController;
    if (!enabled()) {
      motion = lastLocal = lastPosition = null;
      onMovementMode('ground');
      clearance.reset();
      return updateCharacters.apply(this, args);
    }

    let updateLocal;
    if (local) {
      // The default camera starts at the old world origin. Recovering orbit
      // angles from that position would interpret a cross-world jump as zoom.
      if (!camera.hadTarget) camera.hadTarget = true;
      updateLocal = local.update;
      local.update = seconds => walk(local, seconds);
    } else onMovementMode('ground');
    let result;
    try {
      result = updateCharacters.apply(this, args);
    } finally {
      if (local) local.update = updateLocal;
    }

    for (const peer of this.remoteCharacters.values()) {
      const yaw = 2 * Math.atan2(peer.controller.rotation.y, peer.controller.rotation.w);
      peer.renderState.rotation.setFromQuaternion(toroidalRotation(peer.controller.position, yaw, rotation));
    }
    return result;
  }

  function cameraUpdate(...args) {
    updateCamera.apply(this, args);
    if (!enabled() || !lastPosition || this.isFlyCameraOn()) return;
    const state = this.getMainCameraState();
    const {target} = this;
    toroidalRotation(lastPosition, 0, rotation);
    viewOffset.set(state.position.x - target.x, state.position.y - target.y, state.position.z - target.z)
      .applyQuaternion(rotation);
    viewRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w).premultiply(rotation);
    clearance.constrain(target,viewOffset,viewRotation,state.fov,state.aspect,this.collisionsManager);
    state.position.set(target.x + viewOffset.x, target.y + viewOffset.y, target.z + viewOffset.z);
    state.rotation.set(viewRotation.x, viewRotation.y, viewRotation.z, viewRotation.w);
  }

  function adjustInFrame(...args) {
    if (enabled() && lastPosition) this.targetDistance=this.desiredDistance;
    else adjustCamera.apply(this,args);
  }

  manager.update = characterUpdate;
  camera.adjustCameraPosition=adjustInFrame;
  camera.update = cameraUpdate;
  return () => {
    onMovementMode('ground');
    if (manager.update === characterUpdate) manager.update = updateCharacters;
    if (camera.update === cameraUpdate) camera.update = updateCamera;
    if (camera.adjustCameraPosition === adjustInFrame) camera.adjustCameraPosition = adjustCamera;
  };
}
