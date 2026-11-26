import {approachCoordinates,Sand3DTrail} from './sand3d-trail.mjs';
import {ToroidalWoodland} from './toroidal-woodland.mjs';
import {ToroidalOverlook} from './toroidal-overlook.mjs';
import {ToroidalMeadowBanks} from './toroidal-meadow-banks.mjs';
import {
  BufferGeometry, Color, DodecahedronGeometry, DoubleSide, Float32BufferAttribute, Group,
  InstancedMesh, MeshStandardMaterial, Object3D, Vector3,
} from 'three';
import {CAVE} from './toroidal-cave.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {
  overlookCoordinates, TOROIDAL_TERRAIN, terrainCoordinates, terrainElevation, terrainMeadowMoisture, terrainPosition, terrainTile, terrainTrail, terrainWoodland,
} from './toroidal-terrain.mjs';

const LEVEL=7;
const RANGE=2;
const CANDIDATES=12;
const FIELD_LEVEL=9;
const FIELD_RANGE=5;
const FIELD_DENSITY=42;
const FIELD_NEAR=2;
const FIELD_LIMIT=(2*FIELD_RANGE+1)**2*FIELD_DENSITY;
const INSTANCE_LIMIT=(2*RANGE+1)**2*CANDIDATES;
const GRASSES=[0x72874b,0x809154,0x667d48,0x99a35e,0xbaaa65];
const FRESH_GRASS=[0x536f41,0x608445,0x426440,0x75964a];
const DRY_GRASS=[0x868041,0xa39a53,0x72763c,0xb3a35d];
const STONES=[0x74664f,0x7d7d70,0x8b7860,0x66635c,0x9f8a73];

function grassColor(moisture,tint){
  const palette=moisture>.58?FRESH_GRASS:moisture<.45?DRY_GRASS:GRASSES;
  return palette[Math.floor(tint*palette.length)];
}
const overlookStart=overlookCoordinates(-4.1,-8);
const overlookEnd=overlookCoordinates(4.1,7.4);

function random(cell,index,salt) {
  let n=Math.imul(cell.column + 1,73856093)^Math.imul(cell.row+1,19349663)^
    Math.imul(index+1,83492791)^salt^TOROIDAL_TERRAIN.seed;
  n=Math.imul(n^(n>>>16),0x7feb352d);
  n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967296;
}

export function sceneryForCell(cell,count=CANDIDATES) {
  const instances=[];
  for(let i=0;i<count;i++){
    const pick=salt=>random(cell,i,salt);
    const u=(cell.column+pick(17))/cell.columns;
    const v=(cell.row+pick(41))/cell.rows;
    if(u>overlookStart.u&&u<overlookEnd.u&&v>overlookStart.v&&v<overlookEnd.v)continue;
    const h=terrainElevation(u,v);
    if(h<TOROIDAL_TERRAIN.waterLevel+.22||terrainTrail(u,v)>.22)continue;
    const distanceFromHouse=Math.hypot(Math.min(u,1-u)*TOROIDAL_TERRAIN.majorRadius,
      (v-.25)*TOROIDAL_TERRAIN.tubeRadius);
    if(distanceFromHouse<5.4)continue;
    if(u>CAVE.from-.00025&&u<CAVE.to+.00025&&Math.abs(v-CAVE.latitude)<.0029)continue;
    const moisture=terrainMeadowMoisture(u,v,h);
    const stony=h>37||h<TOROIDAL_TERRAIN.waterLevel+2.5||pick(7)<.16+(1-moisture)*.17;
    const size=stony?.20+pick(53)**1.7*.79:.25+pick(53)**1.4*.41;
    const tint=pick(97);
    instances.push({kind:stony?'stone':'grass',u,v,h,size,yaw:pick(29)*Math.PI*2,
      color:stony?STONES[Math.floor(tint*STONES.length)]:grassColor(moisture,tint)});
  }
  return instances;
}

// The cells use canonical torus indices. Their vegetation stays rooted on
// the same metre of soil through movement, tile eviction and graphics changes.
function fieldTile(column,row){
  const rows=2**FIELD_LEVEL,columns=rows*TOROIDAL_TERRAIN.rootColumns;
  column=(column+columns)%columns;
  row=(row+rows)%rows;
  return {key:column+':'+row,column,row,columns,rows};
}

