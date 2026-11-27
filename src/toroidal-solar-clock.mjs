const radians=Math.PI/180;
// José de la Quintana, Córdoba (official locality coordinates).
export const quintana=Object.freeze({latitude:-31.80349305,longitude:-64.41885653});
const latitude=quintana.latitude*radians;
const longitude=quintana.longitude;
const tau=2*Math.PI;
const utcDayMs=86400000;
const j2000=Date.UTC(2000,0,1,12);
// At the arrival plaza the local north points along -X and up along +Y.
export const celestialPole=Object.freeze([-Math.cos(latitude),Math.sin(latitude),0]);
const phase=(instant,period)=>tau*((instant%period)/period);

// US Naval Observatory mean sidereal approximation. UTC is a sufficient
// substitute for UT1 for the movement of this authored celestial panorama.
export function celestialRotation(instant=Date.now()){
  const days=(instant-j2000)/utcDayMs;
  const hours=18.697375+24.065709824279*days+longitude/15;
  const angle=tau*(hours%24)/24;
  return [Math.cos(angle),Math.sin(angle)];
}

export function cloudWind(instant=Date.now()){
  const low=phase(instant,73*60000),high=phase(instant,119*60000);
  return [7*Math.cos(low),7*Math.sin(low),8*Math.cos(high),8*Math.sin(high)];
}
const solarFadeEnd=-.15;
const ease=value=>{
  const n=Math.max(0,Math.min(1,value));
  return n*n*(3-2*n);
};
const daylightAt=up=>ease((up-solarFadeEnd)/.37);
const skyDirection=[-.27,.72,-.64];
const skyDirectionLength=Math.hypot(...skyDirection);
const nightDirection=Object.freeze(skyDirection.map(axis=>axis/skyDirectionLength));

// Reuse the scene's shadowed key only after sunlight has faded. This
// three-quarter sky light stays on the same side of the radial path
// through the night and does not imply a second visible sun.
export function nightSkyKey(solar){
  if(solar.daylight>0)return null;
  return {direction:nightDirection,color:0xa4b8ff,intensity:.55*ease((solarFadeEnd-solar.direction[1])/.25)};
}

// NOAA Global Monitoring Laboratory's fractional-year approximation,
// expressed as east/up/north so each radial frame has a consistent day.
export function argentineSun(instant=new Date()){
  const year=instant.getUTCFullYear();
  const yearStart=Date.UTC(year,0,1);
  const days=(Date.UTC(year+1,0,1)-yearStart)/86400000;
  const day=(instant.getTime()-yearStart)/86400000;
  const phase=2*Math.PI*(day-.5)/days;
  const equation=229.18*(.000075+.001868*Math.cos(phase)-.032077*Math.sin(phase)
    -.014615*Math.cos(2*phase)-.040849*Math.sin(2*phase));
  const declination=.006918-.399912*Math.cos(phase)+.070257*Math.sin(phase)
    -.006758*Math.cos(2*phase)+.000907*Math.sin(2*phase)
    -.002697*Math.cos(3*phase)+.00148*Math.sin(3*phase);
  const utcMinutes=(day-Math.floor(day))*1440;
  const hourAngle=((utcMinutes+equation+4*longitude)/4-180)*radians;
  const east=-Math.cos(declination)*Math.sin(hourAngle);
  const up=Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.cos(hourAngle);
  const north=Math.cos(latitude)*Math.sin(declination)-Math.sin(latitude)*Math.cos(declination)*Math.cos(hourAngle);
  return {direction:[east,up,north],daylight:daylightAt(up)};
}
