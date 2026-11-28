import {createHash} from 'node:crypto';
import {TOROIDAL_HOUSE_PLOTS,toroidalParcelPoint} from './toroidal-terrain.mjs';

const digest=/^[a-f0-9]{64}$/;
const kinds=['near','distance','collision'];
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const point=(value,min,max)=>Array.isArray(value)&&value.length===3&&value.every(n=>finite(n,min,max));

async function readExact(url,sha256,maxBytes,request){
  const response=await request(url,{}, {expected:sha256,maxBytes});
  if(!response.ok)throw Error('Owner exterior asset unavailable');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>maxBytes||createHash('sha256').update(bytes).digest('hex')!==sha256)
    throw Error('Owner exterior asset differs from its published revision');
  return bytes;
}

function checkGlb(bytes){
  if(bytes.length<24||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||
    bytes.readUInt32LE(8)!==bytes.length||bytes.toString('ascii',16,20)!=='JSON'||
    bytes.readUInt32LE(12)>bytes.length-20)throw Error('Invalid exterior GLB');
  const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  if(!data.meshes?.length||data.buffers?.some(buffer=>buffer.uri!==undefined)||
    data.images?.some(image=>image.uri!==undefined))throw Error('Exterior GLBs must be self-contained');
}

export async function loadOwnerExteriors(selections,houses,request){
  if(!Array.isArray(selections)||selections.length>TOROIDAL_HOUSE_PLOTS.length||
    new Set(selections.map(item=>item?.house)).size!==selections.length)throw Error('Invalid owner exteriors');
  const exteriors=new Map();
  for(const selection of selections){
    const house=houses.directory().find(house=>house.id===selection.house);
    const plot=TOROIDAL_HOUSE_PLOTS.find(plot=>plot.id===house?.parcel);
    const url=new URL(selection.manifest);
    if(!plot||!request||!digest.test(selection.sha256)||url.protocol!=='https:'||
      !/^[a-z0-9-]+\.dmn\.homes$/.test(url.hostname)||url.username||url.password||url.port||
      url.search||url.hash||!/^\/works\/[a-f0-9]{32}\/[a-f0-9]{64}\/manifest\.json$/.test(url.pathname))
      throw Error('Select an exact Home edition for the accepted parcel');
    const manifest=JSON.parse(await readExact(url,selection.sha256,16*1024,request));
    const {stand,doorway,yaw}=manifest.plot??{};
    const {nearUntilMetres,distanceFromMetres}=manifest.display??{};
    if(manifest.schema!=='casa-linterna.exterior-candidate/v1'||manifest.parcel!==plot.id||
      manifest.units!=='m'||manifest.up!=='+Y'||manifest.towardPath!=='+Z'||
      manifest.plot?.width!==plot.width||manifest.plot?.depth!==plot.depth||
      !point(stand,-36,36)||!point(doorway,-36,36)||yaw!==-90*plot.side||
      stand[2]<=doorway[2]||!finite(nearUntilMetres,20,160)||!finite(distanceFromMetres,nearUntilMetres+5,180))
      throw Error('Owner exterior placement differs from its parcel');
    const origin=toroidalParcelPoint({x:plot.x,y:0,z:plot.z});
    const door={x:origin.x-plot.side*stand[2],y:origin.y+stand[1],z:origin.z+plot.side*stand[0],
      facing:plot.side};
    const assets={};
    for(const kind of kinds){
      const asset=manifest.assets?.[kind];
      if(asset?.file!==kind+'.glb'||!digest.test(asset.sha256)||!Number.isSafeInteger(asset.bytes)||
        !finite(asset.bytes,24,8*1024**2))throw Error('Invalid owner exterior asset selection');
      const bytes=await readExact(new URL(asset.file,url),asset.sha256,asset.bytes,request);
      if(bytes.length!==asset.bytes)throw Error('Owner exterior asset size changed');
      checkGlb(bytes);
      assets[kind]={bytes,length:asset.bytes,sha256:asset.sha256};
    }
    exteriors.set(house.id,{revision:selection.sha256,house:house.id,title:house.facade.title,
      origin,door,yaw,nearUntilMetres,distanceFromMetres,assets});
  }
  return exteriors;
}
