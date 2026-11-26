import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, UnsignedByteType} from 'three';

// A small repeating relief pattern gives the gaps between tufts the read of
// dense short leaves. Generate it once with the local renderer; no asset fetch.
export function createMeadowCoverTexture(){
  const size=128,mask=size-1;
  const pixels=new Uint8Array(size*size).fill(122);
  let state=0x69ba1da3;
  const random=()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  };
  for(let blade=0;blade<1900;blade++){
    const x=random()*size,y=random()*size;
    const angle=random()*Math.PI*2;
    const dx=Math.cos(angle),dy=Math.sin(angle);
    const length=3+random()*8;
    const bend=random()*2-1;
    const tip=153+random()*65;
    const shade=59+random()*45;
    for(let i=0;i<=length;i++){
      const t=i/length;
      const px=Math.round(x+dx*i-dy*bend*t*t)&mask;
      const py=Math.round(y+dy*i+dx*bend*t*t)&mask;
      const at=py*size+px;
      pixels[at]=pixels[at]*.35+(shade+(tip-shade)*t)*.65;
    }
  }
  const texture=new DataTexture(pixels,size,size,RedFormat,UnsignedByteType);
  texture.name='Short meadow cover';
  texture.wrapS=texture.wrapT=RepeatWrapping;
  texture.magFilter=LinearFilter;
  texture.minFilter=LinearMipmapLinearFilter;
  texture.anisotropy=2;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

// Material detail is evaluated in absolute world coordinates so adjacent
// streamed tiles and different LODs cannot slide the grain or ripple phase.
const worldPosition = 'varying vec3 toroidalWorld;';
const surfaceNoise = `
  float ringHash(vec2 p) {
    vec3 h = fract(vec3(p.xyx) * .1031);
    h += dot(h, h.yzx + 33.33);
    return fract((h.x+h.y)*h.z);
  }
  float ringNoise(vec2 p) {
    vec2 i = floor(p), t = fract(p);
    vec2 f = t*t*(3.0-2.0*t);
    return mix(
      mix(ringHash(i),ringHash(i+vec2(1,0)),f.x),
      mix(ringHash(i+vec2(0,1)),ringHash(i+vec2(1,1)),f.x),
      f.y
    );
  }
  vec2 ringTextureCoords(vec3 p) {
    return vec2(dot(p,vec3(.81,.21,.58)),dot(p,vec3(-.16,.96,-.28)));
  }
`;
const worldVertex = `
  toroidalWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

function useWorldPosition(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + worldPosition)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + worldVertex);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
    '#include <common>\n' + worldPosition + surfaceNoise);
}

export function useToroidalRockDetail(material, {bedding=false,meadow=false} = {}) {
  const strata = bedding ? `
        // Strata have a fixed world-space dip, with abrasion at exposed edges.
        float plane = dot(p, vec3(.14,.53,-.08)) + .32*ringNoise(uv*.65);
        float band = abs(fract(plane)-.5);
        float joint = 1.0-smoothstep(.028,.125,band);
        float iron = smoothstep(.44,.70,ringNoise(uv*.58 + floor(plane)*.44));
        diffuseColor.rgb *= mix(vec3(1.0),
          (1.0-.32*joint)*mix(vec3(.89,.94,1.04),vec3(1.30,1.05,.79),iron),
          detailFade);
        roughnessFactor = clamp(roughnessFactor + detailFade*(.13*joint-.10*iron),.22,1.0);
  ` : '';
  material.customProgramCacheKey = () => bedding ? 'toroidal-rock-strata' : 'toroidal-rock-grain';
  material.onBeforeCompile = shader => {
    useWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      float detailFade = (1.0 - smoothstep(14.0, 80.0, length(vViewPosition)))${meadow ? ' * (1.0 - holoMeadowGround)' : ''};
      if (detailFade > 0.001) {
        vec3 p = toroidalWorld;
        vec2 uv = ringTextureCoords(p);
        float scaleColor = ringNoise(uv*.34)-.5;
        float chips = ringNoise(vec2(-uv.y,uv.x)*5.1 + 1.7*scaleColor)-.5;
        float sand = ringNoise(uv*24.0)-.5;
        float grain = .33*scaleColor + .20*chips + .11*sand;
        diffuseColor.rgb *= 1.0 + grain * detailFade;
        roughnessFactor = clamp(roughnessFactor + chips * detailFade * .13, .2, 1.0);
        ${strata}
      }
      ${meadow ? 'roughnessFactor = mix(mix(roughnessFactor, holoMeadowRoughness, holoMeadow), holoTrailRoughness, holoTrailMask);' : ''}
    `);
  };
}

