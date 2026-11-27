import {readFile} from 'node:fs/promises';

const files={
  stone:new URL('../workshop/materials/wall.jpg',import.meta.url),
  timber:new URL('../workshop/materials/bench.jpg',import.meta.url),
  water:new URL('./water.jpg',import.meta.url),
  plaque:new URL('./hefesto-plaques.jpg',import.meta.url),
  athenaPlaque:new URL('./athena-plaques.jpg',import.meta.url),
  apolloPlaque:new URL('./apollo-plaques.jpg',import.meta.url),
};

// Embed the selected JPEG bytes using the exporter writer. The offline build
// does not need a canvas or resample the textures. The GLB uses ordinary PBR
// material textures and has no external texture URLs or shader dependency.
export function embedFinishMaps(writer, privateMaps={}){
  const indices=new Map();
  return {
    async writeMaterialAsync(material,definition){
      const name=material.userData.linternaMap;
      if(!name)return;
      if(!indices.has(name)){
        const supplied=privateMaps[name];
        const file=files[name];
        if(!supplied&&!file)throw Error('Unknown precinct finish '+name);
        const json=writer.json;
        json.images??=[];
        json.samplers??=[];
        json.textures??=[];
        const image=json.images.length;
        const jpeg=supplied??await readFile(file);
        const bufferView=await writer.processBufferViewImage(new Blob([jpeg],{type:'image/jpeg'}));
        json.images.push({name,bufferView,mimeType:'image/jpeg'});
        const sampler=json.samplers.length;
        json.samplers.push({wrapS:10497,wrapT:10497,minFilter:9987,magFilter:9729});
        indices.set(name,json.textures.length);
        json.textures.push({name,sampler,source:image});
      }
      definition.pbrMetallicRoughness.baseColorTexture={index:indices.get(name)};
    },
  };
}
