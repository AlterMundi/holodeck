import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Both kits share this footprint. A visitor keeps the same walkable paths
// and passage anchors when an owner changes the visual design.
const furniture=[
  {id:'left-bench',position:{x:-1.55,y:.64,z:.25},width:1.18,height:1.08,depth:1.86},
  {id:'right-bench',position:{x:1.55,y:.845,z:-.85},width:1.18,height:1.49,depth:1.70},
];
const colliders=furniture.map(({position:{x,y,z},width,height,depth})=>
  `<m-cube x="${x}" y="${y}" z="${z}" width="${width}" height="${height}" depth="${depth}" opacity="0" cast-shadows="false"></m-cube>`).join('');

function kit(id,digest,title,palette,fixtureTitles,lightColor){
  const bytes=readFileSync(new URL('../public/room-art/owned-'+id+'.glb',import.meta.url));
  if(bytes.length>768*1024||createHash('sha256').update(bytes).digest('hex')!==digest)
    throw Error('Owned room asset does not match the qualified export: '+id);
  const lightRig=`<m-light id="furniture-key" x="-1.55" y="2.85" z=".25" type="point" intensity="23" distance="6" color="${lightColor}" cast-shadows="false"></m-light>`+
    `<m-light id="furniture-fill" x="1.55" y="2.8" z="-.85" type="point" intensity="15" distance="6" color="#d5e9ff" cast-shadows="false"></m-light>`;
  return {title,bytes,colliders,palette,hideMarker:true,replacesWalls:true,
    lightRig,
    revision:digest+'.glb',
    fixtures:furniture.map(({id,position},index)=>({id,position,title:fixtureTitles[index],kind:'fixture'}))};
}

export function readOwnedRoomArt(){
  return new Map([
    ['listening-workshop',kit('listening-workshop','125439061258196983b0965bafaa618560f2e7ea81815b52efe03ffdf0f4775d','Taller de escucha',
      {floor:'#625b4a',wall:'#304b4d',end:'#395456'},['Mesa de escucha','Banco de prototipos'],'#ffd0a0')],
    ['project-archive',kit('project-archive','d5bbf24802a5a36650f89e98d39efe2982647359d3a13f7878e8f7f2bb4555e3','Archivo de proyectos',
      {floor:'#706551',wall:'#4b5e65',end:'#51686c'},['Mesa de consulta','Estante de archivo'],'#ffdab8')],
  ]);
}
