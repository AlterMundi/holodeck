import {woodlandShadeShader} from './toroidal-woodland-shade.mjs';
import {toroidalAirColor,toroidalCosmosColor} from './toroidal-air.mjs';
import {REFLECTION_BANK} from './toroidal-bank-reflection.mjs';
import {createMeadowCoverTexture,useToroidalRockDetail,useToroidalWaterDetail} from './toroidal-surface-detail.mjs';
import {BufferAttribute, BufferGeometry, DataTexture, DoubleSide, Group, LinearFilter, MathUtils, Mesh, MeshStandardMaterial, RGFormat, ShaderChunk, UnsignedByteType, Vector3, Vector4} from 'three';
import {
  TOROIDAL_OVERLOOK, TOROIDAL_PARCEL_Y, TOROIDAL_TERRAIN, TOROIDAL_TRAIL, buildTerrainTile, terrainCoordinates, terrainFrame, terrainTile,
} from './toroidal-terrain.mjs';

const profiles = Object.freeze({
  normal: {budget: 112, segments: 16},
  light: {budget: 64, segments: 12},
});
const ROOT_SEGMENTS = 16;
const WATER_OPACITY = .8;
// Half-extents of the Split basalt primitive in the packaged atelier facade.
const ATELIER_PLINTH = Object.freeze({x:.732,z:1.574});

// The sun is fixed in every local radial frame (along the ring, radial up,
// around the tube) instead of in world axes: about 38° above the local
// horizon everywhere. Both tangent fields are smooth over the whole torus,
// so the lighting of a place depends only on where it is, not on the viewer.
const SUN_LOCAL = (() => {
  const direction = [.6, .62, -.5];
  const length = Math.hypot(...direction);
  return direction.map(value => value / length);
})();
export const TOROIDAL_SUN = Object.freeze({color: 0xffe6c2, intensity: 2.2});

// World-space direction toward the sun for a point on the ring. The scene's
// directional light follows this at the traveler so props agree with the ground.
export function toroidalSunDirection(position, terrain = TOROIDAL_TERRAIN, local = SUN_LOCAL) {
  const {u, v} = terrainCoordinates([position.x, position.y, position.z], terrain);
  const {alongRing, up, aroundTube} = terrainFrame(u, v, terrain);
  return up.map((value, axis) =>
    local[0] * alongRing[axis] + local[1] * value + local[2] * aroundTube[axis]);
}

