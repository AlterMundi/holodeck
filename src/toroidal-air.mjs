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
