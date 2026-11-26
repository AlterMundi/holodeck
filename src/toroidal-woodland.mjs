import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, IcosahedronGeometry,
  InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3,
} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toroidalAirColor} from './toroidal-air.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {
  INNER_WOODLANDS, TOROIDAL_TERRAIN, terrainCoordinates, terrainElevation, terrainFrame, terrainPosition, terrainTrail,
  terrainWoodland, woodlandCoordinates,
} from './toroidal-terrain.mjs';

const TAU=2*Math.PI;
const spacing=8;
const trunkDepth=.40;
const trunkWidth=.048;
const chunkSize=42;
const maxRange=640;
const skylineRange=3900;

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

// Fixed angular cells make the far crowns and walkable trunks use the same
// roots. Overlapping stands cover one set of cells without duplicate trees.
export function innerWoodlandTrees(){
  const trees=[],visited=new Set();
  const columns=460,rows=160;
  for(const stand of INNER_WOODLANDS){
    const west=Math.floor((stand.u-stand.along)*columns);
    const east=Math.ceil((stand.u+stand.along)*columns);
    const south=Math.floor((stand.v-stand.across)*rows);
    const north=Math.ceil((stand.v+stand.across)*rows);
    for(let row=south;row<north;row++)for(let col=west;col<east;col++){
      const key=row*columns+col;
      if(visited.has(key))continue;
      visited.add(key);
      const pick=salt=>sample(col,row,salt^0x2b5863);
      const u=(col+.1+.8*pick(17))/columns,v=(row+.1+.8*pick(41))/rows;
      const h=terrainElevation(u,v),belt=terrainWoodland(u,v,h);
      if(belt<.25||pick(708)>belt*.87)continue;
      const riseU=terrainElevation(u+.00022,v)-terrainElevation(u-.00022,v);
      const riseV=terrainElevation(u,v+.00060)-terrainElevation(u,v-.00060);
      if(Math.hypot(riseU,riseV)>2.8)continue;
      const height=6+10*pick(94)**.8;
      trees.push({u,v,h,height,width:height*(.82+.46*pick(97)),yaw:pick(27)*TAU,tint:pick(21),inner:true});
    }
  }
  return trees;
}