const glsl = value => value.toFixed(4);
const spurTrack = `
  float westernSpurAt(vec3 position, float horizontal) {
    const float tau=6.28318530718;
    const float shoulder=${glsl(TOROIDAL_TRAIL.shoulderV)};
    const float end=${glsl(TOROIDAL_OVERLOOK.v)};
    const float major=${glsl(TOROIDAL_TERRAIN.majorRadius)},tube=${glsl(TOROIDAL_TERRAIN.tubeRadius)};
    float u=atan(position.z,position.x)/tau;
    float v=atan(position.y,horizontal-major)/tau;
    float spurV=clamp(v,shoulder,end);
    float spurU=${glsl(TOROIDAL_OVERLOOK.u)}+${glsl(TOROIDAL_TRAIL.spurBend)}
      *sin(3.14159265359*(spurV-shoulder)/(end-shoulder));
    float along=(fract(u-spurU+.5)-.5)*tau*(major+tube*cos(spurV*tau));
    float across=(fract(v-spurV+.5)-.5)*tau*tube;
    float t=clamp((length(vec2(along,across))-${glsl(TOROIDAL_TRAIL.treadMetres)})
      /${glsl(TOROIDAL_TRAIL.vergeMetres)},0.0,1.0);
    return 1.0-t*t*t*(t*(t*6.0-15.0)+10.0);
  }
`;
const vertexFrame = `
  vec4 holoWorld = modelMatrix * vec4(transformed, 1.0);
  float holoHorizontal = max(length(holoWorld.xz), 1e-4);
  vec2 holoRing = holoWorld.xz / holoHorizontal;
  vec2 holoOffset = vec2(holoHorizontal - ${glsl(TOROIDAL_TERRAIN.majorRadius)}, holoWorld.y);
  float holoRadius = max(length(holoOffset), 1e-4);
  vec2 holoTube = holoOffset / holoRadius;
  vec3 holoUpWorld = vec3(holoRing.x * holoTube.x, holoTube.y, holoRing.y * holoTube.x);
  vec3 holoAlong = vec3(-holoRing.y, 0.0, holoRing.x);
  vec3 holoAround = vec3(-holoRing.x * holoTube.y, holoTube.x, -holoRing.y * holoTube.y);
  vHoloUp = (viewMatrix * vec4(holoUpWorld, 0.0)).xyz;
  vHoloSun = (viewMatrix * vec4(holodeckSunLocal.x * holoAlong +
    holodeckSunLocal.y * holoUpWorld + holodeckSunLocal.z * holoAround, 0.0)).xyz;
  vHoloHeight = holoRadius - ${glsl(TOROIDAL_TERRAIN.tubeRadius)};
  vHoloWorld = holoWorld.xyz;
`;
const varyings = `
  varying vec3 vHoloUp;
  varying vec3 vHoloSun;
  varying vec3 vHoloWorld;
  varying float vHoloHeight;
`;
// Each fragment takes the scene sun's colour with its own radial direction.
const radialSunLights = water => `
  vec3 holoUp = normalize(vHoloUp);
  vec3 holoSun = normalize(vHoloSun);
  ${ShaderChunk.lights_fragment_begin.replace(/getDirectionalLightInfo\([^;]*;/,
    match => `${match}\n directLight.direction = holoSun;${water?
      '\n if (holodeckDaylight <= 0.0) directLight.color = vec3(0.0);':''}`)}
`;
// Aerial perspective replaces the linear scene fog on the ring: nearby ridges
// keep their dark value against the pale sky, each farther layer turns paler
// and bluer, and the air warms toward the sun.
const aerialPerspective = (attenuation,strength=1) => `
  float low = max(0.0,min(vHoloHeight,holodeckEyeHeight));
  float high = max(0.0,max(vHoloHeight,holodeckEyeHeight));
  float verticalSpan=(high-low)/136.0;
  float average=verticalSpan<.01?1.0-.5*verticalSpan:(1.0-exp(-verticalSpan))/verticalSpan;
  float holoDensity=exp(-low/136.0)*average;
  float holoHaze=(1.0-exp(-length(vViewPosition)*holoDensity/1240.0))*.86;
  vec3 holoAir = toroidalAir(dot(-holoView,holoSun),holodeckDaylight);
  outgoingLight = mix(outgoingLight ${attenuation}, holoAir, holoHaze*${strength.toFixed(2)});
`;
const terrainShading = {
  color: `
    float holoAltitude = smoothstep(-6.0, 58.0, vHoloHeight);
    float holoLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = max(mix(vec3(holoLuma), diffuseColor.rgb, 1.22), 0.0);
    diffuseColor.rgb *= mix(vec3(0.86, 0.98, 0.90), vec3(1.14, 1.05, 0.93), holoAltitude);
    // Colour the existing route and its shoulders in world space. The
    // material follows the fixed parcel through terrain LOD transitions.
    float holoApproachSkylight = 0.0;
    vec2 approach = vHoloWorld.xz - vec2(${glsl(TOROIDAL_TERRAIN.majorRadius)},0.0);
    vec2 flagFootprint = fwidth(approach)/vec2(.51,.63);
    float across = length(vHoloWorld.xz) - ${glsl(TOROIDAL_TERRAIN.majorRadius)};
    float edge = abs(across);
    // Paint the walkable meadow in local XZ metres. The old rock projection
    // compresses one axis on this horizontal shoulder, stretching its grain.
    float meadowFootprint = max(length(dFdx(approach)),length(dFdy(approach)));
    float meadowSlope = dot(normalize(vNormal),normalize(vHoloUp));
    float holoMeadowGround = (1.0-smoothstep(83.0,135.0,length(approach)))
      * smoothstep(.87,.98,meadowSlope)
      * smoothstep(4.0,12.0,vHoloHeight)
      * smoothstep(370.0,460.0,vHoloWorld.y);
    // Match the continuous worn trail outside the locally painted arrival.
    float arrival = holodeckApproachArt * smoothstep(6.0,10.0,approach.y)
      * (1.0-smoothstep(37.0,51.0,approach.y));
    float holoMeadow = holoMeadowGround * smoothstep(1.15+arrival*.9,3.65+arrival*.7,edge);
    vec2 woodlandFloor=holodeckWoodlandShade?woodlandFloorAt(vHoloWorld):vec2(0.0);
    float litterWeight=smoothstep(.06,.92,woodlandFloor.g)*holoMeadow;
    float holoMeadowRoughness = mix(.96,.995,litterWeight);
    float holoTrailMask = 0.0;
    float holoTrailRoughness = .90;
    // Resolve the narrow spur per fragment where the woodland flora
    // already steps away from it. Keep the authored arrival intact.
    if(approach.x < -14.0 && vHoloWorld.y > 425.0 && length(approach)<205.0){
      float westernSpur=westernSpurAt(vHoloWorld,across+${glsl(TOROIDAL_TERRAIN.majorRadius)})
        *smoothstep(14.0,21.0,-approach.x)
        *(1.0-smoothstep(164.0,205.0,length(approach)))
        *smoothstep(425.0,445.0,vHoloWorld.y)
        *smoothstep(${glsl(TOROIDAL_TERRAIN.waterLevel+.08)},${glsl(TOROIDAL_TERRAIN.waterLevel+.9)},vHoloHeight);
      if(westernSpur>.001){
        float dust=ringNoise(approach*vec2(.51,.34)+vec2(8.0,5.0));
        float grainFade=1.0-smoothstep(.10,.32,meadowFootprint);
        float grit=grainFade>.001?ringNoise(approach*5.7)-.5:0.0;
        vec3 soil=mix(vec3(.21,.144,.075),vec3(.38,.284,.177),dust)
          +grit*grainFade*vec3(.12,.09,.065);
        diffuseColor.rgb=mix(diffuseColor.rgb,soil,westernSpur*.92);
        holoMeadow*=1.0-westernSpur;
        litterWeight*=1.0-westernSpur;
        holoTrailMask=westernSpur;
        holoTrailRoughness=mix(.84,.95,dust);
        holoApproachSkylight=.42*westernSpur;
      }
    }
    // Low-frequency colours remain legible across the hill after leaves
    // are too small to draw. Their frequencies stay fixed in world space.
    if(holoMeadow>.001){
      float soil=ringNoise(approach*vec2(.072,.11)+vec2(13.3,4.8));
      float drift=ringNoise(approach*vec2(.22,.17)+vec2(2.7,8.1));
      vec3 green=vec3(.74,.81,.72);
      vec3 straw=vec3(1.10,1.02,.77);
      vec3 meadowTone=mix(green,straw,smoothstep(.26,.86,soil*.72+drift*.28));
      diffuseColor.rgb*=mix(vec3(1.0),meadowTone,holoMeadow*.85);
    }
    // Keep the regional vertex colours and add filtered short leaf relief
    // where the camera can resolve it. Both profiles share the same pattern.
    vec2 coverUV=mat2(.8,-.6,.6,.8)*approach*.42;
    vec2 coverDX=dFdx(coverUV),coverDY=dFdy(coverUV);
    float coverDetail=1.0-smoothstep(.16,.54,meadowFootprint);
    if(holoMeadow*coverDetail>.001||litterWeight>.001){
      // Centre the patterns so each blurred surface keeps its regional hue.
      vec2 relief=textureGrad(holodeckMeadowCover,coverUV,coverDX,coverDY).rg;
      float leaf=(relief.r-.491)*holoMeadow*coverDetail;
      diffuseColor.rgb*=vec3(1.0)+leaf*vec3(1.42,1.74,1.55);
      if(litterWeight>.001){
        float moss=ringNoise(approach*.77+vec2(9.3,16.7));
        vec3 humus=mix(vec3(.15,.093,.045),vec3(.25,.18,.073),moss);
        vec3 straw=vec3(.21,.125,.058)*(relief.g-.483)*coverDetail;
        diffuseColor.rgb=mix(diffuseColor.rgb,humus+straw,litterWeight*.94);
      }
    }
    if (holodeckApproachArt > .5 && abs(approach.x) < 14.0 &&
        approach.y > 6.0 && approach.y < 51.0 && vHoloWorld.y > 0.0) {
      float endFade = arrival;
      float edgeNoise = ringNoise(approach*.89)-.5;
      float mask = (1.0-smoothstep(1.57,2.72,edge+edgeNoise*.66))*endFade;
      float vergeDistance = edge + .68*edgeNoise;
      float shoulder = smoothstep(1.95,2.85,vergeDistance) *
        (1.0-smoothstep(3.33,6.95,vergeDistance))*endFade;
      holoApproachSkylight = endFade*(1.0-smoothstep(2.0,9.0,edge));
      // Grains taper below two pixels; the wider scuffs and the warm
      // verge remain legible from a running camera and both graphics modes.
      float grainFade=1.0-smoothstep(.24,.50,4.8*meadowFootprint);
      float grit=grainFade>.001?ringNoise(approach*4.8):.5;
      // Foot traffic compacts the middle of the track. The same broad
      // variation bends the worn strip and breaks the exposed soil.
      float dust=ringNoise(approach*vec2(.54,.31)+vec2(7.4,11.0));
      float tread=1.0-smoothstep(.35,1.24,abs(across+.64*edgeNoise+.38*(dust-.5)));
      float gravel=smoothstep(.62,.81,grit)*grainFade*(1.0-.68*tread);
      float hollow=(1.0-smoothstep(.26,.50,grit))*grainFade;
      vec3 packedEarth=mix(vec3(.227,.157,.089),vec3(.427,.321,.195),.575+.30*(dust-.5));
      packedEarth=packedEarth*(1.065-.047*tread)+vec3(.106,.089,.066)*gravel-vec3(.053,.043,.025)*hollow;
      holoTrailMask=mask;
      holoTrailRoughness=clamp(.87-.05*tread+.06*gravel+.08*hollow,.73,.99);
      diffuseColor.rgb = mix(diffuseColor.rgb,packedEarth,mask*.88);
      // Worn vegetation and exposed soil meet the roots in the verge.
      float bareVerge = (1.0-smoothstep(2.58,4.55,vergeDistance)) *
        mix(.44,.86,smoothstep(.26,.72,dust));
      vec3 trampled = vec3(.137,.161,.072)*(.93+.50*edgeNoise);
      vec3 verge = mix(trampled,packedEarth*.86,bareVerge);
      diffuseColor.rgb = mix(diffuseColor.rgb,verge,shoulder*(1.0-.48*mask)*mix(.61,.35,holoMeadowGround));

      // Join the path to the sill in the entrance's cross-path frame.
      vec3 door = holodeckSill;
      vec2 apron = vec2((approach.x-door.x)*door.z,approach.y-door.y);
      if (abs(door.z) > .5 && abs(apron.y) < 2.8 && apron.x > -4.8 && apron.x < 1.25) {
        float towardPath = 1.0-smoothstep(-2.5,.12,apron.x);
        float curve = -.94*towardPath*towardPath;
        float width = mix(.74,1.42,towardPath);
        float end = smoothstep(-3.8,-2.55,apron.x)*(1.0-smoothstep(.97,1.24,apron.x));
        float apronMask = (1.0-smoothstep(width-.15,width+.18,abs(apron.y-curve)+edgeNoise*.18))*end;
        // Warp the whole course before indexing it. Each row and slab
        // has its own width, wear and rounded corners in the shared world frame.
        vec2 paving = (apron+vec2(.16*edgeNoise,.19*(dust-.5)))/vec2(.51,.63);
        float row = floor(paving.y);
        float course = ringHash(vec2(row,7.1));
        float rowWidth = mix(.83,1.23,course);
        float rowOffset = .46*row+.38*course;
        paving.x = paving.x/rowWidth+rowOffset+(fract(paving.y)-.5)*(.36*course-.18);
        vec2 cell = floor(paving);
        float wear = ringHash(cell+vec2(17.0,4.0));
        // Fade whole courses into smaller worn stones at the dirt approach.
        float middle = (cell.x+.5-rowOffset)*rowWidth*.51;
        float paved = smoothstep(-1.42,-.61,middle);
        float erosion = smoothstep(.12+.42*wear,.39+.42*wear,paved);
        vec2 halfStone = mix(vec2(.10,.12),mix(vec2(.454,.462),vec2(.405,.436),wear),erosion);
        float radius = mix(.08,.23,wear)*erosion+.04*(1.0-erosion);
        vec2 corners = abs(fract(paving)-.5)-halfStone+radius;
        float bevel = length(max(corners,0.0))+min(max(corners.x,corners.y),0.0)-radius;
        float footprint = max(flagFootprint.x/.83+.29*flagFootprint.y,flagFootprint.y);
        // Keep neighbouring cell parameters from bleeding into the grout.
        // Fade the field before this filter is narrower than a pixel.
        float aa = clamp(footprint*.65,.012,.034);
        float slab = (1.0-smoothstep(-aa,aa,bevel))*smoothstep(.07,.25,erosion);
        float face = 1.0-smoothstep(-.075-aa,-.036+aa,bevel);
        float detail = 1.0-smoothstep(.055,.21,footprint);
        float bed = smoothstep(-1.42,-.61,apron.x);
        float earthAlpha = apronMask*.83;
        float distantStone = .72*smoothstep(-1.07,-.42,apron.x);
        float stoneAlpha = apronMask*.94*mix(distantStone,slab,detail);
        vec3 apronEarth = mix(packedEarth,vec3(.273,.198,.122),.53)*mix(1.0,.71,bed);
        vec3 stone = mix(vec3(.198,.172,.133),vec3(.397,.349,.279),wear);
        stone *= 1.0+.18*(grit-.5)*grainFade;
        vec3 wornLip = stone*1.09;
        vec3 flagstone = mix(vec3(.299,.260,.206),mix(wornLip,stone,face),detail);
        diffuseColor.rgb = mix(diffuseColor.rgb,apronEarth,earthAlpha);
        diffuseColor.rgb = mix(diffuseColor.rgb,flagstone,stoneAlpha);

        // Lay stone and joint earth over the existing trail as the same
        // material weights used for colour.
        float earthWeight = earthAlpha*(1.0-stoneAlpha);
        float trailWeight = holoTrailMask*(1.0-earthAlpha)*(1.0-stoneAlpha);
        float apronRoughness = mix(.78,mix(.67,.78,face)+.045*wear,detail);
        holoTrailMask = trailWeight+earthWeight+stoneAlpha;
        holoTrailRoughness = (holoTrailRoughness*trailWeight+.94*earthWeight+
          apronRoughness*stoneAlpha)/max(.0001,holoTrailMask);
        holoMeadow *= 1.0-apronMask;
        holoApproachSkylight = max(holoApproachSkylight,apronMask*.85);
      }
    }
    // Ground absorption and worn earth give the plinth a short contact
    // transition on the same terrain material, including at night.
    float holoFacadeContact = 0.0;
    vec2 facadeOffset = vHoloWorld.xz - holodeckFacadeGround.xy;
    vec2 facadeEdge = abs(facadeOffset) - holodeckFacadeGround.zw;
    if (holodeckFacadeGround.z > 0.0 && max(facadeEdge.x,facadeEdge.y) < .82 &&
        abs(vHoloWorld.y-${glsl(TOROIDAL_PARCEL_Y)}) < .8) {
      float d = length(max(facadeEdge,0.0));
      float wear = ringNoise(facadeOffset*vec2(3.6,4.2))-.5;
      float sediment = 1.0-smoothstep(.03,.67+.25*wear,d);
      holoFacadeContact = 1.0-smoothstep(.015,.29+.09*wear,d);
      vec3 wornSoil = mix(vec3(.13,.109,.074),vec3(.21,.174,.119),.5+wear);
      diffuseColor.rgb = mix(diffuseColor.rgb,wornSoil,.46*sediment);
    }

  `,
  // Cool sky fill on ground facing radially outward, dim warm bounce on
  // slopes and overhangs, and less of both in the basins.
  fill: `
    float holoHemisphere = 0.5 + 0.5 * dot(normal, holoUp);
    float holoBasin = mix(0.74, 1.0, smoothstep(-16.0, 24.0, vHoloHeight));
    vec3 holoFill = mix(vec3(0.46, 0.37, 0.30), vec3(0.74, 0.86, 1.02),
      holoHemisphere * holoHemisphere) * holoBasin;
    irradiance *= holoFill;
    iblIrradiance *= holoFill;
  `,
  // Ground seen edge-on from eye height darkens and cools toward its crest,
  // which draws the horizon line against the sky.
  output: `
    vec3 holoView = normalize(vViewPosition);
    float holoGraze = 1.0 - clamp(dot(normal, holoView), 0.0, 1.0);
    outgoingLight *= mix(vec3(1.0), vec3(0.60, 0.66, 0.74), holoGraze * holoGraze * holoGraze * 0.8);
    // A little reflected blue sky keeps the route and the verge readable
    // after dark without washing out the rest of the landscape.
    outgoingLight += diffuseColor.rgb*vec3(.23,.31,.43)*holoApproachSkylight*(1.0-holodeckDaylight);
    outgoingLight *= 1.0-.36*holoFacadeContact;
    outgoingLight*=1.0-woodlandFloor.r*mix(.12,.65,holodeckDaylight);
    // Share the water mesh's radial datum. The smooth terrain normal
    // keeps the wet strip approximately the same width on sloping banks.
    float shoreDepth = ${glsl(TOROIDAL_TERRAIN.waterLevel)}-vHoloHeight;
    if (shoreDepth > -.58 && shoreDepth < 1.15) {
      float upright = clamp(dot(nonPerturbedNormal,holoUp), .58, .998);
      float slope = sqrt(1.0-upright*upright)/upright;
      float rise = max(0.0,-shoreDepth);
      float soak = rise/(.42*slope);
      float wet = exp(-soak*soak)*(1.0-smoothstep(.36,.58,rise))*
        (1.0-smoothstep(.15,1.15,shoreDepth));
      vec3 wetSoil = outgoingLight*.58+vec3(.009,.016,.021)*upright*holodeckDaylight;
      outgoingLight = mix(outgoingLight,wetSoil,wet);
    }
    ${aerialPerspective('* mix(.45,1.0,holodeckDaylight)')}
  `,
};
const bankReflectionShading = `
    float bankOcc=0.0;
    float bankDist=0.0;
    float bankEyeAbove=holodeckEyeHeight-(${glsl(TOROIDAL_TERRAIN.waterLevel)});
    if(gl_FrontFacing && holodeckBankViewerFade>0.0 && bankEyeAbove>.008 && distanceToWater<72.0){
      vec3 offset=toroidalWorld-holodeckBankCenter;
      vec2 chart=vec2(dot(offset,holodeckBankAlong),dot(offset,holodeckBankAcross));
      float bankFade=1.0-smoothstep(17.0,23.0,length(chart));
      if(bankFade>0.0){
        // Keep the small ripples in the sky reflection. The rough bank
        // image follows a calmer ray and spreads across the water.
        vec3 bankNormal=normalize(mix(nonPerturbedNormal,normal,.32));
        vec3 viewRay=reflect(-holoView,bankNormal);
        float bankElevation=dot(viewRay,holoUp);
        if(bankElevation>0.0){
          vec3 ray=transpose(mat3(viewMatrix))*viewRay;
          vec2 planarRay=vec2(dot(ray,holodeckBankAlong),dot(ray,holodeckBankAcross));
          float invRun=inversesqrt(max(dot(planarRay,planarRay),.000001));
          float slope=dot(ray,holodeckBankUp)*invRun;
          vec2 uv=chart/${glsl(REFLECTION_BANK.size)}+.5;
          vec2 stepUV=planarRay*(invRun/${glsl(REFLECTION_BANK.size)});
          float start=dot(offset,holodeckBankUp)+.5*${glsl(REFLECTION_BANK.heightRange)};
          const vec2 decodeHeight=vec2(256.0,1.0)*(${glsl(REFLECTION_BANK.heightRange)}/257.0);
          // Retain a near sample for the contact and a far sample for the
          // silhouette. The split was measured against the denser march.
          const float samples[4]=float[4](2.4,7.1,25.0,49.0);
          for(int tap=0;tap<4;tap++){
            float travel=samples[tap];
            vec2 encoded=textureLod(holodeckBankHeight,uv+stepUV*travel,0.0).rg;
            float over=dot(encoded,decodeHeight)-start-slope*travel;
            float width=1.04*(.10+.071*travel);
            float hit=smoothstep(-.22*width,.78*width,over);
            float gain=hit*(1.0-bankOcc);
            bankOcc+=gain;
            bankDist+=gain*travel;
            if(bankOcc>.98)break;
          }
          bankDist/=max(bankOcc,.001);
          bankOcc*=bankFade*holodeckBankViewerFade*smoothstep(.008,.08,bankEyeAbove)*
            smoothstep(0.0,.045,bankElevation)*(1.0-smoothstep(56.0,72.0,distanceToWater));
        }
      }
    }
    vec3 bankLight=bankHaze*vec3(.33,.44,.38)+vec3(.016,.023,.017)*holodeckDaylight;
    bankLight=mix(bankLight,bankHaze,1.0-exp(-bankDist*.012));
    reflectedAir=mix(reflectedAir,bankLight,bankOcc*.68);
`;

