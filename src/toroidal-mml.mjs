import {Line3, Quaternion, Vector3} from 'three';
import {createAvatarHeadroom} from './avatar-headroom.mjs';
import {createToroidalCameraClearance} from './toroidal-camera-clearance.mjs';
import {ToroidalLocomotion, toroidalRotation} from './toroidal-locomotion.mjs';
import {TOROIDAL_SPAWN, terrainCoordinates} from './toroidal-terrain.mjs';

// The MML host still owns input, network cadence, interpolation, avatar
// animation and the orbit camera. Only the selected exterior uses a radial
// surface and reconstructs the world-space orientation from tangent yaw.
export function bindToroidalMml(manager, camera, enabled, flight=()=>false) {
  const updateCharacters = manager.update;
  const updateCamera = camera.update;
  const adjustCamera = camera.adjustCameraPosition;
  const clearance = createToroidalCameraClearance();
  const rotation = new Quaternion();
  const viewRotation = new Quaternion();
  const viewOffset = new Vector3();
  const radialAxis = new Vector3(),right=new Vector3(),side=new Vector3(),feet=new Vector3();
  const headroom=createAvatarHeadroom();
  const capsule = new Line3();
  const originalStart = new Vector3();
  let motion, lastLocal, lastPosition;

  function walk(controller, seconds) {
    const {position, quaternion, keyInputManager, additionalInputProvider} = controller.config;
    const control = keyInputManager.getOutput() || additionalInputProvider?.getOutput() || null;
    if (lastLocal !== controller || !lastPosition ||
        Math.hypot(position.x - lastPosition.x, position.y - lastPosition.y, position.z - lastPosition.z) > .001) {
      let start = terrainCoordinates([position.x, position.y, position.z]);
      // A cell handoff can leave one planar pose before exterior spawn.
      // The toroidal chart excludes the symmetry axis and tube center.
      if (!Number.isFinite(start.height) || Math.abs(start.height) > 180) {
        start = terrainCoordinates([TOROIDAL_SPAWN.x, TOROIDAL_SPAWN.y, TOROIDAL_SPAWN.z]);
      }
      motion = new ToroidalLocomotion({...start, yaw: 2 * Math.atan2(quaternion.y, quaternion.w)});
    }
    lastLocal = controller;
    const moving = Number.isFinite(control?.direction);
    const yaw = moving ? Math.PI / 2 - camera.theta + control.direction : motion.yaw;
    const flying=flight();
    const wet=motion.atSwimSurface();
    const vertical=flying||motion.swimming||wet?
      Number(Boolean(keyInputManager.getJump()||control?.jump))-Number(keyInputManager.isKeyPressed('shift')):0;
    const previousHeight=motion.height;
    motion.update(seconds, {forward: moving ? 1 : 0, yaw, sprint:control?.isSprinting,
      jump: !flying&&!motion.swimming&&control?.jump,flight:flying,vertical,crouch:!flying&&!wet&&keyInputManager.isKeyPressed('shift')});
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
    capsule.start.set(point.x, point.y, point.z).addScaledVector(radialAxis, radius);
    capsule.end.copy(capsule.start).addScaledVector(radialAxis, height);
    originalStart.copy(capsule.start);
    controller.config.collisionsManager.setCharacterPosition(point);
    controller.config.collisionsManager.applyColliders(capsule, radius);
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
  }

  function characterUpdate(...args) {
    const local = this.localController;
    if (!enabled()) {
      motion = lastLocal = lastPosition = null;
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
    }
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
    if (manager.update === characterUpdate) manager.update = updateCharacters;
    if (camera.update === cameraUpdate) camera.update = updateCamera;
    if (camera.adjustCameraPosition === adjustInFrame) camera.adjustCameraPosition = adjustCamera;
  };
}
