import {celestialPole} from './toroidal-solar-clock.mjs';

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
  const vec3 pole=vec3(${celestialPole.map(value=>value.toFixed(9)).join(',')});
  direction=direction*rotation.x+cross(pole,direction)*rotation.y+pole*dot(pole,direction)*(1.0-rotation.x);
  float longitude=fract(atan(direction.z,direction.x)/6.2831853+.5);
  vec2 uv=vec2(longitude,.5+asin(clamp(direction.y,-1.0,1.0))/3.1415927);
  vec3 deep=texture2D(panorama,uv).rgb;
  return mix(vec3(.012,.005,.04),deep,smoothstep(0.0,.035,min(longitude,1.0-longitude)));
}

float toroidalCosmosWindow(float elevation, float daylight) {
  return mix(.98,.15,smoothstep(.15,.82,daylight))*smoothstep(.045,.48,elevation);
}
`;
