const panel='/harmonic_lab/';
const station=(id,title,service,x,z)=>Object.freeze({id,title,service,revision:1,
  position:Object.freeze({x,y:.1,z})});

export const BEACON_CONTROLS=Object.freeze([
  station('beacon-spatializer','Spatializer','audio',3.802,-.791),
  station('beacon-weaver','Weaver','body',-3.758,2.659),
]);

export function nearbyBeaconControl(objects,position){
  if(!position)return null;
  let distance=1.85,nearest=null;
  for(const entry of BEACON_CONTROLS){
    const visible=objects?.find(object=>object.id===entry.id&&object.kind==='workstation'&&object.revision===entry.revision);
    if(!visible)continue;
    const {x,y,z}=entry.position;
    const separation=Math.hypot(position.x-x,(position.y??y)-y,position.z-z);
    if(separation<distance){distance=separation;nearest=entry;}
  }
  return nearest;
}

export class BeaconControls{
  constructor(link){
    this.link=link;this.link.onclick=()=>{this.last=this.current;};
  }

  update(objects,position){
    const next=nearbyBeaconControl(objects,position);
    if(next===this.current)return;
    this.current=next;
    if(this.last!==next)this.last=null;
    this.link.hidden=!next;
    if(!next){this.link.removeAttribute('href');return;}
    this.link.href=panel+'?service='+next.service;
    this.link.textContent='Abrir '+next.title;
  }

  reference(){
    if(this.current&&this.last===this.current)
      return {id:this.current.id,revision:this.current.revision};
    return null;
  }

  clear(){this.update(null,null);}
}
