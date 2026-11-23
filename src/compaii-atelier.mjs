import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {COMPAII_HOUSE,interiorArt} from './interior-art.mjs';
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
const FACADE_ASSET='compaii-atelier-facade.glb';
const GARDEN_ASSET='compaii-atelier-garden.glb';
const COMMONS_ASSET='compaii-atelier-commons.glb';
const COMMONS_REVISION='c886dceb1c58807b553b9a8bfcfb499dbcc5f105ef3a60264fcb9f6b3be06a75';
const WAYFINDING=Object.freeze({asset:'commons-signs.glb',
  revision:'3bdd8d437662dfbd7725805922bada9dd06cd0bbf6301c6edd2aa2acee535cab'});
const HOUSE_WALK=Object.freeze({asset:'house-walk.glb',
  revision:'1a60872144ebff809cdf7447f45ee389e0a7aeb6b7f197f5907a87b46c1ccbcd'});
const SURROUNDINGS_ASSET='island-scenery-atelier.glb';
const SURROUNDINGS_REVISION='694d83c8ba05d59b062fa7cf0f816461ddb9f8bdff3609549f0f932fa28f69b0';
const OUTDOOR_SKY=Object.freeze({asset:'coastal-sky.jpg',
  revision:'2e9a63bbb5eb0e3a60e6144cff155e753211e093ee2870efda480129a01baae8'});
const COASTAL_RIDGES=Object.freeze({asset:'coastal-ridges.glb',
  revision:'518884afc176e4351746b8cce5e0461d1be7c7e36db0f3fc70a9a813e88b9119'});
const COASTAL_FOG=Object.freeze({fogNear:24,fogFar:124,fogColor:{r:.716,g:.776,b:.784}});
const dossier={
  'room-art/compaii-atelier/foyer.glb':'eb3bd88a7dc7e288ea6335f90b4ef24880d37dcd004c008e16a936a427c8198a',
  'room-art/compaii-atelier/gallery.glb':'1028d39b34938571ce0385e7bd6604f61c79a4f614ed3395648244e313d0dd35',
  'room-art/compaii-atelier/gallery-sealed.glb':'91c46b91164fd1ebfd20052cdf20d2dae59c0222126af016f16920a426dadc48',
  'room-art/compaii-atelier/beacon.glb':'18efdd2460c1cfff554b1a854520c15eeda9e1721ad2e8d166ef4ac2bffc2bf5',
  'room-art/compaii-atelier/tower.glb':'47ba2a0964304eba1f3cbf945121e737c5d9addd7e71c1696bfa8b52ddb872de',
  ['assets/'+FACADE_ASSET]:'940aa64038396e43db8beca859e33f4f52c6ae3a84d1702457159c0af1224077',
  ['assets/'+GARDEN_ASSET]:'ecf2f1225a065b1a1b4b067ad2cd0f3ac96bc62b5d8a31a8894dd1a50490361b',
  ['assets/'+COMMONS_ASSET]:COMMONS_REVISION,
  ['assets/'+WAYFINDING.asset]:WAYFINDING.revision,
  ['assets/'+HOUSE_WALK.asset]:HOUSE_WALK.revision,
  ['assets/'+SURROUNDINGS_ASSET]:SURROUNDINGS_REVISION,
  ['assets/'+OUTDOOR_SKY.asset]:OUTDOOR_SKY.revision,
  ['assets/'+COASTAL_RIDGES.asset]:COASTAL_RIDGES.revision,
};

