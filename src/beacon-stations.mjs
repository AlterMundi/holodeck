const station=(id,title,service,x,z,view,surface)=>Object.freeze({id,title,service,view,surface,revision:1,
  position:Object.freeze({x,y:.1,z})});

export const BEACON_CONTROLS=Object.freeze([
  station('beacon-spatializer','Spatializer','audio',3.802,-.791,undefined,'spatializer'),
  station('beacon-weaver','Weaver','body',-3.758,2.659,undefined,'weaver'),
  station('beacon-guitar','H.B. Guitar','guitar',-4.49,-.35,undefined,'guitar'),
  station('beacon-shaper','Shaper','body',3.51,2.78,'instrumento','shaper'),
]);
