import {Body,Equator,Horizon,Observer,Rotation_HOR_EQJ} from 'astronomy-engine';
import {terrainCoordinates,terrainFrame} from './toroidal-terrain.mjs';
import {quintana,daylightAt} from './toroidal-solar-clock.mjs';

const observer=new Observer(quintana.latitude,quintana.longitude,620);
const rad=Math.PI/180;
const auKm=149597870.7;

function bodyAt(body,instant,radiusKm,site=observer){
  const {ra,dec,dist}=Equator(body,instant,site,true,true);
  const {azimuth,altitude}=Horizon(instant,site,ra,dec,'normal');
  const az=azimuth*rad,alt=altitude*rad;
  return {direction:[-Math.cos(az)*Math.cos(alt),Math.sin(alt),Math.sin(az)*Math.cos(alt)],
    altitude,dist,radius:Math.asin(radiusKm/(dist*auKm))};
}

export function quintanaCelestial(instant){
  return {sun:bodyAt(Body.Sun,instant,695700),moon:bodyAt(Body.Moon,instant,1737.4)};
}

export function solarObscuration({sun,moon}){
  if(sun.altitude<-.3)return 0;
  const r=sun.radius,R=moon.radius;
  const separation=2*Math.asin(Math.min(1,Math.hypot(...sun.direction.map((axis,i)=>axis-moon.direction[i]))*.5));
  if(separation>=r+R)return 0;
  if(separation<=Math.abs(r-R))return Math.min(1,(R/r)**2);
  const d=separation;
  const x=(d*d+r*r-R*R)/(2*d);
  const y=d-x;
  const lens=r*r*Math.acos(x/r)+R*R*Math.acos(y/R)-d*Math.sqrt(Math.max(0,r*r-x*x));
  return lens/(Math.PI*r*r);
}

const longitudeAt=degrees=>((degrees+180)%360+360)%360-180;

// Plaza coordinates u=0, v=.25 align with -X north, +Y up and +Z east.
// Reflect the Earth latitude across each pole. The antipodal meridian and
// both horizontal axes then flip together, keeping world sight lines continuous.
export function ringEarthLocation(u,v){
  const unfolded=longitudeAt(quintana.latitude+360*(v-.25));
  const poleSide=Math.abs(unfolded)>90?-1:1;
  const latitude=poleSide===1?unfolded:Math.sign(unfolded)*(180-Math.abs(unfolded));
  return {latitude,longitude:longitudeAt(quintana.longitude+360*u+(poleSide===1?0:180)),poleSide};
}

export function toroidalSky(instant,position){
  const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
  const {latitude,longitude,poleSide}=ringEarthLocation(u,v);
  const frame=terrainFrame(u,v),up=frame.up;
  const east=frame.alongRing.map(value=>value*poleSide);
  const north=frame.aroundTube.map(value=>value*poleSide);
  const site=new Observer(latitude,longitude,620);
  const sun=bodyAt(Body.Sun,instant,695700,site),moon=bodyAt(Body.Moon,instant,1737.4,site);
  const world=([negNorth,zenith,localEast])=>up.map((value,i)=>-negNorth*north[i]+zenith*value+localEast*east[i]);
  const horizonToEquatorial=Rotation_HOR_EQJ(instant,site).rot;
  const equatorial=up.flatMap((_,row)=>up.map((axis,col)=>north[col]*horizonToEquatorial[0][row]
    -east[col]*horizonToEquatorial[1][row]+up[col]*horizonToEquatorial[2][row]));
  const towardSun=sun.direction.map((axis,i)=>axis*sun.dist-moon.direction[i]*moon.dist);
  const scale=Math.hypot(...towardSun);
  const moonLight=towardSun.map(axis=>axis/scale);
  const illuminated=(1-moon.direction.reduce((sum,axis,i)=>sum+axis*moonLight[i],0))/2;
  const eclipse=solarObscuration({sun,moon});
  return {latitude,longitude,up,equatorial,sun:world(sun.direction),moon:world(moon.direction),
    radii:[sun.radius,moon.radius],moonLight:world(moonLight),illuminated,eclipse,
    direction:[sun.direction[2]*poleSide,sun.direction[1],-sun.direction[0]*poleSide],
    daylight:daylightAt(Math.sin(sun.altitude*rad))*(1-.98*eclipse**2)};
}
