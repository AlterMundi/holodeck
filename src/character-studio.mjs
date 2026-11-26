import {characterReviewCamera} from './character-review-camera.mjs';
import {
  ACESFilmicToneMapping,AnimationMixer,Box3,Color,CylinderGeometry,DirectionalLight,
  Fog,GridHelper,Group,HemisphereLight,LoopOnce,Mesh,MeshBasicMaterial,MeshStandardMaterial,OrthographicCamera,PlaneGeometry,
  PerspectiveCamera,Raycaster,Scene,Vector2,Vector3,WebGLRenderer,
} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ModelLoader} from '@mml-io/model-loader';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';
import {rigs} from './character-studio-rigs.mjs';
import {createHumanMotionStudy,humanMotionStudies,motionStudyRate} from './human-motion-study.mjs';
import {ATELIER_FOYER,CHARACTER_STUDIO} from './house-review-rooms.mjs';
import {arrivalDoor,doorLocation,readSpace} from './space-travel.mjs';

const names={
  idle:'Reposo',jog:'Trote',air:'En el aire',calm:'Reposo',curious:'Curiosidad',joy:'Alegría',
  sad:'Tristeza',anger:'Enojo',uncertain:'Duda',focus:'Concentración',welcome:'Saludo',
  sleep:'Dormir',walk:'Marcha · clip original',run:'Carrera · clip original',
  hover:'Vuelo en el lugar',glide:'Planeo',lift:'Despegue',landing:'Aterrizaje',
  bound:'Zancada larga · clip original',wade:'Vadear',tread:'Flotar',swim:'Nado',
  brace:'Frenada',scan:'Mirar alrededor',sway:'Balanceo',tinker:'Explorar',chirp:'Exclamación',
  ...Object.fromEntries(Object.entries(humanMotionStudies).map(([id,study])=>[id,study.label])),
};
const cycleControlNames={
  walk:'Marcha original',run:'Carrera original',bound:'Zancada original',
  'estudio-vuelo':'Vuelo y aterrizaje','estudio-aceleracion':'Vuelo rápido',
  'estudio-nado':'Nado e inmersión','estudio-marcha':'Marcha y frenada',
};
const surfaceId='character-studio';
const noteLabel='Nota para este fotograma';
const speedOptions=[{id:'0.25',label:'¼×'},{id:'0.5',label:'½×'},{id:'1',label:'1×'},{id:'2',label:'2×'}];
const transport=new Set(['back','play','forward','loop','compare']);
export const characterControlRole=(_,id)=>id==='play'?'primary':transport.has(id)?'navigation':'utility';
const compactReview=(width,height)=>width<720||height<570;
const choices=items=>Object.entries(items).map(([id,label])=>({id,label}));
const path=key=>({'@path':'/'+key});
const action=(name,key)=>({event:{name,...(key?{context:{value:path('draft/'+key)}}:{})}});
const label=(id,text,style='body')=>({id,component:'HudText',label:text,style});
const row=(id,children)=>({id,component:'HudRow',children});
const button=(id,text,key)=>({id,component:'HudButton',label:text,action:action(id,key)});
const poseButton=(id,text)=>({...button(id,text),gestureKey:path('poseKey'),
  action:{event:{name:id,context:{pose:path('pose')}}}});
const choice=(id,name)=>({id,component:'HudChoice',label:name,options:path(id+'Options'),
  value:path(id),draft:path('draft/'+id),action:action(id,id)});
