import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readPackedArt} from './packed-art.mjs';
import anchors from '../art/collection/anchors.json' with {type:'json'};

const path='room-art/matter-workshop.glb';
const digest='d9cf9ab31f3fb5bd7ac40d7f7d7bbbd78f3c7a1748b131262a716a780be68aa7';
export const MATTER_ART_REVISIONS=Object.freeze({[path]:digest});

// Coordinates refer to the meters in the Blender shell and the existing
// invisible 12 meter room. Only the furniture needs its own collision.
const furniture=[
  {x:0,y:.579,z:-.43,width:2.72,height:.958,depth:1.58},
  {x:3.35,y:1.27,z:-3.68,width:2.57,height:2.34,depth:1.4},
  {x:-5.38,y:1.12,z:-.42,width:.77,height:2.04,depth:3.66},
];
const colliders=furniture.map(({x,y,z,width,height,depth})=>
  `<m-cube x="${x}" y="${y}" z="${z}" width="${width}" height="${height}" depth="${depth}" opacity="0" cast-shadows="false"></m-cube>`).join('');
const lightRig='<m-light x="3.35" y="2.235" z="-3.68" type="point" intensity="13" distance="4" color="#ffd097" cast-shadows="false"></m-light>'+
  '<m-light x="-1.5" y="2.8" z="-5.4" type="point" intensity="7" distance="7" color="#bfd6ff" cast-shadows="false"></m-light>'+
  '<m-light x="-2.55" y="2.9" z="1.85" type="point" intensity="12" distance="7" color="#ffdfaf" cast-shadows="false"></m-light>';

const position=([x,y,z])=>({x,y,z});

export function readMatterWorkshopArt(){
  const packed=readPackedArt(path,digest);
  const bytes=packed?.bytes??readFileSync(new URL('../public/'+path,import.meta.url));
  if(bytes.length>512*1024||createHash('sha256').update(bytes).digest('hex')!==digest)
    throw Error('Matter workshop does not match the qualified Blender export');
  return {...packed,bytes,revision:digest+'.glb',replacesShell:true,colliders,lightRig,ambient:.34,
    keyLight:{position:[-.48,2.36,-.43],target:[0,1,-.43],color:'#ffdbad',intensity:53},
    archive:position(anchors['archive-model']),
    shelves:Array.from({length:6},(_,index)=>position(anchors['shelf-'+index])),
    fixtures:[
      {id:'worktable',title:'Mesa de trabajo',revision:1,position:position(anchors['worktable-model']),kind:'fixture'},
      {id:'archive-turntable',title:'Vitrina de archivo',revision:1,position:position(anchors['archive-model']),kind:'fixture'},
    ]};
}
