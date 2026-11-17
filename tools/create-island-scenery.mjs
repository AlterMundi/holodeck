// Original Holodeck procedural scenery. Rebuild replaces one bounded (<600 KiB)
// asset; no media generation or external service. Gameplay stays in Room/MML.
import { BoxGeometry, CylinderGeometry, ConeGeometry, DodecahedronGeometry, TorusGeometry, Matrix4, Quaternion, Euler, Vector3, Color } from 'three';
import { writeFileSync } from 'node:fs';
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
// Faceted floating geology and a second destination, kept below walkable tops.
cylinder(0,-1.3,0,10.75,8.9,2.6,'rock',24);
cylinder(0,-3.3,0,8.9,2.4,1.9,'rockLight',12);
cylinder(0,-4.55,0,2.4,.2,.6,'rock',8);
cylinder(0,.025,0,10.75,10.75,.15,'grass',32);
cylinder(0,-1.25,-17,4.9,4.1,2.5,'rock',18);
cylinder(0,-3.0,-17,4.1,1.1,1.0,'rockLight',10);
cylinder(0,.025,-17,4.9,4.9,.15,'grass',24);
// Central plaza and warm paved approach. The thin seams give scale to walking.
cylinder(0,.12,0,3.3,3.3,.12,'stone',32);
ring(0,.195,0,2.9,.025,'copper');
for(let i=0;i<9;i++)box(0,.145,2.8+i*.64,2.1,.09,.56,'path');
for(let i=0;i<9;i++)box(0,.145,-3.1-i*.72,2.1,.09,.64,'path');
for(let i=0;i<24;i++){
  const a=i*Math.PI/12;box(Math.sin(a)*3.12,.20,Math.cos(a)*3.12,.56,.06,.29,'path',a);
}
// Two workbenches and a copper pergola frame a legible shared gathering place.
for(const x of [-3.9,3.9]){
  box(x,.86,.2,1.7,.18,1.0,'path');
  for(const dx of [-.6,.6])box(x+dx,.44,.2,.12,.8,.7,'copper');
  box(x,.97,.2,1.36,.035,.72,'stone');
}
for(const x of [-2.7,2.7])for(const z of [-2.1,2.1]){
  cylinder(x,1.55,z,.12,.15,3.0,'copper',8);
  cylinder(x,.2,z,.3,.34,.24,'stone',8);
  cylinder(x,3.08,z,.22,.22,.14,'gold',8);
}
for(const x of [-2.7,2.7])box(x,3.2,0,.18,.18,4.7,'copper');
for(const z of [-2.1,2.1])box(0,3.2,z,5.7,.18,.18,'copper');
for(const z of [-1.5,-.75,0,.75,1.5])box(0,3.35,z,5.4,.08,.16,'path');
// Destination arch and a comfortable circular overlook.
cylinder(0,.15,-17,3.2,3.2,.13,'stone',24);
ring(0,2.35,-17.8,1.85,.13,'copper',[0,0,0]);
ring(0,2.35,-17.82,1.61,.035,'gold',[0,0,0]);
for(const x of [-1.8,1.8]){cylinder(x,1.02,-17.8,.14,.25,1.9,'copper',8);cylinder(x,.2,-17.8,.4,.4,.2,'stone',8);}
// Sparse sculptural trees leave the arrival sightline and bridge corridor open.
const trees=[[-7,4,3.4],[-8,0,4],[-6.7,-4.5,3.7],[-4.5,-7,3.2],[7,3,3.7],[8,-1.4,4.1],[6.7,-5.4,3.3],[4.4,-7.8,3.5],[-3.2,-18,2.8],[3.3,-18.5,3.1]];
for(const [x,z,h] of trees){
 cylinder(x,h*.32,z,.12,.22,h*.64,'bark',7);
 add(new ConeGeometry(h*.34,h*.7,7,1), 'pine',[x,h*.64,z]);
 add(new ConeGeometry(h*.27,h*.62,7,1), 'leaf',[x,h*.91,z]);
 add(new ConeGeometry(h*.19,h*.46,7,1), 'mint',[x,h*1.13,z]);
 stone(x+.55,.23,z+.5,.45);
}
// Curated edge stones, shrubs and lantern posts. No per-frame decorative work.
for(let i=0;i<19;i++){
 const a=i*2.39996,r=8.6+(i%3)*.43,x=Math.sin(a)*r,z=Math.cos(a)*r;
 if(Math.abs(x)<2.5)continue;
 stone(x,.18,z,.42+(i%3)*.1);
 if(i%2===0){add(new DodecahedronGeometry(.55,0),'leaf',[x*.91,.43,z*.91],[1,.68,.8]);}
}
for(const z of [5.3,-5.2,-9.3])for(const x of [-1.7,1.7]){
 cylinder(x,.65,z,.065,.09,1.15,'copper',6);
 add(new DodecahedronGeometry(.16,0),'gold',[x,1.3,z]);
 cylinder(x,.14,z,.24,.25,.14,'stone',8);
}
// A calm sea and distant sculptural islets give the floating garden a horizon.
cylinder(0,-7,0,110,110,.12,'water',64);
for(const [x,z,r] of [[-28,-25,4],[26,-34,6],[-23,24,3]]){
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
writeFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url),Buffer.concat([header,jsonHeader,json,binHeader,binary]));
console.log(`Created island scenery: ${total} bytes, ${materials.length} material batches`);
