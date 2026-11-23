import {RemoteDocumentWrapper} from '@mml-io/mml-web';
import {RoomSceneCache} from './room-scene-cache.mjs';
import {nearestCreationPosition} from './world-layout.mjs';
import { Networked3dWebExperienceClient, DefaultVirtualJoystickPlugin } from '@mml-io/3d-web-experience-client';
import { ThreeJSWorldRenderer } from '@mml-io/3d-web-threejs';
import { DirectionalLight } from 'three';
import { WORKSHOP, workshopColour } from './workshop.mjs';
import { saveIntent, loadIntent, archiveIntent, sameActor, nativeRetryRoute } from './client-intents.mjs';
import { NativeAvatarLayer } from './native-avatar.mjs';
import {PublicWorldPicker,WorldIndication} from './world-indication.mjs';
import { ContentVisitor } from './content-visitor.mjs';
import {pickedRepresentationVisit} from './node-representations.mjs';
import { PlayableHUD } from './playable-hud.mjs';
import { AppliedGeometryProbe } from './applied-geometry.mjs';
import { SharedConversationHost } from './shared-conversation-host.mjs';
import { WorldAudio } from './world-audio.mjs';
import {WorldHistory} from './world-history.mjs';
import { snapshotMayApply, sameRequest } from './client-order.mjs';
import { WorldNotice } from './client-feedback.mjs';
import {doorLocation,readSpace,showSpaceLinks} from './space-travel.mjs';
const base=new URL('./',document.baseURI);
const url=path=>new URL(path,base);
const socket=path=>{const target=url(path);target.protocol=location.protocol==='https:'?'wss:':'ws:';return target.href;};
const animations={airAnimationFileUrl:url('assets/anim_air.glb').href,idleAnimationFileUrl:url('assets/anim_idle.glb').href,
  jogAnimationFileUrl:url('assets/anim_jog.glb').href,sprintAnimationFileUrl:url('assets/anim_run.glb').href,doubleJumpAnimationFileUrl:url('assets/anim_double_jump.glb').href};
const touchControls={
  mount(container,experience){
    this.holder=document.createElement('div');this.holder.className='touch-controls';container.append(this.holder);
    this.delegate=new DefaultVirtualJoystickPlugin({radius:58,innerRadius:19});
    this.delegate.mount(this.holder,experience);
    for(const button of this.holder.querySelectorAll('button')){button.textContent='Saltar';button.setAttribute('aria-label','Saltar');}
  },
  dispose(){this.delegate?.dispose();this.holder?.remove();}
};
const activeSpace=await readSpace().catch(()=>null);
if(activeSpace&&activeSpace.id!=='outside'&&activeSpace.live!==1)startInterior(activeSpace);
else startWorld(activeSpace);

function startInterior(space){
  document.body.classList.add('inside-house');
  document.querySelector('#hud h1').textContent=space.title;
  document.querySelector('#people').textContent=space.level===0?'Planta baja':
    space.level<0?`Subsuelo ${-space.level}`:`Piso ${space.level}`;
  const notice=new WorldNotice(document.querySelector('#notice'));
  const visitor=new ContentVisitor({document,window,base,scoped:true,
    say:(message,options)=>notice.show(message,options)});
  let exhibitRevision=space.exhibitRevision===undefined?null:String(space.exhibitRevision);
  const exhibitObserver=new MutationObserver(()=>{
    const current=document.querySelector('#house-exhibit')?.getAttribute('data-exhibit-revision')??null;
    if(current===exhibitRevision)return;
    exhibitRevision=current;
    visitor.catalog=visitor.loadCatalog();
  });
  exhibitObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-exhibit-revision']});
  const updateDoor=showSpaceLinks(space,{canLeave:()=>visitor.allowLeaveRoom(),onError:message=>notice.show(message)});
  window.addEventListener('keydown',event=>{
    if(visitor.frame&&!visitor.panel.classList.contains('is-walking')&&
       ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE'].includes(event.code)){
      if(!(event.target instanceof Element&&event.target.closest('button,input,select,textarea')))event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);
  const client=new Networked3dWebExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
    sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket(`spaces/${space.id}/network`),waitForWorldConfig:true,
    enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
    createRenderer:options=>{
      const renderer=new ThreeJSWorldRenderer({...options,config:{...options.config,spawnSun:false}});
      const render=renderer.render.bind(renderer);
      renderer.render=state=>{
        const position=client.getLocalCharacterState()?.position;
        updateDoor(position);visitor.update(position);render(state);
      };
      queueMicrotask(options.onInitialized);return renderer;
    },
    animationConfig:animations,
    loadingScreen:{title:space.title,background:'#20464c',color:'#f4e8cd'}
  });
  client.update();
  window.holodeckDevelopment={client};
  window.addEventListener('pagehide',()=>{exhibitObserver.disconnect();visitor.dispose();client.dispose();},{once:true});
}

