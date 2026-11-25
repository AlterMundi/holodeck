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

export function useToroidalWaterDetail(material) {
  const clock = {value:0};
  material.customProgramCacheKey = () => 'toroidal-water-ripples';
  material.onBeforeCompile = shader => {
    useWorldPosition(shader);
    const depthVarying = 'varying float toroidalShoreDepth;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float shoreDepth;\n' + depthVarying)
      .replace('#include <project_vertex>', '#include <project_vertex>\ntoroidalShoreDepth = shoreDepth;');
    shader.uniforms.toroidalSeconds = clock;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float toroidalSeconds;\n' + depthVarying)
      .replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        vec3 p = toroidalWorld;
        float distanceToWater = length(vViewPosition);
        float holoShallow = 1.0 - smoothstep(0.0, 2.8, max(0.0,toroidalShoreDepth));
        float waveFade = 1.0 - smoothstep(28.0, 110.0, distanceToWater);
        // Medium swells survive after metre-scale normal detail falls below
        // pixel size. Filter each band in screen space at grazing angles.
        vec2 swellUV=ringTextureCoords(p)*vec2(.074,.044);
        vec2 driftUV=vec2(.023,-.013)*toroidalSeconds;
        float shoreward=ringNoise(swellUV+driftUV)-.5;
        vec2 crossing=vec2(swellUV.x*.52+swellUV.y,swellUV.y*.31-swellUV.x)*2.0;
        float offshore=ringNoise(crossing-driftUV*.83)-.5;
        vec2 crossingFootprint=fwidth(crossing);
        float crossingFilter=1.0-smoothstep(.31,.84,max(crossingFootprint.x,crossingFootprint.y));
        vec2 footprint=fwidth(swellUV);
        float swellFilter=1.0-smoothstep(.32,.9,max(footprint.x,footprint.y));
        float holoSwell=shoreward*swellFilter*.64+offshore*crossingFilter*.36;
        diffuseColor.rgb*=1.0+.38*holoSwell;
        normal=normalize(normal+mat3(viewMatrix)*vec3(holoSwell*.026,0.0,-holoSwell*.019));
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
