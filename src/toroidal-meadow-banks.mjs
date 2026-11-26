import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,MeshStandardMaterial,Object3D,Vector3} from 'three';
import {approachCoordinates} from './sand3d-trail.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {terrainElevation,terrainMeadowMoisture,terrainPosition,terrainTrail,terrainWoodland,TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';

// Offsets use the existing trail's local metres. Each pocket reads as one
// bank, with a broken outline and open ground between pockets.
const beds=[
  {x:-10,z:23,across:3.2,along:5.8,heading:-.42,count:63},
  {x:11,z:31,across:4.6,along:7.8,heading:.47,count:75},
  {x:-23,z:33,across:4.8,along:8.4,heading:.63,count:82},
  {x:-34,z:8,across:5.5,along:9.3,heading:-.52,count:76},
  {x:-19,z:55,across:5.8,along:10.0,heading:-.57,count:71},
];
// Local metres from the arrival path through the western woodland edge.
const COVER_TILE=9;
const COVER_STEPS=27;
const COVER_END=43;
const COVER_COLUMNS=11,COVER_ROWS=14;
const coverTileCenters=Array.from({length:COVER_COLUMNS*COVER_ROWS},(_,index)=>({
  x:(index%COVER_COLUMNS-COVER_COLUMNS)*COVER_TILE,
  z:(Math.floor(index/COVER_COLUMNS)-1)*COVER_TILE,
}));
const coverWest=-(COVER_COLUMNS+.5)*COVER_TILE;
const coverSouth=-1.5*COVER_TILE;
const coverNorth=(COVER_ROWS-1.5)*COVER_TILE;
const goldenAngle=Math.PI*(3-Math.sqrt(5));
const tint=[0xfff3d7,0xe4edd2,0xe5ebce,0xffeec4,0xf5f7de];

function random(bed,index,salt) {
  let key=Math.imul(index+1,0x45d9f3b)^Math.imul(bed+3,0x7feb352d)^salt;
  key=Math.imul(key^(key>>>16),0x21f0aaad);
  key=Math.imul(key^(key>>>15),0x735a2d97);
  return ((key^(key>>>15))>>>0)/4294967296;
}

const boundary=[[0,0],...Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4)])];
function clearGround(x,z) {
  // Include the whole swept canopy in the test and keep away from the
  // authored parcel building, even when this visitor has no door access.
  if(Math.abs(x)<6.25)return false;
  return boundary.every(([dx,dz])=>{
    const {u,v}=approachCoordinates(x+.82*dx,z+.82*dz);
    return terrainTrail(u,v)<=.10;
  });
}

export function meadowBankPlants(lightweight) {
  return beds.map(({x,z,across,along,heading,count},bed)=>{
    const plants=[];
    const s=Math.sin(heading),c=Math.cos(heading);
    const lobes=7;
    for(let i=0;i<count;i++){
      const pick=salt=>random(bed,i,salt);
      const lobe=i%lobes,row=Math.floor(i/lobes);
      if(lightweight&&row&&pick(129)>.48)continue;
      const center=lobe*goldenAngle+heading;
      const radius=Math.sqrt(lobe/lobes)*(.76+.24*random(bed,lobe,33));
      const angle=row*goldenAngle+pick(23)*.8;
      const spread=Math.sqrt((row+.20)/Math.ceil(count/lobes));
      const a=(Math.cos(center)*radius+Math.cos(angle)*spread*.33)*across;
      const b=(Math.sin(center)*radius+Math.sin(angle)*spread*.33)*along;
      const point={x:x+a*c+b*s,z:z+b*c-a*s};
      if(!clearGround(point.x,point.z))continue;
      const {u,v}=approachCoordinates(point.x,point.z);
      const h=terrainElevation(u,v);
      if(h<TOROIDAL_TERRAIN.waterLevel+3)continue;
      const flowers=spread>.48&&pick(17)<.55;
      const size=flowers?.44+.31*pick(51):(.66+.31*pick(51))*(1-.20*spread);
      plants.push({u,v,h,size,flowers,yaw:6.28319*pick(29),
        color:tint[Math.floor(pick(87)*tint.length)]});
    }
    return plants;
  });
}

