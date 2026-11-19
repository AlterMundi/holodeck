// One-way projection of Room semantics. Static original art is a merged GLB;
// only traversable surfaces and changing activity elements remain MML primitives.
import {avatarForActor} from './avatar-registry.mjs';
import {workshopProjection,projectionNodeHTML,attribute} from './workshop-projection.mjs';
const sphere=(x,y,z,r,color)=>`<m-sphere x="${x}" y="${y}" z="${z}" radius="${r}" color="${color}" collide="false"></m-sphere>`;
const cylinder=(x,y,z,r,h,color,extra='')=>`<m-cylinder x="${x}" y="${y}" z="${z}" radius="${r}" height="${h}" color="${color}" ${extra}></m-cylinder>`;
export function worldDocument(room,{basePath='/'}={}){
  const prefix=basePath.endsWith('/')?basePath:basePath+'/';
  const projection=workshopProjection(room.entities),manifest=JSON.stringify(room.entities);
  if(manifest.length>16384)throw Error('Geometry manifest exceeds bound');
  let out=`<m-group id="workshop" data-run="${attribute(room.run)}" data-edition="${attribute(room.edition)}" data-semantic-sequence="${room.sequence}" data-geometry-state="${attribute(manifest)}">`;
  out+=`<m-model id="island-scenery" src="${attribute(prefix)}assets/island-scenery.glb" collide="false"></m-model>`;
  // Invisible simple collision surfaces align with the visible GLB terrace tops.
  out+=cylinder(0,0,0,10.75,.2,'#6b987e','opacity="0"');
  out+=cylinder(0,0,-17,4.9,.2,'#6b987e','opacity="0"');
  for(const entity of projection){
    if(entity.deleted)continue;
    out+=`<m-group id="${attribute(entity.id)}" data-entity-revision="${entity.revision}">${entity.nodes.map(projectionNodeHTML).join('')}</m-group>`;
    if(entity.controls)out+=`<m-group id="bridge-control">${entity.controls.map(projectionNodeHTML).join('')}</m-group>`;
  }
  for(const p of room.projections.values()){
    const{x,y,z}=p.position;
    const id=`projection-${p.actor.replace(/[^\w-]/g,'')}`,appearance=p.form==='avatar'?avatarForActor({id:p.actor,kind:p.kind}):null;
    out+=`<m-group id="${id}" x="${x}" y="${y}" z="${z}"${appearance?` data-holodeck-avatar="${appearance}" data-avatar-being="${attribute(p.actor)}"`:''}><m-group id="${id}-fallback">${sphere(0,0,0,.28,'#9de6e5')}${p.form==='beacon'||appearance?cylinder(0,-.5,0,.07,.7,'#e9dcaf'):''}</m-group></m-group>`;
  }
  return out+'</m-group>';
}