const sectionControls={
  Pose:['clock','heldPose','chapter','playback'],
  Clips:['rig','clip','playOptions'],
  Comparar:['comparison'],
  Vista:['views'],
  Notas:['presentation','accessStatus','checkReviewAccess','noteTarget','note','archive','reviewNotes','reviewText'],
};
const sectionIds=Object.keys(sectionControls);
const sectionWeights={Pose:.86,Clips:.93,Comparar:1.65,Vista:.90,Notas:1.10};
const widePanelWidth=2.60;
const inlineFields={rig:['Personaje',2],speed:['Velocidad',4],clip:['Ciclo',2],chapter:['Fase',2],reference:['Clip B',2]};
const maxInlineOptions=8;
const inlineIds=field=>Array.from({length:maxInlineOptions},(_,index)=>field+'Option'+index);
function inlineControls(field,title,columns){
  const ids=inlineIds(field);
  const rows=Array.from({length:Math.ceil(ids.length/columns)},(_,index)=>({...row(field+'Row'+index,
    ids.slice(index*columns,(index+1)*columns)),visible:path('inline/'+field+'/items/'+(index*columns)+'/visible')}));
  return [
    {id:field+'Inline',component:'HudColumn',visible:path('inline/'+field+'/visible'),children:[field+'Caption',...rows.map(entry=>entry.id)]},
    label(field+'Caption',title,'status'),...rows,
    ...ids.map((id,index)=>{
      const key='inline/'+field+'/items/'+index;
      return {...button(id,path(key+'/label')),visible:path(key+'/visible'),pressed:path(key+'/selected'),
        gestureKey:path(key+'/gestureKey'),
        action:{event:{name:field,context:{value:path(key+'/id'),...(field==='chapter'?{clipEdition:path('clipEdition')}:{})}}}};
    }),
  ];
}
const compactControls=new Set(sectionIds.flatMap(id=>sectionControls[id]));
const controls=[
  {id:'root',component:'HudPanel',label:'Revisión de movimiento',width:widePanelWidth,gap:.025,
    children:['sections','title','rig','rigInline','clip','clipInline','clock','heldPose','chapter','chapterInline','playback','speedInline','playOptions','referenceInline','comparison','views','presentation','accessStatus','checkReviewAccess','noteTarget','note','archive','reviewNotes','reviewText','status']},
  {...row('sections',sectionIds),gap:.025,visible:path('compact')},
  ...sectionIds.map(id=>({...button(id,id),pressed:path('selectedSection/'+id),weight:sectionWeights[id]})),
  label('title','Revisión de movimiento','title'),choice('rig','Personaje'),choice('clip','Ciclo'),
  {id:'clock',component:'HudRange',label:'Fotograma',min:0,max:path('lastFrame'),step:1,value:path('frame'),
    disabled:path('timelineDisabled'),draft:path('draft/frame'),gestureKey:path('clipEdition'),markers:path('chapterFrames'),
    action:{event:{name:'clock',context:{value:path('draft/frame'),clipEdition:path('clipEdition')}}}},
  label('heldPose',path('heldPose'),'status'),
  {...choice('chapter','Fase'),
    action:{event:{name:'chapter',context:{value:path('draft/chapter'),clipEdition:path('clipEdition')}}}},
  row('playback',['back','play','forward']),
  {...button('back','−1'),icon:'previousFrame'},
  {...button('play',path('playLabel')),icon:path('playIcon'),weight:2},
  {...button('forward','+1'),icon:'nextFrame'},
  row('playOptions',['speed','loop']),{...choice('speed','Velocidad'),visible:path('choiceMenus/speed')},
  {...button('loop','Bucle'),icon:'loop',pressed:path('loop')},
  row('comparison',['reference','compare']),
  {...choice('reference','Clip B'),visible:path('choiceMenus/reference'),weight:2},
  {...button('compare',path('compareLabel')),icon:'compare',pressed:path('showingReference'),
    disabled:path('noReference')},
  row('views',['front','angle','side']),button('front','Frente'),{...button('angle','Tres cuartos'),weight:1.45},button('side','Perfil'),
  row('presentation',['present','follow']),
  {...poseButton('present','Mostrar pose'),disabled:path('presentationBusy')},
  {...button('follow','Ver pose del Taller'),disabled:path('presentationBusy')},
  {...label('accessStatus',path('accessStatus'),'status'),lines:2},
  button('checkReviewAccess','Comprobar acceso'),
  {...label('noteTarget',path('noteTarget'),'status'),lines:2},
  {id:'note',component:'HudTextInput',label:noteLabel,value:path('note'),disabled:path('savingNote'),
    draft:path('draft/note'),placeholder:'Qué ves en la pose',maxLength:300,action:action('pin','note')},
  row('archive',['pin','retryNote','copy','review']),
  {...button('pin',path('noteAction'),'note'),submitFor:'note',disabled:path('savingNote'),visible:path('canSubmitNote'),weight:1.06},
  {...button('retryNote','Reintentar'),visible:path('canRetryNote'),weight:1.06},
  {...poseButton('copy',path('copyLabel')),weight:1.23},
  {...button('review',path('reviewAction')),visible:path('canReview'),disabled:path('presentationBusy')},
  choice('reviewNotes','Notas de esta pose'),
  {...label('reviewText',path('reviewText')),lines:3},
  {...label('status',path('status'),'status'),lines:2},
  ...Object.entries(inlineFields).flatMap(([field,[title,columns]])=>inlineControls(field,title,columns)),
].map(control=>{
  if(!compactControls.has(control.id)&&!['title','status'].includes(control.id))return control;
  return {...control,visible:path('show/'+control.id)};
});
const studioStyle=`
.character-studio{position:fixed;inset:0;background:#07121a;color:#f4f4e9}
.character-studio canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
.character-studio header{position:absolute;top:max(22px,env(safe-area-inset-top));left:clamp(18px,4vw,54px);
  right:clamp(18px,4vw,54px);display:flex;justify-content:space-between;align-items:center;gap:12px;pointer-events:none}
.character-studio header nav{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:2px 16px}
.character-studio h1{font:500 clamp(19px,4.8vw,34px)/1.1 Georgia,serif;margin:0;color:#f5eccd}
.character-studio nav :is(a,button){pointer-events:auto;color:#c5e9e3;text-decoration:none;border-bottom:1px solid #82b7ad;padding:8px 0}
.character-studio nav :is(a,button):focus-visible{outline:2px solid #f2d393}
.character-studio output{position:absolute;bottom:20px;left:clamp(18px,4vw,54px);font-size:12px;color:#c4dddb;pointer-events:none}
.character-studio .studio-a11y{position:absolute;inset:0;pointer-events:none}
.character-studio.studio-compact header{top:max(12px,env(safe-area-inset-top))}
.character-studio.studio-compact header nav{gap:8px;flex-wrap:nowrap;white-space:nowrap;font-size:12px}
.character-studio.studio-compact output{top:max(60px,calc(env(safe-area-inset-top) + 48px));bottom:auto;
  right:18px;font-size:14px}
`;

function buildStage(document){
  const wrapper=document.createElement('main');
  wrapper.className='character-studio';
  wrapper.innerHTML='<header><h1>Taller de personajes</h1><nav aria-label="Taller"><a href="./" data-studio-room hidden>Abrir sala 3D</a><a href="./" data-studio-return>Volver al mundo</a></nav></header><output aria-live="polite"></output><div class="studio-a11y"></div>';
  const style=document.createElement('style');
  style.textContent=studioStyle;
  wrapper.prepend(style);
  document.body.replaceChildren(wrapper);
  return wrapper;
}

function bindStudioNavigation(wrapper,space){
  const back=wrapper.querySelector('[data-studio-return]'),studio=wrapper.querySelector('[data-studio-room]');
  for(const link of [back,studio]){
    link.onclick=null;
    link.removeAttribute('aria-disabled');
  }
  back.textContent='Volver al mundo';
  studio.textContent='Abrir sala 3D';
  studio.hidden=space?.id!==CHARACTER_STUDIO;
  const available=to=>space?.exits?.some(exit=>exit.to===to);
  let pending=false;
  const bindPassage=(link,to,label)=>{
    link.textContent=label;
    link.hidden=false;
    link.onclick=async event=>{
      event.preventDefault();
      if(pending)return;
      pending=true;
      link.setAttribute('aria-disabled','true');
      const destination=new URL(link.href);
      const move={from:space.id,to};
      let next;
      try{
        const result=await fetch(new URL('api/space',destination),{
          method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
          body:JSON.stringify(move),signal:AbortSignal.timeout(8000),
        });
        if(result.ok)next=await result.json();
      }catch{}
      if(!next){
        try{next=await readSpace(AbortSignal.timeout(5000));}catch{}
      }
      if(next?.id===to){
        const arrival=arrivalDoor(space,next);
        if(arrival)destination.hash=doorLocation(arrival);
        location.replace(destination);
        return;
      }
      wrapper.querySelector('output').textContent='No pude abrir la puerta. Volvé a intentar.';
      link.removeAttribute('aria-disabled');
      pending=false;
    };
  };
  if(space?.id===CHARACTER_STUDIO&&available(ATELIER_FOYER))bindPassage(back,ATELIER_FOYER,'Volver al vestíbulo');
  if(space?.id===ATELIER_FOYER&&available(CHARACTER_STUDIO))bindPassage(studio,CHARACTER_STUDIO,'Entrar al taller');
}

