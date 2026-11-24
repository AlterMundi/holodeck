import {BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial} from 'three';
import {TOROIDAL_TERRAIN, terrainElevation, terrainPosition} from './toroidal-terrain.mjs';

export const CAVE = Object.freeze({from: .0076, to: .0117, latitude: .265});
const SECTION_COUNT = 36;
const ARCH_SEGMENTS = 16;
const TAU = 2 * Math.PI;

// The tunnel and its two chambers follow the seeded terrain at the same
// elevation used by locomotion. Rock joins the underlying ground on both
// sides, and the shared triangle shell bounds the actual walkable passage.
export function buildToroidalCave(terrain = TOROIDAL_TERRAIN) {
  const centerU = (CAVE.from + CAVE.to) / 2;
  const origin = terrainPosition(centerU, CAVE.latitude, terrainElevation(centerU, CAVE.latitude, terrain), terrain);
  const width = ARCH_SEGMENTS + 1;
  const stride = (SECTION_COUNT + 1) * width;
  const positions = new Float32Array(stride * 6);
  const colors = new Float32Array(positions.length);
  const indices = [];
  for (let section = 0; section <= SECTION_COUNT; section += 1) {
    const t = section / SECTION_COUNT;
    const u = CAVE.from + (CAVE.to - CAVE.from) * t;
    const center = CAVE.latitude + .00032 * Math.sin(t * TAU);
    const chambers = Math.sin(Math.PI * t) * (.58 - .42 * Math.cos(t * 2 * TAU));
    const tunnelWidth = 2.8 + 2 * chambers;
    const ceiling = 2.65 + 2.4 * chambers;
    const walls = 1.6 + 1.8 * Math.sin(Math.PI * t);
    for (let arch = 0; arch <= ARCH_SEGMENTS; arch += 1) {
      const radialAngle = Math.PI * arch / ARCH_SEGMENTS;
      const roughness = .34 * Math.sin(23 * t + .7 * arch) + .17 * Math.sin(51 * t - 1.8 * arch);
      const shade = .80 + .20 * Math.sin(18 * t + .65 * arch);
      for (let skin = 0; skin < 2; skin += 1) {
        const outer = skin === 0;
        const metersAcross = Math.cos(radialAngle) * (tunnelWidth + (outer ? walls + roughness : .25 * roughness));
        const v = center + metersAcross / (TAU * terrain.tubeRadius);
        const floor = terrainElevation(u, v, terrain);
        const height = floor - 1.1 + Math.sin(radialAngle) *
          (ceiling + 1.1 + (outer ? walls + roughness * 2 : roughness * .2));
        const p = terrainPosition(u,v,height,terrain);
        const index = (skin * stride + section * width + arch) * 3;
        const brightness = shade * (outer ? .82 : .40);
        for (let axis = 0; axis < 3; axis += 1) positions[index + axis] = p[axis] - origin[axis];
        colors.set([.41 * brightness,.28 * brightness,.18 * brightness],index);
      }

      if (arch < ARCH_SEGMENTS && section < SECTION_COUNT) {
        const a = section * width + arch, b = a + width, c = a + 1, d = b + 1;
        indices.push(a,b,c, b,d,c, a+stride,c+stride,b+stride, b+stride,c+stride,d+stride);
      }
      if (arch < ARCH_SEGMENTS && (section === 0 || section === SECTION_COUNT)) {
        const a = section * width + arch, b = a + 1;
        if (section === 0) indices.push(a,b,a+stride, b,b+stride,a+stride);
        else indices.push(a,a+stride,b, b,a+stride,b+stride);
      }
    }
  }
  return {origin,positions,colors,indices:new Uint16Array(indices)};
}

export class ToroidalCave {
  constructor(scene,colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.mesh = null;
    this.location = terrainPosition((CAVE.from+CAVE.to)/2,CAVE.latitude);
  }

  update(position) {
    const distance = Math.hypot(position.x-this.location[0],position.y-this.location[1],position.z-this.location[2]);
    if (this.mesh) {
      if (distance > 210) this.dispose();
      return;
    }
    if (distance > 170) return;
    const {origin,positions,colors,indices} = buildToroidalCave();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(positions,3));
    geometry.setAttribute('color',new BufferAttribute(colors,3));
    geometry.setIndex(new BufferAttribute(indices,1));
    geometry.computeVertexNormals();
    const material = new MeshStandardMaterial({vertexColors:true,roughness:.96});
    this.mesh = new Mesh(geometry,material);
    this.mesh.name = 'Connected rock passage';
    this.mesh.position.fromArray(origin);
    this.scene.add(this.mesh);
    this.mesh.updateWorldMatrix(true,false);
    this.colliders.addCollider(this.mesh);
  }

  dispose() {
    if (!this.mesh) return;
    this.colliders.removeCollider(this.mesh);
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }
}
