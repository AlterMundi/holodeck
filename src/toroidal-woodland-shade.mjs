import {DataTexture, LinearFilter, RGFormat, UnsignedByteType} from 'three';
import {TOROIDAL_TERRAIN,terrainPosition} from './toroidal-terrain.mjs';

const SIZE=256;
const WEST=TOROIDAL_TERRAIN.majorRadius-112;
const SOUTH=-16;
const SPAN=152;
const METRES=SPAN/SIZE;
const FLOOR_Y=460;

export const woodlandShadeShader=`
  uniform sampler2D woodlandShadeMap;
  vec2 woodlandFloorAt(vec3 world) {
    vec2 uv=(world.xz-vec2(${WEST.toFixed(1)},${SOUTH.toFixed(1)}))/${SPAN.toFixed(1)};
    if(world.y<${FLOOR_Y.toFixed(1)}||any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec2(0.0);
    return texture2D(woodlandShadeMap,uv).rg;
  }
`;

function smooth(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}

export function sampleWoodlandLitter(texture,[x,y,z]){
  if(y<FLOOR_Y||x<WEST||x>WEST+SPAN||z<SOUTH||z>SOUTH+SPAN)return 0;
  const clamp=value=>Math.max(0,Math.min(SIZE-1,value));
  const column=clamp((x-WEST)/METRES-.5),row=clamp((z-SOUTH)/METRES-.5);
  const left=Math.floor(column),top=Math.floor(row);
  const right=Math.min(SIZE-1,left+1),bottom=Math.min(SIZE-1,top+1);
  const tx=column-left,tz=row-top;
  const pixels=texture.image.data;
  const read=(col,r)=>pixels[2*(r*SIZE+col)+1];
  return ((read(left,top)*(1-tx)+read(right,top)*tx)*(1-tz)
    +(read(left,bottom)*(1-tx)+read(right,bottom)*tx)*tz)/255;
}

export function createWoodlandShade(trees){
  const pixels=new Uint8Array(2*SIZE*SIZE);
  for(const tree of trees){
    if(tree.inner)continue;
    const [x,,z]=terrainPosition(tree.u,tree.v,tree.h);
    const radius=tree.width*(tree.spreading?.41:.33);
    if(x+radius<WEST||x-radius>WEST+SPAN||z+radius<SOUTH||z-radius>SOUTH+SPAN)continue;
    const startColumn=Math.max(0,Math.floor((x-radius-WEST)/METRES));
    const endColumn=Math.min(SIZE-1,Math.ceil((x+radius-WEST)/METRES));
    const startRow=Math.max(0,Math.floor((z-radius-SOUTH)/METRES));
    const endRow=Math.min(SIZE-1,Math.ceil((z+radius-SOUTH)/METRES));
    const cos=Math.cos(tree.yaw),sin=Math.sin(tree.yaw);
    for(let row=startRow;row<=endRow;row++){
      for(let col=startColumn;col<=endColumn;col++){
        const dx=WEST+(col+.5)*METRES-x,dz=SOUTH+(row+.5)*METRES-z;
        const across=(dx*cos-dz*sin)/radius,along=(dx*sin+dz*cos)/radius;
        const distance=Math.hypot(across,along*1.13);
        const margin=.12*Math.sin(across*6+along*5+tree.yaw);
        const dapple=.84+.16*Math.sin(across*12-along*8+tree.yaw);
        const canopy=.62*dapple*(1-smooth((distance+margin-.08)/.87));
        const contact=.32*(1-smooth(Math.hypot(dx,dz)/.73));
        const fade=smooth(Math.min(col,row,SIZE-1-col,SIZE-1-row)/10);
        const at=2*(row*SIZE+col);
        pixels[at]=Math.max(pixels[at],Math.round(255*Math.min(.78,canopy+contact)*fade));
        // Needle fall has its own broken edge and accumulates most under dense crowns.
        const scatter=.14*Math.sin(dx*1.43+dz*.66)+.10*Math.sin(dx*.77-dz*1.93+tree.yaw);
        const litter=1-smooth((distance+scatter-.14)/.75);
        pixels[at+1]=Math.max(pixels[at+1],Math.round(255*litter*fade));
      }
    }
  }
  const texture=new DataTexture(pixels,SIZE,SIZE,RGFormat,UnsignedByteType);
  texture.magFilter=LinearFilter;
  texture.minFilter=LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

export function useVegetationShade(material,texture){
  const compile=material.onBeforeCompile;
  const key=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>key()+'-woodland-floor';
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    shader.uniforms.woodlandShadeMap={value:texture};
    const varying='varying float woodlandShade;';
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\n'+varying+woodlandShadeShader)
      .replace('#include <project_vertex>',`#include <project_vertex>
        vec3 shadeRoot=(modelMatrix*instanceMatrix[3]).xyz;
        woodlandShade=woodlandFloorAt(shadeRoot).r;`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\n'+varying)
      .replace('#include <opaque_fragment>',`
        outgoingLight*=1.0-woodlandShade*mix(.12,.65,sceneryDaylight);
        #include <opaque_fragment>`);
  };
}