const waterShading = (reflectBank=false) => ({
  // Deep colour looking down, pale sky mirrored at grazing angles.
  output: `
    vec3 holoView = normalize(vViewPosition);
    float holoFresnel = pow(1.0 - clamp(dot(normal, holoView), 0.0, 1.0), 4.0);
    vec3 reflectedRay = reflect(-holoView,normal);
    vec3 reflectedAir=toroidalAir(dot(reflectedRay,holoSun),holodeckDaylight);
    float skyHeight=clamp(dot(reflectedRay,holoUp),0.0,1.0);
    float surfaceView=1.0-smoothstep(0.0,.08,holodeckWaterViewDepth);
    float nightSky=(1.0-holodeckDaylight)*surfaceView;
    reflectedAir+=vec3(.022,.038,.061)*nightSky*mix(.40,1.0,skyHeight);${reflectBank?'\n    vec3 bankHaze=reflectedAir;':''}
    if(holodeckHasCosmos && gl_FrontFacing && surfaceView>0.0 && holodeckDaylight<.85){
      // View space normals add wave detail, then the celestial map is
      // sampled in the same world axes as the sky.
      vec3 worldRay=transpose(mat3(viewMatrix))*reflectedRay;
      float window=toroidalCosmosWindow(skyHeight,holodeckDaylight)*(1.0-smoothstep(.21,.85,holodeckDaylight));
      vec3 skyLight=toroidalCosmos(holodeckCosmos,worldRay);
      float radiance=max(max(skyLight.r,skyLight.g),skyLight.b);
      reflectedAir=mix(reflectedAir,skyLight*1.12,window*surfaceView*smoothstep(.018,.24,radiance));
    }
    ${reflectBank?bankReflectionShading:''}
    vec3 depths=(outgoingLight-totalSpecular)*mix(.25,1.0,holodeckDaylight);
    depths+=holodeckDaylight*vec3(.025,.066,.084);
    outgoingLight=mix(depths,reflectedAir,.10+.54*holoFresnel+holoSwell*.07);
    outgoingLight = mix(outgoingLight, vec3(.30, .49, .47),
      .38*holoShallow*(1.0-.8*holoFresnel)*holodeckDaylight);
    ${aerialPerspective('',.68)}
    outgoingLight+=totalSpecular*(.65+.48*holoSwell)*(1.0-holoHaze*.68)${reflectBank?'*(1.0-.68*bankOcc)':''};
    // Opacity follows the signed depth at the fragment everywhere. Camera
    // submersion can change the lighting, never the transmission policy.
    float depth=max(0.0,toroidalShoreDepth);
    if(depth<3.5){
      float incident=max(.28,dot(normal,holoView));
      float transmission=exp(-.68*depth/incident);
      float edge=smoothstep(0.0,.075,depth);
      // Use the existing swell footprint (world metres times .092)
      // to broaden the shallow ramp for larger grazing pixels. Fade
      // back to the same optics as the back face near the waterline.
      float reflectedCoverage = 1.0;
      float aboveWater = holodeckEyeHeight-(${glsl(TOROIDAL_TERRAIN.waterLevel)});
      if (gl_FrontFacing && aboveWater > .008) {
        float reach = clamp(15.6*footprint,.16,.55);
        reflectedCoverage -= exp(-depth/reach)*smoothstep(.008,.08,aboveWater);
      }
      float opticalOpacity=mix(1.0-transmission,diffuseColor.a,holoFresnel*reflectedCoverage);
      opticalOpacity=mix(clamp(opticalOpacity,.04,diffuseColor.a),diffuseColor.a,smoothstep(2.30,3.5,depth));
      float contact=smoothstep(.026,.105,depth)*(1.0-smoothstep(.13,.39,depth));
      float ripple=smoothstep(.07,.28,holoSwell);
      float whitewater=gl_FrontFacing?surfaceView*contact*ripple*.24*(1.0-smoothstep(16.0,49.0,distanceToWater)):0.0;
      outgoingLight=mix(outgoingLight,vec3(.61,.75,.69)*mix(.25,1.0,holodeckDaylight),whitewater);
      diffuseColor.a=edge*max(opticalOpacity,whitewater);
    }
  `,
});

