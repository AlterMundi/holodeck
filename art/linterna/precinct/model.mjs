import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRoom} from '../model.mjs';
import dimensions from '../dimensions.json' with {type:'json'};
import {approachDoor, gardenArc, hall, pavilionDoor, pavilions, place, roomCenters, roomPartition} from './plan.mjs';

const colors = {
  chalk:0xdec9a5, limestone:0xcbb68d, trim:0xe8d8b9, foundation:0x9e876a,
  plaster:0xb39770, cedar:0x855438, warmWood:0xa67147, oak:0x503a29,
  sage:0x4d6251, roofLine:0x6c7c61, brass:0xc6a064, terracotta:0xa45b41,
  slate:0x777974, amber:0xffba55, lawn:0xa6ad79, moss:0x819364,
  leaf:0x607b4f, olive:0x7d905a, brightLeaf:0x95a267, palePath:0xc9b593,
  warmPath:0xbca27d, darkPath:0xaa9070,
};
const materials = Object.fromEntries(Object.entries(colors).map(([name,color]) =>
  [name,new T.MeshStandardMaterial({name,color,roughness:.91})]));
materials.amber.emissive.setHex(0xffaa42);
materials.amber.emissiveIntensity = .55;
const cube = new T.BoxGeometry(1,1,1);
const round = new T.CylinderGeometry(1,1,1,14);
const taper = new T.CylinderGeometry(.81,1,1,18);
const leafGeometry = new T.IcosahedronGeometry(1,1);
leafGeometry.deleteAttribute('uv');
const foliage = mergeVertices(leafGeometry);
const sphere = new T.SphereGeometry(1,12,8);

