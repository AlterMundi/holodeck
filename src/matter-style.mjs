import {NoColorSpace,ShaderChunk,Source} from 'three';

const diffuseSamples={
  map:{chunk:'map_fragment',sampler:'map',uv:'vMapUv'},
  emissiveMap:{chunk:'emissivemap_fragment',sampler:'emissiveMap',uv:'vEmissiveMapUv'},
};

function diffuseLayers(material){
  let channel;
  const irradiance={value:null};
  material.customProgramCacheKey=()=>channel?'room-diffuse-layers:'+channel:'';
  material.onBeforeCompile=shader=>{
    if(!channel)return;
    const {chunk,sampler,uv}=diffuseSamples[channel];
    const sample=`texture2D( ${sampler}, ${uv} )`;
    shader.uniforms.roomIrradiance=irradiance;
    shader.fragmentShader=`
      uniform sampler2D roomIrradiance;
      vec3 roomLitDiffuse(vec3 albedo, vec2 uv) {
        vec3 light = exp2(6.0 * texture2D(roomIrradiance, uv).rgb) - 1.0;
        vec3 color = albedo * (1.40 * light + 0.063);
        return color / (1.0 + 0.33 * max(max(color.r, color.g), color.b));
      }
    `+shader.fragmentShader.replace(`#include <${chunk}>`,
      ShaderChunk[chunk].replace(sample,`vec4(roomLitDiffuse(${sample}.rgb, ${uv}), 1.0)`));
  };
  return (next,texture)=>{
    irradiance.value=texture;
    if(next!==channel){
      channel=next;
      material.needsUpdate=true;
    }
  };
}

export function bindMatterStyle(group,catalog){
  const roles=new Map(Object.entries(catalog.surfaces).map(([role,name])=>[name,role]));
  const channelsByRole=new Map();
  for(const {materials,diffuseLayers} of catalog.looks){
    for(const [role,channels] of Object.entries(materials)){
      if(!channelsByRole.has(role))channelsByRole.set(role,new Set());
      for(const channel of Object.keys(channels))channelsByRole.get(role).add(channel);
    }
    for(const [role,{channel}] of Object.entries(diffuseLayers??{})){
      if(!channelsByRole.has(role))channelsByRole.set(role,new Set());
      channelsByRole.get(role).add(channel);
    }
  }
  const materials=new Map();
  const textures=new Map();
  const dataTextures=new Map();
  const variant=(source,image,data=false)=>{
    if(!source||!image)return source;
    const cache=data?dataTextures:textures;
    if(!cache.has(source))cache.set(source,new Map());
    const variants=cache.get(source);
    if(!variants.has(image)){
      const texture=source.clone();
      texture.source=new Source(image);
      if(data)texture.colorSpace=NoColorSpace;
      texture.needsUpdate=true;
      variants.set(image,texture);
    }
    return variants.get(image);
  };
  const bind=source=>{
    const role=roles.get(source?.name);
    const channels=channelsByRole.get(role);
    if(!channels)return source;
    if(!materials.has(source)){
      const material=source.clone();
      materials.set(source,{material,role,channels,setLayers:diffuseLayers(material)});
    }
    return materials.get(source).material;
  };
  group.traverse(object=>{
    if(object.isMesh)
      object.material=Array.isArray(object.material)?object.material.map(bind):bind(object.material);
  });
  return {
    apply(style,images){
      for(const [source,{material,role,channels,setLayers}] of materials){
        const layers=style.diffuseLayers?.[role];
        const light=layers?variant(source[layers.channel],images?.get(layers.irradiance),true):null;
        setLayers(light?layers.channel:undefined,light);
        const overrides=style.materials[role];
        for(const channel of channels){
          const asset=layers?.channel===channel?layers.albedo:overrides?.[channel];
          material[channel]=variant(source[channel],images?.get(asset));
        }
      }
    },
    dispose(){
      for(const {material} of materials.values())material.dispose();
      for(const variants of [...textures.values(),...dataTextures.values()])
        for(const texture of variants.values())texture.dispose();
    },
  };
}

export async function loadMatterStyleImages(catalog,style,images,signal){
  const assets=new Set(Object.values(style.materials).flatMap(Object.values));
  for(const {albedo,irradiance} of Object.values(style.diffuseLayers??{})){
    assets.add(albedo);
    assets.add(irradiance);
  }
  const missing=Array.from(assets).filter(id=>!images.has(id));
  if(!missing.length)return;
  const results=await Promise.allSettled(missing.map(async id=>{
    const res=await fetch(catalog.assets[id],{signal});
    if(!res.ok)throw Error('Room style map unavailable');
    const image=await createImageBitmap(await res.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
    return [id,image];
  }));
  const loaded=results.filter(result=>result.status==='fulfilled').map(({value})=>value);
  if(loaded.length!==missing.length||signal.aborted){
    for(const [,image] of loaded)image.close();
    throw Error('Room style maps did not load');
  }
  for(const [id,image] of loaded)images.set(id,image);
}
