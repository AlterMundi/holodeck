import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {Worker} from 'node:worker_threads';
import {Box3,Color,Matrix4,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

// Every teleport destination can describe itself as a small low-poly icon.
// The icon is derived from the destination's own source (its room art, its
// house facade, the Residence export) and is keyed by that source's revision,
// so editing the source produces a new icon without anyone maintaining it.
// Destinations without a usable source keep the authored miniature.

export const TELEPORT_ICON_VERSION='tp-icon-v1';
const FOOTPRINT=.24, HEIGHT=.26, TRIANGLES=1400, CACHE=64;
const MAX_SOURCE_BYTES=24*1024*1024;

export function iconKey(source){
  return createHash('sha256').update(TELEPORT_ICON_VERSION+'\0'+source.kind+'\0'+source.revision)
    .digest('hex').slice(0,32);
}

// Small PNG reader (8-bit greyscale/RGB/RGBA/palette, not interlaced) that
// averages the image into a coarse colour grid for per-vertex sampling.
const GRID=32;
export function pngGrid(bytes){
  if(bytes.readUInt32BE(0)!==0x89504e47)return null;
  let at=8,width=0,height=0,depth=0,type=0,interlace=0,palette=null;const data=[];
  while(at<bytes.length){
    const length=bytes.readUInt32BE(at),kind=bytes.toString('ascii',at+4,at+8),body=bytes.subarray(at+8,at+8+length);
    if(kind==='IHDR'){width=body.readUInt32BE(0);height=body.readUInt32BE(4);depth=body[8];type=body[9];interlace=body[12];}
    else if(kind==='PLTE')palette=body;
    else if(kind==='IDAT')data.push(body);
    else if(kind==='IEND')break;
    at+=12+length;
  }
  const channels={0:1,2:3,3:1,4:2,6:4}[type];
  if(depth!==8||interlace||!channels||width*height>4096*4096)return null;
  const raw=inflateSync(Buffer.concat(data)),stride=width*channels,pixels=Buffer.alloc(stride*height);
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)),out=y*stride;
    for(let x=0;x<stride;x++){
      const a=x>=channels?pixels[out+x-channels]:0,b=y?pixels[out-stride+x]:0,c=x>=channels&&y?pixels[out-stride+x-channels]:0;
      let v=line[x];
      if(filter===1)v+=a;else if(filter===2)v+=b;else if(filter===3)v+=(a+b)>>1;
      else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
      pixels[out+x]=v&255;
    }
  }
  const sums=new Float64Array(GRID*GRID*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*channels;let r,g,b;
    if(type===3){const p=pixels[i]*3;r=palette[p];g=palette[p+1];b=palette[p+2];}
    else if(channels<3){r=g=b=pixels[i];}else{r=pixels[i];g=pixels[i+1];b=pixels[i+2];}
    const cell=(Math.min(GRID-1,Math.floor(y*GRID/height))*GRID+Math.min(GRID-1,Math.floor(x*GRID/width)))*4;
    // sRGB -> linear, as three's colours are linear
    sums[cell]+=(r/255)**2.2;sums[cell+1]+=(g/255)**2.2;sums[cell+2]+=(b/255)**2.2;sums[cell+3]++;
  }
  const grid=new Float32Array(GRID*GRID*3);
  for(let i=0;i<GRID*GRID;i++)for(let k=0;k<3;k++)grid[i*3+k]=sums[i*4+3]?sums[i*4+k]/sums[i*4+3]:.6;
  return grid;
}

// GLB without images for parsing; PNG base colours are kept as colour grids.
function untextured(bytes){
  const length=bytes.readUInt32LE(12);
  const contents=JSON.parse(bytes.toString('utf8',20,20+length));
  const binStart=20+length+8;
  const imageGrid=image=>{
    if(image?.bufferView===undefined||image.mimeType!=='image/png')return null;
    const view=contents.bufferViews[image.bufferView];
    try{return pngGrid(bytes.subarray(binStart+(view.byteOffset??0),binStart+(view.byteOffset??0)+view.byteLength));}catch{return null;}
  };
  const grids=new Map();
  for(const material of contents.materials??[]){
    for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];
    if(material.pbrMetallicRoughness){
      const texture=material.pbrMetallicRoughness.baseColorTexture;
      if(texture){
        const image=contents.images?.[contents.textures?.[texture.index]?.source];
        const grid=imageGrid(image);
        material.extras={...(material.extras??{}),iconGrid:grids.size,iconTextured:true};
        if(grid)grids.set(grids.size,grid);
        else material.extras.iconGrid=-1;
      }
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    if(material.extensions)for(const name of Object.keys(material.extensions))
      if(name!=='KHR_materials_emissive_strength')delete material.extensions[name];
  }
  delete contents.images;delete contents.textures;delete contents.samplers;
  if(contents.extensionsRequired)contents.extensionsRequired=contents.extensionsRequired
    .filter(name=>name==='EXT_meshopt_compression'||name==='KHR_mesh_quantization');
  const text=Buffer.from(JSON.stringify(contents));
  const json=Buffer.alloc(Math.ceil(text.length/4)*4,32);
  text.copy(json);
  const header=Buffer.from(bytes.subarray(0,20)),rest=bytes.subarray(20+length);
  header.writeUInt32LE(20+json.length+rest.length,8);
  header.writeUInt32LE(json.length,12);
  return {bytes:Buffer.concat([header,json,rest]),grids};
}

