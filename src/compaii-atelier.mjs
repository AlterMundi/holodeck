import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {COMPAII_HOUSE,interiorArt} from './interior-art.mjs';
import {readPackedArt} from './packed-art.mjs';
import {BEACON_CONTROLS} from './beacon-controls.mjs';

export const ATELIER_PROFILE='compaii-atelier-v1';
export const ATELIER_ROOMS=Object.freeze({
  foyer:'compaii-vestibulo',gallery:'compaii-galeria',lab:'compaii-lab',tower:'compaii-torre',
});
const {foyer,gallery,lab,tower}=ATELIER_ROOMS;
const layout=[
  [foyer,0,true,[['door',gallery]]],
  [gallery,0,false,[['door',foyer],['stair',lab],['portal',tower]]],
  [lab,-1,false,[['stair',gallery]]],
  [tower,2,false,[['portal',gallery]]],
];
// The build directly preceding the first writer must already recover
// expanded room, furnishing and activity checkpoints.
export const ATELIER_EXPANSION_WRITES=false;
const FOYER_PORTAL_PATH='room-art/compaii-atelier/foyer-portal.glb';
const originalRooms=new Set(Object.values(ATELIER_ROOMS));
const addedFoyerPortal=link=>link?.kind==='portal'&&!originalRooms.has(link.to);

function matchesOriginalLinks(id,links,baseline){
  return (links.length===baseline.length ||
    (id===foyer&&links.length===2&&addedFoyerPortal(links[1]))) &&
    baseline.every(([kind,to],index)=>links[index]?.to===to&&links[index]?.kind===kind);
}

export function matchesAtelierLayout(rooms,baseline){
  return baseline.every(original=>{
    const room=rooms.find(room=>room.id===original.id);
    return room?.house===COMPAII_HOUSE && room.entry===original.entry &&
      room.level===original.level && room.title===original.title &&
      matchesOriginalLinks(room.id,room.links,original.links.map(link=>[link.kind,link.to]));
  });
}
const FACADE_ASSET='compaii-atelier-facade.glb';
const GARDEN_ASSET='compaii-atelier-garden.glb';
const GARDEN_REVISION='44042fb171ad5be40f870f6c9c2e3dda7206cabec6fdc52e5c8b40be8cc288fb';
const COMMONS_ASSET='compaii-atelier-commons.glb';
const COMMONS_REVISION='c886dceb1c58807b553b9a8bfcfb499dbcc5f105ef3a60264fcb9f6b3be06a75';
const WAYFINDING=Object.freeze({asset:'commons-signs.glb',
  revision:'3bdd8d437662dfbd7725805922bada9dd06cd0bbf6301c6edd2aa2acee535cab'});
const HOUSE_WALK=Object.freeze({asset:'house-walk.glb',
  revision:'1a60872144ebff809cdf7447f45ee389e0a7aeb6b7f197f5907a87b46c1ccbcd'});
const PARCEL_TERRAIN=Object.freeze({asset:'parcel-terrace.glb',
  revision:'133477adceacc91d138bc025d2e72bf626b1c6abe39498c3af075976fff3372e'});
const PARCEL_GARDEN=Object.freeze({asset:'parcel-garden.glb',
  revision:'bc6d9755145d2ea5969e8c07abf2e643026867d718e75d62e0a004f3e6d22ac0'});
const GALLERY_ISLAND=Object.freeze({asset:'gallery-island.glb',
  revision:'9784e4c260acfee3c46277db85445401f5c4f91e7a9cb6a9e58912ea8a596240'});
const MIRADOR=Object.freeze({asset:'mirador.glb',
  revision:'a8f9e1435141df01199176c13124a97415a7fef9ad4770a4ca5ed62cc9cbca40'});
const NORTH_BRIDGE=Object.freeze({asset:'north-bridge.glb',
  revision:'c0c3ccb5b75fb9893cb5a371e386f13eee9d056d9c7c06d36cb558d8086874a0'});
