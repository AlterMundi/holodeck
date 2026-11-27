import {BEACON_CONTROLS} from './beacon-stations.mjs';
export {BEACON_CONTROLS} from './beacon-stations.mjs';

const panel='/harmonic_lab/';
const STATUS_LIMIT=128*1024;
const STATUS_LIFETIME=30000;
const weaverViews=Object.freeze({operator:{title:'Operación del laboratorio',surface:'operator'},router:{title:'Ruteos de Weaver',surface:'router'},rostro:{title:'Rostro',surface:'rostro'},harmocap:{title:'HarMoCAP',surface:'harmocap'}});

function stationHref({service,surface,view}){
  const query=new URLSearchParams({service,projection:surface});
  if(view)query.set('view',view);
  return panel+'?'+query;
}
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

export function summarizeBeaconStatus(value,service){
  const hosts=value?.hosts;
  if(!Array.isArray(hosts)||!hosts.length||hosts.length>8)return 'Estado sin confirmar.';
  const states=new Map();
  for(const host of hosts){
    let label;
    if(host?.online===false)label='Sin respuesta';
    else if(host?.online===true&&Array.isArray(host.services)){
      const entry=host.services.find(tool=>tool?.id===service);
      if(entry?.status==='ready')label='En marcha';
      else if(['queued','starting'].includes(host.job?.phase)&&
        Array.isArray(host.job?.services)&&host.job.services.includes(service))label='Iniciando';
      else if(entry?.installed===false)label='Sin instalar';
      else if(entry?.enabled===false)label='No seleccionado';
      else if(entry?.status==='stopped')label='Detenido';
    }
    label??='Sin confirmar';
    states.set(label,(states.get(label)??0)+1);
  }
  if(states.size===1&&hosts.length===1)return states.keys().next().value+'.';
  return [...states].map(([label,count])=>label+' ('+count+')').join(' · ');
}

async function readBeaconStatus(signal){
  const response=await fetch(panel+'api/status',{credentials:'same-origin',redirect:'manual',cache:'no-store',signal});
  if(response.status===401||response.status===403||response.type==='opaqueredirect')
    return {denied:true};
  if(!response.ok||!response.body||!response.headers.get('Content-Type')?.startsWith('application/json'))return null;
  const reader=response.body.getReader(),buffer=new Uint8Array(STATUS_LIMIT);
  let size=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)return JSON.parse(new TextDecoder().decode(buffer.subarray(0,size)));
      if(size+value.byteLength>buffer.length)return null;
      buffer.set(value,size);size+=value.byteLength;
    }
  }finally{await reader.cancel().catch(()=>{});}
}

export class BeaconControls{
  constructor(link,panel,{statusButton,statusText,routerLink,rostroLink,harmocapLink,operatorLink,readStatus=readBeaconStatus}={}){
    this.link=link;this.panel=panel;
    this.statusButton=statusButton;this.statusText=statusText;this.readStatus=readStatus;
    this.weaverLinks={router:routerLink,rostro:rostroLink,harmocap:harmocapLink,operator:operatorLink};
    for(const [view,anchor] of Object.entries(this.weaverLinks))if(anchor)anchor.onclick=event=>{
      if(this.current?.surface!=='weaver'||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      this.open({view});
    };
    if(statusButton)statusButton.onclick=()=>void this.checkStatus();
    this.stage=panel.querySelector('.beacon-panel-stage');
    this.title=panel.querySelector('h2');
    this.external=panel.querySelector('a');
    this.closeControl=panel.querySelector('button');
    this.beforeFrame=panel.querySelector('[data-beacon-before-frame]');
    this.afterFrame=panel.querySelector('[data-beacon-after-frame]');
    this.closeControl.onclick=()=>this.close();
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

  resetStatus(){
    clearTimeout(this.statusExpiry);
    this.statusRequest?.abort();
    this.statusRequest=null;
    if(this.statusText)this.statusText.textContent='';
    if(this.statusButton)this.statusButton.disabled=false;
  }

  async checkStatus(){
    const station=this.current;
    if(!station||this.statusRequest)return;
    this.resetStatus();
    const controller=new AbortController();
    this.statusRequest=controller;
    this.statusButton.disabled=true;
    this.statusText.textContent='Consultando al laboratorio…';
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(18000)]);
    let value;
    try{value=await this.readStatus(signal);}catch{}
    if(this.statusRequest!==controller)return;
    this.statusRequest=null;
    this.statusButton.disabled=false;
    this.statusText.textContent=value?.denied?'Se necesita acceso a Harmonic Lab.':
      summarizeBeaconStatus(value,station.service);
    this.statusExpiry=setTimeout(()=>this.resetStatus(),STATUS_LIFETIME);
  }