function part(group, geometry, finish, x,y,z, w,h,d) {
  const mesh = new T.Mesh(geometry, materials[finish]);
  mesh.position.set(x,y,z);
  mesh.scale.set(w,h,d);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

const box = (group, finish, x,y,z,w,h,d) => part(group,cube,finish,x,y,z,w,h,d);
const cyl = (group, finish, x,y,z,w,h,d=w) => part(group,round,finish,x,y,z,w,h,d);

function solid(out, group, finish, x,y,z,w,h,d) {
  const mesh = box(group,finish,x,y,z,w,h,d);
  out.push(mesh);
  return mesh;
}

function boxCollider(out, group, x,y,z,w,h,d) {
  const obstacle = new T.Object3D();
  obstacle.position.set(x,y,z);
  obstacle.scale.set(w,h,d);
  group.add(obstacle);
  out.push(obstacle);
}

function pillar(out, group, x,z,height,radius) {
  box(group,'foundation',x,.08,z,radius*3.05,.16,radius*3.05);
  box(group,'trim',x,.21,z,radius*2.6,.12,radius*2.6);
  part(group,taper,'limestone',x,(height+.11)/2,z,radius,height-.38,radius);
  for (let i=0;i<12;i++) {
    const angle = i*Math.PI/6;
    const flute = box(group,'chalk',x+Math.cos(angle)*radius*.9, height*.47,
      z+Math.sin(angle)*radius*.9, .025,height-.63,.025);
    flute.rotation.y = -angle;
  }
  cyl(group,'trim',x,height-.26,z,radius*1.13,.14);
  box(group,'trim',x,height-.125,z,radius*2.77,.19,radius*2.77);
  boxCollider(out,group,x,height/2,z,radius*2.26,height,radius*2.26);
}

function gabledRoof(group, halfWidth, halfDepth, spring, rise, finish='sage') {
  const shape = new T.Shape();
  shape.moveTo(-halfWidth,spring);
  shape.lineTo(0,spring+rise);
  shape.lineTo(halfWidth,spring);
  shape.closePath();
  part(group,new T.ExtrudeGeometry(shape,{depth:halfDepth*2,bevelEnabled:false}),
    'warmWood',0,0,-halfDepth,1,1,1);
  const angle = Math.atan2(rise,halfWidth);
  const slope = Math.hypot(halfWidth,rise);
  for (const side of [-1,1]) {
    const plane = box(group,finish,side*halfWidth/2,spring+rise/2+.061,0,slope+.29,.09,halfDepth*2+.26);
    plane.rotation.z = -side*angle;
    for (let z=-halfDepth+.12; z<halfDepth; z+=.31) {
      const rib = box(group,'roofLine',side*halfWidth/2,spring+rise/2+.114,z,slope+.26,.018,.03);
      rib.rotation.z = -side*angle;
    }
    const facade = box(group,'trim',side*halfWidth/2,spring+rise/2,halfDepth,.99*slope,.10,.08);
    facade.rotation.z = -side*angle;
  }
  box(group,finish,0,spring+rise+.083,0,.12,.11,2*halfDepth+.29);
}

function doorway(out, group, width, z, height, openings, finish='chalk') {
  const gapWidth = height>4 ? 1.92 : 1.46;
  let last = -width/2;
  for (const x of openings) {
    const edge = x-gapWidth/2;
    if (edge > last) solid(out,group,finish,(last+edge)/2,height/2,z,edge-last,height,.23);
    box(group,'cedar',x,2.43,z,gapWidth+.18,.18,.31);
    box(group,'brass',x,2.54,z+.17,gapWidth*.76,.039,.039);
    box(group,'palePath',x,.024,z,gapWidth,.044,.48);
    for (const side of [-1,1])
      box(group,'cedar',x+side*(gapWidth/2+.038),1.17,z,.084,2.34,.28);
    solid(out,group,finish,x,(height+2.5)/2,z,gapWidth,height-2.5,.23);
    last = x+gapWidth/2;
  }
  if (last < width/2) solid(out,group,finish,(last+width/2)/2,height/2,z,width/2-last,height,.23);
}

function closedDoor(group,out,x,z,width) {
  solid(out,group,'cedar',x,1.18,z,width,2.36,.14);
}

function worldFurnishings(out, group) {
  const plan=dimensions.rooms.atlas;
  const model=createRoom('atlas',dimensions);
  const center=6.5, atlas=plan.objects.find(item=>item.style==='atlas');
  model.position.z=center-atlas.z;
  const mural=model.getObjectByName('Atlas horizon mural');
  mural.rotation.y=-Math.PI/2;
  mural.position.set(1.34,0,2.8);
  group.add(model);

  // Suspend the original pendant from the taller colonnade's skylight crossbar.
  box(group,'foundation',0,4.60,center,2.76,.12,.10);
  cyl(group,'brass',atlas.x,3.91,center,.015,1.35);

  const heights={atlas:1.43,bench:.53,seats:1.13,hooks:1.58};
  for (const {style,shape,x,z,w,d,r} of plan.objects) {
    const height=heights[style],width=shape==='circle'?2*r:w,depth=shape==='circle'?2*r:d;
    boxCollider(out,model,x,height/2,z,width,height,depth);
  }
}

function floorPavers(group, width, start, end, bounds) {
  const rows = Math.ceil((end-start)/1.18);
  const cols = Math.ceil(width/1.18);
  const d = (end-start)/rows, w = width/cols;
  for (let row=0;row<rows;row++) {
    for (let col=0;col<cols;col++) {
      const finish = ['limestone','chalk','trim'][(row*31+col*7+row*col)%3];
      if (!bounds) {
        box(group,finish,(col+.5)*w-width/2,.002,start+(row+.5)*d,w-.021,.039,d-.019);
        continue;
      }
      const left=Math.max(col*w-width/2+.0105,bounds[0]);
      const right=Math.min((col+1)*w-width/2-.0105,bounds[1]);
      const back=Math.max(start+row*d+.0095,bounds[2]);
      const front=Math.min(start+(row+1)*d-.0095,bounds[3]);
      if (right>left && front>back)
        box(group,finish,(left+right)/2,.002,(back+front)/2,right-left,.039,front-back);
    }
  }
}

function mainTemple(group, out) {
  floorPavers(group,14.8,.9,12.63);
  doorway(out,group,14.8,hall.entrance,4.68,[0]);
  for (const side of [-1,1]) {
    const x=side*7.35;
    solid(out,group,'chalk',x,2.26,8.85,.32,4.52,6.95);
    for (const z of [1.7,4.08,6.46,8.84,11.22])
      pillar(out,group,side*6.7,z,4.55,.29);
    box(group,'plaster',side*4.4,4.81,7.07,6.19,.22,11.95);
    box(group,'trim',side*4.4,4.66,7.07,6.12,.15,11.95);
    for (const z of [2.8,5.38,8.78,11.34])
      box(group,'foundation',side*4.26,4.55,z,6.08,.14,.107);
  }
  for (const x of [-4.45,-2.24,2.24,4.45])
    pillar(out,group,x,hall.columns,4.55,.27);
  for (const z of [1.68,4.93,8.82,12.18])
    box(group,'trim',0,4.7,z,14.92,.34,.35);
  for (const x of [-1.32,1.32])
    box(group,'trim',x,5.12,7.01,.18,.54,10.0);
  box(group,'limestone',0,4.51,1.7,14.5,.18,.29);
  box(group,'foundation',0,-.025,.63,14.94,.083,.58);
  worldFurnishings(out,group);
}

function statue(group, out, icon) {
  const x=1.04, z=.25;
  solid(out,group,'foundation',x,.20,z,.63,.40,.58);
  box(group,'trim',x,.41,z,.67,.064,.61);
  box(group,'limestone',x-.087,.67,z,.124,.48,.16).rotation.z=.13;
  box(group,'limestone',x+.10,.66,z,.12,.46,.15).rotation.z=-.07;
  part(group,foliage,'chalk',x,1.02,z,.23,.31,.146);
  part(group,sphere,'limestone',x,1.33,z,.12,.163,.119);
  const arm = box(group,'chalk',x-.21,1.08,z,.12,.35,.115);
  arm.rotation.z= icon==='hammer' ? -.66 : .47;
  box(group,'chalk',x+.19,1.01,z,.113,.32,.113).rotation.z=.31;
  if (icon==='hammer') {
    cyl(group,'oak',x-.32,1.34,z,.028,.37);
    box(group,'foundation',x-.32,1.52,z,.26,.105,.13).rotation.z=-.15;
  } else if (icon==='owl') {
    part(group,foliage,'foundation',x-.29,1.22,z,.10,.14,.074);
    for(const offset of [-.035,.035]) part(group,sphere,'brass',x-.29+offset,1.26,z+.058,.026,.027,.024);
  } else {
    for(const offset of [-.065,0,.065]) box(group,'brass',x-.22+offset,1.2,z+.04,.013,.21,.033);
    box(group,'foundation',x-.22,1.31,z+.04,.24,.043,.067);
  }
}

function workstations(group, out, rooms, furnitureOnly=false) {
  for (const {id,x} of rooms) {
    solid(out,group,'oak',x,.41,-3.58,1.53,.82,.62);
    box(group,'warmWood',x,.85,-3.58,1.71,.12,.73);
    if (furnitureOnly) continue;
    if (id==='printing') {
      box(group,'slate',x,.96,-3.57,.72,.12,.44);
      for (const sx of [-.31,.31]) box(group,'oak',x+sx,1.26,-3.57,.085,.55,.42);
      box(group,'slate',x,1.52,-3.57,.73,.11,.45);
      cyl(group,'terracotta',x,1.02,-3.48,.13,.12);
    } else if (id==='atelier') {
      cyl(group,'slate',x,.96,-3.58,.32,.09);
      part(group,foliage,'terracotta',x,1.17,-3.58,.20,.26,.211);
      box(group,'cedar',x+.47,.95,-3.53,.26,.07,.32);
    } else {
      for (let slot=0;slot<3;slot++)
        box(group, ['terracotta','sage','brass'][slot],x+(slot-1)*.36,.96,-3.57,.24,.12,.33);
    }
  }
}

function temple(parent, out, plan, exterior=false) {
  const group=new T.Group(), rooms=roomCenters(plan);
  group.name=plan.id;
  group.position.set(plan.origin[0],0,plan.origin[1]);
  group.rotation.y=plan.turn;
  parent.add(group);
  const width=rooms.length===3 ? 9 : 8.4, edge=width/2;
  if (!exterior) floorPavers(group,width,-4.38,4.68);
  doorway(out,group,width,pavilionDoor,3.19,[0]);
  if (!exterior) doorway(out,group,width,roomPartition,3.12,rooms.map(room=>room.x),'plaster');
  solid(out,group,'chalk',0,1.57,-4.29,width,3.14,.21);
  for (const side of [-1,1]) {
    solid(out,group,'chalk',side*edge,1.57,-.21,.22,3.14,8.38);
    for (const x of [1.47,edge-.53]) pillar(out,group,side*x,4.66,3.15,.19);
  }
  if (!exterior) {
    for (let i=1;i<rooms.length;i++)
      solid(out,group,'plaster',-edge+width*i/rooms.length,1.56,-2.5,.17,3.12,3.45);
  }
  box(group,'trim',0,3.21,.12,width+.55,.19,9.57);
  box(group,'foundation',0,3.34,.12,width+.65,.1,9.64);
  gabledRoof(group,edge+.37,4.88,3.4,1.22,plan.roof);
  for (const x of [-.98,.98]) {
    box(group,'oak',x,1.84,3.953,.105,.26,.12);
    box(group,'amber',x,1.95,4,.127,.127,.103);
  }
  if (exterior) {
    closedDoor(group,out,0,pavilionDoor,1.46);
    return;
  }
  for (const side of [-1,1]) {
    box(group,'foundation',side*(edge-.14),.215,1.55,.12,.41,4.2);
    box(group,'oak',side*(edge-.27),1.86,1.1,.15,.22,.17);
    box(group,'amber',side*(edge-.24),1.994,1.1,.19,.16,.16);
  }
  statue(group,out,plan.icon);
  workstations(group,out,rooms);
}

function path(group, points, width) {
  const spline=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));
  const count=Math.ceil(spline.getLength()/.44);
  for (let i=0;i<=count;i++) {
    const v=spline.getPointAt(i/count), t=spline.getTangentAt(i/count);
    for (const j of [-1,0,1]) {
      const shift=j*width/3, tone=['palePath','warmPath','darkPath','palePath'][(i*13+j+5)%4];
      const stone=part(group,foliage,tone,v.x-t.z*shift,.014,v.z+t.x*shift,.23+width*.067,.038,.27);
      stone.rotation.y=(i*2.399+j)*.91;
    }
  }
}

