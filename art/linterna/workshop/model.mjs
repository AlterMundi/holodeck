import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import dimensions from '../dimensions.json' with {type:'json'};
import {createRoom} from '../model.mjs';

const floorY = .10;
const fullHeight = dimensions.roomHeight;
const wallInset = 5.87;
const opening = {south:.35,north:4.62,lower:1.33,upper:2.92};
const workshop = dimensions.rooms.workshop;
const mainTable = workshop.objects.find(item => item.style === 'worktable');
const compareBench = workshop.objects.find(item => item.style === 'bench');

export const worktable = {
  id:'room-marker',
  anchor:[mainTable.x,.45,mainTable.z],
  turntable:[mainTable.x,1.146,mainTable.z],
};

export const comparisonSurfaces = [-.52,.51].map(offset =>
  [compareBench.x+offset,1.053,compareBench.z-.14]);

const material = (name,color,properties={}) => new T.MeshStandardMaterial({
  name,color,roughness:.8,...properties,
});

async function texture(name,color) {
  const map=await new T.TextureLoader().loadAsync('./materials/'+name+'.jpg');
  map.name=name;
  map.wrapS=map.wrapT=T.RepeatWrapping;
  if (color) map.colorSpace=T.SRGBColorSpace;
  map.anisotropy=8;
  map.userData.mimeType='image/jpeg';
  return map;
}

function realUV(geometry,dimensions,tile) {
  const normals=geometry.getAttribute('normal');
  const uv=geometry.getAttribute('uv');
  const [width,height,depth]=dimensions;
  for(let i=0;i<uv.count;i++){
    // Box face UVs follow those faces' local lengths. Keep a minimum repeat
    // on edges so the timber end grain is visible on legs and profiles.
    const x=Math.abs(normals.getX(i)),y=Math.abs(normals.getY(i)),z=Math.abs(normals.getZ(i));
    const [u,v]=x>y&&x>z?[depth,height]:y>z?[width,depth]:[width,height];
    uv.setXY(i,uv.getX(i)*Math.max(.23,u/tile),uv.getY(i)*Math.max(.23,v/tile));
  }
}

function box(root,name,finish,position,size,tile=0) {
  const geometry=new T.BoxGeometry(...size);
  if (tile) realUV(geometry,size,tile);
  const mesh=new T.Mesh(geometry,finish);
  mesh.name=name;
  mesh.position.set(...position);
  root.add(mesh);
  return mesh;
}

function dressOriginal(furniture,m) {
  furniture.position.y=floorY;
  furniture.traverse(mesh=>{
    if(!mesh.isMesh) return;
    const beveled=['Worktop','Leg','Stretcher','Bookcase end','Shelf board'].includes(mesh.name);
    if(beveled){
      const {width,height,depth}=mesh.geometry.parameters;
      const bevel=Math.min(.024,width*.16,height*.17,depth*.17);
      mesh.geometry=mergeVertices(new RoundedBoxGeometry(width,height,depth,1,bevel));
      realUV(mesh.geometry,[width,height,depth],1.06);
      mesh.material=mesh.name==='Worktop'?m.bench:m.timber;
    }
    if(mesh.name==='Atelier work mat')mesh.material=m.mat;
    if(mesh.name==='Working stand')mesh.material=m.turntable;
  });
}

