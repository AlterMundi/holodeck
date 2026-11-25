import {
  BoxGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group,
  Mesh, MeshStandardMaterial, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {overlookCoordinates, terrainElevation, terrainPosition, TOROIDAL_OVERLOOK} from './toroidal-terrain.mjs';
import {useToroidalRockDetail} from './toroidal-surface-detail.mjs';

const floorHeight=terrainElevation(TOROIDAL_OVERLOOK.u,TOROIDAL_OVERLOOK.v);
const origin=new Vector3().fromArray(terrainPosition(TOROIDAL_OVERLOOK.u,TOROIDAL_OVERLOOK.v,floorHeight));
const localUp=new Vector3(0,1,0);
const orientation=toroidalRotation(origin,0);
const local=orientation.clone().invert();
const grade=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.atan(.025));

function ground(x,z){
  const {u,v}=overlookCoordinates(x,z);
  return new Vector3().fromArray(terrainPosition(u,v,terrainElevation(u,v))).sub(origin).applyQuaternion(local).y;
}

function easedBox(w,h,depth,bevel){
  const x=w/2-bevel,y=h/2-bevel;
  const outline=new Shape();
  outline.moveTo(-x,-y);outline.lineTo(x,-y);outline.lineTo(x,y);outline.lineTo(-x,y);outline.closePath();
  const geometry=new ExtrudeGeometry(outline,{steps:1,depth:depth-2*bevel,bevelEnabled:true,
    bevelThickness:bevel,bevelSize:bevel,bevelSegments:1});
  return geometry.translate(0,0,-depth/2+bevel);
}

