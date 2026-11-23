import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {COMPAII_HOUSE,interiorArt} from './interior-art.mjs';

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
const SURROUNDINGS_ASSET='island-scenery-atelier.glb';
const dossier={
  'room-art/compaii-atelier/foyer.glb':'f0a8b2b9f63a67559024e7387036bb0592623f3170a4a9863fead7e44eab03f6',
  'room-art/compaii-atelier/gallery.glb':'b6b72597851615355a24aa5450922a13dea581eabb1d56fc7d92d102bd088c38',
  'room-art/compaii-atelier/gallery-sealed.glb':'53d1e89c9fc2ef4a4f79908b57c4990e23a69f6125706b1fa7144533312ca1b9',
  'room-art/compaii-atelier/beacon.glb':'0ab7546ae7d540e14dbed049a70da52a2aeb36bd575fd8f31532c94a81ef762f',
  ['assets/'+FACADE_ASSET]:'940aa64038396e43db8beca859e33f4f52c6ae3a84d1702457159c0af1224077',
  ['assets/'+GARDEN_ASSET]:'ecf2f1225a065b1a1b4b067ad2cd0f3ac96bc62b5d8a31a8894dd1a50490361b',
  ['assets/'+SURROUNDINGS_ASSET]:'2e2e7de478fb9421ba5ca71f055119323c431484dedfe37801378192d871ee41',
};

const facade={
  asset:FACADE_ASSET,
  bounds:{min:[-.732565,0,-1.573],max:[.732565,2.649471,1.574201]},
};
const gardenVisual={asset:GARDEN_ASSET,x:22,y:.102,z:-2.75,sx:.50,sy:.78,sz:.55};
const floorProfile={replacesShell:true,authoredExhibitBase:true};
const box=({x,y,z,w,h,d})=>`<m-cube x="${x}" y="${y}" z="${z}" width="${w}" height="${h}" depth="${d}" opacity="0" cast-shadows="false"></m-cube>`;
const softLight=({id,x,y,z,color,intensity,distance})=>`<m-light id="${id}" x="${x}" y="${y}" z="${z}" type="point" intensity="${intensity}" distance="${distance}" color="${color}" cast-shadows="false"></m-light>`;
const chamberRig='<m-light id="instrument-key" x="-.44" y="4.53" z="1.9" type="spotlight" distance="8" angle="38" intensity="105" cast-shadows="true" color="#ffd6a2"></m-light>'+[
  {id:'stair-bounce',x:-3,y:2.6,z:-4.5,distance:8,intensity:22,color:'#91b4e6'},
  {id:'spatializer-practical',x:3.79,y:2.72,z:-.8,distance:5,intensity:21,color:'#ffd6a2'},
  {id:'weaver-practical',x:-3.76,y:2.72,z:2.67,distance:5,intensity:21,color:'#ffd6a2'},
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
  const foyerArt={...asset('foyer'),...floorProfile,ambient:.69,
    colliders:box({x:0,y:.352,z:.16,w:1.78,h:.504,d:2.34}),
    lightRig:softLight({id:'vestibule-practical',x:0,y:3.42,z:.8,intensity:30,distance:8,color:'#ffc382'})};
  const galleryArt={...floorProfile,ambient:.82,colliders:galleryColliders,
    lightRig:softLight({id:'collection-daylight',x:-3.9,y:3.91,z:1.6,intensity:24,distance:8,color:'#b9d4f5'})};
  const labArt={...asset('beacon'),...floorProfile,authoredStairs:true,ambient:.60,
    station:interiorArt(rooms.get(lab)).station,
    colliders:'<m-cylinder x="-.44" y=".315" z="1.9" radius="1.62" height=".43" opacity="0" cast-shadows="false"></m-cylinder>'+
     box({x:3.802,y:.643,z:-.791,w:2.332,h:1.085,d:.886})+
     box({x:-3.758,y:.643,z:2.659,w:2.068,h:1.085,d:.886}),
    lightRig:chamberRig};
  return {
    sceneryAsset:SURROUNDINGS_ASSET,gardenVisual,
    houseVisual:house=>house.id===COMPAII_HOUSE&&house.revision===1?{facade}:null,
    interiorArtwork:(room,passages=[])=>{
      if(room?.house!==COMPAII_HOUSE)return null;
      if(room.id===foyer)return foyerArt;
      if(room.id===lab)return labArt;
      if(room.id!==gallery)return null;
      const hasLabStair=passages.some(link=>link.kind==='stair'&&link.to===lab);
      return {...galleryArt,...asset(hasLabStair?'gallery':'gallery-sealed'),authoredStairs:hasLabStair};
    },
  };
}
