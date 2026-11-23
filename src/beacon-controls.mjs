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
  constructor(link,panel){
    this.link=link;this.panel=panel;
    this.stage=panel.querySelector('.beacon-panel-stage');
    this.title=panel.querySelector('h2');
    this.external=panel.querySelector('a');
    panel.querySelector('button').onclick=()=>this.close();
    panel.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.link.onclick=event=>{
      if(!this.current)return;
      this.last=this.current;
      if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      this.open();
    };
  }

  get opened(){return this.panel.open;}

  open(){
    if(this.opened||!this.current)return;
    this.title.textContent=this.current.title;
    const href=this.link.getAttribute('href');
    this.external.href=href;
    const frame=this.panel.ownerDocument.createElement('iframe');
    frame.title='Panel de '+this.current.title;
    frame.allow="camera 'none'; microphone 'none'";
    frame.src=href;
    this.stage.replaceChildren(frame);
    this.panel.showModal();
  }

  close(){
    if(!this.opened)return;
    this.stage.replaceChildren();
    this.panel.close();
  }

  update(objects,position){
    const next=nearbyBeaconControl(objects,position);
    if(next===this.current)return;
    this.close();
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
