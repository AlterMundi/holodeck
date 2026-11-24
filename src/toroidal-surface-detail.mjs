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

export function useToroidalRockDetail(material) {
  material.customProgramCacheKey = () => 'toroidal-rock-grain';
  material.onBeforeCompile = shader => {
    useWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      float detailFade = 1.0 - smoothstep(14.0, 80.0, length(vViewPosition));
      if (detailFade > 0.001) {
        vec3 p = toroidalWorld;
        vec2 uv = ringTextureCoords(p);
        float scaleColor = ringNoise(uv*.34)-.5;
        float chips = ringNoise(vec2(-uv.y,uv.x)*5.1 + 1.7*scaleColor)-.5;
        float sand = ringNoise(uv*24.0)-.5;
        float grain = .33*scaleColor + .20*chips + .11*sand;
        diffuseColor.rgb *= 1.0 + grain * detailFade;
        roughnessFactor = clamp(roughnessFactor + chips * detailFade * .13, .2, 1.0);
      }
    `);
  };
}

export function useToroidalWaterDetail(material) {
  const clock = {value:0};
  material.customProgramCacheKey = () => 'toroidal-water-ripples';
  material.onBeforeCompile = shader => {
    useWorldPosition(shader);
    shader.uniforms.toroidalSeconds = clock;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float toroidalSeconds;')
      .replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        vec3 p = toroidalWorld;
        float distanceToWater = length(vViewPosition);
        float waveFade = 1.0 - smoothstep(28.0, 110.0, distanceToWater);
        if (waveFade > 0.001) {
          vec2 uv = ringTextureCoords(p);
          float eddies = ringNoise(uv*.21);
          vec2 drift = vec2(.38,-.19) * toroidalSeconds;
          float a = ringNoise(uv*3.2 + drift + eddies*2.8) - .5;
          float b = ringNoise(vec2(uv.y,-uv.x)*4.4 - drift*.77 + eddies*4.1) - .5;
          normal = normalize(normal + mat3(viewMatrix) * vec3(a, (a+b)*.4, b) * waveFade * .052);
          diffuseColor.rgb *= 1.0 + (eddies-.5)*waveFade*.055;
        }
      `);
  };
  return seconds => {clock.value=seconds;};
}
