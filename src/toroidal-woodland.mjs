import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3,
} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {
  TOROIDAL_TERRAIN, terrainElevation, terrainPosition, terrainTrail,
  terrainWoodland, woodlandCoordinates,
} from './toroidal-terrain.mjs';

const TAU=2*Math.PI;
const spacing=8;
const trunkDepth=.40;
const trunkWidth=.048;
const chunkSize=42;
const maxRange=640;

function sample(x,z,salt){
  let n=Math.imul(x,0x6d2b79f5)^Math.imul(z,0x85ebca6b)^TOROIDAL_TERRAIN.seed^salt;
  n=Math.imul(n^(n>>>16),0x7feb352d);
  n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967296;
}

// Every graphics profile uses these same trunks, roots and silhouette sizes.
export function woodlandTrees(){
  const trees=[];
  for(let row=-41;row<=21;row++)for(let col=-30;col<=29;col++){
    const pick=salt=>sample(col,row,salt);
    const x=(col+.12+.76*pick(17))*spacing;
    const z=(row+.12+.76*pick(41))*spacing;
    const {u,v}=woodlandCoordinates(x,z);
    const h=terrainElevation(u,v);
    const belt=terrainWoodland(u,v,h);
    if(belt<.16||pick(708)>belt*.77||terrainTrail(u,v)>.025)continue;
    const rise=(dx,dz)=>{
      const around=woodlandCoordinates(x+dx,z+dz);
      return terrainElevation(around.u,around.v);
    };
    if(Math.hypot(rise(2,0)-rise(-2,0),rise(0,2)-rise(0,-2))>2.8)continue;
    const sapling=pick(71)<.12+.47*(1-belt);
    const height=sapling?3.1+pick(84)*2.6:6.4+pick(94)**.85*6.4;
    trees.push({x,z,u,v,h,height,width:height*(.78+pick(97)*.42),yaw:pick(27)*TAU,tint:pick(21)});
  }
  return trees;
}

