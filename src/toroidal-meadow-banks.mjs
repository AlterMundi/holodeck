import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,MeshStandardMaterial,Object3D,Vector3} from 'three';
import {approachCoordinates} from './sand3d-trail.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {terrainElevation,terrainPosition,terrainTrail,TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';

// Offsets use the existing trail's local metres. Each pocket reads as one
// bank, with a broken outline and open ground between pockets.
const beds=[
  {x:-10,z:23,across:3.2,along:5.8,heading:-.42,count:63},
  {x:11,z:31,across:4.6,along:7.8,heading:.47,count:75},
  {x:-23,z:33,across:4.8,along:8.4,heading:.63,count:82},
  {x:-34,z:8,across:5.5,along:9.3,heading:-.52,count:76},
  {x:-19,z:55,across:5.8,along:10.0,heading:-.57,count:71},
];
// Short grass sits underneath the taller banks. Keep a broken outer edge
// and longer open channels so the route reads at a person's eye height.
const shortBeds=[
  {x:-13,z:19,across:5,along:8},
  {x:-20,z:28,across:6,along:9},
  {x:-29,z:18,across:7,along:9},
];
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

export function shortMeadowPlants(lightweight){
  return shortBeds.map(({x,z,across,along},bed)=>{
    const plants=[];
    for(let i=0;i<750;i++){
      const pick=salt=>random(bed+19,i,salt);
      if(lightweight&&i%3===2)continue;
      const a=pick(71)*2-1,b=pick(123)*2-1;
      if(a*a+b*b>.92+.12*Math.cos(b*13+a*7)||
         pick(93)>.72+.23*Math.sin(a*10-b*8))continue;
      const px=x+across*a,pz=z+along*b;
      const {u,v}=approachCoordinates(px,pz);
      const h=terrainElevation(u,v);
      if(Math.abs(px)<7||terrainTrail(u,v)>.08||h<TOROIDAL_TERRAIN.waterLevel+3)continue;
      plants.push({u,v,h,yaw:pick(64)*2*Math.PI,size:.68+.56*pick(48),
        color:[0x9eaa72,0xc3c687,0x869955][Math.floor(pick(12)*3)]});
    }
    return plants;
  });
}

function shortLeafGeometry(){
  const positions=[],colors=[],color=new Color();
  for(let i=0;i<5;i++){
    const angle=i*goldenAngle,x=Math.cos(angle),z=Math.sin(angle);
    const lean=.16+.14*random(33,i,3),height=.11+.13*random(33,i,9);
    const width=.026+.022*random(33,i,5);
    positions.push(.06*x-width*z,-.035,.06*z+width*x,
      .06*x+width*z,-.035,.06*z-width*x,lean*x,height,lean*z);
    for(const shade of [0x556b38,0x6a7d43,0xabb961])
      colors.push(...color.setHex(shade).toArray());
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
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
    this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.profiles=[false,true].map(lightweight=>{
      const group=new Group();
      group.visible=false;
      this.group.add(group);
      return {lightweight,group,geometries:[],materials:[]};
    });
    this.applyDaylight=applyDaylight;
    this.daylight=daylight;
  }

  build({lightweight,group,geometries,materials}) {
    const transform=new Object3D(),origin=new Vector3(),color=new Color();
    const material=new MeshStandardMaterial({roughness:.96,side:DoubleSide,vertexColors:true});
    this.applyDaylight(material,this.daylight);
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
    const cover=shortLeafGeometry();
    geometries.push(cover);
    shortMeadowPlants(lightweight).forEach((plants,bed)=>{
      const {x,z}=shortBeds[bed],{u,v}=approachCoordinates(x,z);
      origin.fromArray(terrainPosition(u,v,terrainElevation(u,v)));
      const batch=new InstancedMesh(cover,material,plants.length);
      batch.name='Short meadow grass';
      batch.position.copy(origin);
      for(const [index,plant] of plants.entries()){
        transform.position.fromArray(terrainPosition(plant.u,plant.v,plant.h));
        toroidalRotation(transform.position,plant.yaw,transform.quaternion);
        transform.position.sub(origin);
        transform.scale.setScalar(plant.size);
        transform.updateMatrix();
        batch.setMatrixAt(index,transform.matrix);
        batch.setColorAt(index,color.setHex(plant.color));
      }
      batch.computeBoundingSphere();
      batch.boundingSphere.radius+=.10;
      group.add(batch);
    });
  }

  update(visible,lightweight,time) {
    this.group.visible=visible;
    if(!visible)return;
    for(const profile of this.profiles){
      profile.group.visible=profile.lightweight===lightweight;
      if(profile.group.visible&&!profile.materials.length)this.build(profile);
    }
    this.clock.value=this.reducedMotion?.matches?0:time*.001;
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