function startWorld(activeSpace){
const hot=activeSpace?.live===1;
const sceneCache=hot?new RoomSceneCache(activeSpace.actorRef):null;
let inside=hot&&activeSpace.id!=='outside';
let updateDoor=()=>{},remoteScene=null,networkScope=null,arrival=null,arrivedFrames=0;
let moving=false,requestingMove=false,needsSync=false,resyncing=false,moveDeadline=null;
let prefetched=new Set(),prefetchRequest=null;
const setMoving=value=>{
  if(moving!==value){
    moving=value;
    document.body.classList.toggle('room-transition',value);
    $('#room-passage-message').textContent=value?'Cambiando de lugar…':'';
  }
  if(!value){clearTimeout(moveDeadline);moveDeadline=null;}
};
const removeScene=()=>{remoteScene?.remove();remoteScene=null;};
function mountScene(){
  removeScene();
  if(!inside)return true;
  const stored=sceneCache.remember(activeSpace.scene);
  if(!stored)return false;
  const renderer=client.getRenderer();
  const wrapper=new RemoteDocumentWrapper(url('api/space/scene').href,window,
    renderer.mmlCompositionScene.mmlScene,()=>{});
  remoteScene=wrapper.remoteDocument;
  remoteScene.append(stored.template.content.cloneNode(true));
  renderer.mmlTargetElement.append(remoteScene);
  return true;
}
function onNear(destination){
  if(!sceneCache||moving||prefetchRequest||prefetched.has(destination)||sceneCache.revision(destination))return;
  prefetched.add(destination);
  const startedIn=activeSpace.id;
  const controller=new AbortController();prefetchRequest=controller;
  fetch(url('api/space/scene?'+new URLSearchParams({room:destination})),{
    credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)])
  }).then(response=>response.ok?response.json():null).then(scene=>{
    if(activeSpace.id===startedIn&&scene?.id===destination)sceneCache.remember(scene);
  }).catch(()=>{}).finally(()=>{if(prefetchRequest===controller)prefetchRequest=null;});
}
function applySpace(next,anchor){
  if(next.actorRef!==activeSpace.actorRef){sceneCache.clear();location.reload();return;}
  const changed=next.id!==activeSpace.id;
  activeSpace=next;inside=next.id!=='outside';arrival=anchor;arrivedFrames=0;
  stateRequest++;worldAudio.breakContinuity();
  prefetched=new Set();
  prefetchRequest?.abort();prefetchRequest=null;
  document.body.classList.toggle('inside-house',inside);
  document.body.classList.toggle('has-situated-conversation',inside&&next.sharedConversation===true);
  $('#hud h1').textContent=inside?next.title:'El taller de las islas';
  $('#people').textContent=inside?(next.level===0?'Planta baja':next.level<0?`Subsuelo ${-next.level}`:`Piso ${next.level}`):'Un lugar para crear juntos';
  if(changed){contentVisitor.changeRoom(inside);worldIndication.selected=null;worldIndication.removeOutline();state=null;}
  else if(inside)contentVisitor.catalog=contentVisitor.loadCatalog();
  if(anchor)history.replaceState(history.state,'','#'+doorLocation(anchor));
  resetDoor();
  if(!mountScene()){sceneCache.clear();location.reload();}
  updateNativeAvailability();
  if(!inside)refresh().catch(()=>{});
}
function syncCurrent(){
  if(resyncing||requestingMove)return;
  resyncing=true;
  readSpace().then(next=>{
    if(requestingMove)return;
    if(next.live!==1||next.actorRef!==activeSpace.actorRef){sceneCache.clear();location.reload();return;}
    if(networkScope!==next.id)return;
    needsSync=false;
    applySpace(next,null);
  }).catch(()=>{if(!requestingMove)say('No pude confirmar tu ubicación.');})
    .finally(()=>{resyncing=false;});
}
function canFinishMove(){
  if(requestingMove||needsSync||networkScope!==activeSpace.id||!client.getLocalCharacterState())return false;
  if(arrival){
    const {x,y,z,yaw,facing}=arrival;
    client.updateConfig({spawnConfiguration:{spawnPosition:{x,y,z},spawnYRotation:-(yaw??facing*90)}});
    client.respawn();arrival=null;
    return false;
  }
  if(inside?!remoteScene?.isConnected:!geometryProbe?.snapshot())return false;
  return ++arrivedFrames>=2;
}
function resetDoor(){
  updateDoor.dispose?.();
  $('#house-door').hidden=true;$('#house-door').disabled=false;
  $('#space-travel nav').replaceChildren();
  if(!activeSpace)return;
  updateDoor=showSpaceLinks(activeSpace,{
    canLeave:()=>{
      if(moving)return false;
      if(inside)return contentVisitor.allowLeaveRoom();
      if(contentVisitor.frame||nativeTurn||pending||preview||$('#message').value.trim()){
        say('Tenés una visita, un borrador o un envío abierto. Retomalo antes de cambiar de lugar.');
        return false;
      }
      return true;
    },
    onError:say,
    ...(hot?{
      revision:destination=>sceneCache.revision(destination),
      onNear,
      onAccessLost:()=>{needsSync=true;sceneCache.clear();removeScene();},
      onMoving:value=>{
        requestingMove=value;setMoving(value);
        if(value){prefetchRequest?.abort();prefetchRequest=null;}
        if(!value&&needsSync){setMoving(true);syncCurrent();}
      },
      onMoved:(next,anchor)=>{
        requestingMove=false;needsSync=false;
        applySpace(next,anchor);
        // Recovery reads the location already committed, without sending the move again.
        moveDeadline=setTimeout(()=>location.reload(),8000);
      }
    }:{})
  });
}
// MML captures document keys by default. Preserve ordinary text editing and
// keyboard activation of the HUD without turning typed words into locomotion.
document.addEventListener('keydown',event=>{
  if(hot&&(moving||inside&&contentVisitor?.frame&&!contentVisitor.panel.classList.contains('is-walking'))&&
     ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE'].includes(event.code)){
    if(!(event.target instanceof Element&&event.target.closest('button,input,select,textarea')))event.preventDefault();
    event.stopImmediatePropagation();return;
  }
  if(event.target instanceof Element&&event.target.closest('#activity-dialog')){
    event.stopImmediatePropagation();if(event.key==='Escape'){event.preventDefault();worldHistory?.close();}return;
  }
  if(event.target instanceof Element&&event.target.closest('textarea,input,button,summary,select,[contenteditable="true"]')){
    event.stopImmediatePropagation();
    if(event.key==='Escape'){
      event.preventDefault();
      if(event.target.closest('#creator')){closePreview();say('La vista previa quedó descartada.',{transient:true});}
      else openConversation(false);
      event.target.blur();
    }
  }
},true);
const playableHUD=new PlayableHUD(document);
let geometryProbe=null,nativeAvatarLayer=null,contentVisitor=null,preparingConversation=false,worldPicker=null,worldIndication=null,state=null,sharedConversation=null,worldHistory=null;
const client=new Networked3dWebExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
  sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket(hot?'active/network':'network'),waitForWorldConfig:true,
  enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
  // Upstream's default sun allocates an 8192² shadow map. This small world uses
  // the public renderer factory and a bounded 1024² light instead, on all clients.
  createRenderer:options=>{
    const renderer=new ThreeJSWorldRenderer({...options,config:{...options.config,spawnSun:false}});
    const light=new DirectionalLight(0xffefd6,1.8);
    light.position.set(12,22,10);light.target.position.set(0,0,-6);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);
    Object.assign(light.shadow.camera,{left:-38,right:38,top:32,bottom:-32,near:.1,far:75});
    light.shadow.normalBias=.035;
    renderer.mmlCompositionScene.group.add(light,light.target);
    geometryProbe=new AppliedGeometryProbe({document,scene:renderer.mmlCompositionScene.group,
      canvas:options.targetElement.querySelector(':scope > canvas'),expectedDocumentURL:socket('world')});
    nativeAvatarLayer=new NativeAvatarLayer({document,base,onFailure:message=>say(message)});
    worldPicker=new PublicWorldPicker({document,canvas:options.targetElement.querySelector(':scope > canvas'),scene:renderer.mmlCompositionScene.group,
      cameraState:()=>options.coreCameraManager.getCameraState(),proof:()=>geometryProbe?.snapshot(),onPick:record=>{
        if(record.kind==='content')contentVisitor?.openNode(record.node).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'));
        else{
          worldIndication?.select(record);
          const visit=pickedRepresentationVisit(record,state);
          if(visit)contentVisitor?.openNode(visit.id,{expectedRevision:visit.revision}).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'));
        }
      },
      onUnavailable:()=>say('No pude identificar ese objeto todavía. Probá de nuevo.')});
    worldIndication=new WorldIndication({document,scene:renderer.mmlCompositionScene.group,getState:()=>state,
      set:record=>action('focus.set',record.target,{},record.revision,{selection:record}),
      clear:record=>action('focus.clear',null,{},record.sequence),edit:editLight,
      visit:record=>contentVisitor.openNode(record.target,{expectedRevision:record.revision}).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'))});
    const render=renderer.render.bind(renderer),dispose=renderer.dispose.bind(renderer);
    if(hot){
      const configure=renderer.setMMLConfiguration.bind(renderer);
      renderer.setMMLConfiguration=(configuration,token)=>configure(configuration.interior?{}:configuration,token);
    }
    renderer.render=renderState=>{
      const position=client.getLocalCharacterState()?.position;
      nativeAvatarLayer.update();
      if(!inside){worldIndication?.update();if(!moving)playableHUD.update(position);}
      if(!moving){contentVisitor?.update(position);updateDoor(position);}
      render(renderState);
      if(!inside)geometryProbe.afterRender();
      if(hot&&moving&&canFinishMove())setMoving(false);
    };
    renderer.dispose=()=>{removeScene();worldPicker.dispose();worldIndication.dispose();nativeAvatarLayer.dispose();geometryProbe.dispose();dispose();};
    queueMicrotask(options.onInitialized);
    return renderer;
  },
  animationConfig:animations,
  loadingScreen:{title:'Holodeck',subtitle:'Abriendo el taller de las islas',background:'#20464c',color:'#f4e8cd'},
});
client.update();
const worldAudio=new WorldAudio({onChange:()=>updateSoundButton()});
let soundBusy=false;
// Development inspection surface only. It reports actual client state.
window.holodeckDevelopment={client,appliedGeometry:()=>geometryProbe?.snapshot()||null,audioState:()=>worldAudio.status(),avatarState:()=>nativeAvatarLayer?.status()};
const $=selector=>document.querySelector(selector);
const notice=$('#notice');
const worldNotice=new WorldNotice(notice);
contentVisitor=new ContentVisitor({document,window,base,say,scoped:inside});
worldHistory=new WorldHistory({document,window,getState:()=>state,
  load:(query,{signal})=>api('activity?'+new URLSearchParams(query),undefined,{signal}),
  resumeWorld:()=>{document.activeElement?.blur();window.focus();},onDiscuss:()=>openConversation(true),
  onPoint:async reference=>{
    await refresh();if(state.actorRef!==reference.actorRef)throw Object.assign(Error('History actor changed'),{userMessage:'Tu acceso cambió. Volvé a abrir la actividad.'});
    if(state.run!==reference.run||state.edition!==reference.edition)throw Object.assign(Error('History room changed'),{userMessage:'Este cambio pertenece a otra etapa del mundo.'});
    const target=state.entities[reference.target]||state.nodes?.[reference.target];
    if(!target||target.deleted)throw Object.assign(Error('History target unavailable'),{userMessage:'Este objeto ya no está en el mundo.'});
    return action('focus.set',reference.target,{},target.revision,{selection:{run:reference.run,edition:reference.edition}});
  }});
