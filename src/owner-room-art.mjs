import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {brotliDecompressSync} from 'node:zlib';

const sha=value=>createHash('sha256').update(value).digest('hex');
const digest=/^[a-f0-9]{64}$/;
const fileName=/^[a-z][a-z0-9-]{0,95}\.glb$/;
const validNumber=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const tuple=(value,size,min,max)=>Array.isArray(value)&&value.length===size&&
  value.every(n=>validNumber(n,min,max));

async function readExact(url,expected,maxBytes,request){
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(30000)},{expected,maxBytes});
  if(!response.ok||!response.body)throw Error('Owner room art is unavailable');
  const chunks=[];
  let length=0;
  for await(const chunk of response.body){
    length+=chunk.length;
    if(length>maxBytes)throw Error('Owner room art exceeds its selected size');
    chunks.push(chunk);
  }
  const data=Buffer.concat(chunks,length);
  if(sha(data)!==expected)throw Error('Owner room art does not match the selected revision');
  return data;
}

export function ownerRoomCache(directory){
  return async(url,_options,{expected,maxBytes})=>{
    const extension=url.pathname.endsWith('.json')?'json':'glb';
    const name=`${expected}.${extension}`;
    const openAsset=suffix=>open(new URL(name+suffix,directory),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    let file,compressed=false;
    try{file=await openAsset('');}
    catch(error){
      if(error.code!=='ENOENT')throw error;
      file=await openAsset('.br');
      compressed=true;
    }
    try{
      const info=await file.stat();
      if(!info.isFile()||info.size>maxBytes)throw Error('Invalid staged owner room asset');
      const data=Buffer.alloc(info.size);
      const {bytesRead}=await file.read(data,0,info.size,0);
      if(bytesRead!==info.size)throw Error('Incomplete staged owner room asset');
      return new Response(compressed?brotliDecompressSync(data,{maxOutputLength:maxBytes}):data);
    }finally{await file.close();}
  };
}

export async function readOwnerManifest(selection,request){
  const from=new URL(selection.manifest);
  if(from.protocol!=='https:'||!/^([a-z0-9-]+)\.dmn\.homes$/.test(from.hostname)||
     from.username||from.password||from.port||from.hash||from.search||!from.pathname.endsWith('.json')||
     !digest.test(selection.sha256))throw Error('Select an exact Home manifest');
  const bytes=await readExact(from,selection.sha256,96000,request);
  const manifest=JSON.parse(bytes);
  if(manifest.schema!=='holodeck.linterna.hefesto-slice/v2'||!Array.isArray(manifest.passages)||
     manifest.passages.length>48)throw Error('Unsupported owner room manifest');
  return {from,manifest,bytes};
}

export async function readOwnerModel(from,asset,request){
  if(!fileName.test(asset.file)||!digest.test(asset.sha256)||!Number.isInteger(asset.bytes)||
     !validNumber(asset.bytes,20,768*1024))throw Error('Invalid owner room model selection');
  const bytes=await readExact(new URL(asset.file,from),asset.sha256,asset.bytes,request);
  if(bytes.length!==asset.bytes||bytes.toString('ascii',0,4)!=='glTF')
    throw Error('Invalid owner room GLB');
  return bytes;
}

function box(position,size,yaw=0){
  if(!tuple(position,3,-120,120)||!tuple(size,3,.001,120)||!validNumber(yaw,-360,360))
    throw Error('Invalid owner room collider');
  const [x,y,z]=position,[width,height,depth]=size;
  return `<m-cube x="${x}" y="${y}" z="${z}" width="${width}" height="${height}" depth="${depth}" ry="${yaw}" opacity="0" cast-shadows="false"></m-cube>`;
}

function geometry(cell){
  if(!Array.isArray(cell.floor)||!cell.floor.length||cell.floor.length>12||
     !Array.isArray(cell.colliders)||cell.colliders.length>192)throw Error('Invalid owner room geometry');
  const floors=cell.floor.map(({x,z,top,depth})=>{
    if(!tuple(x,2,-100,100)||!tuple(z,2,-100,100)||!validNumber(top,-10,10)||!validNumber(depth,.01,2))
      throw Error('Invalid owner room floor');
    return box([(x[0]+x[1])/2,top-depth/2,(z[0]+z[1])/2],[x[1]-x[0],depth,z[1]-z[0]]);
  });
  return floors.concat(cell.colliders.map(c=>box(c.position,c.size,c.rotationY))).join('');
}

function doorway(side){
  if(!tuple(side?.threshold,2,-100,100)||!tuple(side?.stand,2,-100,100)||
     !validNumber(side.surfaceY,-10,10)||!validNumber(side.yaw,0,360))
    throw Error('Invalid owner room door');
  const [x,z]=side.stand,y=side.surfaceY+.01;
  return {door:{x,y,z,yaw:(side.yaw+180)%360},landing:{x,y,z,yaw:side.yaw}};
}

function worktable(table,cell){
  const {id,anchor,turntable,interactionRadius}=table;
  if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{0,87}$/.test(id)||
     !tuple(anchor,3,-100,100)||!tuple(turntable,3,-100,100)||
     !validNumber(interactionRadius,.5,4)||!validNumber(table.rotationY,-360,360)||
     !cell.floor.some(floor=>anchor[0]>=floor.x[0]&&anchor[0]<=floor.x[1]&&
       anchor[2]>=floor.z[0]&&anchor[2]<=floor.z[1]&&anchor[1]>=floor.top)||
     anchor[0]!==turntable[0]||anchor[2]!==turntable[2]||turntable[1]<=anchor[1])
    throw Error('Invalid owner room worktable');
  return {id,position:{x:anchor[0],y:anchor[1],z:anchor[2]},interactionRadius};
}

