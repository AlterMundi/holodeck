import {BackSide, Color, HemisphereLight, Matrix3, Mesh, RepeatWrapping, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector2, Vector3, Vector4} from 'three';
import {toroidalAirColor,toroidalCosmosColor} from './toroidal-air.mjs';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainWaterDepth} from './toroidal-terrain.mjs';

import {cloudWind} from './toroidal-solar-clock.mjs';

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
    // Keep the sky at infinity for the camera used by this draw.
    vec4 projected = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = projected.xyww;
  }
`;

const fragmentShader = `
  uniform vec3 moon;
  uniform vec2 discRadii;
  uniform vec3 sun;
  uniform vec4 wind;
  uniform mat3 celestialBasis;
  uniform vec3 skyUp;
  uniform vec3 moonLight;
  uniform float eclipse;
  uniform float moonFraction;
  uniform float waterDepth;
  uniform float exposure;
  uniform float cloudiness;
  uniform float lightning;
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
    float elevation = dot(direction,skyUp);
    float facing = max(0.0, dot(direction, sun));
    float crown = pow(clamp(elevation,0.0,1.0),.72);
    vec3 horizon = toroidalAir(facing,daylight);
    vec3 zenith = mix(vec3(.013,.021,.055),vec3(.080,.21,.44),daylight);
    vec3 sky = mix(horizon,zenith,crown);
    if(showCosmos){
      vec3 deep=toroidalCosmos(cosmos,direction,celestialBasis)*exposure;
      float deepLight=dot(deep,vec3(.2126,.7152,.0722));
      float transmission=toroidalCosmosWindow(elevation,daylight);
      float nightWeight=1.0-smoothstep(.21,.85,daylight);
      sky=mix(sky,deep*1.19,transmission*nightWeight);
      sky+=deep*smoothstep(.27,.75,deepLight)*transmission*(.16+.35*daylight);
    }
    float cloud=0.0;
    if(elevation>-.035){
      // Large billows bend and join along the lower layer, with dry
      // breaks between them. A higher layer drifts independently.
      vec3 p=direction*vec3(5.1,8.4,5.1)+vec3(wind.x,0.0,wind.y);
      float bend=cloudNoise(p*.62+vec3(-2.4,4.3,3.7))-.5;
      vec3 folded=p+vec3(.85*bend,-.56*bend,1.05*bend);
      float mass=cloudNoise(folded);
      float lobes=cloudNoise(folded*2.58+vec3(7.2,2.4,-3.5));
      float density=mass*.77+lobes*.23;
      float billows=smoothstep(.57-.22*cloudiness,.73-.20*cloudiness,density);
      vec3 q=direction*vec3(7.4,19.4,5.2)+vec3(wind.z,3.6,wind.w);
      float streaks=smoothstep(.57,.79,cloudNoise(q))*.30;
      float cover=smoothstep(-.027,.16,elevation);
      cloud=(billows+streaks*(1.0-billows))*cover
        *(1.0-.48*smoothstep(.30,.92,elevation));
      vec3 under=mix(vec3(.037,.052,.098),vec3(.49,.58,.71),daylight);
      vec3 light=mix(vec3(.085,.10,.18),mix(vec3(.91,.94,.985),vec3(.96,.75,.64),facing*facing),daylight);
      float shaping=smoothstep(.51,.69,density+lobes*.053+elevation*.024);
      vec3 vapor=mix(under,light,shaping);
      sky=mix(sky,vapor,.92*cloud);
      sky+=vec3(.41,.52,.72)*lightning*cloud;
    }
    float veil=exp(-max(0.0,elevation)*7.0);
    sky=mix(sky,horizon,veil*.52);
    // Local solar scatter supplies a broad glow without blurring the HUD or
    // requiring another full-screen target on lightweight graphics.
    sky+=vec3(.15,.098,.057)*pow(facing,16.0)*daylight*(1.0-.65*cloud);
    sky+=vec3(.38,.22,.09)*pow(facing,55.0)*daylight*(1.0-.68*cloud);
    // The nearby lunar silhouette occults the solar disc at actual angular sizes.
    float solarOffset=length(cross(direction,sun));
    float lunarOffset=length(cross(direction,moon));
    float solarDisc=(1.0-smoothstep(discRadii.x*.92,discRadii.x*1.06,solarOffset))*step(.999,facing)*step(-.012,elevation);
    float lunarDisc=(1.0-smoothstep(discRadii.y*.91,discRadii.y*1.06,lunarOffset))*step(.999,dot(direction,moon))*step(-.012,elevation);
    vec3 moonNormal=normalize((direction-moon)/max(.001,discRadii.y)-direction*sqrt(max(0.0,1.0-pow(lunarOffset/max(.001,discRadii.y),2.0))));
    float lunarPhase=max(0.0,dot(moonNormal,moonLight));
    sky=mix(sky,mix(vec3(.012,.017,.030),vec3(.63,.66,.67),lunarPhase),lunarDisc*max(step(.001,eclipse),smoothstep(.002,.045,moonFraction))*(1.0-.92*cloud)*mix(1.0,.72,daylight));
    sky+=vec3(2.0,1.54,1.05)*solarDisc*(1.0-lunarDisc)*(1.0-.88*cloud);
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

    this.sunlight = new Vector3(.56,.64,-.52).normalize();
    const material = new ShaderMaterial({
      side:BackSide, depthWrite:false, fog:false, vertexShader, fragmentShader,
      uniforms:{moon:{value:new Vector3()},discRadii:{value:new Vector2()},sun:{value:this.sunlight},wind:{value:new Vector4()},celestialBasis:{value:new Matrix3()},skyUp:{value:new Vector3(0,1,0)},moonLight:{value:new Vector3()},eclipse:{value:0},moonFraction:{value:0},
        waterDepth:{value:0},exposure:{value:1.5},cloudiness:{value:.26},lightning:{value:0},daylight:{value:1},showCosmos:{value:false},cosmos:{value:null}},
    });
    this.sky = new Mesh(new SphereGeometry(10,24,12),material);
    this.sky.name = 'Toroidal atmosphere';
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.previousSky = null;
    this.fog = null;
    if(base)this.cosmos=new TextureLoader().load(new URL('assets/quintana-celestial-atlas.webp',base).href,texture=>{
      if(this.disposed){texture.dispose();return;}
      texture.colorSpace=SRGBColorSpace;
      texture.wrapS=RepeatWrapping;
      material.uniforms.cosmos.value=texture;
      material.uniforms.showCosmos.value=true;
    });
  }

  get panorama() {
    const {cosmos,showCosmos}=this.sky.material.uniforms;
    return showCosmos.value?cosmos.value:null;
  }

  get celestialBasis() {
    return this.sky.material.uniforms.celestialBasis.value;
  }

  update(eye,solar,instant=Date.now(),weather=null,exposure=1.5,reducedMotion=false) {
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

    const uniforms=this.sky.material.uniforms;
    uniforms.exposure.value=exposure;
    uniforms.cloudiness.value+=( (weather?.cloudCover??26)/100-uniforms.cloudiness.value)*.025;
    const cloudPhase=cloudWind(instant);
    if(weather){
      const from=weather.windDirection*Math.PI/180;
      const drift=((instant-weather.at)/60000)*weather.windSpeed*.009;
      cloudPhase[0]+=Math.cos(from)*drift;
      cloudPhase[1]-=Math.sin(from)*drift;
    }
    uniforms.wind.value.set(...cloudPhase);
    const seconds=instant/1000;
    const pulse=seconds%29;
    uniforms.lightning.value=weather?.storm&&!reducedMotion?Math.max(0,1-pulse*3.2)*.42:0;
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
    if(solar){
      this.sunlight.fromArray(solar.sun);
      uniforms.skyUp.value.fromArray(solar.up);
      this.fill.position.copy(uniforms.skyUp.value);
      uniforms.moon.value.fromArray(solar.moon);
      uniforms.moonLight.value.fromArray(solar.moonLight);
      uniforms.discRadii.value.set(...solar.radii);
      uniforms.eclipse.value=solar.eclipse;
      uniforms.moonFraction.value=solar.illuminated;
      this.celestialBasis.set(...solar.equatorial);
    }
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
