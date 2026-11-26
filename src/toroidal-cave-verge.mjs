import {DataTexture, LinearFilter, RGFormat, UnsignedByteType, MathUtils} from 'three';
import {CAVE} from './toroidal-cave.mjs';
import {terrainPosition,TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';

const {majorRadius,tubeRadius}=TOROIDAL_TERRAIN;
const turn=2*Math.PI;
const alongTurn=turn*(majorRadius+tubeRadius*Math.cos(CAVE.latitude*turn));
const acrossTurn=turn*tubeRadius;
const front=-1,back=18,left=-13,right=13;
const empty=Object.freeze([0,0]);
const smooth=(edge,full,n)=>MathUtils.smoothstep(n,edge,full);

function outletCover(along,across){
  if(along<front||along>back||across<left||across>right)return empty;
  const center=.46*Math.sin(along*.36)-.12*Math.sin(along*.93);
  const wander=.65*Math.sin(.55*along+1.43*across)+.24*Math.sin(2*along+4.1*across);
  const fromTread=Math.abs(across-center);
  const shelter=across>center;
  const end=(shelter?15.7:12.8)+1.5*wander;
  const edge=(shelter?10.9:9.2)+wander;
  const outsideRock=smooth(2.2,3.9,along)+
    (1-smooth(2.2,3.9,along))*smooth(6.4,8.0,Math.abs(across));
  const ground=outsideRock*(1-smooth(end-4,end,along))*
    smooth(front,1.8,along)*(1-smooth(edge-3.8,edge,fromTread));
  const turf=ground*smooth(1.6,3.2,fromTread+.34*wander)*(.84+.16*wander);
  const tread=smooth(1.8,3.1,along)*(1-smooth(12,17,along))*
    (1-smooth(.65,2.25,fromTread+.3*wander));
  return [turf,tread];
}

export function caveExitCover(u,v){
  return outletCover((u-CAVE.to)*alongTurn,(v-CAVE.latitude)*acrossTurn);
}

export function caveExitCellCapacity(columns,rows){
  return (1+Math.ceil((back-front)*columns/alongTurn))*
    (1+Math.ceil((right-left)*rows/acrossTurn));
}

export function intersectsCaveExitCover(u,v,du,dv){
  return u+du>CAVE.to+front/alongTurn&&u<CAVE.to+back/alongTurn&&
    v+dv>CAVE.latitude+left/acrossTurn&&v<CAVE.latitude+right/acrossTurn;
}

// Bake the same field used by the rooted plants. The two channels paint
// short turf and exposed tread where the instanced blades thin with distance.
export function createCaveExitCoverTexture(){
  const size=64,data=new Uint8Array(size*size*2);
  for(let row=0;row<size;row++)for(let column=0;column<size;column++){
    const [turf,tread]=outletCover(front+(column+.5)*(back-front)/size,
      left+(row+.5)*(right-left)/size);
    const pixel=(row*size+column)*2;
    data[pixel]=Math.round(turf*255);
    data[pixel+1]=Math.round(tread*255);
  }
  const texture=new DataTexture(data,size,size,RGFormat,UnsignedByteType);
  texture.name='Cave outlet meadow and tread';
  texture.minFilter=texture.magFilter=LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

const corners=[front,back].flatMap(along=>[left,right].flatMap(across=>
  [-20,60].map(height=>terrainPosition(CAVE.to+along/alongTurn,CAVE.latitude+across/acrossTurn,height))));
const glsl=value=>value.toFixed(8);
const box=(reduce,padding)=>`vec3(${[0,1,2].map(axis=>
  (reduce(...corners.map(point=>point[axis]))+padding).toFixed(3)).join(',')})`;

export const caveExitCoverShader=`
  uniform sampler2D holodeckCaveExitCover;
  vec2 caveExitCoverAt(vec3 position){
    // Reject the rest of the ring before computing its angular coordinates.
    if(any(lessThan(position,${box(Math.min,-4)}))||
       any(greaterThan(position,${box(Math.max,4)})))return vec2(0.0);
    float horizontal=length(position.xz);
    float u=atan(position.z,position.x)/6.28318530718;
    float v=atan(position.y,horizontal-${glsl(majorRadius)})/6.28318530718;
    vec2 metres=vec2((u-${glsl(CAVE.to)})*${glsl(alongTurn)},(v-${glsl(CAVE.latitude)})*${glsl(acrossTurn)});
    vec2 uv=(metres-vec2(${front.toFixed(1)},${left.toFixed(1)}))/
      vec2(${(back-front).toFixed(1)},${(right-left).toFixed(1)});
    if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec2(0.0);
    return textureLod(holodeckCaveExitCover,uv,0.0).rg;
  }
`;