function buildLookout(){
  const root=new Group();
  root.name='Inner ring overlook';
  root.position.copy(origin);
  root.quaternion.copy(orientation);
  const strata=new MeshStandardMaterial({roughness:.94,vertexColors:true});
  useToroidalRockDetail(strata,{bedding:true});
  const limestone=new MeshStandardMaterial({roughness:.81,vertexColors:true});
  useToroidalRockDetail(limestone);
  const timber=new MeshStandardMaterial({roughness:.74,vertexColors:true});
  const brass=new MeshStandardMaterial({roughness:.38,metalness:.62,vertexColors:true});
  const amber=new MeshStandardMaterial({color:0xffce8b,emissive:0xffa448,emissiveIntensity:.75,roughness:.39,vertexColors:true});
  const layers=new Map();
  const solid=[];
  const color=new Color();
  function add(material,geometry,x,y,z,hex,rotation){
    const piece=geometry.index?geometry.toNonIndexed():geometry;
    if(piece!==geometry)geometry.dispose();
    if(rotation)piece.applyQuaternion(rotation);
    piece.translate(x,y,z);
    color.setHex(hex);
    const channels=new Float32Array(piece.getAttribute('position').count*3);
    for(let i=0;i<channels.length;i+=3)color.toArray(channels,i);
    piece.setAttribute('color',new Float32BufferAttribute(channels,3));
    let parts=layers.get(material);
    if(!parts){parts=[];layers.set(material,parts);}
    parts.push(piece);
  }
  function block(material,x,y,z,w,h,d,bevel,hex,turn=0){
    add(material,easedBox(w,h,d,bevel),x,y,z,hex,
      turn?new Quaternion().setFromAxisAngle(localUp,turn):null);
  }
  function collision(x,y,z,w,h,d,rotation){
    const box=new BoxGeometry(w,h,d);
    if(rotation)box.applyQuaternion(rotation);
    solid.push(box.translate(x,y,z));
  }
  function rod(material,start,end,radius,hex,sides=8,blocksTravel=false){
    const a=new Vector3(...start),b=new Vector3(...end),direction=b.clone().sub(a),middle=a.lerp(b,.5);
    const geometry=new CylinderGeometry(radius,radius,direction.length(),sides);
    const rotation=new Quaternion().setFromUnitVectors(localUp,direction.normalize());
    if(blocksTravel)solid.push(geometry.clone().applyQuaternion(rotation).translate(...middle.toArray()));
    add(material,geometry,...middle.toArray(),hex,rotation);
  }

  // This thin paving follows the same graded terrain used by the walking solver.
  // Its bevels and joints sit on top of that support without inserting step edges.
  const stones=[0xc7ae83,0xb59a72,0xd1ba96,0xb29b7d,0xbfa581];
  for(let row=0;row<15;row++){
    const z=-6.92+row*.94;
    const edge=row===0?1.88:row===1?2.45:3.62;
    const widths=row%2?[.68,1.13,.95,1.34,.95,1.06,.86]:[1.16,.94,1.10,.88,1.24,1.04,1.12];
    const scale=2*edge/widths.reduce((sum,width)=>sum+width,0);
    let start=-edge;
    for(let col=0;col<widths.length;col++){
      const width=widths[col]*scale,x=start+width/2;
      const turning=new Quaternion().setFromAxisAngle(localUp,.013*Math.sin(row*2+col));
      add(limestone,easedBox(width-.020,.082,.909,.017),x,ground(x,z)-.009,z,
        stones[(col*7+row*11)%stones.length],grade.clone().multiply(turning));
      start+=width;
    }
  }

  const basalt=[0x696055,0x7c7060,0x635b55,0x877565];
  // Sheltered, uphill side. Three masonry courses keep the room-like alcove
  // visible at arrival, with the lake visible between the two low end returns.
  for(let row=0;row<3;row++)for(let bay=0;bay<8;bay++){
    const x=-3.66,z=-2.75+bay*.99;
    block(strata,x,ground(x,z)+.14+row*.29,z,.69,.283,.966,.05,basalt[(row*3+bay)%4],.028*Math.sin(bay));
  }
  const wallFloor=ground(-3.66,.72);
  collision(-3.66,wallFloor+.45,.72,.76,1.10,7.88,grade);
  add(limestone,easedBox(.79,.19,7.95,.07),-3.66,wallFloor+.92,.72,0xddc49e,grade);

  for(const z of [-2.3,4.13]){
    const x=-3.55,y=ground(x,z);
    for(let tier=0;tier<5;tier++){
      const width=.68-tier*.043;
      block(strata,x,y+.24+tier*.51,z,width,.526,width,.046,basalt[tier%4]);
    }
    block(limestone,x,y+2.615,z,.72,.18,.71,.055,0xe2cba4);
    collision(x,y+1.36,z,.62,2.77,.62);
    const rib=new Shape();
    rib.moveTo(-3.92,2.64);
    rib.quadraticCurveTo(-1.99,2.64,-.06,2.92);
    rib.lineTo(-.06,3.10);
    rib.quadraticCurveTo(-1.99,2.82,-3.92,2.82);
    rib.closePath();
    add(timber,new ExtrudeGeometry(rib,{curveSegments:7,depth:.23,
      bevelThickness:.026,bevelSize:.028,bevelSegments:1}),0,y,z-.115,0x6d472c);
    rod(timber,[-3.52,y+1.44,z],[-1.17,y+2.71,z],.09,0x816143,10,true);
    rod(brass,[-3.52,y+1.62,z],[-1.36,y+2.70,z],.027,0xe0ab69);
    const medallion=new Quaternion().setFromAxisAngle(localUp,Math.PI/2);
    add(brass,new TorusGeometry(.121,.019,5,20),x+.270,y+2.20,z,0xd1a575,medallion);
    add(brass,new SphereGeometry(.057,10,6),x+.270,y+2.20,z,0xddb283);
  }
  for(let i=0;i<9;i++){
    const x=-3.69+i*.42,y=2.90+ground(-3.55,.92)+.28*((x+3.92)/3.86)**2;
    add(timber,easedBox(.125,.175,7.15,.050),x,y,.92,i%2?0xa7754e:0x805837,grade);
    collision(x,y,.92,.125,.175,7.15,grade);
  }

  // Two separated stone wings leave the forward and return trails open while
  // creating a low, physical edge toward the lake and opposite arc.
  for(const [center,count] of [[-3.68,4],[3.25,5]]){
    for(let col=0;col<count;col++){
      const x=3.43,z=center+(col-(count-1)/2)*.86,y=ground(x,z);
      block(strata,x,y+.27,z,.56,.65,.84,.07,basalt[col%4]);
      block(limestone,x,y+.65,z,.67,.15,.84,.04,0xd9c29a);
    }
    collision(3.43,ground(3.43,center)+.30,center,.56,.76,count*.86-.025);
  }
  for(const z of [-2.03,1.11,5.24]){
    const x=3.39,y=ground(x,z);
    block(strata,x,y+.39,z,.69,.84,.65,.078,0x81715d);
    block(brass,x,y+.84,z,.45,.11,.45,.04,0xae7b47);
    block(amber,x,y+.935,z,.25,.16,.26,.042,0xffffff);
    block(brass,x,y+1.035,z,.36,.08,.37,.031,0xb48851);
    for(const dx of [-.125,.125])for(const dz of [-.125,.125])
      rod(brass,[x+dx,y+.86,z+dz],[x+dx,y+1.035,z+dz],.017,0x9d744f);
    collision(x,y+.42,z,.66,.94,.62);
  }

  // A single open oak bench faces the observable ridge across the valley.
  const seatX=-2.68,seatZ=.58,seatY=ground(seatX,seatZ);
  for(const z of [-.65,1.81])block(strata,seatX,seatY+.21,z,.57,.46,.49,.042,0x776555);
  for(let row=0;row<4;row++)block(timber,seatX-.27+row*.174,seatY+.475,seatZ,.161,.087,2.95,.021,0xac7950);
  collision(seatX,seatY+.23,seatZ,.71,.52,2.95);

  // Engraved direction marker made of metal rings and two rays, set into paving.
  const markY=ground(1.72,-.05)+.048,flat=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
  for(const radius of [.28,.344])add(brass,new TorusGeometry(radius,.012,4,40),1.72,markY,-.05,0xe1b875,flat);
  rod(brass,[1.49,markY,-.05],[2.33,markY,-.05],.017,0xe5ba72);
  rod(brass,[1.98,markY,-.26],[2.33,markY,-.05],.017,0xe5ba72);
  rod(brass,[1.98,markY,.16],[2.33,markY,-.05],.017,0xe5ba72);
  add(brass,new SphereGeometry(.048,10,6),1.72,markY,-.05,0xf2c788);

  for(const [material,pieces] of layers){
    const mesh=new Mesh(mergeGeometries(pieces),material);
    mesh.name=material===limestone?'Staggered limestone paving':material===strata?'Bedded stonework':
      material===timber?'Curved oak canopy and bench':material===amber?'Amber edge lanterns':'Bronze detailing';
    mesh.receiveShadow=true;
    mesh.castShadow=material===strata||material===timber;
    root.add(mesh);
    for(const piece of pieces)piece.dispose();
  }
  const obstruction=new Mesh(mergeGeometries(solid),new MeshStandardMaterial());
  obstruction.name='Lookout masonry and seating collision';
  obstruction.visible=false;
  for(const piece of solid)piece.dispose();
  root.add(obstruction);
  return {root,obstruction};
}

export class ToroidalOverlook {
  constructor(scene,colliders){
    this.scene=scene;
    this.colliders=colliders;
  }

  update(position){
    const distance=origin.distanceToSquared(position);
    if(!Number.isFinite(distance))return;
    if(!this.landmark&&distance<265**2){
      this.landmark=buildLookout();
      this.scene.add(this.landmark.root);
      this.landmark.root.updateWorldMatrix(true,true);
    }
    if(!this.landmark||!this.colliders)return;
    if(!this.colliding&&distance<46**2){
      this.colliders.addCollider(this.landmark.obstruction);
      this.colliding=true;
    }else if(this.colliding&&distance>58**2)this.removeCollision();
  }

  removeCollision(){
    if(!this.colliding)return;
    this.colliders.removeCollider(this.landmark.obstruction);
    this.colliding=false;
  }

  dispose(){
    if(!this.landmark)return;
    const {root}=this.landmark;
    this.removeCollision();
    root.removeFromParent();
    for(const mesh of root.children){
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.landmark=null;
  }
}