function offerStudioRetry(stage){
  if(stage.querySelector('[data-studio-retry]'))return;
  const retry=stage.ownerDocument.createElement('button');
  retry.type='button';
  retry.textContent='Reintentar';
  retry.dataset.studioRetry='';
  retry.onclick=()=>stage.ownerDocument.location.reload();
  stage.querySelector('nav').prepend(retry);
  if(stage.ownerDocument.activeElement===stage.ownerDocument.body)retry.focus({preventScroll:true});
}

function showUnavailableStudio(document){
  const stage=buildStage(document);
  const message=stage.querySelector('output');
  message.textContent='No se pudo iniciar la vista 3D.';
  offerStudioRetry(stage);
  void readSpace(AbortSignal.timeout(5000)).then(space=>bindStudioNavigation(stage,space)).catch(()=>{});
  return null;
}

function disposeFigure(figure){
  if(!figure)return;
  figure.root.removeFromParent();
  figure.mixer?.stopAllAction();
  figure.mixer?.uncacheRoot(figure.mixer.getRoot());
  const resources=new Set();
  figure.root.traverse(object=>{
    if(!object.isMesh)return;
    resources.add(object.geometry);
    for(const material of [object.material].flat()){
      resources.add(material);
      for(const item of Object.values(material))if(item?.isTexture)resources.add(item);
    }
    if(object.isSkinnedMesh)resources.add(object.skeleton);
  });
  for(const item of resources)item?.dispose?.();
}

function normalise(root,heightTarget=characterReviewCamera.rigHeight){
  root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(root,true);
  const centre=bounds.getCenter(new Vector3());
  const height=bounds.max.y-bounds.min.y;
  if(!(height>.01))throw Error('Could not frame the rig');
  const scale=heightTarget/height;
  root.scale.multiplyScalar(scale);
  root.position.set(-centre.x*scale,-bounds.min.y*scale,-centre.z*scale);
}

function studioLights(scene){
  const base=new Mesh(new CylinderGeometry(1,1.12,.14,76),new MeshStandardMaterial({
    color:0x17313c,metalness:.42,roughness:.38,
  }));
  base.position.y=-.075;
  scene.add(base);
  const grid=new GridHelper(28,56,0x6b8d8b,0x213943);
  grid.position.y=-.145;
  scene.add(grid,new HemisphereLight(0xc9efff,0x524239,2.1));
  for(const [color,intensity,position] of [[0xffedbe,3.1,[3,4,3]],[0x6debe6,2.4,[-2,3,-3]],[0xa0bae1,.8,[-3,1,1]]]){
    const light=new DirectionalLight(color,intensity);
    light.position.fromArray(position);
    scene.add(light);
  }
}

