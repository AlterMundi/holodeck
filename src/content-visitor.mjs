import {CONTENT_NODE,validateContentNodes,sameVisitEdition,sameVisitPin,visitResponseMatches,knownVisitState,visitVersion,visitEntryMatches,contextVisitSnapshotMatches} from './content-visits.mjs';
import {ExhibitionIndex} from './exhibition-index.mjs';
import {GALLERY_STAGES} from './gallery-display.mjs';

const ROOM_VISIT_REACH=2.25;

// One retained Nexus visit. Hiding this panel never destroys media, a draft,
// capture or native response polling. The trusted viewer owns that lifecycle.
export class ContentVisitor{
 constructor({document,window,base,say,scoped=false,roomId=null,onCatalog=()=>{}}){
  Object.assign(this,{document,window,base,say,scoped,roomId,onCatalog});this.entries=[];this.nodes=[CONTENT_NODE];this.catalogGeneration=0;this.pending=new Map();this.disposed=false;this.lastContext=null;this.catalogRenewAt=Infinity;
  this.button=document.querySelector('#visit-near');this.panel=document.querySelector('#content-visit');
  this.closeButtons=[document.querySelector('#visit-end'),document.querySelector('#visit-end-near')].filter(Boolean);
  this.closing=false;
  for(const button of this.closeButtons)button.onclick=()=>this.endVisit();
  this.loading=document.querySelector('#visit-loading');this.roomGeneration=0;this.renewScopedCatalog=false;
  this.visitRoom=null;this.parked=false;this.accessGeneration=0;this.roomSyncPending=false;
  this.index=new ExhibitionIndex(document,selected=>this.chooseEntry(selected,{exact:true}));
  this.button.onclick=()=>this.launch();
  document.querySelector('#visit-walk').onclick=()=>this.walk();
  this.receive=event=>{
   if(!this.frame||!this.entry)return;
   const value=event.data;if(!value||typeof value!=='object')return;
   let bytes;try{bytes=new TextEncoder().encode(JSON.stringify(value)).length;}catch{return;}if(bytes>65536)return;
   if(value.schema===`dm.holodeck-visit/ready-v${visitVersion(this.entry.pin)}`&&event.source===this.frame.contentWindow&&event.origin===this.window.location.origin&&value.visitId===this.visitId&&sameVisitPin(value.pin,this.entry.pin)){
    if(!this.canUseFrame()||visitVersion(this.entry.pin)>=2&&value.readiness!=='ready')return;
    if(!this.confirming){this.confirming=true;this.request('describe').then(result=>{
     if(!['describe','getContext','pauseAndFreeze','prepareClose'].every(method=>result?.capabilities?.[method]===true)||!knownVisitState(result.state)||(visitVersion(this.entry.pin)>=2&&result.readiness!=='ready')){this.confirming=false;return;}
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
 chooseEntry(selected,{exact=this.scoped}={}){
  const selection=exact?{nodeRevision:selected?.nodeRevision??null,expectedPin:selected?.pin??null}:undefined;
  return this.open(selected?.id,selection).catch(()=>this.say('No pude abrir esta presentación. Podés volver a intentarlo.'));
 }
 launch({native=false}={}){
  if(this.button.hidden||this.roomSyncPending||this.closing)return;
  if(this.scoped&&!this.nearby&&!(this.frame&&this.hasCurrentEntry())){this.index.open({native});return;}
  return this.chooseEntry(this.nearby||this.entry);
 }
 async loadCatalog(signature=null){
  if(this.roomSyncPending)return false;
  this.catalogFlight=true;
  const generation=++this.catalogGeneration;
  try{
   const response=await fetch(new URL(this.scoped?'api/space/content-visits?exhibitHistory=1':'api/content-visits',this.base),{credentials:'same-origin',signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Object.assign(Error('Catalog unavailable'),{status:response.status});
   const value=await response.json();if(this.disposed||generation!==this.catalogGeneration)return false;
   this.nodes=this.scoped?[]:validateContentNodes(value.nodes);this.entries=Array.isArray(value.visits)?value.visits.slice(0,16).map(entry=>{const node=this.nodes.find(node=>node.id===entry.node);return {...entry,title:entry.title||node?.title,position:entry.position||node?.position};}):[];this.catalogSignature=signature;
   this.renewScopedCatalog=this.scoped&&(value.revalidate===true||value.gallery===true||this.entries.some(entry=>entry.galleryDisplay===true));
   this.catalogRenewAt=this.renewScopedCatalog?performance.now()+20000:Infinity;
   this.reconcileVisitAccess();
   this.choices();
   this.index.update(this.scoped||this.index.opened?this.entries:[]);this.onCatalog(this.entries);return true;
  }catch(error){
   if(this.scoped&&!this.disposed&&generation===this.catalogGeneration){
    this.entries=[];this.nearby=null;this.choices();this.catalogRenewAt=this.renewScopedCatalog?performance.now()+20000:Infinity;this.onCatalog([]);
    this.index.update([],{invalidate:[401,403,404].includes(error?.status)});
    this.reconcileVisitAccess();
   }
   return false;
  }
  finally{if(generation===this.catalogGeneration)this.catalogFlight=false;}
 }
 syncNodes(nodes){
  if(!nodes||this.disposed||this.catalogFlight)return;
  const signature=JSON.stringify(Object.values(nodes).map(node=>[node.id,node.revision,node.deleted]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(signature!==this.catalogSignature)this.catalog=this.loadCatalog(signature);
 }
 update(position){
  this.updateEndControl();
  this.nearby=null;let distance=this.scoped?ROOM_VISIT_REACH:5;
  if(position)for(const entry of this.entries){
   if(entry.catalogOnly)continue;
   const at=entry.position||CONTENT_NODE.position,next=Math.hypot(position.x-at.x,position.z-at.z,this.scoped?(position.y??at.y)-at.y:0);
   if(next<distance){distance=next;this.nearby=entry;}
  }
  const canResume=this.frame&&this.canUseFrame();
  const browse=this.scoped&&this.entries.length>0&&!canResume&&!this.nearby;
  this.button.hidden=!canResume&&!this.nearby&&!browse;
  if(browse){
   this.button.setAttribute('aria-haspopup','dialog');
   this.button.textContent='Exposiciones';return;
  }
  this.button.removeAttribute('aria-haspopup');
  this.button.textContent=this.nearby&&this.nearby.id!==this.entry?.id
   ?(this.nearby.title?'Visitar '+this.nearby.title:'Visitar contenido')
   :this.frame&&this.nearby&&this.nearby.id===this.entry?.id&&!sameVisitPin(this.nearby.pin,this.entry.pin)?'Visitar nueva edición'
   :canResume?'Volver al contenido':'Visitar contenido';
 }

 refreshScopedCatalog(){
  if(!this.disposed&&!this.catalogFlight&&performance.now()>=this.catalogRenewAt)
   this.catalog=this.loadCatalog();
 }

 currentEntry(entry=this.entry,visitRoom=this.visitRoom){
  if(this.roomId!==visitRoom)return null;
  return this.entries.find(value=>sameVisitEdition(value,entry))??null;
 }
 hasCurrentEntry(entry=this.entry,visitRoom=this.visitRoom){return Boolean(this.currentEntry(entry,visitRoom));}

 reconcileVisitAccess(){
  if(!this.scoped||!this.frame||this.visitRoom!==this.roomId)return;
  const available=this.currentEntry();
  if(available&&available.id!==this.entry.id)this.entry=available;
  if(!available&&!this.parked)this.accessGeneration++;
  this.parked=this.roomId!==null&&!available;
  if(!available)this.minimize();
 }

 canUseFrame(){
  return !this.roomSyncPending&&!this.parked&&this.roomId===this.visitRoom&&(!this.scoped||this.hasCurrentEntry());
 }

 suspendRoom(){
  if(!this.scoped||this.roomId===null||this.roomSyncPending)return;
  this.roomSyncPending=true;this.catalogGeneration++;this.catalogFlight=false;this.opening=false;
  this.entries=[];this.nearby=null;this.lastContext=null;
  if(this.selector)this.selector.disabled=false;
  this.reconcileVisitAccess();
  this.button.hidden=true;this.index.close({resume:false});this.index.update([]);this.onCatalog([]);
 }

 confirmRoom(){
  this.roomSyncPending=false;
  this.catalog=this.loadCatalog();
 }

 reference(){
  return this.readyAcknowledged&&this.canUseFrame()?{id:this.entry.node,revision:this.entry.nodeRevision}:null;
 }

 async openNode(nodeId,{expectedRevision=null}={}){
  if(this.scoped)return this.open(null,{nodeId,nodeRevision:expectedRevision});
  await this.catalog;
  const matching=this.entries.filter(value=>value.node===nodeId&&(expectedRevision===null||value.nodeRevision===expectedRevision));
  const entry=matching.find(value=>value.id===this.entry?.id)??matching[0];
  if(!entry){
    this.say(expectedRevision!==null&&this.entries.some(value=>value.node===nodeId)?
      'Este contenido cambió de lugar o edición. Volvé a elegirlo en el mundo.':
      'No hay contenido disponible para tu acceso en este lugar.');
    return;
  }
  return this.open(entry.id,{nodeRevision:entry.nodeRevision,expectedPin:entry.pin});
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
  const entries=[...this.entries];if(!this.scoped&&this.entry&&!entries.some(entry=>entry.id===this.entry.id))entries.unshift(this.entry);
  this.selector.replaceChildren();
  entries.forEach((entry,index)=>{const option=this.document.createElement('option');option.value=entry.id;
   option.textContent=entry.title||(entry.pin.adapter==='interactive_3d'?'Modelo 3D':entry.pin.adapter==='video'?'Video':visitVersion(entry.pin)===3?'Contexto':'Presentación')+` ${index+1}`;this.selector.append(option);});
  this.choiceLabel.hidden=entries.length<2;if(this.entry)this.selector.value=this.entry.id;
 }
 reveal(){this.panel.hidden=false;this.panel.classList.remove('is-walking');this.panel.removeAttribute('aria-hidden');this.panel.inert=false;this.updateEndControl();}
 showLoading(message=''){
  if(!this.loading)return;
  this.loading.textContent=message;
  this.loading.hidden=!message;
 }
 removeFrame(){
  clearTimeout(this.readyTimer);this.readyReject?.(Error('Visit changed'));this.readyReject=null;
  for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('Visit changed'));}
  this.pending.clear();this.frame?.remove();this.frame=null;this.showLoading();
 }
 galleryTargets(models,scene,position){
  const targets=new Map();
  if(!this.scoped||!position)return targets;
  const displayed=models.targets();
  for(const entry of this.entries){
   if(entry.galleryDisplay!==true||!Object.hasOwn(GALLERY_STAGES,entry.id)||!entry.position||Math.hypot(position.x-entry.position.x,
      (position.y??entry.position.y)-entry.position.y,position.z-entry.position.z)>=ROOM_VISIT_REACH)continue;
   for(const [model,display] of displayed){
    if(display.id===entry.id&&display.nodeRevision===entry.nodeRevision&&sameVisitPin(display.pin,entry.pin))
     targets.set(model,entry);
   }
   for(const suffix of ['sign-front','sign-back','edition-front','edition-back']){
    const plaque=scene?.querySelector('#'+entry.id+'-'+suffix);
    if(plaque?.getContainer)targets.set(plaque.getContainer(),entry);
   }
  }
  return targets;
 }
 async openGallery(entry){
  if(this.scoped&&entry?.galleryDisplay===true)
   return this.open(entry.id,{nodeRevision:entry.nodeRevision,expectedPin:entry.pin});
 }
 async open(selectedId,{nodeRevision=null,expectedPin=null,nodeId=null}={}){
  if(this.roomSyncPending||this.closing)return;
  if(this.parked){
   this.say('La visita anterior sigue guardada en este navegador. Volvé a su sala cuando recuperes el acceso.');
   return;
  }
  const selected=this.entries.find(entry=>entry.id===selectedId);
  if(!nodeId&&((nodeRevision!==null&&selected?.nodeRevision!==nodeRevision)||(expectedPin&&!sameVisitPin(selected?.pin,expectedPin)))){this.say('Este contenido cambió de lugar o edición. Volvé a elegirlo en el mundo.');return;}
  if(!this.scoped&&this.frame&&(!selectedId||selectedId===this.entry?.id&&(!selected||sameVisitPin(selected.pin,this.entry.pin)))){this.reveal();this.frame.focus();return;}
  if(this.opening)return;
  const opening={};this.opening=opening;
  const visitRoom=this.roomId;
  const current=()=>!this.disposed&&this.opening===opening&&!this.roomSyncPending&&this.roomId===visitRoom;
  try{
   if(this.scoped){
    if(!await this.loadCatalog()){if(this.frame)this.minimize();this.say('No pude confirmar tu acceso a esta exposición.');return;}
   }else await this.catalog;
   if(!current())return;
   if(this.parked){this.say('No pude confirmar el acceso a la visita que quedó abierta.');return;}
   if(this.selector)this.selector.disabled=true;
   let entry;
   if(nodeId)entry=this.entries.find(value=>value.node===nodeId&&
     (nodeRevision===null?!value.catalogOnly:value.nodeRevision===nodeRevision));
   else if(this.scoped&&selected)entry=this.currentEntry(selected,visitRoom);
   else entry=this.entries.find(value=>value.id===selectedId)||(!selectedId&&this.entries.find(value=>!value.catalogOnly));
   if(!entry&&(selected||nodeId&&nodeRevision!==null&&this.entries.some(value=>value.node===nodeId))){
    this.say('Este contenido cambió de lugar o edición. Volvé a elegirlo en el mundo.');return;
   }
   if(!entry){
    if(this.scoped&&this.frame&&!this.hasCurrentEntry())this.minimize();
    this.say('No hay contenido disponible para tu acceso en este lugar.');return;
   }
   if((nodeRevision!==null&&entry.nodeRevision!==nodeRevision)||(expectedPin&&!sameVisitPin(entry.pin,expectedPin))){this.say('Este contenido cambió de lugar o edición. Volvé a elegirlo en el mundo.');return;}
   const descriptorURL=new URL(entry.descriptor,this.window.location.origin);
   let entryURL=new URL(entry.entry,this.window.location.origin);
   if([descriptorURL,entryURL].some(url=>url.origin!==this.window.location.origin||!url.pathname.startsWith('/nexus/')))throw Error('Use the selected viewer');
   const response=await fetch(descriptorURL,{credentials:'same-origin',signal:AbortSignal.timeout(5000)});
   if(!current())return;
   if(!response.ok){
    const denied=response.status===401||response.status===403;
    if(this.scoped&&this.frame){
     if(denied&&this.roomId!==null&&entry.id===this.entry.id&&
        entry.nodeRevision===this.entry.nodeRevision&&sameVisitPin(entry.pin,this.entry.pin)){
      this.entries=this.entries.filter(value=>value.id!==entry.id);
      this.reconcileVisitAccess();this.choices();this.index.update(this.entries);this.onCatalog(this.entries);
     }else this.minimize();
    }
    if(this.selector&&this.entry)this.selector.value=this.entry.id;
    this.say(denied?'Este contenido necesita tu acceso a Nexus. Volvé a entrar desde Apps.':'No pude recuperar esta edición del contenido.');
    return;
   }
   const descriptor=await response.json();if(!current())return;
   if(!sameVisitPin(descriptor.pin,entry.pin))throw Error('Content edition changed');
   const version=visitVersion(entry.pin);
   const verifyScoped=this.scoped;
   if(verifyScoped||version===3){
    const kind=version===2?entry.pin.adapter:version===3?'context':'narrated_visual';
    if(descriptor.schema!==`dm.holodeck-visit/descriptor-v${version}`||descriptor.kind!==kind||
       !visitEntryMatches(descriptor.entry,entry.pin))throw Error('Selected edition unavailable');
    if(verifyScoped)entryURL=new URL(descriptor.entry,this.window.location.origin);
   }
   if(this.parked)return;
   if(this.scoped&&this.frame&&!this.frame.inert&&this.canUseFrame()&&entry.id===this.entry?.id&&entry.nodeRevision===this.entry.nodeRevision&&sameVisitPin(entry.pin,this.entry.pin)){
     this.reveal();this.frame.focus();return;
   }
   if(this.frame){
    if(!this.frame.inert){
     await this.ready;if(!current()||!this.canUseFrame())return;
     const state=await this.request('prepareClose');if(!current()||!this.canUseFrame())return;
     if(state?.canClose!==true||!knownVisitState(state.state)||Object.values(state.state).some(Boolean)){
      if(this.selector)this.selector.value=this.entry.id;this.reveal();this.say('Terminá el trabajo pendiente en esta visita antes de cambiar de contenido.');return;
     }
    }
    this.removeFrame();
   }
   this.entry=entry;this.visitRoom=this.roomId;this.confirming=false;this.readyAcknowledged=false;this.lastContext=null;this.visitId=crypto.randomUUID();entryURL.searchParams.set('holodeck_visit',this.visitId);
   if(this.selector){this.selector.value=entry.id;const option=Array.from(this.selector.options).find(value=>value.value===entry.id);if(option&&typeof descriptor.title==='string')option.textContent=entry.galleryDisplay||entry.catalogOnly?entry.title+' · '+descriptor.title.slice(0,75):descriptor.title.slice(0,100);}
   this.title=typeof descriptor.title==='string'?descriptor.title.slice(0,160):'Contenido';
   this.document.querySelector('#visit-title').textContent=this.title;
   this.reveal();
   const frame=this.document.createElement('iframe');frame.title='Contenido y conversación en Nexus';frame.allow='microphone; autoplay';frame.allowFullscreen=true;frame.referrerPolicy='same-origin';
   if(verifyScoped){frame.inert=true;this.showLoading('Abriendo la edición…');}
   this.frame=frame;this.ready=new Promise((resolve,reject)=>{this.readyResolve=resolve;this.readyReject=reject;this.readyTimer=setTimeout(()=>reject(Error('Viewer did not load')),visitVersion(entry.pin)>=2?40000:15000);});
   frame.src=entryURL.href;this.document.querySelector('#visit-stage').append(frame);this.updateEndControl();
   try{await this.ready;if(current()&&this.frame===frame&&verifyScoped&&this.hasCurrentEntry()){frame.inert=false;this.showLoading();}}
   catch{if(current()){
    if(verifyScoped)this.showLoading('No pude confirmar esta edición. Podés volver al mundo o elegir otra.');
    else this.say('El contenido está abierto, pero no pude conectar su contexto con el mundo. Conservé su ventana.');
   }}
  }finally{if(current()){this.opening=false;if(this.selector){this.selector.disabled=false;if(this.entry)this.selector.value=this.entry.id;}}}
 }
 changeRoom(scoped,roomId=null){
  this.roomGeneration++;this.opening=false;this.roomId=roomId;
  if(this.parked)this.minimize();
  else{
   this.removeFrame();this.entry=null;this.visitRoom=null;this.readyAcknowledged=false;
  }
  if(this.selector)this.selector.disabled=false;
  this.nearby=null;this.lastContext=null;this.entries=[];this.scoped=scoped;
  this.renewScopedCatalog=false;this.catalogRenewAt=Infinity;this.onCatalog([]);
  this.index.update([]);this.button.hidden=true;this.panel.hidden=true;
  this.confirmRoom();
 }
 async allowLeaveRoom(){
  if(this.closing)return false;
  if(this.parked)return true;
  if(!this.frame&&!this.opening)return true;
  if(this.frame?.inert)return true;
  if(this.readyAcknowledged&&!this.opening){
   try{
    const reply=await this.request('prepareClose');
    if(this.canEnd(reply))return true;
   }catch{/* Leave the visit in place if its work state could not be confirmed. */}
   if(this.parked)return true;
  }
  this.say('Retomá la visita y terminá el trabajo pendiente antes de cambiar de sala.');
  return false;
 }
 async context(){
  if(!this.frame||!this.entry||!this.canUseFrame())return null;
  const frame=this.frame,entry=this.entry,visitId=this.visitId,pin={...entry.pin},ready=this.ready,
   generation=this.roomGeneration,accessGeneration=this.accessGeneration,scoped=this.scoped,visitRoom=this.visitRoom,
   requestedAt=Date.now(),panelVisible=!this.panel.classList.contains('is-walking');
  const authorized=()=>!this.disposed&&!this.roomSyncPending&&this.roomGeneration===generation&&
   this.accessGeneration===accessGeneration&&(!scoped||this.hasCurrentEntry(entry,visitRoom));
  const current=()=>authorized()&&this.frame===frame&&this.visitId===visitId&&sameVisitEdition(this.entry,entry);
  const node=entry.node||CONTENT_NODE.id,nodeRevision=entry.nodeRevision??null;
  const unavailable=()=>authorized()?{node,nodeRevision,visitId,pin,requestedAt,contextUnavailable:true}:null;
  if(this.readyAcknowledged===false)return unavailable();
  let deadline;
  try{
   await ready;if(!current())return unavailable();
   const context=await Promise.race([this.request('getContext'),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Viewer context unavailable')),2500);})]);if(!current())return unavailable();
   if(!knownVisitState(context?.state)||!contextVisitSnapshotMatches(context,pin))return unavailable();
   const retainedContext=visitVersion(pin)===3?{pin:{...pin},context_status:'acknowledged-client-view',visit_id:context.visit_id,view_revision:context.view_revision,focus:context.focus,selection:context.selection===null?null:{kind:context.selection.kind,object_id:context.selection.object_id},state:Object.fromEntries(['dirty','recording','processing','playing'].map(key=>[key,context.state[key]]))}:context;
   const captured={node,nodeRevision,visitId,pin,requestedAt,capturedAt:Date.now(),panelVisible,context:retainedContext,evidence:visitVersion(pin)===3?'acknowledged-nexus-visit-reference; not canonical native-ingress capture or human attention':context.context_status==='playback-only'?'viewer-playback-only; no rendered-frame acknowledgment or human attention':'acknowledged-viewer-state; not human attention or shared playback'};
   if(new TextEncoder().encode(JSON.stringify(captured)).length>2200)return unavailable();
   this.lastContext=captured;return captured;
  }catch{return unavailable();}finally{clearTimeout(deadline);}
 }
 isOpeningOverWorld(){
  return this.opening&&this.frame?.inert===true&&!this.panel.classList.contains('is-walking');
 }
 updateEndControl(){
  const walking=this.panel.classList.contains('is-walking');
  for(const button of this.closeButtons){
   const hidden=!this.frame||(button.id==='visit-end-near'&&!walking);
   if(button.hidden!==hidden)button.hidden=hidden;
   if(button.disabled!==this.closing)button.disabled=this.closing;
  }
 }
 canEnd(reply){
  return reply?.canClose===true&&knownVisitState(reply.state)&&!Object.values(reply.state).some(Boolean);
 }
 async endVisit(){
  const frame=this.frame;
  if(!frame||this.closing)return;
  this.closing=true;this.updateEndControl();
  try{
   if(!frame.inert){
    if(!this.readyAcknowledged){
     this.say('No pude confirmar que sea seguro cerrar el contenido. Podés retomarlo.');
     return;
    }
    const reply=await this.request('prepareClose');
    if(this.frame!==frame||this.disposed)return;
    if(!this.canEnd(reply)){
     const state=reply?.state;
     this.say(state?.dirty?'Retomá el contenido y guardá o descartá el borrador antes de cerrarlo.':
      state?.recording||state?.processing?'Retomá el contenido para terminar la grabación o el envío.':
      'El contenido todavía está en uso. Retomalo antes de cerrarlo.');
     return;
    }
   }
   this.opening=false;this.removeFrame();
   this.entry=null;this.visitRoom=null;this.parked=false;this.readyAcknowledged=false;this.lastContext=null;
   if(this.selector)this.selector.disabled=false;
   this.panel.hidden=true;this.minimize();
   this.say('Contenido cerrado.',{transient:true});
  }catch{
   if(this.frame===frame&&!this.disposed)this.say('No pude confirmar el cierre. La visita sigue disponible.');
  }finally{
   this.closing=false;this.updateEndControl();
  }
 }
 walk(){
  if(!this.frame)return;
  // Returning is navigation, not disposal. Never trap the visitor behind a
  // renderer/ready acknowledgment, recording, upload or unsaved draft.
  // Nexus retains its own capture, playback and pending-work lifecycle.
  this.minimize();this.say('Volviste al mundo. El contenido sigue abierto y podés retomarlo.',{transient:true});
 }
 close(){return this.walk();}
 minimize(){
  this.document.activeElement?.blur();this.window.focus?.();this.panel.classList.add('is-walking');this.panel.setAttribute('aria-hidden','true');this.panel.inert=true;
  this.updateEndControl();
  // Keep a real layout for the existing renderer's freeze/restore contract.
  // Offscreen application state is never claimed to be visible to a human.
 }
 dispose(){
  this.index.close({resume:false});this.disposed=true;clearTimeout(this.readyTimer);this.window.removeEventListener('message',this.receive);
  for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(Error('Visit disposed'));}this.pending.clear();
  // Browser teardown owns the final frame destruction. Ordinary return never does.
 }
}
