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
