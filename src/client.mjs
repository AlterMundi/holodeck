import {WorldViewCapture} from './world-view-capture.mjs';
import {AvatarPosePresence,signAvatarPresence} from './avatar-pose-presence.mjs';
import {tabletopPointBroadcast,tabletopPointProofMessage} from './tabletop-pointing.mjs';
import {TabletopPointView} from './tabletop-point-view.mjs';
import {bindHudAppearance} from './hud-appearance.mjs';
import {selectedHudLook} from './hud-look-preview.mjs';
import {ToroidalScenery} from './toroidal-scenery.mjs';
import {ToroidalAtmosphere,toroidalViewDepth} from './toroidal-atmosphere.mjs';
import {toroidalSky} from './quintana-celestial.mjs';
import {nightSkyKey} from './toroidal-solar-clock.mjs';
import {bindLocalRain} from './local-rain.mjs';
import {bindAvatarPracticals} from './avatar-practicals.mjs';
import {bindToroidalHouseLight} from './toroidal-house-light.mjs';
import {bindFoyerFloorFinish} from './foyer-floor-finish.mjs';
import {ToroidalCave} from './toroidal-cave.mjs';
import {TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';
import {TOROIDAL_SUN,ToroidalTerrainRenderer,toroidalSunDirection} from './toroidal-terrain-renderer.mjs';
import {bindFlightSpaceGesture} from './flight-space-gesture.mjs';
import {bindToroidalMml} from './toroidal-mml.mjs';
import {FlightWake} from './flight-wake.mjs';
import {WaterSplash} from './water-splash.mjs';
import {exteriorSample} from './avatar-medium.mjs';
import {WaterWake} from './water-wake.mjs';
import {bindFlightAvatarAnimation} from './flight-avatar-animation.mjs';
import {LoadingProgressManager,RemoteDocumentWrapper} from '@mml-io/mml-web';
import {RoomSceneCache,roomArtURL} from './room-scene-cache.mjs';
import {bindInteriorHeadroom} from './avatar-headroom.mjs';
import {CharacterReviewFlight,matterInspectionCamera} from './character-review-camera.mjs';
import {bindMatterFlight,bindMatterHologram} from './matter-flight.mjs';
import {matterInspectionNear} from './matter-contact.mjs';
import {constrainInteriorCamera} from './interior-camera.mjs';
import {capWorldPixelRatio,usesLightGraphics} from './render-pixel-budget.mjs';
import {bindVideoSettings} from './video-settings.mjs';
import {BackgroundFocus} from './background-focus.mjs';
import {showSettingsDialog} from './settings-hud.mjs';
import {WorldActionLabel} from './world-action-label.mjs';
import {bindOrbitalMatterGlazing,useLightweightMatterGlazing} from './matter-glazing.mjs';
import {bindMatterStyle,loadMatterStyleImages} from './matter-style.mjs';
import {projectRoomSurface} from '../art/collection/appearance-study/viewer/surface-projection.mjs';
import {nearestCreationPosition} from './world-layout.mjs';
import { Networked3dWebExperienceClient, DefaultVirtualJoystickPlugin } from '@mml-io/3d-web-experience-client';
import { ThreeJSWorldRenderer } from '@mml-io/3d-web-threejs';
import { Color, DirectionalLight, PCFShadowMap, SpotLight, Vector3 } from 'three';
import { WORKSHOP, workshopColour } from './workshop.mjs';
import { saveIntent, loadIntent, archiveIntent, sameActor, nativeRetryRoute } from './client-intents.mjs';
import { NativeAvatarLayer } from './native-avatar.mjs';
import {CompanionAvatar} from './companion-avatar.mjs';
import {PublicWorldPicker,WorldIndication} from './world-indication.mjs';
import {bindTabletopAttention} from './tabletop-attention.mjs';
import { ContentVisitor } from './content-visitor.mjs';
import { GalleryModels } from './gallery-models.mjs';
import { CollectionShelves } from './collection-shelves.mjs';
import { MatterWorktableHud } from './matter-worktable-hud.mjs';
import {CharacterWorktable} from './character-worktable.mjs';
import { ConversationDisplay } from './conversation-display.mjs';
import { bindHudPanelWindow } from './hud-panel-window.mjs';
import { bindWorldOrbitInput } from './world-orbit-input.mjs';
import { bindToroidalMinimap } from './toroidal-minimap.mjs';
import {applyGallerySigns} from './gallery-display.mjs';
import { BeaconControls } from './beacon-controls.mjs';
import {pickedRepresentationVisit} from './node-representations.mjs';
import { PlayableHUD } from './playable-hud.mjs';
import { IndoorGardenHUD } from './indoor-garden-hud.mjs';
import { indoorGardenContains,validIndoorGardenRecipe } from './indoor-garden-recipe.mjs';
import { OutdoorSky } from './outdoor-sky.mjs';
import { SignalGardenEditor } from './signal-garden-editor.mjs';
import { AppliedGeometryProbe } from './applied-geometry.mjs';
import {mountPendingBook} from './pending-book.mjs';
import {pendingToolId} from './pending-book-hud.mjs';
import { SharedConversationHost } from './shared-conversation-host.mjs';
import { WorldAudio } from './world-audio.mjs';
import {WorldHistory} from './world-history.mjs';
import { snapshotMayApply, sameRequest } from './client-order.mjs';
import { WorldNotice } from './client-feedback.mjs';
import {arrivalDoor,doorLocation,readSpace,showSpaceLinks} from './space-travel.mjs';
import {ATELIER_FOYER,CHARACTER_STUDIO,characterWorktable} from './house-review-rooms.mjs';
const reviewedHudLook=selectedHudLook(location.href);
if(reviewedHudLook)document.body.dataset.hudLook=reviewedHudLook;
bindHudAppearance(document,window);

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
    const {choice,personalDefault}=await requestAppearance(body);
    if(generation!==appearanceGeneration)return;
    appearanceChoice.options[0].textContent=personalDefault?'Explorador':'Automática';
    appearanceChoice.value=choice??'';
    appearanceStatus.textContent=body?'Guardada.':'';
    appearanceChoice.disabled=appearanceSave.disabled=false;
  }catch(error){
    if(generation===appearanceGeneration)appearanceStatus.textContent=error.message;
  }
}
document.querySelector('#appearance-open').onclick=()=>{
  showSettingsDialog(appearanceDialog);void readAppearance();
};
document.querySelector('#appearance-close').onclick=()=>appearanceDialog.close();
appearanceDialog.addEventListener('close',()=>{if(!appearanceDialog.open)appearanceGeneration++;});
document.querySelector('#appearance-form').onsubmit=event=>{
  event.preventDefault();
  if(!appearanceSave.disabled)void readAppearance({choice:appearanceChoice.value===''?null:Number(appearanceChoice.value)});
};
window.addEventListener('keydown',event=>{
  if(appearanceDialog.open&&!appearanceDialog.hasAttribute('data-native-settings'))event.stopImmediatePropagation();
},true);
const physicalMoves=new Map([['KeyW','w'],['KeyA','a'],['KeyS','s'],['KeyD','d']]);
const physicalControls=new Map([['AltLeft','alt'],['AltRight','alt'],['ShiftLeft','shift'],['ShiftRight','shift'],['Space',' ']]);
const editorOwns=event=>event.target?.closest?.('input,textarea,select,[contenteditable]');
const interactiveOwns=event=>editorOwns(event)||
  event.target?.closest?.('button,summary,a[href],[role="button"],[tabindex]:not(canvas)');