function meadowCell(cell,index,door){
  const pick=salt=>random(cell,index,salt);
  const u=(cell.column+pick(103))/cell.columns;
  const v=(cell.row+pick(181))/cell.rows;
  const xOffset=(.25-v)*TAU*(TOROIDAL_TERRAIN.tubeRadius+18);
  const zOffset=(u-Math.round(u))*TAU*TOROIDAL_TERRAIN.majorRadius;
  if(Math.abs(xOffset)<5.8&&Math.abs(zOffset-15.5)<8.2)return null;
  if(door&&Math.abs(zOffset-door.z)<3.3&&Math.abs(xOffset-(door.x-TOROIDAL_TERRAIN.majorRadius))<5.2)return null;
  if(u>CAVE.from-.00029&&u<CAVE.to+.00029&&Math.abs(v-CAVE.latitude)<.0031)return null;
  if(u>overlookStart.u&&u<overlookEnd.u&&v>overlookStart.v&&v<overlookEnd.v)return null;
  if(terrainTrail(u,v)>.12)return null;
  const h=terrainElevation(u,v);
  if(h<TOROIDAL_TERRAIN.waterLevel+1.4||h>51)return null;
  const fold=349*TAU*u+188*TAU*v+1.3*Math.sin(54*TAU*u-93*TAU*v);
  const pocket=287*TAU*u-420*TAU*v+.9*Math.sin(76*TAU*u+58*TAU*v);
  const moisture=terrainMeadowMoisture(u,v,h);
  const growth=(.47+moisture*.19+.21*Math.sin(fold)+.17*Math.sin(pocket))*(1-.40*terrainWoodland(u,v,h));
  if(pick(229)>growth)return null;
  const vigor=pick(421)**1.6;
  return {u,v,h,yaw:pick(321)*TAU,size:.30+vigor*.51+growth*.14,
    color:grassColor(moisture,pick(499))};
}

function meadowWind(material,clock,motion){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.fieldClock=clock;
    shader.uniforms.fieldMotion=motion;
    shader.vertexShader=`uniform float fieldClock;
uniform float fieldMotion;
varying vec3 meadowUp;
`+shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       mat4 tuft=modelMatrix*instanceMatrix;
       vec3 root=tuft[3].xyz;
       meadowUp=mat3(viewMatrix)*tuft[1].xyz;
       float sway=sin(dot(root,vec3(.37,.16,.19))+fieldClock*5.0);
       float bend=clamp(position.y,0.0,1.0);
       transformed.x+=sway*bend*bend*.16*fieldMotion;
       transformed.z+=cos(sway+fieldClock*2.0)*bend*bend*.075*fieldMotion;
       float distanceToTuft=distance(cameraPosition,root);
       float offset=2.4*(fract(dot(root,vec3(.38,.19,.63)))-.5);
       float retention=1.0-smoothstep(17.0+offset,27.0+offset,distanceToTuft);
       transformed.y=mix(-.16,transformed.y,retention);
       transformed.xz*=smoothstep(0.0,.76,retention);`);
    shader.fragmentShader=`varying vec3 meadowUp;
`+shader.fragmentShader.replace('#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
       normal=normalize(mix(normal,normalize(meadowUp),.68));`);
  };
  const key=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>key()+'-meadow-wind';
}