// Analytic value and gradient share eight lattice samples. A 3D field
// avoids compressing a fixed 2D projection along parts of the torus.
const waterSwell = `
  float ringHash(vec2 p);
  float waterHash(vec3 cell) {
    vec3 p = fract(cell * vec3(.1031,.1030,.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  vec3 waterLightField(vec2 p) {
    vec2 cell = floor(p), t = fract(p);
    vec2 f = t*t*(3.0-2.0*t), slope = 6.0*t*(1.0-t);
    vec2 low = vec2(ringHash(cell),ringHash(cell+vec2(1,0)));
    vec2 high = vec2(ringHash(cell+vec2(0,1)),ringHash(cell+vec2(1,1)));
    vec2 along = mix(low,high,f.y);
    return vec3(mix(along.x,along.y,f.x)-.5,
      (along.y-along.x)*slope.x,mix(high.x-low.x,high.y-low.y,f.x)*slope.y);
  }
  vec4 waterField(vec3 p) {
    vec3 cell = floor(p), t = fract(p);
    vec3 f = t*t*t*(t*(6.0*t-15.0)+10.0);
    vec3 slope = 30.0*t*t*(t-1.0)*(t-1.0);
    vec4 low = vec4(waterHash(cell), waterHash(cell+vec3(1,0,0)),
      waterHash(cell+vec3(0,1,0)), waterHash(cell+vec3(1,1,0)));
    vec4 high = vec4(waterHash(cell+vec3(0,0,1)), waterHash(cell+vec3(1,0,1)),
      waterHash(cell+vec3(0,1,1)), waterHash(cell+vec3(1,1,1)));
    vec4 corners = mix(low,high,f.z);
    vec2 alongX = mix(corners.xz,corners.yw,f.x);
    vec2 acrossZ = mix((high-low).xz,(high-low).yw,f.x);
    vec3 grad = vec3(mix(corners.y-corners.x,corners.w-corners.z,f.y),
      alongX.y-alongX.x,mix(acrossZ.x,acrossZ.y,f.y))*slope;
    return vec4(mix(alongX.x,alongX.y,f.y)-.5,grad);
  }
`;

export function useToroidalWaterDetail(material,lightweight) {
  const clock = {value:0};
  material.customProgramCacheKey = () => 'toroidal-water-ripples';
  material.onBeforeCompile = shader => {
    useWorldPosition(shader);
    const depthVarying = 'varying float toroidalShoreDepth;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float shoreDepth;\n' + depthVarying)
      .replace('#include <project_vertex>', '#include <project_vertex>\ntoroidalShoreDepth = shoreDepth;');
    shader.uniforms.toroidalSeconds = clock;
    shader.uniforms.toroidalLightWater = lightweight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float toroidalSeconds; uniform bool toroidalLightWater;\n' + depthVarying + waterSwell)
      .replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        vec3 p = toroidalWorld;
        float distanceToWater = length(vViewPosition);
        float holoShallow = 1.0 - smoothstep(0.0, 2.8, max(0.0,toroidalShoreDepth));
        float waveFade = 1.0 - smoothstep(28.0, 110.0, distanceToWater);
        // Filter with the largest world-space pixel dimension near the
        // horizon. Unresolved slopes become roughness instead of stripes.
        vec3 swellPoint=p*.092;
        float footprint=max(length(dFdx(swellPoint)),length(dFdy(swellPoint)));
        float swellFilter=1.0-smoothstep(.23,.78,footprint);
        float holoSwell=0.0;
        if(swellFilter > .001) {
          vec3 drift=vec3(.021,.008,-.016)*toroidalSeconds;
          vec4 swell;
          if(toroidalLightWater) {
            vec3 lightSwell=waterLightField(ringTextureCoords(swellPoint+drift));
            swell=vec4(lightSwell.x,vec3(.81,.21,.58)*lightSwell.y+vec3(-.16,.96,-.28)*lightSwell.z);
          } else {
            swell=waterField(swellPoint+drift);
          }
          holoSwell=swell.x*swellFilter;
          vec3 slope=mat3(viewMatrix)*swell.yzw;
          slope-=normal*dot(normal,slope);
          normal=normalize(normal-slope*swellFilter*.036);
        }
        if(toroidalLightWater) {
          roughnessFactor=mix(roughnessFactor,.366,1.0-swellFilter);
        } else if(swellFilter < .999) {
          float roughnessSquared=roughnessFactor*roughnessFactor;
          roughnessFactor=sqrt(sqrt(roughnessSquared*roughnessSquared+.0048*(1.0-swellFilter)));
        }
        if (waveFade > 0.001) {
          vec2 uv = ringTextureCoords(p);
          float eddies = ringNoise(uv*.21);
          vec2 drift = vec2(.38,-.19) * toroidalSeconds;
          float a = ringNoise(uv*3.2 + drift + eddies*2.8) - .5;
          float b = ringNoise(vec2(uv.y,-uv.x)*4.4 - drift*.77 + eddies*4.1) - .5;
          normal = normalize(normal + mat3(viewMatrix) * vec3(a, (a+b)*.4, b) * waveFade * .052);
          float shallows = holoShallow * waveFade;
          diffuseColor.rgb *= 1.0 + (eddies-.5)*waveFade*.055 + shallows*(.13 + .16*a);
        }
      `);
  };
  return seconds => {clock.value=seconds;};
}
