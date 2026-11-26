import {TOROIDAL_TERRAIN, terrainCoordinates, terrainElevation, terrainFrame, terrainPosition} from './toroidal-terrain.mjs';

const u=.016, v=.258227;
const size=160, heightRange=192;
const {up,alongRing,aroundTube}=terrainFrame(u,v);
const center=terrainPosition(u,v,TOROIDAL_TERRAIN.waterLevel);

export const REFLECTION_BANK=Object.freeze({size,heightRange,center,up,along:alongRing,across:aroundTube});

// Each texel stores the elevation above this patch's tangent plane,
// including the torus curvature in the canonical terrain sample.
export function buildReflectionBank(first=0, rows=size){
  const data=new Uint8Array(size*rows*2);
  const point=[0,0,0];
  for(let j=0;j<rows;j++){
    const z=first+j+.5-size/2;
    for(let i=0;i<size;i++){
      const x=i+.5-size/2;
      let lift=0;
      for(let step=0;step<3;step++){
        for(let axis=0;axis<3;axis++)
          point[axis]=center[axis]+alongRing[axis]*x+aroundTube[axis]*z+up[axis]*lift;
        const {u,v,height}=terrainCoordinates(point);
        lift+=terrainElevation(u,v)-height;
      }
      const packed=Math.round(65535*Math.max(0,Math.min(1,.5+lift/heightRange)));
      const at=2*(j*size+i);
      data[at]=packed>>8;
      data[at+1]=packed&255;
    }
  }
  return data;
}
