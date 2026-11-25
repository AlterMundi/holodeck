import {DataArrayTexture,LinearFilter,LinearMipmapLinearFilter,NearestFilter,NoColorSpace,RedFormat,RepeatWrapping,ShaderChunk,Source,Vector2,Vector3} from 'three';

const diffuseSamples={
  map:{chunk:'map_fragment',sampler:'map',uv:'vMapUv'},
  emissiveMap:{chunk:'emissivemap_fragment',sampler:'emissiveMap',uv:'vEmissiveMapUv'},
};

const floorReflection=/* glsl */`
  uniform float roomReceiverHeight;
  struct RoomEmitter {
    vec3 center;
    vec3 right;
    vec3 up;
    vec3 normal;
    vec2 halfSize;
    vec2 spread;
    vec3 radiance;
  };
  uniform RoomEmitter roomEmitters[5];
  uniform int roomEmitterCount;
  uniform sampler2D roomDeckDetail;
  uniform float roomDeckTileScale;
  uniform float roomFloorDiffuseFill;

  vec3 roomFloorFinish(vec3 diffuse){
    vec3 position = roomSurfacePosition;
    if (abs(position.y - roomReceiverHeight) > 0.006) return diffuse;
    vec2 deckUV = vec2(position.x, -position.z) * roomDeckTileScale;
    vec3 tile = texture2D(roomDeckDetail, deckUV).rgb;
    float luminance = dot(tile, vec3(0.2126, 0.7152, 0.0722));
    float stone = smoothstep(0.052, 0.133, luminance);
    // Keep the extra diffuse contribution in the shadows and apply the same
    // tile response to it as to the baked light.
    float diffuseLuma = dot(diffuse, vec3(0.2126, 0.7152, 0.0722));
    diffuse += roomFloorDiffuseFill * (1.0 - smoothstep(0.025, 0.32, diffuseLuma));
    diffuse *= mix(0.76, 1.06, stone) * clamp(0.90 + 0.8 * luminance, 0.90, 1.16);
    vec3 view = normalize(cameraPosition - position);
    if (view.y <= 0.02) return diffuse;
    vec3 ray = reflect(-view, vec3(0.0, 1.0, 0.0));
    vec3 reflected = vec3(0.0);
    for(int i=0; i<5; ++i){
      if(i>=roomEmitterCount) break;
      RoomEmitter emitter = roomEmitters[i];
      float angle = dot(ray, emitter.normal);
      if(abs(angle)<0.001) continue;
      float distance = dot(emitter.center-position,emitter.normal)/angle;
      if(distance<=0.0 || distance>16.0) continue;
      vec3 hit = position + ray*distance - emitter.center;
      vec2 panel = vec2(dot(hit, emitter.right),dot(hit, emitter.up));
      vec2 falloff = max(abs(panel)-emitter.halfSize*0.75,0.0)/emitter.spread;
      reflected += emitter.radiance * exp(-dot(falloff,falloff));
    }
    return diffuse + reflected * mix(0.30, 1.0, stone);
  }
`;

const materialDetail=/* glsl */`
  varying vec3 roomSurfaceNormal;
  uniform sampler2D roomSurfaceRoles;
  uniform highp sampler2DArray roomSurfaceTiles;

  float roomTileBand(vec2 coordinates, vec2 dx, vec2 dy, float layer) {
    float footprint = 248.0 * max(length(dx), length(dy));
    float visible = 1.0 - smoothstep(4.0, 11.0, footprint);
    if (visible == 0.0) return 0.0;
    return visible * (2.0 * textureGrad(roomSurfaceTiles, vec3(coordinates, layer), dx, dy).r - 1.0);
  }

  vec3 roomDetail(vec3 diffuse, vec2 atlasUv) {
    float encoded = texture2D(roomSurfaceRoles, atlasUv).r * (255.0 / 32.0);
    float role = floor(encoded + 0.5);
    vec3 normal = abs(roomSurfaceNormal);
    vec2 meters = normal.x >= max(normal.y, normal.z) ? vec2(-roomSurfacePosition.z, roomSurfacePosition.y)
      : normal.z >= normal.y ? roomSurfacePosition.xy : vec2(roomSurfacePosition.x, -roomSurfacePosition.z);
    float scale = role == 1.0 ? 0.78 : role == 2.0 ? 0.92 : role == 3.0 ? 1.2 : 1.1;
    vec2 projected = meters * scale;
    vec2 dx = dFdx(projected);
    vec2 dy = dFdy(projected);
    if (role < 1.0 || role > 5.0 || abs(role - encoded) >= 0.12) return diffuse;
    float layer = role - 1.0;
    float primary = roomTileBand(projected, dx, dy, layer);
    // The independent sampling domains avoid synchronizing the room-scale
    // grain and close detail. Retain the brushed orientation on steel.
    const mat2 turn = mat2(0.83867, 0.54464, -0.54464, 0.83867);
    float coarse = roomTileBand(turn * projected * .173 + vec2(.19,.71), turn * dx * .173, turn * dy * .173, layer);
    if (role == 4.0) return diffuse * (1.0 + .82 * primary + .13 * coarse);
    const float microScale = 5.37;
    float micro = roomTileBand(turn * projected * microScale + vec2(.67,.23),
      turn * dx * microScale, turn * dy * microScale, layer);
    return diffuse * (1.0 + .55 * primary + .26 * micro + .14 * coarse);
  }
`;