function worktableWidgets(contract,cell,table,passages){
  const {frame,door,landing,roomMarker,turntable,widgets}=contract;
  const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
  const floor=cell.floor.find(item=>item.top===frame?.floor&&
    item.x[1]-item.x[0]===frame.size&&item.z[1]-item.z[0]===frame.size);
  if(contract.schema!=='casa-linterna.atelier-widgets/v1'||contract.site!=='DaimonAtelier'||
     frame?.units!=='m'||frame.up!=='+Y'||!validNumber(frame.height,2,8)||!floor||!table||
     !same(roomMarker,table.anchor)||!same(turntable,table.turntable)||!tuple(door,2,-100,100)||
     !passages.some(({sides})=>sides.some(side=>side.cell===contract.room&&
       side.surfaceY===frame.floor&&same(landing,side.stand)&&
       side.threshold?.[0]===door[0]&&Math.abs(side.threshold[1]-door[1])<=.25))||
     !Array.isArray(widgets)||!widgets.length||widgets.length>24||
     new Set(widgets.map(widget=>widget?.id)).size!==widgets.length)
    throw Error('Invalid Atelier widget room contract');
  return widgets.map(widget=>{
    const {id,object,anchor,reach,a2uiComponent}=widget??{};
    if(typeof id!=='string'||!/^atelier\.[a-z][a-z-]{0,40}$/.test(id)||
       typeof object!=='string'||!object.trim()||object.length>100||a2uiComponent!==null||
       !validNumber(reach,.5,4)||!tuple(anchor,3,-100,100)||
       !validNumber(anchor[0],...floor.x)||!validNumber(anchor[2],...floor.z)||
       !validNumber(anchor[1],floor.top,floor.top+frame.height))throw Error('Invalid Atelier art widget');
    const [x,y,z]=anchor;
    return {id,title:object,position:{x,y,z},reach,action:id==='atelier.tools'?'open-workbench':null};
  });
}

export async function loadOwnerRoomArt(selections,rooms,request=fetch){
  if(!Array.isArray(selections)||selections.length>4)throw Error('Select bounded owner room art');
  const result=new Map();
  let modelBytes=0;
  for(const selection of selections){
    const {from,manifest}=await readOwnerManifest(selection,request);
    const config=Object.entries(selection.rooms??{});
    if(!config.length||config.length>12||new Set(config.map(([,id])=>id)).size!==config.length)
      throw Error('Select distinct rooms for the owner art');
    if(new Set(config.map(([,id])=>rooms.get(id)?.house)).size!==1)
      throw Error('An owner scene cannot span multiple houses');
    for(const [cellId,id] of config){
      const cell=manifest.cells[cellId],room=rooms.get(id);
      if(!room||result.has(id)||!Array.isArray(cell?.models)||!cell.models.length||cell.models.length>6)
        throw Error('Owner room binding is unavailable');
      const colliders=geometry(cell);
      const table=manifest.table?.cell===cellId?worktable(manifest.table,cell):null;
      const widgets=manifest.atelierWidgets?.room===cellId?
        worktableWidgets(manifest.atelierWidgets,cell,table&&manifest.table,manifest.passages):null;
      const doors=new Map();
      let exterior=null;
      for(const {sides} of manifest.passages){
        const here=sides.find(side=>side.cell===cellId);
        if(!here)continue;
        const there=sides.find(side=>side.cell!==cellId);
        if(there?.keepParcelOffer){
          if(!room.entry||exterior)throw Error('Invalid owner room exterior door');
          exterior=doorway(here);
        }else{
          const target=selection.rooms[there?.cell];
          if(target!==undefined){
            if(doors.has(target)||!room.links.some(link=>link.to===target&&link.kind==='door'))
              throw Error('Owner art must match the published door graph');
            doors.set(target,doorway(here));
          }
        }
      }
      if(Boolean(exterior)!==room.entry||room.links.some(link=>!doors.has(link.to)))
        throw Error('Owner room art requires a pose for every published door');
      const models=new Map();
      for(const asset of cell.models){
        if(models.has(asset.sha256+'.glb'))
          throw Error('Invalid owner room model selection');
        modelBytes+=asset.bytes;
        if(modelBytes>12*1024*1024)throw Error('Owner room art exceeds the receiver budget');
        const bytes=await readOwnerModel(from,asset,request);
        models.set(asset.sha256+'.glb',{bytes});
      }
      result.set(id,{house:room.house,models,colliders,exterior,doors,table,widgets,revision:selection.sha256});
    }
  }
  return result;
}
