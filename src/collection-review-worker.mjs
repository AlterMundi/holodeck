import {BufferAttribute,BufferGeometry} from 'three';
import {MeshBVH} from 'three-mesh-bvh/src/index.js';
import {closedMatterPart} from './matter-contact.mjs';
import {readWorktableReview} from './collection-review.mjs';

self.onmessage=async ({data:{edition,scene}})=>{
  try{
    const review=await readWorktableReview(edition,scene,{signal:AbortSignal.timeout(24000)});
    const transfer=[];
    for(const part of review.parts){
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new BufferAttribute(part.positions,3));
      geometry.setIndex(new BufferAttribute(part.indices,1));
      part.closed=closedMatterPart(part.positions,part.indices);
      part.contactIndex=MeshBVH.serialize(new MeshBVH(geometry,{indirect:true}),{cloneBuffers:false});
      transfer.push(part.positions.buffer,part.indices.buffer,part.contactIndex.indirectBuffer.buffer,...part.contactIndex.roots);
    }
    self.postMessage({review},transfer);
  }catch{
    self.postMessage({failed:true});
  }
};