function artDirect(material, name, shading, environment, bank=null) {
  // The ring's own aerial perspective stands in for the scene fog.
  material.fog = false;
  const surfaceCompile = material.onBeforeCompile;
  material.customProgramCacheKey = () => `holodeck-ring-${name}`;
  material.onBeforeCompile = shader => {
    surfaceCompile(shader);
    const after = (source, chunk, code) => source.replace(`#include <${chunk}>`, match => `${match}\n${code}`);
    const before = (source, chunk, code) => source.replace(`#include <${chunk}>`, match => `${code}\n${match}`);
    shader.vertexShader = after(after(shader.vertexShader, 'common', varyings+'uniform vec3 holodeckSunLocal;'), 'project_vertex', vertexFrame);
    let fragment = after(shader.fragmentShader, 'common',varyings);
    if (shading.color) fragment = after(fragment, 'color_fragment', shading.color);
    // The night key shapes solid objects. Water retains its authored sky
    // reflection and the existing direct porch light near the threshold.
    fragment = fragment.replace('#include <lights_fragment_begin>', () => radialSunLights(name.startsWith('water')));
    if (shading.fill) fragment = before(fragment, 'lights_fragment_end', shading.fill);
    shader.uniforms.holodeckSunLocal=environment.sun;
    shader.uniforms.holodeckDaylight=environment.daylight;
    shader.uniforms.holodeckEyeHeight=environment.eyeHeight;
    shader.uniforms.holodeckWaterViewDepth=environment.water;
    shader.uniforms.holodeckApproachArt=environment.approach;
    shader.uniforms.holodeckSill=environment.sill;
    fragment=after(fragment,'common','uniform float holodeckWaterViewDepth; uniform float holodeckDaylight; uniform float holodeckApproachArt; uniform vec3 holodeckSill; uniform float holodeckEyeHeight;'+toroidalAirColor);
    if(name.startsWith('water')){
      shader.uniforms.holodeckCosmos=environment.cosmos;
      shader.uniforms.holodeckHasCosmos=environment.hasCosmos;
      fragment=after(fragment,'common','uniform sampler2D holodeckCosmos; uniform bool holodeckHasCosmos;'+toroidalCosmosColor);
    }
    if(bank){
      Object.assign(shader.uniforms,bank);
      fragment=after(fragment,'common',`
        uniform sampler2D holodeckBankHeight;
        uniform float holodeckBankViewerFade;
        uniform vec3 holodeckBankCenter, holodeckBankAlong, holodeckBankAcross, holodeckBankUp;
      `);
    }
    if(name==='terrain'){
      shader.uniforms.holodeckMeadowCover=environment.meadowCover;
      shader.uniforms.holodeckFacadeGround=environment.facadeGround;
      shader.uniforms.woodlandShadeMap=environment.woodlandShade;
      shader.uniforms.holodeckWoodlandShade=environment.hasWoodlandShade;
      fragment=after(fragment,'common','uniform bool holodeckWoodlandShade;'+woodlandShadeShader+spurTrack);
      fragment=after(fragment,'common','uniform sampler2D holodeckMeadowCover; uniform vec4 holodeckFacadeGround;');
    }
    shader.fragmentShader=before(fragment,'opaque_fragment',shading.output+`
      if (holodeckWaterViewDepth > .014) {
        float scatter = 1.0 - exp(-length(vViewPosition) * (.055 + .006*min(12.0,holodeckWaterViewDepth)));
        outgoingLight = mix(outgoingLight*vec3(.4,.78,.82),vec3(.025,.152,.211)*mix(.26,1.0,holodeckDaylight),scatter);
        ${name.startsWith('water')?`if (!gl_FrontFacing) {
          float glow = pow(clamp(abs(dot(normal,normalize(vViewPosition))),0.0,1.0),.7);
          outgoingLight = mix(outgoingLight,vec3(.18,.42,.49)*mix(.26,1.0,holodeckDaylight),.28+.28*glow);
        }`:''}
      }`);
  };
  return material;
}