export function shortMeadowPlants(x,z,lightweight){
  const plants=[];
  const tile=Math.imul(x,73856093)^Math.imul(z,19349663);
  for(let row=0;row<COVER_STEPS;row++){
    for(let column=0;column<COVER_STEPS;column++){
      const index=row*COVER_STEPS+column;
      const pick=salt=>random(tile,index,salt);
      if(lightweight&&pick(251)<.22)continue;
      const px=x+COVER_TILE*((column+.08+.84*pick(71))/COVER_STEPS-.5);
      const pz=z+COVER_TILE*((row+.08+.84*pick(123))/COVER_STEPS-.5);
      if((px>-7.4&&pz<26)||pick(93)<Math.max(0,(px+10)/4))continue;
      const {u,v}=approachCoordinates(px,pz);
      const h=terrainElevation(u,v);
      const aboveWater=h-TOROIDAL_TERRAIN.waterLevel;
      if(aboveWater<.30||h>51)continue;
      const trail=terrainTrail(u,v);
      if(trail>.08||pick(113)<Math.max(trail*8,1-aboveWater/1.8))continue;
      const nearerEdge=Math.min(px-coverWest,pz-coverSouth,coverNorth-pz);
      if(pick(83)>Math.min(1,nearerEdge/7))continue;
      // Use the same continuous field as the woodland and its baked ground.
      // The floor stays covered in dense stands while lower leaves let ferns read.
      const canopy=terrainWoodland(u,v,h);
      if(pick(277)<canopy*.10)continue;
      const moisture=terrainMeadowMoisture(u,v,h);
      const palette=moisture>.54?[0x96ac70,0x81935a,0xb0b286]:[0xb2ad77,0xa0a46c,0xc1b78e];
      plants.push({u,v,h,yaw:pick(64)*2*Math.PI,size:(.68+.62*pick(48))*(1-canopy*.20),
        color:palette[Math.floor(pick(12)*palette.length)],canopy});
    }
  }
  return plants;
}

function shortLeafGeometry(lightweight){
  const positions=[],colors=[],indices=[],color=new Color();
  for(let i=0;i<(lightweight?4:5);i++){
    const angle=i*goldenAngle,x=Math.cos(angle),z=Math.sin(angle);
    const lean=.12+.28*random(33,i,3),height=.16+.24*random(33,i,9);
    const width=.015+.008*random(33,i,5);
    const base=positions.length/3;
    for(const [t,spread,shade] of [[0,width*.58,0x657341],[.55,width,0xb6ab74],[1,0,i%3?0xddd097:0xe6cda2]]){
      const radius=.045+lean*t*t;
      const rise=height*t*(1.17-.245*t)-.038;
      for(const side of (spread?[-1,1]:[0])){
        positions.push(radius*x+side*spread*z,rise,radius*z-side*spread*x);
        colors.push(...color.setHex(shade).toArray());
      }
    }
    indices.push(base,base+1,base+2,base+2,base+1,base+3,base+2,base+3,base+4);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function plantMesh(flowers,lightweight) {
  const positions=[],colors=[],color=new Color();
  const leaf=[0x3d542b,0x6d853d,0xaab35d,0xc6b470];
  const sprig=[0x3e6039,0x668b48,0x88a65d,0x9db26a];
  const triangle=(points,shades)=>{
    for(let i=0;i<3;i++){
      positions.push(...points[i]);
      colors.push(...color.setHex(shades[i]).toArray());
    }
  };
  const bladeCount=flowers?(lightweight?4:6):(lightweight?6:10);
  for(let i=0;i<bladeCount;i++){
    const angle=i*goldenAngle;
    const x=Math.cos(angle),z=Math.sin(angle);
    const height=(flowers?.23:.57)+random(7,i,11)*(flowers?.15:.29);
    const lean=(flowers?.26:.35)+random(8,i,15)*.20;
    const width=(lightweight?.075:.052)+random(9,i,37)*.024;
    const palette=flowers?sprig:leaf;
    const point=(t,side)=>{
      const bend=.04+t*t*lean;
      const cross=width*(1-t*.76)*side;
      return [x*bend-z*cross,t*height-.045,x*cross+z*bend];
    };
    let previous=[point(0,-1),point(0,1)];
    const levels=lightweight?[.53,1]:[.34,.69,1];
    for(let j=0;j<levels.length;j++){
      const t=levels[j],tip=t===1;
      const left=point(t,tip?0:-1),right=point(t,1);
      triangle([previous[0],previous[1],left],[palette[j],palette[j],palette[j+1]]);
      if(!tip)triangle([left,previous[1],right],[palette[j+1],palette[j],palette[j+1]]);
      previous=[left,right];
    }
    if(i>=(flowers?3:lightweight?1:3))continue;
    const stemTop=(flowers?.56:.83)+random(10,i,39)*(flowers?.15:.16);
    const span=(flowers?.21:.13)*(i+1)/3;
    const top=[span*x,stemTop,span*z];
    const root=[0,-.04,0],side=.022;
    triangle([root,[x*.07-z*side,stemTop*.73,z*.07+x*side],top],[palette[0],palette[1],palette[2]]);
    if(flowers){
      for(let k=0;k<5;k++){
        const a=k*6.28319/5;
        const petal=(offset,rise)=>[top[0]+.115*Math.cos(a+offset),stemTop+rise,top[2]+.115*Math.sin(a+offset)];
        triangle([top,petal(-.43,.018),petal(.43,.042)],
          [0xddb46d,i===1?0xf5e9d8:0xa066b9,i===1?0xfff6de:0xd2a1ee]);
      }
    }else{
      const ear=.11;
      const seed=[top[0]+x*.045,stemTop+ear,top[2]+z*.045];
      for(const [dx,dz] of [[z,-x],[x,z]]){
        const midA=[top[0]+dx*.032,stemTop+ear*.48,top[2]+dz*.032];
        const midB=[top[0]-dx*.035,stemTop+ear*.41,top[2]-dz*.035];
        triangle([top,midA,midB],[0xa8884c,0xd9be79,0xbfa060]);
        triangle([midA,seed,midB],[0xd9be79,0xe2c98a,0xc4a46d]);
      }
    }
  }
  const mesh=new BufferGeometry();
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3));
  mesh.setAttribute('color',new Float32BufferAttribute(colors,3));
  mesh.computeVertexNormals();
  return mesh;
}