// Indexed ribbons share their vertices between height bands. The roots hold
// their soil contact while the taper and bend read against the distant slopes.
function meadowBlades(count,lightweight=false,fieldCoverage=0){
  const positions=[],colors=[],faces=[];
  const levels=lightweight?[0,.54,1]:[0,.32,.68,1];
  const field=fieldCoverage>0;
  const taper=field ? .62 : .81;
  for(let blade=0;blade<count;blade++){
    const angle=blade*2.39996+.19*Math.sin(blade*4.17);
    const x=Math.cos(angle),z=Math.sin(angle);
    const tall=blade<2;
    const tipHeight=.55+.28*(.5+.5*Math.sin(blade*6.34+blade*blade*.35));
    const height=field&&!tall ? tipHeight*.84 : tipHeight;
    const spread=.21+.30*(.5+.5*Math.cos(blade*2.12));
    const coverage=field ? (tall ? 1.42 : 1.98)*fieldCoverage : 1;
    const width=(.024+.013*(.5+.5*Math.cos(blade*3.09)))*coverage;
    const base=positions.length/3;
    for(let level=0;level<levels.length;level++){
      const t=levels[level],tip=t===1;
      const radial=.041+spread*t*t,lateral=.04*t*Math.sin(blade);
      const brightness=.39+.61*t;
      for(const side of (tip?[0]:[-1,1])){
        const edge=lateral+width*(1-t*taper)*side;
        positions.push(x*radial-z*edge,t*(height+.09)-.14,z*radial+x*edge);
        const red=field ? 1.04-.03*t : .87+.14*t;
        const blue=field ? .88+.04*t : 1.08-.16*t;
        colors.push(brightness*red,brightness,brightness*blue);
      }
      if(!level)continue;
      const lo=base+2*(level-1);
      faces.push(lo,lo+1,lo+2);
      if(!tip)faces.push(lo+2,lo+1,lo+3);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

function trailFlowerGeometry() {
  const points=[], colors=[];
  const triangle=(a,b,c,shades,tint=[1,1,1])=>{
    points.push(...a,...b,...c);
    for(const shade of shades)colors.push(...tint.map(value=>shade*value));
  };
  for(let i=0;i<3;i++){
    const angle=i*2.39996, x=Math.cos(angle),z=Math.sin(angle);
    const root=[.16*x,-.14,.16*z], width=.105+.014*(i%3);
    const left=[.29*x-z*width,.48,.29*z+x*width];
    const right=[.29*x+z*width,.48,.29*z-x*width];
    const tip=[.63*x,.74+(i%3)*.09,.63*z];
    const base=[root[0]+z*width*.55,-.14,root[2]-x*width*.55];
    const tint=[.22,.43,.13];
    triangle(root,left,right,[.39,.68,.76],tint);
    triangle(root,right,base,[.39,.76,.42],tint);
    triangle(left,tip,right,[.68,1,.76],tint);
  }
  for(const [x,z] of [[.036,0],[0,.036]]) {
    triangle([-x,-.12,-z],[x,-.12,z],[x,.92,z],[.58,.58,.79],[.22,.43,.13]);
    triangle([-x,-.12,-z],[x,.92,z],[-x,.92,-z],[.58,.79,.79],[.22,.43,.13]);
  }
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5;
    const petal=offset=>[Math.cos(angle+offset)*.23,.95,Math.sin(angle+offset)*.23];
    triangle([0,.86,0],petal(-.40),petal(.40),[.77,.96,1],[1,.67,.31]);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(points,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

const ribbonPalette=[0x83994b,0x608847,0x9c9e59,0xb2a967];
const approachCell=terrainTile(LEVEL,0,2**LEVEL/4);
const TAU=2*Math.PI;
const center=approachCoordinates(0,23);
const approach=terrainPosition(center.u,center.v,terrainElevation(center.u,center.v));

export function approachCover(lightweight,{x:doorX,z:doorZ=15.5,facing=-1}={}) {
  const plants=[];
  const place=(x,z,styling,atFacade=false)=>{
    const {u,v}=approachCoordinates(x,z);
    // Keep the facade and the aisle connecting its door to the route clear.
    if((Math.abs(z-doorZ)<1.9&&x*facing>0)||(!atFacade&&terrainTrail(u,v)>.22))return;
    plants.push({u,v,h:terrainElevation(u,v),...styling});
  };
  for(let station=0;station<20;station++)for(const side of [-1,1]){
    const index=station*2+Number(side>0);
    const pick=salt=>random(approachCell,index,salt);
    const z=8.25+station*1.48+pick(417)*.9;
    const x=side*(3.20+pick(271)*1.38);
    const bloom=station%3===Number(side>0);
    place(x,z,{yaw:pick(561)*TAU,kind:bloom?'bloom':'grass',
      size:.28+pick(711)*.26,color:bloom?0xffffff:ribbonPalette[Math.floor(pick(607)*4)]});
    if(!lightweight&&!bloom&&station%2===0){
      place(x+side*(.45+pick(97)),z+.65,{yaw:pick(327)*TAU,kind:'grass',
        size:.18+pick(515)*.23,color:ribbonPalette[Math.floor(pick(107)*4)]});
    }
  }
  if(Number.isFinite(doorX)&&Math.abs(facing)===1){
    // The entrance anchor is .85 m out from the facade. Keep the clusters
    // between it and the wall plane, outside the walking lane.
    const localX=doorX-TOROIDAL_TERRAIN.majorRadius;
    for(const [forward,along,kind,size,color,yaw] of [
      [.54,-2.15,'grass',.49,0x597744,1.1],
      [.29,-2.00,'bloom',.38,0xffefd1,2.8],
      [.48,2.04,'grass',.39,0x718c49,3.2],
      [.54,2.01,'bloom',.29,0xffefd1,4.5],
    ])place(localX+facing*forward,doorZ+along,{kind,size,color,yaw},true);
  }
  return plants;
}

function useSceneryDaylight(material, daylight) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.sceneryDaylight=daylight;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float sceneryDaylight;')
      .replace('#include <opaque_fragment>', 'outgoingLight *= mix(.45,1.0,sceneryDaylight);\n#include <opaque_fragment>');
  };
}

export class ToroidalScenery {
  constructor(scene,base,colliders) {
    this.group=new Group();
    this.group.name='Toroidal ground cover';
    this.stones=new InstancedMesh(new DodecahedronGeometry(1,0),new MeshStandardMaterial({roughness:.94}),INSTANCE_LIMIT);
    this.grasses=new InstancedMesh(meadowBlades(3,true),new MeshStandardMaterial({
      roughness:1,vertexColors:true,side:DoubleSide,
    }),INSTANCE_LIMIT);
    this.fieldClock={value:0};
    this.fieldMotion={value:1};
    this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.fieldGeometry=[meadowBlades(5,false,1),meadowBlades(5,true,1),meadowBlades(4,true,1.22)];
    const fieldMaterial=new MeshStandardMaterial({roughness:.94,vertexColors:true,side:DoubleSide});
    this.field=new InstancedMesh(this.fieldGeometry[0],fieldMaterial,(2*FIELD_NEAR+1)**2*FIELD_DENSITY);
    this.fieldFar=new InstancedMesh(this.fieldGeometry[1],fieldMaterial,FIELD_LIMIT);
    this.field.name='Continuous meadow';
    this.fieldFar.name='Meadow outer tufts';
    this.ribbonGrass=new InstancedMesh(meadowBlades(6),new MeshStandardMaterial({
      roughness:1,vertexColors:true,side:DoubleSide,
    }),48);
    this.blooms=new InstancedMesh(trailFlowerGeometry(),new MeshStandardMaterial({
      roughness:.87,vertexColors:true,side:DoubleSide,
    }),16);
    this.meshes=[this.stones,this.grasses,this.ribbonGrass,this.blooms];
    this.daylight={value:1};
    this.detail=base?new Sand3DTrail(scene,base,approach,useSceneryDaylight,this.daylight):null;
    this.meadow=new ToroidalMeadowBanks(scene,useSceneryDaylight,this.daylight);
    this.woodland=new ToroidalWoodland(scene,colliders,useSceneryDaylight,this.daylight);
    this.overlook=new ToroidalOverlook(scene,colliders);
    this.ribbonGrass.name='Trail-side tufts';
    this.blooms.name='Trail-edge wildflowers';
    this.stones.name='Weathered stone';
    this.grasses.name='Dry ground cover';
    for(const mesh of this.meshes){
      mesh.count=0;
      mesh.visible=false;
      useSceneryDaylight(mesh.material,this.daylight);
      mesh.frustumCulled=false;
      this.group.add(mesh);
    }
    for(const mesh of [this.field,this.fieldFar]){
      mesh.count=0;
      mesh.visible=false;
      mesh.frustumCulled=false;
      this.group.add(mesh);
    }
    useSceneryDaylight(fieldMaterial,this.daylight);
    meadowWind(fieldMaterial,this.fieldClock,this.fieldMotion);
    this.fieldCells=new Map();
    scene.add(this.group);
    this.key=null;
    this.anchor=new Vector3();
    this.approach=new Vector3().fromArray(approach);
    this.transform=new Object3D();
    this.color=new Color();
  }

  update(position,lightweight,door,daylight=1,groundCoverReady=true) {
    this.daylight.value=daylight;
    this.overlook.update(position);
    // Authored landmarks and their colliders are independent of ground cover.
    if(!groundCoverReady)return;
    this.woodland.update(position,lightweight);
    this.detail?.update(position,lightweight,door);
    const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
    if(![u,v].every(Number.isFinite))return;
    const rows=2**LEVEL, columns=rows*TOROIDAL_TERRAIN.rootColumns;
    const cell=terrainTile(LEVEL,Math.floor(u*columns),Math.floor(v*rows));
    this.fieldClock.value=(performance.now()%18000)*TAU/18000;
    this.fieldMotion.value=this.reducedMotion?.matches?0:1;
    const doorKey=(door?.x??'')+':'+(door?.z??15.5)+':'+(door?.facing??-1);
    const distance=this.approach.distanceToSquared(position);
    const nearTrail=distance<105**2;
    this.meadow.update(distance<(this.meadow.group.visible?142:124)**2,Boolean(lightweight),performance.now());
    const key=cell.key+':'+lightweight+':'+nearTrail+':'+doorKey;
    if(key===this.key){
      this.placeField(u,v,lightweight,door,doorKey);
      return;
    }
    this.key=key;
    this.anchor.set(position.x,position.y,position.z);
    this.group.position.copy(this.anchor);
    for(const mesh of this.meshes)mesh.count=0;
    const count=lightweight?7:CANDIDATES;
    for(let y=-RANGE;y<=RANGE;y++){
      for(let x=-RANGE;x<=RANGE;x++){
        const adjacent=terrainTile(LEVEL,cell.column+x,cell.row+y);
        for(const item of sceneryForCell(adjacent,count)){
          this.place(item);
        }
      }
    }
    if(nearTrail){
      const ribbonKey=lightweight+':'+doorKey;
      if(this.ribbonKey!==ribbonKey){
        this.ribbonKey=ribbonKey;
        this.ribbon=approachCover(lightweight,door);
      }
      for(const item of this.ribbon)this.place(item,true);
    }
    this.placeField(u,v,lightweight,door,doorKey,true);
    for(const mesh of this.meshes){
      mesh.visible=mesh.count>0;
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }

  placeField(u,v,lightweight,door,doorKey,anchorChanged=false){
    const rows=2**FIELD_LEVEL,columns=rows*TOROIDAL_TERRAIN.rootColumns;
    const cell=fieldTile(Math.floor(u*columns),Math.floor(v*rows));
    const key=[cell.key,lightweight,doorKey].join(':');
    if(key===this.fieldKey&&!anchorChanged)return;
    this.fieldKey=key;
    this.fieldFar.geometry=this.fieldGeometry[lightweight?2:1];
    this.field.count=this.fieldFar.count=0;
    const phase=lightweight?17:FIELD_DENSITY;
    const range=FIELD_RANGE;
    const retained=new Map();
    for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
      const tile=fieldTile(cell.column+dx,cell.row+dy);
      const indexed=[tile.key,phase,doorKey].join(':');
      let samples=this.fieldCells.get(indexed);
      if(!samples){
        samples=[];
        for(let i=0;i<phase;i++){
          const plant=meadowCell(tile,i,door);
          if(plant)samples.push(plant);
        }
      }
      retained.set(indexed,samples);
      const mesh=!lightweight&&Math.max(Math.abs(dx),Math.abs(dy))<=FIELD_NEAR?this.field:this.fieldFar;
      for(const {u,v,h,size,yaw,color} of samples){
        const transform=this.transform;
        transform.position.fromArray(terrainPosition(u,v,h));
        toroidalRotation(transform.position,yaw,transform.quaternion);
        transform.position.sub(this.anchor);
        transform.scale.set(size*.86,size,size*.86);
        transform.updateMatrix();
        mesh.setMatrixAt(mesh.count,transform.matrix);
        mesh.setColorAt(mesh.count,this.color.setHex(color));
        mesh.count++;
      }
    }
    this.fieldCells=retained;
    for(const mesh of [this.field,this.fieldFar]){
      mesh.visible=mesh.count>0;
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }

  place({kind,u,v,h,size,yaw,color},ribbon=false) {
    const rock=kind==='stone';
    const mesh=rock?this.stones:kind==='bloom'?this.blooms:ribbon?this.ribbonGrass:this.grasses;
    const transform=this.transform;
    if(mesh.count===mesh.instanceMatrix.count)return;
    const lift=rock?-.06:0;
    transform.position.fromArray(terrainPosition(u,v,h+lift));
    toroidalRotation(transform.position,yaw,transform.quaternion);
    transform.position.sub(this.anchor);
    if(rock)transform.scale.set(size*1.3,size*.67,size*.87);
    else if(ribbon)transform.scale.set(size*.70,size,size*.70);
    else transform.scale.set(size*.89,size*.74,size*.89);
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count,transform.matrix);
    mesh.setColorAt(mesh.count,this.color.setHex(color));
    mesh.count+=1;
  }

  dispose() {
    this.detail?.dispose();
    this.meadow.dispose();
    this.woodland.dispose();
    for(const geometry of this.fieldGeometry)geometry.dispose();
    this.field.material.dispose();
    this.field.dispose();
    this.fieldFar.dispose();
    this.fieldCells.clear();
    this.overlook.dispose();
    for(const mesh of this.meshes){
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.group.removeFromParent();
  }
}