function diffuseLayers(material){
  let channel;
  const irradiance={value:null};
  let reflectionEnabled=false;
  let detailEnabled=false;
  const surfaceDetail={roomSurfaceRoles:{value:null},roomSurfaceTiles:{value:null}};
  const reflection={
    roomReceiverHeight:{value:0},
    roomEmitterCount:{value:0},
    roomEmitters:{value:[]},
    roomDeckDetail:{value:null},
    roomDeckTileScale:{value:1},
    roomFloorDiffuseFill:{value:0},
  };
  material.customProgramCacheKey=()=>channel
    ?'room-diffuse-layers:'+channel+(reflectionEnabled?':reflection':'')+(detailEnabled?':layered-detail-v1':''):'';
  material.onBeforeCompile=shader=>{
    if(!channel)return;
    const {chunk,sampler,uv}=diffuseSamples[channel];
    const sample=`texture2D( ${sampler}, ${uv} )`;
    shader.uniforms.roomIrradiance=irradiance;
    if(reflectionEnabled)Object.assign(shader.uniforms,reflection);
    if(detailEnabled)Object.assign(shader.uniforms,surfaceDetail);
    if(reflectionEnabled||detailEnabled){
      shader.vertexShader='varying vec3 roomSurfacePosition;\n'+shader.vertexShader.replace(
        '#include <project_vertex>',`#include <project_vertex>
        roomSurfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        ${detailEnabled?'roomSurfaceNormal = mat3(modelMatrix) * normal;':''}`);
      if(detailEnabled)shader.vertexShader='varying vec3 roomSurfaceNormal;\n'+shader.vertexShader;
    }
    shader.fragmentShader=`
      uniform sampler2D roomIrradiance;
      ${reflectionEnabled||detailEnabled?'varying vec3 roomSurfacePosition;':''}
      ${reflectionEnabled?floorReflection:''}
      ${detailEnabled?materialDetail:''}
      vec3 roomLitDiffuse(vec3 albedo, vec2 uv) {
        vec3 light = exp2(6.0 * texture2D(roomIrradiance, uv).rgb) - 1.0;
        vec3 color = albedo * (1.40 * light + 0.063);
        vec3 diffuse = color / (1.0 + 0.33 * max(max(color.r, color.g), color.b));
        ${detailEnabled?'diffuse = roomDetail(diffuse, uv);':''}
        return ${reflectionEnabled?'roomFloorFinish(diffuse)':'diffuse'};
      }
    `+shader.fragmentShader.replace(`#include <${chunk}>`,
      ShaderChunk[chunk].replace(sample,`vec4(roomLitDiffuse(${sample}.rgb, ${uv}), 1.0)`));
  };
  return (next,texture,finish,detail,roles,tiles)=>{
    irradiance.value=texture;
    surfaceDetail.roomSurfaceRoles.value=roles;
    surfaceDetail.roomSurfaceTiles.value=tiles;
    if(finish){
      reflection.roomReceiverHeight.value=finish.receiverHeight;
      reflection.roomEmitterCount.value=finish.emitters.length;
      reflection.roomEmitters.value=Array.from({length:5},(_,i)=>{
        const emitter=finish.emitters[i]??finish.emitters[0];
        const right=new Vector3().fromArray(emitter.right),up=new Vector3().fromArray(emitter.up);
        return {
          center:new Vector3().fromArray(emitter.center),right,up,normal:new Vector3().crossVectors(right,up),
          halfSize:new Vector2().fromArray(emitter.size).multiplyScalar(.5),
          spread:new Vector2().fromArray(emitter.spread),radiance:new Vector3().fromArray(emitter.radiance),
        };
      });
      reflection.roomDeckDetail.value=detail;
      reflection.roomDeckTileScale.value=finish.tilesPerMeter;
      reflection.roomFloorDiffuseFill.value=finish.diffuseFill??0;
    }
    const hasDetail=!!(roles&&tiles);
    if(next!==channel||reflectionEnabled!==!!finish||detailEnabled!==hasDetail){
      channel=next;
      reflectionEnabled=!!finish;
      detailEnabled=hasDetail;
      material.needsUpdate=true;
    }
  };
}