  setWorld(world){this.world=world;}

  open({native=false,view}={}){
    if(this.opened||!this.current||(view&&(!Object.hasOwn(weaverViews,view)||
      !this.weaverLinks[view]||this.current.surface!=='weaver')))return;
    const station=this.current;
    this.last=station;
    const {surface,title}=view?weaverViews[view]:station;
    this.title.textContent=title;
    this.external.href=(view?this.weaverLinks[view]:this.link).getAttribute('href');
    const world=this.world;
    const focused=Boolean(world?.renderer);
    this.panel.toggleAttribute?.('data-beacon-focused',focused);
    if(focused)native=false;
    this.panel.toggleAttribute?.('data-beacon-world',!!world);
    this.stage.replaceChildren();
    const connection=new AbortController();
    this.openConnection=connection;
    this.setNative(native);
    if(native)this.panel.show();
    else this.panel.showModal();
    if(!world){
      this.showOpeningStatus('Acercate a la mesa para usar los controles.');
      return;
    }
    void import('./beacon-native.mjs').then(({openBeaconNative})=>{
      if(connection.signal.aborted)return;
      this.projection=openBeaconNative(this.stage,{world,station:surface==='router'?{...station,service:'router'}:station,
        surface,title,readStatus:this.readStatus,focused});
      this.projection.focus();
    }).catch(()=>{
      if(!connection.signal.aborted)this.showOpeningStatus('No se pudieron abrir los controles de la mesa.');
    });
  }

  showOpeningStatus(text){
    const status=this.panel.ownerDocument.createElement('p');
    status.setAttribute?.('role','status');
    status.className='beacon-opening-status';
    status.textContent=text;
    this.stage.replaceChildren(status);
  }

  setNative(native){
    this.native=native;
    if(this.beforeFrame)this.beforeFrame.tabIndex=native?0:-1;
    if(this.afterFrame)this.afterFrame.tabIndex=native?0:-1;
  }

  fallback(){
    if(!this.opened||!this.native)return;
    this.setNative(false);
    this.panel.removeAttribute('data-beacon-hud');
    this.panel.close();
    this.panel.showModal();
    if(this.projection)this.projection.focus();
    else this.closeControl?.focus({preventScroll:true});
  }

  focusContent(){
    if(this.projection)this.projection.focus();
    else this.closeControl?.focus();
  }

  handleProjectionKey(event){
    if(!this.projection?.contains(event))return false;
    if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing){
      event.preventDefault();
      this.close();
    }
    else this.projection.key?.(event);
    event.stopImmediatePropagation();
    return true;
  }

  close(){
    if(!this.opened)return;
    this.setNative(false);
    this.panel.removeAttribute('data-beacon-hud');
    this.panel.removeAttribute('data-beacon-world');
    this.panel.removeAttribute('data-beacon-focused');
    this.openConnection?.abort();
    this.openConnection=null;
    this.disposeProjection();
    this.stage.replaceChildren();
    this.panel.close();
  }

  disposeProjection(){
    this.projecting=null;
    this.projection?.dispose();
    this.projection=null;
  }

  update(objects,position){
    this.projection?.draw();
    const next=nearbyBeaconControl(objects,position);
    if(next===this.current)return;
    this.close();
    this.resetStatus();
    this.current=next;
    if(this.last!==next)this.last=null;
    this.link.hidden=!next;
    for(const anchor of Object.values(this.weaverLinks))if(anchor)anchor.hidden=next?.surface!=='weaver';
    if(this.statusButton)this.statusButton.hidden=!next;
    if(!next){this.link.removeAttribute('href');return;}
    this.link.href=stationHref(next);
    this.link.textContent='Abrir '+next.title;
  }

  nearbyAction(){
    if(!this.current||this.opened)return null;
    const {position:{x,y,z},title}=this.current;
    return {anchor:{x,y:y+1.11,z},label:'Abrir '+title,key:'E'};
  }

  useNearby(event,objects,position,open=()=>this.open()){
    if(event.code!=='KeyE'||!this.current||this.opened||event.defaultPrevented||event.repeat||event.isComposing||
      event.altKey||event.ctrlKey||event.metaKey||
      event.composedPath().some(target=>target.matches?.('input,textarea,button,a,summary,select,[contenteditable]'))||
      nearbyBeaconControl(objects,position)!==this.current)return false;
    open();
    return this.opened;
  }

  reference(){
    if(this.current&&this.last===this.current)
      return {id:this.current.id,revision:this.current.revision};
    return null;
  }

  clear(){this.update(null,null);}
}
