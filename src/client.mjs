import {RemoteDocumentWrapper} from '@mml-io/mml-web';
import {RoomSceneCache} from './room-scene-cache.mjs';
import {constrainInteriorCamera} from './interior-camera.mjs';
import {capWorldPixelRatio,usesLightGraphics} from './render-pixel-budget.mjs';
import {nearestCreationPosition} from './world-layout.mjs';
import { Networked3dWebExperienceClient, DefaultVirtualJoystickPlugin } from '@mml-io/3d-web-experience-client';
import { ThreeJSWorldRenderer } from '@mml-io/3d-web-threejs';
import { DirectionalLight, SpotLight } from 'three';
import { WORKSHOP, workshopColour } from './workshop.mjs';
import { saveIntent, loadIntent, archiveIntent, sameActor, nativeRetryRoute } from './client-intents.mjs';
import { NativeAvatarLayer } from './native-avatar.mjs';
import {PublicWorldPicker,WorldIndication} from './world-indication.mjs';
import { ContentVisitor } from './content-visitor.mjs';
import { GalleryModels } from './gallery-models.mjs';
import { CollectionShelves } from './collection-shelves.mjs';
import {applyGallerySigns} from './gallery-display.mjs';
import { BeaconControls } from './beacon-controls.mjs';
import {pickedRepresentationVisit} from './node-representations.mjs';
import { PlayableHUD } from './playable-hud.mjs';
import { IndoorGardenHUD } from './indoor-garden-hud.mjs';
import { indoorGardenContains,validIndoorGardenRecipe } from './indoor-garden-recipe.mjs';
import { OutdoorSky } from './outdoor-sky.mjs';
import { SignalGardenEditor } from './signal-garden-editor.mjs';
import { AppliedGeometryProbe } from './applied-geometry.mjs';
import { SharedConversationHost } from './shared-conversation-host.mjs';
import { WorldAudio } from './world-audio.mjs';
import {WorldHistory} from './world-history.mjs';
import { snapshotMayApply, sameRequest } from './client-order.mjs';
import { WorldNotice } from './client-feedback.mjs';
import {arrivalDoor,doorLocation,readSpace,showSpaceLinks} from './space-travel.mjs';
const base=new URL('./',document.baseURI);
const url=path=>new URL(path,base);
const socket=path=>{const target=url(path);target.protocol=location.protocol==='https:'?'wss:':'ws:';return target.href;};
const animations={airAnimationFileUrl:url('assets/anim_air.glb').href,idleAnimationFileUrl:url('assets/anim_idle.glb').href,
  jogAnimationFileUrl:url('assets/anim_jog.glb').href,sprintAnimationFileUrl:url('assets/anim_run.glb').href,doubleJumpAnimationFileUrl:url('assets/anim_double_jump.glb').href};