function roomEnvelope(root,m) {
  const floor=box(root,'Oak plank floor',m.floor,[0,.07,0],[11.92,.06,11.92],1.72);
  floor.castShadow=false;
  box(root,'Plank ceiling',m.ceiling,[0,3.24,0],[11.9,.12,11.9],1.73);
  for(const z of [-5.68,-3.73,-1.80,.15,2.1,4.05,5.7])
    box(root,'Cross beam',m.timber,[0,3.10,z],[11.86,.19,.22],1.16);
  for(const x of [-5.67,-2.75,2.75,5.67])
    box(root,'Longitudinal beam',m.timber,[x,3.136,0],[.14,.17,11.84],1.24);
  for(const z of [-5.925,5.925]){
    box(root,'Lime plaster end wall',m.wall,[0,fullHeight/2,z],[11.94,fullHeight,.15],2.9);
    box(root,'Green base moulding',m.green,[0,.20,z*.984],[11.88,.20,.08]);
  }
  box(root,'Lime plaster east wall',m.wall,[5.925,fullHeight/2,0],[.15,fullHeight,11.95],2.9);
  const {south,north,lower,upper}=opening;
  const center=(south+north)/2;
  function westWall(start,end,lo,hi){
    box(root,'Lime plaster west wall',m.wall,[-5.925,(lo+hi)/2,(start+end)/2],
      [.15,hi-lo,end-start],2.9);
  }
  westWall(-5.98,south,0,fullHeight);
  westWall(north,5.98,0,fullHeight);
  westWall(south,north,0,lower);
  westWall(south,north,upper,fullHeight);
  for(const x of [-wallInset,wallInset]){
    box(root,'Green base moulding',m.green,[x,.2,0],[.075,.20,11.88]);
    box(root,'Green ceiling frieze',m.green,[x,2.99,0],[.083,.22,11.86]);
    for(const z of [-5.79,-2.97,-.18,4.86,5.79])
      box(root,'Wall trim',m.green,[x,1.54,z],[.14,2.88,.112]);
  }
  box(root,'Stone window sill',m.stone,[-5.77,lower-.033,center],[.43,.115,north-south+.15]);
  for(const z of [south,(south+north)/2,north]){
    box(root,'Window sash',m.window,[-5.84,(upper+lower)/2,z],[.20,upper-lower+.06,.09],1.15);
  }
  for(const y of [lower,(upper+lower)/2,upper]){
    box(root,'Window sash',m.window,[-5.84,y,center],[.20,.083,north-south+.11],1.15);
  }
  for(const z of [south+.96,north-.96]){
    box(root,'Narrow window muntin',m.window,[-5.84,(upper+lower)/2,z],[.082,upper-lower,.048],1.15);
  }
}

function returnDoor(root,m) {
  const [{x,z}]=workshop.doors;
  const frameZ=z+.18;
  box(root,'Recessed green return door',m.green,[x,1.12,frameZ],[1.48,2.05,.07]);
  for(const side of [-1,1]){
    box(root,'Warm timber return jamb',m.window,[x+side*.79,1.16,frameZ+.03],[.15,2.13,.18],1.05);
  }
  box(root,'Return door lintel',m.window,[x,2.25,frameZ+.03],[1.72,.16,.19],1.04);
  for(const y of [.58,1.56]){
    box(root,'Recessed door panel',m.panel,[x,y,frameZ+.04],[1.13,.66,.036]);
  }
  box(root,'Rounded brass lever',m.brass,[x+.52,1.18,frameZ+.103],[.14,.052,.082]);
}

function clayFixtures(root,m) {
  for (const [x,y,z] of comparisonSurfaces){
    box(root,'Removable comparison board',m.window,[x,y-.02,z],[.46,.047,.43],1.2);
  }
  box(root,'Tool tray',m.timber,[mainTable.x+.87,1.08,mainTable.z-.28],[.38,.042,.33],1.18);
  for(let i=0;i<4;i++){
    const handle=box(root,'Modelling tool handle',m.window,[.757+i*.064,1.112,-2.28+i*.013],[.028,.025,.24]);
    handle.rotation.y=.14-i*.023;
  }
}

export async function createFinishedWorkshop() {
  const [floor,floorNormal,wood,wall]=await Promise.all([
    texture('floor',true),texture('floor-normal',false),texture('bench',true),texture('wall',true),
  ]);
  const m={
    floor:material('Oak floor',0xf5e4cd,{map:floor,roughness:.53,normalMap:floorNormal,normalScale:new T.Vector2(.43,.43)}),
    ceiling:material('Cedar canopy',0xece0ce,{map:floor}),
    timber:material('Worn warm timber',0xeadecc,{map:wood,roughness:.77}),
    bench:material('Hand-worn worktop',0xfff1d9,{map:wood,roughness:.66}),
    window:material('Honey wood joinery',0xf9e6cb,{map:wood}),
    wall:material('Warm limewash',0xfff4e4,{map:wall,roughness:.94}),
    green:material('Muted sage green',0x50614d),
    panel:material('Green recessed paint',0x40523b),
    turntable:material('Honed stone turntable',0x716762,{roughness:.88}),
    stone:material('Limestone',0xb6a690),
    brass:material('Oiled bronze',0xa87b3f,{roughness:.45,metalness:.45}),
    mat:material('Moss green mat',0x64754e,{roughness:.93}),
  };
  const room=new T.Group();
  room.name='Casa Linterna / Hefesto / Claymon room art';
  room.userData={worktable,comparisonSurfaces,units:'metre',datumY:floorY};
  roomEnvelope(room,m);
  returnDoor(room,m);
  const furniture=createRoom('workshop',dimensions);
  dressOriginal(furniture,m);
  room.add(furniture);
  clayFixtures(room,m);
  room.traverse(mesh=>{
    if(mesh.isMesh){mesh.castShadow=mesh.name!=='Oak plank floor';mesh.receiveShadow=true;}
  });
  room.updateMatrixWorld(true);
  return room;
}
