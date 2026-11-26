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
const skylineTransitionRange=120;
const skylineReturnMargin=8;

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
    shade.setHex(tint);
    for(const light of typeof value==='number'?[value,value,value]:value){
      colors.push(shade.r*light,shade.g*light,shade.b*light);
    }
  };
  const sides=[5,7,9][detail];
  const ring=(radius,height,angle)=>[Math.cos(angle)*radius,height,Math.sin(angle)*radius];
  for(let i=0;i<sides;i++){
    const a=i*TAU/sides,b=(i+1)*TAU/sides;
    const foot=ring(trunkWidth*.68,-.055,a),nextFoot=ring(trunkWidth*.68,-.055,b);
    const stemHeight=detail?.88:trunkDepth+.12;
    const top=ring(.008,stemHeight,a),nextTop=ring(.008,stemHeight,b);
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
      if(detail&&band<whorls-1){
        // Offset the needle lobes from their branch so the sky breaks
        // through the whorl. The low tier still carries the original trunk.
        const branchLength=radius*spread;
        const cos=Math.cos(a),sin=Math.sin(a);
        const point=(along,side,lift)=>[
          lean+branchLength*(along*cos-side*sin),
          base+.042+along*drop+lift,
          -.4*lean+branchLength*(along*sin+side*cos),
        ];
        if(detail===2){
          const startLeft=point(0,-.018,-.034),startRight=point(0,.018,-.034);
          const branchTip=point(.79,0,-.043);
          triangle(startLeft,startRight,branchTip,trunk,.42);
          triangle(startRight,startLeft,branchTip,trunk,.53);
        }
        const lobes=detail===2?[[.37,-.06,.20],[.65,.08,.18],[.96,-.02,.13]]:
          [[.45,-.035,.21],[.94,.06,.20]];
        for(const [order,[reach,offset,width]] of lobes.entries()){
          const flip=(i+band)%2?1:-1;
          const side=offset*flip;
          const ridge=point(reach-.29,side,.103-.018*order);
          const lobeTip=point(reach+(.025*Math.sin(i*4+band+order)),side,-.035-.011*order);
          const left=point(reach-.21,side-width,-.025);
          const right=point(reach-.18,side+width,-.011);
          const belly=point(reach-.29,side,.020);
          const value=scale*(.91+.09*Math.sin(i*4.71+band+order*2.2));
          triangle(ridge,lobeTip,left,tint,[.74*value,1.22*value,.96*value]);
          triangle(ridge,right,lobeTip,tint,[.74*value,.99*value,1.22*value]);
          triangle(belly,left,lobeTip,tint,[.56*value,.86*value,1.06*value]);
          triangle(belly,lobeTip,right,tint,[.56*value,1.06*value,.86*value]);
        }
        continue;
      }
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

// Offset the two closed skirts so the lower branches and the leader
// stay distinct from several angles without adding silhouette triangles.
function skylineGeometry(spreading=false){
  const positions=[],colors=[];
  const base=new Color(),leader=new Color();
  for(const [tier,height,radius,tipY,baseTint,tipTint] of [
    [0,.19,.224,.74,0x344d3d,0x567348],
    [1,.53,.146,1.00,0x465f44,0x70905a],
  ]){
    base.setHex(baseTint);leader.setHex(tipTint);
    const rim=side=>{
      const angle=(side+tier*.5)*TAU/5;
      const width=radius*(spreading?1.32:1)*(1+.12*Math.sin(side*TAU/5*2+tier));
      const lean=spreading?height*.13:0;
      return [lean+width*Math.cos(angle),height+.04*Math.sin(side*TAU/5+tier),width*Math.sin(angle)-lean*.4];
    };
    const lead=spreading?tipY*.145:0;
    const apex=[lead,tipY,-lead*.50];
    const under=spreading?height*.13:0;
    for(let side=0;side<5;side++){
      const east=rim(side),west=rim(side+1);
      positions.push(...east,...apex,...west,...west,under,height,-under*.4,...east);
      colors.push(base.r,base.g,base.b,leader.r,leader.g,leader.b,base.r,base.g,base.b);
      for(let vertex=0;vertex<3;vertex++)colors.push(base.r*.68,base.g*.68,base.b*.68);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const {center,radius}=geometry.boundingSphere;
  // Include the widest point of the vertex shader's transition.
  geometry.boundingSphere.radius=1.13*radius+.13*Math.hypot(center.x,center.z);
  return geometry;
}

function skylineMaterial(daylight,sun,viewer){
  const material=new MeshBasicMaterial({vertexColors:true,fog:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.woodlandDaylight=daylight;
    shader.uniforms.woodlandSun=sun;
    shader.uniforms.woodlandViewer=viewer;
    const varyings='varying vec3 vWoodlandAir;';
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\n'+varyings+'\nuniform vec3 woodlandSun;\nuniform vec3 woodlandViewer;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 root=(modelMatrix*instanceMatrix[3]).xyz;
        // The low lit mesh has a wider envelope. Ease it into the
        // existing skyline silhouette without moving the tree's root.
        float nearCrown=1.0-smoothstep(640.0,900.0,distance(root,woodlandViewer));
        transformed.xz*=1.0+.13*nearCrown;`)
      .replace('#include <project_vertex>',`#include <project_vertex>
        float radial=max(length(root.xz),.001);
        vec2 ring=root.xz/radial;
        vec2 tube=normalize(vec2(radial-${TOROIDAL_TERRAIN.majorRadius.toFixed(1)},root.y));
        vec3 along=vec3(-ring.y,0.0,ring.x);
        vec3 up=vec3(ring.x*tube.x,tube.y,ring.y*tube.x);
        vec3 around=vec3(-ring.x*tube.y,tube.x,-ring.y*tube.y);
        vec3 sun=woodlandSun.x*along+woodlandSun.y*up+woodlandSun.z*around;
        vec3 eye=normalize(cameraPosition-root);
        vec3 normalWorld=normalize(mat3(modelMatrix*instanceMatrix)*normal);
        vWoodlandAir=vec3(length(mvPosition.xyz),dot(-eye,sun),dot(normalWorld,sun));`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\n'+varyings+'\nuniform float woodlandDaylight;'+toroidalAirColor)
      .replace('#include <opaque_fragment>',`
        float haze=(1.0-exp(-vWoodlandAir.x/2650.0))*.56;
        float wrap=clamp(vWoodlandAir.z*.5+.5,0.0,1.0);
        float sunlight=mix(.84,1.08,wrap);
        vec3 crown=outgoingLight*mix(.28,.94*sunlight,woodlandDaylight);
        outgoingLight=mix(crown,toroidalAir(vWoodlandAir.y,woodlandDaylight),haze);
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

function fernGeometry(){
  const positions=[],colors=[];
  const root=new Color(0x345835),tip=new Color(0x9cad60),color=new Color();
  const vertex=(p,t)=>{
    positions.push(...p);
    colors.push(...color.copy(root).lerp(tip,t).toArray());
  };
  for(let i=0;i<7;i++){
    const angle=i*2.39996,x=Math.cos(angle),z=Math.sin(angle);
    const length=.64+.14*sample(i,19,63);
    const lift=.63+.33*sample(i,25,81);
    const point=(t,side=0)=>{
      const radius=length*t;
      return [x*radius-z*side,lift*(.34*t+.68*Math.sin(t*Math.PI*.84)),z*radius+x*side];
    };
    const start=point(0),end=point(1);
    vertex(start,.02);vertex(point(.47,.023),.44);vertex(point(.47,-.023),.44);
    vertex(point(.47,-.023),.44);vertex(point(.47,.023),.44);vertex(end,.92);
    for(let step=0;step<6;step++){
      const t=.20+step*.11;
      const width=.205*Math.sin(Math.PI*t)*Math.sqrt(1-t);
      const back=point(t-.055),front=point(t+.056),bend=.11*(1-t);
      const left=point(t+bend,-width),right=point(t+bend,width);
      vertex(back,t*.52);vertex(front,t*.70);vertex(left,.45+t*.42);
      vertex(back,t*.52);vertex(right,.45+t*.42);vertex(front,t*.70);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const normal=geometry.getAttribute('normal');
  const value=new Vector3();
  for(let index=0;index<normal.count;index++){
    value.fromBufferAttribute(normal,index);
    value.y=Math.abs(value.y)+.38;
    value.normalize();
    normal.setXYZ(index,value.x,value.y,value.z);
  }
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
        tint:.73+pick(911+index)*.35,primary:index===0,fern:pick(1241+index)>.45});
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
    useDaylight(this.material,daylight,.95);
    this.sun={value:new Vector3(0,1,0)};
    this.viewer={value:new Vector3()};
    this.skylineMaterial=skylineMaterial(daylight,this.sun,this.viewer);
    const trees=[...woodlandTrees(),...innerWoodlandTrees()].map(tree=>{
      const u=Math.round(tree.u*1e6),v=Math.round(tree.v*1e6);
      const switchDistance=maxRange-skylineTransitionRange*sample(u,v,8467);
      return {...tree,spreading:tree.height>=7.8&&sample(u,v,3941)>.59,
        skylineDistanceSq:switchDistance**2,returnDistanceSq:(switchDistance-skylineReturnMargin)**2};
    });
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
    useDaylight(understoryMaterial,daylight,.38);
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
    this.ferns=new InstancedMesh(fernGeometry(),understoryMaterial,undergrowthBudget);
    this.ferns.name='Woodland ferns';
    this.ferns.count=0;
    this.undergrowthSelection=[];
    this.group.add(this.undergrowth,this.ferns);
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

  update(position,lightweight,sunDirection){
    if(sunDirection)this.sun.value.fromArray(sunDirection);
    this.viewer.value.copy(position);
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
        // Switch at stable per-tree distances, with one mesh per tree.
        // Returning across the band takes a slightly closer approach.
        if(tree.inner){
          const threshold=tree.skyline?tree.returnDistanceSq:tree.skylineDistanceSq;
          tree.skyline=distance>threshold;
        }
        const level=tree.skyline?3:distance<(lightweight?23:39)**2?2:distance<(lightweight?81:126)**2?1:0;
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
    this.undergrowth.count=this.ferns.count=0;
    for(let index=0;index<Math.min(undrawn.length,undergrowthBudget);index++){
      const plant=undrawn[index];
      const mesh=plant.fern?this.ferns:this.undergrowth;
      mesh.setMatrixAt(mesh.count,plant.matrix);
      mesh.setColorAt(mesh.count,this.tint.setRGB(plant.tint,plant.tint,plant.tint));
      mesh.count++;
    }
    for(const mesh of [...this.meshes,this.undergrowth,this.ferns]){
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
    this.ferns.dispose();
    this.ferns.geometry.dispose();
    this.undergrowth.material.dispose();
  }
}
