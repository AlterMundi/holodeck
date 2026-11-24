import {PropertyBinding} from 'three';
import {createSplats} from './splats.mjs';

// A fitted replacement uses room-local coordinates. Picking, furniture and
// invisible collision stay with the room's existing MML scene.
export function projectRoomSurface({room,model,bytes,target,radius}){
  const root=model.getContainer();
  const source=root.getObjectByName(PropertyBinding.sanitizeNodeName(target));
  if(!source?.isMesh||!source.visible)throw Error('Surface unavailable');

  const splat=createSplats(bytes,true,radius);
  splat.mesh.name='Room splat · '+target;
  splat.mesh.raycast=()=>{};
  const collisionMaterials=new Set();
  for(const collider of room.querySelectorAll('m-cube[opacity="0"]')){
    collider.getContainer().traverse(node=>{
      // Three can queue an invisible collider in the transparent draw pass.
      // Its visual depth must not occlude splats; its collision still applies.
      if(node.material?.opacity===0&&node.material.depthWrite){
        node.material.depthWrite=false;
        collisionMaterials.add(node.material);
      }
    });
  }

  source.visible=false;
  root.add(splat.mesh);
  return {
    mesh:splat.mesh,
    sort:splat.sort,
    dispose(){
      splat.dispose();
      source.visible=true;
      for(const material of collisionMaterials)material.depthWrite=true;
    },
  };
}
