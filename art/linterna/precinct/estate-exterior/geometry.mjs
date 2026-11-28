import * as T from 'three';
import {estate,makeArrivalCourt} from '../estate-review/arrival-court.mjs';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Plot-local metres. +Z faces the shared path. The native exterior offers a
// standing point 0.85 m in front of the doorway, independent of the mesh.
export const plot={width:estate.parcelWidth,depth:estate.parcelDepth,
  stand:[0,.11,estate.threshold],doorway:[0,0,estate.threshold-.85],yaw:-90};
const sourceOffset=estate.threshold-estate.sourceDoor*estate.scale;
const center=(x,z)=>[x*estate.scale,z*estate.scale+sourceOffset];
const pavilions=[
  {name:'athena-shell',center:center(-13.5,-12.8),angle:.85,width:6.65,depth:6.8},
  {name:'hephaestus-shell',center:center(0,-22),angle:0,width:6.25,depth:6.8},
  {name:'apollo-shell',center:center(13.5,-12.8),angle:-.85,width:6.25,depth:6.8},
];

function limestone(){
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=384;
  const paint=canvas.getContext('2d');
  const tones=['#e1d2b6','#dac8a8','#d1bf9f','#dfcdae','#e2d4b8'];
  paint.fillStyle='#b6a58a';paint.fillRect(0,0,512,384);
  for(let row=0;row<8;row++)for(let col=-1;col<4;col++){
    const x=col*128+(row%2)*64,y=row*48;
    paint.fillStyle=tones[((row*13+col*7)%tones.length+tones.length)%tones.length];
    paint.fillRect(x+1,y+1,126,46);
    paint.fillStyle='rgba(255,250,230,.30)';
    paint.fillRect(x+1,y+1,126,2);
  }
  let seed=913345;
  for(let i=0;i<11000;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    paint.fillStyle=i%2?'rgba(86,62,39,.13)':'rgba(255,248,222,.18)';
    paint.fillRect(seed&511,(seed>>>16)%384,2,1);
  }
  const map=new T.CanvasTexture(canvas);
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.colorSpace=T.SRGBColorSpace;
  return map;
}

function builder(group,distant){
  const materials={
    stone:new T.MeshStandardMaterial({color:distant?0xdbcaab:0xffffff,
      map:distant?null:limestone(),roughness:.90}),
    trim:new T.MeshStandardMaterial({color:0xe7dcc7,roughness:.80}),
    roof:new T.MeshStandardMaterial({color:0xa45031,roughness:.86}),
    ridge:new T.MeshStandardMaterial({color:0x71351e,roughness:.94}),
    bronze:new T.MeshStandardMaterial({color:0x453827,roughness:.69,metalness:.32}),
    bark:new T.MeshStandardMaterial({color:0x73563c,roughness:.97}),
    green:new T.MeshStandardMaterial({color:0x3c512f,roughness:.89}),
    olive:new T.MeshStandardMaterial({color:0x687348,roughness:.88}),
    water:new T.MeshStandardMaterial({color:0x397a7d,roughness:.37}),
  };
  function mesh(geometry,key,x,y,z,parent=group){
    const instance=new T.Mesh(geometry,materials[key]);
    instance.position.set(x,y,z);
    parent.add(instance);
    return instance;
  }
  function block(key,x,y,z,width,height,depth,parent=group){
    const geometry=new T.BoxGeometry(width,height,depth);
    if(!distant&&key==='stone'){
      const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
      for(let i=0;i<p.count;i++){
        const xx=x+p.getX(i),yy=y+p.getY(i),zz=z+p.getZ(i);
        if(Math.abs(n.getY(i))>.6)uv.setXY(i,xx/4.4,zz/3);
        else uv.setXY(i,(Math.abs(n.getZ(i))>.6?xx:zz)/4.4,yy/3);
      }
    }
    return mesh(geometry,key,x,y,z,parent);
  }
  function roof(width,depth,eave,slope,parent){
    const run=width/2, length=run/Math.cos(slope);
    for(const side of [-1,1]){
      const x=side*run/2,y=eave+Math.tan(slope)*run/2;
      block('roof',x,y,0,length+.125,.16,depth,parent).rotation.z=-slope*side;
      if(!distant)for(let i=1;i<=Math.floor(run/.38);i++){
        const xx=i*.38;
        const tile=mesh(new T.CylinderGeometry(.035,.035,depth+.05,6),
          i%3===0?'ridge':'roof',xx*side,eave+Math.tan(slope)*(run-xx)+.069,0,parent);
        tile.rotation.x=Math.PI/2;
      }
    }
    mesh(new T.CylinderGeometry(.082,.082,depth+.1,10),'ridge',0,eave+Math.tan(slope)*run+.058,0,parent)
      .rotation.x=Math.PI/2;
    for(const side of [-1,1]){
      const face=new T.Shape();
      face.moveTo(-run+.16,0);face.lineTo(run-.16,0);face.lineTo(0,Math.tan(slope)*run);
      face.closePath();
      mesh(new T.ExtrudeGeometry(face,{depth:.12,bevelEnabled:false}),'trim',0,eave-.025,
        side*(depth/2-.08)-.055,parent);
    }
  }
  return {mesh,block,roof};
}

