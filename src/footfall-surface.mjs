import {grassCover} from './toroidal-grass.mjs';
import {terrainColor,terrainTrail} from './toroidal-terrain.mjs';

// What a foot at this exterior sample stands on. Authored paving and
// buildings stand above the terrain; shallow water covers it.
export function footSurface(sample){
  if(!sample)return null;
  const {u,v,feet,ground,waterLevel}=sample;
  if(waterLevel>feet-.04)return waterLevel-ground<.9?'water':null;
  if(feet-ground>.22)return 'stone';
  if(terrainTrail(u,v)>.55)return 'dirt';
  return grassCover(u,v,ground)>.25?'grass':'dirt';
}

// The colour a step lifts from the ground under it.
export function footDustColour(surface,sample){
  if(surface==='stone')return [.7,.68,.64];
  const [r,g,b]=terrainColor(sample.u,sample.v,sample.ground,0);
  if(surface==='dirt'){
    // Trails are bare earth even where the terrain colour reads green.
    const grey=(r+g+b)/3;
    return [grey*.9+.18,grey*.78+.12,grey*.62+.08];
  }
  return [r,g,b];
}