function roomDetailArray(image,document){
  const size=248,tile=256,layers=5;
  if(image.width!==3*tile||image.height!==2*tile)throw Error('Unexpected room detail atlas dimensions');
  const unpack=document.createElement('canvas');
  unpack.width=unpack.height=size;
  const context=unpack.getContext('2d',{willReadFrequently:true});
  const pixels=new Uint8Array(size*size*layers);
  for(let layer=0;layer<layers;layer++){
    context.drawImage(image,layer%3*tile+4,Math.floor(layer/3)*tile+4,size,size,0,0,size,size);
    const rgba=context.getImageData(0,0,size,size).data;
    for(let i=0,j=layer*size*size;i<rgba.length;i+=4,j++)pixels[j]=rgba[i];
  }
  const texture=new DataArrayTexture(pixels,size,size,layers);
  texture.format=RedFormat;
  texture.wrapS=texture.wrapT=RepeatWrapping;
  texture.minFilter=LinearMipmapLinearFilter;
  texture.magFilter=LinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

export function bindMatterStyle(group,catalog,{document=globalThis.document}={}){
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
  const materials=new Map(),detailArrays=new Map();
  const textures={color:new Map(),data:new Map(),tile:new Map(),roles:new Map()};
  const variant=(source,image,mode='color')=>{
    if(!source||!image)return source;
    const cache=textures[mode];
    if(!cache.has(source))cache.set(source,new Map());
    const variants=cache.get(source);
    if(!variants.has(image)){
      const texture=source.clone();
      texture.source=new Source(image);
      if(mode==='data')texture.colorSpace=NoColorSpace;
      if(mode==='roles'){
        texture.colorSpace=NoColorSpace;
        texture.generateMipmaps=false;
        texture.minFilter=texture.magFilter=NearestFilter;
      }
      if(mode==='tile')texture.wrapS=texture.wrapT=RepeatWrapping;
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
        const light=layers?variant(source[layers.channel],images?.get(layers.irradiance),'data'):null;
        const reflection=light?layers.reflection:undefined;
        const detail=reflection?variant(source[layers.channel],images?.get(reflection.detail),'tile'):null;
        const authored=light&&layers.surfaceDetail;
        const roleImage=authored&&images?.get(authored.roles);
        const tileImage=authored&&images?.get(authored.tiles);
        const roles=roleImage?variant(source[layers.channel],roleImage,'roles'):null;
        if(tileImage&&!detailArrays.has(tileImage))detailArrays.set(tileImage,roomDetailArray(tileImage,document));
        const tiles=tileImage?detailArrays.get(tileImage):null;
        setLayers(light?layers.channel:undefined,light,reflection,detail,roles,tiles);
        const overrides=style.materials[role];
        for(const channel of channels){
          const asset=layers?.channel===channel?layers.albedo:overrides?.[channel];
          material[channel]=variant(source[channel],images?.get(asset));
        }
      }
    },
    dispose(){
      for(const {material} of materials.values())material.dispose();
      for(const texture of detailArrays.values())texture.dispose();
      for(const cache of Object.values(textures))
        for(const variants of cache.values())
          for(const texture of variants.values())texture.dispose();
    },
  };
}

export async function loadMatterStyleImages(catalog,style,images,signal){
  const assets=new Set(Object.values(style.materials).flatMap(Object.values));
  for(const {albedo,irradiance,reflection,surfaceDetail} of Object.values(style.diffuseLayers??{})){
    assets.add(albedo);
    assets.add(irradiance);
    if(reflection)assets.add(reflection.detail);
    if(surfaceDetail){
      assets.add(surfaceDetail.roles);
      assets.add(surfaceDetail.tiles);
    }
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
