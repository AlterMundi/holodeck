import {Matrix4, Quaternion, Vector3} from 'three';
import {
  TOROIDAL_TERRAIN, terrainCoordinates, terrainElevation, terrainFrame, terrainPosition,
} from './toroidal-terrain.mjs';

const TAU = 2 * Math.PI;
const STEP = 1 / 90;
const MAX_FRAME = 9 * STEP;
const GRAVITY = 19.6;
const FLIGHT_CEILING = 70;
const JUMP_SPEED = 5.8;
const WALK_SPEED = 5;
const RUN_SPEED = 8;
const FLIGHT_BOOST_SPEED=25;
const CROUCH_SPEED=1.65;
const EDGE_DROP=.23;
const FLOAT_DRAFT = .96;
const WADE_DEPTH = .18;
const SWIM_VERTICAL_SPEED = 2.8;
const SWIM_PLANAR_FACTOR=.44;
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
    u, v, terrain = TOROIDAL_TERRAIN, height, yaw = 0, ground = terrainElevation, cameraSteering = false,
  }) {
    this.terrain = terrain;
    this.ground = ground;
    this.cameraSteering=cameraSteering;
    this.u = wrap(u);
    this.v = wrap(v);
    this.waterLevel = terrain.waterLevel ?? -Infinity;
    this.swimming = this.canDive(this.u,this.v)&&Number.isFinite(height)&&height<this.waterLevel-FLOAT_DRAFT-.05;
    const floor = this.supportAt(this.u,this.v);
    this.height = Math.max(floor, height ?? floor);
    this.grounded = this.height === floor;
    this.colliderGrounded = false;
    this.flightActive = false;
    this.yaw = wrapYaw(yaw);
    this.ringSpeed = 0;
    this.crossSpeed = 0;
    this.radialSpeed = 0;
    this.accumulated = 0;
    this.jumpHeld = false;
    this.jumpQueued = false;
  }

  update(seconds, {right = 0, forward = 0, yaw = this.yaw, travelYaw = yaw, sprint = false, jump = false, flight = false, vertical = 0, climb = 0, crouch = false} = {}) {
    if (!Number.isFinite(seconds) || seconds <= 0 || ![right, forward, yaw, travelYaw, vertical, climb].every(Number.isFinite)) return;
    if(flight!==this.flightActive){
      this.flightActive=flight;
      this.swimming=!flight&&this.canDive(this.u,this.v)&&this.height<this.waterLevel-FLOAT_DRAFT-.05;
    }
    const verticalInput=Math.min(1,Math.max(-1,vertical||climb));
    // Published motion studies keep their authored thrust. The live controller
    // uses one normalized three-dimensional input for camera steering.
    const inputLength=this.cameraSteering?Math.max(1,Math.hypot(right,forward,verticalInput)):
      Math.max(1,Math.hypot(right,forward));
    const travelSpeed=flight&&sprint?FLIGHT_BOOST_SPEED:
      crouch&&!flight&&!this.swimming?CROUCH_SPEED:sprint?RUN_SPEED:WALK_SPEED;
    const speed=travelSpeed/inputLength;
    const verticalSpeed=this.cameraSteering?
      verticalInput*(flight?travelSpeed:vertical?
        SWIM_VERTICAL_SPEED*(sprint?RUN_SPEED/WALK_SPEED:1):travelSpeed*SWIM_PLANAR_FACTOR)/inputLength:
      verticalInput*(flight?WALK_SPEED:SWIM_VERTICAL_SPEED);
    const sine = Math.sin(travelYaw), cosine = Math.cos(travelYaw);
    const ringTarget = (right * cosine + forward * sine) * speed;
    const crossTarget = (forward * cosine - right * sine) * speed;
    this.yaw = wrapYaw(yaw);
    if (jump && !this.jumpHeld) this.jumpQueued = true;
    this.jumpHeld = jump;
    this.accumulated += Math.min(seconds, MAX_FRAME);
    while (this.accumulated + 1e-10 >= STEP) {
      this.step(ringTarget,crossTarget,flight,verticalSpeed,crouch);
      this.accumulated = Math.max(0, this.accumulated - STEP);
    }
  }

  canDive(u,v){
    return this.ground(u,v,this.terrain)<this.waterLevel-FLOAT_DRAFT-.05;
  }

  atSwimSurface(u=this.u,v=this.v){
    return this.canDive(u,v)&&this.height<=this.waterLevel-FLOAT_DRAFT+.0001;
  }

  supportAt(u,v) {
    const ground=this.ground(u,v,this.terrain);
    return this.swimming||this.flightActive?ground:Math.max(ground,this.waterLevel-FLOAT_DRAFT);
  }

  step(ringTarget,crossTarget,flight,vertical,crouch) {
    const immersion = Math.max(0, Math.min(1,(this.waterLevel-this.height-WADE_DEPTH)/(FLOAT_DRAFT-WADE_DEPTH)));
    const speedFactor = flight?1:1-(1-SWIM_PLANAR_FACTOR)*immersion;
    const response = this.grounded||this.colliderGrounded||flight ? .18 : .065;
    this.ringSpeed += (ringTarget * speedFactor - this.ringSpeed) * response;
    this.crossSpeed += (crossTarget * speedFactor - this.crossSpeed) * response;
    const {tubeRadius, majorRadius} = this.terrain;
    const tubeDistance = tubeRadius + this.height;
    const ringDistance = majorRadius + tubeDistance * Math.cos(this.v * TAU);
    const nextU = wrap(this.u + this.ringSpeed * STEP / (ringDistance * TAU));
    const nextV = wrap(this.v + this.crossSpeed * STEP / (tubeDistance * TAU));
    this.swimming=!flight&&this.atSwimSurface(nextU,nextV)&&(this.swimming||vertical<0);
    const currentGround = this.supportAt(this.u,this.v);
    const nextGround = this.supportAt(nextU,nextV);
    if(this.swimming){
      this.u=nextU;this.v=nextV;
      this.height=Math.max(nextGround,Math.min(this.waterLevel-FLOAT_DRAFT,this.height+
        vertical*STEP));
      if(this.height>=this.waterLevel-FLOAT_DRAFT&&vertical>0)this.swimming=false;
      this.radialSpeed=0;
      this.grounded=false;
      this.jumpQueued=false;
      return;
    }
    if(flight){
      this.u=nextU;this.v=nextV;
      this.height=Math.max(nextGround,Math.min(Math.max(nextGround,this.waterLevel-FLOAT_DRAFT)+FLIGHT_CEILING,this.height+vertical*STEP));
      this.radialSpeed=0;
      this.grounded=this.height===nextGround;
      this.jumpQueued=false;
      return;
    }
    const groundDelta = nextGround - currentGround;
    const distance = Math.hypot(this.ringSpeed, this.crossSpeed) * STEP;

    if (this.jumpQueued && (this.grounded || this.colliderGrounded)) {
      this.radialSpeed = JUMP_SPEED * (1-.7*immersion);
      this.grounded = this.colliderGrounded = false;
    }
    this.jumpQueued = false;

    if(crouch&&this.grounded&&groundDelta<-EDGE_DROP){
      this.ringSpeed=this.crossSpeed=0;
      return;
    }
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
    return {position: {x, y, z}, rotation: {eulerY: this.yaw}, grounded: this.grounded, swimming:this.swimming};
  }
}