function shrubs(group,x,z,size,index) {
  const scale=.88+(index%5)*.073;
  for(let j=0;j<4;j++) {
    part(group,foliage,['leaf','olive','brightLeaf','leaf'][j],
      x+Math.cos(j*1.9)*size*.41,size*(.42+j*.08),z+Math.sin(j*1.9)*size*.41,
      size*scale,size*.61,size*.79).rotation.y=index*.81+j;
  }
}

function tree(group,x,z,size,index) {
  cyl(group,'oak',x,size*.51,z,.12*size,1.04*size);
  for(let j=0;j<4;j++) {
    part(group,foliage,['leaf','olive','brightLeaf','leaf'][j],
      x+Math.cos(j*2.2)*size*.25,size*(1.2+j*.12),z+Math.sin(j*2.2)*size*.27,
      size*.62,size*.64,size*.56).rotation.y=index*.79+j;
  }
}

function plantingClear(x,z,radius) {
  if (z>hall.columns-radius && z<hall.entrance+radius && Math.abs(x)<hall.halfWidth+radius) return false;
  return !pavilions.some(pavilion=>{
    const dx=x-pavilion.origin[0],dz=z-pavilion.origin[1];
    const sine=Math.sin(pavilion.turn),cosine=Math.cos(pavilion.turn);
    const localX=dx*cosine-dz*sine,localZ=dx*sine+dz*cosine;
    return Math.abs(localX)<4.52+radius && localZ>-4.35-radius && localZ<4.74+radius;
  });
}