const facade={
  asset:FACADE_ASSET,
  bounds:{min:[-.732565,0,-1.573],max:[.732565,2.649471,1.574201]},
};
const gardenVisual={asset:GARDEN_ASSET,x:22,y:.102,z:-2.75,sx:.50,sy:.78,sz:.55};
const floorProfile={replacesShell:true,authoredExhibitBase:true};
const box=({x,y,z,w,h,d})=>`<m-cube x="${x}" y="${y}" z="${z}" width="${w}" height="${h}" depth="${d}" opacity="0" cast-shadows="false"></m-cube>`;
const commonsVisual={asset:COMMONS_ASSET,revision:COMMONS_REVISION,wayfinding:WAYFINDING,houseWalk:HOUSE_WALK,colliders:[
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
].map(box).join('');

function readAsset(path,revision){
  const bytes=readFileSync(new URL('../public/'+path,import.meta.url));
  if(bytes.length>4*1024*1024||createHash('sha256').update(bytes).digest('hex')!==revision)
    throw Error('Atelier asset does not match the qualified export: '+path);
  return {bytes,revision:revision+'.glb'};
}

export function selectAtelier(profile,rooms,houses){
  if(profile===undefined)return null;
  if(profile!==ATELIER_PROFILE)throw Error('Unknown Holodeck art profile');
  if(!houses.some(house=>house.id===COMPAII_HOUSE&&house.parcel==='parcel-west-1'))
    throw Error('The Atelier requires the existing CompAII parcel');
  for(const [id,level,entry,links] of layout){
    const room=rooms.get(id);
    if(room?.house!==COMPAII_HOUSE||room.level!==level||room.entry!==entry||
       room.links.length!==links.length||links.some(([kind,to],index)=>room.links[index].to!==to||room.links[index].kind!==kind))
      throw Error('The Atelier requires the existing authored room layout');
  }
  const assets=new Map();
  for(const [path,revision] of Object.entries(dossier)){
    const asset=readAsset(path,revision);
    if(path.startsWith('room-art/'))assets.set(path.split('/').at(-1),asset);
  }
  const asset=name=>assets.get(name+'.glb');
  const foyerArt={...asset('foyer'),...floorProfile,ambient:.22,keyLight:foyerKey,authoredDoor:true,
    colliders:box({x:0,y:.352,z:.16,w:1.78,h:.504,d:2.34}),
    lightRig:softLight({id:'vestibule-practical',x:-2.83,y:1.78,z:-1.42,intensity:13,distance:6,color:'#ffbb75'})};
  const galleryArt={...floorProfile,ambient:.40,colliders:galleryColliders,keyLight:galleryKey,
    lightRig:softLight({id:'collection-warm-bounce',x:4.2,y:2.6,z:1.6,intensity:12,distance:7,color:'#ffd8ae'})};
  const labArt={...asset('beacon'),...floorProfile,authoredStairs:true,ambient:.27,keyLight:chamberKey,
    station:interiorArt(rooms.get(lab)).station,
    controls:BEACON_CONTROLS,
    colliders:'<m-cylinder x="-.44" y=".315" z="1.9" radius="1.62" height=".43" opacity="0" cast-shadows="false"></m-cylinder>'+
     box({x:3.802,y:.643,z:-.791,w:2.332,h:1.085,d:.886})+
     box({x:-3.758,y:.643,z:2.659,w:2.068,h:1.085,d:.886}),
    lightRig:chamberRig};
  const towerArt={...asset('tower'),replacesShell:true,authoredPortal:true,ambient:.64,
    colliders:box({x:5.59,y:.365,z:-.12,w:.38,h:.53,d:7.8}),
    lightRig:[
      {id:'tower-clarity',x:5.28,y:3.82,z:1,intensity:39,distance:11,color:'#b1d1ff'},
      {id:'tower-resonator',x:.54,y:3.9,z:4.7,intensity:29,distance:7,color:'#ffe2ac'},
      {id:'tower-return',x:-3,y:3.6,z:-4.88,intensity:22,distance:6,color:'#ffcb86'},
    ].map(softLight).join('')};
  return {
    sceneryAsset:SURROUNDINGS_ASSET,sceneryRevision:SURROUNDINGS_REVISION,outdoorSky:OUTDOOR_SKY,
    coastalRidges:COASTAL_RIDGES,coastalFog:COASTAL_FOG,gardenVisual,commonsVisual,
    houseVisual:house=>house.id===COMPAII_HOUSE&&house.revision===1?{facade}:null,
    interiorArtwork:(room,passages=[])=>{
      if(room?.house!==COMPAII_HOUSE)return null;
      if(room.id===foyer)return foyerArt;
      if(room.id===lab)return labArt;
      if(room.id===tower)return towerArt;
      if(room.id!==gallery)return null;
      const hasLabStair=passages.some(link=>link.kind==='stair'&&link.to===lab);
      return {...galleryArt,...asset(hasLabStair?'gallery':'gallery-sealed'),authoredStairs:hasLabStair};
    },
  };
}
