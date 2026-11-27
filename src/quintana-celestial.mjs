import {Body,Equator,Horizon,Observer} from 'astronomy-engine';
import {quintana} from './toroidal-solar-clock.mjs';

const observer=new Observer(quintana.latitude,quintana.longitude,620);
const rad=Math.PI/180;
const auKm=149597870.7;

function bodyAt(body,instant,radiusKm){
  const {ra,dec,dist}=Equator(body,instant,observer,true,true);
  const {azimuth,altitude}=Horizon(instant,observer,ra,dec);
  const az=azimuth*rad,alt=altitude*rad;
  return {direction:[-Math.cos(az)*Math.cos(alt),Math.sin(alt),Math.sin(az)*Math.cos(alt)],
    altitude,radius:Math.asin(radiusKm/(dist*auKm))};
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