function surface(footprint,b,distant,boxes){
  const {name,center:[x,z],angle,width,depth,entry=false}=footprint;
  const parent=new T.Group();
  parent.name=name;
  parent.position.set(x,0,z);parent.rotation.y=angle;
  const {block,roof}=b;
  const H=entry?4.25:3.63, halfW=width/2,halfD=depth/2,wall=.235;
  const aperture=entry?1.55:1.36, top=entry?2.56:2.36;
  const push=(part,lx,ly,lz,w,h,d)=>{
    const c=Math.cos(angle),s=Math.sin(angle);
    boxes.push({id:name+'-'+part,position:[x+c*lx+s*lz,ly,z-s*lx+c*lz],
      size:[w,h,d],rotationY:angle*180/Math.PI});
  };
  const wallBox=(part,lx,ly,lz,w,h,d)=>{
    block('stone',lx,ly,lz,w,h,d,parent);
    push(part,lx,ly,lz,w,h,d);
  };
  wallBox('rear',0,H/2,-halfD+wall/2,width,H,wall);
  for(const side of [-1,1]){
    wallBox(side===-1?'left':'right',side*(halfW-wall/2),H/2,0,wall,H,depth);
    const wing=(width-aperture)/2;
    wallBox(side===-1?'front-left':'front-right',side*(aperture+wing)/2,H/2,
      halfD-wall/2,wing,H,wall);
  }
  block('stone',0,(H+top)/2,halfD-wall/2,aperture,H-top,wall,parent);
  block('trim',0,top-.05,halfD+.043,aperture+.54,.13,.29,parent);
  for(const s of [-1,1]){
    block('trim',s*(aperture/2+.097),top/2,halfD+.046,.19,top,.28,parent);
    block('bronze',s*(aperture*.25),top/2,halfD-.19,aperture/2-.018,top,.06,parent);
    if(!distant)block('trim',s*.127,top*.47,halfD-.145,.054,.16,.07,parent);
  }
  // The model has closed doors. Actual admission remains a Holodeck action
  // from the existing standing position, then a server-owned room move.
  push('closed-door',0,top/2,halfD-.19,aperture,top,.11);
  block('trim',0,.075,0,width+.26,.15,depth+.28,parent);
  block('trim',0,H-.035,0,width+.31,.18,depth+.38,parent);
  if(entry){
    // The Atlas keeps its split roof and visible light slot. The top opening
    // has a shadow-colored backing and contains no interior room geometry.
    for(const side of [-1,1]){
      const span=(width-1.9)/2;
      const slab=block('roof',side*(.95+span/2),H+.22,0,
        span+.06,.16,depth+.45,parent);
      slab.rotation.z=-side*.085;
    }
    block('bronze',0,H-.08,0,1.86,.12,depth-.26,parent);
  }else{
    roof(width+.65,depth+.65,H+.085,.255,parent);
  }
  return parent;
}

function rearGarden(group,b,distant){
  const {block,mesh}=b,boxes=[];
  const scenery=new T.Group();scenery.name='rear-garden';group.add(scenery);
  for(const side of [-1,1]){
    block('stone',side*21.2,.42,-16,.46,.88,34.1,scenery);
    boxes.push({id:side<0?'west-garden-wall':'east-garden-wall',
      position:[side*21.2,.42,-16],size:[.46,.88,34.1],rotationY:0});
    for(const z of [-7,-14,-24,-29]){
      const x=side*(z<-20?15.3:10.7),h=z<-20?5.0:3.8;
      const trunk=new T.Vector3(x,-.06,z);
      const fork=new T.Vector3(x+side*.31,h*.51,z+.15);
      branch(trunk,fork,.22,.12);
      for(const [dx,dz] of [[-.9,.14],[.8,.52],[.2,-.55]]){
        const tip=new T.Vector3(fork.x+dx,h,z+dz);
        branch(fork,tip,.095,.036);
        const plume=mesh(new T.IcosahedronGeometry(1.20,distant?0:1),
          dx>0?'olive':'green',tip.x,tip.y+.2,tip.z,scenery);
        plume.scale.set(1.2,.62,.96);
      }
      boxes.push({id:'olive-'+side+'-'+Math.abs(z),position:[x,.95,z],
        size:[.56,2.05,.60],rotationY:0});
    }
  }
  function branch(a,z,bottom,top){
    const middle=a.clone().lerp(z,.5),axis=z.clone().sub(a);
    const stem=mesh(new T.CylinderGeometry(top,bottom,axis.length()+.06,distant?6:12),
      'bark',middle.x,middle.y,middle.z,scenery);
    stem.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());
  }
  block('stone',0,.42,-33.4,42.85,.88,.46,scenery);
  boxes.push({id:'rear-garden-wall',position:[0,.42,-33.4],size:[42.85,.88,.46],rotationY:0});
  return boxes;
}