function bindWorldKeyShortcuts(keys){
  if(!keys)return;
  const listen=new AbortController(),pressed=new Map(),metaKeys=new Set();
  const clear=()=>{
    for(const key of pressed.values())keys.keys.set(key,false);
    pressed.clear();
    metaKeys.clear();
  };
  document.addEventListener('keydown',event=>{
    if(event.code==='MetaLeft'||event.code==='MetaRight'){
      pressed.clear();
      keys.keys.clear();
      metaKeys.add(event.code);
      return;
    }
    if(interactiveOwns(event)||!keys.shouldCaptureKeyPress())return;
    const control=physicalControls.get(event.code);
    const physicalAlt=pressed.has('AltLeft')||pressed.has('AltRight');
    // Some layouts report Shift+Alt as Meta even though the key code is
    // AltLeft. Recognize the physical chord without claiming browser shortcuts.
    if(event.ctrlKey||metaKeys.size||event.getModifierState('AltGraph')||
       (event.metaKey&&control!=='alt'&&!physicalAlt)){
      event.stopImmediatePropagation();
      return;
    }
    const key=control??((event.altKey||physicalAlt)?physicalMoves.get(event.code):null);
    if(key){
      keys.keys.set(key,true);
      pressed.set(event.code,key);
      event.preventDefault();
      event.stopImmediatePropagation();
    }else if((event.altKey||physicalAlt)&&['ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  },{capture:true,signal:listen.signal});
  document.addEventListener('keyup',event=>{
    if(metaKeys.delete(event.code))return;
    const key=pressed.get(event.code);
    if(key){
      pressed.delete(event.code);
      keys.keys.set(key,[...pressed.values()].includes(key));
      if(!interactiveOwns(event)&&keys.shouldCaptureKeyPress())event.preventDefault();
      event.stopImmediatePropagation();
    }else if(event.altKey){
      const movement=physicalMoves.get(event.code);
      if(movement)keys.keys.set(movement,false);
    }
  },{capture:true,signal:listen.signal});
  window.addEventListener('blur',clear,{signal:listen.signal});
  return ()=>{listen.abort();clear();};
}
function keepWorldTab(event){
  if(event.cancelable&&event.ctrlKey&&!event.altKey&&!event.metaKey&&
     event.code==='KeyW'&&!editorOwns(event))event.preventDefault();
}
const touchControls={
  mount(container,experience){
    this.holder=document.createElement('div');this.holder.className='touch-controls';container.append(this.holder);
    this.delegate=new DefaultVirtualJoystickPlugin({radius:58,innerRadius:19});
    this.delegate.mount(this.holder,experience);
    this.holder.toggleAttribute('data-touch-paused',Boolean(this.paused));
    this.holder.toggleAttribute('data-native-locomotion',Boolean(this.native));
    this.experience=experience;
    for(const button of this.holder.querySelectorAll('button')){
      button.textContent='Saltar';
      button.setAttribute('aria-label','Saltar');
      button.parentElement.classList.add('touch-legacy-lane');
    }
    experience.setAdditionalInputProvider({getOutput:()=>{
      if(this.paused)return null;
      const output=this.readOutput();
      if(output&&(output.direction!=null||output.jump||output.vertical))this.lastMotion=performance.now();
      return output;
    }});
  },
  readOutput(){
    if(this.native)return this.native.getOutput();
    const output=this.delegate?.joystick?.getOutput()??null;
    if(!this.awaitLegacyRelease)return output;
    if(!output)this.awaitLegacyRelease=false;
    return null;
  },
  moving(){
    return !this.paused&&performance.now()-(this.lastMotion??-Infinity)<180;
  },
  pause(paused){
    if(this.paused===paused)return;
    this.paused=paused;
    this.lastMotion=undefined;
    this.awaitLegacyRelease=true;
    this.holder?.toggleAttribute('data-touch-paused',paused);
  },
  present(native){
    if(this.native===native)return;
    this.native=native;
    this.lastMotion=undefined;
    this.awaitLegacyRelease=true;
    this.holder?.toggleAttribute('data-native-locomotion',Boolean(native));
  },
  dispose(){
    this.experience?.setAdditionalInputProvider(null);
    this.present(null);
    this.delegate?.dispose();this.holder?.remove();
    this.delegate=this.holder=this.experience=null;
  },
};
let entering=true;
function worldEntered(){
  entering=false;
  window.dispatchEvent(new Event('holodeck:entered'));
}

function presentWorldFrame(){
  if(!entering&&document.body.hasAttribute('data-world-starting'))
    document.body.removeAttribute('data-world-starting');
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
let videoFrameBudget,mouseSensitivity=1,skyExposure=1.5,updateRoomGlazing=()=>{},notifyFullscreenError;
function createFrameBudget(renderer){
  return videoFrameBudget=capWorldPixelRatio(renderer,rendererBudget);
}
bindVideoSettings({document,window,lightweight:rendererBudget.lightweight,onFullscreenError:message=>notifyFullscreenError?.(message),onSensitivity:value=>{mouseSensitivity=value;},onSkyExposure:value=>{skyExposure=value;},onGraphics:lightweight=>{
  rendererBudget.lightweight=lightweight;
  videoFrameBudget?.setLightweight(lightweight);
  updateRoomGlazing();
  const page=new URL(location.href);
  if(lightweight)page.searchParams.set('graficos','livianos');
  else page.searchParams.delete('graficos');
  history.replaceState(history.state,'',page);
  window.dispatchEvent(new Event('holodeck:graphics-changed'));
}});

function entryRoomReady(root,model=root?.querySelector('m-model#room-art[src]')){
  return root?.isConnected===true&&(!model||model.modelGraphics?.hasLoadedModel()===true);
}

const entryLocation=new AbortController();
const entryDeadline=setTimeout(()=>entryLocation.abort(),30000);
let activeSpace,pendingBook,pendingSignal=null,pendingSerial=0;
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
  const beaconAvailable=()=>!entering&&!document.hidden&&!updateDoor.doorOffer?.()&&
    (!visitor.frame||visitor.panel.classList.contains('is-walking'))&&!document.querySelector('dialog[open]');
  window.addEventListener('keydown',event=>{
    if(beaconControls.handleProjectionKey(event))return;
    keepWorldTab(event);
    if(beaconControls.opened&&!event.defaultPrevented&&!event.isComposing&&
       (event.key==='Escape'||event.target===beaconControls.closeControl&&['Enter',' '].includes(event.key))){
      beaconControls.close();
      event.preventDefault();event.stopImmediatePropagation();
      return;
    }
    if(event.target instanceof Element&&event.target.closest('#exhibition-index')){event.stopImmediatePropagation();return;}
    if((beaconControls.opened||visitor.frame&&!visitor.panel.classList.contains('is-walking'))&&
       ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE'].includes(event.code)){
      if(!(event.target instanceof Element&&event.target.closest('button,input,select,textarea')))event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(event.code==='KeyE'&&beaconAvailable()&&beaconControls.useNearby(event,space.objects,
        client.getLocalCharacterState()?.position,()=>{
          releaseBeaconInput(client);
          beaconControls.open();
        })){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  const poses=new AvatarPosePresence(base,window.SESSION_TOKEN);
  const client=new HolodeckExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
    sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket(`spaces/${space.id}/network`),waitForWorldConfig:true,
    onServerBroadcast:message=>poses.receive(message),
    enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
    createRenderer:options=>{
      constrainInteriorCamera(options,()=>space.id);
      const renderer=new ThreeJSWorldRenderer({...options,config:{...options.config,spawnSun:false}});
      // MML still selects the deprecated soft-map enum. Three r182 needs the
      // current PCF enum for comparison sampling and per-light shadow radii.
      renderer.composer.renderer.shadowMap.type=PCFShadowMap;
      const frameBudget=createFrameBudget(renderer);
      beaconControls.setWorld({scene:renderer.mmlCompositionScene.group,
        camera:renderer.threeJSCameraManager.mainCamera,canvas:renderer.composer.renderer.domElement,
        renderer:renderer.composer.renderer});
      const actionLabel=new WorldActionLabel({scene:renderer.mmlCompositionScene.group,document,colliders:options.coreCameraManager.collisionsManager});
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
        const low=client.getCharacterManager().localController?.characterOnGround&&client.keyInputManager?.isKeyPressed('alt');
        if(position&&space.avatarPosePresence)poses.update(client.getWorldConnection(),space.id,low?'crouch':'ground');
        frameBudget.sample(!document.hidden&&!!position&&!visitor.isOpeningOverWorld());
        galleryModels.update();visitor.refreshScopedCatalog();updateDoor(position);visitor.update(position);
        beaconControls.update(space.objects,position);
        actionLabel.update(beaconAvailable()&&!matchMedia('(pointer: coarse)').matches?beaconControls.nearbyAction():null,
          options.coreCameraManager.getCameraState(),renderer.composer.renderer.domElement.clientHeight,{feet:position});
        render(state);
        presentWorldFrame();
        if(entering&&position&&entryRoomReady(document.getElementById(space.id)))worldEntered();
      };
      let releaseHeadroom,releaseRun;
      const reducedMotion=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
      const releaseAnimation=bindFlightAvatarAnimation(renderer.characterManager,()=>({
        peerPoses:poses.peers,grounded:client.getCharacterManager().localController?.characterOnGround,
        glanceMotion:!reducedMotion.matches&&!document.hidden,
        crouch:client.getCharacterManager().localController?.characterOnGround&&client.keyInputManager?.isKeyPressed('alt'),
      }));
      renderer.dispose=()=>{poses.dispose();releaseRun?.();releaseHeadroom?.();releaseAnimation();frameBudget.dispose();picker.dispose();actionLabel.dispose();galleryModels.clear();dispose();};
      queueMicrotask(()=>{
        releaseRun=bindWorldKeyShortcuts(client.keyInputManager);
        releaseHeadroom=bindInteriorHeadroom(client.getCharacterManager(),()=>true);
        options.onInitialized();
      });
      return renderer;
    },
    animationConfig:animations,
    loadingScreen:{title:space.title,background:'#20464c',color:'#f4e8cd'}
  });
  client.update();
  window.holodeckDevelopment={client};
  window.addEventListener('pagehide',()=>{updateDoor.dispose?.();exhibitObserver.disconnect();beaconControls.clear();visitor.dispose();client.dispose();},{once:true});
}

function releaseBeaconInput(client){
  client.keyInputManager?.handleUnfocus();
  if(document.pointerLockElement)document.exitPointerLock();
  client.getCameraManager()?.activePointers?.clear();
}

function benchControls(){
  return new BeaconControls(document.querySelector('#beacon-control'),document.querySelector('#beacon-panel'),{
    statusButton:document.querySelector('#beacon-status-check'),statusText:document.querySelector('#beacon-status-text'),
    routerLink:document.querySelector('#beacon-router'),
    rostroLink:document.querySelector('#beacon-rostro'),
    harmocapLink:document.querySelector('#beacon-harmocap'),
    operatorLink:document.querySelector('#beacon-operator'),
  });
}

function startWorld(activeSpace){
const worldView=new WorldViewCapture(document);
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
const outsideRing=()=>!inside&&activeSpace.outdoorTerrain===TOROIDAL_TERRAIN.id;
// Capture the fresh entry before MML initializes or writes a location hash.
// Arrival frames the house door; the Residencia's chamber portals are additional entrances.
const houseEntrances=space=>space?.entrances?.filter(entrance=>!entrance.portal)??[];
let firstExteriorDoor=outsideRing()&&!location.hash&&houseEntrances(activeSpace).length===1?houseEntrances(activeSpace)[0].door:null;
let flightEnabled=false,doubleJumpPending=false,trickStarted=-Infinity,radialMovementMode='ground',radialBoosting=false;
const verticalHelp=document.getElementById('world-vertical-help');
const dryVerticalHelp=verticalHelp.textContent;
let fitConversationWindow=()=>{};
const conversationFirst=matchMedia('(max-width:740px), (max-width:1180px) and (max-height:540px)');
let conversationCharacterPose=null;
const spaceGesture=bindFlightSpaceGesture({
  allowed:event=>!event.altKey&&!event.ctrlKey&&!event.metaKey&&outsideRing()&&!entering&&!moving&&
    !document.hidden&&!document.querySelector('dialog[open]')&&
    !event.target?.closest?.('#conversation-panel,button,input,select,summary,textarea,[contenteditable]'),
  onFlight(){
    flightEnabled=!flightEnabled;
    say(flightEnabled?'Vuelo activo · Espacio sube, Alt baja y Shift acelera.':'Vuelo desactivado.',{transient:true});
  },
  onDoubleJump(){if(!flightEnabled)doubleJumpPending=true;},
});
const resetFlightTap=spaceGesture.cancel;
window.addEventListener('blur',resetFlightTap);
document.addEventListener('visibilitychange',resetFlightTap);
document.addEventListener('keyup',spaceGesture.up,true);
document.addEventListener('focusin',event=>{
  if(event.target?.closest?.('iframe,#conversation-panel,button,input,select,summary,textarea,[contenteditable]'))resetFlightTap();
});

let outdoorReady=()=>Boolean(geometryProbe?.snapshot());
let outdoorArrivalReady=()=>outdoorReady();
let confirmedRingPose=null;
let updateDoor=()=>{},remoteScene=null,roomModel=null,networkScope=null,arrival=null,doorwayArrival=null;
let releaseLightweightGlazing=null;
let releaseFoyerFloor=null;
let matterStyleScope=null;
let floorSplatScope=null;
updateRoomGlazing=()=>{
  if(!roomModel?.modelGraphics?.hasLoadedModel()||!activeSpace?.collectionShelves)return;
  const group=roomModel.getContainer();
  matterStyleScope?.glazing.dispose();
  releaseLightweightGlazing?.();
  releaseLightweightGlazing=rendererBudget.lightweight?useLightweightMatterGlazing(group):null;
  if(matterStyleScope){
    matterStyleScope.glazing=bindOrbitalMatterGlazing(group);
    matterStyleScope.glazing.apply(matterStyleScope.style.orbitalGlazing===true);
  }
};
const roomStyle=document.querySelector('#room-style'), roomStyleChoice=document.querySelector('#room-style-choice');
const roomStyleStatus=document.querySelector('#room-style-status');
function styleStatus(message){
  roomStyleStatus.textContent=message;
  roomStyleStatus.hidden=!message;
}
async function applyMatterStyle(style,{save=false}={}){
  const current=matterStyleScope;
  if(!current||current.controller)return;
  current.controller=new AbortController();
  roomStyleChoice.disabled=true;
  if(style.id!==current.style.id)styleStatus('Cargando acabado…');
  try{
    await loadMatterStyleImages(current.catalog,style,current.images,AbortSignal.any([
      current.controller.signal,AbortSignal.timeout(12000)
    ]));
    if(matterStyleScope!==current)return;
    current.binding.apply(style,current.images);
    current.glazing.apply(style.orbitalGlazing===true);
    current.style=style;
    document.body.dataset.roomLook=style.id;
    roomStyleChoice.value=style.id;
    if(save){
      styleStatus('Guardando tema…');
      const response=await fetch(url('api/space/matter-look'),{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({style:style.id}),
        signal:AbortSignal.any([current.controller.signal,AbortSignal.timeout(8000)])});
      if(!response.ok)throw Error('Preference not saved');
      if(matterStyleScope===current){
        current.catalog.preferred=style.id;
        styleStatus('Tema guardado.');
      }
    }else styleStatus('');
  }catch{
    if(matterStyleScope===current){
      roomStyleChoice.value=current.style.id;
      styleStatus(save&&current.style.id===style.id?'El tema cambió en esta vista, pero no pude confirmar que se guardó.':'No pude cargar este acabado.');
    }
  }finally{
    current.controller=null;
    if(matterStyleScope===current)roomStyleChoice.disabled=false;
  }
}
roomStyleChoice.onchange=()=>{
  const style=matterStyleScope?.catalog.looks.find(({id})=>id===roomStyleChoice.value);
  if(style)void applyMatterStyle(style,{save:true});
};
let moving=false,requestingMove=false,needsSync=false,resyncing=false,moveDeadline=null,passageNotice=null;
let roomTopic,worktableTopic;
let prefetched=new Set(),prefetchRequest=null,pendingRoomArt=null;
const setMoving=value=>{
  if(moving!==value){
    moving=value;
    document.body.classList.toggle('room-transition',value);
    $('#room-passage-message').textContent=value?'Cambiando de lugar…':'';
    $('#room-passage-retry').hidden=true;
    $('#room-passage-retry').disabled=false;
    clearTimeout(passageNotice);
    if(value)passageNotice=setTimeout(()=>{
      $('#room-passage-message').textContent='Este lugar está tardando en cargar.';
      $('#room-passage-retry').hidden=false;
    },12000);
    if(value){
      try{client.keyInputManager?.handleUnfocus();}catch(error){console.error('Could not release passage input',error);}
      matterHud?.beginPassage();
    }
  }
  if(!value){
    clearTimeout(moveDeadline);moveDeadline=null;
    try{matterHud?.endPassage();}catch(error){console.error('Could not close passage HUD',error);}
  }
};
const removeScene=()=>{
  if(signalEditor?.draft?.mode)signalEditor.dismiss();
  if(matterStyleScope){
    matterStyleScope.controller?.abort();
    matterStyleScope.binding.dispose();
    matterStyleScope.glazing.dispose();
    for(const image of matterStyleScope.images.values())image.close();
    matterStyleScope=null;
  }
  delete document.body.dataset.roomLook;
  roomStyle.hidden=true;
  if(floorSplatScope){
    floorSplatScope.controller.abort();
    floorSplatScope.projection?.dispose();
    floorSplatScope=null;
  }
  releaseFoyerFloor?.();releaseFoyerFloor=null;
  releaseLightweightGlazing?.();releaseLightweightGlazing=null;
  pendingRoomArt=null;projectedGarden=null;beaconControls.clear();galleryModels?.clear();collectionShelves?.clear();remoteScene?.remove();remoteScene=roomModel=null;
};
async function mountFloorSplat(){
  const {src,target,radius}=activeSpace.matterFloorSplat;
  const scope={controller:new AbortController()},model=roomModel,room=remoteScene;
  floorSplatScope=scope;
  try{
    const response=await fetch(src,{signal:AbortSignal.any([
      scope.controller.signal,AbortSignal.timeout(12000),
    ])});
    if(!response.ok)return;
    const bytes=await response.arrayBuffer();
    if(floorSplatScope!==scope||!room.isConnected||needsSync)return;
    scope.projection=projectRoomSurface({room,model,bytes,target,radius});
  }catch{
    // If the alternate art is unavailable, the original floor stays visible.
  }
}
function mountScene(){
  removeScene();
  if(!inside)return true;
  const stored=sceneCache.remember(activeSpace.scene);
  if(stored?.id!==activeSpace.id)return false;
  const renderer=client.getRenderer();
  const artScope=url('api/space/art/');
  // An accepted room move authorizes its art endpoint immediately. Overlap
  // decoding with presence reconnect, but defer mounting and collision until
  // the room's presence scope has actually arrived.
  if(networkScope!==activeSpace.id){
    const source=roomArtURL(stored.template.content.querySelector('m-model#room-art[src]')?.getAttribute('src'),artScope);
    if(!needsSync&&source&&renderer){
      const resources=renderer.mmlCompositionScene.mmlScene.getGraphicsAdapter().getResourceManager();
      sceneCache.keepArt(stored,()=>resources.loadModel(source));
    }
    return true;
  }
  const wrapper=new RemoteDocumentWrapper(url('api/space/scene').href,window,
    renderer.mmlCompositionScene.mmlScene,()=>{});
  remoteScene=wrapper.remoteDocument;
  remoteScene.append(stored.template.content.cloneNode(true));
  renderer.mmlTargetElement.append(remoteScene);
  roomModel=remoteScene.querySelector('m-model#room-art[src]');
  const source=roomArtURL(roomModel?.getAttribute('src'),artScope);
  if(!stored.art&&source)pendingRoomArt={stored,model:roomModel,source};
  if(!contentVisitor?.catalogFlight){
    const entries=contentVisitor?.entries??[];
    galleryModels?.sync(entries);
    applyGallerySigns(remoteScene,entries);
  }
  return true;
}
// Keep a loaded room available for a warm return if it mounted directly.
function keepRoomArt(){
  if(!pendingRoomArt||needsSync||networkScope!==activeSpace.id)return;
  const {stored,model,source}=pendingRoomArt;
  if(!model.modelGraphics?.hasLoadedModel())return;
  pendingRoomArt=null;
  sceneCache.keepArt(stored,()=>model.getScene().getGraphicsAdapter().getResourceManager().loadModel(source));
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
  doorwayArrival=anchor?.doorway?anchor:null;
  if(leavingOutside){
    closePreview({settled:true});
    client.getRenderer()?.setMMLConfiguration({},window.SESSION_TOKEN);
  }
  stateRequest++;worldAudio.breakContinuity();
  prefetched=new Set();
  prefetchRequest?.abort();prefetchRequest=null;
  document.body.classList.toggle('inside-house',inside);
  document.body.classList.toggle('has-situated-conversation',inside&&next.sharedConversation===true);
  $('#hud h1').textContent=next.title??'Plaza de llegada';
  $('#people').textContent=inside?(next.level===0?'Planta baja':next.level<0?`Subsuelo ${-next.level}`:`Piso ${next.level}`):'Un lugar para crear juntos';
  if(changed){roomTopic=undefined;worktableTopic=undefined;conversationCharacterPose=null;contentVisitor.changeRoom(inside,next.id);worldIndication.selected=null;worldIndication.removeOutline();state=null;}
  else if(inside)contentVisitor.confirmRoom();
  if(anchor&&!anchor.resumeExterior){
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
    const saved=confirmedRingPose;
    confirmedRingPose=null;
    const resume=next.id==='outside'&&activeSpace.id==='outside'&&next.outdoorTerrain===TOROIDAL_TERRAIN.id&&
      next.terrainRun&&saved?.run===next.terrainRun&&saved.actor===next.actorRef?saved.anchor:null;
    applySpace(next,resume??arrivalDoor(activeSpace,next));
    if(returnedOutside)say(contentVisitor.parked?'Volviste al exterior. Tu visita sigue guardada en esta pestaña.':
      'Volviste al exterior.',{transient:true});
  }).catch(()=>{if(!requestingMove)say('No pude confirmar tu ubicación.');})
    .finally(()=>{resyncing=false;});
}
function canFinishMove(){
  if(requestingMove||needsSync||networkScope!==activeSpace.id||!client.getLocalCharacterState())return false;
  // The receiving scope is confirmed. A slow model can finish on this page.
  clearTimeout(moveDeadline);moveDeadline=null;
  if(inside?!entryRoomReady(remoteScene,roomModel):!outdoorReady())return false;
  if(arrival){
    const {x,y,z,yaw,facing,resumeExterior}=arrival;
    const heading=yaw??facing*90;
    client.updateConfig({spawnConfiguration:{spawnPosition:{x,y,z},spawnYRotation:-heading,
      ...(outsideRing()?{respawnTrigger:{minY:-2500}}:{})}});
    client.respawn();
    // A scoped reconnect can spawn before the move response seeds the URL.
    // Align the orbit to the same confirmed door as the avatar while masked.
    if(!resumeExterior&&Number.isFinite(heading)){
      const camera=client.getCameraManager();
      camera.setOrbitAngle(3*Math.PI/2-heading*Math.PI/180);
      camera.theta=camera.targetTheta;
    }
    arrival=null;
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
    manageShortcut:false,
    allowWithConversation:concurrentRoomDoors,
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
        confirmedRingPose=null;
        applySpace(next,anchor);
        // Recovery reads the location already committed, without sending the move again.
        moveDeadline=setTimeout(()=>location.reload(),8000);
      }
    }:{})
  });
}
function beaconWorldAvailable(){
  return inside&&remoteScene&&!moving&&!entering&&!needsSync&&!document.hidden&&
    !!matterHud?.nearbyBeaconAvailable&&!matterHud.nearbyTableAvailable&&!signalEditor?.active&&
    !updateDoor.doorOffer?.()&&!client.getRenderer()?.coreCameraManager?.isFlyCameraOn();
}

// MML captures document keys by default. Preserve ordinary text editing and
// keyboard activation of the HUD without turning typed words into locomotion.
document.addEventListener('keydown',event=>{
  if(beaconControls.handleProjectionKey(event))return;
  if(matterHud?.hud.ownsTextInput?.(event.target))return;
  keepWorldTab(event);
  if(matterHud?.settings.group||worldHistory?.native||matterHud?.visit.indexActive||matterHud?.visit.viewerActive||(beaconControls.opened&&beaconControls.native)){
    if(matterHud.settingsKey(event))event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if(matterHud?.key(event)){event.preventDefault();event.stopImmediatePropagation();return;}
  if(updateDoor.key?.(event)){event.stopImmediatePropagation();return;}
  if(matterHud?.useNearbyTable(event)){event.preventDefault();event.stopImmediatePropagation();return;}
  if(event.code==='KeyE'&&beaconWorldAvailable()&&beaconControls.useNearby(event,activeSpace.objects,
      client.getLocalCharacterState()?.position,()=>matterHud.beacon.openNearby())){
    event.preventDefault();event.stopImmediatePropagation();return;
  }
  if(event.target===document.getElementById('house-door')){
    updateDoor.buttonKey?.(event);
    event.stopImmediatePropagation();
    return;
  }
  if(matterHud?.ownsAccessibleInput(event.target))return;
  spaceGesture.down(event);
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
        $('#space-travel').open=false;
        if(!matterHud?.focusTool('map'))$('#map-tool').focus();
      }
      else if(event.target.closest('#creator')){if(closePreview())say('La vista previa quedó descartada.',{transient:true});}
      else openConversation(false);
      event.target.blur();
    }
  }
},true);
const playableHUD=new PlayableHUD(document);
let geometryProbe=null,companionAvatar=null,nativeAvatarLayer=null,contentVisitor=null,galleryModels=null,collectionShelves=null,matterHud=null,matterFlight=null,conversationDisplay=null,preparingConversation=false,worldPicker=null,worldIndication=null,state=null,sharedConversation=null,worldHistory=null;
const poses=new AvatarPosePresence(base,window.SESSION_TOKEN);
let pointView=null;
const worldNotice=new WorldNotice(document.querySelector('#notice'));
function concurrentRoomDoors(){return inside&&!matchMedia('(pointer: coarse)').matches;}
const client=new HolodeckExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
  sessionToken:window.SESSION_TOKEN,userNetworkAddress:socket(hot?'active/network':'network'),waitForWorldConfig:true,
  onServerBroadcast:message=>{
    poses.receive(message);
    pointView?.receive(message,activeSpace.id,client.getWorldConnection());
  },
  enableTweakPane:false,postProcessingEnabled:false,respawnButtonPlugin:null,virtualJoystickPlugin:touchControls,
  // Upstream's default sun allocates an 8192² shadow map. This small world uses
  // the public renderer factory and a bounded 1024² light instead, on all clients.
  createRenderer:options=>{
    const tableFlight=new CharacterReviewFlight(options.coreCameraManager);
    matterFlight=tableFlight;
    constrainInteriorCamera(options,()=>{
      if(inside)return activeSpace?.id;
      if(activeSpace?.outdoorTerrain!==true)return null;
      const position=client.getLocalCharacterState()?.position;
      return position&&position.x>21&&position.x<32&&position.z<-6&&position.z>-26?'valley-cave':null;
    },()=>Boolean(tableFlight.inspectParts),()=>doorwayArrival);
    // The ring's terrain and ground movement are local. MML scenery may
    // reconnect or finish later without holding the presence spawn behind it.
    const dressingProgress=outsideRing()?new LoadingProgressManager():options.loadingProgressManager;
    const renderer=new ThreeJSWorldRenderer({...options,loadingProgressManager:dressingProgress,
      config:{...options.config,spawnSun:false}});
    // MML still selects the deprecated soft-map enum. Three r182 needs the
    // current PCF enum for comparison sampling and per-light shadow radii.
    renderer.composer.renderer.shadowMap.type=PCFShadowMap;
    const worldInteractionCanvas=renderer.composer.renderer.domElement;
    const releaseOrbit=bindWorldOrbitInput(options.coreCameraManager,worldInteractionCanvas,()=>mouseSensitivity,undefined,{
      active:()=>Boolean(tableFlight.inspectParts),
      available:pointer=>Boolean(tableFlight.inspectParts&&tableInputAllowed()&&!needsSync&&
        !matterHud.overControl(pointer)&&document.elementFromPoint(pointer.clientX,pointer.clientY)===worldInteractionCanvas),
      dolly:(delta,x,y,pointerX,pointerY)=>tableFlight.dollyInspection(client.getCharacterManager().localController,
        delta,x,y,worldPicker.worktableHit(pointerX,pointerY)),
      pan:(x,y)=>tableFlight.translateInspection(client.getCharacterManager().localController,x,y),
    },()=>outsideRing()&&(flightEnabled||radialMovementMode==='swim'||radialMovementMode==='surface')&&
      !entering&&!moving&&!tableFlight.active&&!document.hidden);
    const aiming=()=>releaseOrbit.aiming()&&!entering&&!moving&&!tableFlight.active&&!document.hidden;
    const mapPanel=document.querySelector('#space-travel');
    const minimap=bindToroidalMinimap(mapPanel);
    const frameBudget=createFrameBudget(renderer);
    galleryModels=new GalleryModels(renderer.mmlCompositionScene.group);
    const points=new TabletopPointView(renderer.mmlCompositionScene.group,(local,connection)=>{
      const profile=client.getUserProfile(connection);
      const ownTab=profile?.userId&&profile.userId===client.getLocalCharacterState()?.userId;
      const message=local?'Señalaste esta pieza.':ownTab?'Señalaste una pieza desde otra vista.':
        profile?.username?profile.username+' señaló una pieza de la mesa.':'Te señalaron una pieza de la mesa.';
      say(message,{transient:true});
    });
    pointView=points;
    let pointSequence=0,pointRequest=null;
    const abortHiddenPoint=()=>{if(document.hidden)pointRequest?.controller.abort();};
    document.addEventListener('visibilitychange',abortHiddenPoint);
    async function pointAtPart(reference,revision){
      const world=client.getWorldConnection(),scope=activeSpace.id;
      const connection=world?.getConnectionId(),table=collectionShelves.worktable;
      const allowed=()=>matterHud.active&&tableFlight.active&&!moving&&!entering&&!document.hidden&&
        activeSpace.id===scope&&client.getWorldConnection()===world&&world?.isConnected()&&
        world.getConnectionId()===connection&&table.canPoint(reference,revision);
      if(pointRequest||!poses.key||!Number.isSafeInteger(connection)||!allowed())return;
      const payload={connection,reference,revision,sequence:++pointSequence};
      const controller=new AbortController();
      pointRequest={controller,allowed};
      table.pointingPending=true;
      try{
        const key=await poses.key;
        if(!key)return;
        const proof=await signAvatarPresence(key,tabletopPointProofMessage(scope,payload));
        if(!allowed())return;
        const response=await fetch(new URL('api/space/collection/pointing',base),{
          method:'POST',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),
          headers:{'Content-Type':'application/json','X-Holodeck-Pose-Proof':proof},body:JSON.stringify(payload),
        });
        if(!allowed())return;
        if(response.ok)points.receive({broadcastType:tabletopPointBroadcast,payload:{...payload,space:scope}},scope,world,true);
        else say(response.status===429?'Esperá un momento para volver a señalar.':
          'No pude señalar esta pieza. Revisá la mesa y volvé a intentar.',{transient:true});
      }catch{
        if(!controller.signal.aborted&&allowed())say('No pude confirmar el gesto.',{transient:true});
      }finally{pointRequest=null;table.pointingPending=false;}
    }
    collectionShelves=new CollectionShelves({base,scene:renderer.mmlCompositionScene.group,panel:document.querySelector('#collection-shelf'),
      archivePanel:document.querySelector('#collection-archive'),worktablePanel:document.querySelector('#collection-worktable'),
      onCatalogUnavailable:partial=>say(partial
        ?'No pude cargar toda la colección. Voy a volver a intentar.'
        :'No pude cargar la colección. Voy a volver a intentar.',{transient:true}),
      onTabletop:players=>{
        const id=client.getLocalCharacterState()?.connectionId;
        if(Number.isSafeInteger(id)&&players.has(id)!==tableFlight.active)void shareTabletopMode(tableFlight.active);
      },
      webgl:renderer.composer.renderer,onPlaced:()=>say('Modelo seleccionado. Acercate a la mesa.',{transient:true}),onPoint:pointAtPart,onReference:(reference,label)=>{
        if(moving||!inside||!sharedSurface())return;
        worktableTopic={reference,label};openConversation(true);
      }});
    const tools={map:document.getElementById('map-tool'),talk:document.getElementById('talk'),
      mic:document.getElementById('tool-mic'),speaker:document.getElementById('tool-speaker'),
      appearance:document.getElementById('appearance-open'),video:document.getElementById('video-open'),
      bridge:document.getElementById('bridge'),plant:document.getElementById('plant'),undo:document.getElementById('undo'),
      activity:document.getElementById('activity-open'),visit:document.getElementById('visit-near'),
      endVisit:document.getElementById('visit-end-near'),fullscreen:document.getElementById('video-fullscreen')};
    const visitAllowed=()=>!moving&&!entering&&document.getElementById('conversation-panel').hidden&&
      document.getElementById('creator').hidden&&!signalEditor?.active;
    const activityAllowed=()=>!inside&&document.getElementById('conversation-panel').hidden&&
      document.getElementById('creator').hidden;
    const readTools=operating=>Object.fromEntries(Object.entries(tools).map(([id,element])=>[id,{
      label:['mic','speaker'].includes(id)?element.textContent.trim():id==='undo'?'Deshacer':id==='visit'&&element.textContent.startsWith('Visitar ')?'Visitar':
        element.getAttribute('aria-label')??element.textContent.trim(),
      visible:(id==='activity'?activityAllowed():id==='fullscreen'?element.hasAttribute('data-fullscreen-available'):!element.hidden)&&
        (['map','talk','mic','speaker','appearance','video','fullscreen'].includes(id)||['visit','endVisit'].includes(id)&&visitAllowed()&&!operating||!inside&&!operating&&
          !['visit','endVisit'].includes(id))
        &&(!['appearance','video'].includes(id)||document.getElementById('conversation-panel').hidden),
      disabled:element.disabled,
      pressed:element.getAttribute(['fullscreen','mic','speaker'].includes(id)?'aria-pressed':'aria-expanded')==='true',
    }]));
    let settingsInputCaptured=false;
    let tabletopRevision=0;
    async function shareTabletopMode(active){
      const connection=client.getLocalCharacterState()?.connectionId;
      if(!Number.isSafeInteger(connection))return;
      const revision=++tabletopRevision;
      const body=JSON.stringify({active,connection,revision});
      // Newer state always wins, including when a retried request arrives late.
      for(const delay of [0,500,1500]){
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        if(revision!==tabletopRevision||client.getLocalCharacterState()?.connectionId!==connection)return;
        try{
          const response=await fetch(new URL('api/space/collection/tabletop-presence',base),{
            method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(3000),
          });
          if(response.status!==429&&response.status<500)return;
        }catch{}
      }
    }
    const characterTable=new CharacterWorktable({document,scene:renderer.mmlCompositionScene.group,
      setAngle:angle=>tableFlight.setReviewAngle(angle)});
    matterHud=new MatterWorktableHud({document,webgl:renderer.composer.renderer,table:collectionShelves.worktable,collection:collectionShelves,
      creatorContext:()=>({draft:preview,point:worldIndication?.selected,shared:worldIndication?.own()?.sequence}),
      beaconControls,onBeaconOpen:()=>releaseBeaconInput(client),
      toggleSound:()=>{if(!moving&&!entering&&navigator.userActivation?.isActive)void toggleWorldSound();},
      readTools,history:()=>worldHistory,visitor:()=>contentVisitor,activateTool:id=>{
        if(id==='endVisit'){if(visitAllowed())void contentVisitor?.endVisit();return;}
        if(id!=='activity'&&id!=='visit'){tools[id]?.click();return;}
        if(id==='activity'?!activityAllowed():!visitAllowed())return;
        client.keyInputManager?.handleUnfocus();touchControls.pause(true);
        if(document.pointerLockElement===matterHud.canvas)document.exitPointerLock();
        options.coreCameraManager.activePointers.clear();
        if(id==='visit')void contentVisitor?.launch({native:true});
        else void worldHistory?.open({native:true});
      },
      presentMovement:provider=>touchControls.present(provider),
      navigation:{panel:mapPanel,mapState:()=>updateDoor.navigation?.()??{
        scope:activeSpace.id,canExit:false,busy:false,map:null,
      },selectDestination:id=>updateDoor.mapSelect?.(id),returnOutside:()=>updateDoor.mapExit?.(),
      readBearing:()=>updateDoor.bearing?.(),dismissBearing:id=>updateDoor.mapDismiss?.(id),
      bearingAdapter:document.getElementById('door-guidance'),
      door:{adapter:document.getElementById('house-door'),read:()=>updateDoor.doorOffer?.(),
        cross:(scope,revision)=>updateDoor.followDoor?.(scope,revision)}},
      canEnter:()=>{
        if(options.coreCameraManager.isFlyCameraOn())return false;
        const table=matterHud.table,ordinary=table===collectionShelves.worktable;
        return tableFlight.enter(client.getCharacterManager().localController,table.anchor,
          {reviewTarget:table.reviewCameraTarget,reviewScale:table.reviewScale,
            cameraProfile:ordinary?matterInspectionCamera:undefined,
            inspectParts:ordinary?()=>table.model?.parts:null});
      },
      onActive:active=>{
        document.body.classList.toggle('is-operating-matter',active);
        if(!active){
          pointRequest?.controller.abort();
          tableFlight.exit(client.getCharacterManager().localController);
        }
        if(matterHud.table===collectionShelves.worktable)void shareTabletopMode(active);
        client.keyInputManager?.handleUnfocus();
      },
      onError:()=>say('No pude mostrar estos controles. Volvé a abrirlos.',{transient:true}),
    });
    const sky=new OutdoorSky(renderer.mmlCompositionScene.group.parent,base);
    const actionLabel=new WorldActionLabel({scene:renderer.mmlCompositionScene.group,document,colliders:options.coreCameraManager.collisionsManager});
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
    const houseLight=bindToroidalHouseLight(renderer.composer,renderer.mmlCompositionScene.group,document);
    let selectedKey=null,inspectionRoom=null,inspectionMix=0;
    let previousPresentationFrame=performance.now();
    const roomKeyColor=new Color(),inspectionKeyColor=new Color();
    const roomKeyPosition=new Vector3(),inspectionKeyPosition=new Vector3();
    const roomKeyTarget=new Vector3(),inspectionKeyTarget=new Vector3();
    geometryProbe=new AppliedGeometryProbe({document,scene:renderer.mmlCompositionScene.group,
      canvas:options.targetElement.querySelector(':scope > canvas'),expectedDocumentURL:socket('world')});
    nativeAvatarLayer=new NativeAvatarLayer({document,base,onFailure:message=>say(message)});
    const rain=bindLocalRain(renderer.mmlCompositionScene.group);
    let weather=null,weatherNext=-Infinity,weatherRequest;
    const weatherLabel=document.querySelector('#quintana-weather-status');
    function checkWeather(){
      if(weatherRequest||performance.now()<weatherNext||document.hidden)return;
      weatherNext=performance.now()+5*60000;
      weatherRequest=new AbortController();
      const request=weatherRequest;
      fetch(new URL('api/quintana-weather',base),{signal:AbortSignal.any([request.signal,AbortSignal.timeout(8500)])})
        .then(response=>response.ok?response.json():null)
        .then(sample=>{if(!request.signal.aborted)weather=sample;})
        .catch(()=>{})
        .finally(()=>{if(weatherRequest===request)weatherRequest=null;});
    }
    const avatarPracticals=bindAvatarPracticals(renderer.mmlCompositionScene.group,options.coreCameraManager.collisionsManager);
    const companion=new CompanionAvatar({scene:renderer.mmlCompositionScene.group,document,base});
    const flightWake=new FlightWake(renderer.mmlCompositionScene.group);
    const waterSplash=new WaterSplash(renderer.mmlCompositionScene.group,{
      lightweight:()=>rendererBudget.lightweight,pixelRatio:()=>renderer.composer.renderer.getPixelRatio(),
    });
    const waterWake=new WaterWake(renderer.mmlCompositionScene.group,{
      lightweight:()=>rendererBudget.lightweight,pixelRatio:()=>renderer.composer.renderer.getPixelRatio(),
    });
    companionAvatar=companion;
    worldPicker=new PublicWorldPicker({document,canvas:options.targetElement.querySelector(':scope > canvas'),scene:renderer.mmlCompositionScene.group,
      cameraState:()=>options.coreCameraManager.getCameraState(),proof:()=>geometryProbe?.snapshot(),
      gallery:()=>inside?(moving||!remoteScene?new Map():contentVisitor.galleryTargets(galleryModels,remoteScene,
        client.getLocalCharacterState()?.position)):null,
      collection:()=>inside&&!moving&&remoteScene&&activeSpace.collectionShelves?collectionShelves.pickTargets():null,
      worktable:()=>collectionShelves?.worktable.model?.group,
      companion:()=>companion.object,
      onPick:record=>{
        if(record.kind==='daimon-companion'){openConversation(true);return;}
        if(matterHud.active&&record.kind!=='worktable-part')return;
        if(record.kind==='collection-shelf')collectionShelves.placeOnTable(record.item,record.edition);
        else if(record.kind==='worktable-part'&&matterHud.active){
          const table=collectionShelves.worktable;
          if(table.selectPart(record))companion.attend(point=>{
            if(!tableFlight.active||!table.available||table.part.value!==record.id||table.model?.parts.get(record.id)!==record.mesh||!record.mesh.visible)return null;
            const bounds=record.mesh.geometry.boundingBox;
            if(!bounds)return null;
            record.mesh.localToWorld(bounds.getCenter(point));
            return renderer.mmlCompositionScene.group.worldToLocal(point);
          },record.mesh);
        }
        else if(record.kind==='gallery')contentVisitor.openGallery(record.entry).catch(()=>say('No pude abrir esta edición.'));
        else if(record.kind==='content')contentVisitor?.openNode(record.node).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'));
        else{
          worldIndication?.select(record);
          if(record.container)companion.attend(point=>{
            if(worldIndication?.selected!==record||!worldIndication.current())return null;
            record.container.getWorldPosition(point);
            return renderer.mmlCompositionScene.group.worldToLocal(point);
          });
          const visit=pickedRepresentationVisit(record,state);
          if(visit)contentVisitor?.openNode(visit.id,{expectedRevision:visit.revision}).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'));
        }
      },
      onUnavailable:()=>say('No pude identificar ese objeto todavía. Probá de nuevo.',{hint:true})});
    worldIndication=new WorldIndication({document,scene:renderer.mmlCompositionScene.group,getState:()=>state,
      set:record=>action('focus.set',record.target,{},record.revision,{selection:record}),
      clear:record=>action('focus.clear',null,{},record.sequence),edit:editLight,
      visit:record=>contentVisitor.openNode(record.target,{expectedRevision:record.revision}).catch(()=>say('No pude abrir este contenido. Conservé la visita anterior.'))});
    const display=new ConversationDisplay(renderer.composer.renderer,document.querySelector('#conversation-panel'),matterHud.layer,
      ()=>({worktable:worktableTopic?.reference??null,history:worldHistory?.reference()??null}));
    conversationDisplay=display;
    const render=renderer.render.bind(renderer),dispose=renderer.dispose.bind(renderer);
    const draw=renderer.composer.render.bind(renderer.composer);
    const mainCamera=renderer.threeJSCameraManager.mainCamera;
    beaconControls.setWorld({scene:renderer.mmlCompositionScene.group,camera:mainCamera,canvas:worldPicker.canvas,renderer:renderer.composer.renderer});
    const pendingGaze=new Vector3(),pendingSpeaker=new Vector3();
    const worldNear=mainCamera.near;
    const focusMode=new URLSearchParams(location.search).get('enfoque');
    const focusReference=focusMode==='referencia'&&location.hostname==='127.0.0.1';
    const backgroundFocus=focusMode==='fondo'||focusReference?new BackgroundFocus(
      renderer.composer.renderer,renderer.scene,{strength:focusReference?0:1}):null;
    let drawWorld=true;
    // Keep the frame loop and collision running behind opaque overlays. Skip
    // drawing until Nexus yields or the destination can produce a room frame.
    renderer.composer.render=()=>{
      if(!drawWorld){
        if(moving)matterHud.drawPassage();
        else matterHud.visit.present({painted:false});
        return;
      }
      if(floorSplatScope?.projection){
        const camera=roomModel.getScene().getGraphicsAdapter().getCamera();
        floorSplatScope.projection.sort(camera,false);
      }
      if(backgroundFocus&&outsideRing()&&!rendererBudget.lightweight)backgroundFocus.draw(draw);
      else{
        backgroundFocus?.dispose();
        draw();
      }
      if(!moving&&!entering)worldView.present(renderer.composer.renderer.domElement,mainCamera);
      if(moving)matterHud.drawPassage();
      else matterHud.draw(display.draw());
    };
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
    let nextDressing=0, ring=null, cave=null, scenery=null, atmosphere=null, releaseRadialMovement=null, releaseHeadroom=null, ringSun=null;
    let presentedHelp=verticalHelp.textContent;
    let sceneryAfter=null,releaseTableFlight=null,releaseSearchKeys=null;
    const worldCanvas=worldPicker.canvas;
    worldCanvas.classList.add('world-interaction-canvas');
    const worldFocus=new AbortController();
    worldCanvas.addEventListener('pointerdown',event=>{
      // Spatial HUD handlers consume their own pointers before this listener.
      const panel=document.getElementById('conversation-panel');
      if(event.button!==0||event.defaultPrevented||panel.hidden||entering||moving)return;
      if(panel.contains(document.activeElement)){
        worldCanvas.tabIndex=-1;
        worldCanvas.focus({preventScroll:true});
      }
    },{signal:worldFocus.signal});
    const table=collectionShelves.worktable;
    const tableAttention=bindTabletopAttention({document,canvas:worldCanvas,
      pick:(x,y)=>worldPicker.worktableHit(x,y),
      current:({id,mesh})=>table.available&&mesh.visible&&table.model?.parts.get(id)===mesh,
      allowed:()=>matterHud.active&&tableFlight.active&&!moving&&!entering&&!needsSync&&
        !document.hidden&&!mapPanel.open&&!document.querySelector('dialog[open]')&&
        !contentVisitor?.isOpeningOverWorld()&&!options.coreCameraManager.activePointers.size&&
        !matterHud.capturedPointers.size,
      overWorld:pointer=>!matterHud.overControl(pointer)&&
        document.elementFromPoint(pointer.clientX,pointer.clientY)===worldCanvas,
    });
    let tableGaze=null;
    const tabletopPlayers=()=>activeSpace.id===CHARACTER_STUDIO?
      new Set([...poses.peers].filter(([,pose])=>pose==='table').map(([id])=>id)):
      collectionShelves.tabletopPlayers;
    const localFlightBoost=()=>outsideRing()&&flightEnabled&&!entering&&!moving&&radialBoosting;
    const releaseFlightAnimation=bindFlightAvatarAnimation(renderer.characterManager,()=>({
      outdoor:outsideRing(),flying:flightEnabled,boosting:localFlightBoost(),grounded:client.getCharacterManager().localController?.characterOnGround,table:tableFlight.active,tabletopPlayers:tabletopPlayers(),
      peerPoses:poses.peers,peerGaze:points.gazes,gaze:tableGaze,wake:!entering&&!moving&&drawWorld?flightWake:null,glanceMotion:!companion.motion.matches&&!document.hidden,
      trickAge:(performance.now()-trickStarted)/1000,
      aimPitch:aiming()?Math.PI/2-options.coreCameraManager.phi:null,loopPitch:releaseOrbit.pitch(),
      splash:!entering&&!moving&&drawWorld&&!document.hidden?waterSplash:null,
      waterWake:!entering&&!moving&&drawWorld&&!document.hidden?waterWake:null,
      microphoneLevel:sharedConversation&&!moving&&!entering&&sharedSurface()?sharedConversation.microphoneLevel():null,
      crouch:!moving&&client.getCharacterManager().localController?.characterOnGround&&client.keyInputManager?.isKeyPressed('alt'),
    }),{clock:()=>performance.now()});
    const releaseHologram=bindMatterHologram(renderer.characterManager,tableFlight,tabletopPlayers);
    let matterComposerHadFocus=false;
    const tableInputAllowed=()=>!moving&&!entering&&!document.hidden&&document.hasFocus()&&!mapPanel.open&&
      !document.querySelector('#conversation-panel').contains(document.activeElement)&&
      !document.querySelector('dialog[open]')&&!signalEditor?.active;
    // On the ring the sun keeps one direction in the traveler's radial frame,
    // matching the terrain's own per-place sunlight. It moves in 4 m steps so
    // shadow edges stay still between steps. Lightweight graphics keep the
    // shadow volume at the ring's empty centre and pay for no casters.
    let solarKey,solar;
    let nightKey=null;
    const aimSun=position=>{
      const onRing=outsideRing();
      // Keep the last aim while the ring is shown without a confirmed position.
      if(onRing&&!(position&&[position.x,position.y,position.z].every(Number.isFinite)))return;
      const step=value=>Math.round(value/4)*4;
      const near=onRing?{x:step(position.x),y:step(position.y),z:step(position.z)}:null;
      if(onRing){
        const time=Math.floor(Date.now()/1000);
        const key=[time,position.x,position.y,position.z].join(':');
        if(key!==solarKey){
          solar=toroidalSky(new Date(time*1000),position);
          nightKey=nightSkyKey(solar);
          solarKey=key;
        }
        ring?.setSun(solar,nightKey?.direction);
      }
      const lightBucket=Math.floor(Date.now()/3000);
      const key=near?`${near.x}:${near.y}:${near.z}:${rendererBudget.lightweight}:${lightBucket}`:null;
      if(key===ringSun)return;
      ringSun=key;
      if(!near){
        light.color.setHex(0xffefd6);light.intensity=1.8;
        light.position.set(12,22,10);light.target.position.set(0,0,-6);
        return;
      }
      const [x,y,z]=nightKey?toroidalSunDirection(near,TOROIDAL_TERRAIN,nightKey.direction):solar.sun;
      const anchor=rendererBudget.lightweight?{x:0,y:0,z:0}:near;
      light.color.setHex(nightKey?.color??TOROIDAL_SUN.color);
      light.intensity=nightKey?.intensity??TOROIDAL_SUN.intensity*solar.daylight;
      light.target.position.set(anchor.x,anchor.y,anchor.z);
      light.position.set(anchor.x+x*40,anchor.y+y*40,anchor.z+z*40);
    };
    const bankReflection=new URLSearchParams(location.search).get('reflejos')==='orilla';
    const houseProjected=()=>Boolean(document.querySelector('#workshop #ring-house')?.isConnected);
    outdoorArrivalReady=()=>outsideRing()?ring?.group.children.length>0:Boolean(geometryProbe?.snapshot());
    outdoorReady=()=>outdoorArrivalReady()&&(!outsideRing()||houseProjected());
    renderer.render=renderState=>{
      const presentationNow=performance.now(),presentationElapsed=presentationNow-previousPresentationFrame;
      previousPresentationFrame=presentationNow;
      // MML reports one fixed step even when several simulation steps
      // advanced the player between two rendered frames.
      const presentationSeconds=Math.min(.1,presentationElapsed/1000);
      const character=client.getLocalCharacterState(),position=character?.position;
      if(position&&!moving&&activeSpace.avatarPosePresence){
        const low=!entering&&!tableFlight.active&&client.getCharacterManager().localController?.characterOnGround&&
          client.keyInputManager?.isKeyPressed('alt');
        const usingCharacterTable=activeSpace.id===CHARACTER_STUDIO&&tableFlight.active;
        poses.update(client.getWorldConnection(),activeSpace.id,usingCharacterTable?'table':
          outsideRing()&&flightEnabled?(localFlightBoost()?'fly-fast':'fly'):low?'crouch':'ground');
      }
      const yaw=client.getCharacterManager().localController?.networkState.rotation?.eulerY;
      if(outsideRing()){
        ring??=new ToroidalTerrainRenderer(renderer.mmlCompositionScene.group,base,undefined,{bankReflection});
        const door=houseEntrances(activeSpace)[0]?.door;
        ring.setEntrance(door);
        ring.setResidenceContact(scenery?.residence.root.visible === true);
        if(position){
          ring.update(position,rendererBudget.lightweight);
          cave??=new ToroidalCave(renderer.mmlCompositionScene.group,renderer.mmlCompositionScene.mmlScene);
          cave.update(position);
          if(!entering&&!moving){
            // Let arrival paint first. Scenery roots use the detailed surface,
            // which can still be loading after the coarse ring is traversable.
            const now=performance.now();
            sceneryAfter??=now+240;
            if(now>=sceneryAfter){
              if(!scenery){
                scenery=new ToroidalScenery(renderer.mmlCompositionScene.group,base,renderer.mmlCompositionScene.mmlScene);
                ring.setWoodlandShade(scenery.woodland.shadeTexture);
              }
              scenery.update(position,rendererBudget.lightweight,door,solar?.daylight,ring.hasDetailedTerrain,solar?.direction);
            }
          }
        }
        if(position&&!moving&&!needsSync&&networkScope===activeSpace.id&&activeSpace.terrainRun){
          const yaw=client.getCharacterManager().localController?.networkState.rotation.eulerY;
          if(Number.isFinite(yaw)&&[position.x,position.y,position.z].every(Number.isFinite)){
            confirmedRingPose={run:activeSpace.terrainRun,actor:activeSpace.actorRef,
              anchor:{...position,yaw:yaw*180/Math.PI,resumeExterior:true}};
          }
        }
      }else if(ring){
        flightEnabled=false;doubleJumpPending=false;trickStarted=-Infinity;resetFlightTap();
        previousSpacePress=null;
        ring.dispose();
        cave?.dispose();
        scenery?.dispose();
        sceneryAfter=null;
        ring=cave=scenery=null;
      }
      const roomReady=inside&&networkScope===activeSpace.id&&entryRoomReady(remoteScene,roomModel);
      const waitingForRoomFrame=inside&&moving&&!roomReady;
      if(roomReady&&roomModel&&activeSpace.matterFloorSplat&&!floorSplatScope)void mountFloorSplat();
      if(roomReady&&roomModel&&!releaseFoyerFloor&&activeSpace.id===ATELIER_FOYER){
        releaseFoyerFloor=bindFoyerFloorFinish(roomModel.getContainer());
      }
      if(roomReady&&roomModel&&rendererBudget.lightweight&&activeSpace.collectionShelves&&!releaseLightweightGlazing)
        releaseLightweightGlazing=useLightweightMatterGlazing(roomModel.getContainer());
      if(roomReady&&roomModel&&activeSpace.matterStyles&&!matterStyleScope){
        const catalog=activeSpace.matterStyles;
        const fallback=catalog.looks.find(({id})=>id===(catalog.fallback??catalog.default));
        const preferred=catalog.looks.find(({id})=>id===(catalog.preferred??catalog.default))??fallback;
        const group=roomModel.getContainer();
        matterStyleScope={catalog,binding:bindMatterStyle(group,catalog),glazing:bindOrbitalMatterGlazing(group),
          style:fallback,images:new Map()};
        document.body.dataset.roomLook=fallback.id;
        roomStyleChoice.replaceChildren(...catalog.looks.map(({id,label})=>new Option(label,id)));
        roomStyleChoice.value=fallback.id;
        roomStyle.hidden=false;
        void applyMatterStyle(preferred);
      }
      drawWorld=!waitingForRoomFrame&&!contentVisitor?.isOpeningOverWorld();
      if(backgroundFocus)frameBudget.setPixelLimit(outsideRing()&&!rendererBudget.lightweight?backgroundFocus.pixelLimit:undefined);
      frameBudget.sample(drawWorld&&!document.hidden&&!!position&&!moving&&!needsSync&&(!hot||networkScope===activeSpace.id));
      light.visible=!inside||!activeSpace.indoorLighting;
      aimSun(position);
      const litFacade=houseLight.update(outsideRing()?solar:null);
      ring?.setFacadeContact(litFacade);
      const key=inside&&activeSpace.keyLight||null;
      const keyRoom=key?activeSpace.id:null;
      if(keyRoom!==inspectionRoom||!key?.inspection)inspectionMix=0;
      inspectionRoom=keyRoom;
      if(key!==selectedKey){
        selectedKey=key;
        interiorKey.visible=!!key;
        if(key){
          roomKeyPosition.set(...key.position);
          roomKeyTarget.set(...key.target);
          roomKeyColor.set(key.color);
          if(key.inspection){
            inspectionKeyPosition.set(...key.inspection.position);
            inspectionKeyTarget.set(...key.inspection.target);
            inspectionKeyColor.set(key.inspection.color);
          }
        }
      }
      const collectionRoom=inside&&!moving&&activeSpace.collectionShelves?activeSpace.id:null;
      const tableInspection=Boolean(collectionRoom&&collectionShelves.room===collectionRoom&&
        tableFlight.active&&collectionShelves.worktable.model);
      if(key){
        const targetMix=key.inspection&&tableInspection?1:0;
        inspectionMix=targetMix+(inspectionMix-targetMix)*Math.exp(-.007*presentationElapsed);
        interiorKey.position.copy(roomKeyPosition);
        interiorKey.target.position.copy(roomKeyTarget);
        interiorKey.color.copy(roomKeyColor);
        interiorKey.intensity=key.intensity??160;
        interiorKey.shadow.radius=1;
        if(key.inspection&&inspectionMix>.001){
          interiorKey.position.lerp(inspectionKeyPosition,inspectionMix);
          interiorKey.target.position.lerp(inspectionKeyTarget,inspectionMix);
          interiorKey.color.lerp(inspectionKeyColor,inspectionMix);
          interiorKey.intensity+=(key.inspection.intensity-interiorKey.intensity)*inspectionMix;
          interiorKey.shadow.radius+=((key.inspection.shadowRadius??1)-1)*inspectionMix;
        }
      }
      const skySelection=activeSpace?.outdoorSky;
      // Wait for the scoped room model to occlude the background outside its
      // authored apertures. Disconnect removes the scene and clears this view.
      const roomSkyReady=skySelection&&networkScope===activeSpace.id&&remoteScene?.isConnected&&
        roomModel?.modelGraphics?.hasLoadedModel();
      sky.update(!outsideRing()&&(!inside||roomSkyReady)?skySelection:null);
      if(outsideRing()&&position){
        atmosphere??=new ToroidalAtmosphere(renderer.mmlCompositionScene.group.parent,base);
        const eye=options.coreCameraManager.getCameraState().position;
        checkWeather();
        const now=Date.now(),previousWeatherText=weatherLabel?.textContent;
        const currentWeather=weather&&now-weather.at<30*60000?weather:null;
        const weatherText=currentWeather?`José de la Quintana · viento ${Math.round(currentWeather.windSpeed)} km/h${currentWeather.storm?' · tormenta estimada':currentWeather.precipitation>0?' · lluvia estimada':''}`:
          'José de la Quintana · clima sin datos recientes';
        if(weatherLabel&&previousWeatherText!==weatherText)weatherLabel.textContent=weatherText;
        atmosphere.update(eye,solar,now,currentWeather,skyExposure,companion.motion.matches);
        rain.update(eye,atmosphere.sky.material.uniforms.waterDepth.value<.03?currentWeather:null,
          performance.now(),companion.motion.matches);
        ring?.setView(eye,toroidalViewDepth(eye),atmosphere.panorama,atmosphere.celestialBasis);
      }else if(atmosphere){
        atmosphere.dispose();
        atmosphere=null;
      }
      nativeAvatarLayer.update();
      if(pointRequest&&!pointRequest.allowed())pointRequest.controller.abort();
      const tableNow=performance.now(),tableWorld=client.getWorldConnection();
      const tableConnection=tableWorld?.getConnectionId();
      const atTable=tableFlight.active&&!moving&&!entering&&!document.hidden;
      points.update(activeSpace.id,tableWorld,table,collectionShelves.tabletopPlayers,tableNow,
        atTable?tableConnection:null,options.coreCameraManager.getCameraState(),worldCanvas.clientHeight);
      const pointed=atTable?points.gazes.get(tableConnection):null;
      tableGaze=pointed??tableAttention.sample(tableNow);
      const mode=outsideRing()?radialMovementMode:'ground';
      const help=mode==='ground'?dryVerticalHelp:mode==='flight'?' · Apuntá para girar o cambiar de altura · Alt baja · Espacio sube · Shift acelera':
        ' · Apuntá para nadar · Alt para sumergirte · Espacio para subir · Shift acelera';
      if(help!==presentedHelp){
        presentedHelp=help;
        verticalHelp.textContent=help;
      }
      const signal=pendingSignal?.until>performance.now()&&!document.hidden&&!moving&&!entering&&drawWorld?pendingSignal:null;
      let signalTarget;
      if(signal){
        const mark=matterHud.hud.getSurfaceBounds(pendingToolId)??pendingBook?.button.getBoundingClientRect();
        const canvas=worldCanvas.getBoundingClientRect();
        if(mark?.width&&canvas.width&&canvas.height)
          signalTarget=pendingGaze.set((mark.left+mark.width/2-canvas.left)*2/canvas.width-1,
            1-(mark.top+mark.height/2-canvas.top)*2/canvas.height,.15).unproject(mainCamera);
        if(!signal.sounded){
          signal.sounded=true;
          const robot=companion.object;
          const pan=robot?pendingSpeaker.copy(robot.position).project(mainCamera).x:0;
          worldAudio.playCue('pending-new',{pan:Number.isFinite(pan)?pan:0});
        }
      }
      companion.update({position,yaw,notification:signal?.id,notificationTarget:signalTarget,outdoor:outsideRing(),table:tableFlight,gaze:tableGaze,
        gazeMesh:pointed?points.cues.get(tableConnection)?.mesh:tableAttention.part(),eye:tableFlight.active?options.coreCameraManager.getCameraState().position:null,
        water:mode==='swim'?'submerged':mode==='surface'?'surface':null,
        colliders:options.coreCameraManager.collisionsManager,
        crouch:!flightEnabled&&!tableFlight.active&&client.getCharacterManager().localController?.characterOnGround&&client.keyInputManager?.isKeyPressed('alt'),
        explicitFlight:flightEnabled,grounded:!flightEnabled&&client.getCharacterManager().localController?.characterOnGround===true,
        visible:!entering&&!moving&&drawWorld,seconds:presentationSeconds});
      if(!outsideRing())rain.update(null,null,0,false);
      avatarPracticals.update({
        player:renderer.characterManager.loadedCharacters.get(character?.connectionId)?.character.getMesh(),
        feet:position,companion:companion.object,outdoor:outsideRing(),table:tableFlight.active,
        daylight:solar?.daylight,visible:!entering&&!moving&&drawWorld,
        thrust:flightEnabled&&radialMovementMode==='flight'&&!client.getCharacterManager().localController?.characterOnGround,
        boost:localFlightBoost(),
      });
      const wakesVisible=outsideRing()&&!entering&&!moving&&drawWorld&&!document.hidden&&!companion.motion.matches;
      if(wakesVisible&&companion.object){
        const robot=companion.object;
        const {feet,ground,waterLevel}=exteriorSample(robot.position);
        flightWake.observe('companion',robot.position,robot.up,
          mode==='flight'&&(ground>=waterLevel||feet>waterLevel),presentationSeconds);
      }
      flightWake.update(wakesVisible);
      const waterEffectsVisible=outsideRing()&&!entering&&!moving&&drawWorld&&!document.hidden;
      waterSplash.update(waterEffectsVisible);
      waterWake.update(waterEffectsVisible&&!companion.motion.matches);
      galleryModels.update();
      collectionShelves.update(collectionRoom,collectionRoom?remoteScene:null,position,
        collectionRoom?activeSpace.objects.find(object=>object.id==='worktable')?.position:null,
        activeSpace?.sharedConversation===true,matterStyleScope?.style.contactShadows===true,
        options.coreCameraManager.getCameraState(),renderer.composer.renderer.domElement.clientHeight,inspectionMix);
      const opaqueVisit=contentVisitor?.frame&&!contentVisitor.panel.classList.contains('is-walking');
      const settingsOpen=Boolean(document.querySelector('#appearance-dialog[open],#video-dialog[open]'));
      const toolModal=Boolean(worldHistory?.opened||contentVisitor?.index?.opened||document.querySelector('dialog[open]:not([data-native-settings])'));
      if(settingsOpen!==settingsInputCaptured){
        settingsInputCaptured=settingsOpen;
        touchControls.pause(settingsOpen);
        if(settingsOpen){
          client.keyInputManager?.handleUnfocus();
          if(document.pointerLockElement===matterHud.canvas)document.exitPointerLock();
          options.coreCameraManager.activePointers.clear();
        }
      }
      const conversation=document.getElementById('conversation-panel');
      const compactTouch=matterHud.compactTouch();
      const quietTouch=Boolean(compactTouch&&conversation.hidden&&touchControls.moving());
      const characterRoom=inside&&!moving&&activeSpace.id===CHARACTER_STUDIO;
      const characterBench=characterRoom&&remoteScene?.isConnected?
        activeSpace.objects.find(object=>object.id===characterWorktable.id)?.position:null;
      characterTable.update(position,characterBench);
      matterHud.selectTable(characterRoom?characterTable:collectionShelves.worktable);
      const matterComposerFocused=Boolean(tableFlight.inspectParts&&conversation.contains(document.activeElement));
      if(matterComposerFocused&&!matterComposerHadFocus){
        client.keyInputManager?.handleUnfocus();
        options.coreCameraManager.activePointers.clear();
        releaseOrbit.release();
      }
      matterComposerHadFocus=matterComposerFocused;
      const conversationDisplacesTable=!conversation.hidden&&!(collectionRoom&&tableFlight.inspectParts);
      matterHud.update((!collectionRoom&&!characterRoom)||needsSync||conversationDisplacesTable||
        opaqueVisit||toolModal||settingsOpen,!entering&&!moving&&drawWorld&&!opaqueVisit&&!toolModal,quietTouch&&!settingsOpen);
      characterTable.render(tableNow);
      garden.update(inside&&!moving&&activeSpace.playableInterior?activeSpace.id:null);gardenMarkers();
      if(!inside){worldIndication?.update();if(!moving)playableHUD.update(state?.lightExercise===true?position:null);}
      if(!moving){
        if(inside)contentVisitor?.refreshScopedCatalog();
        contentVisitor?.update(position);
        updateDoor(entering||outsideRing()&&!houseProjected()?null:position,
          ()=>options.coreCameraManager.getCameraState().rotation);
      }
      if(!conversation.hidden)fitConversationWindow();
      const worldToolsVisible=!entering&&!moving&&!needsSync&&drawWorld&&!opaqueVisit&&!toolModal&&!settingsOpen;
      const navigationVisible=worldToolsVisible&&conversation.hidden&&!quietTouch;
      const terrainPosition=outsideRing()?position:null;
      const peekTerrain=Boolean(terrainPosition&&compactTouch&&navigationVisible&&!mapPanel.open&&
        !matterHud.active&&!updateDoor.bearing?.());
      const paintedRaster=minimap(terrainPosition,yaw,activeSpace.entrances,peekTerrain);
      const shortMapHeight=matterHud.map.layout==='portrait-short'?448:430;
      const compactMap=compactTouch==='portrait'&&matterHud.canvas.clientHeight<shortMapHeight?'portrait-short':compactTouch;
      matterHud.map.update(navigationVisible,paintedRaster,compactMap);
      matterHud.map.updatePeek(peekTerrain);
      const touchAvailable=worldToolsVisible&&(conversation.hidden||!compactTouch&&!!conversation.dataset.travelLane)&&
        !mapPanel.open&&!signalEditor.active&&!document.hidden&&document.hasFocus();
      const movementLane=conversation.hidden?'':conversation.dataset.travelLane??'';
      const touchLocomotion=touchAvailable&&(!tableFlight.active||tableInputAllowed());
      matterHud.syncMovement(touchLocomotion&&Boolean(matterHud.toolGroup)&&navigator.maxTouchPoints>0,
        movementLane,tableFlight.active||mode!=='ground');
      touchControls.pause(!touchLocomotion||!conversation.hidden&&!matterHud.movementPresented);
      matterHud.updateBearing(navigationVisible&&!matterHud.active);
      beaconControls.update(inside&&!moving&&!needsSync&&remoteScene?activeSpace.objects:null,position);
      const passageAvailable=worldToolsVisible&&!quietTouch&&!matterHud.map.compact&&(conversation.hidden||concurrentRoomDoors())&&
        !matterHud.active&&Boolean(matterHud.toolGroup)&&!signalEditor.active;
      const compactDoor=Boolean(matterHud.toolLayout?.compact);
      let label=null,anchoredDoor=false;
      if(inside&&passageAvailable&&!matterHud.coarsePointer.matches){
        // Keep the same precedence as E. The label never runs an action.
        const door=updateDoor.doorOffer?.();
        const bench=characterRoom?characterTable.anchor:collectionShelves.worktable.anchor;
        if(door?.anchor&&!door.busy){
          label={anchor:door.anchor,label:door.title,key:'E'};
          anchoredDoor=true;
        }
        else if(!door&&bench&&matterHud.nearbyTableAvailable&&
            !options.coreCameraManager.isFlyCameraOn()&&client.getCharacterManager().localController){
          const anchor=characterRoom?bench:{...bench,y:bench.y+.78};
          label={anchor,label:'Usar mesa',key:'E'};
        }else if(beaconWorldAvailable())label=beaconControls.nearbyAction();
      }
      const actionPlacement=actionLabel.update(label,options.coreCameraManager.getCameraState(),matterHud.canvas.clientHeight,
        {light:document.body.dataset.hudTheme==='light',feet:position,card:!anchoredDoor});
      matterHud.door.update(passageAvailable,compactDoor,anchoredDoor?actionPlacement:null);
      matterHud.collection.update(navigationVisible&&!matterHud.active&&!mapPanel.open&&!signalEditor.active);
      const {left:statusLeft,right:statusRight}=matterHud.toolInsets();
      const compactConversation=!conversation.hidden&&conversationFirst.matches;
      conversation.toggleAttribute('data-compact-priority',compactConversation);
      const suppressNotice=compactConversation&&worldNotice.temporary;
      worldNotice.element.toggleAttribute('data-compact-suppressed',suppressNotice);
      matterHud.pending.update(pendingBook,!entering&&drawWorld&&!opaqueVisit&&!settingsOpen&&
        (!toolModal||pendingBook?.dialog.open),worldCanvas.clientWidth>=650&&worldCanvas.clientHeight>=445);
      matterHud.status.update({
        noticeVisible:!suppressNotice&&!entering&&drawWorld&&!opaqueVisit,noticeOpacity:worldNotice.opacity,
        controlsVisible:!inside&&navigationVisible&&!mapPanel.open&&!matterHud.coarsePointer.matches&&matterHud.canvas.clientWidth>1150,
        width:matterHud.canvas.clientWidth-statusLeft-statusRight,height:matterHud.canvas.clientHeight,
      });
      const near=tableFlight.inspectParts?matterInspectionNear:worldNear;
      if(mainCamera.near!==near){
        mainCamera.near=near;
        mainCamera.updateProjectionMatrix();
      }
      render(renderState);
      if(drawWorld)presentWorldFrame();
      if(!inside&&drawWorld)geometryProbe.afterRender();
      else if(inside)keepRoomArt();
      if(hot&&moving&&canFinishMove())setMoving(false);
      if(entering&&drawWorld&&position&&!moving&&!needsSync&&(!hot||networkScope===activeSpace.id)&&
         (inside?entryRoomReady(remoteScene,roomModel):outdoorArrivalReady()))worldEntered();
      const now=performance.now();
      if(coldExterior&&position&&!inside&&!moving&&!needsSync&&networkScope===activeSpace.id&&now>=nextDressing){
        nextDressing=now+350;
        const pending='#workshop m-model[data-deferred-src]:not([src])';
        const model=document.querySelector(pending+'[id^="facade-"]')??document.querySelector(pending);
        const source=model?.getAttribute('data-deferred-src');
        if(source?.startsWith(url('assets/').pathname))model.setAttribute('src',source);
      }
    };
    renderer.dispose=()=>{weatherRequest?.abort();rain.dispose();avatarPracticals.dispose();backgroundFocus?.dispose();poses.dispose();releaseRadialMovement?.();releaseHeadroom?.();ring?.dispose();cave?.dispose();scenery?.dispose();atmosphere?.dispose();frameBudget.dispose();releaseOrbit();worldFocus.abort();tableAttention.dispose();pointRequest?.controller.abort();document.removeEventListener('visibilitychange',abortHiddenPoint);points.dispose();if(pointView===points)pointView=null;display.dispose();if(conversationDisplay===display)conversationDisplay=null;matterHud.dispose();releaseHologram();releaseFlightAnimation();releaseTableFlight?.();releaseSearchKeys?.();if(matterFlight===tableFlight)matterFlight=null;removeScene();sceneCache?.clear();worldPicker.dispose();worldIndication.dispose();actionLabel.dispose();flightWake.dispose();waterSplash.dispose();waterWake.dispose();companion.dispose();if(companionAvatar===companion)companionAvatar=null;nativeAvatarLayer.dispose();geometryProbe.dispose();sky.dispose();houseLight.dispose();interiorKey.dispose();dispose();};
    queueMicrotask(()=>{
      if(client.keyInputManager){
        const keys=client.keyInputManager,shouldCapture=keys.shouldCaptureKeyPress;
        const releaseRun=bindWorldKeyShortcuts(keys);
        const capture=()=>!matterHud?.hud.ownsTextInput(document.activeElement)&&shouldCapture.call(keys);
        keys.shouldCaptureKeyPress=capture;
        releaseSearchKeys=()=>{releaseRun();if(keys.shouldCaptureKeyPress===capture)keys.shouldCaptureKeyPress=shouldCapture;};
      }
      releaseHeadroom=bindInteriorHeadroom(client.getCharacterManager(),()=>inside);
      releaseRadialMovement=bindToroidalMml(client.getCharacterManager(),options.coreCameraManager,outsideRing,
        ()=>flightEnabled,firstExteriorDoor,(mode,boost=false)=>{radialMovementMode=mode;radialBoosting=boost;},aiming,releaseOrbit.pitch,
        ()=>{const requested=doubleJumpPending;doubleJumpPending=false;return requested;},
        ()=>{trickStarted=performance.now();});
      firstExteriorDoor=null;
      releaseTableFlight=bindMatterFlight(client.getCharacterManager(),options.coreCameraManager,tableFlight,tableInputAllowed,()=>matterHud.leave());
      options.onInitialized();
    });
    return renderer;
  },
  animationConfig:animations,
  loadingScreen:{title:'Holodeck',subtitle:'Abriendo la plaza',background:'#20464c',color:'#f4e8cd'},
});
client.update();
const worldAudio=new WorldAudio({onChange:()=>updateSoundButton()});
let soundBusy=false;
// Development inspection surface only. It reports actual client state.
window.holodeckDevelopment={client,appliedGeometry:()=>geometryProbe?.snapshot()||null,audioState:()=>worldAudio.status(),avatarState:()=>nativeAvatarLayer?.status(),tableFlight:()=>({active:!!matterFlight?.active,bounds:matterFlight?.bounds}),companion:()=>companionAvatar?.object??null,companionSpeech:level=>companionAvatar?.setSpeechLevel(level),flight:()=>flightEnabled,hudWindow:id=>matterHud?.windows.geometry.get(id)??null,toolBounds:id=>matterHud?.toolBounds(id)??null};
const $=selector=>document.querySelector(selector);
notifyFullscreenError=message=>{
  if($('#conversation-panel').hidden&&matterHud?.compactTouch()!=='landscape')return false;
  say(message,{transient:true});
  return true;
};
contentVisitor=new ContentVisitor({document,window,base,say,scoped:inside,roomId:hot?activeSpace.id:null,onCatalog:entries=>{
  if(remoteScene){galleryModels?.sync(entries);applyGallerySigns(remoteScene,entries);}
}});
worldHistory=new WorldHistory({document,window,getState:()=>state,
  load:(query,{signal})=>api('activity?'+new URLSearchParams(query),undefined,{signal}),
  resumeWorld:native=>{
    document.activeElement?.blur();window.focus();
    if(native)requestAnimationFrame(()=>{if(!worldHistory.opened&&$('#conversation-panel').hidden)matterHud?.focusTool('activity');});
  },onDiscuss:()=>openConversation(true),
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
  button.textContent=status.active?'Silenciar':status.selected?'Reanudar sonido':'Activar sonido';
  button.setAttribute('aria-pressed',String(status.active));
  button.setAttribute('aria-label',status.active?'Silenciar sonido del mundo':status.selected?'Reanudar sonido del mundo':'Activar sonido del mundo');
  button.title=status.supported?'Ambiente suave y sonidos de los cambios del mundo':'El sonido no está disponible en este navegador';
  button.disabled=soundBusy||!status.supported||status.disposed;
  button.toggleAttribute('data-audio-unavailable',!status.supported);
}
async function toggleWorldSound(){
  if(soundBusy)return;
  soundBusy=true;updateSoundButton();
  const enable=!worldAudio.status().active;
  try{const result=enable?await worldAudio.enableFromGesture():await worldAudio.disable();
    if(enable&&result.active)refresh().catch(()=>{});
    if(enable&&!result.active)say('No pude activar el sonido. Podés intentarlo de nuevo.');
  }finally{soundBusy=false;updateSoundButton();}
}
$('#sound').onclick=event=>{if(event.isTrusted)void toggleWorldSound();};
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
  if(worldHistory?.opened){worldHistory.message(text);worldNotice.clear();}
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
pendingBook=mountPendingBook({window,document,world:new URL(base),
  onConversation:()=>openConversation(true),
  onNew:()=>{pendingSignal={id:++pendingSerial,until:performance.now()+2300,sounded:false};},
  currentActor:()=>activeSpace?.actorRef??state?.actorRef,
  select:()=>api('conversation-surface',undefined,{signal:AbortSignal.timeout(4500)}),
  onJump:async room=>{
    if(room===activeSpace?.id){say('Ya estás en ese lugar.');return;}
    if(entering||moving||needsSync){say('Esperá a que termine el viaje.');return;}
    await updateDoor.jump?.(room);
  }});
function noteRecovery(kind,result={}){
  const expiredCommand=kind==='command'&&result.code==='not-recorded'&&pending&&
    ((Number.isFinite(result.serverTime)&&Number.isFinite(result.retryWindowMs)&&result.serverTime-pending.issuedAt>result.retryWindowMs)||
      (typeof result.run==='string'&&result.run!==pending.run));
  recovery[kind]={code:result.code||'unknown',retained:result.retained,knownNotSubmitted:result.knownNotSubmitted===true,
    tracking:result.tracking===true,retryable:result.retryable!==false&&result.tracking!==true,
    expired:result.expired===true||result.code==='expired'||!!expiredCommand};
  renderRecovery();
}
function clearRecovery(kind){recovery[kind]=null;if(closingRecovery?.kind===kind)closingRecovery=null;renderRecovery();}
function recoveryRecord(kind){return kind==='command'?pendingMetadata:nativeTurn;}
function recoveryRequestId(kind){return (kind==='command'?pending:nativeTurn)?.id;}
function recoverySelectionCurrent(selection){
  const {kind,id,record,info,actorRef,run}=selection;
  return recoveryRecord(kind)===record&&recoveryRequestId(kind)===id&&recovery[kind]===info&&
    state?.actorRef===actorRef&&state?.run===run;
}
function canRetryRecovery(kind,info,record){
  const ownerMatches=sameActor(record,state?.actorRef);
  const legacyRetained=kind==='native'&&!record.body&&info.retained===true&&(!record.actorRef||ownerMatches);
  const run=record.run??record.command?.run;
  const runChanged=!!run&&!!state?.run&&run!==state.run;
  return !(recoveryBusy||info.expired||!info.retryable||runChanged||(!ownerMatches&&!legacyRetained));
}
function renderRecovery(){
  const panel=$('#recovery-panel'),items=$('#recovery-items'),focused=document.activeElement;
  const previousFocus=items.contains(focused)?focused.closest('.recovery-item'):null;
  const openDetails=items.querySelector('details[open]')?.parentElement.dataset.request;
  let restoreFocus;
  if(closingRecovery&&!recoverySelectionCurrent(closingRecovery))closingRecovery=null;
  items.replaceChildren();
  for(const kind of ['command','native']){
    const info=recovery[kind],record=recoveryRecord(kind),id=recoveryRequestId(kind);
    if(!info||!record||!id)continue;
    const selection={kind,id,record,info,actorRef:state?.actorRef,run:state?.run};
    const current=()=>!recoveryBusy&&recoverySelectionCurrent(selection);
    const armed=closingRecovery?.kind===kind&&closingRecovery.id===id;
    const card=document.createElement('div');card.className='recovery-item';card.dataset.kind=kind;card.dataset.request=id;
    const title=document.createElement('p');title.className='recovery-title';title.textContent=kind==='command'?'Tu cambio en el mundo':'Tu mensaje';card.append(title);
    const description=document.createElement('p');
    description.textContent=info.expired?'Este envío ya venció. Podemos revisar cómo quedó el mundo y cerrar su seguimiento.':info.knownNotSubmitted?'Este intento no llegó a completarse. Podés volver a enviar el mismo contenido.':'Todavía no hay una confirmación. Comprobar no vuelve a enviar nada.';
    if(info.tracking)description.textContent='Una parte del turno sigue en curso. Podés comprobarla o dejar de seguirla, sin cancelarla.';
    if(kind==='native'&&!record.body&&info.retained===false)description.textContent='La referencia se conservó, pero esta pestaña no tiene el texto original. Podés cerrar el seguimiento y escribir otro mensaje.';
    card.append(description);
    if(kind==='native'&&record.body?.text&&sameActor(record,state?.actorRef)){const details=document.createElement('details'),summary=document.createElement('summary'),original=document.createElement('p');details.open=openDetails===id;summary.textContent='Ver mensaje conservado';original.textContent=record.body.text;original.style.whiteSpace='pre-wrap';details.append(summary,original);card.append(details);}
    if(record.actorRef&&state?.actorRef&&record.actorRef!==state.actorRef){const warning=document.createElement('p');warning.textContent='Este envío pertenece a otra identidad. No se reenviará desde esta sesión.';card.append(warning);}
    if(record.run&&state?.run&&record.run!==state.run){const warning=document.createElement('p');warning.textContent='Este envío pertenece a una visita anterior. Comprobalo o cerrá su seguimiento antes de iniciar otro.';card.append(warning);}
    const actions=document.createElement('div');actions.className='row';
    const check=document.createElement('button');check.textContent='Comprobar';check.dataset.action='check';check.disabled=recoveryBusy;check.onclick=()=>{if(current())void recoveryAction(selection,'check');};actions.append(check);
    const retry=document.createElement('button');retry.textContent=kind==='command'?'Reintentar cambio':'Reintentar mensaje';retry.dataset.action='retry';
    retry.disabled=!canRetryRecovery(kind,info,record);
    retry.onclick=()=>{if(current()&&canRetryRecovery(kind,info,record))void recoveryAction(selection,'retry');};actions.append(retry);
    const close=document.createElement('button');close.textContent=armed?'Volver':'Dejar seguimiento';close.dataset.action='close';close.disabled=recoveryBusy;
    close.onclick=()=>{if(current()){closingRecovery=armed?null:selection;renderRecovery();}};actions.append(close);
    card.append(actions);
    if(armed){
      const warning=document.createElement('p');warning.className='recovery-warning';warning.id='recovery-warning-'+kind;warning.textContent='El cierre afecta solo al seguimiento en esta pestaña. Se conserva la referencia y el contenido disponible.';card.append(warning);
      const confirm=document.createElement('button');confirm.textContent='Conservar y cerrar';confirm.dataset.action='confirm';confirm.disabled=recoveryBusy;
      confirm.setAttribute('aria-describedby',warning.id);
      const armedSelection=closingRecovery;
      confirm.onclick=()=>closeTracking(armedSelection);card.append(confirm);
    }
    if(previousFocus?.dataset.kind===kind&&previousFocus.dataset.request===id){
      restoreFocus=Array.from(card.querySelectorAll('button,summary')).find(control=>
        !control.disabled&&control.tagName===focused.tagName&&control.dataset.action===focused.dataset.action);
    }
    items.append(card);
  }
  panel.hidden=!items.children.length;
  restoreFocus?.focus({preventScroll:true});
}
function closeTracking(selection){
  if(recoveryBusy||selection!==closingRecovery||!recoverySelectionCurrent(selection))return;
  const {kind,id,record}=selection;
  try{archiveIntent(sessionStorage,archiveKey,{...record,kind});}
  catch{say('Esta pestaña ya conserva varios envíos sin confirmar. Comprobá alguno antes de cerrar otro seguimiento.');return;}
  if(kind==='command'){
    signalEditor.untrack(id);pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);
    if(preview?.submission===id)closePreview({settled:true});
  }
  else{archivedNativeIds.add(id);nativeTurn=null;sessionStorage.removeItem(turnKey);updateNativeAvailability();}
  clearRecovery(kind);say('Cerramos el seguimiento. El envío anterior no se canceló ni se deshizo.');
}
async function recoveryAction(selection,action){
  if(recoveryBusy||!recoverySelectionCurrent(selection))return;
  recoveryBusy=true;renderRecovery();
  const {kind,id,actorRef,run}=selection;
  const current=()=>recoveryRequestId(kind)===id&&state?.actorRef===actorRef&&state?.run===run;
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
  select.dataset.topicScope=activeSpace.id;
  const entries=[['','Este lugar',0],...objects.map(object=>[object.id,object.title,object.revision])];
  const signature=JSON.stringify(entries);
  if(signature!==select.dataset.topics){
    select.dataset.topics=signature;
    select.replaceChildren(...entries.map(([id,title,revision])=>{
      const option=document.createElement('option');
      option.value=id;option.textContent=title;option.dataset.revision=revision;
      return option;
    }));
  }
  select.value=roomSubject(objects)?.id??'';
}
$('#room-topic-choice').onchange=event=>{
  const item=roomObjects().find(object=>object.id===event.target.value);
  roomTopic=item?{id:item.id,revision:item.revision}:null;
};
let toolbarCaption='';
function showToolbarCaption(text,settled=false){
  if(text===toolbarCaption)return;
  if(!text){
    if(!settled&&worldNotice.element.textContent===toolbarCaption)worldNotice.clear();
  }else worldNotice.show(text,{transient:settled});
  toolbarCaption=settled?'':text;
}
function projectVoiceControls({recording=false,speaking=false,speakerReady=false,phase,words,previewUnavailable,needsReview}={}){
  const mic=$('#tool-mic'),speaker=$('#tool-speaker');
  mic.textContent=recording?'Enviar audio':'Mic';
  mic.setAttribute('aria-pressed',String(recording));
  speaker.textContent=speaking?'🔊 Audio':'🔇 Audio';
  speaker.setAttribute('aria-pressed',String(speaking));
  speaker.setAttribute('aria-label',speaking?'Silenciar respuestas habladas':'Activar respuestas habladas');
  speaker.disabled=!speakerReady;
  if(recording&&phase){
    const label=words?'● Grabando · '+words:
      previewUnavailable?'● Grabando · transcripción en vivo no disponible':'● Grabando · te estoy escuchando';
    showToolbarCaption(label);
  }else if(phase==='permission')showToolbarCaption('Abriendo el micrófono…');
  else if(phase==='finalizing'||phase==='sending')showToolbarCaption('Enviando audio…');
  else if(phase==='ready'||phase==='idle'&&needsReview)
    showToolbarCaption('Tu grabación quedó en Conversar para revisar.',true);
  else if(phase==='idle')showToolbarCaption('');
}
function updateNativeAvailability(){
  const available=state?.native?.available===true;
  const shared=sharedSurface();
  syncRoomTopic();
  $('#talk').disabled=inside&&!shared;
  $('#tool-mic').hidden=$('#tool-speaker').hidden=!shared;
  $('#conversation-panel').classList.toggle('shared-conversation',shared);
  $('#conversation-form').hidden=shared;$('#conversation-log').hidden=shared;
  $('#shared-conversation').hidden=!shared;
  const historyLabel=inside?null:worldHistory?.conversationLabel();$('#history-reference-clear').hidden=!historyLabel;
  const worktableLabel=inside&&shared?worktableTopic?.label:null;
  $('#worktable-reference-clear').hidden=!worktableLabel;
  const hint=$('#conversation-hint'),historyHint=historyLabel?`Tema de la próxima intervención: ${historyLabel}.`:'';
  hint.hidden=shared&&!historyLabel&&!worktableLabel;
  if(shared){hint.textContent=worktableLabel?'Mesa de trabajo · '+worktableLabel:historyHint;return;}
  hint.textContent=(historyHint?historyHint+' ':'')+((available||nativeTurn)?'Podés seguir recorriendo el mundo mientras transcurre mi turno.':'La conversación todavía no está conectada a este mundo.');
  $('#send').disabled=!available||!!nativeTurn||preparingConversation;
  if(preparingConversation){$('#companion-status').textContent='Conservando el punto que estamos mirando…';return;}
  if(!nativeTurn)$('#companion-status').textContent='';
}
async function refresh(){
  if(inside)return;
  const request=++stateRequest,continuityVersion=worldAudio.continuityVersion;
  let incoming;
  try{incoming=await api('state');}catch(error){
    if(request!==stateRequest)return;
    worldAudio.breakContinuity();
    if([401,403].includes(error.httpStatus))worldHistory.observe(null);
    throw error;
  }
  if(!snapshotMayApply(state,incoming,request,stateRequest))return;
  const closingExercise=state?.lightExercise===true&&incoming.lightExercise!==true;
  state=incoming;
  if(closingExercise){
    if(lastChange?.type!=='bridge.set')lastChange=null;
    closePreview();
    if(signalEditor.active&&!signalEditor.draft.mode&&!signalEditor.draft.pendingId)signalEditor.close();
  }
  revalidateLightPreview();contentVisitor.syncNodes(state.nodes);playableHUD.sync(state.nodes,state.actorRef,state.canEdit===true);
  if(activeSpace?.id==='outside'&&Array.isArray(state.entrances)&&
    JSON.stringify(activeSpace.entrances)!==JSON.stringify(state.entrances)){
    activeSpace={...activeSpace,entrances:state.entrances};resetDoor();
  }
  $('#garden-create').hidden=state.lightExercise!==true||state.canEdit!==true;
  worldAudio.observe(state,{continuityVersion});worldHistory.observe(state);
  const count=client.getCharacterStates().size;
  $('#people').textContent=count>1?`${count} exploradores en el taller`:'Un lugar para crear juntos';
  const compact=window.matchMedia('(max-width:740px)').matches;
  const bridge=outsideRing()?null:state.entities.bridge;
  if(!bridge&&activeSpace?.title)$('#hud h1').textContent=activeSpace.title;
  $('#bridge').hidden=!bridge;
  $('#plant').hidden=state.lightExercise!==true||!bridge;
  $('#undo').hidden=!bridge;
  if(bridge)$('#bridge').textContent=bridge.raised?(compact?'Separar':'Separar islas'):(compact?'Unir islas':'Conectar islas');
  if(bridge)$('#bridge').setAttribute('aria-label',bridge.raised?'Separar las islas':'Conectar las islas');
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
    lastChange=undo||state?.lightExercise!==true&&pending.type!=='bridge.set'?null:{type:pending.type,target:pending.target,previous:pendingMetadata?.previous,
      appliedRevision:pending.type==='garden.place'?1:pending.expectedRevision+1,run:pending.run,edition:pending.edition};
    say(undo?'Tu cambio quedó deshecho.':'El cambio ya forma parte del mundo.',{transient:true});
  }else if(result.reason==='The light-planting exercise has ended')say('El ejercicio de luces terminó.');
  else say('Ese lugar cambió. Mirá cómo quedó antes de intentarlo de nuevo.');
  const id=pending.id;
  pending=null;pendingMetadata=null;sessionStorage.removeItem(pendingKey);clearRecovery('command');
  if(preview?.submission===id){
    preview.submission=null;
    if(result.status==='completed')closePreview({settled:true});
    else revalidateLightPreview();
  }
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
  if(!state||lightPreviewBusy()||!revalidateLightPreview())return false;
  const position=client.getLocalCharacterState()?.position;
  if(!position){say('Esperá a entrar al taller para crear una luz.');return false;}
  const at=nearestCreationPosition(position.x+1,position.z);
  preview={run:state.run,edition:state.edition,...preview,...at,color:preview?.color||'mint'};
  previewDocument();return true;
}
function lightPreviewBusy(){
  return Boolean(preview&&(preview.submitting||preview.submission&&preview.submission===pending?.id));
}
function syncLightActions(){
  const locked=lightPreviewBusy();
  const panel=$('#creator');
  panel.toggleAttribute('data-light-pending',locked);
  for(const button of panel.querySelectorAll('button'))button.disabled=locked;
}
function currentLight(record){
  const entity=state?.entities?.[record.target];
  return entity&&!entity.deleted&&entity.revision===record.revision&&
    state.run===record.run&&state.edition===record.edition?entity:null;
}
function revalidateLightPreview(){
  if(preview&&!lightPreviewBusy()&&
      (preview.run!==state?.run||preview.edition!==state?.edition||
      preview.selection&&!currentLight(preview.selection))){
    closePreview({settled:true});
    say('La luz cambió. Volvé a elegirla.');
    return false;
  }
  syncLightActions();
  return true;
}
function closePreview({settled=false}={}){
  if(!preview||!settled&&lightPreviewBusy())return false;
  const old=preview.blob;preview=null;
  client.updateConfig({mmlDocuments:worldDocuments});
  if(old)URL.revokeObjectURL(old);
  $('#creator').hidden=true;
  syncLightActions();
  return true;
}
function showPreview(){
  const editing=!!preview?.target;
  $('#creator-title').textContent=editing?'Editar esta luz':'Una luz para este lugar';
  $('#creator').setAttribute('aria-label',editing?'Editar una luz':'Crear una luz');
  $('#preview-hint').textContent=editing?'La vista previa es tuya. Guardar cambia esta misma luz para todos.':'La vista previa es tuya. Al plantar, aparece para todos.';
  $('#preview-accept').textContent=editing?'Guardar cambios':'Plantar';
  for(const choice of document.querySelectorAll('[data-color]'))choice.setAttribute('aria-pressed',String(choice.dataset.color===preview.color));
  worldNotice.clear();$('#creator').hidden=false;syncLightActions();
}
function editLight(record){
  if(state?.lightExercise!==true)return;
  if(signalEditor.active){say('Guardá o descartá el jardín antes de editar una luz.');return;}
  if(pending||preparingAction||lightPreviewBusy()){say('Primero tengo que confirmar el cambio anterior.');return;}
  const entity=currentLight(record);
  if(!entity){say('La luz cambió. Volvé a elegirla.');return;}
  closePreview();preview={run:record.run,edition:record.edition,target:record.target,
    expectedRevision:record.revision,selection:record,x:entity.x,z:entity.z,color:entity.color};
  previewDocument();showPreview();say('Podés mover esta luz o cambiar su color. Todavía no cambió para los demás.');
}
$('#bridge').onclick=()=>state&&action('bridge.set','bridge',{raised:!state.entities.bridge.raised},state.entities.bridge.revision);
$('#plant').onclick=()=>{if(state?.lightExercise!==true||lightPreviewBusy()||pending||preparingAction)return;if(signalEditor.active){say('Guardá o descartá el jardín antes de crear una luz.');return;}closePreview();if(movePreview()){showPreview();say('Elegí dónde dejar esta luz. Todavía la ves solamente vos.');}};
let signalPreview=null,signalMarkup=null;
const indoorSaveKey='holodeck:indoor-design:'+base.pathname;
let indoorReading=false;
const editorRoom=()=>inside&&(activeSpace.playableInterior===true||activeSpace.gardenReceiptRecovery===true)?
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
      signalEditor.open(source.garden,{...scope,templates:source.templates,contains:indoorGardenContains,validRecipe:validIndoorGardenRecipe,radius:.45});
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
  allowed:(node,mode)=>mode?sameDesign(mode,designScope())&&!moving:!inside&&!preview&&state?.lightExercise===true&&state.canEdit===true&&
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
$('#garden-create').onclick=()=>{if(!preview&&!signalEditor.active)signalEditor.open();};
$('#play-edit').onclick=()=>{const node=state?.nodes?.[playableHUD.selected];if(node?.play&&!preview&&!signalEditor.active)signalEditor.open(node);};
$('#preview-move').onclick=movePreview;
$('#preview-cancel').onclick=()=>{if(closePreview())say('La vista previa quedó descartada.',{transient:true});};
$('#preview-accept').onclick=async()=>{
  if(!preview||lightPreviewBusy()||!revalidateLightPreview())return;
  const submittedPreview=preview,args={x:preview.x,z:preview.z,color:preview.color};
  submittedPreview.submitting=true;
  syncLightActions();
  try{
    await action(preview.target?'garden.update':'garden.place',preview.target||`garden-${crypto.randomUUID()}`,
      args,preview.expectedRevision??null,{selection:preview.selection??null,
        onPending:id=>{submittedPreview.submission=id;}});
  }finally{
    submittedPreview.submitting=false;
    if(preview===submittedPreview)revalidateLightPreview();
  }
};
for(const button of document.querySelectorAll('[data-color]'))button.onclick=()=>{
  if(!preview||lightPreviewBusy()||!revalidateLightPreview())return;preview.color=button.dataset.color;
  for(const choice of document.querySelectorAll('[data-color]'))choice.setAttribute('aria-pressed',String(choice===button));
  previewDocument();
};
$('#undo').onclick=async()=>{
  if(!lastChange||!state||state.lightExercise!==true&&lastChange.type!=='bridge.set')return;
  const change=lastChange,entity=state.entities[change.target];
  if(!entity||state.run!==change.run||state.edition!==change.edition||entity.revision!==change.appliedRevision){lastChange=null;$('#undo').disabled=true;say('Este lugar volvió a cambiar. No voy a deshacer el trabajo de otra persona.');return;}
  if(preview?.target===change.target){if(!closePreview())return;}
  if(change.type==='bridge.set')await action('bridge.set','bridge',{raised:change.previous.raised},entity.revision,{undo:true});
  else if(change.type==='garden.place')await action('garden.remove',change.target,{},entity.revision,{undo:true});
  else if(change.type==='garden.update'&&change.previous)await action('garden.update',change.target,{x:change.previous.x,z:change.previous.z,color:change.previous.color},entity.revision,{undo:true});
};
function ensureSharedConversation(){
  sharedConversation??=new SharedConversationHost({window,document,container:$('#shared-conversation'),api,
    capture:captureInteractionContext,captureRender:captureConversationView,currentActor:()=>activeSpace?.actorRef??state?.actorRef,
    avatarMicrophone:true,onVoiceControls:projectVoiceControls,onDismiss:()=>{if(!$('#conversation-panel').hidden)openConversation(false);},
    onSpeechLevel:level=>companionAvatar?.setSpeechLevel(level),
    onStatus:({phase,busy})=>{$('#companion-status').textContent=phases[phase]||(busy?'La conversación está procesando tu intervención.':'Tu intervención quedó en la conversación.');},onError:say});
  return sharedConversation;
}
function openConversation(open){
  const panel=$('#conversation-panel'),talk=$('#talk');
  const wasHidden=panel.hidden;
  const focused=document.activeElement;
  const restoreFocus=!open&&panel.contains(focused);
  // Character Studio captures its selected pose before the panel takes focus.
  if(open&&wasHidden&&inside&&activeSpace.id===CHARACTER_STUDIO&&matterHud?.active)
    conversationCharacterPose=matterHud.table?.currentPose?.()??null;
  if(!open)conversationCharacterPose=null;
  if(!open&&!panel.hidden){
    const target=matterHud?.toolBounds('talk')??talk.getBoundingClientRect();
    if(target.width&&target.height)conversationDisplay?.minimize(target);
  }
  if(restoreFocus)focused.blur();
  panel.hidden=!open;
  if(wasHidden===open)resetFlightTap();
  talk.setAttribute('aria-expanded',String(open));
  if(open){
    $('#space-travel').open=false;
    updateNativeAvailability();
    fitConversationWindow(true);
    if(wasHidden)conversationDisplay?.restore(matterHud?.toolBounds('talk'));
  }
  if(open&&sharedSurface()){
    ensureSharedConversation().mount().catch(()=>say('No pude abrir tu conversación. Volvé a tocar Conversar para intentarlo.'));
  }else if(open&&!flightEnabled)$('#message').focus();
  let didFocusWorld=false;
  if(flightEnabled&&(open&&wasHidden||restoreFocus)){
    const canvas=client.getRenderer()?.composer.renderer.domElement;
    if(canvas){canvas.tabIndex=-1;canvas.focus({preventScroll:true});didFocusWorld=document.activeElement===canvas;}
  }
  if(!open)fitConversationWindow(true);
  if(restoreFocus&&!didFocusWorld&&!matterHud?.focusTool('talk'))talk.focus({preventScroll:true});
}
fitConversationWindow=bindHudPanelWindow($('#conversation-panel'),{
  resize:$('#conversation-resize'),
  canMove:event=>sharedSurface()||!$('#conversation-panel').hasAttribute('data-hud-chrome')||!!event.target.closest?.('#conversation-move'),
  readInsets:()=>matterHud?.conversationTravelInsets()??{},
});
$('#talk').onclick=()=>openConversation($('#conversation-panel').hidden);
const mapPanel=$('#space-travel'),mapTool=$('#map-tool');
mapTool.onclick=()=>{
  if(!$('#conversation-panel').hidden)openConversation(false);
  if(!mapPanel.hidden)mapPanel.open=!mapPanel.open;
};
mapPanel.addEventListener('toggle',()=>mapTool.setAttribute('aria-expanded',String(mapPanel.open)));

