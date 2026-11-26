import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType,
} from 'three';

const size=128;
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
const fraction=value=>value-Math.floor(value);
const wrap=(value,length)=>(value%length+length)%length;
const wave=value=>Math.sin(2*Math.PI*value);

function plateSeed(column,row) {
  const seed=Math.imul(wrap(column,16)+1,0x7feb352d)^Math.imul(wrap(row,5)+1,0x846ca68b);
  return ((seed^(seed>>>16))>>>0)/4294967296;
}

export function pineBarkTexture(){
  const surface=new Float32Array(size*size);
  const pixels=new Uint8Array(size*size*4);
  const at=(x,y)=>wrap(y,size)*size+wrap(x,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size;
    const across=16*(u+.012*wave(3*v+2*u)+.006*wave(7*v-5*u));
    const column=Math.floor(across);
    const stagger=plateSeed(column,0);
    const along=5*(v+.19*stagger+.02*wave(u*7+v*4));
    const row=Math.floor(along);
    const seed=plateSeed(column,row);
    const width=.083+.09*seed;
    const edge=Math.min(fraction(across),1-fraction(across));
    const plate=ease((edge-.025)/width);
    const seam=ease((Math.min(fraction(along),1-fraction(along))-.022)/.082);
    const split=1-.26*(1-ease(Math.abs(fraction(across)-(.34+.28*seed))/.09))*ease(fraction(along)*1.6);
    const fibre=.5+.5*wave(45*u+v*7+.4*wave(v*3+u*8));
    surface[at(x,y)]=.07+plate*split*(.16+.24*seam+.15*seed)+.04*fibre;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const atPixel=at(x,y)*4;
    const height=surface[at(x,y)];
    const slopeX=surface[at(x+1,y)]-surface[at(x-1,y)];
    const slopeY=surface[at(x,y+1)]-surface[at(x,y-1)];
    pixels[atPixel]=Math.round(255*height);
    pixels[atPixel+1]=Math.round(255*clamp(.5+slopeX));
    pixels[atPixel+2]=Math.round(255*clamp(.5+slopeY));
    pixels[atPixel+3]=255;
  }
  const texture=new DataTexture(pixels,size,size,RGBAFormat,UnsignedByteType);
  texture.name='Pine bark plates';
  texture.wrapS=texture.wrapT=RepeatWrapping;
  texture.magFilter=LinearFilter;
  texture.minFilter=LinearMipmapLinearFilter;
  texture.anisotropy=2;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

export function usePineBark(material,atlas){
  const compile=material.onBeforeCompile;
  const key=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>key()+'-bark-plates';
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    atlas.value??=pineBarkTexture();
    shader.uniforms.pineBark=atlas;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 pineBarkChart;\nattribute vec2 pineBarkUV;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        pineBarkChart=pineBarkUV;
        #ifdef USE_INSTANCING
          if(pineBarkChart.y>=0.0){
            vec3 root=instanceMatrix[3].xyz;
            pineBarkChart.x+=fract(dot(root.xz,vec2(.017,.079)));
            pineBarkChart.y=pineBarkChart.y*length(instanceMatrix[1].xyz)/2.4+
              fract(dot(root.xz,vec2(.041,.029)));
          }
        #endif`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec2 pineBarkChart;\nuniform sampler2D pineBark;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 barkDX=dFdx(pineBarkChart),barkDY=dFdy(pineBarkChart);
        vec3 barkPositionX=dFdx(-vViewPosition),barkPositionY=dFdy(-vViewPosition);
        float barkDetail=1.0-smoothstep(.034,.19,max(length(barkDX),length(barkDY)));
        vec3 barkTexel=vec3(.42,.5,.5);
        if(pineBarkChart.y>=0.0&&barkDetail>.001){
          barkTexel=textureGrad(pineBark,pineBarkChart,barkDX,barkDY).rgb;
          vec3 barkColor=mix(vec3(.47,.40,.35),vec3(1.34,1.28,1.18),smoothstep(.10,.66,barkTexel.r));
          diffuseColor.rgb*=mix(vec3(1.0),barkColor,barkDetail);
        }`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(pineBarkChart.y>=0.0&&barkDetail>.001){
          vec2 relief=(barkTexel.gb-.5)*(64.0*.018*barkDetail);
          vec3 tangentX=cross(barkPositionY,normal);
          vec3 tangentY=cross(normal,barkPositionX);
          float determinant=dot(barkPositionX,tangentX);
          if(abs(determinant)>1e-9){
            vec3 gradient=dot(relief,barkDX)*tangentX+dot(relief,barkDY)*tangentY;
            normal=normalize(abs(determinant)*normal-sign(determinant)*gradient);
          }
        }`);
  };
}