export function openCharacterStudio(document,table=null){
  const url=new URL(document.location.href),window=document.defaultView;
  let renderer;
  if(!table){
    try{renderer=new WebGLRenderer({antialias:true});}
    catch{return showUnavailableStudio(document);}
  }
  const scene=table?new Group():new Scene();
  if(table){
    scene.position.copy(table.origin);
    table.scene.add(scene);
  }
  const waterline=new Mesh(new PlaneGeometry(3.5,3.5),new MeshBasicMaterial({
    color:0x3999b0,transparent:true,opacity:.20,depthWrite:false,
  }));
  waterline.rotation.x=-Math.PI/2;
  if(table)waterline.scale.setScalar(table.height/1.48);
  waterline.visible=false;
  scene.add(waterline);
  const loader=new ModelLoader(),inputs=new AbortController();
  const {front,angle,side}=characterReviewCamera;
  const viewAngles={front,angle,side};
  let view=Object.hasOwn(viewAngles,url.searchParams.get('vista'))?url.searchParams.get('vista'):'angle';
  let figure,playback,rig,clip,frame=0,playing=false,revision='',note='',message='',showedAt=-Infinity;
  let sequence=0,readySequence=-1,elapsed=0,previous=0,visible=true,loop=true,speed='1';
  let loadingInitialRig=false,rigRetryAvailable=false;
  let compact=Boolean(table),section='Pose',panelWidth=table?2.20:widePanelWidth,layoutHeight=0;
  let primary=null,reference=null,showingReference=false,referenceRequest=0,followedPose;
  let canReview=null,checkingAccess=false,review=null,selectedNote='',readingReview=false,savingNote=false,pendingNote,draftPose,noteReplaced=false,presentationBusy=false;
  const projected=table?null:webStudioProjection(document,renderer,scene,dispatch,dispose,()=>{
    playing=false;
    previous=0;
    refresh();
  });
  const ownsNoteInput=target=>target?.getAttribute?.('aria-label')===noteLabel&&
    (table??projected).ownsTextInput(target);
  document.addEventListener('focusin',event=>{
    if(!playback||!ownsNoteInput(event.target)||!playing)return;
    playing=false;
    scrub(frame);
    refresh();
  },{signal:inputs.signal});
  document.addEventListener('input',event=>{
    if(!playback||!ownsNoteInput(event.target))return;
    const text=event.target.value.trim();
    if(text)draftPose??=reviewPose();
    else draftPose=undefined;
    noteReplaced=Boolean(pendingNote&&(text!==pendingNote.submission.text||
      !draftPose||keyForPose(draftPose)!==pendingNote.key));
    refresh();
  },{signal:inputs.signal});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||event.keyCode===229||
      !ownsNoteInput(event.target))return;
    draftPose=pendingNote?.submission.pose;
    noteReplaced=false;
    refresh();
  },{capture:true,signal:inputs.signal});
  function dispatch(requested){
    if(!visible)return;
    void activate(requested?.name,requested?.context).catch(()=>report('No se pudo aplicar el cambio.'));
  }
  const receive=(type,value)=>{
    if(visible)(table??projected).send(type,value);
  };
  const root=controls[0];
  const tableControls=table?[{...root,label:'Mesa de Char Design',width:panelWidth,
    children:['tableHeading',...root.children.filter(id=>id!=='title')]},
    ...controls.slice(1).map(control=>control.id==='title'?{...label('title','Revisión de movimiento','title'),weight:1.65}:control),
    row('tableHeading',['title','close']),button('close','Salir de la mesa')]:null;
  const loadingPanel=()=>({...tableControls[0],children:['tableHeading','status','retryRig']});
  if(table){
    receive('updateComponents',{components:[
      loadingPanel(),
      ...tableControls.filter(component=>['tableHeading','title','close'].includes(component.id)),
      {...label('status',path('status'),'status'),lines:2},
      {...button('retryRig','Reintentar personaje'),visible:path('rigRetryAvailable'),disabled:path('loadingInitialRig')},
    ]});
  }else{
    receive('createSurface',{catalogId:spatialHudCatalog.id});
    receive('updateComponents',{components:controls});
  }
  async function checkReviewAccess(){
    if(checkingAccess||canReview===true)return;
    checkingAccess=true;
    refresh();
    try{
      const space=await readSpace(AbortSignal.any([inputs.signal,AbortSignal.timeout(5000)]));
      if(!visible)return;
      if(typeof space?.id!=='string'||!space.id)throw Error('Missing room');
      canReview=space.id===CHARACTER_STUDIO;
      if(projected)bindStudioNavigation(projected.stage,space);
    }catch{
      canReview=null;
    }finally{
      checkingAccess=false;
      refresh();
    }
  }
  const canSaveLocal=()=>canReview===false&&!table;
  void checkReviewAccess();
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  function setView(next){
    view=next;
    (table??projected).setAngle(viewAngles[view]);
  }
  projected?.setAngle(viewAngles[view]);

  const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');

  async function readAsset(file){
    const source=new URL(file,url);
    const response=await fetch(source,{signal:AbortSignal.any([inputs.signal,AbortSignal.timeout(12000)])});
    if(!response.ok)throw Error('Missing rig or clip');
    const bytes=await response.arrayBuffer();
    const hash=new Uint8Array(await window.crypto.subtle.digest('SHA-256',bytes));
    const digest=hex(hash);
    return {model:await loader.loadFromBuffer(bytes,new URL('.',source).href),digest};
  }

  const clipOptions=(profile,figure)=>profile.clips
    ?[...Object.keys(profile.clips),...Object.keys(humanMotionStudies)]:Array.from(figure.clips.keys());

  function targetClip(model,next,figure){
    const clip=model.animations[0]?.clone();
    if(!clip)return null;
    clip.name=next;
    clip.tracks=clip.tracks.filter(track=>figure.model.getObjectByName(track.name.split('.')[0]));
    return clip;
  }

  async function stockClip(profile,next,figure){
    const {model,digest}=await readAsset(profile.clips[next]);
    const selected=targetClip(model,next,figure);
    disposeFigure({root:model.group});
    return {selected,digest};
  }

  async function loadRig(next,requestedClip,requestedFrame=0,expected=null){
    const id=++sequence;
    const profile=rigs[next];
    if(!profile)return;
    playing=false;
    ++referenceRequest;
    report('Abriendo el personaje…');
    let asset;
    try{asset=await readAsset(profile.file);}
    catch(error){
      if(id===sequence&&playback){readySequence=id;refresh();}
      throw error;
    }
    const {model,digest}=asset;
    const root=new Group(),orientation=new Group();
    root.add(orientation);
    orientation.add(model.group);
    normalise(root,table?.height);
    const nextFigure={root,orientation,model:model.group,rigDigest:digest,
      mixer:new AnimationMixer(model.group),clips:new Map(model.animations.map(item=>[item.name,item]))};
    if(id!==sequence){disposeFigure(nextFigure);return;}
    playback?.stop();
    disposeFigure(figure);
    figure=nextFigure;
    playback=primary=reference=null;
    showingReference=false;
    waterline.visible=false;
    rig=next;
    scene.add(root);
    const options=clipOptions(profile,figure);
    const initialClip=options.includes(requestedClip)?requestedClip:profile.clips?'estudio-vuelo':options[0];
    await loadClip(initialClip,requestedFrame,expected,id);
  }

  async function preparePlayback(activeFigure,profile,name){
    const study=profile.clips&&Object.hasOwn(humanMotionStudies,name)?humanMotionStudies[name]:null;
    let selected=activeFigure.clips.get(name),clipDigest=activeFigure.rigDigest;
    if(profile.clips&&(study||Object.hasOwn(profile.clips,name))){
      const loaded=await stockClip(profile,study?'idle':name,activeFigure);
      selected=loaded.selected;
      clipDigest=loaded.digest;
    }
    if(!selected?.tracks.length||!(selected.duration>0))throw Error('Missing animation');
    const walking=study?.walking?await stockClip(profile,'jog',activeFigure):null;
    if(walking&&!walking.selected?.tracks.length)throw Error('Missing walking animation');
    if(study){
      const inputs=[HOLODECK_MOTION_STUDY_REVISION,name,clipDigest];
      if(walking)inputs.push(walking.digest);
      const signature=new TextEncoder().encode(inputs.join(' '));
      clipDigest=hex(new Uint8Array(await window.crypto.subtle.digest('SHA-256',signature)));
    }
    const edition=activeFigure.rigDigest+'.'+clipDigest;
    let studyRun;
    function start(){
      if(!study){
        const action=activeFigure.mixer.clipAction(selected).reset().setLoop(LoopOnce,1).play();
        action.clampWhenFinished=true;
        action.paused=true;
        return {draw(time){
          action.time=time;
          activeFigure.mixer.update(0);
        },stop(){
          action.stop();
          if(profile.clips)activeFigure.mixer.uncacheClip(selected);
        }};
      }
      studyRun??=createHumanMotionStudy(activeFigure.model,selected,study,walking?.selected);
      const neutral=[];
      activeFigure.model.traverse(node=>{
        if(node===activeFigure.model||node.isBone)neutral.push([node,node.position.clone(),node.quaternion.clone()]);
      });
      return {draw(time){
        const depth=studyRun.apply(activeFigure.model,activeFigure.orientation,Math.round(time*motionStudyRate));
        waterline.visible=Number.isFinite(depth);
        if(waterline.visible)waterline.position.y=activeFigure.root.position.y+depth*activeFigure.root.scale.y;
      },stop(){
        waterline.visible=false;
        activeFigure.orientation.quaternion.identity();
        for(const [node,position,rotation] of neutral){
          node.position.copy(position);
          node.quaternion.copy(rotation);
        }
      }};
    }
    return {name,edition,duration:study?Math.round(study.duration*motionStudyRate)/motionStudyRate:selected.duration,
      get chapters(){return studyRun?.chapters??[];},
      get landmarks(){return studyRun?.landmarks??[];},start};
  }

  function displayClip(isReference){
    playback?.stop();
    playback=null;
    waterline.visible=false;
    showingReference=isReference;
    playback=displayed().start();
    drawPose();
  }

  async function loadClip(next,requestedFrame=0,expected=null,id=++sequence){
    const activeFigure=figure;
    if(!activeFigure||!next)return;
    playing=false;
    refresh();
    let prepared;
    try{prepared=await preparePlayback(activeFigure,rigs[rig],next);}
    catch(error){
      if(id===sequence&&playback){readySequence=id;refresh();}
      throw error;
    }
    if(figure!==activeFigure||id!==sequence)return;
    ++referenceRequest;
    reference=null;
    primary=prepared;
    revision=prepared.edition;
    clip=next;
    readySequence=id;
    if(table)receive('updateComponents',{components:tableControls});
    displayClip(false);
    scrub(expected&&expected!==revision?0:requestedFrame);
    report(expected&&expected!==revision?'El enlace corresponde a otra edición del movimiento.':'');
  }

  async function loadReference(name){
    const request=++referenceRequest,activeFigure=figure,id=sequence;
    if(typeof name!=='string'||name===clip||name===reference?.name)return;
    const prepared=await preparePlayback(activeFigure,rigs[rig],name);
    if(figure!==activeFigure||id!==sequence||request!==referenceRequest)return;
    if(showingReference)displayClip(false);
    reference=prepared;
    if(elapsed>timelineDuration())scrub(frame);
    refresh();
  }

  function displayed(){return showingReference?reference:primary;}
  function clipEdition(){return JSON.stringify([rig,primary?.edition,reference?.edition,displayed()?.name,sequence]);}
  function timelineDuration(){return Math.max(primary?.duration??0,reference?.duration??0);}
  function frameLimit(duration=timelineDuration()){return Math.ceil(duration*motionStudyRate);}
  function availableChapters(){return displayed()?.chapters??[];}
  function drawPose(){
    if(playback)playback.draw(Math.min(displayed().duration,frame/motionStudyRate));
  }
  function scrub(target){
    frame=Math.max(0,Math.min(Math.round(Number(target)||0),frameLimit()));
    elapsed=frame/motionStudyRate;
    drawPose();
  }
  function report(text){
    if(!visible)return;
    message=text;
    if(projected)projected.status.textContent=text;
    if(table&&!clip)receive('updateDataModel',{value:{status:text,rigRetryAvailable,loadingInitialRig}});
    refresh();
  }
  function refresh(){
    if(!visible||!figure||!playback||!clip)return;
    const options=clipOptions(rigs[rig],figure);
    const chapters=availableChapters();
    const currentPose=reviewPose(),exactFrame=currentPose.frame;
    const poseKey=keyForPose(currentPose);
    const displayStatus=message||(canReview===true&&followedPose?.key===poseKey?'Pose recibida de '+followedPose.author+'.':'');
    if(projected&&projected.status.textContent!==displayStatus)projected.status.textContent=displayStatus;
    const chapter=chapters.find(entry=>entry.frame===exactFrame)?.id??'';
    const viewedReview=currentReview();
    const notes=viewedReview?.notes??[];
    const selected=notes.find(item=>item.id===selectedNote)??notes[0];
    const reviewText=selected?selected.author+' · '+selected.text:'';
    const show=Object.fromEntries([...compactControls].map(id=>[id,!compact||sectionControls[section].includes(id)]));
    show.title=show.status=!compact;
    show.playback=true;
    if(table)show.status=Boolean(displayStatus);
    show.chapter&&=chapters.length>0;
    show.heldPose&&=frame>exactFrame;
    const canWriteNote=canReview===true||canSaveLocal();
    show.presentation&&=canReview===true;
    show.accessStatus&&=!canWriteNote;
    show.checkReviewAccess&&=canReview!==true&&!checkingAccess;
    show.note&&=canWriteNote;
    show.noteTarget&&=Boolean(draftPose&&playback&&keyForPose(draftPose)!==poseKey);
    show.reviewNotes&&=notes.length>0;
    show.reviewText&&=notes.length>0;
    const selectedSection=Object.fromEntries(sectionIds.map(id=>[id,id===section]));
    const rigOptions=choices(Object.fromEntries(Object.entries(rigs).map(([id,value])=>[id,value.label])));
    const cycleOptions=options.map(id=>({id,label:cycleControlNames[id]??names[id]??id}));
    const currentEdition=clipEdition();
    const referenceOptions=cycleOptions.filter(option=>option.id!==clip);
    const inlineChoices={rig:[rigOptions,rig],speed:[speedOptions,speed],clip:[cycleOptions,clip],
      chapter:[chapters,chapter],reference:[referenceOptions,reference?.name]};
    let rows=compact?0:Math.max(0,Math.floor((layoutHeight-640)/28));
    const inline={};
    for(const [field,[,columns]] of Object.entries(inlineFields)){
      const [items,selected]=inlineChoices[field],cost=Math.ceil(items.length/columns);
      const visible=cost>0&&cost<=rows&&items.length<=maxInlineOptions;
      if(visible)rows-=cost;
      inline[field]={visible,items:inlineIds(field).map((_,index)=>{
        const option=visible?items[index]:null;
        if(!option)return {visible:false};
        const target=field==='chapter'||field==='reference'?currentEdition:field==='clip'?rig:field;
        return {...option,gestureKey:JSON.stringify([target,option.id]),selected:option.id===selected,visible:true};
      })};
      if(visible&&Object.hasOwn(show,field))show[field]=false;
    }
    receive('updateDataModel',{value:{rig,clip,compact,show,selectedSection,rigOptions,clipOptions:cycleOptions,frame,pose:currentPose,poseKey,
      inline,choiceMenus:{speed:!inline.speed.visible,reference:!inline.reference.visible},
      reference:reference?.name??'',referenceOptions,
      compareLabel:showingReference?'Ver A':'Ver B',showingReference,noReference:!reference,
      lastFrame:Math.max(1,frameLimit()),timelineDisabled:readySequence!==sequence||frameLimit()<1,
      clipEdition:currentEdition,speedOptions,speed,loop,
      heldPose:show.heldPose?'Último fotograma de '+(showingReference?'B':'A')+' · '+exactFrame:'',
      chapter,chapterOptions:chapters,chapterFrames:chapters.length?chapters.map(entry=>entry.frame):displayed().landmarks,
      canReview:canReview===true,presentationBusy,
      accessStatus:checkingAccess?'Comprobando acceso al Taller…':
        canReview===false?'Entrá al Taller para compartir notas.':'No pude confirmar el acceso al Taller.',
      noteAction:compact?(canReview?'Compartir':'Guardar'):(canReview?'Compartir nota':'Guardar en este navegador'),
      copyLabel:compact?'Copiar URL':'Copiar enlace',
      savingNote,
      canSubmitNote:canWriteNote&&(!pendingNote||savingNote||noteReplaced),
      canRetryNote:canReview===true&&Boolean(pendingNote&&!savingNote&&!noteReplaced),
      noteTarget:show.noteTarget?'Borrador para '+poseLabel(draftPose):'',
      reviewAction:viewedReview?(compact?'Ocultar':'Ocultar notas'):'Ver notas',
      reviewText,reviewNotes:selected?.id??'',
      reviewNotesOptions:notes.map(item=>({id:item.id,label:item.author+' · '+item.text})),
      playLabel:playing?'Pausar':'Reproducir',playIcon:playing?'pause':'play',note,status:displayStatus,
      draft:{rig,clip,frame,note,speed,chapter,reference:reference?.name??'',reviewNotes:selected?.id??''}}});
  }
  function reviewPose(){
    const selection=displayed();
    return {rig,clip:selection.name,edition:selection.edition,frame:Math.min(frame,frameLimit(selection.duration))};
  }
  const keyForPose=pose=>JSON.stringify(pose);
  function currentReview(){
    return canReview===true&&review&&playback&&review.key===keyForPose(reviewPose())?review:null;
  }
  const poseLabel=pose=>(names[pose.clip]??pose.clip)+' · fotograma '+pose.frame;
  function exactUrl(pose=reviewPose()){
    const share=new URL('./',url);
    share.searchParams.set('taller','personajes');
    const exact={rig:pose.rig,clip:pose.clip,edicion:pose.edition,fotograma:pose.frame,vista:view};
    for(const [key,value] of Object.entries(exact))share.searchParams.set(key,value);
    return share.href;
  }

  async function requestReview(endpoint,submission,conflict){
    let response;
    try{response=await fetch(endpoint,{signal:inputs.signal,...(submission?{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify(submission)}:{})});}
    catch{throw Error('No pude confirmar el cambio. Podés volver a intentar.');}
    if(response.status===409)throw Error(conflict);
    if(response.status===401||response.status===403){
      canReview=null;
      review=null;
      selectedNote='';
      if(projected)bindStudioNavigation(projected.stage,null);
      throw Error('Cambió el acceso al Taller. Comprobalo para continuar.');
    }
    const result=response.ok?await response.json().catch(()=>null):null;
    if(!result)throw Error('No pude confirmar el cambio. Podés volver a intentar.');
    return result;
  }

  async function fetchReview(pose,submission){
    const endpoint=new URL('api/space/character-pose-review',url);
    if(!submission)endpoint.search=new URLSearchParams(pose).toString();
    const {notes}=await requestReview(endpoint,submission,'La edición de esta pose cambió. Volvé a abrirla.');
    if(!Array.isArray(notes))throw Error('No pude confirmar las notas. Podés volver a intentar.');
    return notes;
  }

  async function usePresentation(publish,pose){
    if(presentationBusy)return;
    playing=false;
    const origin=publish?pose:reviewPose(),key=keyForPose(origin),request=sequence;
    const endpoint=new URL('api/space/character-presentation',url);
    const conflict='La pose del Taller cambió. Volvé a abrirla antes de mostrar otra.';
    presentationBusy=true;
    refresh();
    try{
      const state=await requestReview(endpoint,null,conflict);
      if(!visible||canReview!==true)return;
      if(publish){
        await requestReview(endpoint,{expectedRevision:state.revision,pose:origin},conflict);
        if(visible)report('Mostraste esta pose en el Taller.');
        return;
      }
      if(!state.presentation){report('Todavía no hay una pose compartida.');return;}
      if(!playback||request!==sequence||key!==keyForPose(reviewPose()))return;
      const {pose,author}=state.presentation;
      if(rig===pose.rig)await loadClip(pose.clip,pose.frame,pose.edition);
      else await loadRig(pose.rig,pose.clip,pose.frame,pose.edition);
      const followedKey=keyForPose(pose);
      if(visible&&playback&&keyForPose(reviewPose())===followedKey){
        followedPose={key:followedKey,author};
        message='';
      }
    }catch(error){if(visible)report(error.message);}
    finally{presentationBusy=false;if(visible)refresh();}
  }

  async function toggleReview(){
    if(currentReview()){review=null;refresh();return;}
    if(readingReview)return;
    playing=false;
    const pose=reviewPose(),key=keyForPose(pose);
    readingReview=true;
    try{
      const notes=await fetchReview(pose);
      if(canReview===true&&playback&&key===keyForPose(reviewPose())){
        review={key,notes};
        selectedNote='';
        report(notes.length?'':'Todavía no hay notas en esta pose.');
      }
    }catch(error){if(visible)report(error.message);}
    finally{readingReview=false;if(visible)refresh();}
  }

  async function shareNote(text,pose=draftPose??reviewPose()){
    if(savingNote)return;
    playing=false;
    const key=keyForPose(pose);
    if(!pendingNote||pendingNote.key!==key||pendingNote.submission.text!==text)
      pendingNote={key,submission:{id:window.crypto.randomUUID(),pose,text}};
    const attempt=pendingNote;
    noteReplaced=false;
    savingNote=true;
    refresh();
    try{
      const notes=await fetchReview(pose,attempt.submission);
      pendingNote=null;
      draftPose=undefined;
      note='';
      const stillViewing=playback&&keyForPose(reviewPose())===key;
      if(canReview===true&&stillViewing){
        review={key,notes};
        selectedNote=notes.at(-1)?.id??'';
      }
      report(stillViewing?'Nota compartida en el Taller.':'Nota compartida en '+poseLabel(pose)+'.');
    }catch(error){
      draftPose=pose;
      note=text;
      if(visible)report(error.message);
    }finally{savingNote=false;if(visible)refresh();}
  }
  async function activate(name,{value,clipEdition:expectedClip,pose}={}){
    if(name==='close'&&table){table.close();return;}
    if(name==='retryRig'&&table&&rigRetryAvailable)return openInitialRig();
    if(!name)return;
    if(name==='checkReviewAccess')return checkReviewAccess();
    if(Object.hasOwn(sectionControls,name)){section=name;refresh();return;}
    if(name==='rig'&&Object.hasOwn(rigs,value)&&rig!==value)return loadRig(value);
    if(name==='clip'&&typeof value==='string'&&(clip!==value||!playback))return loadClip(value);
    if(!playback)return;
    if(name==='present'&&canReview&&pose)return usePresentation(true,pose);
    if(name==='follow'&&canReview)return usePresentation(false);
    if(name==='review'&&canReview&&!presentationBusy)return toggleReview();
    if(name==='reviewNotes'&&currentReview()?.notes.some(item=>item.id===value))selectedNote=value;
    if(name==='reference')return loadReference(value);
    if(name==='compare'&&reference)displayClip(!showingReference);
    if(name==='clock'){
      if(readySequence!==sequence||expectedClip!==clipEdition()||!Number.isInteger(value)||value<0||value>frameLimit())return;
      playing=false;
      scrub(value);
    }
    if(name==='chapter'&&readySequence===sequence&&expectedClip===clipEdition()){
      const chapter=availableChapters().find(entry=>entry.id===value);
      if(chapter){playing=false;scrub(chapter.frame);}
    }
    if(name==='play'){
      if(!playing&&frame===frameLimit())scrub(0);
      playing=!playing;
    }
    if(name==='loop')loop=!loop;
    if(name==='speed'&&speedOptions.some(option=>option.id===value))speed=value;
    if(name==='back'||name==='forward'){playing=false;scrub(frame+(name==='back'?-1:1));}
    if(Object.hasOwn(viewAngles,name))setView(name);
    if(name==='copy'&&pose){
      await window.navigator.clipboard.writeText(exactUrl(pose));
      report('Enlace copiado para esta edición y este fotograma.');
    }
    if(name==='retryNote'&&canReview&&pendingNote&&!noteReplaced){
      const {text,pose}=pendingNote.submission;
      return shareNote(text,pose);
    }
    if(name==='pin'){
      const text=String(value||'').trim().slice(0,300);
      if(!text){report('Escribí una nota para este fotograma.');return;}
      if(canReview)return shareNote(text);
      if(!canSaveLocal())return;
      const key='holodeck.characterStudio.notes';
      let notes=[];
      try{const list=JSON.parse(window.localStorage.getItem(key)||'[]');if(Array.isArray(list))notes=list;}catch{}
      window.localStorage.setItem(key,JSON.stringify([...notes.slice(-29),{url:exactUrl(draftPose??reviewPose()),text}]));
      note='';
      draftPose=undefined;
      report('Nota guardada en este navegador.');
    }
    refresh();
  }

  function render(now){
    if(!visible||document.hidden||projected?.graphicsLost())return;
    const dt=Math.min(.05,(now-(previous||now))/1000);
    previous=now;
    if(playing&&ownsNoteInput(document.activeElement)){
      playing=false;
      scrub(frame);
      refresh();
    }
    if(playing&&playback){
      const duration=timelineDuration();
      elapsed+=dt*Number(speed);
      if(elapsed>=duration&&!loop){
        playing=false;
        scrub(frameLimit());
        refresh();
      }else{
        elapsed%=duration;
        frame=Math.floor(elapsed*motionStudyRate);
        drawPose();
        if(now-showedAt>150){showedAt=now;refresh();}
      }
    }
    projected?.draw(Boolean(figure&&clip),(nextCompact,nextWidth,height)=>{
      compact=nextCompact;
      layoutHeight=height;
      if(panelWidth!==nextWidth){
        panelWidth=nextWidth;
        receive('updateComponents',{components:[{...root,width:panelWidth}]});
      }
      refresh();
    });
  }

  function dispose(){
    if(!visible)return;
    visible=false;
    sequence++;
    inputs.abort();
    projected?.dispose();
    playback?.stop();
    disposeFigure(figure);
    scene.traverse(object=>{if(object.isMesh||object.isLineSegments){object.geometry.dispose();object.material.dispose();}});
    if(table)scene.removeFromParent();
  }

  projected?.start(render);
  const initial=!table&&Object.hasOwn(rigs,url.searchParams.get('rig'))?url.searchParams.get('rig'):'companion';
  async function openInitialRig(){
    if(!visible||loadingInitialRig)return;
    loadingInitialRig=true;
    try{
      await loadRig(initial,table?undefined:url.searchParams.get('clip'),
        table?0:url.searchParams.get('fotograma'),table?null:url.searchParams.get('edicion'));
      rigRetryAvailable=false;
      if(visible){playing=!table&&!reduce.matches&&!url.searchParams.has('fotograma');refresh();}
    }catch{
      if(!visible)return;
      rigRetryAvailable=true;
    }finally{
      loadingInitialRig=false;
    }
    if(rigRetryAvailable&&visible){
      report(table?'No se pudo abrir el personaje. Volvé a probar.':'No se pudo abrir el personaje. Podés reintentar o volver al mundo.');
      if(projected){projected.reveal();offerStudioRetry(projected.stage);}
    }
  }
  void openInitialRig();
  function setTableLayout(width,height,short){
    const nextCompact=compactReview(width,height);
    const nextWidth=nextCompact?(short?3.10:2.20):widePanelWidth;
    if(nextWidth!==panelWidth){
      panelWidth=nextWidth;
      tableControls[0]={...tableControls[0],width:nextWidth};
      receive('updateComponents',{components:[playback?tableControls[0]:loadingPanel()]});
    }
    if(nextCompact!==compact||height!==layoutHeight){
      compact=nextCompact;
      layoutHeight=height;
      refresh();
    }
    return compact;
  }
  return {dispatch,render,dispose,setTableLayout,
    currentPose:()=>visible&&playback?reviewPose():null};
}

