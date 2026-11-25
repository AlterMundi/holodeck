import {useToroidalRockDetail,useToroidalWaterDetail} from './toroidal-surface-detail.mjs';
import {BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, ShaderChunk, Vector3} from 'three';
import {
  TOROIDAL_PARCEL_Y, TOROIDAL_TERRAIN, buildTerrainTile, terrainCoordinates, terrainFrame, terrainTile,
} from './toroidal-terrain.mjs';

const profiles = Object.freeze({
  normal: {budget: 112, segments: 16},
  light: {budget: 64, segments: 12},
});
const ROOT_SEGMENTS = 16;

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
const radialSunLights = `
  vec3 holoUp = normalize(vHoloUp);
  vec3 holoSun = normalize(vHoloSun);
  ${ShaderChunk.lights_fragment_begin.replace(/getDirectionalLightInfo\([^;]*;/,
    match => `${match}\n directLight.direction = holoSun;`)}
`;
// Aerial perspective replaces the linear scene fog on the ring: nearby ridges
// keep their dark value against the pale sky, each farther layer turns paler
// and bluer, and the air warms toward the sun.
const aerialPerspective = `
  float holoHaze = (1.0 - exp(-length(vViewPosition) / 1900.0)) * 0.84;
  float holoGlow = pow(max(dot(-holoView, holoSun), 0.0), 5.0);
  vec3 holoAir = mix(vec3(0.24, 0.33, 0.44), vec3(0.50, 0.44, 0.36), holoGlow * 0.6);
  holoAir = mix(vec3(.014,.021,.048),holoAir,holodeckDaylight);
  outgoingLight = mix(outgoingLight * mix(.32,1.0,holodeckDaylight), holoAir, holoHaze);
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
    float edge = abs(length(vHoloWorld.xz) - ${glsl(TOROIDAL_TERRAIN.majorRadius)});
    // Paint the walkable meadow in local XZ metres. The old rock projection
    // compresses one axis on this horizontal shoulder, stretching its grain.
    float meadowFootprint = max(length(dFdx(approach)),length(dFdy(approach)));
    float meadowSlope = dot(normalize(vNormal),normalize(vHoloUp));
    float holoMeadowGround = (1.0-smoothstep(32.0,76.0,length(approach)))
      * smoothstep(.87,.98,meadowSlope)
      * smoothstep(4.0,12.0,vHoloHeight)
      * smoothstep(370.0,460.0,vHoloWorld.y);
    // Match the continuous worn trail outside the locally painted arrival.
    float arrival = smoothstep(6.0,10.0,approach.y)*(1.0-smoothstep(37.0,51.0,approach.y));
    float holoMeadow = holoMeadowGround * smoothstep(1.15+arrival*.9,3.65+arrival*.7,edge);
    float holoMeadowRoughness = .96;
    if (holoMeadow > .001) {
      vec2 field = mat2(.94,.34,-.34,.94)*approach;
      float patchWeight = 1.0-smoothstep(.38,.72,.47*meadowFootprint);
      float growth = patchWeight > .001 ? (ringNoise(field*.47+vec2(9.4,21.8))-.5)*patchWeight : 0.0;
      float broadWeight = 1.0-smoothstep(.38,.72,.105*meadowFootprint);
      float broad = ringNoise(field*vec2(.105,.078)+vec2(31.2,8.8)+growth*vec2(.14,-.11))-.5;
      float seedHeads = mix(.19,smoothstep(.01,.39,broad+growth*.23),broadWeight);
      float fresh = mix(.74,smoothstep(-.39,.08,broad+growth*.36),broadWeight);
      vec3 meadowColor = mix(vec3(.113,.210,.061),vec3(.192,.314,.084),fresh);
      meadowColor = mix(meadowColor,vec3(.337,.281,.103),seedHeads*.87);
      meadowColor *= 1.0 + growth*.14;
      float grainWeight = 1.0-smoothstep(.32,.62,6.8*meadowFootprint);
      if (holodeckMeadowGrain > .5 && grainWeight > .001) {
        meadowColor *= 1.0 + (ringNoise(field*6.8+vec2(5.8,17.0))-.5)*grainWeight*.25;
      }
      diffuseColor.rgb = mix(diffuseColor.rgb,meadowColor,holoMeadow);
      holoMeadowRoughness = mix(.91,.99,seedHeads);
    }
    if (holodeckApproachArt > .5 && abs(approach.x) < 14.0 &&
        approach.y > 6.0 && approach.y < 51.0 && vHoloWorld.y > 0.0) {
      float endFade = arrival;
      float edgeNoise = ringNoise(approach*.89)-.5;
      float mask = (1.0-smoothstep(1.57,2.72,edge+edgeNoise*.66))*endFade;
      float shoulder = smoothstep(2.15,3.12,edge)*(1.0-smoothstep(3.65,6.8,edge))*endFade;
      holoApproachSkylight = endFade*(1.0-smoothstep(2.0,9.0,edge));
      float pebble = smoothstep(.58,.86,ringNoise(approach*4.6))
        *(1.0-smoothstep(12.0,34.0,length(vViewPosition)));
      vec3 packedEarth = mix(vec3(.35,.236,.127),vec3(.52,.389,.224),.38+.36*edgeNoise+.25*pebble);
      diffuseColor.rgb = mix(diffuseColor.rgb,packedEarth,mask*.88);
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.114,.191,.068)*(.88+.42*edgeNoise),shoulder*.61);

      // Join the path to the sill in the entrance's cross-path frame.
      vec3 door = holodeckSill;
      vec2 apron = vec2((approach.x-door.x)*door.z,approach.y-door.y);
      if (abs(door.z) > .5 && abs(apron.y) < 2.8 && apron.x > -4.8 && apron.x < 1.25) {
        float towardPath = 1.0-smoothstep(-2.5,.12,apron.x);
        float curve = -.94*towardPath*towardPath;
        float width = mix(.74,1.42,towardPath);
        float end = smoothstep(-3.8,-2.55,apron.x)*(1.0-smoothstep(.97,1.24,apron.x));
        float apronMask = (1.0-smoothstep(width-.15,width+.18,abs(apron.y-curve)+edgeNoise*.18))*end;
        float flags = smoothstep(-1.27,-.62,apron.x)*apronMask;
        vec2 paving = apron/vec2(.51,.63);
        paving.x += .47*mod(floor(paving.y),2.0);
        paving += .17*vec2(ringNoise(apron*6.1),ringNoise(apron.yx*7.2+4.0));
        vec2 cell = floor(paving);
        vec2 rim = .5-abs(fract(paving)-.5);
        float joint = min(rim.x,rim.y);
        float footprint = max(flagFootprint.x,flagFootprint.y);
        float aa = clamp(footprint,.012,.095);
        float slab = smoothstep(.025-aa,.049+aa,joint);
        float tint = ringNoise(cell*.71+vec2(17.0,4.0));
        vec3 stone = mix(vec3(.173,.144,.108),vec3(.375,.331,.247),tint);
        stone *= .90+.20*ringNoise(apron*11.0);
        vec3 flagstone = mix(vec3(.117,.097,.068),stone,slab);
        flagstone = mix(flagstone,vec3(.237,.204,.151),smoothstep(.35,.9,footprint));
        vec3 apronEarth = mix(packedEarth,vec3(.273,.198,.122),.53);
        diffuseColor.rgb = mix(diffuseColor.rgb,apronEarth,apronMask*.83);
        diffuseColor.rgb = mix(diffuseColor.rgb,flagstone,flags*.95);
        holoApproachSkylight = max(holoApproachSkylight,apronMask*.85);
      }
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
    ${aerialPerspective}
  `,
};
const waterShading = {
  // Deep colour looking down, pale sky mirrored at grazing angles.
  output: `
    vec3 holoView = normalize(vViewPosition);
    float holoFresnel = pow(1.0 - clamp(dot(normal, holoView), 0.0, 1.0), 4.0);
    outgoingLight = mix(outgoingLight - totalSpecular, vec3(0.55, 0.66, 0.74),
      0.06 + 0.8 * holoFresnel) + totalSpecular;
    outgoingLight = mix(outgoingLight, vec3(.30, .49, .47),
      .38 * holoShallow * (1.0 - .8*holoFresnel));
    ${aerialPerspective}
  `,
};

