import {BEACON_CONTROLS} from './beacon-stations.mjs';
export {BEACON_CONTROLS} from './beacon-stations.mjs';

const panel='/harmonic_lab/';
const STATUS_LIMIT=128*1024;
const STATUS_LIFETIME=30000;
const weaverViews=Object.freeze({router:{title:'Ruteos de Weaver',surface:'router'},rostro:{title:'Rostro',surface:'rostro'}});
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
  constructor(link,panel,{statusButton,statusText,routerLink,rostroLink,readStatus=readBeaconStatus}={}){
    this.link=link;this.panel=panel;
    this.statusButton=statusButton;this.statusText=statusText;this.readStatus=readStatus;
    this.weaverLinks={router:routerLink,rostro:rostroLink};
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

  open({native=false,view}={}){
    if(this.opened||!this.current||(view&&(!this.weaverLinks[view]||this.current.surface!=='weaver')))return;
    this.last=this.current;
    const {surface,title}=view?weaverViews[view]:this.current;
    this.title.textContent=title;
    const href=(view?this.weaverLinks[view]:this.link).getAttribute('href');
    this.external.href=href;
    const frame=this.panel.ownerDocument.createElement('iframe');
    frame.title='Panel de '+title;
    frame.allow="camera 'none'; microphone 'none'";
    const query=new URLSearchParams(href.split('?')[1]);
    if(surface)query.set('projection',surface);
    frame.src=panel+'?'+query;
    this.frameEvents?.abort();
    this.frameEvents=new AbortController();
    const {signal}=this.frameEvents;
    const ownerWindow=this.panel.ownerDocument.defaultView;
    ownerWindow?.addEventListener('message',async event=>{
      const data=event.data;
      if(signal.aborted||event.origin!==ownerWindow.location.origin||
          event.source!==frame.contentWindow||data?.surface!==surface)return;
      if(data.type==='harmonic-lab-host-changed'){
        this.disposeProjection();
        return;
      }
      if(data.type!=='harmonic-lab-ready'||typeof data.host!=='string'||!data.host||
          typeof data.csrf!=='string'||!data.csrf)return;
      const session=surface==='router'&&/^[0-9a-f]{16}$/.test(data.session)?data.session:undefined;
      if(this.projecting?.host===data.host&&this.projecting?.session===session)return;
      this.disposeProjection();
      const attempt={host:data.host,session};
      this.projecting=attempt;
      try{
        const {openBeaconProjection}=await import('./beacon-projection.mjs');
        if(signal.aborted||this.projecting!==attempt)return;
        this.projection=openBeaconProjection(this.stage,{host:data.host,surface,title,csrf:data.csrf,session,
          onReady:()=>{
            this.projection.focus();
            frame.remove();
            this.frame=null;
          }});
      }catch{
        if(this.projecting===attempt)this.disposeProjection();
      }
    },{signal});
    frame.addEventListener?.('load',()=>{
      try{
        frame.contentDocument?.addEventListener('keydown',event=>{
          if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing&&
              !frame.contentDocument.querySelector('dialog[open]')){
            event.preventDefault();
            this.close();
          }
        },{signal});
      }catch{} // The lab may legitimately redirect to the identity provider.
    },{signal});
    this.frame=frame;
    this.stage.replaceChildren(frame);
    this.setNative(native);
    if(native)this.panel.show();
    else this.panel.showModal();
  }

  setNative(native){
    this.native=native;
    if(this.beforeFrame)this.beforeFrame.tabIndex=native?0:-1;
    if(this.afterFrame)this.afterFrame.tabIndex=native?0:-1;
  }

  fallback(){
    if(!this.opened||!this.native)return;
    const frameHadFocus=this.panel.ownerDocument.activeElement===this.frame;
    this.setNative(false);
    this.panel.removeAttribute('data-beacon-hud');
    this.panel.close();
    this.panel.showModal();
    if(this.projection)this.projection.focus();
    else (frameHadFocus?this.frame:this.closeControl)?.focus({preventScroll:true});
  }

  focusContent(){
    if(this.projection)this.projection.focus();
    else this.frame?.focus();
  }

  handleProjectionKey(event){
    if(!this.projection?.contains(event))return false;
    if(event.key==='Escape'){
      event.preventDefault();
      this.close();
    }
    event.stopImmediatePropagation();
    return true;
  }

  close(){
    if(!this.opened)return;
    this.setNative(false);
    this.panel.removeAttribute('data-beacon-hud');
    this.frameEvents?.abort();
    this.frameEvents=null;
    this.disposeProjection();
    this.frame=null;
    this.stage.replaceChildren();
    this.panel.close();
  }

  disposeProjection(){
    this.projecting=null;
    this.projection?.dispose();
    this.projection=null;
  }

  update(objects,position){
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
    const target=new URLSearchParams({service:next.service});
    if(next.view)target.set('view',next.view);
    this.link.href=panel+'?'+target;
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