function evergreenGeometry(detail){
  const positions=[],colors=[];
  const shade=new Color();
  const trunk=0x534134;
  const foliage=[0x375443,0x425d45,0x4a674a,0x587348,0x668155,0x738c58];
  const triangle=(a,b,c,tint,value)=>{
    positions.push(...a,...b,...c);
    shade.setHex(tint).multiplyScalar(value);
    for(let i=0;i<3;i++)colors.push(shade.r,shade.g,shade.b);
  };
  const sides=[5,7,9][detail];
  const ring=(radius,height,angle)=>[Math.cos(angle)*radius,height,Math.sin(angle)*radius];
  for(let i=0;i<sides;i++){
    const a=i*TAU/sides,b=(i+1)*TAU/sides;
    const foot=ring(trunkWidth*.68,-.055,a),nextFoot=ring(trunkWidth*.68,-.055,b);
    const top=ring(.009,trunkDepth+.12,a),nextTop=ring(.009,trunkDepth+.12,b);
    triangle(foot,top,nextFoot,trunk,.85+i%3*.10);
    triangle(top,nextTop,nextFoot,trunk,.85+i%3*.10);
  }
  const whorls=detail===2?6:detail===1?5:3;
  for(let band=0;band<whorls;band++){
    const t=band/(whorls-1);
    const base=.21+.51*t;
    const radius=.254*(1-.79*t);
    const apex=[.025*t,band===whorls-1?1:base+.23,-.026*t];
    const spokeCount=detail===2?10:detail===1?7:4;
    const turn=.47*band;
    const tint=foliage[Math.round(t*(foliage.length-1))];
    const canopyShade=.68+.32*t;
    for(let i=0;i<spokeCount;i++){
      const a=turn+i*TAU/spokeCount;
      const spur=radius*(.88+.17*Math.sin(i*3.7+band*4.4));
      const tip=ring(spur,base-.032+.037*Math.cos(i*2.9+band),a);
      const span=TAU/spokeCount;
      const left=ring(radius*.64,base+.042,a-span*.5);
      const right=ring(radius*.64,base+.042,a+span*.5);
      const scale=canopyShade*(.81+.25*Math.sin(i*2.71+band)**2);
      triangle(apex,tip,left,tint,scale);
      triangle(apex,right,tip,tint,scale*1.13);
      triangle([0,base+.047,0],left,tip,tint,scale*.70);
      triangle([0,base+.047,0],tip,right,tint,scale*.70);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

function placeTree(transform,tree){
  transform.position.fromArray(terrainPosition(tree.u,tree.v,tree.h));
  toroidalRotation(transform.position,tree.yaw,transform.quaternion);
  transform.scale.set(tree.width,tree.height,tree.width);
  transform.updateMatrix();
}

export class ToroidalWoodland{
  constructor(scene,colliders,useDaylight,daylight){
    this.colliders=colliders;
    this.group=new Group();
    this.group.name='Rooted woodland';
    this.geometry=[0,1,2].map(evergreenGeometry);
    this.material=new MeshStandardMaterial({vertexColors:true,roughness:.95});
    useDaylight(this.material,daylight);
    const trees=woodlandTrees();
    this.meshes=this.geometry.map((geometry,index)=>{
      const mesh=new InstancedMesh(geometry,this.material,trees.length);
      mesh.name=['Woodland distant','Woodland middle','Woodland near'][index];
      mesh.count=0;
      this.group.add(mesh);
      return mesh;
    });
    const transform=new Object3D();
    this.chunks=new Map();
    for(const tree of trees){
      const col=Math.floor(tree.x/chunkSize),row=Math.floor(tree.z/chunkSize);
      const key=col+':'+row;
      if(!this.chunks.has(key)){
        const {u,v}=woodlandCoordinates((col+.5)*chunkSize,(row+.5)*chunkSize);
        const center=new Vector3().fromArray(terrainPosition(u,v,terrainElevation(u,v)));
        this.chunks.set(key,{center,trees:[]});
      }
      placeTree(transform,tree);
      this.chunks.get(key).trees.push({...tree,matrix:transform.matrix.clone(),point:transform.position.clone()});
    }
    this.last=new Vector3(Infinity,0,0);
    this.tint=new Color();
    scene.add(this.group);
  }

  update(position,lightweight){
    if(this.last.distanceToSquared(position)<36&&this.lightweight===lightweight)return;
    this.last.copy(position);
    this.lightweight=lightweight;
    for(const mesh of this.meshes)mesh.count=0;
    for(const chunk of this.chunks.values()){
      const range=chunk.center.distanceToSquared(position);
      if(this.colliders){
        if(range<74**2&&!chunk.collider)this.addCollision(chunk);
        else if(range>96**2&&chunk.collider)this.removeCollision(chunk);
      }
      if(range>(maxRange+chunkSize)**2)continue;
      for(const tree of chunk.trees){
        const distance=tree.point.distanceToSquared(position);
        if(distance>maxRange**2)continue;
        const level=distance<(lightweight?23:39)**2?2:distance<(lightweight?81:126)**2?1:0;
        const mesh=this.meshes[level];
        mesh.setMatrixAt(mesh.count,tree.matrix);
        const light=.85+.29*tree.tint;
        mesh.setColorAt(mesh.count,this.tint.setRGB(light,light,.94*light+.06));
        mesh.count++;
      }
    }
    for(const mesh of this.meshes){
      mesh.visible=mesh.count>0;
      if(!mesh.visible)continue;
      mesh.instanceMatrix.needsUpdate=true;
      mesh.instanceColor.needsUpdate=true;
      mesh.computeBoundingSphere();
    }
  }

  addCollision(chunk){
    const offset=chunk.center.clone().negate().toArray();
    const pieces=chunk.trees.map(tree=>new BoxGeometry(trunkWidth,trunkDepth,trunkWidth)
      .translate(0,trunkDepth/2-.028,0).applyMatrix4(tree.matrix).translate(...offset));
    const geometry=mergeGeometries(pieces);
    for(const piece of pieces)piece.dispose();
    const collider=new Mesh(geometry,this.material);
    collider.name='Woodland trunks';
    collider.visible=false;
    collider.position.copy(chunk.center);
    this.group.add(collider);
    collider.updateWorldMatrix(true,false);
    this.colliders.addCollider(collider);
    chunk.collider=collider;
  }

  removeCollision(chunk){
    this.colliders.removeCollider(chunk.collider);
    chunk.collider.removeFromParent();
    chunk.collider.geometry.dispose();
    chunk.collider=null;
  }

  dispose(){
    for(const chunk of this.chunks.values())if(chunk.collider)this.removeCollision(chunk);
    this.group.removeFromParent();
    for(const mesh of this.meshes)mesh.dispose();
    for(const geometry of this.geometry)geometry.dispose();
    this.material.dispose();
  }
}