export class ToroidalMeadowBanks {
  constructor(scene,applyDaylight,daylight) {
    this.group=new Group();
    this.group.name='Toroidal meadow banks';
    this.group.visible=false;
    scene.add(this.group);
    this.clock={value:0};
    this.viewer={value:new Vector3()};
    this.coverTiles=coverTileCenters.map(({x,z})=>{
      const {u,v}=approachCoordinates(x,z);
      return {x,z,position:new Vector3().fromArray(terrainPosition(u,v,terrainElevation(u,v)))};
    });
    this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.profiles=[false,true].map(lightweight=>{
      const group=new Group();
      group.visible=false;
      this.group.add(group);
      return {lightweight,group,geometries:[],materials:[],cover:new Map()};
    });
    this.applyDaylight=applyDaylight;
    this.daylight=daylight;
  }

  build({lightweight,group,geometries,materials}) {
    const transform=new Object3D(),origin=new Vector3(),color=new Color();
    const material=new MeshStandardMaterial({roughness:.96,side:DoubleSide,vertexColors:true});
    this.applyDaylight(material,this.daylight,.31);
    const before=material.onBeforeCompile;
    const clock=this.clock;
    if(!lightweight){
      material.customProgramCacheKey=()=> 'holodeck-meadow-breeze';
      material.onBeforeCompile=(shader,renderer)=>{
        before.call(material,shader,renderer);
        shader.uniforms.meadowSeconds=clock;
        shader.vertexShader=shader.vertexShader
          .replace('#include <common>','#include <common>\nuniform float meadowSeconds;')
          .replace('#include <begin_vertex>',`#include <begin_vertex>
            vec2 seed = (modelMatrix*instanceMatrix[3]).xz;
            float gust = sin(meadowSeconds*1.35+dot(seed,vec2(.32,.21)));
            float bend = max(transformed.y,0.0);
            vec3 wind = vec3(.12,0.0,.054)*bend*bend*gust;
            transformed.x += dot(normalize(instanceMatrix[0].xyz),wind);
            transformed.z += dot(normalize(instanceMatrix[2].xyz),wind);`);
      };
    }
    materials.push(material);
    geometries.push(plantMesh(false,lightweight),plantMesh(true,lightweight));
    meadowBankPlants(lightweight).forEach((plants,bed)=>{
      const {x,z}=beds[bed],{u,v}=approachCoordinates(x,z);
      origin.fromArray(terrainPosition(u,v,terrainElevation(u,v)));
      for(const flowers of [false,true]){
        const members=plants.filter(plant=>plant.flowers===flowers);
        if(!members.length)continue;
        const batch=new InstancedMesh(geometries[Number(flowers)],material,members.length);
        batch.name=flowers?'Meadow flowers':'Meadow tussocks';
        batch.position.copy(origin);
        for(const [index,plant] of members.entries()){
          transform.position.fromArray(terrainPosition(plant.u,plant.v,plant.h-.026));
          toroidalRotation(transform.position,plant.yaw,transform.quaternion);
          transform.position.sub(origin);
          transform.scale.setScalar(plant.size);
          transform.updateMatrix();
          batch.setMatrixAt(index,transform.matrix);
          batch.setColorAt(index,color.setHex(plant.color));
        }
        batch.computeBoundingSphere();
        batch.boundingSphere.radius+=.22;
        group.add(batch);
      }
    });
  }