async function parseScene(bytes){
  const {bytes:clean,grids}=untextured(Buffer.from(bytes));
  const buffer=clean.buffer.slice(clean.byteOffset,clean.byteOffset+clean.length);
  await MeshoptDecoder.ready;
  const scene=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'')).scene;
  scene.userData.iconGrids=grids;
  return scene;
}

const materialColour=(material,out)=>{
  out.copy(material?.color??new Color(.8,.8,.8));
  // Textures we cannot read (JPEG/WebP) on white bases read as warm stone.
  if(material?.userData?.iconTextured&&material.userData.iconGrid<0&&out.r>.9&&out.g>.9&&out.b>.9)out.setRGB(.62,.55,.46);
  return out;
};

// Flatten visible meshes into world-space triangles with per-vertex colour.
export function collectTriangles(root,{skip=()=>false}={}){
  root.updateMatrixWorld(true);
  const positions=[],colors=[];
  const p=new Vector3(),c=new Color(),normal=new Matrix4(),grids=root.userData.iconGrids??new Map();
  root.traverse(object=>{
    if(!object.isMesh||!object.visible||skip(object))return;
    const geometry=object.geometry,attribute=geometry.getAttribute('position');
    if(!attribute)return;
    const index=geometry.index,materials=[object.material].flat();
    const groups=geometry.groups.length?geometry.groups:[{start:0,count:index?index.count:attribute.count,materialIndex:0}];
    normal.copy(object.matrixWorld);
    for(const group of groups){
      const material=materials[group.materialIndex??0]??materials[0];
      if(material?.transparent&&material.opacity<.5)continue;
      materialColour(material,c);
      const grid=grids.get(material?.userData?.iconGrid),uv=geometry.getAttribute('uv');
      for(let i=group.start;i<group.start+group.count;i++){
        const vertex=index?index.getX(i):i;
        p.fromBufferAttribute(attribute,vertex).applyMatrix4(normal);
        positions.push(p.x,p.y,p.z);
        if(grid&&uv){
          const u=uv.getX(vertex),v=uv.getY(vertex);
          const gx=Math.floor(((u%1)+1)%1*GRID),gy=Math.floor(((v%1)+1)%1*GRID);
          const cell=(Math.min(GRID-1,gy)*GRID+Math.min(GRID-1,gx))*3;
          colors.push(c.r*grid[cell],c.g*grid[cell+1],c.b*grid[cell+2]);
        }else colors.push(c.r,c.g,c.b);
      }
    }
  });
  return {positions:new Float32Array(positions),colors:new Float32Array(colors)};
}

// Vertex clustering on a uniform grid: deterministic, dependency-free and it
// gives the faceted low-poly look. Coarsens until the triangle budget holds.
export function clusterTriangles({positions,colors},{triangles=TRIANGLES,cells=26}={}){
  const count=positions.length/3;
  if(count<3)return null;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<count;i++)for(let a=0;a<3;a++){
    min[a]=Math.min(min[a],positions[i*3+a]);max[a]=Math.max(max[a],positions[i*3+a]);
  }
  const extent=Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2])||1;
  for(let grid=cells;grid>=4;grid=Math.floor(grid*.82)){
    const size=extent/grid,cellOf=new Map(),sums=[];
    const cell=i=>{
      const key=[0,1,2].map(a=>Math.min(grid,Math.floor((positions[i*3+a]-min[a])/size))).join(',');
      let id=cellOf.get(key);
      if(id===undefined){id=sums.length;cellOf.set(key,id);sums.push([0,0,0,0,0,0,0]);}
      const s=sums[id];
      for(let a=0;a<3;a++){s[a]+=positions[i*3+a];s[3+a]+=colors[i*3+a];}
      s[6]++;
      return id;
    };
    const faces=new Set(),out=[];
    for(let t=0;t<count;t+=3){
      const a=cell(t),b=cell(t+1),c=cell(t+2);
      if(a===b||b===c||a===c)continue;
      const key=[a,b,c].sort((x,y)=>x-y).join(',');
      if(faces.has(key))continue;
      faces.add(key);out.push(a,b,c);
    }
    if(out.length/3>triangles&&grid>4)continue;
    const used=new Map(),vertices=[],tints=[],indices=[];
    for(const id of out){
      let next=used.get(id);
      if(next===undefined){
        const s=sums[id];next=vertices.length/3;used.set(id,next);
        vertices.push(s[0]/s[6],s[1]/s[6],s[2]/s[6]);tints.push(s[3]/s[6],s[4]/s[6],s[5]/s[6]);
      }
      indices.push(next);
    }
    return {positions:new Float32Array(vertices),colors:new Float32Array(tints),indices};
  }
  return null;
}