const SURROUNDINGS_ASSET='island-scenery-atelier.glb';
const SURROUNDINGS_REVISION='9f7113799760fbe5ce1d3707bd808fd0bbf9861b2d9c7de5700da1a02933e138';
const OUTDOOR_SKY=Object.freeze({asset:'coastal-sky.jpg',
  revision:'2e9a63bbb5eb0e3a60e6144cff155e753211e093ee2870efda480129a01baae8'});
const COASTAL_RIDGES=Object.freeze({asset:'coastal-ridges.glb',
  revision:'518884afc176e4351746b8cce5e0461d1be7c7e36db0f3fc70a9a813e88b9119'});
const COASTAL_FOG=Object.freeze({fogNear:24,fogFar:124,fogColor:{r:.716,g:.776,b:.784}});
export const ATELIER_ASSET_REVISIONS=Object.freeze({
  [FOYER_PORTAL_PATH]:'c18e510bba8fbab0d2a7e91bed63402c1aa82c4963678b58663f1c259741eee2',
  'room-art/compaii-atelier/foyer.glb':'7816835b65ffbf025ae295dee37d0db978bede7a9dbc83f66e44d53d052ede59',
  'room-art/compaii-atelier/foyer-gallery.glb':'7a742175fc530b774e50b4e0917bf50eea60dfdca0124285d742a92c4996c27b',
  'room-art/compaii-atelier/gallery.glb':'a014d251eaf7ef33f6ba66fc696ecf4ad946177c6fccf8f64a0b75546118e3ba',
  'room-art/compaii-atelier/gallery-sealed.glb':'b1aa5cc6341904430aba821ba4b23e17776fff43e8e8acf4d0468c1c2ab3decc',
  'room-art/compaii-atelier/beacon.glb':'881d86774a6e92aefb9ff224c3a5ac60544a44fa6a2ff14f7fd05bb34b8e96c7',
  'room-art/compaii-atelier/beacon-return.glb':'897636fc8a9229a867742fe7d4d2d5ba84c1c607fbb542916aecf39e08279798',
  'room-art/compaii-atelier/tower.glb':'ce6d7f438909e938814266b8ef9901c5d7b738a85be81cacfed270eb7b65b2e7',
  ['assets/'+FACADE_ASSET]:'bc548baaf5112a109644243d88fca9f31f604c135a32b8761ad48ef587365a9e',
  ['assets/'+GARDEN_ASSET]:GARDEN_REVISION,
  ['assets/'+COMMONS_ASSET]:COMMONS_REVISION,
  ['assets/'+WAYFINDING.asset]:WAYFINDING.revision,
  ['assets/'+HOUSE_WALK.asset]:HOUSE_WALK.revision,
  ['assets/'+PARCEL_TERRAIN.asset]:PARCEL_TERRAIN.revision,
  ['assets/'+PARCEL_GARDEN.asset]:PARCEL_GARDEN.revision,
  ['assets/'+GALLERY_ISLAND.asset]:GALLERY_ISLAND.revision,
  ['assets/'+MIRADOR.asset]:MIRADOR.revision,
  ['assets/'+NORTH_BRIDGE.asset]:NORTH_BRIDGE.revision,
  ['assets/'+SURROUNDINGS_ASSET]:SURROUNDINGS_REVISION,
  ['assets/'+OUTDOOR_SKY.asset]:OUTDOOR_SKY.revision,
  ['assets/'+COASTAL_RIDGES.asset]:COASTAL_RIDGES.revision,
});

const facade={
  asset:FACADE_ASSET,
  bounds:{min:[-.732565,0,-1.573],max:[.732565,2.649471,1.574201]},
};
const fixture=(room,id,title,x,y,z)=>({id,title,kind:'fixture',position:{x,y,z},
  revision:Number.parseInt(ATELIER_ASSET_REVISIONS['room-art/compaii-atelier/'+room+'.glb'].slice(0,12),16)+1});
