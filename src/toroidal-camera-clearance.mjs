import {Ray, Vector3} from 'three';
import {terrainCoordinates, terrainElevation} from './toroidal-terrain.mjs';

const NEAR = .1;
const PAUSE_MARGIN = .13;
const STEPS_PER_METER = 3;

const probes = [
  [0,0], [-1,-1], [-1,1], [1,-1], [1,1],
];

function terrainClearance(point, terrain) {
  const {u,v,height} = terrainCoordinates([point.x,point.y,point.z],terrain);
  return height - terrainElevation(u,v,terrain);
}

// The camera uses the same analytic terrain as the avatar and traces known
// cave/house geometry in the actual MML collision scene.
export function createToroidalCameraClearance(terrain) {
  const origin = new Vector3(), edge = new Vector3(), point = new Vector3();
  const back = new Vector3(), right = new Vector3(), up = new Vector3();
  const ray = new Ray();
  let previousLength;
  function constrain(target, offset, rotation, fov, aspect, colliders) {
    const boom = offset.length();
    if (boom <= NEAR || !Number.isFinite(aspect) || aspect <= 0) return offset;
    origin.copy(target);
    back.copy(offset);
    right.set(1,0,0).applyQuaternion(rotation);
    up.set(0,1,0).applyQuaternion(rotation);
    const halfHeight = Math.tan(fov * Math.PI / 360) * NEAR;
    let safe = boom;
    const hasClearTarget=terrainClearance(origin,terrain)>PAUSE_MARGIN;
    for (const [x,y] of probes) {
      edge.copy(back).addScaledVector(right, x * halfHeight * aspect).addScaledVector(up, y * halfHeight);
      const length = edge.length();
      ray.set(origin,edge.divideScalar(length));
      const hit = colliders.raycastFirst(ray,length+PAUSE_MARGIN);
      if (hit) safe = Math.min(safe, Math.max(NEAR,(hit[0]-PAUSE_MARGIN)*boom/length));
      if (!hasClearTarget) continue;
      const steps = Math.ceil(safe * STEPS_PER_METER);
      let lower = 0;
      for (let step = 1; step <= steps; step += 1) {
        const distance = (safe*length/boom) * step/steps;
        if (terrainClearance(ray.at(distance,point),terrain) > PAUSE_MARGIN) {
          lower = distance;
          continue;
        }
        let upper = distance;
        for (let iteration = 0; iteration < 5; iteration += 1) {
          const mid=(lower+upper)/2;
          if (terrainClearance(ray.at(mid,point),terrain) > PAUSE_MARGIN) lower=mid;
          else upper=mid;
        }
        safe = Math.min(safe,Math.max(NEAR,lower*boom/length));
        break;
      }
    }
    const limited = Math.min(safe, (previousLength ?? safe) + .18);
    previousLength = safe < boom || limited < boom ? limited : undefined;
    return offset.multiplyScalar(limited/boom);
  }
  return {constrain, reset(){previousLength=undefined;}};
}