function gardenPaths(group) {
  box(group,'lawn',0,-.165,-6,51,.3,54);
  path(group,gardenArc,1.86);
  path(group,[[0,1],[0,-3],[0,-8],[0,-13],[0,-16.5],[0,-18.13]],2.05);
  path(group,[gardenArc[0],place(pavilions[0],0,pavilionDoor-.23)],1.85);
  path(group,[gardenArc.at(-1),place(pavilions[2],0,pavilionDoor-.23)],1.85);
}

function gardenPlanting(group) {
  for (let i=0;i<21;i++) {
    const angle=.08+i*.151, radius=18.4+(i%4)*.62;
    const x=Math.cos(angle)*radius,z=-Math.sin(angle)*radius-3.72;
    if (plantingClear(x,z,1.45)) shrubs(group,x,z,.66+(i%5)*.12,i);
    if (i%2===0 && plantingClear(x*1.18,z-1.05,2.06)) tree(group,x*1.18,z-1.05,1.40+(i%4)*.24,i);
  }
  for (const side of [-1,1]) {
    const edges=[[4.42,-1.75,.50],[4.15,-3.35,.67],[5.62,-4.8,.60],[6.5,-10.17,.79],
      [4.94,-11.75,.55],[3.81,-13.05,.75],[9.81,-5.57,.51],[10.77,-5.8,.69]];
    edges.forEach(([x,z,size],i)=>{
      if (plantingClear(side*x,z,size*1.46)) shrubs(group,side*x,z,size,i);
    });
    for (let i=0;i<10;i++) {
      const x=side*(i%2===0 ? 5.8+i*.54 : 6.98+i*.5);
      const z=-1-i*.53;
      shrubs(group,x,z,.26+i%4*.16,i);
    }
    for (let i=0;i<8;i++) {
      const x=side*(15+i%3*2.4),z=2.9-i*4.88;
      if (plantingClear(x,z,2.12)) tree(group,x,z,1.38+i%3*.39,i);
    }
  }
  for (let i=0;i<34;i++) {
    const x=Math.sin(i*2.12)*(21+i%4),z=-29-Math.sin(i)*4;
    if (plantingClear(x,z,2.25)) tree(group,x,z,1.26+(i%4)*.3,i+7);
  }
}