const floorProfile={replacesShell:true,authoredExhibitBase:true};
const box=({x,y,z,w,h,d})=>`<m-cube x="${x}" y="${y}" z="${z}" width="${w}" height="${h}" depth="${d}" opacity="0" cast-shadows="false"></m-cube>`;
const gardenVisual={asset:GARDEN_ASSET,revision:GARDEN_REVISION,x:0,y:0,z:0,sx:1,sy:1,sz:1,
  colliders:[
    {x:24.05,y:.295,z:7.79,w:2.57,h:.39,d:.40},
    ...[22.72,25.38].flatMap(x=>[6.65,7.83].map(z=>({x,y:1.265,z,w:.23,h:2.33,d:.23}))),
    ...[19.35,22.15,24.95].map(x=>({x,y:.224,z:-7.095,w:1.70,h:.25,d:.805})),
    ...[[16.5,-6.83],[22.02,-8.5],[27.76,-6.49],[18.42,7.55],[27.80,6.54]]
      .map(([x,z])=>({x,y:.98,z,w:.29,h:1.76,d:.29})),
  ].map(box).join('')};
const parcelGarden={...PARCEL_GARDEN,colliders:[
  {x:-7.70,y:.296,z:18.145,w:.398,h:.396,d:1.19},
  {x:-7.73,y:.791,z:15.35,w:.272,h:1.382,d:.270},
  {x:-7.75,y:.732,z:21.16,w:.246,h:1.264,d:.244},
].map(box).join('')};
const commonsVisual={asset:COMMONS_ASSET,revision:COMMONS_REVISION,wayfinding:WAYFINDING,houseWalk:HOUSE_WALK,
  parcelTerrain:PARCEL_TERRAIN,parcelGarden,galleryIsland:GALLERY_ISLAND,northBridge:NORTH_BRIDGE,mirador:{...MIRADOR,
    colliders:[-1,1].flatMap(side=>[
      {x:side*2.32,y:.31,z:-17.815,w:.52,h:.42,d:1.825},
      {x:side*1.94,y:1.20,z:-19,w:.69,h:2.20,d:.69},
    ]).map(box).join('')},colliders:[
  {x:-22.40,y:.298,z:-5.85,w:2.48,h:.418,d:.49},
  {x:-9.11,y:1.30,z:-2.87,w:.34,h:2.45,d:.34},
  {x:-9.11,y:1.30,z:-4.50,w:.34,h:2.45,d:.34},
  {x:-8.73,y:.29,z:-3.68,w:.59,h:.43,d:1.54},
  {x:-5.13,y:.28,z:6.84,w:1.41,h:.42,d:.59},
  {x:7.82,y:.28,z:3.86,w:1.41,h:.42,d:.59},
  {x:-7.95,y:.96,z:-5.55,w:.34,h:1.78,d:.34},
  {x:6.68,y:.845,z:6.95,w:.30,h:1.55,d:.30},
].map(box).join('')};
const softLight=({id,x,y,z,color,intensity,distance})=>`<m-light id="${id}" x="${x}" y="${y}" z="${z}" type="point" intensity="${intensity}" distance="${distance}" color="${color}" cast-shadows="false"></m-light>`;
// Match the side-light opening in the Blender gallery. The key crosses the
// room above the path and separates the exhibits from the darker oak ceiling.
const galleryKey={position:[-4.82,3.62,.5],target:[2.45,1.05,.5],color:'#cde3ff'};
const foyerKey={position:[4.87,3.15,1.75],target:[-2.30,.80,-2.3],color:'#ffe3bf',intensity:87};
const chamberKey={position:[-.44,4.35,1.9],target:[-.44,1.07,1.9],color:'#ffe0b6',intensity:68};
const chamberRig=[
  {id:'stair-bounce',x:-3,y:2.6,z:-4.5,distance:8,intensity:13,color:'#a2c2f6'},
  {id:'spatializer-practical',x:3.79,y:2.72,z:-.8,distance:5,intensity:15,color:'#ffd6a2'},
  {id:'weaver-practical',x:-3.76,y:2.72,z:2.67,distance:5,intensity:15,color:'#ffd6a2'},
].map(softLight).join('');
const galleryColliders=[
  {x:2.5,y:.529,z:1.25,w:1.32,h:.858,d:1.04},
  {x:3.39,y:.554,z:-.35,w:2.9,h:.908,d:1.38},
  {x:3.39,y:.71,z:3.68,w:2.9,h:1.22,d:1.38},
  ...[-4.163,-1.837].map(z=>({x:5.485,y:.976,z,w:.194,h:1.728,d:.218})),
].map(box).join('');

