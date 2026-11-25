import {
  ACESFilmicToneMapping,AnimationMixer,Box3,Color,CylinderGeometry,DirectionalLight,
  Fog,GridHelper,Group,HemisphereLight,Mesh,MeshBasicMaterial,MeshStandardMaterial,OrthographicCamera,PlaneGeometry,
  PerspectiveCamera,Raycaster,Scene,Vector2,Vector3,WebGLRenderer,
} from 'three';
import {ModelLoader} from '@mml-io/model-loader';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';
import {AVATARS} from './avatar-registry.mjs';
import {createHumanMotionStudy,humanMotionStudies,motionStudyRate} from './human-motion-study.mjs';
import {ATELIER_FOYER,CHARACTER_STUDIO} from './house-review-rooms.mjs';
import {arrivalDoor,doorLocation,readSpace} from './space-travel.mjs';

const rigs={
  companion:{label:'Navegante',file:AVATARS['compaii-navegante-white-v1'].model},
  humanoid:{label:'Humanoide',file:'assets/avatar-1-bodyA-skin01.glb',clips:{
    idle:'assets/anim_idle.glb',jog:'assets/anim_jog.glb',
    run:'assets/anim_run.glb',air:'assets/anim_air.glb',
  }},
};
const names={
  idle:'Reposo',jog:'Trote',air:'En el aire',calm:'Reposo',curious:'Curiosidad',joy:'Alegría',
  sad:'Tristeza',anger:'Enojo',uncertain:'Duda',focus:'Concentración',welcome:'Saludo',
  sleep:'Dormir',walk:'Marcha · clip original',run:'Carrera · clip original',
  hover:'Vuelo en el lugar',glide:'Planeo',lift:'Despegue',landing:'Aterrizaje',
  bound:'Zancada larga · clip original',wade:'Vadear',tread:'Flotar',swim:'Nado',
  brace:'Frenada',scan:'Mirar alrededor',sway:'Balanceo',tinker:'Explorar',chirp:'Exclamación',
  ...Object.fromEntries(Object.entries(humanMotionStudies).map(([id,study])=>[id,study.label])),
};
const surfaceId='character-studio';
const choices=items=>Object.entries(items).map(([id,label])=>({id,label}));
const path=key=>({'@path':'/'+key});
const action=(name,key)=>({event:{name,...(key?{context:{value:path('draft/'+key)}}:{})}});
const label=(id,text,style='body')=>({id,component:'HudText',label:text,style});
const row=(id,children)=>({id,component:'HudRow',children});
const button=(id,text,key)=>({id,component:'HudButton',label:text,action:action(id,key)});
const choice=(id,name)=>({id,component:'HudChoice',label:name,options:path(id+'Options'),
  value:path(id),draft:path('draft/'+id),action:action(id,id)});
const controls=frameCount=>[
  {id:'root',component:'HudPanel',label:'Revisión de movimiento',width:1.85,gap:.025,
    children:['title','rig','clip','clock','playback','views','note','archive','status']},
  label('title','Revisión de movimiento','title'),choice('rig','Personaje'),choice('clip','Ciclo'),
  {id:'clock',component:'HudRange',label:'Fotograma',min:0,max:Math.max(1,frameCount),step:1,value:path('frame'),
    draft:path('draft/frame'),action:action('clock','frame')},
  row('playback',['back','play','forward']),button('back','−1'),button('play',path('playLabel')),button('forward','+1'),
  row('views',['front','angle','side']),button('front','Frente'),button('angle','Tres cuartos'),button('side','Perfil'),
  {id:'note',component:'HudTextInput',label:'Nota para este fotograma',value:path('note'),
    draft:path('draft/note'),placeholder:'Qué ves en la pose',maxLength:300,action:action('pin','note')},
  row('archive',['pin','copy']),{...button('pin','Fijar nota','note'),submitFor:'note'},button('copy','Copiar enlace'),
  {...label('status',path('status'),'status'),lines:2},
];
const studioStyle=`
.character-studio{position:fixed;inset:0;background:#07121a;color:#f4f4e9}
.character-studio canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
.character-studio header{position:absolute;top:max(22px,env(safe-area-inset-top));left:clamp(18px,4vw,54px);
  right:clamp(18px,4vw,54px);display:flex;justify-content:space-between;align-items:center;pointer-events:none}
.character-studio h1{font:500 clamp(19px,4.8vw,34px)/1.1 Georgia,serif;margin:0;color:#f5eccd}
.character-studio a{pointer-events:auto;color:#c5e9e3;text-decoration:none;border-bottom:1px solid #82b7ad;padding:8px 0}
.character-studio a:focus-visible{outline:2px solid #f2d393}
.character-studio output{position:absolute;bottom:20px;left:clamp(18px,4vw,54px);font-size:12px;color:#c4dddb;pointer-events:none}
.character-studio .studio-a11y{position:absolute;inset:0;pointer-events:none}
@media(max-width:650px){.character-studio header{top:12px}.character-studio output{bottom:5px}}
`;