function tileKey(tile, segments) {
  return `${tile.key}:${tile.coarseEdges ?? 0}:${segments}`;
}

function meshFor(data, material) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
  if(data.colors)geometry.setAttribute('color',new BufferAttribute(data.colors,3));
  if(data.depth)geometry.setAttribute('shoreDepth',new BufferAttribute(data.depth,1));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return new Mesh(geometry,material);
}

function createTile(data, material, waterMaterial) {
  const mesh = meshFor(data,material);
  if(data.water){
    const water=meshFor(data.water,waterMaterial);
    water.name='Water surface';
    mesh.add(water);
  }
  mesh.position.fromArray(data.origin);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

function releaseTile(tile) {
  tile.traverse(mesh=>mesh.geometry?.dispose());
}

function viewerKey(viewer, profile) {
  const longitude = TOROIDAL_TERRAIN.rootColumns * 2 ** TOROIDAL_TERRAIN.maxLevel;
  const latitude = 2 ** TOROIDAL_TERRAIN.maxLevel;
  return `${profile}:${Math.floor(viewer.u * longitude)}:${Math.floor(viewer.v * latitude)}:${Math.floor(viewer.height / 12)}`;
}

export class ToroidalTerrainRenderer {
  constructor(scene, base, WorkerType = globalThis.Worker, {bankReflection=false}={}) {
    this.group = new Group();
    this.group.name = 'Toroidal terrain';
    this.material = new MeshStandardMaterial({vertexColors:true,roughness:.96});
    this.waterMaterial = new MeshStandardMaterial({color:0x19606f,roughness:.34,metalness:0,side:DoubleSide,
      transparent:true,opacity:WATER_OPACITY,depthWrite:false,forceSinglePass:true});
    this.environment={water:{value:0},sun:{value:new Vector3(...SUN_LOCAL)},daylight:{value:1},
      cosmos:{value:null},hasCosmos:{value:false},approach:{value:1},eyeHeight:{value:0},sill:{value:new Vector3()},facadeGround:{value:new Vector4(0,0,0,0)},meadowCover:{value:createMeadowCoverTexture()},woodlandShade:{value:null},hasWoodlandShade:{value:false},lightWater:{value:false}};
    useToroidalRockDetail(this.material,{meadow:true});
    this.updateWaterTime=useToroidalWaterDetail(this.waterMaterial,this.environment.lightWater);
    artDirect(this.material,'terrain',terrainShading,this.environment);
    artDirect(this.waterMaterial,'water',waterShading(),this.environment);
    this.visibleWaterMaterial=this.waterMaterial;
    this.bankReflection=bankReflection;
    if(bankReflection)this.bankViewerFade={value:0};
    this.active = new Map();
    this.target = null;
    this.requested = null;
    this.selectedKey = null;
    this.inFlight = null;
    this.disposed = false;
    for (let column = 0; column < TOROIDAL_TERRAIN.rootColumns; column += 1) {
      const tile = terrainTile(0, column, 0);
      const mesh = createTile(buildTerrainTile(tile, ROOT_SEGMENTS), this.material, this.waterMaterial);
      this.active.set(tileKey(tile, ROOT_SEGMENTS), mesh);
      this.group.add(mesh);
    }
    scene.add(this.group);
    try {
      this.worker = new WorkerType(new URL('client/toroidal-terrain-worker.js', base), {type: 'module'});
      this.worker.onmessage = ({data}) => this.receive(data);
      this.worker.onerror = event => {
        event.preventDefault();
        this.stopWorker();
      };
    } catch {
      this.stopWorker();
    }
  }

  setEntrance(door){
    const sill=this.environment.sill.value;
    if(!door){sill.set(0,0,0);return;}
    const x=door.x-TOROIDAL_TERRAIN.majorRadius;
    if(![x,door.y,door.z].every(Number.isFinite)||Math.abs(x)>8||
       Math.abs(door.y-TOROIDAL_PARCEL_Y)>2||door.z<8||door.z>37||Math.abs(door.facing)!==1){
      sill.set(0,0,0);
      return;
    }
    sill.set(x,door.z,door.facing);
  }

  setFacadeContact(facade){
    const footprint=this.environment.facadeGround.value;
    if(!facade){footprint.set(0,0,0,0);return;}
    facade.updateWorldMatrix(true,false);
    const m=facade.matrixWorld.elements;
    footprint.set(m[12],m[14],
      Math.abs(m[0])*ATELIER_PLINTH.x+Math.abs(m[8])*ATELIER_PLINTH.z,
      Math.abs(m[2])*ATELIER_PLINTH.x+Math.abs(m[10])*ATELIER_PLINTH.z);
  }

  setView(eye,waterDepth,panorama=null){
    this.environment.cosmos.value=panorama;
    this.environment.hasCosmos.value=panorama!==null;
    this.environment.water.value=waterDepth;
    this.environment.eyeHeight.value=terrainCoordinates([eye.x,eye.y,eye.z]).height;
  }

  setWoodlandShade(texture){
    this.environment.woodlandShade.value=texture;
    this.environment.hasWoodlandShade.value=texture!==null;
  }

  setSun(solar,direction=solar.direction){
    this.environment.sun.value.fromArray(direction);
    this.environment.daylight.value=solar.daylight;
  }

  get hasDetailedTerrain() {
    // Keep using the committed mesh while another viewer selection streams.
    return this.selectedKey !== null;
  }

  installReflectionBank(data){
    if(data?.byteLength!==REFLECTION_BANK.size**2*2)return;
    const {size,center,along,across,up}=REFLECTION_BANK;
    const texture=new DataTexture(data,size,size,RGFormat,UnsignedByteType);
    texture.minFilter=texture.magFilter=LinearFilter;
    texture.needsUpdate=true;
    const material=this.waterMaterial.clone();
    this.updateReflectionTime=useToroidalWaterDetail(material,this.environment.lightWater);
    artDirect(material,'water-bank',waterShading(true),this.environment,{
      holodeckBankHeight:{value:texture},holodeckBankViewerFade:this.bankViewerFade,
      holodeckBankCenter:{value:new Vector3(...center)},
      holodeckBankAlong:{value:new Vector3(...along)},holodeckBankAcross:{value:new Vector3(...across)},
      holodeckBankUp:{value:new Vector3(...up)},
    });
    this.reflectionTexture=texture;
    this.reflectionMaterial=material;
  }

  receiveBankRows({row,rows},data){
    const stride=REFLECTION_BANK.size*2;
    if(data?.byteLength!==stride*rows){
      this.bankBuild=null;
      this.bankFinished=true;
      return;
    }
    const bytes=this.bankBuild?.bytes??new Uint8Array(stride*REFLECTION_BANK.size);
    bytes.set(data,row*stride);
    const next=row+rows;
    if(next===REFLECTION_BANK.size){
      this.bankBuild=null;
      this.bankFinished=true;
      this.installReflectionBank(bytes);
    }else this.bankBuild={bytes,next};
  }

  selectWaterMaterial(){
    const material=this.bankWanted&&this.reflectionMaterial||this.waterMaterial;
    if(material===this.visibleWaterMaterial)return;
    this.visibleWaterMaterial=material;
    for(const meshes of [this.active,this.target?.received])
      for(const mesh of meshes?.values()??[]){
        if(mesh.children[0])mesh.children[0].material=material;
      }
  }

  update(position, lightweight = false) {
    this.environment.lightWater.value=lightweight;
    if (!this.worker || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    const viewer = terrainCoordinates([position.x, position.y, position.z]);
    const profile = lightweight ? 'light' : 'normal';
    const time=(performance.now()/1000)%3600;
    this.updateWaterTime(time);
    if(this.bankReflection){
      const [x,y,z]=REFLECTION_BANK.center;
      const distance=Math.hypot(position.x-x,position.y-y,position.z-z);
      this.bankWanted=!lightweight&&distance<46;
      this.bankViewerFade.value=1-MathUtils.smoothstep(distance,38,44);
      this.selectWaterMaterial();
      if(this.visibleWaterMaterial===this.reflectionMaterial)this.updateReflectionTime(time);
    }
    this.requested = {viewer, profile, key: viewerKey(viewer, profile)};
    this.pump();
  }

  pump() {
    if (!this.worker || !this.requested || this.inFlight) return;
    const request = this.requested;
    if (this.target?.key !== request.key) this.discardTarget();
    if (this.selectedKey === request.key){
      if(this.bankWanted&&!this.bankFinished){
        const row=this.bankBuild?.next??0;
        const rows=Math.min(20,REFLECTION_BANK.size-row);
        this.inFlight={kind:'reflection-bank',row,rows};
        this.worker.postMessage(this.inFlight);
      }
      return;
    }
    if (!this.target) {
      this.inFlight = {kind: 'select', request};
      this.worker.postMessage({kind: 'select', viewer: request.viewer,
        options: {budget: profiles[request.profile].budget}});
      return;
    }
    const target = this.target;
    if (!target) return;
    const next = target.missing[target.received.size];
    if (!next) {
      this.commit();
      return;
    }
    this.inFlight = {kind: 'mesh', target, key: next.key};
    this.worker.postMessage({kind: 'mesh', tile: next.tile, segments: target.segments});
  }

  receive(data) {
    const job = this.inFlight;
    if (!job || this.disposed) return;
    this.inFlight = null;
    if(job.kind==='reflection-bank'){
      this.receiveBankRows(job,data.bank);
      this.pump();
      return;
    }
    if (data.failed) {
      this.stopWorker();
      return;
    }
    if (job.kind === 'select' && job.request.key === this.requested.key) {
      const {segments} = profiles[job.request.profile];
      const entries = data.tiles.map(tile => ({key: tileKey(tile, segments), tile}));
      const missing = entries.filter(({key}) => !this.active.has(key));
      this.target = {key: job.request.key, entries, missing, segments, received: new Map()};
    } else if (job.kind === 'mesh' && job.target === this.target && job.target.key === this.requested.key) {
      job.target.received.set(job.key, createTile(data.mesh, this.material, this.visibleWaterMaterial));
    }
    this.pump();
  }

  commit() {
    const target = this.target;
    const next = new Map();
    for (const {key} of target.entries) {
      const existing = this.active.get(key);
      const mesh = existing ?? target.received.get(key);
      next.set(key, mesh);
      if (!existing) this.group.add(mesh);
    }
    for (const [key, mesh] of this.active) {
      if (next.has(key)) continue;
      this.group.remove(mesh);
      releaseTile(mesh);
    }
    this.active = next;
    this.selectedKey = target.key;
    this.target = null;
  }

  discardTarget() {
    for (const mesh of this.target?.received.values() ?? []) releaseTile(mesh);
    this.target = null;
  }

  stopWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.inFlight = null;
    this.discardTarget();
    this.bankBuild = null;
    this.bankWanted = false;
    this.selectWaterMaterial();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopWorker();
    for (const mesh of this.active.values()) releaseTile(mesh);
    this.active.clear();
    this.selectedKey = null;
    this.requested = null;
    this.group.clear();
    this.group.removeFromParent();
    this.material.dispose();
    this.environment.meadowCover.value.dispose();
    this.environment.meadowCover.value=null;
    this.environment.cosmos.value=null;
    this.environment.hasCosmos.value=false;
    this.bankBuild=null;
    this.reflectionTexture?.dispose();
    this.reflectionMaterial?.dispose();
    this.waterMaterial.dispose();
  }

  status() {
    return {
      visibleTiles: this.active.size,
      stagedTiles: this.target?.received.size ?? 0,
      settled: this.selectedKey !== null && this.selectedKey === this.requested?.key,
      worker: this.worker !== null,
    };
  }
}