function readAsset(path,revision){
  const bytes=readFileSync(new URL('../public/'+path,import.meta.url));
  if(bytes.length>4*1024*1024||createHash('sha256').update(bytes).digest('hex')!==revision)
    throw Error('Atelier asset does not match the qualified export: '+path);
  return {bytes,revision:revision+'.glb'};
}

export function packedExteriorArt(){
  const assets=new Map();
  for(const [path,revision] of Object.entries(ATELIER_ASSET_REVISIONS)){
    if(!path.startsWith('assets/')||!path.endsWith('.glb'))continue;
    const asset=readPackedArt(path,revision);
    if(asset)assets.set(path,asset);
  }
  return assets;
}

export function selectAtelier(profile,rooms,houses,exterior=packedExteriorArt()){
  if(profile===undefined)return null;
  if(profile!==ATELIER_PROFILE)throw Error('Unknown Holodeck art profile');
  if(!houses.some(house=>house.id===COMPAII_HOUSE&&house.parcel==='parcel-west-1'))
    throw Error('The Atelier requires the existing CompAII parcel');
  for(const [id,level,entry,links] of layout){
    const room=rooms.get(id);
    if(room?.house!==COMPAII_HOUSE||room.level!==level||room.entry!==entry||
       !matchesOriginalLinks(id,room.links,links))
      throw Error('The Atelier requires the existing authored room layout');
  }
  const assets=new Map();
  for(const [path,revision] of Object.entries(ATELIER_ASSET_REVISIONS)){
    if(path.startsWith('room-art/')){
      assets.set(path.split('/').at(-1),readPackedArt(path,revision)??readAsset(path,revision));
    }else if(!exterior.has(path)){
      readAsset(path,revision);
    }
  }
  const asset=name=>assets.get(name+'.glb');
  const foyerArt={...asset('foyer'),...floorProfile,ambient:.22,keyLight:foyerKey,authoredDoor:true,
    fixtures:[fixture('foyer','foyer-orientation-table','Mesa de orientación',0,.66,.16),
      fixture('foyer','foyer-bench','Banco del vestíbulo',-5.13,.582,1.18)],
    colliders:[
      {x:0,y:.383,z:.16,w:1.78,h:.566,d:2.34},
      {x:-5.13,y:.341,z:1.18,w:.88,h:.482,d:2.91},
      {x:-5.46,y:.86,z:1.18,w:.21,h:1.34,d:2.96},
    ].map(box).join(''),
    lightRig:softLight({id:'vestibule-practical',x:-2.83,y:1.78,z:-1.42,intensity:13,distance:6,color:'#ffbb75'})};
  const galleryArt={...floorProfile,ambient:.40,colliders:galleryColliders,keyLight:galleryKey,
    authoredPortal:{plaque:.438,light:.64},
    fixtures:[fixture('gallery','gallery-finished-plinth','Expositor central',2.5,.965,1.25),
      fixture('gallery','gallery-work-plinth','Expositor de trabajo',3.3945,1.1075,-.34944),
      fixture('gallery','gallery-archive-plinth','Expositor de archivo',3.3945,1.4075,3.67744)],
    lightRig:softLight({id:'collection-warm-bounce',x:4.2,y:2.6,z:1.6,intensity:12,distance:7,color:'#ffd8ae'})};
  const labArt={...asset('beacon'),...floorProfile,authoredStairs:true,ambient:.27,keyLight:chamberKey,
    // The authored plaque is on the stair-facing rim of the central instrument.
    station:{...interiorArt(rooms.get(lab)).station,
      position:{x:-.44,y:.1,z:.59},revision:2,authoredSign:true},
    controls:BEACON_CONTROLS,
    colliders:'<m-cylinder x="-.44" y=".315" z="1.9" radius="1.62" height=".43" opacity="0" cast-shadows="false"></m-cylinder>'+
     box({x:3.802,y:.643,z:-.791,w:2.332,h:1.085,d:.886})+
     box({x:-3.758,y:.643,z:2.659,w:2.068,h:1.085,d:.886}),
    lightRig:chamberRig};
  const towerArt={...asset('tower'),replacesShell:true,authoredPortal:{plaque:.181,light:.35},ambient:.64,
    // The east clerestory is an open aperture in the Blender model.
    outdoorSky:OUTDOOR_SKY,
    fixtures:[fixture('tower','tower-resonator','Resonador de la torre',.54,2.42,5.46)],
    // The baked mesh is visual only. Match the east seat and the oak sill
    // under the resonator using the authored tower's room-space dimensions.
    colliders:[
      {x:5.59,y:.365,z:-.12,w:.38,h:.53,d:7.8},
      {x:.54,y:.65,z:5.6,w:5.63,h:.20,d:.31},
    ].map(box).join(''),
    lightRig:[
      {id:'tower-clarity',x:5.28,y:3.82,z:1,intensity:39,distance:11,color:'#b1d1ff'},
      {id:'tower-resonator',x:.54,y:3.9,z:4.7,intensity:29,distance:7,color:'#ffe2ac'},
      {id:'tower-return',x:-3,y:3.84,z:-4.15,intensity:8,distance:5,color:'#ffcb86'},
    ].map(softLight).join('')};
  return {
    sceneryAsset:SURROUNDINGS_ASSET,sceneryRevision:SURROUNDINGS_REVISION,outdoorSky:OUTDOOR_SKY,
    coastalRidges:COASTAL_RIDGES,coastalFog:COASTAL_FOG,gardenVisual,commonsVisual,
    houseVisual:house=>house.id===COMPAII_HOUSE&&house.revision===1?{facade}:null,
    passageFitting:(room,passage)=>{
      if(room?.house!==COMPAII_HOUSE||passage.kind!=='portal')return null;
      const selected=room.id===foyer ? passage.slot===1&&addedFoyerPortal(passage) :
        !originalRooms.has(room.id)&&passage.to===foyer;
      return selected?asset('foyer-portal'):null;
    },
    interiorArtwork:(room,passages=[])=>{
      if(room?.house!==COMPAII_HOUSE)return null;
      if(room.id===foyer){
        const galleryDoor=passages.some(link=>link.slot===0&&link.kind==='door'&&link.to===gallery);
        return galleryDoor?{...foyerArt,...asset('foyer-gallery'),authoredPassages:[0]}:foyerArt;
      }
      if(room.id===lab){
        const returnStair=passages.some(link=>link.slot===0&&link.kind==='stair'&&link.to===gallery);
        return returnStair?{...labArt,...asset('beacon-return'),authoredPassages:[0]}:labArt;
      }
      if(room.id===tower)return towerArt;
      if(room.id!==gallery)return null;
      const hasLabStair=passages.some(link=>link.kind==='stair'&&link.to===lab);
      return {...galleryArt,...asset(hasLabStair?'gallery':'gallery-sealed'),
        authoredStairs:hasLabStair,authoredPassages:hasLabStair?[0,1]:[0]};
    },
  };
}