function artDirect(material, name, shading, environment) {
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
    fragment = fragment.replace('#include <lights_fragment_begin>', () => radialSunLights);
    if (shading.fill) fragment = before(fragment, 'lights_fragment_end', shading.fill);
    shader.uniforms.holodeckSunLocal=environment.sun;
    shader.uniforms.holodeckDaylight=environment.daylight;
    shader.uniforms.holodeckWaterViewDepth=environment.water;
    shader.uniforms.holodeckApproachArt=environment.approach;
    shader.uniforms.holodeckSill=environment.sill;
    fragment=after(fragment,'common','uniform float holodeckWaterViewDepth; uniform float holodeckDaylight; uniform float holodeckApproachArt; uniform vec3 holodeckSill;');
    if(name==='terrain'){
      shader.uniforms.holodeckMeadowGrain=environment.meadowGrain;
      fragment=after(fragment,'common','uniform float holodeckMeadowGrain;');
    }
    shader.fragmentShader=before(fragment,'opaque_fragment',shading.output+`
      if (holodeckWaterViewDepth > .014) {
        float scatter = 1.0 - exp(-length(vViewPosition) * (.055 + .006*min(12.0,holodeckWaterViewDepth)));
        outgoingLight = mix(outgoingLight*vec3(.4,.78,.82),vec3(.025,.152,.211)*mix(.26,1.0,holodeckDaylight),scatter);
        ${name==='water'?`if (!gl_FrontFacing) {
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
  constructor(scene, base, WorkerType = globalThis.Worker) {
    this.group = new Group();
    this.group.name = 'Toroidal terrain';
    this.material = new MeshStandardMaterial({vertexColors:true,roughness:.96});
    this.waterMaterial = new MeshStandardMaterial({color:0x19606f,roughness:.34,metalness:0,side:DoubleSide});
    this.environment={water:{value:0},sun:{value:new Vector3(...SUN_LOCAL)},daylight:{value:1},
      approach:{value:1},sill:{value:new Vector3()},meadowGrain:{value:1}};
    useToroidalRockDetail(this.material,{meadow:true});
    this.updateWaterTime=useToroidalWaterDetail(this.waterMaterial);
    artDirect(this.material,'terrain',terrainShading,this.environment);
    artDirect(this.waterMaterial,'water',waterShading,this.environment);
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

  setWaterViewDepth(depth){this.environment.water.value=depth;}

  setSun(solar){
    this.environment.sun.value.fromArray(solar.direction);
    this.environment.daylight.value=solar.daylight;
  }

  update(position, lightweight = false) {
    this.environment.meadowGrain.value=lightweight?0:1;
    if (!this.worker || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    const viewer = terrainCoordinates([position.x, position.y, position.z]);
    const profile = lightweight ? 'light' : 'normal';
    this.updateWaterTime((performance.now()/1000)%3600);
    this.requested = {viewer, profile, key: viewerKey(viewer, profile)};
    this.pump();
  }

  pump() {
    if (!this.worker || !this.requested || this.inFlight) return;
    const request = this.requested;
    if (this.target?.key !== request.key) this.discardTarget();
    if (this.selectedKey === request.key) return;
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
      job.target.received.set(job.key, createTile(data.mesh, this.material, this.waterMaterial));
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