const appearanceDialog=document.querySelector('#appearance-dialog');
const appearanceChoice=document.querySelector('#appearance-choice');
const appearanceSave=document.querySelector('#appearance-save');
const appearanceStatus=document.querySelector('#appearance-status');
let appearanceGeneration=0;
async function requestAppearance(body){
  const response=await fetch(url('api/appearance'),body===undefined?{}:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  if(!response.ok)throw Error((await response.json().catch(()=>null))?.message||'La apariencia no está disponible en este momento.');
  return response.json();
}
async function readAppearance(body){
  const generation=++appearanceGeneration;
  appearanceChoice.disabled=appearanceSave.disabled=true;
  appearanceStatus.textContent=body?'Guardando…':'Cargando…';
  try{
    const {choice}=await requestAppearance(body);
    if(generation!==appearanceGeneration)return;
    appearanceChoice.value=choice??'';
    appearanceStatus.textContent=body?'Guardada.':'';
    appearanceChoice.disabled=appearanceSave.disabled=false;
  }catch(error){
    if(generation===appearanceGeneration)appearanceStatus.textContent=error.message;
  }
}
document.querySelector('#appearance-open').onclick=()=>{
  appearanceDialog.showModal();void readAppearance();
};
document.querySelector('#appearance-close').onclick=()=>appearanceDialog.close();
appearanceDialog.addEventListener('close',()=>{appearanceGeneration++;});
document.querySelector('#appearance-form').onsubmit=event=>{
  event.preventDefault();
  if(!appearanceSave.disabled)void readAppearance({choice:appearanceChoice.value===''?null:Number(appearanceChoice.value)});
};
window.addEventListener('keydown',event=>{
  if(appearanceDialog.open)event.stopImmediatePropagation();
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
let entering=true;
function worldEntered(){
  entering=false;
  window.dispatchEvent(new Event('holodeck:entered'));
}

class HolodeckExperienceClient extends Networked3dWebExperienceClient {
  disposeWithError(message){
    this.dispose();
    console.error('Holodeck connection ended',message);
    window.dispatchEvent(new Event('holodeck:entry-failed'));
  }
}

const rendererBudget={adaptive:true,startAtNative:matchMedia('(pointer: coarse)').matches,
  lightweight:usesLightGraphics(location.search)};

function entryRoomReady(root,model=root?.querySelector('m-model#room-art[src]')){
  return root?.isConnected===true&&(!model||model.modelGraphics?.hasLoadedModel()===true);
}

const entryLocation=new AbortController();
const entryDeadline=setTimeout(()=>entryLocation.abort(),12000);
let activeSpace;
try{activeSpace=await readSpace(entryLocation.signal);}
finally{clearTimeout(entryDeadline);}
if(activeSpace.id!=='outside'&&activeSpace.live!==1)startInterior(activeSpace);
else startWorld(activeSpace);

function startInterior(space){
  document.body.classList.add('inside-house');
  document.querySelector('#hud h1').textContent=space.title;
  document.querySelector('#people').textContent=space.level===0?'Planta baja':
    space.level<0?`Subsuelo ${-space.level}`:`Piso ${space.level}`;
  const notice=new WorldNotice(document.querySelector('#notice'));
  const beaconControls=benchControls();
  let galleryModels;
  const visitor=new ContentVisitor({document,window,base,scoped:true,
    onCatalog:entries=>{galleryModels?.sync(entries);applyGallerySigns(document.getElementById(space.id),entries);},
    say:(message,options)=>notice.show(message,options)});
  let exhibitRevision=space.exhibitRevision===undefined?null:String(space.exhibitRevision);
  const exhibitObserver=new MutationObserver(()=>{
    const current=document.querySelector('#house-exhibit')?.getAttribute('data-exhibit-revision')??null;
    if(current===exhibitRevision)return;
    exhibitRevision=current;
    visitor.catalog=visitor.loadCatalog();
  });
  exhibitObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-exhibit-revision']});
  const updateDoor=showSpaceLinks(space,{mapEnabled:false,canLeave:()=>visitor.allowLeaveRoom(),onError:message=>notice.show(message)});
  window.addEventListener('keydown',event=>{
    if(event.target instanceof Element&&event.target.closest('#exhibition-index')){event.stopImmediatePropagation();return;}
    if((beaconControls.opened||visitor.frame&&!visitor.panel.classList.contains('is-walking'))&&
       ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE'].includes(event.code)){
      if(!(event.target instanceof Element&&event.target.closest('button,input,select,textarea')))event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);
  const client=new HolodeckExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
    sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket(`spaces/${space.id}/network`),waitForWorldConfig:true,
    enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
    createRenderer:options=>{
      constrainInteriorCamera(options,()=>space.id);
      const renderer=new ThreeJSWorldRenderer({...options,config:{...options.config,spawnSun:false}});
      const frameBudget=capWorldPixelRatio(renderer,rendererBudget);
      galleryModels=new GalleryModels(renderer.mmlCompositionScene.group);
      galleryModels.sync(visitor.entries);
      const picker=new PublicWorldPicker({document,canvas:options.targetElement.querySelector(':scope > canvas'),
        scene:renderer.mmlCompositionScene.group,cameraState:()=>options.coreCameraManager.getCameraState(),
        gallery:()=>visitor.galleryTargets(galleryModels,document,client.getLocalCharacterState()?.position),
        onPick:({entry})=>visitor.openGallery(entry).catch(()=>notice.show('No pude abrir esta edición.'))});
      const render=renderer.render.bind(renderer),dispose=renderer.dispose.bind(renderer);
      const draw=renderer.composer.render.bind(renderer.composer);
      renderer.composer.render=()=>{if(!visitor.isOpeningOverWorld())draw();};
      renderer.render=state=>{
        const position=client.getLocalCharacterState()?.position;
        frameBudget.sample(!document.hidden&&!!position&&!visitor.isOpeningOverWorld());
        galleryModels.update();visitor.refreshScopedCatalog();updateDoor(position);visitor.update(position);
        beaconControls.update(space.objects,position);render(state);
        if(entering&&position&&entryRoomReady(document.getElementById(space.id)))worldEntered();
      };
      renderer.dispose=()=>{frameBudget.dispose();picker.dispose();galleryModels.clear();dispose();};
      queueMicrotask(options.onInitialized);return renderer;
    },
    animationConfig:animations,
    loadingScreen:{title:space.title,background:'#20464c',color:'#f4e8cd'}
  });
  client.update();
  window.holodeckDevelopment={client};
  window.addEventListener('pagehide',()=>{updateDoor.dispose?.();exhibitObserver.disconnect();beaconControls.clear();visitor.dispose();client.dispose();},{once:true});
}

function benchControls(){
  return new BeaconControls(document.querySelector('#beacon-control'),document.querySelector('#beacon-panel'),{
    statusButton:document.querySelector('#beacon-status-check'),statusText:document.querySelector('#beacon-status-text'),
  });
}

function startWorld(activeSpace){
const beaconControls=benchControls();
const garden=new IndoorGardenHUD({
  position:()=>client.getLocalCharacterState()?.position,
  onError:say,
  async read(room,{signal}){
    const result=await fetch(url('api/space/garden?'+new URLSearchParams({room})),{signal});
    return result.ok?result.json():null;
  },
  async act(command){
    const outcome=await fetch(url('api/space/garden'),{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(command),signal:AbortSignal.timeout(5000)}).catch(()=>null);
    if(outcome?.ok){
      const result=await outcome.json().catch(()=>null);
      if(result)return result;
    }else if(outcome&&outcome.status<500)return null;
    // Read this exact receipt after an uncertain transport. Never replay a signal automatically.
    const query=new URLSearchParams({room:command.room,result:command.id});
    const recovered=await fetch(url('api/space/garden?'+query),{signal:AbortSignal.timeout(5000)});
    return recovered.ok?recovered.json():null;
  }
});
let projectedGarden=null,signalEditor=null;
const hot=activeSpace?.live===1;
const sceneCache=hot?new RoomSceneCache(activeSpace.actorRef):null;
let inside=hot&&activeSpace.id!=='outside';
let updateDoor=()=>{},remoteScene=null,roomModel=null,networkScope=null,arrival=null;
let moving=false,requestingMove=false,needsSync=false,resyncing=false,moveDeadline=null,passageNotice=null;
let roomTopic;
let prefetched=new Set(),prefetchRequest=null,pendingRoomArt=null;
const setMoving=value=>{
  if(moving!==value){
    moving=value;
    document.body.classList.toggle('room-transition',value);
    $('#room-passage-message').textContent=value?'Cambiando de lugar…':'';
    $('#room-passage-retry').hidden=true;
    clearTimeout(passageNotice);
    if(value)passageNotice=setTimeout(()=>{
      $('#room-passage-message').textContent='Este lugar está tardando en cargar.';
      $('#room-passage-retry').hidden=false;
    },12000);
  }
  if(!value){clearTimeout(moveDeadline);moveDeadline=null;}
};
const removeScene=()=>{
  if(signalEditor?.draft?.mode)signalEditor.dismiss();
  pendingRoomArt=null;projectedGarden=null;beaconControls.clear();galleryModels?.clear();collectionShelves?.clear();remoteScene?.remove();remoteScene=roomModel=null;
};
function mountScene(){
  removeScene();
  if(!inside)return true;
  const stored=sceneCache.remember(activeSpace.scene);
  if(stored?.id!==activeSpace.id)return false;
  // The move acknowledgement can arrive before the old presence connection
  // closes. Keep the detached scene and mount it only for the new scope.
  if(networkScope!==activeSpace.id)return true;
  const renderer=client.getRenderer();
  const wrapper=new RemoteDocumentWrapper(url('api/space/scene').href,window,
    renderer.mmlCompositionScene.mmlScene,()=>{});
  remoteScene=wrapper.remoteDocument;
  remoteScene.append(stored.template.content.cloneNode(true));
  renderer.mmlTargetElement.append(remoteScene);
  roomModel=remoteScene.querySelector('m-model#room-art[src]');
  const source=roomModel?.getAttribute('src');
  const prefix=url('api/space/art/').pathname;
  if(!stored.art&&source?.startsWith(prefix)&&/^[a-f0-9]{64}\.glb$/.test(source.slice(prefix.length))){
    pendingRoomArt={stored,model:roomModel,source};
  }
  if(!contentVisitor?.catalogFlight){
    const entries=contentVisitor?.entries??[];
    galleryModels?.sync(entries);
    applyGallerySigns(remoteScene,entries);
  }
  return true;
}
// Keep one unattached loader handle only after the authorized model has loaded.
function keepRoomArt(){
  if(!pendingRoomArt||needsSync||networkScope!==activeSpace.id)return;
  const {stored,model,source}=pendingRoomArt;
  if(!model.modelGraphics?.hasLoadedModel())return;
  pendingRoomArt=null;
  const address=model.contentSrcToContentAddress(source);
  sceneCache.keepArt(stored,()=>model.getScene().getGraphicsAdapter().getResourceManager().loadModel(address));
}
// Cosmetic, non-colliding projection of the current server-authorized room.
function gardenMarkers(){
  if(!remoteScene)return;
  const game=garden.game;
  const version=game?game.room+':'+game.sequence:null;
  if(version===projectedGarden)return;
  remoteScene.querySelector('#indoor-garden-markers')?.remove();
  projectedGarden=version;
  if(!game)return;
  const template=document.createElement('template');
  const targets=game.targets.map(({x,z,radius,color},index)=>{
    const rim=workshopColour(color),light=workshopColour(game.signals[index]?.color);
    return `<m-group x="${x}" z="${z}">
      <m-cylinder radius="${radius}" height=".025" y=".12" color="${rim}" collide="false"></m-cylinder>
      <m-cylinder radius="${radius-.058}" height=".028" y=".131" color="#304e50" collide="false"></m-cylinder>
      ${light?`<m-sphere radius=".16" y=".27" color="${light}" collide="false"></m-sphere>`:''}
    </m-group>`;
  });
  template.innerHTML='<m-group id="indoor-garden-markers">'+targets.join('')+'</m-group>';
  remoteScene.append(template.content);
}
function onNear(destination){
  if(!sceneCache||moving||prefetchRequest||prefetched.has(destination)||sceneCache.revision(destination))return;
  prefetched.add(destination);
  const startedIn=activeSpace.id;
  const controller=new AbortController();prefetchRequest=controller;
  fetch(url('api/space/scene?'+new URLSearchParams({room:destination})),{
    credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)])
  }).then(response=>response.ok?response.json():null).then(scene=>{
    if(!controller.signal.aborted&&activeSpace.id===startedIn&&scene?.id===destination)sceneCache.remember(scene);
  }).catch(()=>{}).finally(()=>{if(prefetchRequest===controller)prefetchRequest=null;});
}
function applySpace(next,anchor){
  if(next.actorRef!==activeSpace.actorRef){sceneCache.clear();location.reload();return;}
  const changed=next.id!==activeSpace.id;
  const leavingOutside=activeSpace.id==='outside'&&next.id!=='outside';
  activeSpace=next;inside=next.id!=='outside';arrival=anchor;
  if(leavingOutside)client.getRenderer()?.setMMLConfiguration({},window.SESSION_TOKEN);
  stateRequest++;worldAudio.breakContinuity();
  prefetched=new Set();
  prefetchRequest?.abort();prefetchRequest=null;
  document.body.classList.toggle('inside-house',inside);
  document.body.classList.toggle('has-situated-conversation',inside&&next.sharedConversation===true);
  $('#hud h1').textContent=inside?next.title:'Plaza de llegada';
  $('#people').textContent=inside?(next.level===0?'Planta baja':next.level<0?`Subsuelo ${-next.level}`:`Piso ${next.level}`):'Un lugar para crear juntos';
  if(changed){roomTopic=undefined;contentVisitor.changeRoom(inside,next.id);worldIndication.selected=null;worldIndication.removeOutline();state=null;}
  else if(inside)contentVisitor.confirmRoom();
  if(anchor){
    const destination=new URL(location.href);
    destination.hash=doorLocation(anchor);
    history.replaceState(history.state,'',destination);
  }
  resetDoor();
  if(!mountScene()){sceneCache.clear();location.reload();}
  updateNativeAvailability();
  syncIndoorDesign();
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
    const returnedOutside=inside&&next.id==='outside';
    if(next.id!==activeSpace.id)contentVisitor.suspendRoom();
    applySpace(next,arrivalDoor(activeSpace,next));
    if(returnedOutside)say(contentVisitor.parked?'Volviste al exterior. Tu visita sigue guardada en esta pestaña.':
      'Volviste al exterior.',{transient:true});
  }).catch(()=>{if(!requestingMove)say('No pude confirmar tu ubicación.');})
    .finally(()=>{resyncing=false;});
}
function canFinishMove(){
  if(requestingMove||needsSync||networkScope!==activeSpace.id||!client.getLocalCharacterState())return false;
  // The receiving scope is confirmed. A slow model can finish on this page.
  clearTimeout(moveDeadline);moveDeadline=null;
  if(inside?!entryRoomReady(remoteScene,roomModel):!geometryProbe?.snapshot())return false;
  if(arrival){
    const {x,y,z,yaw,facing}=arrival;
    client.updateConfig({spawnConfiguration:{spawnPosition:{x,y,z},spawnYRotation:-(yaw??facing*90)}});
    client.respawn();arrival=null;
    return false;
  }
  // Called after rendering. The respawn branch above already waits for the
  // next rendered frame, so one ready frame at the new anchor is sufficient.
  return true;
}
function resetDoor(){
  updateDoor.dispose?.();
  $('#house-door').hidden=true;$('#house-door').disabled=false;
  if(!activeSpace)return;
  updateDoor=showSpaceLinks(activeSpace,{
    canLeave:()=>{
      if(moving)return false;
      if(signalEditor?.active){say('Guardá o cerrá el diseño antes de cambiar de lugar.');return false;}
      if(inside)return contentVisitor.allowLeaveRoom();
      if((contentVisitor.frame&&!contentVisitor.parked)||nativeTurn||pending||preview||signalEditor.active||$('#message').value.trim()){
        say('Tenés una visita, un borrador o un envío abierto. Retomalo antes de cambiar de lugar.');
        return false;
      }
      return true;
    },
    onError:say,
    ...(hot?{
      revision:destination=>sceneCache.revision(destination),
      onNear,
      onAccessLost:()=>{needsSync=true;sceneCache.clear();updateDoor.suspend?.();removeScene();},
      onDoorDenied:destination=>{
        sceneCache.forget(destination);
        if(inside){updateDoor.suspend?.();queueMicrotask(()=>syncCurrent());}
      },
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
  if(event.target instanceof Element&&event.target.closest('#exhibition-index')){event.stopImmediatePropagation();return;}
  if((beaconControls.opened||hot&&(moving||inside&&contentVisitor?.frame&&!contentVisitor.panel.classList.contains('is-walking')))&&
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
      if(event.target.closest('#space-travel')){
        $('#space-travel').open=false;$('#space-travel summary').focus();
      }
      else if(event.target.closest('#creator')){closePreview();say('La vista previa quedó descartada.',{transient:true});}
      else openConversation(false);
      event.target.blur();
    }
  }
},true);
const playableHUD=new PlayableHUD(document);
let geometryProbe=null,nativeAvatarLayer=null,contentVisitor=null,galleryModels=null,collectionShelves=null,preparingConversation=false,worldPicker=null,worldIndication=null,state=null,sharedConversation=null,worldHistory=null;
const client=new HolodeckExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
  sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket(hot?'active/network':'network'),waitForWorldConfig:true,
  enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
  // Upstream's default sun allocates an 8192² shadow map. This small world uses
  // the public renderer factory and a bounded 1024² light instead, on all clients.
  createRenderer:options=>{
    constrainInteriorCamera(options,()=>inside&&activeSpace?.id);
    const renderer=new ThreeJSWorldRenderer({...options,config:{...options.config,spawnSun:false}});
    const frameBudget=capWorldPixelRatio(renderer,rendererBudget);
    galleryModels=new GalleryModels(renderer.mmlCompositionScene.group);
    collectionShelves=new CollectionShelves({base,scene:renderer.mmlCompositionScene.group,panel:document.querySelector('#collection-shelf')});
    const sky=new OutdoorSky(renderer.mmlCompositionScene.group.parent,base);
    const light=new DirectionalLight(0xffefd6,1.8);
    light.position.set(12,22,10);light.target.position.set(0,0,-6);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);
    Object.assign(light.shadow.camera,{left:-38,right:38,top:32,bottom:-32,near:.1,far:75});
    // The wide outdoor map needs a surface offset large enough for the
    // facade's grazing angles. Preserve the building's cast shadows.
    light.shadow.normalBias=.095;
    const interiorKey=new SpotLight(0xffffff,160,13,.88,.62);
    interiorKey.visible=false;
    interiorKey.castShadow=true;
    interiorKey.shadow.mapSize.set(1024,1024);
    Object.assign(interiorKey.shadow.camera,{near:.48,far:13});
    interiorKey.shadow.bias=-.00015;
    interiorKey.shadow.normalBias=.02;
    renderer.mmlCompositionScene.group.add(light,light.target,interiorKey,interiorKey.target);
    let selectedKey=null;
    geometryProbe=new AppliedGeometryProbe({document,scene:renderer.mmlCompositionScene.group,
      canvas:options.targetElement.querySelector(':scope > canvas'),expectedDocumentURL:socket('world')});
    nativeAvatarLayer=new NativeAvatarLayer({document,base,onFailure:message=>say(message)});
    worldPicker=new PublicWorldPicker({document,canvas:options.targetElement.querySelector(':scope > canvas'),scene:renderer.mmlCompositionScene.group,
      cameraState:()=>options.coreCameraManager.getCameraState(),proof:()=>geometryProbe?.snapshot(),
      gallery:()=>inside?(moving||!remoteScene?new Map():contentVisitor.galleryTargets(galleryModels,remoteScene,
        client.getLocalCharacterState()?.position)):null,
      onPick:record=>{
        if(record.kind==='gallery')contentVisitor.openGallery(record.entry).catch(()=>say('No pude abrir esta edición.'));
        else if(record.kind==='content')contentVisitor?.openNode(record.node).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'));
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
    const draw=renderer.composer.render.bind(renderer.composer);
    let drawWorld=true;
    // The renderer and room stay mounted. Do not contend for the same frame
    // budget while an opaque, still-inert Nexus visit starts its renderer.
    renderer.composer.render=()=>{if(drawWorld)draw();};
    const exteriorAddress=socket('world');
    const arrivalAddress=socket('world?dressing=arrival');
    let coldExterior=hot&&!inside;
    if(hot){
      const configure=renderer.setMMLConfiguration.bind(renderer);
      renderer.setMMLConfiguration=(configuration,token)=>{
        if(configuration.interior){
          coldExterior=false;
          geometryProbe.expectedDocumentURL=exteriorAddress;
          return configure({},token);
        }
        if(!coldExterior||!configuration.workshop)return configure(configuration,token);
        geometryProbe.expectedDocumentURL=arrivalAddress;
        return configure({...configuration,workshop:{...configuration.workshop,url:arrivalAddress}},token);
      };
    }
    let nextDressing=0;
    renderer.render=renderState=>{
      const position=client.getLocalCharacterState()?.position;
      drawWorld=!contentVisitor?.isOpeningOverWorld();
      frameBudget.sample(drawWorld&&!document.hidden&&!!position&&!moving&&!needsSync&&(!hot||networkScope===activeSpace.id));
      light.visible=!inside||!activeSpace.indoorLighting;
      const key=inside&&activeSpace.keyLight||null;
      if(key!==selectedKey){
        selectedKey=key;
        interiorKey.visible=!!key;
        if(key){
          interiorKey.position.set(...key.position);
          interiorKey.target.position.set(...key.target);
          interiorKey.color.set(key.color);
          interiorKey.intensity=key.intensity??160;
        }
      }
      const skySelection=activeSpace?.outdoorSky;
      // Wait for the scoped room model to occlude the background outside its
      // authored apertures. Disconnect removes the scene and clears this view.
      const roomSkyReady=skySelection&&networkScope===activeSpace.id&&remoteScene?.isConnected&&
        roomModel?.modelGraphics?.hasLoadedModel();
      sky.update(!inside||roomSkyReady?skySelection:null);
      nativeAvatarLayer.update();
      galleryModels.update();
      const collectionRoom=inside&&!moving&&activeSpace.collectionShelves?activeSpace.id:null;
      collectionShelves.update(collectionRoom,collectionRoom?remoteScene:null,position);
      garden.update(inside&&!moving&&activeSpace.playableInterior?activeSpace.id:null);gardenMarkers();
      if(!inside){worldIndication?.update();if(!moving)playableHUD.update(position);}
      if(!moving){
        if(inside)contentVisitor?.refreshScopedCatalog();
        contentVisitor?.update(position);
        updateDoor(position,()=>options.coreCameraManager.getCameraState().rotation);
      }
      beaconControls.update(inside&&!moving&&remoteScene?activeSpace.objects:null,position);
      render(renderState);
      if(!inside&&drawWorld)geometryProbe.afterRender();
      else if(inside)keepRoomArt();
      if(hot&&moving&&canFinishMove())setMoving(false);
      if(entering&&drawWorld&&position&&!moving&&!needsSync&&
         (inside?entryRoomReady(remoteScene,roomModel):geometryProbe?.snapshot()))worldEntered();
      const now=performance.now();
      if(coldExterior&&position&&!inside&&!moving&&!needsSync&&networkScope===activeSpace.id&&now>=nextDressing){
        nextDressing=now+350;
        const pending='#workshop m-model[data-deferred-src]:not([src])';
        const model=document.querySelector(pending+'[id^="facade-"]')??document.querySelector(pending);
        const source=model?.getAttribute('data-deferred-src');
        if(source?.startsWith(url('assets/').pathname))model.setAttribute('src',source);
      }
    };
    renderer.dispose=()=>{frameBudget.dispose();removeScene();sceneCache?.clear();worldPicker.dispose();worldIndication.dispose();nativeAvatarLayer.dispose();geometryProbe.dispose();sky.dispose();interiorKey.dispose();dispose();};
    queueMicrotask(options.onInitialized);
    return renderer;
  },
  animationConfig:animations,
  loadingScreen:{title:'Holodeck',subtitle:'Abriendo la plaza',background:'#20464c',color:'#f4e8cd'},
});
client.update();
const worldAudio=new WorldAudio({onChange:()=>updateSoundButton()});
let soundBusy=false;
// Development inspection surface only. It reports actual client state.
window.holodeckDevelopment={client,appliedGeometry:()=>geometryProbe?.snapshot()||null,audioState:()=>worldAudio.status(),avatarState:()=>nativeAvatarLayer?.status()};
const $=selector=>document.querySelector(selector);
const notice=$('#notice');
const worldNotice=new WorldNotice(notice);
contentVisitor=new ContentVisitor({document,window,base,say,scoped:inside,roomId:hot?activeSpace.id:null,onCatalog:entries=>{
  if(remoteScene){galleryModels?.sync(entries);applyGallerySigns(remoteScene,entries);}
}});
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
  if(kind==='command'){
    signalEditor.untrack(pending.id);pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);
  }
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
const roomObjects=()=>inside?(activeSpace?.objects??[]).filter(object=>
  (object.kind==='fixture'||object.kind==='workstation')&&Number.isSafeInteger(object.revision)):[];
function roomSubject(objects=roomObjects()){
  const station=beaconControls.reference()||contentVisitor?.reference();
  const selected=roomTopic===undefined?station:roomTopic;
  return selected&&objects.find(object=>object.id===selected.id&&object.revision===selected.revision);
}
function syncRoomTopic(){
  const objects=roomObjects(),label=$('#room-topic'),select=$('#room-topic-choice');
  label.hidden=!sharedSurface()||!objects.length;
  if(label.hidden)return;
  const entries=[['','Este lugar'],...objects.map(object=>[object.id,object.title])];
  const signature=JSON.stringify(entries);
  if(signature!==select.dataset.topics){
    select.dataset.topics=signature;
    select.replaceChildren(...entries.map(([id,title])=>{
      const option=document.createElement('option');option.value=id;option.textContent=title;return option;
    }));
  }
  select.value=roomSubject(objects)?.id??'';
}
$('#room-topic-choice').onchange=event=>{
  const item=roomObjects().find(object=>object.id===event.target.value);
  roomTopic=item?{id:item.id,revision:item.revision}:null;
};
function updateNativeAvailability(){
  const available=state?.native?.available===true;
  const shared=sharedSurface();
  syncRoomTopic();
  $('#talk').disabled=inside&&!shared;
  $('#conversation-panel').classList.toggle('shared-conversation',shared);
  $('#conversation-form').hidden=shared;$('#conversation-log').hidden=shared;
  $('#shared-conversation').hidden=!shared;
  const historyLabel=inside?null:worldHistory?.conversationLabel();$('#history-reference-clear').hidden=!historyLabel;
  const hint=$('#conversation-hint'),historyHint=historyLabel?`Tema de la próxima intervención: ${historyLabel}.`:'';
  hint.hidden=shared&&!historyLabel;
  if(shared){hint.textContent=historyHint;return;}
  hint.textContent=(historyHint?historyHint+' ':'')+((available||nativeTurn)?'Podés seguir recorriendo el mundo mientras transcurre mi turno.':'La conversación todavía no está conectada a este mundo.');
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
  state=incoming;contentVisitor.syncNodes(state.nodes);playableHUD.sync(state.nodes,state.actorRef,state.canEdit===true);
  if(activeSpace?.id==='outside'&&Array.isArray(state.entrances)&&
    JSON.stringify(activeSpace.entrances)!==JSON.stringify(state.entrances)){
    activeSpace={...activeSpace,entrances:state.entrances};resetDoor();
  }
  $('#garden-create').hidden=state.canEdit!==true;
  worldAudio.observe(state,{continuityVersion});worldHistory.observe(state);
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
  }else if(result.status==='completed'&&pending.type.startsWith('node.')){
    say(pending.type==='node.remove'?'El jardín se retiró del mundo.':'El jardín ya forma parte del mundo.',{transient:true});
  }else if(result.status==='completed'){
    const undo=pendingMetadata?.undo;
    lastChange=undo?null:{type:pending.type,target:pending.target,previous:pendingMetadata?.previous,
      appliedRevision:pending.type==='garden.place'?1:pending.expectedRevision+1,run:pending.run};
    say(undo?'Tu cambio quedó deshecho.':'El cambio ya forma parte del mundo.',{transient:true});
  }else say('Ese lugar cambió. Mirá cómo quedó antes de intentarlo de nuevo.');
  const id=pending.id;
  pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);clearRecovery('command');
  signalEditor.settle(id,result.status);return true;
}
async function recoverCommand(){
  if(!pending)return;
  const id=pending.id;
  try{const result=await api(`commands/${id}`);if(sameRequest(pending,id))settleCommand(result);}
  catch(error){if(sameRequest(pending,id))noteRecovery('command',error);}
}
async function action(type,target,args,expectedRevision,{undo=false,selection=null,onPending=null}={}){
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
    onPending?.(submittedId);
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
$('#plant').onclick=()=>{if(signalEditor.active){say('Guardá o descartá el jardín antes de crear una luz.');return;}closePreview();if(movePreview()){showPreview();say('Elegí dónde dejar esta luz. Todavía la ves solamente vos.');}};
let signalPreview=null,signalMarkup=null;
const indoorSaveKey='holodeck:indoor-design:'+base.pathname;
let indoorReading=false;
const editorRoom=()=>inside&&activeSpace.playableInterior===true?
  {room:activeSpace.id,actorRef:activeSpace.actorRef}:null;
const designScope=()=>activeSpace.canDesignGarden===true?editorRoom():null;
const sameDesign=(a,b)=>!!a&&!!b&&a.room===b.room&&a.actorRef===b.actorRef;
const indoorSaveSlot=scope=>indoorSaveKey+scope.room;
function pendingIndoorSave(scope){
  if(!scope)return null;
  try{
    const pending=loadIntent(sessionStorage,indoorSaveSlot(scope),512);
    return sameDesign(scope,pending)&&typeof pending.id==='string'?pending:null;
  }catch{return null;}
}
function syncIndoorDesign(){
  const pending=pendingIndoorSave(editorRoom());
  $('#indoor-design-tools').hidden=!pending&&!designScope();
  $('#indoor-design').textContent=pending?'Comprobar guardado':'Diseñar jardín';
  $('#indoor-design-forget').hidden=!pending;
}
function clearIndoorSave(scope,id){
  if(pendingIndoorSave(scope)?.id===id)sessionStorage.removeItem(indoorSaveSlot(scope));
  syncIndoorDesign();
}
async function readIndoorSave(command){
  const response=await fetch(url('api/space/garden?'+new URLSearchParams({room:command.room,result:command.id})),
    {signal:AbortSignal.timeout(5000)}).catch(()=>null);
  const receipt=response?.ok?await response.json().catch(()=>null):null;
  return receipt?.room===command.room&&Number.isSafeInteger(receipt.revision)?receipt:null;
}
async function saveIndoorDesign(node,args,track,mode){
  const command={type:'garden.put',id:crypto.randomUUID(),room:mode.room,
    expectedRevision:node?.revision??null,title:args.title,play:args.play};
  if(!sameDesign(mode,designScope()))return;
  try{saveIntent(sessionStorage,indoorSaveSlot(mode),
    {id:command.id,room:command.room,actorRef:mode.actorRef},512);}
  catch{say('No pude guardar el seguimiento del diseño. No se publicó.');return;}
  track(command.id);
  const response=await fetch(url('api/space/garden'),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(command),signal:AbortSignal.timeout(5000)}).catch(()=>null);
  const receipt=response?.ok?await response.json().catch(()=>null):null;
  const confirmed=receipt?.room===mode.room||(!response||response.ok||response.status>=500)&&await readIndoorSave(command);
  if(confirmed){
    clearIndoorSave(mode,command.id);
    signalEditor.settle(command.id,'completed');
    if(sameDesign(mode,designScope())&&garden.room===mode.room){
      garden.nextRead=0;void garden.refresh();
    }
    say('Jardín publicado.',{transient:true});
  }else if(response&&!response.ok&&response.status<500){
    clearIndoorSave(mode,command.id);
    signalEditor.settle(command.id,'conflict');
  }else syncIndoorDesign();
}
$('#indoor-design').onclick=async()=>{
  const scope=editorRoom();
  if(!scope||moving||indoorReading||signalEditor.active)return;
  indoorReading=true;
  try{
    const pending=pendingIndoorSave(scope);
    if(pending){
      if(await readIndoorSave(pending)){clearIndoorSave(scope,pending.id);say('El jardín quedó publicado.',{transient:true});}
      else say('Todavía no pude confirmar el guardado. Podés comprobarlo de nuevo.');
      return;
    }
    if(!sameDesign(scope,designScope()))return;
    const response=await fetch(url('api/space/garden-editor?'+new URLSearchParams({room:scope.room})),
      {signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Access unavailable');
    const source=await response.json();
    if(sameDesign(scope,designScope())&&!moving&&source.room===scope.room)
      signalEditor.open(source.garden,{...scope,contains:indoorGardenContains,validRecipe:validIndoorGardenRecipe,radius:.45});
  }catch{say('No pude abrir el editor de este jardín. Revisá tu acceso.');}
  finally{indoorReading=false;}
};
$('#indoor-design-forget').onclick=()=>{
  const scope=editorRoom(),pending=pendingIndoorSave(scope);
  if(indoorReading||!pending)return;
  clearIndoorSave(scope,pending.id);say('Cerraste el seguimiento. El guardado anterior puede haber quedado publicado.');
};
signalEditor=new SignalGardenEditor({document,
  position:()=>client.getLocalCharacterState()?.position,
  allowed:(node,mode)=>mode?sameDesign(mode,designScope())&&!moving:!inside&&!preview&&state?.canEdit===true&&
    (!node||!node.deleted&&state.nodes?.[node.id]?.revision===node.revision&&state.nodes[node.id].owner===state.actorRef),
  save:(node,args,target,onPending,mode)=>mode?saveIndoorDesign(node,args,onPending,mode):
    action(node?'node.update':'node.place',target,args,node?.revision??null,{onPending}),
  remove:(node,onPending)=>action('node.remove',node.id,{},node.revision,{onPending}),
  preview:(targets,mode)=>{
    const markup=targets?.map(({x,z,radius,color})=>`<m-cylinder x="${x}" y=".124" z="${z}" radius="${radius}" height=".02" color="${workshopColour(color)}" opacity=".44" collide="false"></m-cylinder>`).join('')??null;
    if(mode){
      const prior=remoteScene?.querySelector('#indoor-design-preview');
      if(prior?.innerHTML===markup)return;
      prior?.remove();
      if(markup&&remoteScene&&sameDesign(mode,designScope())){
        const group=document.createElement('m-group');group.id='indoor-design-preview';
        group.innerHTML=markup;remoteScene.append(group);
      }
      return;
    }
    if(markup===signalMarkup)return;
    const old=signalPreview;signalMarkup=markup;
    signalPreview=markup?URL.createObjectURL(new Blob([markup],{type:'text/html'})):null;
    client.updateConfig({mmlDocuments:signalPreview?{...worldDocuments,preview:{url:signalPreview}}:worldDocuments});
    if(old)URL.revokeObjectURL(old);
  },
});
$('#garden-create').onclick=()=>{if(!signalEditor.active)signalEditor.open();};
$('#play-edit').onclick=()=>{const node=state?.nodes?.[playableHUD.selected];if(node?.play&&!signalEditor.active)signalEditor.open(node);};
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
    const subject=roomSubject();
    const visit=contentVisitor.reference();
    return structuredClone({capturedAt:Date.now(),spaceId:capturedSpace,local:position?{position}:null,
      ...(subject?{roomObject:{id:subject.id,revision:subject.revision}}:{}),
      ...(visit?{roomVisit:visit}:{})});
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
window.addEventListener('keydown',event=>{if(event.key==='Escape'){openConversation(false);if(preview)closePreview();signalEditor.close();}});
let refreshing=false;
const interval=setInterval(async()=>{
  if(closed||inside||document.hidden||refreshing)return;refreshing=true;
  try{await refresh();}catch{say('La conexión con el taller se interrumpió. Los cambios no se repetirán solos.');}
  finally{refreshing=false;}
},1500);
window.addEventListener('pagehide',()=>{closed=true;clearInterval(interval);sharedConversation?.dispose();beaconControls.clear();garden.dispose();contentVisitor.dispose();worldHistory.dispose();if(preview?.blob)URL.revokeObjectURL(preview.blob);if(signalPreview)URL.revokeObjectURL(signalPreview);worldAudio.dispose();client.dispose();});
refresh().catch(()=>say('No pude conectar con el taller.'));
resetDoor();
syncIndoorDesign();
if(hot){
  if(inside){applySpace(activeSpace,null);setMoving(true);}
  client.getWorldConnection().addEventListener(event=>{
    if(event.type==='disconnected'){
      networkScope=null;
      updateDoor.suspend?.();
      removeScene();
      setMoving(true);
      if(!requestingMove&&!moveDeadline){
        needsSync=true;sceneCache.clear();
        prefetchRequest?.abort();prefetchRequest=null;prefetched.clear();
        contentVisitor.suspendRoom();
      }
    }else if(event.type==='world_config'){
      const config=event.config.mmlDocuments;
      networkScope=config?.interior?.url.split('/').at(-2)??(config?.workshop?'outside':null);
      if(needsSync)syncCurrent();
      else if(moving&&!requestingMove&&networkScope===activeSpace.id){
        resetDoor();
        if(inside&&!remoteScene)mountScene();
      }
    }
  });
}
}
