import {BackSide, Color, HemisphereLight, Matrix3, Mesh, RepeatWrapping, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector2, Vector3, Vector4} from 'three';
import {toroidalAirColor,toroidalCosmosColor} from './toroidal-air.mjs';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainWaterDepth} from './toroidal-terrain.mjs';

import {cloudWind} from './toroidal-solar-clock.mjs';

const groundHaze = new Color().setRGB(.46,.57,.70);
const deepHaze = new Color(0x133f52);
const nightHaze=new Color().setRGB(.016,.024,.054);
// The sky art enlarges the discs. Quintana's clock, eclipse geometry and
// lighting continue to use the physical angular radii.
const sunDisplayScale=6.4,moonDisplayScale=6.6;

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
  uniform vec2 displayRadii;
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
  mat3 discFrame(vec3 center) {
    vec3 reference=abs(dot(center,skyUp))>.98?celestialBasis[0]:skyUp;
    if(abs(dot(center,reference))>.98)reference=celestialBasis[1];
    vec3 right=normalize(cross(reference,center));
    return mat3(right,cross(center,right),center);
  }
  float orbitArc(vec2 p,float radius,float tilt,float halfWidth){
    vec2 q=mat2(.954,tilt,-tilt,.954)*p;
    float ring=length(q*vec2(1.0,2.7));
    float rim=1.0-smoothstep(halfWidth,halfWidth+.018,abs(ring-radius));
    return rim*smoothstep(.12,.45,abs(q.x)/radius);
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
    // Large illustrated discs live in the same sky and behind the same clouds.
    float altitudeMask=smoothstep(-.014,-.003,elevation);
    float lunarVisibility=smoothstep(.002,.045,moonFraction);
    if(dot(direction,moon)>.997&&lunarVisibility>0.0&&eclipse==0.0){
      float radius=max(.001,displayRadii.y);
      mat3 frame=discFrame(moon);
      vec2 p=vec2(dot(direction,frame[0]),dot(direction,frame[1]))/radius;
      float r=length(p);
      float air=altitudeMask*(1.0-.92*cloud)*mix(1.0,.74,daylight)*lunarVisibility;
      vec3 indigo=vec3(.20,.22,.65),mint=vec3(.38,.91,.87);
      float orbit=orbitArc(p,1.46,.30,.023);
      sky+=mix(indigo,mint,smoothstep(-.8,.7,p.x))*air*
        (.37*orbit+.11*exp(-8.0*max(0.0,r-1.0))*step(1.0,r));
      if(r<1.02){
        vec3 normal=normalize(frame*vec3(p,-sqrt(max(0.0,1.0-r*r))));
        float light=max(0.0,dot(normal,moonLight));
        float basin=cloudNoise(normal*4.1+vec3(31.0,11.0,-9.0));
        float dust=cloudNoise(normal*22.0+vec3(12.0,-7.0,3.0));
        float marbling=smoothstep(.28,.70,basin*.84+dust*.16);
        vec3 surface=mix(vec3(.16,.20,.44),vec3(.54,.83,.84),marbling);
        vec3 rim=mix(vec3(.25,.22,.64),vec3(.57,.91,1.0),clamp(p.y*.5+.5,0.0,1.0));
        float edge=smoothstep(.86,1.0,r);
        vec3 colour=vec3(.019,.026,.060)+surface*(.13+1.38*light)+rim*edge*(.16+.53*light);
        sky=mix(sky,colour,(1.0-smoothstep(.98,1.02,r))*air*.97);
      }
    }
    if(facing>.996){
      float radius=max(.001,displayRadii.x);
      mat3 frame=discFrame(sun);
      vec2 p=vec2(dot(direction,frame[0]),dot(direction,frame[1]))/radius;
      float r=length(p);
      float disc=1.0-smoothstep(.984,1.015,r);
      float air=altitudeMask*(1.0-.88*cloud);
      float warm=1.0-smoothstep(.02,.27,dot(sun,skyUp));
      float horizonBands=.5+.5*sin(14.0*p.y+1.8*p.x+1.0*sin(p.x*4.0));
      vec3 solarSurface=mix(vec3(1.53,.66,.19),vec3(2.42,1.61,.67),smoothstep(-1.0,.85,p.y));
      solarSurface=mix(solarSurface,vec3(1.41,.11,.45),warm*(.46+.28*horizonBands)*(1.0-smoothstep(-.9,.32,p.y)));
      solarSurface+=vec3(.72,.32,.13)*smoothstep(.84,1.0,r);
      // Sample the physical directions for the eclipse silhouette, then
      // map it back onto the illustrated Sun.
      float occultation=0.0;
      if(eclipse>0.0){
        vec3 physical=normalize(sun+discRadii.x*(frame[0]*p.x+frame[1]*p.y));
        float offset=length(cross(physical,moon))/max(.001,discRadii.y);
        occultation=1.0-smoothstep(.975,1.025,offset);
      }
      float halo=exp(-3.8*max(0.0,r-1.0))*(1.0-disc);
      float arc=orbitArc(p,1.47,-.30,.022);
      sky+=mix(vec3(.69,.27,.23),vec3(.53,.16,.49),warm)*air*(.52*halo+.49*arc);
      sky=mix(sky,sky+solarSurface*(1.0-occultation),disc*air);
      sky=mix(sky,vec3(.017,.012,.038),disc*occultation*air);
    }
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
      uniforms:{moon:{value:new Vector3()},discRadii:{value:new Vector2()},displayRadii:{value:new Vector2()},sun:{value:this.sunlight},wind:{value:new Vector4()},celestialBasis:{value:new Matrix3()},skyUp:{value:new Vector3(0,1,0)},moonLight:{value:new Vector3()},eclipse:{value:0},moonFraction:{value:0},
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
      uniforms.displayRadii.value.set(solar.radii[0]*sunDisplayScale,solar.radii[1]*moonDisplayScale);
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