function evergreenGeometry(detail,spreading=false){
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
  const whorls=(spreading?[3,4,5]:[3,5,6])[detail];
  for(let band=0;band<whorls;band++){
    const t=band/(whorls-1);
    const base=spreading?.27+.45*t:.21+.51*t;
    const radius=spreading?.345*(1-.76*t**1.6):.254*(1-.79*t);
    const lean=spreading?.12*t*t:0;
    const crown=(r,y,a)=>[Math.cos(a)*r+lean,y,Math.sin(a)*r-.4*lean];
    const apex=[lean+.025*t,band===whorls-1?1:base+(spreading?.18:.23),-.026*t-.4*lean];
    const spokeCount=detail===2?10:detail===1?7:4;
    const turn=.47*band;
    const tint=foliage[Math.round(t*(foliage.length-1))];
    const canopyShade=.68+.32*t;
    for(let i=0;i<spokeCount;i++){
      const a=turn+i*TAU/spokeCount;
      const spread=spreading?.94+.22*Math.cos(a-.7)+.13*Math.sin(a*3+band):.88+.17*Math.sin(i*3.7+band*4.4);
      const drop=spreading?-.065+.030*Math.cos(3*a+band):-.032+.037*Math.cos(i*2.9+band);
      const tip=crown(radius*spread,base+drop,a);
      const span=TAU/spokeCount;
      const left=crown(radius*(spreading?.73:.64),base+.042,a-span*.5);
      const right=crown(radius*(spreading?.73:.64),base+.042,a+span*.5);
      const scale=canopyShade*(.81+.25*Math.sin(i*2.71+band)**2);
      triangle(apex,tip,left,tint,scale);
      triangle(apex,right,tip,tint,scale*1.13);
      const center=[lean,base+.047,-.4*lean];
      triangle(center,left,tip,tint,scale*.70);
      triangle(center,tip,right,tint,scale*.70);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

// Two closed skirt crowns retain volume when the rim is seen end-on.
function skylineGeometry(spreading=false){
  const positions=[],colors=[];
  for(const [height,radius,span,tint] of [[.26,.21,.57,0x3a5948],[.57,.13,.43,0x55734e]]){
    const shade=new Color(tint);
    for(let side=0;side<5;side++){
      const a=side*TAU/5,b=(side+1)*TAU/5;
      const width=spreading?1.42:1;
      const lean=spreading?height*.13:0;
      const east=[lean+radius*Math.cos(a)*width,height,radius*Math.sin(a)*width];
      const west=[lean+radius*Math.cos(b)*width,height,radius*Math.sin(b)*width];
      positions.push(...east,lean,height+span,0,...west,...west,lean,height,0,...east);
      for(let index=0;index<6;index++){
        const light=index<3?1:.68;
        colors.push(shade.r*light,shade.g*light,shade.b*light);
      }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

function skylineMaterial(daylight){
  const material=new MeshBasicMaterial({vertexColors:true,fog:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.woodlandDaylight=daylight;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying float vWoodlandDistance;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvWoodlandDistance=length(mvPosition.xyz);');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vWoodlandDistance;\nuniform float woodlandDaylight;'+toroidalAirColor)
      .replace('#include <opaque_fragment>',`
        float haze=(1.0-exp(-vWoodlandDistance/2650.0))*.56;
        outgoingLight=mix(outgoingLight*mix(.28,.94,woodlandDaylight),toroidalAir(0.0,woodlandDaylight),haze);
        #include <opaque_fragment>`);
  };
  return material;
}

function placeTree(transform,tree){
  transform.position.fromArray(terrainPosition(tree.u,tree.v,tree.h));
  toroidalRotation(transform.position,tree.yaw,transform.quaternion);
  transform.scale.set(tree.width,tree.height,tree.width);
  transform.updateMatrix();
}

const undergrowthBudget=384;

function undergrowthGeometry(){
  const lobes=[
    [-.39,.28,.10,.47,.39,.36,0x42663d],
    [.32,.32,-.20,.52,.43,.41,0x456f43],
    [-.15,.47,-.21,.44,.44,.34,0x567d47],
    [.22,.20,.38,.43,.27,.34,0x355936],
    [-.47,.16,-.32,.38,.29,.30,0x4c7040],
  ];
  const pieces=lobes.map(([x,y,z,w,h,d,tint],index)=>{
    const geometry=new IcosahedronGeometry(1,0).rotateY(index*.76).scale(w,h,d).translate(x,y,z);
    const vertices=geometry.getAttribute('position');
    const color=new Color(tint),colors=[];
    for(let vertex=0;vertex<vertices.count;vertex++){
      const light=.57+.48*Math.max(0,vertices.getY(vertex));
      colors.push(color.r*light,color.g*light,color.b*light);
    }
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    return geometry;
  });
  const geometry=mergeGeometries(pieces);
  for(const piece of pieces)piece.dispose();
  return geometry;
}

function undergrowthFor(trees){
  const plants=[],transform=new Object3D();
  for(const {u,v,h,tint,point,yaw} of trees){
    if(tint<.25)continue;
    const {alongRing,aroundTube}=terrainFrame(u,v);
    const pick=salt=>sample(Math.round(u*1e6),Math.round(v*1e6),salt);
    const angle=yaw+pick(73);
    const count=pick(86)>.38?2:1;
    for(let index=0;index<count;index++){
      const radius=(1.25+pick(301+index)*1.45)*(index+1);
      const a=angle+index*2.21;
      const offset=point.toArray().map((value,axis)=>value+
        radius*(alongRing[axis]*Math.cos(a)+aroundTube[axis]*Math.sin(a)));
      const at=terrainCoordinates(offset);
      const elevation=terrainElevation(at.u,at.v);
      if(Math.abs(elevation-h)>radius*.59||terrainTrail(at.u,at.v)>.012||
         terrainWoodland(at.u,at.v,elevation)<.22)continue;
      const width=.85+pick(141+index)*.92;
      const ground=terrainPosition(at.u,at.v,elevation);
      const frame=terrainFrame(at.u,at.v);
      const nearbyHeight=(direction,sign)=>{
        const sample=terrainCoordinates(ground.map((value,axis)=>value+direction[axis]*width*sign));
        return terrainElevation(sample.u,sample.v);
      };
      const slope=Math.hypot(nearbyHeight(frame.alongRing,1)-nearbyHeight(frame.alongRing,-1),
        nearbyHeight(frame.aroundTube,1)-nearbyHeight(frame.aroundTube,-1))/(2*width);
      if(slope>.21)continue;
      transform.position.fromArray(terrainPosition(at.u,at.v,elevation-.08));
      toroidalRotation(transform.position,a,transform.quaternion);
      transform.scale.set(width,.46+pick(414+index)*.67,width*.78);
      transform.updateMatrix();
      plants.push({matrix:transform.matrix.clone(),point:transform.position.clone(),
        tint:.73+pick(911+index)*.35,primary:index===0});
    }
  }
  return plants;
}

export class ToroidalWoodland{
  constructor(scene,colliders,useDaylight,daylight){
    this.colliders=colliders;
    this.group=new Group();
    this.group.name='Rooted woodland';
    this.geometry=[
      ...[0,1,2].map(detail=>evergreenGeometry(detail)),skylineGeometry(),
      ...[0,1,2].map(detail=>evergreenGeometry(detail,true)),skylineGeometry(true),
    ];
    this.material=new MeshStandardMaterial({vertexColors:true,roughness:.95});
    useDaylight(this.material,daylight);
    this.skylineMaterial=skylineMaterial(daylight);
    const trees=[...woodlandTrees(),...innerWoodlandTrees()].map(tree=>({...tree,
      spreading:tree.height>=7.8&&sample(Math.round(tree.u*1e6),Math.round(tree.v*1e6),3941)>.59,
    }));
    const broad=trees.filter(tree=>tree.spreading).length;
    this.meshes=this.geometry.map((geometry,index)=>{
      const capacity=index<4?trees.length-broad:broad;
      const mesh=new InstancedMesh(geometry,index%4===3?this.skylineMaterial:this.material,capacity);
      mesh.name=['Woodland distant','Woodland middle','Woodland near','Inner arc canopy',
        'Woodland spreading distant','Woodland spreading middle','Woodland spreading near','Inner arc spreading canopy'][index];
      mesh.count=0;
      this.group.add(mesh);
      return mesh;
    });
    const understoryMaterial=new MeshStandardMaterial({vertexColors:true,roughness:.96});
    useDaylight(understoryMaterial,daylight);
    this.undergrowthDistance={value:112};
    const compile=understoryMaterial.onBeforeCompile;
    understoryMaterial.customProgramCacheKey=()=> 'toroidal-understory';
    understoryMaterial.onBeforeCompile=shader=>{
      compile.call(understoryMaterial,shader);
      shader.uniforms.undergrowthDistance=this.undergrowthDistance;
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nuniform float undergrowthDistance;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vec3 root=(modelMatrix*instanceMatrix[3]).xyz;
          float fade=1.0-smoothstep(undergrowthDistance-22.0,undergrowthDistance,distance(cameraPosition,root));
          transformed*=fade;`);
    };
    this.undergrowth=new InstancedMesh(undergrowthGeometry(),understoryMaterial,undergrowthBudget);
    this.undergrowth.name='Woodland understory';
    this.undergrowth.count=0;
    this.undergrowthSelection=[];
    this.group.add(this.undergrowth);
    const transform=new Object3D();
    this.chunks=new Map();
    for(const tree of trees){
      const col=Math.floor(tree.inner?tree.u*192:tree.x/chunkSize);
      const row=Math.floor(tree.inner?tree.v*75:tree.z/chunkSize);
      const key=[tree.inner,col,row].join(':');
      if(!this.chunks.has(key)){
        const {u,v}=tree.inner?{u:(col+.5)/192,v:(row+.5)/75}:
          woodlandCoordinates((col+.5)*chunkSize,(row+.5)*chunkSize);
        const center=new Vector3().fromArray(terrainPosition(u,v,terrainElevation(u,v)));
        this.chunks.set(key,{center,trees:[],inner:tree.inner});
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
    const undergrowthRange=lightweight?66:112;
    const undrawn=this.undergrowthSelection;
    undrawn.length=0;
    for(const chunk of this.chunks.values()){
      const range=chunk.center.distanceToSquared(position);
      if(this.colliders){
        if(range<74**2&&!chunk.collider)this.addCollision(chunk);
        else if(range>96**2&&chunk.collider)this.removeCollision(chunk);
      }
      if(range<(undergrowthRange+58)**2){
        chunk.undergrowth??=undergrowthFor(chunk.trees);
        for(const plant of chunk.undergrowth){
          if(lightweight&&!plant.primary)continue;
          plant.distance=plant.point.distanceToSquared(position);
          if(plant.distance<(undergrowthRange+16)**2)undrawn.push(plant);
        }
      }
      const limit=chunk.inner?skylineRange:maxRange;
      if(range>(limit+chunkSize)**2)continue;
      for(const tree of chunk.trees){
        const distance=tree.point.distanceToSquared(position);
        if(distance>limit**2)continue;
        const level=distance>maxRange**2?3:distance<(lightweight?23:39)**2?2:distance<(lightweight?81:126)**2?1:0;
        const mesh=this.meshes[level+(tree.spreading?4:0)];
        mesh.setMatrixAt(mesh.count,tree.matrix);
        const light=.85+.29*tree.tint;
        mesh.setColorAt(mesh.count,this.tint.setRGB(light,light,.94*light+.06));
        mesh.count++;
      }
    }
    this.undergrowthDistance.value=undergrowthRange;
    if(undrawn.length>undergrowthBudget){
      undrawn.sort((a,b)=>a.distance-b.distance);
      this.undergrowthDistance.value=Math.min(undergrowthRange,Math.max(22,Math.sqrt(undrawn[undergrowthBudget-1].distance)-7));
    }
    const undergrowth=this.undergrowth;
    undergrowth.count=Math.min(undrawn.length,undergrowthBudget);
    for(let index=0;index<undergrowth.count;index++){
      const plant=undrawn[index];
      undergrowth.setMatrixAt(index,plant.matrix);
      undergrowth.setColorAt(index,this.tint.setRGB(plant.tint,plant.tint,plant.tint));
    }
    for(const mesh of [...this.meshes,undergrowth]){
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
    this.skylineMaterial.dispose();
    this.undergrowth.dispose();
    this.undergrowth.geometry.dispose();
    this.undergrowth.material.dispose();
  }
}
