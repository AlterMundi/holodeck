import {readWorktableReview} from './collection-review.mjs';

self.onmessage=async ({data:{edition,scene}})=>{
  try{
    const review=await readWorktableReview(edition,scene,{signal:AbortSignal.timeout(24000)});
    self.postMessage({review},review.parts.flatMap(part=>[part.positions.buffer,part.indices.buffer]));
  }catch{
    self.postMessage({failed:true});
  }
};
