import {Source} from 'three';

// Bind authored style maps to the matching material slots in the fixed UV layout.
const surfaces={
  'Orbital static diffuse':{map:'diffuse'},
  'Orbital focused material response':{emissiveMap:'diffuse',roughnessMap:'response',metalnessMap:'response'},
};

export const matterStyles=[
  {id:'orbital',label:'Laboratorio orbital'},
  {id:'amber',label:'Luz ámbar'},
];

export function bindMatterStyle(group){
  const materials=new Map();
  const textures=new Map();
  const variant=(source,image)=>{
    if(!source||!image)return source;
    if(!textures.has(source)){
      const texture=source.clone();
      texture.source=new Source(image);
      texture.needsUpdate=true;
      textures.set(source,texture);
    }
    return textures.get(source);
  };
  const bind=source=>{
    if(!source||!Object.hasOwn(surfaces,source.name))return source;
    if(!materials.has(source)){
      materials.set(source,source.clone());
    }
    return materials.get(source);
  };
  group.traverse(object=>{
    if(object.isMesh)
      object.material=Array.isArray(object.material)?object.material.map(bind):bind(object.material);
  });
  return {
    apply(images){
      for(const [source,material] of materials)
        for(const [channel,imageKey] of Object.entries(surfaces[source.name]))
          material[channel]=variant(source[channel],images?.[imageKey]);
    },
    dispose(){
      for(const material of materials.values())material.dispose();
      for(const texture of textures.values())texture.dispose();
    },
  };
}


export async function loadMatterStyleImages(paths,signal){
  const results=await Promise.allSettled(['diffuse','response'].map(async key=>{
    const res=await fetch(paths[key],{signal});
    if(!res.ok)throw Error('Room style map unavailable');
    const image=await createImageBitmap(await res.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
    return [key,image];
  }));
  const images=Object.fromEntries(results.filter(result=>result.status==='fulfilled').map(({value})=>value));
  if(Object.keys(images).length!==2||signal.aborted){
    for(const image of Object.values(images))image.close();
    throw Error('Room style maps did not load');
  }
  return images;
}
