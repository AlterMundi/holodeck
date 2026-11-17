import { Networked3dWebExperienceClient, DefaultVirtualJoystickPlugin } from '@mml-io/3d-web-experience-client';
import { ThreeJSWorldRenderer } from '@mml-io/3d-web-threejs';
import { DirectionalLight } from 'three';
import { WORKSHOP } from './workshop.mjs';
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
    queueMicrotask(options.onInitialized);
    return renderer;
  },
  animationConfig:{airAnimationFileUrl:url('assets/anim_air.glb').href,idleAnimationFileUrl:url('assets/anim_idle.glb').href,
    jogAnimationFileUrl:url('assets/anim_jog.glb').href,sprintAnimationFileUrl:url('assets/anim_run.glb').href,doubleJumpAnimationFileUrl:url('assets/anim_double_jump.glb').href},
  loadingScreen:{title:'Holodeck',subtitle:'Abriendo el taller de las islas',background:'#20464c',color:'#f4e8cd'},
});
client.update();
// Development inspection surface only. It reports actual client state.
window.holodeckDevelopment={client};
const $=selector=>document.querySelector(selector);
const notice=$('#notice');
let state=null,pending=null,pendingMetadata=null,preview=null,lastChange=null,nativeTurn=null,closed=false;
const pendingKey=`holodeck.pending:${base.pathname}`;
const turnKey=`holodeck.turn:${base.pathname}`;
try{
  const saved=sessionStorage.getItem(pendingKey);
  if(saved&&saved.length<=4096){const value=JSON.parse(saved);if(typeof value.command?.id==='string'&&value.command.id.length<=80){pending=value.command;pendingMetadata=value;}}
}catch{/* An unreadable local record never causes an automatic mutation retry. */}
try{const id=sessionStorage.getItem(turnKey);if(id&&/^[\w-]{8,80}$/.test(id))nativeTurn={id,recovered:true};}
catch{/* Server active-turn discovery remains available. */}
let worldDocuments={workshop:{url:socket('world')}};
client.on('configChanged',config=>{
  if(config.mmlDocuments){worldDocuments={...config.mmlDocuments};delete worldDocuments.preview;}
});
function say(text){notice.textContent=text;}
async function api(path,body){
  const response=await fetch(url(`api/${path}`),{method:body===undefined?'GET':'POST',credentials:'same-origin',
    headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw Error(value.message||value.detail||'La acción no se pudo completar.');return value;
}
function updateNativeAvailability(){
  const available=state?.native?.available===true;
  $('#send').disabled=!available||!!nativeTurn;
  if(!nativeTurn){
    $('#companion-status').textContent=available?'Podemos conversar desde este lugar':'Exploración compartida';
    $('#conversation-hint').textContent=available?'Podés seguir recorriendo el mundo mientras transcurre mi turno.':'La conversación todavía no está conectada a este mundo.';
  }
}
async function refresh(){
  state=await api('state');
  const count=client.getCharacterStates().size;
  $('#people').textContent=count>1?`${count} exploradores en el taller`:'Un lugar para crear juntos';
  const compact=window.matchMedia('(max-width:740px)').matches;
  $('#bridge').textContent=state.entities.bridge.raised?(compact?'Separar':'Separar islas'):(compact?'Unir islas':'Conectar islas');
  $('#bridge').setAttribute('aria-label',state.entities.bridge.raised?'Separar las islas':'Conectar las islas');
  $('#undo').disabled=!lastChange||!!pending;
  if(!nativeTurn&&state.native?.active?.id){nativeTurn={id:state.native.active.id,recovered:true};try{sessionStorage.setItem(turnKey,nativeTurn.id);}catch{}}
  updateNativeAvailability();
  if(pending)await recoverCommand();
  if(nativeTurn)await readTurn();
}
function settleCommand(result){
  if(!pending||!['completed','rejected','failed'].includes(result.status))return false;
  if(result.status==='completed'){
    const undo=pendingMetadata?.undo;
    lastChange=undo?null:{type:pending.type,target:pending.target,previous:pendingMetadata?.previous,
      appliedRevision:pending.type==='garden.place'?1:pending.expectedRevision+1,run:pending.run};
    say(undo?'Tu cambio quedó deshecho.':'El cambio ya forma parte del mundo.');
  }else say('Ese lugar cambió. Mirá cómo quedó antes de intentarlo de nuevo.');
  pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);return true;
}
async function recoverCommand(){
  if(!pending)return;
  try{settleCommand(await api(`commands/${pending.id}`));}
  catch{say('Estoy comprobando si el cambio anterior llegó. No voy a repetirlo.');}
}
async function action(type,target,args,expectedRevision,{undo=false}={}){
  if(pending){say('Primero tengo que confirmar el cambio anterior.');return null;}
  try{
    const observation=await api('observe',{displayedSequence:null});
    const previous=observation.entities[target];
    pending={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type,target,args,expectedRevision};
    pendingMetadata={command:pending,previous,undo};
    try{sessionStorage.setItem(pendingKey,JSON.stringify(pendingMetadata));}
    catch{pending=null;pendingMetadata=null;say('El navegador no pudo guardar la confirmación pendiente. El cambio no se envió.');return null;}
    const result=await api('commands',pending);
    settleCommand(result);await refresh();return result;
  }catch(error){
    if(pending){
      say('Estoy comprobando si el cambio llegó. No voy a repetirlo.');
      try{const result=await api(`commands/${pending.id}`);settleCommand(result);await refresh();return result;}
      catch{/* Preserve uncertain ID in this session; never replay a mutation. */}
    }else say('No pude conectar con el taller. Probá de nuevo cuando vuelva la conexión.');
    return null;
  }
}
function previewDocument(){
  if(!preview)return;
  const color={mint:'#8ce4c2',amber:'#efc87a',rose:'#e8a2b9'}[preview.color];
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
function openConversation(open){$('#conversation-panel').hidden=!open;$('#talk').setAttribute('aria-expanded',String(open));if(open)$('#message').focus();}
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
  const result=await api(`interactions/${nativeTurn.id}`);
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
  if(phase==='completed'){
    nativeTurn=null;sessionStorage.removeItem(turnKey);updateNativeAvailability();
  }else if(phase==='problem'){if(result.message)say(result.message);nativeTurn=null;sessionStorage.removeItem(turnKey);updateNativeAvailability();}
}
$('#conversation-form').onsubmit=async event=>{
  event.preventDefault();if(nativeTurn||state?.native?.available!==true)return;
  const text=$('#message').value;if(!text.trim())return;
  const local=client.getLocalCharacterState();
  const view={local:local?{userId:local.userId,connectionId:local.connectionId,position:local.position}:null,
    others:[...client.getCharacterStates().values()].filter(person=>!person.isLocal).slice(0,8).map(person=>({userId:person.userId,connectionId:person.connectionId,position:person.position}))};
  nativeTurn={id:crypto.randomUUID(),text};$('#send').disabled=true;
  try{sessionStorage.setItem(turnKey,nativeTurn.id);}catch{nativeTurn=null;updateNativeAvailability();say('No pude conservar la referencia de este mensaje. No se envió.');return;}
  appendMessage(text,'human');$('#message').value='';$('#message').blur();
  try{const result=await api('interactions',{id:nativeTurn.id,text,displayedSequence:null,view});
    $('#companion-status').textContent=phases[result.phase]||phases.unknown;
    await readTurn();
  }catch{ $('#companion-status').textContent=phases.unknown; /* Inspect this same ID, never resubmit. */ }
};
// Escape closes panels; it does not interrupt a native turn or stop the world.
window.addEventListener('keydown',event=>{if(event.key==='Escape'){openConversation(false);if(preview)closePreview();}});
let refreshing=false;
const interval=setInterval(async()=>{
  if(closed||document.hidden||refreshing)return;refreshing=true;
  try{await refresh();}catch{say('La conexión con el taller se interrumpió. Los cambios no se repetirán solos.');}
  finally{refreshing=false;}
},1500);
window.addEventListener('pagehide',()=>{closed=true;clearInterval(interval);if(preview?.blob)URL.revokeObjectURL(preview.blob);client.dispose();});
refresh().catch(()=>say('No pude conectar con el taller.'));
