import {CONTENT_NODE,sameVisitPin,visitResponseMatches,knownVisitState,visitVersion} from './content-visits.mjs';

// One retained Nexus visit. Hiding this panel never destroys media, a draft,
// capture or native response polling. The trusted viewer owns that lifecycle.
export class ContentVisitor{
 constructor({document,window,base,say}){
  Object.assign(this,{document,window,base,say});this.entries=[];this.pending=new Map();this.disposed=false;this.lastContext=null;
  this.button=document.querySelector('#visit-near');this.panel=document.querySelector('#content-visit');
  this.button.onclick=()=>this.open().catch(()=>say('No pude abrir esta presentación. Podés volver a intentarlo.'));
  document.querySelector('#visit-walk').onclick=()=>this.walk().catch(()=>say('No pude confirmar el estado de la presentación. La dejé abierta.'));
  document.querySelector('#visit-close').onclick=()=>this.close().catch(()=>say('No pude confirmar una salida segura. La presentación sigue abierta.'));
  this.receive=event=>{
   if(!this.frame||!this.entry)return;
   const value=event.data;if(!value||typeof value!=='object')return;
   let bytes;try{bytes=new TextEncoder().encode(JSON.stringify(value)).length;}catch{return;}if(bytes>65536)return;
   if(value.schema===`dm.holodeck-visit/ready-v${visitVersion(this.entry.pin)}`&&event.source===this.frame.contentWindow&&event.origin===this.window.location.origin&&value.visitId===this.visitId&&sameVisitPin(value.pin,this.entry.pin)){
    if(visitVersion(this.entry.pin)===2&&value.readiness!=='ready')return;
    if(!this.confirming){this.confirming=true;this.request('describe').then(result=>{
     if(!['describe','getContext','pauseAndFreeze','prepareClose'].every(method=>result?.capabilities?.[method]===true)||!knownVisitState(result.state)||(visitVersion(this.entry.pin)===2&&result.readiness!=='ready')){this.confirming=false;return;}
     clearTimeout(this.readyTimer);this.readyResolve(result);
    },()=>{this.confirming=false;});}return;
   }
   const task=this.pending.get(value.id);if(!task||!visitResponseMatches(event,{source:this.frame.contentWindow,origin:this.window.location.origin,id:value.id,visitId:this.visitId,pin:this.entry.pin}))return;
   this.pending.delete(value.id);clearTimeout(task.timer);
   value.ok===true?task.resolve(value.result):task.reject(Error('Visit operation unavailable'));
  };
  window.addEventListener('message',this.receive);
  this.catalog=fetch(new URL('api/content-visits',base),{credentials:'same-origin',signal:AbortSignal.timeout(5000)})
   .then(async response=>{if(!response.ok)throw Error('Catalog unavailable');const value=await response.json();this.entries=Array.isArray(value.visits)?value.visits.slice(0,8):[];this.choices();})
   .catch(()=>{this.entries=[];});
 }
 update(position){
  const nearby=position&&Math.hypot(position.x-CONTENT_NODE.position.x,position.z-CONTENT_NODE.position.z)<=5;
  this.button.hidden=!this.frame&&(!nearby||!this.entries.length);
  this.button.textContent=this.frame?'Volver al contenido':'Visitar contenido';
 }
 request(method){
  if(!this.frame||!this.entry||this.disposed||this.pending.size>=4)return Promise.reject(Error('Visit unavailable'));
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Visit acknowledgment unavailable'));},8000);
   this.pending.set(id,{resolve,reject,timer});
   this.frame.contentWindow.postMessage({schema:`dm.holodeck-visit/request-v${visitVersion(this.entry.pin)}`,id,visitId:this.visitId,method,pin:this.entry.pin},this.window.location.origin);
  });
 }
 choices(){
  if(this.entries.length<2)return;
  const label=this.document.createElement('label');label.textContent='Contenido ';
  this.selector=this.document.createElement('select');this.selector.setAttribute('aria-label','Elegir contenido');
  this.entries.forEach((entry,index)=>{const option=this.document.createElement('option');option.value=entry.id;option.textContent=(entry.pin.adapter==='interactive_3d'?'Modelo 3D':entry.pin.adapter==='video'?'Video':'Presentación')+` ${index+1}`;this.selector.append(option);});
  this.selector.onchange=()=>this.open(this.selector.value).catch(()=>{if(this.entry)this.selector.value=this.entry.id;this.say('No pude cambiar de contenido. Conservé la visita anterior.');});
  label.append(this.selector);this.document.querySelector('#content-visit header').append(label);
 }
 reveal(){this.panel.hidden=false;this.panel.classList.remove('is-walking');this.panel.removeAttribute('aria-hidden');this.panel.inert=false;}
 async open(selectedId){
  if(this.frame&&(!selectedId||selectedId===this.entry?.id)){this.reveal();this.frame.focus();return;}
  if(this.opening)return;this.opening=true;
  try{
   await this.catalog;if(this.selector)this.selector.disabled=true;const entry=this.entries.find(value=>value.id===selectedId)||(!selectedId&&this.entries[0]);if(!entry){this.say('No hay contenido disponible para tu acceso en este lugar.');return;}
   const descriptorURL=new URL(entry.descriptor,this.window.location.origin),entryURL=new URL(entry.entry,this.window.location.origin);
   if([descriptorURL,entryURL].some(url=>url.origin!==this.window.location.origin||!url.pathname.startsWith('/nexus/')))throw Error('Use the selected viewer');
   const response=await fetch(descriptorURL,{credentials:'same-origin',signal:AbortSignal.timeout(5000)});
   if(!response.ok){if(this.selector&&this.entry)this.selector.value=this.entry.id;this.say(response.status===401||response.status===403?'Este contenido necesita tu acceso a Nexus. Volvé a entrar desde Apps.':'No pude recuperar esta edición del contenido.');return;}
   const descriptor=await response.json();if(!sameVisitPin(descriptor.pin,entry.pin))throw Error('Content edition changed');
   if(this.frame){
    await this.ready;const state=await this.request('prepareClose');
    if(state?.canClose!==true||!knownVisitState(state.state)||Object.values(state.state).some(Boolean)){
     if(this.selector)this.selector.value=this.entry.id;this.reveal();this.say('Terminá el trabajo pendiente en esta visita antes de cambiar de contenido.');return;
    }
    for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('Visit changed'));}this.pending.clear();
    this.frame.remove();this.frame=null;
   }
   this.entry=entry;this.confirming=false;this.lastContext=null;this.visitId=crypto.randomUUID();entryURL.searchParams.set('holodeck_visit',this.visitId);
   if(this.selector){this.selector.value=entry.id;const option=Array.from(this.selector.options).find(value=>value.value===entry.id);if(option&&typeof descriptor.title==='string')option.textContent=descriptor.title.slice(0,100);}
   this.document.querySelector('#visit-title').textContent=typeof descriptor.title==='string'?descriptor.title.slice(0,160):'Contenido';
   this.reveal();
   const frame=this.document.createElement('iframe');frame.title='Contenido y conversación en Nexus';frame.allow='microphone; autoplay';frame.allowFullscreen=true;frame.referrerPolicy='same-origin';
   this.frame=frame;this.ready=new Promise((resolve,reject)=>{this.readyResolve=resolve;this.readyTimer=setTimeout(()=>reject(Error('Viewer did not load')),visitVersion(entry.pin)===2?40000:15000);});
   frame.src=entryURL.href;this.document.querySelector('#visit-stage').append(frame);
   try{await this.ready;}catch{this.say('El contenido está abierto, pero no pude conectar su contexto con el mundo. Conservé su ventana.');}
  }finally{this.opening=false;if(this.selector){this.selector.disabled=false;if(this.entry)this.selector.value=this.entry.id;}}
 }
 async context(){
  if(!this.frame||!this.entry)return null;
  try{
   await this.ready;const context=await this.request('getContext');if(!knownVisitState(context?.state))throw Error('Viewer state unavailable');
   const captured={node:CONTENT_NODE.id,visitId:this.visitId,pin:this.entry.pin,capturedAt:Date.now(),panelVisible:!this.panel.classList.contains('is-walking'),context,evidence:context.context_status==='playback-only'?'viewer-playback-only; no rendered-frame acknowledgment or human attention':'acknowledged-viewer-state; not human attention or shared playback'};
   if(new TextEncoder().encode(JSON.stringify(captured)).length>2200)return {node:CONTENT_NODE.id,pin:this.entry.pin,contextUnavailable:true};
   this.lastContext=captured;return captured;
  }catch{return {node:CONTENT_NODE.id,pin:this.entry.pin,contextUnavailable:true};}
 }
 async walk(){
  await this.ready;const value=await this.request('getContext');
  if(!knownVisitState(value?.state))throw Error('Viewer state unavailable');
  if(value.state.recording){this.say('Terminá la grabación en la presentación antes de volver al mundo.');return;}
  this.minimize();this.say('La presentación sigue abierta. Podés volver desde su botón.');
 }
 async close(){
  await this.ready;const value=await this.request('prepareClose');
  if(value?.canClose!==true||!knownVisitState(value.state)||value.state.dirty||value.state.recording||value.state.processing||value.state.playing){this.say('La presentación todavía no confirmó una pausa segura. La dejé abierta.');return;}
  this.minimize();this.say('Presentación pausada. Conservé su lugar para volver.');
 }
 minimize(){
  this.document.activeElement?.blur();this.panel.classList.add('is-walking');this.panel.setAttribute('aria-hidden','true');this.panel.inert=true;
  // Keep a real layout for the existing renderer's freeze/restore contract.
  // Offscreen application state is never claimed to be visible to a human.
 }
 dispose(){
  this.disposed=true;clearTimeout(this.readyTimer);this.window.removeEventListener('message',this.receive);
  for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('Visit disposed'));}this.pending.clear();
  // Browser teardown owns the final frame destruction. Ordinary return never does.
 }
}