// Fit the icon on a pedestal: centred, standing on y=0, inside the footprint.
export function fitIcon(mesh){
  const box=new Box3(),p=new Vector3();
  for(let i=0;i<mesh.positions.length;i+=3)box.expandByPoint(p.fromArray(mesh.positions,i));
  const size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
  const scale=Math.min(FOOTPRINT/Math.max(size.x,size.z,1e-6),HEIGHT/Math.max(size.y,1e-6));
  for(let i=0;i<mesh.positions.length;i+=3){
    mesh.positions[i]=(mesh.positions[i]-center.x)*scale;
    mesh.positions[i+1]=(mesh.positions[i+1]-box.min.y)*scale;
    mesh.positions[i+2]=(mesh.positions[i+2]-center.z)*scale;
  }
  return mesh;
}

// Rooms are shown as a dollhouse: drop the ceiling so the inside reads.
function withoutCeiling(geometry){
  const {positions,colors}=geometry;
  let top=-Infinity,bottom=Infinity;
  for(let i=1;i<positions.length;i+=3){top=Math.max(top,positions[i]);bottom=Math.min(bottom,positions[i]);}
  const cut=bottom+(top-bottom)*.72,keep=[],tint=[];
  for(let t=0;t<positions.length;t+=9){
    if(positions[t+1]>cut&&positions[t+4]>cut&&positions[t+7]>cut)continue;
    for(let k=0;k<9;k++){keep.push(Math.min(positions[t+k],k%3===1?cut:Infinity));tint.push(colors[t+k]);}
  }
  return {positions:new Float32Array(keep),colors:new Float32Array(tint)};
}

// A house is drawn from its own facade record.
export function facadeIcon(facade){
  const colour=new Color(facade.color??'#4a746f'),roof=new Color('#0b4545'),door=new Color('#ffb15a'),trim=new Color('#c9a36a');
  const w=facade.width??3,d=facade.depth??1.5,h=facade.height??2.6,positions=[],colors=[];
  const tri=(a,b,c,col)=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(col.r,col.g,col.b);};
  const quad=(a,b,c,e,col)=>{tri(a,b,c,col);tri(a,c,e,col);};
  const x=w/2,z=d/2,wall=h*.68,ridge=h;
  // walls
  quad([-x,0,z],[x,0,z],[x,wall,z],[-x,wall,z],colour);quad([x,0,-z],[-x,0,-z],[-x,wall,-z],[x,wall,-z],colour);
  quad([x,0,z],[x,0,-z],[x,wall,-z],[x,wall,z],colour);quad([-x,0,-z],[-x,0,z],[-x,wall,z],[-x,wall,-z],colour);
  // gables and roof with eaves
  tri([-x,wall,z],[x,wall,z],[0,ridge,z],colour);tri([x,wall,-z],[-x,wall,-z],[0,ridge,-z],colour);
  const e=.12*w;
  quad([-x-e,wall-.08,z+e],[0,ridge,z+e],[0,ridge,-z-e],[-x-e,wall-.08,-z-e],roof);
  quad([0,ridge,z+e],[x+e,wall-.08,z+e],[x+e,wall-.08,-z-e],[0,ridge,-z-e],roof);
  // door and a trim band
  quad([-.16*w,0,z+.01],[.16*w,0,z+.01],[.16*w,wall*.62,z+.01],[-.16*w,wall*.62,z+.01],door);
  quad([-x,wall*.96,z+.012],[x,wall*.96,z+.012],[x,wall,z+.012],[-x,wall,z+.012],trim);
  const indices=Array.from({length:positions.length/3},(_,i)=>i);
  return fitIcon({positions:new Float32Array(positions),colors:new Float32Array(colors),indices});
}

export async function sceneIcon(bytes,{cutaway=false,triangles=TRIANGLES}={}){
  if(!bytes||bytes.length>MAX_SOURCE_BYTES)return null;
  const scene=await parseScene(bytes);
  let geometry=collectTriangles(scene,{skip:object=>/collider|collision|hitbox/i.test(object.name)});
  if(cutaway)geometry=withoutCeiling(geometry);
  const mesh=clusterTriangles(geometry,{triangles});
  return mesh&&fitIcon(mesh);
}

