import {CONTENT_NODE,sameVisitPin,visitResponseMatches,knownVisitState,visitVersion} from './content-visits.mjs';

// One retained Nexus visit. Hiding this panel never destroys media, a draft,
// capture or native response polling. The trusted viewer owns that lifecycle.
export class ContentVisitor{
 constructor({document,window,base,say}){
  Object.assign(this,{document,window,base,say});this.entries=[];this.pending=new Map();this.disposed=false;this.lastContext=null;
  this.button=document.querySelector('#visit-near');this.panel=document.querySelector('#content-visit');
  this.button.onclick=()=>this.open(this.nearby?.id).catch(()=>say('No pude abrir esta presentación. Podés volver a intentarlo.'));
  document.querySelector('#visit-walk').onclick=()=>this.walk();
  this.receive=event=>{
   if(!this.frame||!this.entry)return;
   const value=event.data;if(!value||typeof value!=='object')return;
   let bytes;try{bytes=new TextEncoder().encode(JSON.stringify(value)).length;}catch{return;}if(bytes>65536)return;
   if(value.schema===`dm.holodeck-visit/ready-v${visitVersion(this.entry.pin)}`&&event.source===this.frame.contentWindow&&event.origin===this.window.location.origin&&value.visitId===this.visitId&&sameVisitPin(value.pin,this.entry.pin)){
    if(visitVersion(this.entry.pin)===2&&value.readiness!=='ready')return;
    if(!this.confirming){this.confirming=true;this.request('describe').then(result=>{
     if(!['describe','getContext','pauseAndFreeze','prepareClose'].every(method=>result?.capabilities?.[method]===true)||!knownVisitState(result.state)||(visitVersion(this.entry.pin)===2&&result.readiness!=='ready')){this.confirming=false;return;}
     clearTimeout(this.readyTimer);this.readyAcknowledged=true;this.readyResolve(result);
    },()=>{this.confirming=false;});}return;
   }
   const task=this.pending.get(value.id);if(!task||!visitResponseMatches(event,{source:this.frame.contentWindow,origin:this.window.location.origin,id:value.id,visitId:this.visitId,pin:this.entry.pin}))return;
   this.pending.delete(value.id);clearTimeout(task.timer);
   value.ok===true?task.resolve(value.result):task.reject(Error('Visit operation unavailable'));
  };
  window.addEventListener('message',this.receive);
  this.catalog=this.loadCatalog();
 }
 async loadCatalog(signature=null){
  this.catalogFlight=true;
  try{
   const response=await fetch(new URL('api/content-visits',this.base),{credentials:'same-origin',signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('Catalog unavailable');
   const value=await response.json();if(this.disposed)return;
   this.entries=Array.isArray(value.visits)?value.visits.slice(0,16):[];this.catalogSignature=signature;this.choices();
  }catch{/* Keep a currently open visit and the last known discovery on transient failure. */}
  finally{this.catalogFlight=false;}
 }
 syncNodes(nodes){
  if(!nodes||this.disposed||this.catalogFlight)return;
  const signature=JSON.stringify(Object.values(nodes).map(node=>[node.id,node.revision,node.deleted]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(signature!==this.catalogSignature)this.catalog=this.loadCatalog(signature);
 }
 update(position){
  this.nearby=null;let distance=5;
  if(position)for(const entry of this.entries){
   const at=entry.position||CONTENT_NODE.position,next=Math.hypot(position.x-at.x,position.z-at.z);
   if(next<distance){distance=next;this.nearby=entry;}
  }
  this.button.hidden=!this.frame&&!this.nearby;
  this.button.textContent=this.nearby&&this.nearby.id!==this.entry?.id
   ?(this.nearby.title?'Visitar '+this.nearby.title:'Visitar contenido')
   :this.frame&&this.nearby&&this.nearby.id===this.entry?.id&&!sameVisitPin(this.nearby.pin,this.entry.pin)?'Visitar nueva edición'
   :this.frame?'Volver al contenido':'Visitar contenido';
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
  if(!this.selector){
   const label=this.document.createElement('label');label.textContent='Contenido ';
   this.selector=this.document.createElement('select');this.selector.setAttribute('aria-label','Elegir contenido');
   this.selector.onchange=()=>this.open(this.selector.value).catch(()=>{if(this.entry)this.selector.value=this.entry.id;this.say('No pude cambiar de contenido. Conservé la visita anterior.');});
   label.append(this.selector);this.document.querySelector('#content-visit header').append(label);this.choiceLabel=label;
  }
  const entries=[...this.entries];if(this.entry&&!entries.some(entry=>entry.id===this.entry.id))entries.unshift(this.entry);
  this.selector.replaceChildren();
  entries.forEach((entry,index)=>{const option=this.document.createElement('option');option.value=entry.id;
   option.textContent=entry.title||(entry.pin.adapter==='interactive_3d'?'Modelo 3D':entry.pin.adapter==='video'?'Video':'Presentación')+` ${index+1}`;this.selector.append(option);});
  this.choiceLabel.hidden=entries.length<2;if(this.entry)this.selector.value=this.entry.id;
 }
 reveal(){this.panel.hidden=false;this.panel.classList.remove('is-walking');this.panel.removeAttribute('aria-hidden');this.panel.inert=false;}
 async open(selectedId){
  const selected=this.entries.find(entry=>entry.id===selectedId);
  if(this.frame&&(!selectedId||selectedId===this.entry?.id&&(!selected||sameVisitPin(selected.pin,this.entry.pin)))){this.reveal();this.frame.focus();return;}
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
   this.entry=entry;this.confirming=false;this.readyAcknowledged=false;this.lastContext=null;this.visitId=crypto.randomUUID();entryURL.searchParams.set('holodeck_visit',this.visitId);
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
  const frame=this.frame,entry=this.entry,visitId=this.visitId,pin={...entry.pin},ready=this.ready,
   requestedAt=Date.now(),panelVisible=!this.panel.classList.contains('is-walking');
  const current=()=>!this.disposed&&this.frame===frame&&this.entry===entry&&this.visitId===visitId&&sameVisitPin(this.entry.pin,pin);
  const node=entry.node||CONTENT_NODE.id,nodeRevision=entry.nodeRevision??null;
  const unavailable=()=>({node,nodeRevision,visitId,pin,requestedAt,contextUnavailable:true});
  if(this.readyAcknowledged===false)return unavailable();
  let deadline;
  try{
   await ready;if(!current())return unavailable();
   const context=await Promise.race([this.request('getContext'),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Viewer context unavailable')),2500);})]);if(!current()||!knownVisitState(context?.state))return unavailable();
   const captured={node,nodeRevision,visitId,pin,requestedAt,capturedAt:Date.now(),panelVisible,context,evidence:context.context_status==='playback-only'?'viewer-playback-only; no rendered-frame acknowledgment or human attention':'acknowledged-viewer-state; not human attention or shared playback'};
   if(new TextEncoder().encode(JSON.stringify(captured)).length>2200)return unavailable();
   this.lastContext=captured;return captured;
  }catch{return unavailable();}finally{clearTimeout(deadline);}
 }
 walk(){
  if(!this.frame)return;
  // Returning is navigation, not disposal. Never trap the visitor behind a
  // renderer/ready acknowledgment, recording, upload or unsaved draft.
  // Nexus retains its own capture, playback and pending-work lifecycle.
  this.minimize();this.say('Volviste al mundo. El contenido sigue abierto y podés retomarlo.');
 }
 close(){return this.walk();}
 minimize(){
  this.document.activeElement?.blur();this.window.focus?.();this.panel.classList.add('is-walking');this.panel.setAttribute('aria-hidden','true');this.panel.inert=true;
  // Keep a real layout for the existing renderer's freeze/restore contract.
  // Offscreen application state is never claimed to be visible to a human.
 }
 dispose(){
  this.disposed=true;clearTimeout(this.readyTimer);this.window.removeEventListener('message',this.receive);
  for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('Visit disposed'));}this.pending.clear();
  // Browser teardown owns the final frame destruction. Ordinary return never does.
 }
}
