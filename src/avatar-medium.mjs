import {TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation} from './toroidal-terrain.mjs';

// What a body is in, read from where physics put its feet. Each body supplies
// its own depths in metres. A floating body is nominally supported by the
// water, so support alone cannot separate wading from swimming. The prior
// medium widens its own band so a few centimetres cannot flip the pose.
export const HUMAN_BODY=Object.freeze({wade:.18,float:.92,release:.14,shoulders:1.36});
export const COMPANION_BODY=Object.freeze({wade:.08,float:.70,release:.10,shoulders:1.02});

export function avatarMedium(body,{feet,ground,waterLevel},{supported=false,previous=null}={}){
  const draft=waterLevel-feet,depth=waterLevel-ground;
  const floating=previous==='surface'||previous==='submerged';
  if(depth>body.wade&&draft>body.float-(floating?body.release:0))
    return draft>body.shoulders-(previous==='submerged'?.07:0)?'submerged':'surface';
  if(!supported)return 'air';
  return draft>body.wade-(previous==='wade'?.04:0)?'wade':'ground';
}

export function exteriorSample(point){
  const {u,v,height}=terrainCoordinates([point.x,point.y,point.z]);
  return {u,v,feet:height,ground:terrainElevation(u,v),waterLevel:TOROIDAL_TERRAIN.waterLevel};
}

// Fraction of the body from feet to shoulders that is under water.
export const immersion=(body,{feet,waterLevel})=>
  Math.max(0,Math.min(1,(waterLevel-feet)/body.shoulders));
