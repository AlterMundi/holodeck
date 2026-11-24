import {BackSide, Color, HemisphereLight, Mesh, ShaderMaterial, SphereGeometry, Vector3} from 'three';
import {terrainCoordinates, terrainFrame} from './toroidal-terrain.mjs';

import {toroidalSunDirection} from './toroidal-terrain-renderer.mjs';

const groundHaze = new Color(0x94abb2);

const vertexShader = `
  varying vec3 skyDirection;
  void main() {
    skyDirection = position;
    vec4 projected = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = projected.xyww;
  }
`;

const fragmentShader = `
  uniform vec3 radialUp;
  uniform vec3 sun;
  varying vec3 skyDirection;
  void main() {
    vec3 direction = normalize(skyDirection);
    float elevation = dot(direction, radialUp);
    float facing = max(0.0, dot(direction, sun));
    float crown = smoothstep(0.0, 1.0, elevation);
    float sunGlow = pow(facing, 7.0);
    vec3 band = mix(vec3(.36,.45,.51), vec3(.68,.49,.32), sunGlow);
    vec3 zenith = vec3(.055,.16,.30);
    vec3 sky = mix(band, zenith, crown);
    float veil = exp(-max(0.0, elevation) * 7.0);
    sky += vec3(.035,.027,.004) * veil;
    sky += vec3(.38,.22,.09) * pow(facing, 55.0);
    sky += vec3(1.6,.96,.48) * smoothstep(.9987,.9995,facing);
    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class ToroidalAtmosphere {
  constructor(scene) {
    this.scene = scene;
    this.fill = new HemisphereLight(0xb0d4ff,0x8d6949,1.12);
    this.fill.position.set(0,1,0);
    this.radialUp = new Vector3(0,1,0);
    this.sunlight = new Vector3(.56,.64,-.52).normalize();
    const material = new ShaderMaterial({
      side:BackSide, depthWrite:false, fog:false, vertexShader, fragmentShader,
      uniforms:{radialUp:{value:this.radialUp},sun:{value:this.sunlight}},
    });
    this.sky = new Mesh(new SphereGeometry(10,24,12),material);
    this.sky.name = 'Toroidal atmosphere';
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.previousSky = null;
    this.fog = null;
  }

  update(eye, position) {
    if (!this.sky.parent) {
      this.scene.add(this.sky,this.fill);
    }
    if (this.scene.fog && this.fog?.object!==this.scene.fog) {
      this.fog={object:this.scene.fog,color:this.scene.fog.color.clone()};
      this.scene.fog.color.copy(groundHaze);
    }
    if (!this.previousSky?.object.parent) {
      const legacy = this.scene.children.find(node=>node.isSky===true);
      this.previousSky = legacy ? {object:legacy,visible:legacy.visible} : null;
      if (legacy) legacy.visible=false;
    }
    this.sky.position.copy(eye);
    const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
    this.radialUp.fromArray(terrainFrame(u,v).up);
    this.sunlight.fromArray(toroidalSunDirection(position));
  }

  dispose() {
    this.sky.removeFromParent();
    this.fill.removeFromParent();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.fill.dispose();
    if (this.previousSky?.object.parent) this.previousSky.object.visible=this.previousSky.visible;
    if (this.fog&&this.fog.object===this.scene.fog) this.fog.object.color.copy(this.fog.color);
  }
}
