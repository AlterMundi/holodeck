import {Matrix4, Quaternion, Vector3} from 'three';
import {
  TOROIDAL_TERRAIN, terrainCoordinates, terrainElevation, terrainFrame, terrainPosition,
} from './toroidal-terrain.mjs';

const TAU = 2 * Math.PI;
const STEP = 1 / 90;
const MAX_FRAME = 9 * STEP;
const GRAVITY = 19.6;
const JUMP_SPEED = 5.8;
const WALK_SPEED = 5;
const RUN_SPEED = 8;
const FLOAT_DRAFT = .96;
const WADE_DEPTH = .18;
const wrap = turns => ((turns % 1) + 1) % 1;
const wrapYaw = radians => Math.atan2(Math.sin(radians), Math.cos(radians));

const basis = new Matrix4();
const tangentYaw = new Quaternion();
const right = new Vector3(), up = new Vector3(), forward = new Vector3();
const yawAxis = new Vector3(0, 1, 0);

// Keep the existing wire shape of a position and a yaw. Outside, reconstruct
// a world-space rotation using the same terrain edition on every client.
// Yaw is relative to the ordered tangents of the local toroidal chart.
export function toroidalRotation(position, yaw, out = new Quaternion(), terrain = TOROIDAL_TERRAIN) {
  const {u, v} = terrainCoordinates([position.x, position.y, position.z], terrain);
  const frame = terrainFrame(u, v, terrain);
  basis.makeBasis(right.fromArray(frame.alongRing), up.fromArray(frame.up), forward.fromArray(frame.aroundTube));
  return out.setFromRotationMatrix(basis).multiply(tangentYaw.setFromAxisAngle(yawAxis, yaw));
}

// Use the analytic ground for movement, independent of the render tile that
// happens to be ready. The surface is represented by one height per (u, v).
// The fixed simulation step is shared across display refresh rates.
export class ToroidalLocomotion {
  constructor({
    u, v, terrain = TOROIDAL_TERRAIN, height, yaw = 0, ground = terrainElevation,
  }) {
    this.terrain = terrain;
    this.ground = ground;
    this.u = wrap(u);
    this.v = wrap(v);
    this.waterLevel = terrain.waterLevel ?? -Infinity;
    const floor = this.supportAt(this.u,this.v);
    this.height = Math.max(floor, height ?? floor);
    this.grounded = this.height === floor;
    this.yaw = wrapYaw(yaw);
    this.ringSpeed = 0;
    this.crossSpeed = 0;
    this.radialSpeed = 0;
    this.accumulated = 0;
    this.jumpHeld = false;
    this.jumpQueued = false;
  }

  update(seconds, {right = 0, forward = 0, yaw = this.yaw, sprint = false, jump = false} = {}) {
    if (!Number.isFinite(seconds) || seconds <= 0 || ![right, forward, yaw].every(Number.isFinite)) return;
    const inputLength = Math.max(1, Math.hypot(right, forward));
    const speed = (sprint ? RUN_SPEED : WALK_SPEED) / inputLength;
    const sine = Math.sin(yaw), cosine = Math.cos(yaw);
    const ringTarget = (right * cosine + forward * sine) * speed;
    const crossTarget = (forward * cosine - right * sine) * speed;
    this.yaw = wrapYaw(yaw);
    if (jump && !this.jumpHeld) this.jumpQueued = true;
    this.jumpHeld = jump;
    this.accumulated += Math.min(seconds, MAX_FRAME);
    while (this.accumulated + 1e-10 >= STEP) {
      this.step(ringTarget, crossTarget);
      this.accumulated = Math.max(0, this.accumulated - STEP);
    }
  }

  supportAt(u,v) {
    return Math.max(this.ground(u,v,this.terrain),this.waterLevel-FLOAT_DRAFT);
  }

  step(ringTarget, crossTarget) {
    const immersion = Math.max(0, Math.min(1,(this.waterLevel-this.height-WADE_DEPTH)/(FLOAT_DRAFT-WADE_DEPTH)));
    const speedFactor = 1 - .56 * immersion;
    const response = this.grounded ? .18 : .065;
    this.ringSpeed += (ringTarget * speedFactor - this.ringSpeed) * response;
    this.crossSpeed += (crossTarget * speedFactor - this.crossSpeed) * response;
    const {tubeRadius, majorRadius} = this.terrain;
    const tubeDistance = tubeRadius + this.height;
    const ringDistance = majorRadius + tubeDistance * Math.cos(this.v * TAU);
    const nextU = wrap(this.u + this.ringSpeed * STEP / (ringDistance * TAU));
    const nextV = wrap(this.v + this.crossSpeed * STEP / (tubeDistance * TAU));
    const currentGround = this.supportAt(this.u,this.v);
    const nextGround = this.supportAt(nextU,nextV);
    const groundDelta = nextGround - currentGround;
    const distance = Math.hypot(this.ringSpeed, this.crossSpeed) * STEP;

    if (this.jumpQueued && this.grounded) {
      this.radialSpeed = JUMP_SPEED * (1-.7*immersion);
      this.grounded = false;
    }
    this.jumpQueued = false;

    if (this.grounded && groundDelta > .95 * distance + .025) {
      // Refuse steep uphill crossings without launching the avatar upward.
      // Let a reversing input change direction on the following step.
      this.height = currentGround;
      return;
    }

    if (this.grounded && groundDelta >= -1.4 * distance - .025) {
      this.height = nextGround;
    } else {
      this.radialSpeed -= GRAVITY * STEP;
      this.height += this.radialSpeed * STEP;
      this.grounded = this.height <= nextGround;
      if (this.grounded) {
        this.height = nextGround;
        this.radialSpeed = 0;
      }
    }
    this.u = nextU;
    this.v = nextV;
  }

  applyCollision(point) {
    const {u, v, height} = terrainCoordinates([point.x, point.y, point.z], this.terrain);
    this.u = u;
    this.v = v;
    this.height = Math.max(height,this.supportAt(u,v));
    if (this.height > height || this.grounded) this.radialSpeed = 0;
  }

  pose() {
    const [x, y, z] = terrainPosition(this.u, this.v, this.height, this.terrain);
    return {position: {x, y, z}, rotation: {eulerY: this.yaw}, grounded: this.grounded};
  }
}
