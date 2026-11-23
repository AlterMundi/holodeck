// Original Holodeck procedural scenery. Rebuild replaces one bounded (<600 KiB)
// asset; no media generation or external service. Gameplay stays in Room/MML.
import { BoxGeometry, CylinderGeometry, ConeGeometry, DodecahedronGeometry, TorusGeometry, Matrix4, Quaternion, Euler, Vector3, Color } from 'three';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const args=process.argv.slice(2);
const eastReplaced=args[0]==='--east-replaced';
const stageRoot=resolve(new URL('../.state',import.meta.url).pathname)+'/';
if(args.length&&(!eastReplaced||args.length!==2||!resolve(args[1]).startsWith(stageRoot)))
  throw Error('Use --east-replaced with a task-owned .state output path');
const palettes={rock:'#364e59',rockLight:'#536c70',grass:'#6b987e',stone:'#cbd1b6',path:'#d3c19b',copper:'#bc8355',bark:'#786551',pine:'#365f58',leaf:'#6c9985',mint:'#a8cbb0',gold:'#e5b868',water:'#86adb0'};
const groups=new Map();
function add(geometry,material,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){
  const matrix=new Matrix4().compose(new Vector3(...position),new Quaternion().setFromEuler(new Euler(...rotation)),new Vector3(...scale));
  const g=(geometry.index?geometry.toNonIndexed():geometry).applyMatrix4(matrix);g.computeVertexNormals();
  const positions=Array.from(g.attributes.position.array),normals=Array.from(g.attributes.normal.array);
  const target=groups.get(material)||{positions:[],normals:[]};target.positions.push(...positions);target.normals.push(...normals);groups.set(material,target);g.dispose();
}
function box(x,y,z,w,h,d,material,angle=0){add(new BoxGeometry(w,h,d),material,[x,y,z],[1,1,1],[0,angle,0]);}
function cylinder(x,y,z,top,bottom,h,material,segments=16){add(new CylinderGeometry(top,bottom,h,segments,1,false),material,[x,y,z]);}
function stone(x,y,z,s,material='rockLight'){add(new DodecahedronGeometry(s,0),material,[x,y,z],[1,.65,.82],[0,x*.7,z*.2]);}
function ring(x,y,z,r,t,material,rotation=[Math.PI/2,0,0]){add(new TorusGeometry(r,t,5,32),material,[x,y,z],[1,1,1],rotation);}
// Four terraces, one shared walkable level. The two new destinations leave
// arrival/meeting, result viewing and cooperative play room to breathe.
function island(x,z,r,depth){
 cylinder(x,-depth*.25,z,r,r*.84,depth*.5,'rock',20);
 cylinder(x,-depth*.67,z,r*.84,r*.28,depth*.34,'rockLight',10);
 cylinder(x,-depth*.91,z,r*.28,.18,depth*.14,'rock',7);
 cylinder(x,-.005,z,r,r,.15,'grass',28); // Grass top y=.07; walking proxy y=.1 (deliberate3cm clearance).
}
island(0,0,10.75,5.2);
island(-22,0,8,5.4);
island(22,0,10,6);
// Preserve the north destination and its original bridge/arch coordinates.
cylinder(0,-1.25,-17,4.9,4.1,2.5,'rock',18);
cylinder(0,-3.0,-17,4.1,1.1,1.0,'rockLight',10);
cylinder(0,-.005,-17,4.9,4.9,.15,'grass',24);
// Distinct ground layers prevent coplanar z-fighting: grass .07, courts .09,
// paving/decks .1. Collision stays at .1; grass clearance is deliberately3cm.
// Clear central meeting plaza: no canopy, workbench or tall prop across views.
cylinder(0,.045,0,4.8,4.8,.09,'stone',32);
ring(0,.092,0,4.32,.018,'copper');
function pathBetween(x1,z1,x2,z2,width=2.5,spacing=.9){
 const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz),count=Math.ceil(length/spacing),angle=Math.atan2(dx,dz);
 for(let i=0;i<count;i++){
  const t=(i+.5)/count;box(x1+dx*t,.065,z1+dz*t,width,.07,length/count*.9,'path',angle);
 }
}
pathBetween(0,9,0,4.4,2.6);
pathBetween(0,-4.4,0,-9.9,2.6);
pathBetween(-4.5,0,-10.3,0,2.8);
pathBetween(4.5,0,10.3,0,2.8);
// Broad fixed promenades overlap each circular cap; parent MML supplies the
// same width/height collision rectangles. All deck top faces are exactly y=.1.
function promenade(left,right){
 const center=(left+right)/2,length=right-left;
 box(center,-.12,0,length,.14,3.2,'rockLight');
 const count=Math.ceil(length/.52);
 for(let i=0;i<count;i++)box(left+(i+.5)*length/count,.035,0,length/count*.95,.13,3.2,'path');
 for(const z of [-1.71,1.71]){
  box(center,.79,z,length,.07,.075,'copper');
  for(const x of [left+.14,center,right-.14]){
   cylinder(x,.43,z,.055,.075,.8,'copper',6);
   cylinder(x,.89,z,.095,.095,.11,'gold',6);
  }
 }
}
promenade(-14.6,-9.8);
promenade(9.8,12.7);
// West: a quiet open gallery court, with separate northern/southern entrances
// projected by Room at(-22,-2) and(-22,3). Nothing scenic impersonates a result.
cylinder(-22,.045,0,4.7,4.7,.09,'stone',28);
ring(-22,.092,0,4.25,.018,'copper');
pathBetween(-14.4,0,-18.0,0,2.8);
// East: deliberately keep the game lawn bare. Its actual recipe, coloured
// targets and progress belong to Room, not to decorative static ground art.
if(!eastReplaced){
 cylinder(14.5,.045,0,1.7,1.7,.09,'stone',20);
 pathBetween(15.2,1,18.1,3.6,2.4);
 pathBetween(18.1,3.6,22,4,2.4);
}
// Low sitting ledges stay at the edge of the arrival island, outside its axes.
for(const x of [-5.9,5.9]){
 box(x,.32,6.1,1.9,.43,.65,'stone');
 box(x,.57,6.1,2.0,.09,.72,'path');
}
// The north arch remains a distant landmark, not a roof over shared content.
cylinder(0,.045,-17,3.2,3.2,.09,'stone',24);
ring(0,2.35,-17.8,1.85,.13,'copper',[0,0,0]);
ring(0,2.35,-17.82,1.61,.035,'gold',[0,0,0]);
for(const x of [-1.8,1.8]){cylinder(x,1.02,-17.8,.14,.25,1.9,'copper',8);cylinder(x,.2,-17.8,.4,.4,.2,'stone',8);}
// Curated tree groups frame spaces from their rims. Arrival, bridge, both
// promenades, gallery portals and the eastern target field stay unobstructed.
const trees=[
 [-7.2,5.3,3.5],[7.5,5.2,3.7],[-6.6,-6.1,3.7],[6.7,-6.0,3.5],
 [-3.2,-18.2,2.8],[3.3,-18.5,3.1],
 [-27.3,-2.8,3.8],[-27.7,1.2,4.1],[-25.7,5.4,3.2],[-20.4,6.0,3.0],[-18.1,-5.7,3.4],[-24.7,-5.8,3.0],
 [29.0,3.2,4.2],[29.1,-3.1,4.0],[25.8,-7.5,3.7],[19.0,-7.7,3.9],[15.5,5.8,3.3],[21.0,8.0,3.4]
];
for(const [x,z,h] of trees){
 if(eastReplaced&&x>=14)continue;
 cylinder(x,h*.32,z,.12,.22,h*.64,'bark',7);
 add(new ConeGeometry(h*.34,h*.7,7,1),'pine',[x,h*.64,z]);
 add(new ConeGeometry(h*.27,h*.62,7,1),'leaf',[x,h*.91,z]);
 add(new ConeGeometry(h*.19,h*.46,7,1),'mint',[x,h*1.13,z]);
}
// A few deliberate stone/shrub groups replace the previous dense rim scatter.
for(const[x,z,s]of [[-8.1,4.8,.6],[8.4,4.3,.7],[-6.5,-7.3,.6],[6.6,-7,.6],[-28.1,-.4,.7],[-25,6.4,.6],[-18,-5.9,.6],[29.7,1,.8],[26.7,-7,.7],[19.4,-8.3,.7],[16,6.5,.6]]){
 if(eastReplaced&&x>=14)continue;
 stone(x,.19,z,s);
 if(s>=.7)add(new DodecahedronGeometry(.65,0),'leaf',[x+.45,.35,z+.4],[1,.55,.8]);
}
// Small lanterns give scale at junctions without a row of oversized structures.
for(const[x,z]of [[-1.7,8.0],[1.7,8.0],[-8.4,2],[8.4,2],[-16.2,1.9],[14.4,-1.9],[-1.7,-8.5],[1.7,-8.5]]){
 if(eastReplaced&&x>=14)continue;
 cylinder(x,.58,z,.055,.075,.95,'copper',6);
 add(new DodecahedronGeometry(.13,0),'gold',[x,1.14,z]);
}
// Calm horizon and off-axis distant islets: no extra walkable destination claim.
cylinder(0,-7,0,110,110,.12,'water',64);
for(const[x,z,r]of [[-39,-29,4],[38,-34,5],[-31,29,3]]){
 cylinder(x,-4.7,z,r,r*.3,4.5,'rockLight',7);
 cylinder(x,-2.4,z,r,r,.15,'grass',7);
}
// Single glTF mesh, one primitive per material; reusable static geometry only.
const bin=[],bufferViews=[],accessors=[],primitives=[],materials=[];let offset=0;
function data(array){const bytes=Buffer.from(new Float32Array(array).buffer);const index=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});bin.push(bytes);offset+=bytes.length;return index;}
for(const [name,g] of groups){
 const color=new Color(palettes[name]);materials.push({name,pbrMetallicRoughness:{baseColorFactor:[color.r,color.g,color.b,1],metallicFactor:name==='copper'?.35:0,roughnessFactor:.9},doubleSided:false});
 const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
 g.positions.forEach((n,i)=>{mins[i%3]=Math.min(mins[i%3],n);maxs[i%3]=Math.max(maxs[i%3],n);});
 const position=accessors.length;accessors.push({bufferView:data(g.positions),componentType:5126,count:g.positions.length/3,type:'VEC3',min:mins,max:maxs});
 const normal=accessors.length;accessors.push({bufferView:data(g.normals),componentType:5126,count:g.normals.length/3,type:'VEC3'});
 primitives.push({attributes:{POSITION:position,NORMAL:normal},material:materials.length-1});
}
const document={asset:{version:'2.0',generator:'Holodeck original procedural island scenery'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Workshop island scenery'}],meshes:[{primitives}],materials,buffers:[{byteLength:offset}],bufferViews,accessors};
let json=Buffer.from(JSON.stringify(document));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const binary=Buffer.concat(bin);const total=12+8+json.length+8+binary.length;
const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
const jsonHeader=Buffer.alloc(8);jsonHeader.writeUInt32LE(json.length);jsonHeader.writeUInt32LE(0x4e4f534a,4);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
if(total>600000)throw Error('Scenery budget exceeded');
writeFileSync(eastReplaced?resolve(args[1]):new URL('../public/assets/island-scenery.glb',import.meta.url),
 Buffer.concat([header,jsonHeader,json,binHeader,binary]));
console.log(`Created island scenery: ${total} bytes, ${materials.length} material batches`);