$('#history-reference-clear').onclick=()=>{worldHistory.clearReference();updateNativeAvailability();};
function updateSoundButton(){
  const status=worldAudio.status(),button=$('#sound');
  button.textContent=status.active?'Silenciar':status.selected?'Reanudar':'Sonido';
  button.setAttribute('aria-pressed',String(status.active));
  button.setAttribute('aria-label',status.active?'Silenciar sonido del mundo':status.selected?'Reanudar sonido del mundo':'Activar sonido del mundo');
  button.title=status.supported?'Ambiente suave y sonidos de los cambios del mundo':'El sonido no está disponible en este navegador';
  button.disabled=soundBusy||!status.supported||status.disposed;
}
$('#sound').onclick=async event=>{
  if(!event.isTrusted||soundBusy)return;
  soundBusy=true;updateSoundButton();
  const enable=!worldAudio.status().active;
  try{const result=enable?await worldAudio.enableFromGesture():await worldAudio.disable();
    if(enable&&result.active)refresh().catch(()=>{});
    if(enable&&!result.active)say('No pude activar el sonido. Podés intentarlo de nuevo.');
  }finally{soundBusy=false;updateSoundButton();}
};
worldAudio.setVisibility(!document.hidden);
document.addEventListener('visibilitychange',()=>{worldAudio.setVisibility(!document.hidden);if(!document.hidden)refresh().catch(()=>{});});
window.addEventListener('offline',()=>worldAudio.breakContinuity());
window.addEventListener('online',()=>worldAudio.breakContinuity());
let pending=null,pendingMetadata=null,preview=null,lastChange=null,nativeTurn=null,closed=false,stateRequest=0,preparingAction=false;
const recovery={command:null,native:null};
let closingRecovery=null,recoveryBusy=false;
const pendingKey=`holodeck.pending:${base.pathname}`;
const turnKey=`holodeck.turn:${base.pathname}`;
const archiveKey=`holodeck.closed-intents:${base.pathname}`;
const archivedNativeIds=new Set();
try{for(const entry of loadIntent(sessionStorage,archiveKey,131072)||[])if(entry.kind==='native'&&entry.id)archivedNativeIds.add(entry.id);}catch{}
try{
  const value=loadIntent(sessionStorage,pendingKey,4096);
  if(typeof value?.command?.id==='string'&&value.command.id.length<=80){pending=value.command;pendingMetadata=value;}
}catch{/* An unreadable local record never causes an automatic mutation retry. */}
try{
  const raw=sessionStorage.getItem(turnKey);
  if(raw&&/^[\w-]{8,80}$/.test(raw))nativeTurn={id:raw,recovered:true};
  else{const value=loadIntent(sessionStorage,turnKey);if(typeof value?.id==='string')nativeTurn={...value,recovered:true};}
}
catch{/* Server active-turn discovery remains available. */}
let worldDocuments={workshop:{url:socket('world')}};
client.on('configChanged',config=>{
  if(config.mmlDocuments){worldDocuments={...config.mmlDocuments};delete worldDocuments.preview;}
});
function say(text,options){
  if(worldHistory?.dialog.open){worldHistory.message(text);worldNotice.clear();}
  else if(!$('#creator').hidden){$('#preview-hint').textContent=text;worldNotice.clear();}
  else worldNotice.show(text,options);
}
async function api(path,body,{signal}={}){
  const response=await fetch(url(`api/${path}`),{method:body===undefined?'GET':'POST',credentials:'same-origin',
    headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
  const value=await response.json();
  if(!response.ok){const error=Error(value.message||value.detail||'La acción no se pudo completar.');Object.assign(error,value,{httpStatus:response.status});throw error;}
  return value;
}
function noteRecovery(kind,result={}){
  const expiredCommand=kind==='command'&&result.code==='not-recorded'&&pending&&
    ((Number.isFinite(result.serverTime)&&Number.isFinite(result.retryWindowMs)&&result.serverTime-pending.issuedAt>result.retryWindowMs)||
      (typeof result.run==='string'&&result.run!==pending.run));
  recovery[kind]={code:result.code||'unknown',retained:result.retained,knownNotSubmitted:result.knownNotSubmitted===true,
    tracking:result.tracking===true,retryable:result.retryable!==false&&result.tracking!==true,
    expired:result.expired===true||result.code==='expired'||!!expiredCommand};
  renderRecovery();
}
function clearRecovery(kind){recovery[kind]=null;if(closingRecovery===kind)closingRecovery=null;renderRecovery();}
function renderRecovery(){
  const panel=$('#recovery-panel'),items=$('#recovery-items');items.replaceChildren();
  for(const kind of ['command','native']){
    const info=recovery[kind],record=kind==='command'?pendingMetadata:nativeTurn;
    if(!info||!record)continue;
    const card=document.createElement('div');card.className='recovery-item';card.dataset.kind=kind;
    const title=document.createElement('p');title.className='recovery-title';title.textContent=kind==='command'?'Tu cambio en el mundo':'Tu mensaje';card.append(title);
    const description=document.createElement('p');
    description.textContent=info.expired?'Este envío ya venció. Podemos revisar cómo quedó el mundo y cerrar su seguimiento.':info.knownNotSubmitted?'Este intento no llegó a completarse. Podés volver a enviar el mismo contenido.':'Todavía no hay una confirmación. Comprobar no vuelve a enviar nada.';
    if(info.tracking)description.textContent='Una parte del turno sigue en curso. Podés comprobarla o dejar de seguirla, sin cancelarla.';
    if(kind==='native'&&!record.body&&info.retained===false)description.textContent='La referencia se conservó, pero esta pestaña no tiene el texto original. Podés cerrar el seguimiento y escribir otro mensaje.';
    card.append(description);
    if(kind==='native'&&record.body?.text&&sameActor(record,state?.actorRef)){const details=document.createElement('details'),summary=document.createElement('summary'),original=document.createElement('p');summary.textContent='Ver mensaje conservado';original.textContent=record.body.text;original.style.whiteSpace='pre-wrap';details.append(summary,original);card.append(details);}
    if(record.actorRef&&state?.actorRef&&record.actorRef!==state.actorRef){const warning=document.createElement('p');warning.textContent='Este envío pertenece a otra identidad. No se reenviará desde esta sesión.';card.append(warning);}
    if(record.run&&state?.run&&record.run!==state.run){const warning=document.createElement('p');warning.textContent='Este envío pertenece a una visita anterior. Comprobalo o cerrá su seguimiento antes de iniciar otro.';card.append(warning);}
    const actions=document.createElement('div');actions.className='row';
    const check=document.createElement('button');check.textContent='Comprobar';check.dataset.action='check';check.disabled=recoveryBusy;check.onclick=()=>recoveryAction(kind,'check');actions.append(check);
    const retry=document.createElement('button');retry.textContent=kind==='command'?'Reintentar cambio':'Reintentar mensaje';retry.dataset.action='retry';
    const ownerMatches=sameActor(record,state?.actorRef);
    const legacyRetained=kind==='native'&&!record.body&&info.retained===true&&(!record.actorRef||ownerMatches);
    const runChanged=!!record.run&&!!state?.run&&record.run!==state.run;
    retry.disabled=recoveryBusy||info.expired||!info.retryable||runChanged||(!ownerMatches&&!legacyRetained);
    retry.onclick=()=>recoveryAction(kind,'retry');actions.append(retry);
    const close=document.createElement('button');close.textContent=closingRecovery===kind?'Conservar y cerrar':'Dejar seguimiento';close.dataset.action='close';close.disabled=recoveryBusy;
    close.onclick=()=>{if(closingRecovery!==kind){closingRecovery=kind;renderRecovery();}else closeTracking(kind);};actions.append(close);
    card.append(actions);
    if(closingRecovery===kind){const warning=document.createElement('p');warning.className='recovery-warning';warning.textContent='Esto no cancela ni deshace el envío. Conservaremos la referencia y su contenido en esta pestaña; podrás iniciar otro.';card.append(warning);}
    items.append(card);
  }
  panel.hidden=!items.children.length;
}
function closeTracking(kind){
  const record=kind==='command'?pendingMetadata:nativeTurn;
  try{archiveIntent(sessionStorage,archiveKey,{kind,...record});}
  catch{say('Esta pestaña ya conserva varios envíos sin confirmar. Comprobá alguno antes de cerrar otro seguimiento.');return;}
  if(kind==='command'){pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);}
  else{archivedNativeIds.add(nativeTurn.id);nativeTurn=null;sessionStorage.removeItem(turnKey);updateNativeAvailability();}
  clearRecovery(kind);say('Cerramos el seguimiento. El envío anterior no se canceló ni se deshizo.');
}
async function recoveryAction(kind,action){
  if(recoveryBusy)return;recoveryBusy=true;renderRecovery();
  const id=(kind==='command'?pending:nativeTurn)?.id;
  const current=()=>sameRequest(kind==='command'?pending:nativeTurn,id);
  try{
    if(action==='check'){if(kind==='command')await recoverCommand();else await readTurn();return;}
    if(kind==='command'){
      if(!pending||!sameActor(pendingMetadata,state?.actorRef))return;
      // Read first. Only this explicit click may resend the exact frozen ID/body.
      const command=pending;
      try{const result=await api(`commands/${id}`);if(!current()||settleCommand(result))return;}catch(error){if(!current())return;noteRecovery('command',error);if(recovery.command?.expired)return;}
      const result=await api('commands',command);if(current())settleCommand(result);
    }else{
      if(!nativeTurn)return;
      const info=recovery.native,record=nativeTurn;
      if(record.run&&record.run!==state?.run)return;
      const initial=info?.retained===false&&info.knownNotSubmitted&&!!record.body;
      if(initial&&!sameActor(record,state?.actorRef))return;
      const path=nativeRetryRoute(record,initial?'not-retained':null);
      const result=await api(path,initial?record.body:{});
      if(!current())return;
      if(result.retained===true){nativeTurn.retained=true;saveIntent(sessionStorage,turnKey,nativeTurn);}
      clearRecovery('native');await readTurn();
    }
  }catch(error){if(current())noteRecovery(kind,error);}
  finally{recoveryBusy=false;renderRecovery();await refresh().catch(()=>{});}
}
const sharedSurface=()=>inside?activeSpace?.sharedConversation===true:state?.native?.sharedConversation===true;
function updateNativeAvailability(){
  const available=state?.native?.available===true;
  const shared=sharedSurface();
  $('#talk').disabled=inside&&!shared;
  $('#conversation-panel').classList.toggle('shared-conversation',shared);
  $('#conversation-form').hidden=shared;$('#conversation-log').hidden=shared;
  $('#shared-conversation').hidden=!shared;
  const historyLabel=inside?null:worldHistory?.conversationLabel();$('#history-reference-clear').hidden=!historyLabel;
  const historyHint=historyLabel?`Tema de la próxima intervención: ${historyLabel}. `:'';
  if(shared){$('#conversation-hint').textContent=historyHint+'Podés volver al mundo sin cerrar lo que estás escribiendo o grabando.';return;}
  $('#conversation-hint').textContent=historyHint+((available||nativeTurn)?'Podés seguir recorriendo el mundo mientras transcurre mi turno.':'La conversación todavía no está conectada a este mundo.');
  $('#send').disabled=!available||!!nativeTurn||preparingConversation;
  if(preparingConversation){$('#companion-status').textContent='Conservando el punto que estamos mirando…';return;}
  if(!nativeTurn){
    $('#companion-status').textContent=available?'Podemos conversar desde este lugar':'Exploración compartida';
  }
}
async function refresh(){
  if(inside)return;
  const request=++stateRequest,continuityVersion=worldAudio.continuityVersion;
  let incoming;
  try{incoming=await api('state');}catch(error){if(request!==stateRequest)return;worldAudio.breakContinuity();throw error;}
  if(!snapshotMayApply(state,incoming,request,stateRequest))return;
  state=incoming;contentVisitor.syncNodes(state.nodes);playableHUD.sync(state.nodes);worldAudio.observe(state,{continuityVersion});worldHistory.observe(state);
  const count=client.getCharacterStates().size;
  $('#people').textContent=count>1?`${count} exploradores en el taller`:'Un lugar para crear juntos';
  const compact=window.matchMedia('(max-width:740px)').matches;
  $('#bridge').textContent=state.entities.bridge.raised?(compact?'Separar':'Separar islas'):(compact?'Unir islas':'Conectar islas');
  $('#bridge').setAttribute('aria-label',state.entities.bridge.raised?'Separar las islas':'Conectar las islas');
  $('#undo').disabled=!lastChange||!!pending;
  if(!nativeTurn&&state.native?.active?.id&&!archivedNativeIds.has(state.native.active.id)){nativeTurn={id:state.native.active.id,actorRef:state.actorRef,retained:true,recovered:true};try{saveIntent(sessionStorage,turnKey,nativeTurn);}catch{}}
  updateNativeAvailability();
  if(pending)await recoverCommand();
  if(nativeTurn)await readTurn();
  renderRecovery();
}
function settleCommand(result){
  if(!pending||result.command!==pending.id||!['completed','rejected','failed'].includes(result.status))return false;
  if(result.status==='completed'&&pending.type.startsWith('focus.')){
    say(pending.type==='focus.set'?'La indicación ya es compartida.':'Dejaste de señalar ese objeto.',{transient:true});
  }else if(result.status==='completed'){
    const undo=pendingMetadata?.undo;
    lastChange=undo?null:{type:pending.type,target:pending.target,previous:pendingMetadata?.previous,
      appliedRevision:pending.type==='garden.place'?1:pending.expectedRevision+1,run:pending.run};
    say(undo?'Tu cambio quedó deshecho.':'El cambio ya forma parte del mundo.',{transient:true});
  }else say('Ese lugar cambió. Mirá cómo quedó antes de intentarlo de nuevo.');
  pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);clearRecovery('command');return true;
}
async function recoverCommand(){
  if(!pending)return;
  const id=pending.id;
  try{const result=await api(`commands/${id}`);if(sameRequest(pending,id))settleCommand(result);}
  catch(error){if(sameRequest(pending,id))noteRecovery('command',error);}
}
async function action(type,target,args,expectedRevision,{undo=false,selection=null}={}){
  if(pending||preparingAction){say('Primero tengo que confirmar el cambio anterior.');return null;}
  if(!state){say('Esperá a entrar al taller para cambiar este lugar.');return null;}
  const scope={actorRef:state.actorRef,run:state.run,edition:state.edition};
  preparingAction=true;let submittedId=null;
  try{
    const observation=await api('observe',{after:Math.max(0,(state?.sequence??0)-16),displayedSequence:null,maxBytes:32768});
    if(state?.actorRef!==scope.actorRef||state.run!==scope.run||state.edition!==scope.edition
      ||observation.observer!==scope.actorRef||observation.run!==scope.run||observation.edition!==scope.edition){say('Tu acceso o este mundo cambió. Volvé a elegir la acción.');return null;}
    if(selection&&(observation.run!==selection.run||observation.edition!==selection.edition)){say('El lugar cambió. Elegí el objeto de nuevo.');return null;}
    const previous=observation.entities[target];
    pending={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type,target,args,expectedRevision};
    pendingMetadata={command:pending,previous,undo,actorRef:scope.actorRef,createdAt:Date.now()};
    try{pendingMetadata=saveIntent(sessionStorage,pendingKey,pendingMetadata,4096);pending=pendingMetadata.command;}
    catch{pending=null;pendingMetadata=null;say('El navegador no pudo guardar la confirmación pendiente. El cambio no se envió.');return null;}
    submittedId=pending.id;preparingAction=false;
    const result=await api('commands',pending);
    if(!sameRequest(pending,submittedId))return result;
    settleCommand(result);await refresh();return result;
  }catch(error){
    if(submittedId&&!sameRequest(pending,submittedId))return null;
    if(pending){
      say('Estoy comprobando si el cambio llegó. No voy a repetirlo.');
      const id=pending.id;
      try{const result=await api(`commands/${id}`);if(sameRequest(pending,id)){settleCommand(result);await refresh();}return result;}
      catch(checkError){if(sameRequest(pending,id))noteRecovery('command',checkError);}
    }else say('No pude conectar con el taller. Probá de nuevo cuando vuelva la conexión.');
    return null;
  }finally{if(!submittedId)preparingAction=false;}
}
function previewDocument(){
  if(!preview)return;
  const color=workshopColour(preview.color);
  const markup=`<m-group id="local-preview"><m-cylinder x="${preview.x}" y="0.22" z="${preview.z}" radius="0.38" height="0.12" opacity="0.55" color="${color}" collide="false"></m-cylinder><m-sphere x="${preview.x}" y="0.9" z="${preview.z}" radius="0.35" opacity="0.55" color="${color}" collide="false"></m-sphere></m-group>`;
  const old=preview.blob;preview.blob=URL.createObjectURL(new Blob([markup],{type:'text/html'}));
  client.updateConfig({mmlDocuments:{...worldDocuments,preview:{url:preview.blob}}});
  if(old)URL.revokeObjectURL(old);
}
function movePreview(){
  const position=client.getLocalCharacterState()?.position;
  if(!position){say('Esperá a entrar al taller para crear una luz.');return false;}
  const at=nearestCreationPosition(position.x+1,position.z);
  preview={...preview,...at,color:preview?.color||'mint'};
  previewDocument();return true;
}
function closePreview(){
  const old=preview?.blob;preview=null;client.updateConfig({mmlDocuments:worldDocuments});if(old)URL.revokeObjectURL(old);$('#creator').hidden=true;
}
function showPreview(){
  const editing=!!preview?.target;
  $('#creator-title').textContent=editing?'Editar esta luz':'Una luz para este lugar';
  $('#creator').setAttribute('aria-label',editing?'Editar una luz':'Crear una luz');
  $('#preview-hint').textContent=editing?'La vista previa es tuya. Guardar cambia esta misma luz para todos.':'La vista previa es tuya. Al plantar, aparece para todos.';
  $('#preview-accept').textContent=editing?'Guardar cambios':'Plantar';
  for(const choice of document.querySelectorAll('[data-color]'))choice.setAttribute('aria-pressed',String(choice.dataset.color===preview.color));
  worldNotice.clear();$('#creator').hidden=false;
}
function editLight(record){
  const entity=state?.entities?.[record.target];
  if(pending||preparingAction){say('Primero tengo que confirmar el cambio anterior.');return;}
  if(!entity||entity.deleted||entity.revision!==record.revision||state.run!==record.run||state.edition!==record.edition){say('La luz cambió. Volvé a elegirla.');return;}
  closePreview();preview={target:record.target,expectedRevision:record.revision,selection:record,x:entity.x,z:entity.z,color:entity.color};
  previewDocument();showPreview();say('Podés mover esta luz o cambiar su color. Todavía no cambió para los demás.');
}
$('#bridge').onclick=()=>state&&action('bridge.set','bridge',{raised:!state.entities.bridge.raised},state.entities.bridge.revision);
$('#plant').onclick=()=>{closePreview();if(movePreview()){showPreview();say('Elegí dónde dejar esta luz. Todavía la ves solamente vos.');}};
$('#preview-move').onclick=movePreview;
$('#preview-cancel').onclick=()=>{closePreview();say('La vista previa quedó descartada.',{transient:true});};
$('#preview-accept').onclick=async()=>{
  if(!preview)return;
  const submittedPreview=preview,args={x:preview.x,z:preview.z,color:preview.color};
  $('#preview-accept').disabled=true;
  const result=await action(preview.target?'garden.update':'garden.place',preview.target||`garden-${crypto.randomUUID()}`,args,preview.expectedRevision??null,{selection:preview.selection??null});
  $('#preview-accept').disabled=false;
  if(result?.status==='completed'&&preview===submittedPreview){closePreview();say('El cambio ya forma parte del mundo.',{transient:true});}
};
for(const button of document.querySelectorAll('[data-color]'))button.onclick=()=>{
  if(!preview)return;preview.color=button.dataset.color;
  for(const choice of document.querySelectorAll('[data-color]'))choice.setAttribute('aria-pressed',String(choice===button));
  previewDocument();
};
$('#undo').onclick=async()=>{
  if(!lastChange||!state)return;
  const change=lastChange,entity=state.entities[change.target];
  if(!entity||state.run!==change.run||entity.revision!==change.appliedRevision){lastChange=null;$('#undo').disabled=true;say('Este lugar volvió a cambiar. No voy a deshacer el trabajo de otra persona.');return;}
  if(change.type==='bridge.set')await action('bridge.set','bridge',{raised:change.previous.raised},entity.revision,{undo:true});
  else if(change.type==='garden.place')await action('garden.remove',change.target,{},entity.revision,{undo:true});
  else if(change.type==='garden.update'&&change.previous)await action('garden.update',change.target,{x:change.previous.x,z:change.previous.z,color:change.previous.color},entity.revision,{undo:true});
};
function openConversation(open){
  const panel=$('#conversation-panel');panel.hidden=!open;$('#talk').setAttribute('aria-expanded',String(open));
  if(open)updateNativeAvailability();
  if(open&&sharedSurface()){
    if(!sharedConversation)sharedConversation=new SharedConversationHost({window,document,container:$('#shared-conversation'),api,
      capture:captureInteractionContext,currentActor:()=>activeSpace?.actorRef??state?.actorRef,
      onStatus:({phase,busy})=>{$('#companion-status').textContent=phases[phase]||(busy?'La conversación está procesando tu intervención.':'Tu intervención quedó en la conversación.');},onError:say});
    sharedConversation.mount().catch(()=>say('No pude abrir tu conversación. Volvé a tocar Conversar para intentarlo.'));
  }else if(open)$('#message').focus();
  else if(panel.contains(document.activeElement)){document.activeElement.blur();window.focus();}
}
$('#talk').onclick=()=>openConversation($('#conversation-panel').hidden);
$('#conversation-close').onclick=()=>openConversation(false);
function boundConversation(){
  const log=$('#conversation-log');while(log.children.length>128)log.firstElementChild.remove();
  for(const[key,line]of nativeLines)if(!line.isConnected)nativeLines.delete(key);
}
function appendMessage(text,kind){const line=document.createElement('p');line.className=kind;line.textContent=text;$('#conversation-log').append(line);boundConversation();line.scrollIntoView({block:'nearest'});}
const phases={preparing:'Estoy preparando mi turno.',submitting:'Tu mensaje está llegando a la conversación.',queued:'Tu mensaje está en espera.',working:'Estoy trabajando con lo que me compartiste.',completed:'Mi turno terminó.',problem:'Necesito resolver un problema para continuar.',unknown:'Todavía no pude confirmar cómo sigue mi turno.'};
const nativeLines=new Map();
async function readTurn(){
  if(!nativeTurn)return;
  const id=nativeTurn.id;
  let result;
  try{result=await api(`interactions/${id}`);}
  catch(error){if(sameRequest(nativeTurn,id)){noteRecovery('native',error);$('#companion-status').textContent=phases.unknown;}return;}
  if(!sameRequest(nativeTurn,id))return;
  if(result.retained===true&&!nativeTurn.retained){nativeTurn.retained=true;nativeTurn.actorRef||=state?.actorRef;try{saveIntent(sessionStorage,turnKey,nativeTurn);}catch{}}
  const phase=result.phase||'unknown';
  $('#companion-status').textContent=phases[phase]||phases.unknown;
  for(const update of result.updates||[]){
    if(!['progress','answer'].includes(update.kind)||typeof update.text!=='string')continue;
    const key=String(update.source)+':'+update.kind;
    let line=nativeLines.get(key);
    if(!line){line=document.createElement('p');line.className=`daimon ${update.kind}`;$('#conversation-log').append(line);nativeLines.set(key,line);}
    line.textContent=update.text;
    if(update.kind==='progress'&&!['completed','problem'].includes(phase))$('#companion-status').textContent=update.text.slice(0,160);
  }
  while(nativeLines.size>64){const key=nativeLines.keys().next().value;nativeLines.get(key).remove();nativeLines.delete(key);}
  boundConversation();
  const endedWithoutReply=phase==='problem'&&result.tracking===false
    &&result.execution?.state==='observed'&&result.execution?.replyAssociation==='unavailable'
    &&['completed','failed','interrupted'].includes(result.execution?.status);
  if((phase==='completed'&&result.tracking!==true)||endedWithoutReply){
    if(endedWithoutReply&&result.message)appendMessage(result.message,'notice');
    nativeTurn=null;sessionStorage.removeItem(turnKey);clearRecovery('native');updateNativeAvailability();
  }else if(phase==='problem'){if(result.message)say(result.message);noteRecovery('native',result);}
  else if(phase==='unknown')noteRecovery('native',result);
  else clearRecovery('native');
}
async function captureInteractionContext(){
  const capturedActor=activeSpace?.actorRef??state?.actorRef,capturedSpace=activeSpace?.id??'outside';
  if(moving||!capturedActor)throw Error('Esperá a llegar para conversar desde este lugar.');
  if(inside){
    const position=client.getLocalCharacterState()?.position;
    return structuredClone({capturedAt:Date.now(),spaceId:capturedSpace,local:position?{position}:null});
  }
  const capturedRun=state?.run;
  if(!capturedRun)throw Error('No pude confirmar el mundo desde donde estás pensando.');
  // Freeze this utterance's world view before waiting for an embedded viewer.
  // Walking, remote movement and newer drafts may continue during that wait.
  const local=client.getLocalCharacterState();
  const view=structuredClone({capturedAt:Date.now(),spaceId:capturedSpace,run:state.run,edition:state.edition,local:local?{userId:local.userId,connectionId:local.connectionId,position:local.position}:null,
    others:[...client.getCharacterStates().values()].filter(person=>!person.isLocal).slice(0,8).map(person=>({userId:person.userId,connectionId:person.connectionId,position:person.position}))});
  const appliedGeometry=geometryProbe?.snapshot();
  if(appliedGeometry)view.appliedGeometry=structuredClone(appliedGeometry);
  const historyReference=worldHistory.reference();
  if(historyReference)view.historyReference=structuredClone(historyReference);
  let visitContext;
  visitContext=await contentVisitor.context();
  if((activeSpace?.actorRef??state?.actorRef)!==capturedActor||state?.run!==capturedRun||(activeSpace?.id??'outside')!==capturedSpace)throw Error('El lugar o tu acceso cambió.');
  if(visitContext)view.contentVisit=visitContext;
  if(new TextEncoder().encode(JSON.stringify(view)).length>4096)delete view.appliedGeometry;
  if(new TextEncoder().encode(JSON.stringify(view)).length>4096)throw Error('No pude conservar este contexto completo.');
  return view;
}
$('#conversation-form').onsubmit=async event=>{
  event.preventDefault();if(state?.native?.sharedConversation)return;if(nativeTurn||preparingConversation||state?.native?.available!==true)return;
  const text=$('#message').value;if(!text.trim())return;
  preparingConversation=true;updateNativeAvailability();
  let view;try{view=await captureInteractionContext();}catch(error){say(error.message);return;}finally{preparingConversation=false;updateNativeAvailability();}
  const body={id:crypto.randomUUID(),text,displayedSequence:null,view};
  nativeTurn={id:body.id,body,actorRef:state.actorRef,run:state.run,createdAt:Date.now()};$('#send').disabled=true;
  try{nativeTurn=saveIntent(sessionStorage,turnKey,nativeTurn);}catch{nativeTurn=null;updateNativeAvailability();say('No pude conservar este mensaje para comprobarlo después. No se envió.');return;}
  appendMessage(text,'human');
  if($('#message').value===text){$('#message').value='';$('#message').blur();}
  try{const result=await api('interactions',body);
    if(!sameRequest(nativeTurn,body.id))return;
    $('#companion-status').textContent=phases[result.phase]||phases.unknown;
    await readTurn();
  }catch(error){if(sameRequest(nativeTurn,body.id)){$('#companion-status').textContent=phases.unknown;noteRecovery('native',error);}}
};
// Escape closes panels; it does not interrupt a native turn or stop the world.
window.addEventListener('keydown',event=>{if(event.key==='Escape'){openConversation(false);if(preview)closePreview();}});
let refreshing=false;
const interval=setInterval(async()=>{
  if(closed||inside||document.hidden||refreshing)return;refreshing=true;
  try{await refresh();}catch{say('La conexión con el taller se interrumpió. Los cambios no se repetirán solos.');}
  finally{refreshing=false;}
},1500);
window.addEventListener('pagehide',()=>{closed=true;clearInterval(interval);sharedConversation?.dispose();contentVisitor.dispose();worldHistory.dispose();if(preview?.blob)URL.revokeObjectURL(preview.blob);worldAudio.dispose();client.dispose();});
refresh().catch(()=>say('No pude conectar con el taller.'));
resetDoor();
if(hot){
  if(inside){applySpace(activeSpace,null);setMoving(true);}
  client.getWorldConnection().addEventListener(event=>{
    if(event.type==='disconnected'){
      networkScope=null;
      removeScene();
      setMoving(true);
      if(!requestingMove&&!moveDeadline){needsSync=true;sceneCache.clear();}
    }else if(event.type==='world_config'){
      const config=event.config.mmlDocuments;
      networkScope=config?.interior?.url.split('/').at(-2)??(config?.workshop?'outside':null);
      if(needsSync)syncCurrent();
      else if(moving&&!requestingMove&&networkScope===activeSpace.id&&inside&&!remoteScene)mountScene();
    }
  });
}
}