// Minimal GLB: one mesh, POSITION + COLOR_0 + indices, one flat material.
export function iconGlb(mesh){
  const vertexCount=mesh.positions.length/3;
  const indices=vertexCount>65535?new Uint32Array(mesh.indices):new Uint16Array(mesh.indices);
  const pad=n=>Math.ceil(n/4)*4;
  const views=[mesh.positions,mesh.colors,indices];
  let offset=0;const bufferViews=[];
  for(const [i,view] of views.entries()){
    bufferViews.push({buffer:0,byteOffset:offset,byteLength:view.byteLength,...(i===2?{target:34963}:{target:34962})});
    offset+=pad(view.byteLength);
  }
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<mesh.positions.length;i++){const a=i%3;min[a]=Math.min(min[a],mesh.positions[i]);max[a]=Math.max(max[a],mesh.positions[i]);}
  const json={asset:{version:'2.0',generator:TELEPORT_ICON_VERSION},scene:0,scenes:[{nodes:[0]}],
    nodes:[{name:'tp_icon',mesh:0}],
    meshes:[{name:'tp_icon',primitives:[{attributes:{POSITION:0,COLOR_0:1},indices:2,material:0}]}],
    materials:[{name:'tp_icon',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.05,roughnessFactor:.62}}],
    buffers:[{byteLength:offset}],bufferViews,
    accessors:[
      {bufferView:0,componentType:5126,count:vertexCount,type:'VEC3',min,max},
      {bufferView:1,componentType:5126,count:vertexCount,type:'VEC3'},
      {bufferView:2,componentType:indices instanceof Uint32Array?5125:5123,count:indices.length,type:'SCALAR'},
    ]};
  const text=Buffer.from(JSON.stringify(json));
  const jsonChunk=Buffer.alloc(pad(text.length),32);text.copy(jsonChunk);
  const bin=Buffer.alloc(offset);
  let at=0;
  for(const view of views){Buffer.from(view.buffer,view.byteOffset,view.byteLength).copy(bin,at);at+=pad(view.byteLength);}
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);
  header.writeUInt32LE(12+8+jsonChunk.length+8+bin.length,8);
  const chunk=(type,data)=>{const h=Buffer.alloc(8);h.writeUInt32LE(data.length,0);h.writeUInt32LE(type,4);return Buffer.concat([h,data]);};
  return Buffer.concat([header,chunk(0x4e4f534a,jsonChunk),chunk(0x004e4942,bin)]);
}

export async function buildIcon(source){
  const mesh=source.kind==='facade'?facadeIcon(source.facade):
    await sceneIcon(source.bytes,{cutaway:source.kind==='room'});
  if(!mesh)return null;
  const glb=iconGlb(mesh);
  return new Uint8Array(glb.buffer,glb.byteOffset,glb.byteLength).slice();
}

// One lazily started worker builds icons in order; it exits when idle.
class IconWorker {
  constructor(){this.next=0;this.pending=new Map();}
  run(source){
    if(!this.worker){
      this.worker=new Worker(new URL('./teleport-icon-worker.mjs',import.meta.url),{execArgv:[]});
      this.worker.on('message',({id,bytes})=>{
        this.pending.get(id)?.(bytes?Buffer.from(bytes):null);this.pending.delete(id);this.idle();
      });
      const fail=()=>{for(const done of this.pending.values())done(null);this.pending.clear();this.worker=null;};
      this.worker.on('error',fail);this.worker.on('exit',fail);
    }
    clearTimeout(this.timer);
    const id=++this.next;
    return new Promise(resolve=>{
      this.pending.set(id,resolve);
      this.worker.postMessage({id,source});
    });
  }
  idle(){
    if(this.pending.size)return;
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{this.worker?.terminate();this.worker=null;},30000);
    this.timer.unref?.();
  }
}

// Bounded cache of generated icons, keyed by source revision.
export class TeleportIcons {
  constructor({limit=CACHE,worker=true}={}){this.limit=limit;this.cache=new Map();this.worker=worker?new IconWorker():null;}

  async glb(source){
    const key=iconKey(source);
    let entry=this.cache.get(key);
    if(!entry){
      entry=this.build(source).catch(()=>null);
      this.cache.set(key,entry);
      while(this.cache.size>this.limit)this.cache.delete(this.cache.keys().next().value);
    }else{
      this.cache.delete(key);this.cache.set(key,entry);
    }
    const bytes=await entry;
    if(!bytes)this.cache.delete(key);
    return bytes;
  }

  async build(source){
    const plain={kind:source.kind,revision:source.revision,facade:source.facade,
      bytes:typeof source.bytes==='function'?source.bytes():source.bytes};
    if(plain.bytes&&plain.bytes.length>MAX_SOURCE_BYTES)return null;
    if(!this.worker||plain.kind==='facade'){const bytes=await buildIcon(plain);return bytes&&Buffer.from(bytes);}
    return this.worker.run(plain);
  }
}
