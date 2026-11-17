// One-way projection of Room semantics. Static original art is a merged GLB;
// only traversable surfaces and changing activity elements remain MML primitives.
import { WORKSHOP } from './workshop.mjs';
const cube=(x,y,z,w,h,d,color,extra='')=>`<m-cube x="${x}" y="${y}" z="${z}" width="${w}" height="${h}" depth="${d}" color="${color}" ${extra}></m-cube>`;
const sphere=(x,y,z,r,color,extra='')=>`<m-sphere x="${x}" y="${y}" z="${z}" radius="${r}" color="${color}" collide="false" ${extra}></m-sphere>`;
const cylinder=(x,y,z,r,h,color,extra='')=>`<m-cylinder x="${x}" y="${y}" z="${z}" radius="${r}" height="${h}" color="${color}" ${extra}></m-cylinder>`;
export function worldDocument(room,{basePath='/'}={}){
  const prefix=basePath.endsWith('/')?basePath:basePath+'/';
  let out=`<m-group id="workshop" data-run="${room.run}" data-semantic-sequence="${room.sequence}">`;
  out+=`<m-model id="island-scenery" src="${prefix}assets/island-scenery.glb" collide="false"></m-model>`;
  // Invisible simple collision surfaces align with the visible GLB terrace tops.
  out+=cylinder(0,0,0,10.75,.2,'#6b987e','opacity="0"');
  out+=cylinder(0,0,-17,4.9,.2,'#6b987e','opacity="0"');
  const connected=room.entities.bridge.raised;
  const bridge=WORKSHOP.anchors.bridge,control=WORKSHOP.anchors['bridge-control'];
  out+=`<m-group id="bridge" data-entity-revision="${room.entities.bridge.revision}">`;
  for(let i=0;i<8;i++){
    const z=bridge.z+1.9-i*.55,y=connected?bridge.y-.01:bridge.y-2.4;
    out+=cube(0,y,z,2.45,.2,.49,i%2?'#be9871':'#d3b18a');
    if(connected&&i%2===0)for(const x of [-1.12,1.12])out+=cylinder(x,.64,z,.045,.8,'#bc8355');
  }
  if(connected)for(const x of [-1.12,1.12])out+=cube(x,bridge.y+.84,bridge.z,.065,.07,4.25,'#bc8355');
  out+='</m-group>';
  // The gathering mechanism has a recognizable identity in every projection.
  out+=`<m-group id="bridge-control">${cylinder(control.x,control.y-.76,control.z,.72,.56,'#536c70')}${cylinder(control.x,control.y-.43,control.z,.53,.12,'#bc8355')}${sphere(control.x,control.y,control.z,.35,connected?'#efc776':'#95d7ca')}</m-group>`;
  for(const [id,e] of Object.entries(room.entities))if(id.startsWith('garden-')&&!e.deleted){
    const color={mint:'#8ce4c2',amber:'#efc87a',rose:'#e8a2b9'}[e.color];
    out+=`<m-group id="${id}" data-entity-revision="${e.revision}">${cylinder(e.x,.24,e.z,.32,.28,'#d3c19b')}${cylinder(e.x,.51,e.z,.065,.3,'#bc8355')}${sphere(e.x,.9,e.z,.34,color)}</m-group>`;
  }
  for(const p of room.projections.values()){
    const{x,y,z}=p.position;
    out+=`<m-group id="projection-${p.actor.replace(/[^\w-]/g,'')}">${sphere(x,y,z,.28,'#9de6e5')}${p.form==='beacon'?cylinder(x,y-.5,z,.07,.7,'#e9dcaf'):''}</m-group>`;
  }
  return out+'</m-group>';
}