function loggias(group, obstacles) {
  for (const x of [-7.1,7.1]) {
    const loggia=new T.Group();
    loggia.position.set(x,0,-19.9);
    loggia.rotation.y=x<0?.36:-.36;
    group.add(loggia);
    box(loggia,'foundation',0,.025,0,3.23,.05,2.88);
    for (const px of [-1.33,1.33]) for (const z of [-1.04,1.04])
      pillar(obstacles,loggia,px,z,2.62,.14);
    box(loggia,'trim',0,2.62,0,3.31,.13,2.83);
    gabledRoof(loggia,1.68,1.43,2.71,.63);
  }
}

function porch(parent, out) {
  box(parent,'lawn',0,-.17,2.8,23,.31,20);
  path(parent,[[3.42,7.1],[1.78,5.06],[.53,3.48],[0,approachDoor]],.95);
  for(const x of [-3.2,-2.12,2.3,3.67]) shrubs(parent,x,-.67,.49,Math.abs(x*10));
  for (const x of [-5.4,-4.4,5.2,6.1]) tree(parent,x,-2.8,1.52,Math.abs(x*10));
  const facade=new T.Group();
  facade.name='Small street temple';
  parent.add(facade);
  smallTemple(facade,out);
}

function smallTemple(parent,out) {
  box(parent,'foundation',0,.047,.03,1.79,.09,3.55);
  solid(out,parent,'limestone',0,.96,-.96,1.52,1.92,.20);
  for(const side of [-1,1]) {
    solid(out,parent,'limestone',side*.69,1.00,-.19,.166,2.0,1.76);
    solid(out,parent,'limestone',side*.564,1.0,.67,.268,2.0,.24);
    pillar(out,parent,side*.685,1.21,2.02,.071);
    pillar(out,parent,side*.446,1.21,2.02,.063);
    box(parent,'warmWood',side*.825,1.87,.99,.06,.29,.18);
  }
  box(parent,'warmWood',0,2.10,.02,1.72,.19,2.74);
  gabledRoof(parent,.825,1.29,2.19,.375);
  const oculus=cyl(parent,'amber',0,2.333,1.307,.078,.041);
  oculus.rotation.x=Math.PI/2;
  box(parent,'oak',0,.87,.733,.828,1.74,.09);
  box(parent,'warmWood',0,.846,.785,.727,1.64,.022);
  box(parent,'brass',.259,.898,.815,.056,.066,.051);
  box(parent,'amber',.526,1.347,.858,.088,.117,.09);
}