  placeCover(profile,position){
    if(!profile.coverGeometry){
      const material=new MeshStandardMaterial({roughness:1,side:DoubleSide,vertexColors:true});
      this.applyDaylight(material,this.daylight,.24);
      const before=material.onBeforeCompile;
      material.customProgramCacheKey=()=> 'holodeck-meadow-cover';
      material.onBeforeCompile=(shader,renderer)=>{
        before.call(material,shader,renderer);
        shader.uniforms.coverViewer=this.viewer;
        shader.uniforms.coverSeconds=this.clock;
        shader.vertexShader=shader.vertexShader
          .replace('#include <common>','#include <common>\nuniform vec3 coverViewer;\nuniform float coverSeconds;\nvarying vec3 coverUp;')
          .replace('#include <begin_vertex>',`#include <begin_vertex>
            mat4 grassTransform=modelMatrix*instanceMatrix;
            vec3 root=grassTransform[3].xyz;
            coverUp=mat3(viewMatrix)*grassTransform[1].xyz;
            float variation=fract(dot(root,vec3(.517,.337,.631)));
            float end=${COVER_END.toFixed(1)}-variation*12.0;
            float cover=1.0-smoothstep(end-13.0,end,distance(root,coverViewer));
            float tip=clamp(transformed.y*3.0,0.0,1.0);
            transformed.x+=tip*tip*.035*sin(dot(root.xz,vec2(.53,.37))+coverSeconds*1.75);
            transformed.y=mix(-.08,transformed.y,cover);
            transformed.xz*=cover;`);
        shader.fragmentShader=shader.fragmentShader
          .replace('#include <common>','#include <common>\nvarying vec3 coverUp;')
          .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
            normal=normalize(mix(normal,normalize(coverUp),.56));`);
      };
      profile.materials.push(material);
      profile.coverMaterial=material;
      profile.coverGeometry=shortLeafGeometry(profile.lightweight);
      profile.geometries.push(profile.coverGeometry);
    }

    let batchBuilt=false;
    // Start with the closest tiles so distant foliage cannot delay the foreground.
    const viewTiles=[];
    for(const tile of this.coverTiles){
      const distance=tile.position.distanceToSquared(position);
      const visible=distance<(COVER_END+11)**2;
      const batch=profile.cover.get(tile);
      if(batch)batch.visible=visible;
      if(visible&&!profile.cover.has(tile))viewTiles.push({tile,distance});
    }
    viewTiles.sort((a,b)=>a.distance-b.distance);
    for(const {tile} of viewTiles){
      if(batchBuilt)break;
      const {x,z,position:origin}=tile;
      const plants=shortMeadowPlants(x,z,profile.lightweight);
      profile.cover.set(tile,null);
      if(!plants.length)continue;
      const batch=new InstancedMesh(profile.coverGeometry,profile.coverMaterial,plants.length);
      const transform=new Object3D(),color=new Color(),shade=new Color(0x61784e);
      batch.name='Short meadow grass';
      batch.position.copy(origin);
      for(const [index,plant] of plants.entries()){
        transform.position.fromArray(terrainPosition(plant.u,plant.v,plant.h));
        toroidalRotation(transform.position,plant.yaw,transform.quaternion);
        transform.position.sub(origin);
        transform.scale.setScalar(plant.size);
        transform.updateMatrix();
        batch.setMatrixAt(index,transform.matrix);
        batch.setColorAt(index,color.setHex(plant.color).lerp(shade,plant.canopy*.45));
      }
      batch.computeBoundingSphere();
      batch.boundingSphere.radius+=.10;
      profile.group.add(batch);
      profile.cover.set(tile,batch);
      batchBuilt=true;
    }
  }

  update(visible,lightweight,time,position) {
    this.group.visible=visible;
    if(!visible)return;
    this.viewer.value.copy(position);
    this.clock.value=this.reducedMotion?.matches?0:time*.001;
    for(const profile of this.profiles){
      profile.group.visible=profile.lightweight===lightweight;
      if(!profile.group.visible)continue;
      if(!profile.materials.length)this.build(profile);
      this.placeCover(profile,position);
    }
  }

  dispose() {
    for(const profile of this.profiles){
      for(const batch of profile.group.children)batch.dispose();
      for(const geometry of profile.geometries)geometry.dispose();
      for(const material of profile.materials)material.dispose();
    }
    this.group.removeFromParent();
  }
}
