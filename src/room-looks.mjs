import {createHash} from 'node:crypto';

const digestPattern=/^[a-f0-9]{64}$/;
const identifier=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(value);
const textureTypes={jpg:'image/jpeg',png:'image/png'};
const materialChannels=new Set([
  'map','normalMap','aoMap','lightMap','emissiveMap','roughnessMap','metalnessMap',
]);
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const bounded=(value,low,high)=>Number.isFinite(value)&&value>=low&&value<=high;
const vector=(value,size,low,high)=>Array.isArray(value)&&value.length===size&&
  value.every(item=>bounded(item,low,high));

// Resolve authored asset names once against immutable bytes. Only the scoped
// room endpoint exposes URLs. Browser selections never write room state.
export function compileRoomLooks(manifest,readAsset){
  if(manifest?.schema!=='holodeck.room-looks/v1'||!record(manifest.surfaces)||
    !record(manifest.assets)||!Array.isArray(manifest.looks)||!identifier(manifest.default)||
    manifest.looks.length>8||Object.keys(manifest.assets).length>8)
    throw Error('Invalid room look manifest');
  const {schema,surfaces,looks}=manifest;
  const materialNames=Object.values(surfaces);
  if(Object.keys(surfaces).some(role=>!identifier(role))||
    materialNames.some(name=>typeof name!=='string'||!name)||new Set(materialNames).size!==materialNames.length)
    throw Error('Invalid room look surface roles');
  const assets=new Map();
  const files=new Map();
  const used=new Set();
  const ids=new Set();
  for(const look of looks){
    if(!look||!identifier(look.id)||ids.has(look.id)||typeof look.label!=='string'||
      !look.label.trim()||!record(look.materials))
      throw Error('Invalid room look entry');
    if(look.contactShadows!==undefined&&typeof look.contactShadows!=='boolean')
      throw Error('Invalid room contact shadow setting');
    if(look.orbitalGlazing!==undefined&&typeof look.orbitalGlazing!=='boolean')
      throw Error('Invalid room glazing setting');
    ids.add(look.id);
    for(const [role,channels] of Object.entries(look.materials)){
      if(!Object.hasOwn(surfaces,role)||!record(channels))throw Error('Unknown room look surface role');
      for(const [channel,asset] of Object.entries(channels)){
        if(!materialChannels.has(channel)||typeof asset!=='string'||!Object.hasOwn(manifest.assets,asset))
          throw Error('Unknown room look material channel or asset');
        used.add(asset);
      }
    }
    if(look.diffuseLayers!==undefined&&!record(look.diffuseLayers))
      throw Error('Invalid room diffuse layers');
    for(const [role,layers] of Object.entries(look.diffuseLayers??{})){
      if(!record(layers))throw Error('Invalid room diffuse layer binding');
      const {channel,albedo,irradiance}=layers;
      if(!Object.hasOwn(surfaces,role)||!['map','emissiveMap'].includes(channel)||
        Object.hasOwn(look.materials[role]??{},channel)||albedo===irradiance||
        ![albedo,irradiance].every(id=>identifier(id)&&Object.hasOwn(manifest.assets,id)&&
          typeof manifest.assets[id]?.file==='string'&&manifest.assets[id].file.endsWith('.png')))
        throw Error('Invalid room diffuse layer binding');
      if(layers.reflection!==undefined){
        const light=layers.reflection;
        if(channel!=='map'||!record(light)||!bounded(light.receiverHeight,-2,8)||
          !vector(light.center,3,-24,24)||light.center[1]<=light.receiverHeight||
          !vector(light.size,2,.05,8)||!vector(light.spread,2,.05,4)||
          !vector(light.radiance,3,0,2)||!identifier(light.detail)||
          !Object.hasOwn(manifest.assets,light.detail)||!bounded(light.tilesPerMeter,.1,8))
          throw Error('Invalid room diffuse reflection');
        used.add(light.detail);
      }
      used.add(albedo);
      used.add(irradiance);
    }
  }
  const fallback=looks.find(({id})=>id===manifest.default);
  if(!fallback||Object.keys(fallback.materials).length||Object.keys(fallback.diffuseLayers??{}).length)
    throw Error('Default room look must use embedded assets');
  for(const [key,asset] of Object.entries(manifest.assets)){
    const extension=/^[a-z0-9][a-z0-9-]*\.(jpg|png)$/.exec(asset?.file)?.[1];
    if(!identifier(key)||!used.has(key)||!extension||!digestPattern.test(asset?.sha256))
      throw Error('Invalid room look asset descriptor');
    const revision=asset.sha256+'.'+extension;
    const bytes=readAsset(asset.file);
    if(!bytes.length||bytes.length>1024*1024||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)
      throw Error('Room look asset does not match the qualified bake');
    files.set(revision,{bytes,type:textureTypes[extension]});
    assets.set(key,revision);
  }
  return {
    files,
    describe:artURL=>({
      schema,default:manifest.default,surfaces,looks,
      assets:Object.fromEntries(Array.from(assets,([id,revision])=>[id,artURL(revision)])),
    }),
  };
}
