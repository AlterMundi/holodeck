import {Source} from 'three';

export function bindMatterStyle(group,catalog){
  const roles=new Map(Object.entries(catalog.surfaces).map(([role,name])=>[name,role]));
  const channelsByRole=new Map();
  for(const {materials} of catalog.looks){
    for(const [role,channels] of Object.entries(materials)){
      if(!channelsByRole.has(role))channelsByRole.set(role,new Set());
      for(const channel of Object.keys(channels))channelsByRole.get(role).add(channel);
    }
  }
  const materials=new Map();
  const textures=new Map();
  const variant=(source,image)=>{
    if(!source||!image)return source;
    if(!textures.has(source))textures.set(source,new Map());
    const variants=textures.get(source);
    if(!variants.has(image)){
      const texture=source.clone();
      texture.source=new Source(image);
      texture.needsUpdate=true;
      variants.set(image,texture);
    }
    return variants.get(image);
  };
  const bind=source=>{
    const role=roles.get(source?.name);
    const channels=channelsByRole.get(role);
    if(!channels)return source;
    if(!materials.has(source))materials.set(source,{material:source.clone(),role,channels});
    return materials.get(source).material;
  };
  group.traverse(object=>{
    if(object.isMesh)
      object.material=Array.isArray(object.material)?object.material.map(bind):bind(object.material);
  });
  return {
    apply(style,images){
      for(const [source,{material,role,channels}] of materials){
        const overrides=style.materials[role];
        for(const channel of channels)
          material[channel]=variant(source[channel],images?.get(overrides?.[channel]));
      }
    },
    dispose(){
      for(const {material} of materials.values())material.dispose();
      for(const variants of textures.values())
        for(const texture of variants.values())texture.dispose();
    },
  };
}

export async function loadMatterStyleImages(catalog,style,images,signal){
  const assets=new Set(Object.values(style.materials).flatMap(Object.values));
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