async function captureConversationView(){
  const actor=activeSpace?.actorRef??state?.actorRef,room=activeSpace?.id,run=state?.run;
  if(!actor||moving||entering||document.hidden||contentVisitor.frame&&!contentVisitor.panel.classList.contains('is-walking'))
    return null;
  const frame=await worldView.request();
  if(!frame||document.hidden||moving||entering||actor!==(activeSpace?.actorRef??state?.actorRef)||
    room!==activeSpace?.id||run!==state?.run)return null;
  return frame;
}
$('#tool-mic').onclick=async()=>{
  if(!sharedSurface()||moving||entering)return;
  const button=$('#tool-mic');
  button.disabled=true;
  try{
    if(inside&&activeSpace.id===CHARACTER_STUDIO&&matterHud?.active)
      conversationCharacterPose=matterHud.table?.currentPose?.()??null;
    if(button.getAttribute('aria-pressed')!=='true')showToolbarCaption('Abriendo el micrófono…');
    await ensureSharedConversation().pressToolbarMic();
  }catch(error){showToolbarCaption('');say(error.message,{transient:true});}
  finally{button.disabled=false;}
};
$('#tool-speaker').onclick=()=>sharedConversation?.toggleToolbarSpeaker();
$('#conversation-close').onclick=()=>openConversation(false);
$('#worktable-reference-clear').onclick=()=>{worktableTopic=undefined;updateNativeAvailability();};
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
    const characterPose=capturedSpace===CHARACTER_STUDIO?conversationCharacterPose:null;
    return structuredClone({capturedAt:Date.now(),spaceId:capturedSpace,local:position?{position}:null,
      ...(subject?{roomObject:{id:subject.id,revision:subject.revision}}:{}),
      ...(visit?{roomVisit:visit}:{}),...(worktableTopic?{worktable:worktableTopic.reference}:{}),
      ...(characterPose?{characterPose}:{})});
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
// Close Conversation before world controls or focused HUD widgets consume Escape.
window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.isComposing||$('#conversation-panel').hidden)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!event.repeat)openConversation(false);
},true);
window.addEventListener('keydown',event=>{if(event.key==='Escape'){if(preview)closePreview();signalEditor.close();}});
let refreshing=false,workshopWarningDismissed=false;
const workshopWarning=$('#workshop-connection'),workshopRetry=$('#workshop-retry');
async function refreshWorkshop(){
  if(closed||inside||document.hidden||refreshing)return;
  refreshing=true;
  workshopRetry.disabled=true;
  try{
    await refresh();
    workshopWarning.hidden=true;
    workshopWarningDismissed=false;
  }catch{
    if(!workshopWarningDismissed)workshopWarning.hidden=false;
  }finally{
    refreshing=false;
    workshopRetry.disabled=false;
  }
}
workshopRetry.onclick=refreshWorkshop;
$('#workshop-dismiss').onclick=()=>{
  workshopWarning.hidden=true;
  workshopWarningDismissed=true;
};
const interval=setInterval(refreshWorkshop,1500);
window.addEventListener('pagehide',()=>{closed=true;clearInterval(interval);sharedConversation?.dispose();pendingBook.dispose();beaconControls.clear();garden.dispose();contentVisitor.dispose();worldHistory.dispose();if(preview?.blob)URL.revokeObjectURL(preview.blob);if(signalPreview)URL.revokeObjectURL(signalPreview);worldAudio.dispose();client.dispose();});
void refreshWorkshop();
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
