import {DataTexture, LinearFilter, RedFormat, UnsignedByteType} from 'three';
import {TOROIDAL_TERRAIN,terrainPosition} from './toroidal-terrain.mjs';

const SIZE=256;
const WEST=TOROIDAL_TERRAIN.majorRadius-112;
const SOUTH=-16;
const SPAN=152;
const METRES=SPAN/SIZE;

export const woodlandShadeShader=`
  uniform sampler2D woodlandShadeMap;
  float woodlandShadeAt(vec2 worldXZ) {
    vec2 uv=(worldXZ-vec2(${WEST.toFixed(1)},${SOUTH.toFixed(1)}))/${SPAN.toFixed(1)};
    if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return 0.0;
    return texture2D(woodlandShadeMap,uv).r;
  }
`;

function smooth(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}

export function createWoodlandShade(trees){
  const pixels=new Uint8Array(SIZE*SIZE);
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
        const at=row*SIZE+col;
        pixels[at]=Math.max(pixels[at],Math.round(255*Math.min(.78,canopy+contact)*fade));
      }
    }
  }
  const texture=new DataTexture(pixels,SIZE,SIZE,RedFormat,UnsignedByteType);
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
        woodlandShade=woodlandShadeAt(shadeRoot.xz);`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\n'+varying)
      .replace('#include <opaque_fragment>',`
        outgoingLight*=1.0-woodlandShade*mix(.12,.65,sceneryDaylight);
        #include <opaque_fragment>`);
  };
}