export function makeScene(stage) {
  const group=new T.Group(), obstacles=[];
  group.name=stage==='approach' ? 'Linterna approach' : 'Linterna precinct';
  if (stage==='approach') porch(group,obstacles);
  else {
    gardenPaths(group);
    gardenPlanting(group);
    mainTemple(group,obstacles);
    pavilions.forEach(pavilion=>temple(group,obstacles,pavilion));
    loggias(group,obstacles);
  }
  group.updateMatrixWorld(true);
  return {group,obstacles};
}

export function makeHefestoSliceScenes() {
  const hefesto=pavilions.find(pavilion=>pavilion.id==='hephaestus');
  const rooms=roomCenters(hefesto);
  const roomWidth=rooms[1].x-rooms[0].x;
  const width=roomWidth*rooms.length, edge=width/2;
  const cells=[];
  function layer(cell, name, origin, build) {
    const group=new T.Group(), obstacles=[];
    group.name=name;
    build(group,obstacles);
    group.position.set(-origin[0],0,-origin[1]);
    group.updateMatrixWorld(true);
    cells.push({cell,name,group,obstacles});
  }
  layer('arrival','hall',[0,0],mainTemple);
  layer('arrival','garden-paths',[0,0],gardenPaths);
  layer('arrival','garden-planting',[0,0],gardenPlanting);
  layer('arrival','pavilion-exteriors',[0,0],(group,out)=>{
    pavilions.forEach(pavilion=>temple(group,out,pavilion,true));
    loggias(group,out);
  });
  layer('hefesto','foyer',[0,0],(group,out)=>{
    floorPavers(group,width,-4.38,4.68,[-edge,edge,roomPartition,pavilionDoor+.82]);
    doorway(out,group,width,pavilionDoor,3.19,[0]);
    doorway(out,group,width,roomPartition,3.12,rooms.map(room=>room.x),'plaster');
    closedDoor(group,out,0,pavilionDoor,1.46);
    for (const room of rooms) closedDoor(group,out,room.x,roomPartition,1.46);
    for (const side of [-1,1])
      solid(out,group,'chalk',side*edge,1.57,(roomPartition+pavilionDoor)/2,
        .22,3.14,pavilionDoor-roomPartition);
    const roof=new T.Group();
    roof.position.z=1.55;
    group.add(roof);
    gabledRoof(roof,edge+.37,2.52,3.4,1.22,hefesto.roof);
    statue(group,out,hefesto.icon);
  });
  for (const room of rooms) {
    layer(room.id,room.id,[room.x,-1.58],(group,out)=>{
      const half=roomWidth/2;
      floorPavers(group,width,-4.38,4.68,[room.x-half,room.x+half,-4.38,roomPartition]);
      const local=new T.Group();
      local.position.x=room.x;
      group.add(local);
      doorway(out,local,roomWidth,roomPartition,3.12,[0],'plaster');
      closedDoor(local,out,0,roomPartition,1.46);
      solid(out,local,'chalk',0,1.57,-4.29,roomWidth,3.14,.21);
      for (const side of [-1,1])
        solid(out,local,'chalk',side*half,1.57,(-4.29+roomPartition)/2,.17,3.14,3.59);
      box(local,'plaster',0,3.24,-2.5,roomWidth,.18,3.59);
      // The projected worktable supplies the actual Claymon. The printing room
      // keeps its own stand-in fixture from the design study.
      workstations(local,out,[{id:room.id,x:0}],room.id==='atelier');
    });
  }
  return cells;
}

// World space clearance for the local camera. Top lintels and floor are
// evaluated by height. The asset still has its native mesh collision surface.
export function floorClearance(obstacles) {
  const hulls=obstacles.flatMap(mesh=>{
    const half=new T.Vector3().setFromMatrixScale(mesh.matrixWorld).multiplyScalar(.5);
    const y=new T.Vector3().setFromMatrixPosition(mesh.matrixWorld).y;
    return y-half.y<1.78 && y+half.y>.10
      ? [{inverse:mesh.matrixWorld.clone().invert(),half}] : [];
  });
  const local=new T.Vector3();
  return ([x,z], radius=.23) => !hulls.some(({inverse,half})=>{
    local.set(x,1,z).applyMatrix4(inverse);
    return Math.abs(local.x)<.5+radius/(2*half.x)
      && Math.abs(local.z)<.5+radius/(2*half.z);
  });
}