function webStudioProjection(document,renderer,scene,dispatch,close,pause){
  const window=document.defaultView,events=new AbortController();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  const stage=buildStage(document),status=stage.querySelector('output');
  function reveal(){
    if(!document.body.hasAttribute('data-world-starting'))return;
    document.body.removeAttribute('data-world-starting');
    window.dispatchEvent(new Event('holodeck:entered'));
  }
  const canvas=renderer.domElement;
  stage.prepend(canvas);
  const hudScene=new Scene();
  scene.background=new Color(0x0b1e2a);
  scene.fog=new Fog(0x0b1e2a,5,15);
  studioLights(scene);
  const camera=new PerspectiveCamera(characterReviewCamera.fov,1,.03,35);
  const hudCamera=new OrthographicCamera(-1,1,1,-1,.1,12);
  hudCamera.position.z=4;
  const pointer=new Vector2(),ray=new Raycaster();
  let group,viewportWidth=0,viewportHeight=0;
  const hud=createSpatialHud({document,parent:hudScene,accessibilityRoot:stage.querySelector('.studio-a11y'),
    controlStyle:'optical',retainTextDrafts:true,controlRole:characterControlRole,
    placeSurface(value){group=value;},send:({action})=>dispatch(action)});
  hud.setPalette({background:'#102834e8',button:'#263e46',pressed:'#43766e',text:'#eff7f0',focus:'#ecc782',disabled:'#25353d'});
  const graphicsNotice=document.createElement('output');
  graphicsNotice.setAttribute('aria-live','polite');
  graphicsNotice.hidden=true;
  stage.append(graphicsNotice);
  let lost=false,savedFocus;
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    if(lost)return;
    lost=true;
    const active=document.activeElement;
    savedFocus=hud.ownsAccessibleInput(active)||hud.ownsTextInput(active)?hud.currentFocus()?.instanceId:undefined;
    hud.setInteractionScope({surfaceIds:[]});
    orbit.enabled=false;
    status.hidden=true;
    graphicsNotice.hidden=false;
    graphicsNotice.textContent='Se interrumpió la vista 3D. Esperando a que se recupere.';
    pause();
  },{signal:events.signal});
  canvas.addEventListener('webglcontextrestored',()=>{
    if(!lost)return;
    lost=false;
    graphicsNotice.hidden=true;
    status.hidden=false;
    orbit.enabled=true;
    hud.setInteractionScope();
    if(savedFocus&&(document.activeElement===document.body||document.activeElement===canvas)){
      hud.focusAccessibleControl(surfaceId,savedFocus);
    }
    savedFocus=undefined;
  },{signal:events.signal});
  function rayForPointer(event){
    if(lost)return;
    const {left,top,width,height}=canvas.getBoundingClientRect();
    if(!width||!height)return;
    pointer.set((event.clientX-left)/width*2-1,1-(event.clientY-top)/height*2);
    ray.setFromCamera(pointer,hudCamera);
    return {ray:ray.ray};
  }
  const beginRangeDrag=hud.beginRangeDrag;
  hud.beginRangeDrag=(pointerRay,options)=>{
    const began=beginRangeDrag(pointerRay,options);
    if(began)pause();
    return began;
  };
  const unbind=bindSpatialHudPointer({element:canvas,hud,rayForPointer});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||
      event.target?.closest?.('input,textarea,select,[contenteditable]')||!hud.dismissChoice(surfaceId))return;
    event.preventDefault();
    event.stopPropagation();
  },{signal:events.signal});
  canvas.addEventListener('wheel',event=>{
    const projection=rayForPointer(event);
    if(group&&projection&&hud.pointerTarget(projection.ray)!==undefined){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },{capture:true,passive:false,signal:events.signal});
  const orbit=new OrbitControls(camera,canvas);
  orbit.target.set(0,characterReviewCamera.targetHeight,0);
  orbit.enablePan=false;
  orbit.minDistance=characterReviewCamera.minDistance;
  orbit.maxDistance=characterReviewCamera.maxDistance;
  orbit.maxPolarAngle=characterReviewCamera.maxPolarAngle;
  window.addEventListener('pagehide',event=>{if(!event.persisted)close();},{signal:events.signal});

  function draw(ready,onResize){
    const width=stage.clientWidth,height=stage.clientHeight;
    if(!width||!height)return;
    const portrait=width<height*1.05;
    const compact=compactReview(width,height);
    const availableWidth=portrait?width-24:Math.min(420,width*.49-12);
    if(viewportWidth!==width||viewportHeight!==height){
      viewportWidth=width;
      viewportHeight=height;
      stage.classList.toggle('studio-compact',compact);
      const shortHud=compact&&height<680;
      hud.setChoicePageSize(surfaceId,shortHud?(height<500?1:2):undefined);
      hud.setChoicePresentation(surfaceId,shortHud?'overlay':undefined);
      const nextPanelWidth=compact?Math.min(1.10,Math.max(.5,availableWidth/300-.12)):widePanelWidth;
      onResize(compact,nextPanelWidth,height);
      renderer.setSize(width,height,false);
      camera.setViewOffset(width,height,Math.round(width*(compact&&portrait?0:.19)),
        compact&&portrait?Math.round(height*.20):0,width,height);
    }
    renderer.autoClear=true;
    renderer.render(scene,camera);
    hud.update();
    if(group&&ready){
      const bounds=hud.getSurfaceBounds(surfaceId);
      if(!bounds)return;
      const panelHeight=bounds.top-bounds.bottom;
      const panelSpan=bounds.right-bounds.left;
      const scale=compact?Math.min(300,Math.max(1,availableWidth)/panelSpan,Math.max(1,height-76)/panelHeight):
        Math.min(169,width*.39/panelSpan,height*.75/panelHeight);
      const top=compact?Math.max(66,height-panelHeight*scale-14):height*.18;
      const x=!compact?width*.77:portrait?width/2:width-12-panelSpan*scale/2;
      hud.setTextDensity(surfaceId,{cssPixelsPerUnit:Math.round(scale),pixelRatio:renderer.getPixelRatio()});
      placeHudInViewport(group,hudCamera,{width,height,pixelsPerUnit:scale,
        x,y:top+bounds.top*scale,depth:1});
      renderer.autoClear=false;
      renderer.clearDepth();
      renderer.render(hudScene,hudCamera);
      reveal();
    }
  }

  return {stage,status,draw,reveal,ownsTextInput:hud.ownsTextInput,graphicsLost:()=>lost,
    send:(type,value)=>hud.receive({version:'1.0',[type]:{surfaceId,...value}}),
    setAngle(angle){
      const {distance,compactDistance,eyeHeight}=characterReviewCamera;
      const radius=stage.clientWidth<670?compactDistance:distance;
      camera.position.set(Math.sin(angle)*radius,eyeHeight,Math.cos(angle)*radius);
      orbit.update();
    },
    start:render=>renderer.setAnimationLoop(render),
    dispose(){
      renderer.setAnimationLoop(null);
      unbind();
      events.abort();
      orbit.dispose();
      hud.dispose();
      renderer.dispose();
    },
  };
}