function buildStage(document){
  const wrapper=document.createElement('main');
  wrapper.className='character-studio';
  wrapper.innerHTML='<header><h1>Taller de personajes</h1><a href="./">Volver al mundo</a></header><output aria-live="polite"></output><div class="studio-a11y"></div>';
  const style=document.createElement('style');
  style.textContent=studioStyle;
  wrapper.prepend(style);
  document.body.replaceChildren(wrapper);
  return wrapper;
}

async function connectStudioReturn(wrapper){
  let space;
  try{space=await readSpace(AbortSignal.timeout(5000));}catch{return;}
  if(space.id!==CHARACTER_STUDIO||!space.exits.some(exit=>exit.to===ATELIER_FOYER))return;
  const link=wrapper.querySelector('header a');
  link.textContent='Volver al vestíbulo';
  let pending=false;
  link.addEventListener('click',async event=>{
    event.preventDefault();
    if(pending)return;
    pending=true;
    link.setAttribute('aria-disabled','true');
    const destination=new URL(link.href);
    const move={from:space.id,to:ATELIER_FOYER};
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
    if(next?.id===ATELIER_FOYER){
      const arrival=arrivalDoor(space,next);
      if(arrival)destination.hash=doorLocation(arrival);
      location.replace(destination);
      return;
    }
    wrapper.querySelector('output').textContent='No pude abrir la puerta. Volvé a intentar.';
    link.removeAttribute('aria-disabled');
    pending=false;
  });
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

function normalise(root){
  root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(root,true);
  const centre=bounds.getCenter(new Vector3());
  const height=bounds.max.y-bounds.min.y;
  if(!(height>.01))throw Error('Could not frame the rig');
  const scale=1.48/height;
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

export async function openCharacterStudio(document){
  const url=new URL(document.location.href),window=document.defaultView;
  const renderer=new WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.toneMapping=ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  window.dispatchEvent(new Event('holodeck:entered'));
  const stage=buildStage(document),status=stage.querySelector('output');
  void connectStudioReturn(stage);
  stage.prepend(renderer.domElement);
  const scene=new Scene(),hudScene=new Scene();
  scene.background=new Color(0x0b1e2a);
  scene.fog=new Fog(0x0b1e2a,5,15);
  studioLights(scene);
  const waterline=new Mesh(new PlaneGeometry(3.5,3.5),new MeshBasicMaterial({
    color:0x3999b0,transparent:true,opacity:.20,depthWrite:false,
  }));
  waterline.rotation.x=-Math.PI/2;
  waterline.visible=false;
  scene.add(waterline);
  const camera=new PerspectiveCamera(36,1,.03,35);
  const hudCamera=new OrthographicCamera(-1,1,1,-1,.1,12);
  hudCamera.position.z=4;
  const pointer=new Vector2(),ray=new Raycaster();
  const loader=new ModelLoader();
  const viewAngles={front:0,angle:.62,side:Math.PI/2};
  let view=Object.hasOwn(viewAngles,url.searchParams.get('vista'))?url.searchParams.get('vista'):'angle';
  let figure,playback,group,rig,clip,frame=0,playing=false,revision='',note='',message='',showedAt=-Infinity;
  let sequence=0,elapsed=0,previous=0,visible=true;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');

  const hud=createSpatialHud({document,parent:hudScene,accessibilityRoot:stage.querySelector('.studio-a11y'),
    placeSurface(value){group=value;},send:({action:requested})=>void activate(requested?.name,requested?.context?.value).catch(()=>report('No se pudo aplicar el cambio.'))});
  document.body.addEventListener('focusin',event=>{
    if(playing&&hud.ownsTextInput(event.target)){playing=false;scrub(frame);}
  });
  const receive=(type,value)=>hud.receive({version:'1.0',[type]:{surfaceId,...value}});
  receive('createSurface',{catalogId:spatialHudCatalog.id});
  receive('updateComponents',{components:controls(1)});
  hud.setPalette({background:'#102834e8',button:'#263e46',pressed:'#43766e',text:'#eff7f0',focus:'#ecc782',disabled:'#25353d'});
  const unbind=bindSpatialHudPointer({element:renderer.domElement,hud,rayForPointer:event=>{
    const {left,top,width,height}=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-left)/width*2-1,1-(event.clientY-top)/height*2);
    ray.setFromCamera(pointer,hudCamera);
    return {ray:ray.ray};
  }});

  const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');

  async function readAsset(file){
    const source=new URL(file,url);
    const response=await fetch(source);
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
    report('Abriendo el personaje…');
    const {model,digest}=await readAsset(profile.file);
    const root=new Group(),orientation=new Group();
    root.add(orientation);
    orientation.add(model.group);
    normalise(root);
    const nextFigure={root,orientation,model:model.group,rigDigest:digest,
      mixer:new AnimationMixer(model.group),clips:new Map(model.animations.map(item=>[item.name,item]))};
    if(id!==sequence){disposeFigure(nextFigure);return;}
    playback?.stop();
    disposeFigure(figure);
    figure=nextFigure;
    playback=null;
    waterline.visible=false;
    rig=next;
    scene.add(root);
    const options=clipOptions(profile,figure);
    const primary=options.includes(requestedClip)?requestedClip:profile.clips?'estudio-vuelo':options[0];
    await loadClip(primary,requestedFrame,expected,id);
  }

  async function loadClip(next,requestedFrame=0,expected=null,id=++sequence){
    const activeFigure=figure,profile=rigs[rig];
    if(!activeFigure||!next)return;
    playing=false;
    const study=profile.clips&&Object.hasOwn(humanMotionStudies,next)?humanMotionStudies[next]:null;
    let selected=activeFigure.clips.get(next),clipDigest=activeFigure.rigDigest;
    if(profile.clips){
      if(!study&&!Object.hasOwn(profile.clips,next))return;
      const loaded=await stockClip(profile,study?'idle':next,activeFigure);
      if(figure!==activeFigure||id!==sequence)return;
      selected=loaded.selected;
      clipDigest=loaded.digest;
    }
    if(!selected?.tracks.length||!(selected.duration>0))throw Error('Missing animation');
    if(study){
      const signature=new TextEncoder().encode(HOLODECK_MOTION_STUDY_REVISION+' '+next+' '+clipDigest);
      const bytes=new Uint8Array(await window.crypto.subtle.digest('SHA-256',signature));
      if(figure!==activeFigure||id!==sequence)return;
      clipDigest=hex(bytes);
    }
    playback?.stop();
    playback=null;
    waterline.visible=false;
    if(study){
      const run=createHumanMotionStudy(activeFigure.model,selected,study);
      const neutral=[];
      activeFigure.model.traverse(node=>{
        if(node===activeFigure.model||node.isBone)neutral.push([node,node.position.clone(),node.quaternion.clone()]);
      });
      playback={duration:run.count/motionStudyRate,
        draw(time){
          const depth=run.apply(activeFigure.model,activeFigure.orientation,Math.round(time*motionStudyRate));
          waterline.visible=Number.isFinite(depth);
          if(waterline.visible)waterline.position.y=activeFigure.root.position.y+depth*activeFigure.root.scale.y;
        },
        stop(){
          waterline.visible=false;
          activeFigure.orientation.quaternion.identity();
          for(const [node,position,rotation] of neutral){
            node.position.copy(position);
            node.quaternion.copy(rotation);
          }
        }};
    }else{
      const current=activeFigure.mixer.clipAction(selected).play();
      current.paused=true;
      playback={duration:selected.duration,draw(time){
        current.time=time;
        activeFigure.mixer.update(0);
      },stop(){
        current.stop();
        if(profile.clips)activeFigure.mixer.uncacheClip(selected);
      }};
    }
    revision=activeFigure.rigDigest+'.'+clipDigest;
    clip=next;
    receive('updateComponents',{components:controls(frameLimit())});
    scrub(expected&&expected!==revision?0:requestedFrame);
    report(expected&&expected!==revision?'El enlace corresponde a otra edición del movimiento.':'');
    refresh();
  }

  function frameLimit(){return playback?Math.min(1000,Math.ceil(playback.duration*motionStudyRate)):0;}
  function scrub(target){
    frame=Math.max(0,Math.min(Math.round(Number(target)||0),frameLimit()));
    elapsed=frame/motionStudyRate;
    playback?.draw(Math.min(playback.duration,elapsed));
  }
  function report(text){message=text;status.textContent=text;refresh();}
  function refresh(){
    if(!figure||!clip)return;
    const options=clipOptions(rigs[rig],figure);
    receive('updateDataModel',{value:{rig,clip,rigOptions:choices(Object.fromEntries(Object.entries(rigs).map(([id,value])=>[id,value.label]))),
      clipOptions:choices(Object.fromEntries(options.map(id=>[id,names[id]||id]))),frame,
      playLabel:playing?'Pausar':'Reproducir',note,status:message,
      draft:{rig,clip,frame,note}}});
  }
  function exactUrl(){
    const share=new URL(url);
    for(const [key,value] of Object.entries({rig,clip,fotograma:frame,vista:view,edicion:revision}))share.searchParams.set(key,value);
    return share.href;
  }
  async function activate(name,value){
    if(!name)return;
    if(name==='rig'&&Object.hasOwn(rigs,value)&&rig!==value)return loadRig(value);
    if(name==='clip'&&typeof value==='string'&&(clip!==value||!playback))return loadClip(value);
    if(!playback)return;
    if(name==='clock'){playing=false;scrub(value??frame);}
    if(name==='play')playing=!playing;
    if(name==='back'||name==='forward'){playing=false;scrub(frame+(name==='back'?-1:1));}
    if(Object.hasOwn(viewAngles,name))view=name;
    if(name==='copy'){
      await window.navigator.clipboard.writeText(exactUrl());
      report('Enlace copiado para esta edición y este fotograma.');
    }
    if(name==='pin'){
      const text=String(value||'').trim().slice(0,300);
      if(!text){report('Escribí una nota para este fotograma.');return;}
      const key='holodeck.characterStudio.notes';
      let notes=[];
      try{const list=JSON.parse(window.localStorage.getItem(key)||'[]');if(Array.isArray(list))notes=list;}catch{}
      window.localStorage.setItem(key,JSON.stringify([...notes.slice(-29),{url:exactUrl(),text}]));
      note='';
      report('Nota guardada en este navegador.');
    }
    refresh();
  }

  function render(now){
    if(!visible||document.hidden)return;
    const dt=Math.min(.05,(now-(previous||now))/1000);
    previous=now;
    if(playing&&playback){
      elapsed=(elapsed+dt)%playback.duration;
      playback.draw(elapsed);
      frame=Math.floor(elapsed*motionStudyRate);
      if(now-showedAt>150){showedAt=now;refresh();}
    }
    const width=stage.clientWidth,height=stage.clientHeight;
    if(!width||!height)return;
    if(renderer.domElement.clientWidth!==width||renderer.domElement.clientHeight!==height||
      camera.aspect!==width/height){
      renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
    }
    const compact=width<670,a=viewAngles[view],distance=compact?4.7:4.4;
    camera.position.set(Math.sin(a)*distance,1.95,Math.cos(a)*distance);
    camera.lookAt(0,.78,0);
    if(compact)camera.setViewOffset(width,height,0,Math.round(height*.20),width,height);
    else camera.setViewOffset(width,height,Math.round(width*.19),0,width,height);
    renderer.autoClear=true;
    renderer.render(scene,camera);
    hud.update();
    if(group&&figure&&clip){
      const scale=Math.min(169,(compact?width*.90:width*.36)/2.02,
        (compact?height*.47:height*.75)/1.87);
      placeHudInViewport(group,hudCamera,{width,height,pixelsPerUnit:scale,
        x:width*(compact?.5:.77),y:height*(compact?.53:.18),depth:1});
      renderer.autoClear=false;
      renderer.clearDepth();
      renderer.render(hudScene,hudCamera);
    }
  }

  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    visible=false;
    sequence++;
    renderer.setAnimationLoop(null);
    unbind();
    hud.dispose();
    playback?.stop();
    disposeFigure(figure);
    scene.traverse(object=>{if(object.isMesh||object.isLineSegments){object.geometry.dispose();object.material.dispose();}});
    renderer.dispose();
  });
  renderer.setAnimationLoop(render);
  const initial=Object.hasOwn(rigs,url.searchParams.get('rig'))?url.searchParams.get('rig'):'companion';
  await loadRig(initial,url.searchParams.get('clip'),url.searchParams.get('fotograma'),url.searchParams.get('edicion'))
    .then(()=>{playing=!reduce.matches&&!url.searchParams.has('fotograma');refresh();})
    .catch(()=>report('No se pudo abrir el personaje. Podés volver al mundo.'));
}
