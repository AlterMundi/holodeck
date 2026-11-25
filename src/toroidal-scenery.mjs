import {approachCoordinates,Sand3DTrail} from './sand3d-trail.mjs';
import {
  BufferGeometry, Color, DodecahedronGeometry, DoubleSide, Float32BufferAttribute, Group,
  InstancedMesh, MeshStandardMaterial, Object3D, TetrahedronGeometry, Vector3,
} from 'three';
import {CAVE} from './toroidal-cave.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {
  TOROIDAL_TERRAIN, terrainCoordinates, terrainElevation, terrainPosition, terrainTile, terrainTrail,
} from './toroidal-terrain.mjs';

const LEVEL=7;
const RANGE=2;
const CANDIDATES=12;
const INSTANCE_LIMIT=(2*RANGE+1)**2*CANDIDATES;
const GRASSES=[0x849552,0x758549,0x939968,0xb5a66b,0x9a843f];
const STONES=[0x74664f,0x7d7d70,0x8b7860,0x66635c,0x9f8a73];

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
    const h=terrainElevation(u,v);
    if(h<TOROIDAL_TERRAIN.waterLevel+.22||terrainTrail(u,v)>.22)continue;
    const distanceFromHouse=Math.hypot(Math.min(u,1-u)*TOROIDAL_TERRAIN.majorRadius,
      (v-.25)*TOROIDAL_TERRAIN.tubeRadius);
    if(distanceFromHouse<5.4)continue;
    if(u>CAVE.from-.00025&&u<CAVE.to+.00025&&Math.abs(v-CAVE.latitude)<.0029)continue;
    const stony=h>37||h<TOROIDAL_TERRAIN.waterLevel+2.5||pick(7)<.26;
    const size=stony?.20+pick(53)**1.7*.79:.25+pick(53)**1.4*.41;
    const palette=stony?STONES:GRASSES;
    instances.push({kind:stony?'stone':'grass',u,v,h,size,yaw:pick(29)*Math.PI*2,
      color:palette[Math.floor(pick(97)*palette.length)]});
  }
  return instances;
}

function plantGeometry(bloom=false) {
  const points=[], colors=[];
  const triangle=(a,b,c,shades,tint=[1,1,1])=>{
    points.push(...a,...b,...c);
    for(const shade of shades)colors.push(...tint.map(value=>shade*value));
  };
  const blades=bloom?3:5;
  for(let i=0;i<blades;i++){
    const angle=i*2.39996, x=Math.cos(angle),z=Math.sin(angle);
    const root=[.16*x,-.14,.16*z], width=.105+.014*(i%3);
    const left=[.29*x-z*width,.48,.29*z+x*width];
    const right=[.29*x+z*width,.48,.29*z-x*width];
    const tip=[.63*x,.74+(i%3)*.09,.63*z];
    const base=[root[0]+z*width*.55,-.14,root[2]-x*width*.55];
    const tint=bloom?[.22,.43,.13]:undefined;
    triangle(root,left,right,[.39,.68,.76],tint);
    triangle(root,right,base,[.39,.76,.42],tint);
    triangle(left,tip,right,[.68,1,.76],tint);
  }
  if(bloom){
    for(const [x,z] of [[.036,0],[0,.036]]) {
      triangle([-x,-.12,-z],[x,-.12,z],[x,.92,z],[.58,.58,.79],[.22,.43,.13]);
      triangle([-x,-.12,-z],[x,.92,z],[-x,.92,-z],[.58,.79,.79],[.22,.43,.13]);
    }
  }
  if(bloom)for(let i=0;i<5;i++){
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
  constructor(scene,base) {
    this.group=new Group();
    this.group.name='Toroidal ground cover';
    this.stones=new InstancedMesh(new DodecahedronGeometry(1,0),new MeshStandardMaterial({roughness:.94}),INSTANCE_LIMIT);
    this.grasses=new InstancedMesh(new TetrahedronGeometry(1,0),new MeshStandardMaterial({roughness:1}),INSTANCE_LIMIT);
    this.ribbonGrass=new InstancedMesh(plantGeometry(),new MeshStandardMaterial({
      roughness:1,vertexColors:true,side:DoubleSide,
    }),48);
    this.blooms=new InstancedMesh(plantGeometry(true),new MeshStandardMaterial({
      roughness:.87,vertexColors:true,side:DoubleSide,
    }),16);
    this.meshes=[this.stones,this.grasses,this.ribbonGrass,this.blooms];
    this.daylight={value:1};
    this.detail=base?new Sand3DTrail(scene,base,approach,useSceneryDaylight,this.daylight):null;
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
    scene.add(this.group);
    this.key=null;
    this.anchor=new Vector3();
    this.approach=new Vector3().fromArray(approach);
    this.transform=new Object3D();
    this.color=new Color();
  }

  update(position,lightweight,door,daylight=1) {
    this.daylight.value=daylight;
    this.detail?.update(position,lightweight,door);
    const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
    if(![u,v].every(Number.isFinite))return;
    const rows=2**LEVEL, columns=rows*TOROIDAL_TERRAIN.rootColumns;
    const cell=terrainTile(LEVEL,Math.floor(u*columns),Math.floor(v*rows));
    const doorKey=(door?.x??'')+':'+(door?.z??15.5)+':'+(door?.facing??-1);
    const nearTrail=this.approach.distanceToSquared(position)<105**2;
    const key=cell.key+':'+lightweight+':'+nearTrail+':'+doorKey;
    if(key===this.key)return;
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
    for(const mesh of this.meshes){
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
    const lift=rock?-.06:ribbon?0:size*.35;
    transform.position.fromArray(terrainPosition(u,v,h+lift));
    toroidalRotation(transform.position,yaw,transform.quaternion);
    transform.position.sub(this.anchor);
    if(rock)transform.scale.set(size*1.3,size*.67,size*.87);
    else if(ribbon)transform.scale.set(size*.70,size,size*.70);
    else transform.scale.set(size*.26,size,size*.39);
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count,transform.matrix);
    mesh.setColorAt(mesh.count,this.color.setHex(color));
    mesh.count+=1;
  }

  dispose() {
    this.detail?.dispose();
    for(const mesh of this.meshes){
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.group.removeFromParent();
  }
}
