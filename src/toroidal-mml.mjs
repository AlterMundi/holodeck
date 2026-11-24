import {Quaternion, Vector3} from 'three';
import {ToroidalLocomotion, toroidalRotation} from './toroidal-locomotion.mjs';
import {terrainCoordinates, terrainElevation} from './toroidal-terrain.mjs';

// The MML host still owns input, network cadence, interpolation, avatar
// animation and the orbit camera. Only the selected exterior uses a radial
// surface and reconstructs the world-space orientation from tangent yaw.
export function bindToroidalMml(manager, camera, enabled) {
  const updateCharacters = manager.update;
  const updateCamera = camera.update;
  const rotation = new Quaternion();
  const viewRotation = new Quaternion();
  const viewOffset = new Vector3();
  let motion, lastLocal, lastPosition;

  function walk(controller, seconds) {
    const {position, quaternion, keyInputManager, additionalInputProvider} = controller.config;
    const control = keyInputManager.getOutput() || additionalInputProvider?.getOutput() || null;
    if (lastLocal !== controller || !lastPosition ||
        Math.hypot(position.x - lastPosition.x, position.y - lastPosition.y, position.z - lastPosition.z) > .001) {
      const start = terrainCoordinates([position.x, position.y, position.z]);
      motion = new ToroidalLocomotion({...start, yaw: 2 * Math.atan2(quaternion.y, quaternion.w)});
    }
    lastLocal = controller;
    const moving = Number.isFinite(control?.direction);
    const yaw = moving ? Math.PI / 2 - camera.theta + control.direction : motion.yaw;
    motion.update(seconds, {forward: moving ? 1 : 0, yaw, sprint: control?.isSprinting, jump: control?.jump});
    const state = motion.pose();
    lastPosition = state.position;
    position.set(lastPosition.x, lastPosition.y, lastPosition.z);
    const facing = toroidalRotation(lastPosition, state.rotation.eulerY, rotation);
    quaternion.set(facing.x, facing.y, facing.z, facing.w);
    controller.controlState = control;
    controller.characterOnGround = state.grounded;
    controller.currentHeight = motion.height - terrainElevation(motion.u, motion.v);
    controller.characterVelocity.set(0, motion.radialSpeed, 0);
    controller.networkState = {
      position: state.position, rotation: state.rotation, state: controller.getTargetAnimation(),
    };
  }

  function characterUpdate(...args) {
    const local = this.localController;
    if (!enabled()) {
      motion = lastLocal = lastPosition = null;
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
    state.position.set(target.x + viewOffset.x, target.y + viewOffset.y, target.z + viewOffset.z);
    viewRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w).premultiply(rotation);
    state.rotation.set(viewRotation.x, viewRotation.y, viewRotation.z, viewRotation.w);
  }

  manager.update = characterUpdate;
  camera.update = cameraUpdate;
  return () => {
    if (manager.update === characterUpdate) manager.update = updateCharacters;
    if (camera.update === cameraUpdate) camera.update = updateCamera;
  };
}