export function buildExterior(distant=false){
  const group=new T.Group();group.name=distant?'linterna-distance':'linterna-exterior';
  const court=makeArrivalCourt({distant});
  group.add(court);
  const b=builder(group,distant);
  const boxes=[];
  for(const z of [estate.portico.z-1.40,estate.portico.z+1.40])
    for(const x of [-6.7,-3.84,3.84,6.7])
      boxes.push({id:'portico-'+boxes.length,position:[x,2.62,z],size:[1.15,5.24,1.08],rotationY:0});
  for(const side of [-1,1]){
    boxes.push({id:'garden-basin-'+side,position:[side*9,.14,21.5],size:[3.5,.30,3.5],rotationY:0});
    boxes.push({id:'portico-side-wall-'+side,position:[side*20.1,.5,estate.portico.z+.48],
      size:[13,1.08,.61],rotationY:0});
    for(const z of [20,11])
      boxes.push({id:'raised-bed-'+side+'-'+z,position:[side*8.5,.1125,z],size:[8.8,.225,5.3],rotationY:0});
    for(const z of [23,16,8])
      boxes.push({id:'cypress-'+side+'-'+z,position:[side*(15.5+(z%2)*1.75),.78,z],
        size:[.46,1.65,.46],rotationY:0});
  }
  for(const x of [-2.29,-1.46,1.46,2.29])
    boxes.push({id:'entry-support-'+x,position:[x,1.38,estate.threshold+.86],
      size:[.53,2.76,.62],rotationY:0});
  const hall={name:'recibidor-shell',center:[0,plot.doorway[2]-4.38],angle:0,
    width:11.22,depth:8.76,entry:true};
  for(const footprint of [hall,...pavilions])group.add(surface(footprint,b,distant,boxes));
  boxes.push(...rearGarden(group,b,distant));
  return {group,boxes};
}

export function batchExterior(input){
  input.updateMatrixWorld(true);
  const sections=[];
  for(const member of input.children){
    const byMaterial=new Map();
    member.traverse(node=>{
      if(!node.isMesh)return;
      const source=node.geometry.clone().applyMatrix4(node.matrixWorld);
      for(const id of Object.keys(source.attributes))if(!['position','normal','uv'].includes(id))source.deleteAttribute(id);
      if(!source.getAttribute('normal'))source.computeVertexNormals();
      const raw=source.index?source.toNonIndexed():source;
      if(raw!==source)source.dispose();
      if(!raw.getAttribute('uv'))
        raw.setAttribute('uv',new T.BufferAttribute(new Float32Array(raw.attributes.position.count*2),2));
      if(!byMaterial.has(node.material))byMaterial.set(node.material,[]);
      byMaterial.get(node.material).push(raw);
    });
    const section=new T.Group();section.name=member.name;
    for(const [material,planes] of byMaterial){
      const combined=mergeGeometries(planes);
      section.add(new T.Mesh(mergeVertices(combined,.00015),material));
      combined.dispose();planes.forEach(plane=>plane.dispose());
    }
    sections.push(section);
  }
  const result=new T.Scene();result.add(...sections);
  return result;
}

export function collisionScene(boxes){
  const material=new T.MeshBasicMaterial(),pieces=[];
  for(const b of boxes){
    const transform=new T.Matrix4().makeRotationY(b.rotationY*Math.PI/180);
    transform.setPosition(...b.position);
    pieces.push(new T.BoxGeometry(...b.size).applyMatrix4(transform));
  }
  const scene=new T.Scene();
  scene.add(new T.Mesh(mergeGeometries(pieces),material));
  pieces.forEach(item=>item.dispose());
  return scene;
}
