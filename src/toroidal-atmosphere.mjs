import {BackSide, Color, HemisphereLight, Mesh, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3} from 'three';
import {TOROIDAL_TERRAIN,terrainCoordinates, terrainFrame,terrainWaterDepth} from './toroidal-terrain.mjs';

import {toroidalSunDirection} from './toroidal-terrain-renderer.mjs';

const groundHaze = new Color(0x94abb2);
const deepHaze = new Color(0x133f52);
const nightHaze=new Color(0x0b1028);

export function toroidalViewDepth(eye){
  const {u,v,height}=terrainCoordinates([eye.x,eye.y,eye.z]);
  return terrainWaterDepth(u,v)>.12?Math.max(0,TOROIDAL_TERRAIN.waterLevel-height):0;
}

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
  uniform float time;
  uniform float waterDepth;
  uniform float daylight;
  uniform sampler2D cosmos;
  uniform bool showCosmos;
  float cloudHash(vec3 p) {
    p = fract(p * 0.31 + vec3(.13,.27,.41)) * 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float cloudNoise(vec3 p) {
    vec3 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(cloudHash(cell),cloudHash(cell+vec3(1,0,0)),f.x),
      mix(cloudHash(cell+vec3(0,1,0)),cloudHash(cell+vec3(1,1,0)),f.x),f.y),
      mix(mix(cloudHash(cell+vec3(0,0,1)),cloudHash(cell+vec3(1,0,1)),f.x),
      mix(cloudHash(cell+vec3(0,1,1)),cloudHash(cell+vec3(1,1,1)),f.x),f.y),f.z);
  }
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
    sky=mix(vec3(.018,.026,.060),sky,daylight);
    if (showCosmos) {
      // Soft blending at the generated panorama's longitude seam.
      float longitude = fract(atan(direction.z,direction.x) / 6.2831853 + .5);
      vec2 uv = vec2(longitude,.5 + asin(clamp(direction.y,-1.0,1.0)) / 3.1415927);
      vec3 deep = texture2D(cosmos,uv).rgb;
      float seam = smoothstep(0.0,.035,min(longitude,1.0-longitude));
      deep = mix(vec3(.012,.005,.04),deep,seam);

      float window = smoothstep(-.07,.39,elevation);
      float visibility = mix(.98,.53,daylight) * window;
      sky = mix(sky,deep * mix(1.36,.69,daylight),visibility);
      sky += deep*.20*(1.0-.44*daylight);
    }
    vec3 p = direction * vec3(5.8,10.2,5.8) + vec3(time*.006,0.0,time*.004);
      float density = cloudNoise(p)*.64 + cloudNoise(p*2.05)*.24 + cloudNoise(p*4.12)*.12;
      float cloud = smoothstep(.49,.71,density) * smoothstep(-.04,.15,elevation)
                  * (1.0-.65*smoothstep(.25,.83,elevation));
      vec3 vapor = mix(vec3(.03,.045,.09),
        mix(vec3(.34,.43,.56),vec3(.77,.54,.55),facing*facing),daylight);
      sky = mix(sky,vapor,.86*cloud);
    sky += vec3(.92,.54,.29)*smoothstep(.9988,.99965,facing)*daylight;
    if (waterDepth > .014) {
      vec3 suspended = mix(vec3(.012,.046,.068),vec3(.078,.28,.34),smoothstep(-.19,.95,elevation));
      sky = mix(sky,suspended*mix(.23,1.0,daylight),smoothstep(.014,.08,waterDepth));
    }
    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class ToroidalAtmosphere {
  constructor(scene,base) {
    this.scene = scene;
    this.fill = new HemisphereLight(0xb0d4ff,0x8d6949,1.12);
    this.fill.position.set(0,1,0);
    this.radialUp = new Vector3(0,1,0);
    this.sunlight = new Vector3(.56,.64,-.52).normalize();
    const material = new ShaderMaterial({
      side:BackSide, depthWrite:false, fog:false, vertexShader, fragmentShader,
      uniforms:{radialUp:{value:this.radialUp},sun:{value:this.sunlight},time:{value:0},
        waterDepth:{value:0},daylight:{value:1},showCosmos:{value:false},cosmos:{value:null}},
    });
    this.sky = new Mesh(new SphereGeometry(10,24,12),material);
    this.sky.name = 'Toroidal atmosphere';
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.previousSky = null;
    this.fog = null;
    if(base)this.cosmos=new TextureLoader().load(new URL('assets/toroidal-cosmos.webp',base).href,texture=>{
      if(this.disposed){texture.dispose();return;}
      texture.colorSpace=SRGBColorSpace;
      material.uniforms.cosmos.value=texture;
      material.uniforms.showCosmos.value=true;
    });
  }

  update(eye,position,solar) {
    if (!this.sky.parent) {
      this.scene.add(this.sky,this.fill);
    }
    if (this.scene.fog && this.fog?.object!==this.scene.fog) {
      this.fog={object:this.scene.fog,color:this.scene.fog.color.clone(),near:this.scene.fog.near,far:this.scene.fog.far};
      this.scene.fog.color.copy(groundHaze);
    }
    if (!this.previousSky?.object.parent) {
      const legacy = this.scene.children.find(node=>node.isSky===true);
      this.previousSky = legacy ? {object:legacy,visible:legacy.visible} : null;
      if (legacy) legacy.visible=false;
    }
    const depth=toroidalViewDepth(eye);
    const drowned=depth>.025;
    this.sky.material.uniforms.waterDepth.value=depth;
    this.sky.material.uniforms.time.value=(performance.now()/1000)%3600;
    const daylight=solar?.daylight??1;
    if(this.fog?.object===this.scene.fog&&this.fog){
      const fog=this.fog.object;
      fog.color.copy(nightHaze).lerp(drowned?deepHaze:groundHaze,daylight);
      fog.near=drowned?.7:this.fog.near;
      fog.far=drowned?Math.max(6,23-depth*1.2):this.fog.far;
    }
    this.sky.material.uniforms.daylight.value=daylight;
    this.fill.intensity=drowned?.31+.33*daylight:.19+.93*daylight;
    this.sky.position.copy(eye);
    const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
    this.radialUp.fromArray(terrainFrame(u,v).up);
    this.sunlight.fromArray(toroidalSunDirection(position,TOROIDAL_TERRAIN,solar?.direction));
  }

  dispose() {
    this.disposed=true;
    this.cosmos?.dispose();
    this.sky.removeFromParent();
    this.fill.removeFromParent();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.fill.dispose();
    if (this.previousSky?.object.parent) this.previousSky.object.visible=this.previousSky.visible;
    if(this.fog?.object===this.scene.fog&&this.fog){
      const {object,color,near,far}=this.fog;
      object.color.copy(color);
      object.near=near;object.far=far;
    }
  }
}
