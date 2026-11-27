import {quintana} from './toroidal-solar-clock.mjs';

// Linear-light horizon radiance shared by the sky, terrain and water.
// Low-altitude sun warms the air without tinting the entire sky orange.
export const toroidalAirColor = `
vec3 toroidalAir(float facing, float daylight) {
  float radial = clamp(facing,0.0,1.0);
  float square = radial*radial;
  float forward = square*square*radial;
  vec3 warm = mix(vec3(.98,.47,.24),vec3(.86,.69,.50),smoothstep(.28,.88,daylight));
  vec3 air = mix(vec3(.46,.57,.70),warm,forward*.72);
  return mix(vec3(.016,.024,.054),air,daylight);
}
`;

// The camera sky and the water use the same world-space equirectangular
// coordinates, seam and night visibility.
export const toroidalCosmosColor = `
vec3 toroidalCosmos(sampler2D panorama, vec3 direction, vec2 rotation) {
  const float latSin=${Math.sin(quintana.latitude*Math.PI/180).toFixed(9)};
  const float latCos=${Math.cos(quintana.latitude*Math.PI/180).toFixed(9)};
  float north=-direction.x, east=direction.z, up=direction.y;
  float meridian=up*latCos-north*latSin;
  vec3 eq=vec3(meridian*rotation.x-east*rotation.y,
    meridian*rotation.y+east*rotation.x,up*latSin+north*latCos);
  // ICRS to Galactic, with Galactic centre in the middle of ESO eso0932a.
  vec3 gal=vec3(dot(eq,vec3(-.05487556,-.87343709,-.48383502)),
    dot(eq,vec3(.49410943,-.44482963,.74698224)),
    dot(eq,vec3(-.86766615,-.19807637,.45598378)));
  vec2 uv=vec2(fract(.5-atan(gal.y,gal.x)/6.2831853),.5+asin(clamp(gal.z,-1.0,1.0))/3.1415927);
  return texture2D(panorama,uv).rgb;
}

float toroidalCosmosWindow(float elevation, float daylight) {
  return mix(.98,.27,smoothstep(.15,.82,daylight))*smoothstep(-.025,.16,elevation);
}
`;
