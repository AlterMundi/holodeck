import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readPackedArt} from './packed-art.mjs';

// All kits share this footprint. A visitor keeps the same walkable paths
// and passage anchors when an owner changes the visual design.
const furniture=[
  {id:'left-bench',position:{x:-1.55,y:.64,z:.25},width:1.18,height:1.08,depth:1.86},
  {id:'right-bench',position:{x:1.55,y:.845,z:-.85},width:1.18,height:1.49,depth:1.70},
];
const colliders=furniture.map(({position:{x,y,z},width,height,depth})=>
  `<m-cube x="${x}" y="${y}" z="${z}" width="${width}" height="${height}" depth="${depth}" opacity="0" cast-shadows="false"></m-cube>`).join('');

// Install the receiving build before selecting the new kit on a live plan.
const SENSORIAL_KIT_AVAILABLE=false;
const SENSORIAL_DIGEST='61e33fd589d9b9c00a7d2e502a41053a6defed336fbcc216114fbd29dbaf1279';
export const OWNED_PACKED_ART_REVISIONS=Object.freeze({
  'room-art/owned-sensorial-workshop.glb':SENSORIAL_DIGEST,
});

function kit(id,digest,title,palette,fixtureTitles,lightColor,presentation={}){
  const path='room-art/owned-'+id+'.glb';
  const packed=readPackedArt(path,digest);
  const bytes=packed?.bytes??readFileSync(new URL('../public/'+path,import.meta.url));
  if(bytes.length>768*1024||createHash('sha256').update(bytes).digest('hex')!==digest)
    throw Error('Owned room asset does not match the qualified export: '+id);
  const lightRig=`<m-light id="furniture-key" x="-1.55" y="2.85" z=".25" type="point" intensity="23" distance="6" color="${lightColor}" cast-shadows="false"></m-light>`+
    `<m-light id="furniture-fill" x="1.55" y="2.8" z="-.85" type="point" intensity="15" distance="6" color="#d5e9ff" cast-shadows="false"></m-light>`;
  return {title,...packed,bytes,colliders,palette,hideMarker:true,replacesWalls:true,
    lightRig,
    revision:digest+'.glb',
    fixtures:furniture.map(({id,position},index)=>({id,position,title:fixtureTitles[index],kind:'fixture'})),
    ...presentation};
}

export function readOwnedRoomArt(){
  return new Map([
    ['listening-workshop',kit('listening-workshop','125439061258196983b0965bafaa618560f2e7ea81815b52efe03ffdf0f4775d','Taller de escucha',
      {floor:'#625b4a',wall:'#304b4d',end:'#395456'},['Mesa de escucha','Banco de prototipos'],'#ffd0a0')],
    ['project-archive',kit('project-archive','d5bbf24802a5a36650f89e98d39efe2982647359d3a13f7878e8f7f2bb4555e3','Archivo de proyectos',
      {floor:'#706551',wall:'#4b5e65',end:'#51686c'},['Mesa de consulta','Estante de archivo'],'#ffdab8')],
    ['sensorial-workshop',kit('sensorial-workshop',SENSORIAL_DIGEST,
      'Taller de materiales',{floor:'#565653',wall:'#506c67',end:'#506c67'},
      ['Mesa de muestras','Banco de prototipos'],'#ffd5a3',{
        publishable:SENSORIAL_KIT_AVAILABLE,ambient:.36,
        keyLight:{position:[-2.9,3.05,2.8],target:[.75,.7,-1.05],color:'#f9d2ab',intensity:76},
      })],
  ]);
}
