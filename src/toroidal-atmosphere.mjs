import {BackSide, Color, HemisphereLight, Mesh, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3} from 'three';
import {toroidalAirColor,toroidalCosmosColor} from './toroidal-air.mjs';
import {TOROIDAL_TERRAIN,terrainCoordinates, terrainFrame,terrainWaterDepth} from './toroidal-terrain.mjs';

import {toroidalSunDirection} from './toroidal-terrain-renderer.mjs';

const groundHaze = new Color().setRGB(.46,.57,.70);
const deepHaze = new Color(0x133f52);
const nightHaze=new Color().setRGB(.016,.024,.054);

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
  ${toroidalAirColor}
  ${toroidalCosmosColor}
  // Adjacent cells must assign exactly the same value to shared corners.
  // Hash the integer lattice before converting its 24 high bits to a float.
  float cloudHash(highp uint h) {
    h = (h ^ (h >> 16u)) * 0x7feb352du;
    h = (h ^ (h >> 15u)) * 0x846ca68bu;
    return float((h ^ (h >> 16u)) >> 8u) * (1.0 / 16777216.0);
  }
  float cloudNoise(highp vec3 p) {
    highp vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    const highp uint x = 0x8da6b343u, y = 0xd8163841u, z = 0xcb1ab31fu;
    highp uvec3 cell = uvec3(ivec3(floor(p)));
    highp uint h = cell.x * x + cell.y * y + cell.z * z;
    return mix(mix(mix(cloudHash(h),cloudHash(h+x),f.x),
      mix(cloudHash(h+y),cloudHash(h+x+y),f.x),f.y),
      mix(mix(cloudHash(h+z),cloudHash(h+x+z),f.x),
      mix(cloudHash(h+y+z),cloudHash(h+x+y+z),f.x),f.y),f.z);
  }
  varying vec3 skyDirection;
  void main() {
    vec3 direction = normalize(skyDirection);
    float elevation = dot(direction, radialUp);
    float facing = max(0.0, dot(direction, sun));
    float crown = pow(clamp(elevation,0.0,1.0),.72);
    vec3 horizon = toroidalAir(facing,daylight);
    vec3 zenith = mix(vec3(.013,.021,.055),vec3(.080,.21,.44),daylight);
    vec3 sky = mix(horizon,zenith,crown);
    if(showCosmos){
      vec3 deep=toroidalCosmos(cosmos,direction);
      float deepLight=dot(deep,vec3(.2126,.7152,.0722));
      float transmission=toroidalCosmosWindow(elevation,daylight);
      float nightWeight=1.0-smoothstep(.21,.85,daylight);
      sky=mix(sky,deep*1.19,transmission*nightWeight);
      sky+=deep*smoothstep(.27,.75,deepLight)*transmission*(.16+.35*daylight);
    }
    float cloud=0.0;
    if(elevation>-.035){
      vec3 p=direction*vec3(5.8,10.2,5.8)+vec3(time*.006,0.0,time*.004);
      float density=cloudNoise(p)*.64+cloudNoise(p*2.05)*.24+cloudNoise(p*4.12)*.12;
      cloud=smoothstep(.49,.71,density)*smoothstep(-.035,.18,elevation)
        *(1.0-.65*smoothstep(.25,.83,elevation));
      vec3 under=mix(vec3(.037,.052,.098),vec3(.56,.65,.77),daylight);
      vec3 light=mix(vec3(.085,.10,.18),mix(vec3(.83,.88,.94),vec3(.93,.72,.59),facing*facing),daylight);
      vec3 vapor=mix(under,light,smoothstep(.48,.72,density));
      sky=mix(sky,vapor,.86*cloud);
    }
    float veil=exp(-max(0.0,elevation)*7.0);
    sky=mix(sky,horizon,veil*.52);
    // Local solar scatter supplies a broad glow without blurring the HUD or
    // requiring another full-screen target on lightweight graphics.
    sky+=vec3(.15,.098,.057)*pow(facing,16.0)*daylight*(1.0-.65*cloud);
    sky+=vec3(.38,.22,.09)*pow(facing,55.0)*daylight*(1.0-.68*cloud);
    sky+=vec3(1.6,.96,.48)*smoothstep(.9987,.9995,facing)*daylight*(1.0-.88*cloud);
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

  get panorama() {
    const {cosmos,showCosmos}=this.sky.material.uniforms;
    return showCosmos.value?cosmos.value:null;
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
    this.sky.material.uniforms.time.value=performance.now()/1000;
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
    this.sky.material.uniforms.showCosmos.value=false;
    this.sky.material.uniforms.cosmos.value=null;
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
