import {
  Color, DodecahedronGeometry, Group, InstancedMesh, MeshStandardMaterial,
  Object3D, TetrahedronGeometry, Vector3,
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

export class ToroidalScenery {
  constructor(scene) {
    this.group=new Group();
    this.group.name='Toroidal ground cover';
    this.stones=new InstancedMesh(new DodecahedronGeometry(1,0),new MeshStandardMaterial({roughness:.94}),INSTANCE_LIMIT);
    this.grasses=new InstancedMesh(new TetrahedronGeometry(1,0),new MeshStandardMaterial({roughness:1}),INSTANCE_LIMIT);
    this.stones.name='Weathered stone';
    this.grasses.name='Dry ground cover';
    for(const mesh of [this.stones,this.grasses]){
      mesh.count=0;
      mesh.frustumCulled=false;
      this.group.add(mesh);
    }
    scene.add(this.group);
    this.key=null;
    this.anchor=new Vector3();
    this.transform=new Object3D();
    this.color=new Color();
  }

  update(position,lightweight) {
    const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
    if(![u,v].every(Number.isFinite))return;
    const rows=2**LEVEL, columns=rows*TOROIDAL_TERRAIN.rootColumns;
    const cell=terrainTile(LEVEL,Math.floor(u*columns),Math.floor(v*rows));
    const key=cell.key+':'+lightweight;
    if(key===this.key)return;
    this.key=key;
    this.anchor.set(position.x,position.y,position.z);
    this.group.position.copy(this.anchor);
    this.stones.count=this.grasses.count=0;
    const count=lightweight?7:CANDIDATES;
    for(let y=-RANGE;y<=RANGE;y++){
      for(let x=-RANGE;x<=RANGE;x++){
        const adjacent=terrainTile(LEVEL,cell.column+x,cell.row+y);
        for(const item of sceneryForCell(adjacent,count)){
          const {kind,u,v,h,size,yaw,color}=item;
          const rock=kind==='stone';
          const mesh=rock?this.stones:this.grasses;
          const transform=this.transform;
          transform.position.fromArray(terrainPosition(u,v,h+(rock?-.06:size*.35)));
          toroidalRotation(transform.position,yaw,transform.quaternion);
          transform.position.sub(this.anchor);
          if(rock) transform.scale.set(size*1.3,size*.67,size*.87);
          else transform.scale.set(size*.26,size,size*.39);
          transform.updateMatrix();
          mesh.setMatrixAt(mesh.count,transform.matrix);
          mesh.setColorAt(mesh.count,this.color.setHex(color));
          mesh.count+=1;
        }
      }
    }
    for(const mesh of [this.stones,this.grasses]){
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  }

  dispose() {
    for(const mesh of [this.stones,this.grasses]){
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.group.removeFromParent();
  }
}
