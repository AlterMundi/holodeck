import { Networked3dWebExperienceClient, DefaultVirtualJoystickPlugin } from '@mml-io/3d-web-experience-client';
import { ThreeJSWorldRenderer } from '@mml-io/3d-web-threejs';
import { DirectionalLight } from 'three';
import { WORKSHOP, workshopColour } from './workshop.mjs';
import { saveIntent, loadIntent, archiveIntent, sameActor, nativeRetryRoute } from './client-intents.mjs';
import { NativeAvatarLayer } from './native-avatar.mjs';
import {PublicWorldPicker,WorldIndication} from './world-indication.mjs';
import { ContentVisitor } from './content-visitor.mjs';
import { AppliedGeometryProbe } from './applied-geometry.mjs';
import { WorldAudio } from './world-audio.mjs';
import { snapshotMayApply, sameRequest } from './client-order.mjs';
const base=new URL('./',document.baseURI);
const url=path=>new URL(path,base);
const socket=path=>{const target=url(path);target.protocol=location.protocol==='https:'?'wss:':'ws:';return target.href;};
// MML captures document keys by default. Preserve ordinary text editing and
// keyboard activation of the HUD without turning typed words into locomotion.
document.addEventListener('keydown',event=>{
  if(event.target instanceof Element&&event.target.closest('textarea,input,button,select,[contenteditable="true"]')){
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();event.target.blur();openConversation(false);}
  }
},true);
const touchControls={
  mount(container,experience){
    this.holder=document.createElement('div');this.holder.className='touch-controls';container.append(this.holder);
    this.delegate=new DefaultVirtualJoystickPlugin({radius:58,innerRadius:19});
    this.delegate.mount(this.holder,experience);
    for(const button of this.holder.querySelectorAll('button')){button.textContent='Saltar';button.setAttribute('aria-label','Saltar');}
  },
  dispose(){this.delegate?.dispose();this.holder?.remove();}
};
let geometryProbe=null,nativeAvatarLayer=null,contentVisitor=null,preparingConversation=false,worldPicker=null,worldIndication=null,state=null;
const client=new Networked3dWebExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
  sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket('network'),waitForWorldConfig:true,
  enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
  // Upstream's default sun allocates an 8192² shadow map. This small world uses
  // the public renderer factory and a bounded 1024² light instead, on all clients.
  createRenderer:options=>{
    const renderer=new ThreeJSWorldRenderer({...options,config:{...options.config,spawnSun:false}});
    const light=new DirectionalLight(0xffefd6,1.8);
    light.position.set(12,22,10);light.target.position.set(0,0,-6);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);
    Object.assign(light.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:.1,far:75});
    light.shadow.normalBias=.035;
    renderer.mmlCompositionScene.group.add(light,light.target);
    geometryProbe=new AppliedGeometryProbe({document,scene:renderer.mmlCompositionScene.group,
      canvas:options.targetElement.querySelector(':scope > canvas'),expectedDocumentURL:socket('world')});
    nativeAvatarLayer=new NativeAvatarLayer({document,base,onFailure:message=>say(message)});
    worldPicker=new PublicWorldPicker({document,canvas:options.targetElement.querySelector(':scope > canvas'),scene:renderer.mmlCompositionScene.group,
      cameraState:()=>options.coreCameraManager.getCameraState(),proof:()=>geometryProbe?.snapshot(),onPick:record=>worldIndication?.select(record),
      onUnavailable:()=>say('No pude identificar ese objeto todavía. Probá de nuevo.')});
    worldIndication=new WorldIndication({document,scene:renderer.mmlCompositionScene.group,getState:()=>state,
      set:record=>action('focus.set',record.target,{},record.revision,{selection:record}),
      clear:record=>action('focus.clear',null,{},record.sequence)});
    const render=renderer.render.bind(renderer),dispose=renderer.dispose.bind(renderer);
    renderer.render=state=>{nativeAvatarLayer.update();worldIndication?.update();contentVisitor?.update(client.getLocalCharacterState()?.position);render(state);geometryProbe.afterRender();};
    renderer.dispose=()=>{worldPicker.dispose();worldIndication.dispose();nativeAvatarLayer.dispose();geometryProbe.dispose();dispose();};
    queueMicrotask(options.onInitialized);
    return renderer;
  },
  animationConfig:{airAnimationFileUrl:url('assets/anim_air.glb').href,idleAnimationFileUrl:url('assets/anim_idle.glb').href,
    jogAnimationFileUrl:url('assets/anim_jog.glb').href,sprintAnimationFileUrl:url('assets/anim_run.glb').href,doubleJumpAnimationFileUrl:url('assets/anim_double_jump.glb').href},
  loadingScreen:{title:'Holodeck',subtitle:'Abriendo el taller de las islas',background:'#20464c',color:'#f4e8cd'},
});
client.update();
const worldAudio=new WorldAudio({onChange:()=>updateSoundButton()});
let soundBusy=false;
// Development inspection surface only. It reports actual client state.
window.holodeckDevelopment={client,appliedGeometry:()=>geometryProbe?.snapshot()||null,audioState:()=>worldAudio.status(),avatarState:()=>nativeAvatarLayer?.status()};
const $=selector=>document.querySelector(selector);
const notice=$('#notice');
contentVisitor=new ContentVisitor({document,window,base,say});
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
function say(text){notice.textContent=text;}
async function api(path,body){
  const response=await fetch(url(`api/${path}`),{method:body===undefined?'GET':'POST',credentials:'same-origin',
    headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
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
function updateNativeAvailability(){
  const available=state?.native?.available===true;
  $('#send').disabled=!available||!!nativeTurn||preparingConversation;
  if(preparingConversation){$('#companion-status').textContent='Conservando el punto que estamos mirando…';return;}
  if(!nativeTurn){
    $('#companion-status').textContent=available?'Podemos conversar desde este lugar':'Exploración compartida';
    $('#conversation-hint').textContent=available?'Podés seguir recorriendo el mundo mientras transcurre mi turno.':'La conversación todavía no está conectada a este mundo.';
  }
}
async function refresh(){
  const request=++stateRequest,continuityVersion=worldAudio.continuityVersion;
  let incoming;
  try{incoming=await api('state');}catch(error){if(request!==stateRequest)return;worldAudio.breakContinuity();throw error;}
  if(!snapshotMayApply(state,incoming,request,stateRequest))return;
  state=incoming;worldAudio.observe(state,{continuityVersion});
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
    say(pending.type==='focus.set'?'La indicación ya es compartida.':'Dejaste de señalar ese objeto.');
  }else if(result.status==='completed'){
    const undo=pendingMetadata?.undo;
    lastChange=undo?null:{type:pending.type,target:pending.target,previous:pendingMetadata?.previous,
      appliedRevision:pending.type==='garden.place'?1:pending.expectedRevision+1,run:pending.run};
    say(undo?'Tu cambio quedó deshecho.':'El cambio ya forma parte del mundo.');
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
  preparingAction=true;let submittedId=null;
  try{
    const observation=await api('observe',{after:Math.max(0,(state?.sequence??0)-16),displayedSequence:null,maxBytes:12288});
    if(selection&&(observation.run!==selection.run||observation.edition!==selection.edition)){say('El lugar cambió. Elegí el objeto de nuevo.');return null;}
    const previous=observation.entities[target];
    pending={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type,target,args,expectedRevision};
    pendingMetadata={command:pending,previous,undo,actorRef:state?.actorRef,createdAt:Date.now()};
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
  const area=WORKSHOP.creationArea;
  preview={...preview,x:Math.max(area.minX,Math.min(area.maxX,position.x+1)),z:Math.max(area.minZ,Math.min(area.maxZ,position.z)),color:preview?.color||'mint'};
  previewDocument();return true;
}
function closePreview(){
  const old=preview?.blob;preview=null;client.updateConfig({mmlDocuments:worldDocuments});if(old)URL.revokeObjectURL(old);$('#creator').hidden=true;
}
$('#bridge').onclick=()=>state&&action('bridge.set','bridge',{raised:!state.entities.bridge.raised},state.entities.bridge.revision);
$('#plant').onclick=()=>{if(movePreview()){$('#creator').hidden=false;say('Elegí dónde dejar esta luz. Todavía la ves solamente vos.');}};
$('#preview-move').onclick=movePreview;
$('#preview-cancel').onclick=()=>{closePreview();say('La vista previa quedó descartada.');};
$('#preview-accept').onclick=async()=>{
  if(!preview)return;
  const args={x:preview.x,z:preview.z,color:preview.color};
  $('#preview-accept').disabled=true;
  const result=await action('garden.place',`garden-${crypto.randomUUID()}`,args,null);
  $('#preview-accept').disabled=false;
  if(result?.status==='completed')closePreview();
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
};
function openConversation(open){const panel=$('#conversation-panel');panel.hidden=!open;$('#talk').setAttribute('aria-expanded',String(open));if(open)$('#message').focus();else if(panel.contains(document.activeElement))document.activeElement.blur();}
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
$('#conversation-form').onsubmit=async event=>{
  event.preventDefault();if(nativeTurn||preparingConversation||state?.native?.available!==true)return;
  const text=$('#message').value;if(!text.trim())return;
  const capturedActor=state.actorRef,capturedRun=state.run;
  // Freeze this utterance's world view before waiting for an embedded viewer.
  // Walking, remote movement and newer drafts may continue during that wait.
  const local=client.getLocalCharacterState();
  const view=structuredClone({capturedAt:Date.now(),run:state.run,edition:state.edition,local:local?{userId:local.userId,connectionId:local.connectionId,position:local.position}:null,
    others:[...client.getCharacterStates().values()].filter(person=>!person.isLocal).slice(0,8).map(person=>({userId:person.userId,connectionId:person.connectionId,position:person.position}))});
  const appliedGeometry=geometryProbe?.snapshot();
  if(appliedGeometry)view.appliedGeometry=structuredClone(appliedGeometry);
  preparingConversation=true;updateNativeAvailability();
  let visitContext;
  try{visitContext=await contentVisitor.context();}finally{preparingConversation=false;}
  if(state.actorRef!==capturedActor||state.run!==capturedRun){updateNativeAvailability();say('El lugar o tu acceso cambió. Conservé tu mensaje para que lo revises.');return;}
  if(visitContext)view.contentVisit=visitContext;
  if(new TextEncoder().encode(JSON.stringify(view)).length>4096)delete view.appliedGeometry;
  if(new TextEncoder().encode(JSON.stringify(view)).length>4096){updateNativeAvailability();say('No pude conservar este contexto completo. Tu mensaje sigue escrito; acercate al contenido antes de intentar de nuevo.');return;}
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
  if(closed||document.hidden||refreshing)return;refreshing=true;
  try{await refresh();}catch{say('La conexión con el taller se interrumpió. Los cambios no se repetirán solos.');}
  finally{refreshing=false;}
},1500);
window.addEventListener('pagehide',()=>{closed=true;clearInterval(interval);contentVisitor.dispose();if(preview?.blob)URL.revokeObjectURL(preview.blob);worldAudio.dispose();client.dispose();});
refresh().catch(()=>say('No pude conectar con el taller.'));
