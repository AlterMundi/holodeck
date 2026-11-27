import {AmbientLight,BufferGeometry,DirectionalLight,Group,Line,LineBasicMaterial,Mesh,MeshBasicMaterial,PlaneGeometry,PerspectiveCamera,Raycaster,Scene,SRGBColorSpace,Vector2,Vector3,VideoTexture} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';
import {HudRenderLayer} from './hud-render-layer.mjs';
import {mountWorkbenchControls,workbenchItems} from './workbench-controls.mjs';
import {BeaconNativeModel} from './beacon-native-model.mjs';
import {readWorktableReview} from './collection-review.mjs';
import {makeModel} from './collection-worktable.mjs';
import {disposeModel} from './gallery-models.mjs';
import {bindHarMoCAPPreview,preparedDownloadUrl,takeFormats} from './beacon-video-preview.mjs';

const panel='/harmonic_lab/';
const nativeId='lab-worktable';
const guitarRows={mechanism:'settings',startup:'startupStatus',support:'supportLabel'};
const routeViewPattern=/^[a-z0-9][a-z0-9_-]{0,79}(?:\.(?:[0-9]|[12][0-9]|3[01]))?$/;
const pendingPhases=new Set(['queued','starting']);
const audioTrouble=Object.freeze({
  input:'La entrada de audio seleccionada no está disponible. Revisá su conexión y reintentá.',
  output:'La salida de audio seleccionada no está disponible. Revisá su conexión y reintentá.',
  microphone:'El micrófono seleccionado no está disponible. Revisá su conexión y reintentá.',
  profile:'Completá la selección de entrada y salidas de audio en esta estación.',
  jack:'El sistema de audio de esta estación no está disponible. Revisalo y reintentá.',
});
function startFailure(job,service){
  if(!job?.services?.includes(service))return;
  const result=job.results?.[service];
  if(result?.status!=='failed'&&job.phase!=='failed')return;
  if(Object.hasOwn(audioTrouble,result?.audioIssue))return audioTrouble[result.audioIssue];
  if(result?.projection==='failed')return 'Spatializer está abierto. Revisá el audio para recuperar sus controles.';
  if(job.phase==='failed')return 'La estación tardó demasiado en preparar el instrumento.';
  return 'No se pudo preparar el instrumento. Revisá la estación y reintentá.';
}
const readFlag={shaper:'shaperProjectionReady',rostro:'rostroProjectionReady',harmocap:'harmocapProjectionReady'};
const nativeAction=(name,context={})=>({event:{name,context}});

export function openBeaconNative(stage,{world,station,surface,title,readStatus,focused=false}){
  const document=stage.ownerDocument;
  const controller=new AbortController();
  const {signal}=controller;
  const parent=new Group();
  parent.name='Harmonic Lab · '+station.id;
  parent.position.set(station.position.x,station.position.y+1.6,station.position.z);
  const eye=world.camera.getWorldPosition(new Vector3());
  parent.rotation.y=Math.atan2(eye.x-parent.position.x,eye.z-parent.position.z);
  parent.scale.setScalar(.57);
  const layer=focused?new HudRenderLayer(world.renderer,{viewport:stage,mount:stage}):null;
  const viewScene=focused?new Scene():world.scene;
  const viewCamera=focused?new PerspectiveCamera(42,1,.05,20):world.camera;
  if(focused){
    viewCamera.position.z=3;
    const light=new DirectionalLight(0xffe2bd,2.3);
    light.position.set(1.3,2.8,3);
    viewScene.add(new AmbientLight(0xcbe5f0,1.9),light);
  }
  viewScene.add(parent);
  const model=new BeaconNativeModel(surface);
  let selected,source,csrf,stream,binding,timer,latestView,lastProblem='',editProblem='',viewKey,refreshing=false,voiceRoute='';
  let downloadingPreset=false;
  let presetFile,importingPreset=false;
  const outbound=createSpatialHud({parent,document,accessibilityRoot:stage,controlStyle:'optical',
    send(message){
      const action=message.action;
      if(signal.aborted||action?.surfaceId!==nativeId)return;
      if(action.name==='chooseStation'){
        selected=action.context.host;
        voiceRoute='';
        void refresh();
      }else if(action.name==='retryStation'){
        if(stream){stream.close();stream=null;}
        explicit=true;
        attempted.delete(selected);
        void refresh();
      }else if(action.name==='downloadWeaverPreset'&&source&&latestView&&surface==='weaver'){
        void downloadPreset(action.context.edition);
      }else if(action.name==='chooseWeaverPresetFile'&&source&&latestView&&surface==='weaver'&&!importingPreset){
        choosePresetFile();
      }else if(action.name==='importWeaverPresetFile'&&source&&latestView&&surface==='weaver'){
        void importPresetFile();
      }else if(action.name==='downloadPreparedTake'&&source&&latestView&&surface==='harmocap'){
        const {take,format}=action.context;
        const root=panel+'api/a2ui/'+surface;
        const url=preparedDownloadUrl(root,query,take,format);
        if(url&&url===preparedDownloadUrl(root,query,model.data.preparedTake,format)){
          const link=document.createElement('a');
          link.href=url;
          link.download='';
          document.body.append(link);
          link.click();
          link.remove();
        }
      }else if(action.name==='stationInput'&&latestView){
        const {id,kind,value}=action.context;
        edit(id,kind,value);
      }
    }});
  if(focused)outbound.setPalette({background:'#10232d',button:'#264654',
    pressed:'#34695e',disabled:'#273942',text:'#eef5f3',focus:'#e7ca8c'});
  let placement, stackedGuitar=false;
  function draw(){
    if(!layer||signal.aborted)return;
    const {width,height}=stage.getBoundingClientRect();
    if(!width||!height)return;
    const bounds=outbound.getSurfaceBounds(nativeId);
    if(!bounds)return;
    const videoVisible=preview?.visible()??false;
    const hasCompanion=surface==='guitar'||videoVisible;
    const side=hasCompanion&&width>=740;
    const stacked=hasCompanion&&!side;
    const sideWidth=videoVisible?2.03:1.75;
    const panelWidth=bounds.right-bounds.left;
    const panelHeight=bounds.top-bounds.bottom;
    const span=side?panelWidth+sideWidth:panelWidth;
    const total=panelHeight+(stacked?1.15:0);
    const scale=Math.min((width-24)/span,(height-24)/total,side?245:260);
    if(scale<=0)return;
    const key=[width,height,scale,bounds.bottom,videoVisible,layer.pixelRatio].join(':');
    if(key!==placement){
      stackedGuitar=stacked;
      placement=key;
      viewCamera.aspect=width/height;
      viewCamera.updateProjectionMatrix();
      placeHudInViewport(parent,viewCamera,{width,height,x:width/2-(side?sideWidth*.5*scale:0),
        y:(height-total*scale)*.43+bounds.top*scale,pixelsPerUnit:scale,depth:3});
      outbound.setTextDensity(nativeId,{cssPixelsPerUnit:Math.round(scale),pixelRatio:layer.pixelRatio,fontSize:width<520?14:17});
      outbound.setChoicePresentation(nativeId,'overlay');
      outbound.update();
      layer.invalidate();
    }
    if(guitar?.placement!==placement&&guitar){
      guitar.placement=placement;
      guitar.group.position.set(side?2.44:0,side?-1.14:bounds.bottom-.94,0);
      showGuitarLink();
      layer.invalidate();
    }
    if(videoVisible){
      preview.layout(bounds,side);
      if(preview.frameChanged())layer.invalidate();
    }
    layer.draw(viewScene,viewCamera);
  }
  function edit(id,kind,value){
    if(signal.aborted||!latestView)return;
    const envelope=model.action(id,kind,value);
    editProblem=model.actionConflict?'El valor cambió en otra vista. Revisá el ajuste antes de aplicarlo.':'';
    if(surface==='weaver'&&envelope?.action.name==='showVoiceRoute'){
      const selection=envelope.action.context.selection;
      if(Array.isArray(selection)&&selection.length<=1){
        const route=selection[0];
        if(typeof route==='string'&&routeViewPattern.test(route))openVoiceRoute(route);
        else if(!selection.length&&envelope.action.sourceComponentId==='return_to_weaver')openVoiceRoute('');
        else{
          editProblem='Elegí una conexión para editar.';
          showModel();
        }
      }
    }else if(surface==='spatializer'&&envelope?.action.name==='downloadSpatializerTake'){
      const {take,edition}=envelope.action.context;
      if(typeof take==='string'&&/^[0-9a-f]{32}$/.test(take)&&typeof edition==='string'&&
        /^[0-9a-f]{64}$/.test(edition)&&model.data.takes?.[take]?.edition===edition){
        const link=document.createElement('a');
        link.href=url('/takes/'+take+'/'+edition);
        link.download='';
        document.body.append(link);
        link.click();
        link.remove();
      }
    }else if(envelope?.action.name==='reviewPreparedTake')preview?.review(envelope.action.context.take);
    else if(envelope)void write(envelope);
    else showModel();
  }
  const attempted=new Set();
  let guitar, guitarRequest, guitarSelection, guitarProblem;
  const guitarLink=surface==='guitar'?new Line(new BufferGeometry(),
    new LineBasicMaterial({color:0x58d8b0,transparent:true,opacity:.85})):null;
  if(guitarLink){
    guitarLink.name='Guitar part reference';
    guitarLink.visible=false;
    parent.add(guitarLink);
  }
  function showGuitarLink(){
    if(!guitarLink)return;
    const panel=outbound.group.getObjectByName(nativeId);
    const row=panel?.getObjectByName(guitarRows[guitar?.section])??panel?.getObjectByName('sections');
    const part=guitar?.part;
    guitarLink.visible=Boolean(row&&part);
    if(!guitarLink.visible)return;
    const label=parent.worldToLocal(row.getWorldPosition(new Vector3()));
    const center=part.geometry.boundingBox.getCenter(new Vector3());
    center.z=part.geometry.boundingBox.max.z;
    const target=parent.worldToLocal(part.localToWorld(center));
    const bottom=panel&&outbound.getSurfaceBounds(nativeId)?.bottom;
    const points=stackedGuitar&&bottom!==undefined?[
      new Vector3(label.x+.98,bottom,label.z+.03),
      new Vector3(label.x+.98,bottom-.16,label.z+.03),
      target,
    ]:[
      new Vector3(label.x+1.26,label.y,label.z+.03),
      new Vector3(label.x+1.44,label.y,label.z+.03),
      target,
    ];
    guitarLink.geometry.setFromPoints(points);
    guitarLink.geometry.computeBoundingSphere();
    guitarLink.userData.part=part.name;
    guitarLink.userData.section=guitar.section;
  }
  const preview=surface==='harmocap'?mountVideo():null;
  function mountVideo(){
    const video=document.createElement('video');
    video.muted=true;
    video.playsInline=true;
    video.preload='metadata';
    const texture=new VideoTexture(video);
    texture.colorSpace=SRGBColorSpace;
    const plane=new Mesh(new PlaneGeometry(1.8,1.0125),new MeshBasicMaterial({map:texture,toneMapped:false}));
    plane.name='HarMoCAP preview';
    plane.visible=false;
    plane.position.set(2.35,-.63,0);
    parent.add(plane);
    const player=bindHarMoCAPPreview(video,panel+'api/a2ui/'+surface,query,{
      visible(value){plane.visible=value;layer?.invalidate();},
      notice(text){if(text){lastProblem=text;if(latestView)showModel(false);}},
    });
    let lastFrame;
    return {...player,
      visible:()=>plane.visible,
      frameChanged(){
        if(video.readyState<2)return false;
        const frame=video.requestVideoFrameCallback?texture.version:video.currentTime;
        if(frame===lastFrame)return false;
        lastFrame=frame;
        return true;
      },
      layout(bounds,side){
        plane.position.set(side?bounds.right+1.06:(bounds.right+bounds.left)/2,
          side?(bounds.top+bounds.bottom)/2:bounds.bottom-.64,0);
      },
      dispose(){player.dispose();plane.removeFromParent();plane.material.dispose();plane.geometry.dispose();texture.dispose();}};
  }
  function clearGuitar(){
    guitarRequest?.abort();
    guitarRequest=null;
    guitarSelection=null;
    guitarProblem=null;
    if(guitarLink)guitarLink.visible=false;
    if(guitar){
      guitar.group.removeFromParent();
      disposeModel(guitar.group);
      guitar=null;
    }
  }
  async function syncGuitar(){
    const edition=model.data.model;
    const section=model.tabs.get('sections')??model.nodes.get('sections')?.tabs?.[0]?.child;
    const anchor=edition?.anchors?.[section];
    const selection=anchor&&JSON.stringify([edition.resource,edition.version,anchor.scene,anchor.part]);
    if(!selection||selection===guitarSelection)return;
    clearGuitar();
    guitarSelection=selection;
    const controller=new AbortController();
    guitarRequest=controller;
    try{
      const review=await readWorktableReview(edition,anchor.scene,{
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),
      });
      if(controller.signal.aborted||signal.aborted)return;
      if(review.id!==anchor.scene||!review.parts.some(part=>part.id===anchor.part))throw Error();
      guitar=makeModel(review,{x:2.03,y:-.43,z:0});
      guitar.group.name='H.B. Guitar';
      guitar.part=guitar.parts.get(anchor.part);
      guitar.section=section;
      const material=guitar.part.material;
      material.emissive.set('#208d79');
      material.emissiveIntensity=.58;
      parent.add(guitar.group);
      showGuitarLink();
      layer?.invalidate();
    }catch{
      if(!controller.signal.aborted&&!signal.aborted){
        guitarProblem='No se pudo abrir la pieza de guitarra.';
        if(latestView)showModel(false);
      }
    }
  }
  const ray=new Raycaster();
  const ndc=new Vector2();
  const rayForPointer=event=>{
    const rect=(focused?stage:world.canvas).getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    ndc.set((event.clientX-rect.left)*2/rect.width-1,1-(event.clientY-rect.top)*2/rect.height);
    ray.setFromCamera(ndc,viewCamera);
    return {ray:ray.ray};
  };
  const bench=!focused&&station.bench&&surface!=='operator'&&surface!=='guitar'?
    mountWorkbenchControls({document,scene:world.scene,bench:station.bench,eye,pointerTarget:stage,rayForPointer,onAction:edit}):null;
  // Proyección consumes HUD gestures in capture. Invalidate first so
  // opening a local option menu redraws even when no A2UI action is sent.
  if(layer)for(const kind of ['pointermove','pointerdown','pointerup','pointercancel','keydown']){
    stage.addEventListener(kind,layer.invalidate,{capture:true,signal});
  }
  const release=bindSpatialHudPointer({element:stage,hud:outbound,rayForPointer});
  outbound.receive({version:'1.0',createSurface:{surfaceId:nativeId,catalogId:spatialHudCatalog.id}});
  function update(view){
    if(signal.aborted)return;
    const benchItems=new Set(bench?workbenchItems(view).map(item=>item.id):[]);
    const components=view.components.filter(component=>!benchItems.has(component.id)).map(({presentation,...component})=>
      component.id==='root'?{...component,children:component.children.filter(id=>!benchItems.has(id))}:component);
    const key=JSON.stringify(components);
    if(key!==viewKey){
      viewKey=key;
      outbound.receive({version:'1.0',updateComponents:{surfaceId:nativeId,components}},{allowOrphanComponents:true});
    }
    outbound.receive({version:'1.0',updateDataModel:{surfaceId:nativeId,path:'/',value:view.data}});
    outbound.update();
    bench?.update(view);
    showGuitarLink();
    layer?.invalidate();
  }
  function status(label,buttons=[]){
    latestView=false;
    if(surface==='guitar')clearGuitar();
    preview?.clear();
    const components=[{id:'title',component:'HudText',label:title,style:'title'},
      {id:'notice',component:'HudText',label,lines:3},...buttons];
    update({data:{},components:[{id:'root',component:'HudPanel',width:2.65,children:components.map(row=>row.id)},...components]});
  }
  function retry(label){
    status(label,[{id:'retry',component:'HudButton',label:'Reintentar',action:nativeAction('retryStation')}]);
  }
  function choosePresetFile(){
    const session=model.data.sessionId,host=selected;
    if(!/^[a-f0-9]{32}$/.test(session??''))return;
    const picker=document.createElement('input');
    picker.type='file';
    picker.accept='application/json,.json';
    picker.addEventListener('change',()=>{
      const file=picker.files?.[0];
      if(!file||signal.aborted||!latestView||host!==selected||session!==model.data.sessionId)return;
      if(!file.size||file.size>256*1024){
        presetFile=null;
        lastProblem='Elegí un JSON de hasta 256 KiB.';
      }else{
        presetFile={file,host,session};
        lastProblem='';
      }
      showModel(false);
    },{once:true,signal});
    picker.click();
  }
  async function importPresetFile(){
    if(!presetFile||importingPreset)return;
    const {file,host,session}=presetFile;
    if(host!==selected||session!==model.data.sessionId){
      presetFile=null;
      lastProblem='Cambió la sesión. Volvé a elegir el archivo.';
      showModel(false);
      return;
    }
    importingPreset=true;
    lastProblem='';
    showModel(false);
    try{
      const params=new URLSearchParams({host,session_id:session});
      const response=await fetch(panel+'api/a2ui/weaver/preset-file?'+params,{
        method:'POST',credentials:'same-origin',signal,body:file,
        headers:{'Content-Type':'application/json','X-Lab-CSRF':csrf},
      });
      if(response.status===201){
        presetFile=null;
        lastProblem='Preset nuevo guardado.';
      }else if(response.status===409){
        presetFile=null;
        lastProblem='Cambió la sesión. Volvé a elegir el archivo.';
      }else{
        const details=await response.json().catch(()=>null);
        lastProblem=typeof details?.message==='string'?details.message:'No se pudo confirmar si se guardó el preset. Revisá la lista.';
      }
    }catch{
      if(!signal.aborted)lastProblem='No se pudo confirmar si se guardó el preset. Revisá la lista.';
    }finally{
      importingPreset=false;
      if(!signal.aborted&&latestView)showModel(false);
    }
  }
  async function downloadPreset(edition){
    if(downloadingPreset||typeof edition!=='string')return;
    const match=/^([a-z0-9][a-z0-9_-]{0,79}):([a-f0-9]{64})$/.exec(edition);
    if(!match||!model.nodes.get('preset_choice')?.options?.some(option=>option.value===edition)){
      lastProblem='Cambió el preset guardado. Volvé a elegirlo.';
      showModel(false);
      return;
    }
    downloadingPreset=true;
    lastProblem='';
    showModel(false);
    try{
      const response=await fetch(url('/preset-file/'+match[1]+'/'+match[2]),{credentials:'same-origin',signal});
      if(response.status===409){
        lastProblem='Cambió el preset guardado. Volvé a elegirlo.';
      }else if(response.ok&&response.headers.get('Content-Type')?.startsWith('application/json')){
        const file=await response.blob();
        if(!file.size||file.size>256*1024)throw Error();
        if(signal.aborted)return;
        const object=URL.createObjectURL(file);
        const link=document.createElement('a');
        link.href=object;
        link.download='Weaver-'+match[1]+'.json';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(()=>URL.revokeObjectURL(object),30000);
      }else{
        lastProblem='No se pudo descargar el preset.';
      }
    }catch{
      if(!signal.aborted)lastProblem='No se pudo descargar el preset.';
    }finally{
      downloadingPreset=false;
      if(!signal.aborted&&latestView)showModel(false);
    }
  }
  function showModel(syncModel=true){
    latestView=true;
    const view=model.render(title);
    if(focused&&surface==='guitar')for(const node of view.components){
      if(node.id==='settings'||node.id==='savedSettings')node.lines=2;
    }
    if(surface==='harmocap'){
      const children=view.components[0].children;
      const controls=children.includes('review_prepared_take') ||
        (!model.data.preparedTake?.mp4&&children.includes('export_status'));
      if(controls){
        const buttons=takeFormats.filter(format=>preparedDownloadUrl(
          panel+'api/a2ui/'+surface,query,model.data.preparedTake,format)).map(format=>({
          id:'download_take_'+format,component:'HudButton',label:'Descargar '+format.toUpperCase(),
          action:nativeAction('downloadPreparedTake',{format,take:model.data.preparedTake}),
        }));
        if(buttons.length){
          children.push('take_downloads');
          view.components.push({id:'take_downloads',component:'HudRow',children:buttons.map(button=>button.id)},...buttons);
        }
      }
    }
    if(surface==='weaver'){
      const field=view.components.find(node=>node.id==='preset_choice');
      if(field){
        const edition=view.data[field.value['@path'].slice(1)];
        view.components[0].children.push('download_preset');
        view.components.push({id:'download_preset',component:'HudButton',label:'Descargar preset seleccionado',
          disabled:!edition||downloadingPreset,action:nativeAction('downloadWeaverPreset',{edition})});
      }
      if(field||view.components.some(node=>node.id==='preset_library_title')){
        view.components[0].children.push('preset_file_controls');
        const controls=[{id:'choose_preset_file',component:'HudButton',label:'Elegir JSON de preset',
          disabled:importingPreset,action:nativeAction('chooseWeaverPresetFile')},
        {id:'import_preset_file',component:'HudButton',label:'Guardar preset nuevo',
          disabled:!presetFile||importingPreset,action:nativeAction('importWeaverPresetFile')}];
        view.components.push({id:'preset_file_controls',component:'HudRow',children:controls.map(control=>control.id)},...controls);
        if(presetFile){
          view.components[0].children.push('preset_file_name');
          view.components.push({id:'preset_file_name',component:'HudText',label:presetFile.file.name.slice(0,70)});
        }
      }
    }
    const problem=guitarProblem||(editProblem||lastProblem);
    if(problem){
      view.components[0].children.splice(1,0,'station_error');
      view.components.push({id:'station_error',component:'HudText',label:problem,lines:2});
    }
    update(view);
    if(syncModel&&surface==='guitar')void syncGuitar();
  }
  function openVoiceRoute(route){
    voiceRoute=route;
    latestView=false;
    lastProblem='';
    editProblem='';
    status(route?'Abriendo conexión…':'Abriendo Weaver…');
    connect();
  }

  function query(suffix=''){
    const params=new URLSearchParams({host:selected});
    if(binding)params.set('session',binding);
    if(voiceRoute&&suffix==='/events')params.set('voice_route',voiceRoute);
    return '?'+params;
  }
  function url(suffix=''){return panel+'api/a2ui/'+surface+suffix+query(suffix);}
  async function write(envelope){
    if(!source||!latestView||(surface==='router'&&envelope.action.context.sessionId!==binding))return;
    try{
      const response=await fetch(url('/actions'),{method:'POST',credentials:'same-origin',signal,
        headers:{'Content-Type':'application/json','X-Lab-CSRF':csrf},body:JSON.stringify(envelope)});
      await response.body?.cancel().catch(()=>{});
      // The ordered instrument stream owns readback. A late action receipt
      // must not replace state this visit already received from another view.
      if(surface==='weaver'&&response.ok&&envelope.action.name==='removeVoiceRouteTerm'){
        const route=envelope.action.context.routeId;
        if(typeof route==='string'&&voiceRoute===route+'.'+envelope.action.context.index)openVoiceRoute(route);
      }
      if(surface==='operator'){
        lastProblem=response.ok?(envelope.action.name==='saveProfile'?'Configuración guardada.':'Inicio solicitado.'):
          response.status===409?'Cambió el estado del equipo. Revisalo antes de continuar.':'No se pudo confirmar la operación.';
      }else if(response.status===503&&envelope.action.name==='controlSpatializerRecord'){
        lastProblem=envelope.action.context.operation==='stop'
          ?'Spatializer todavía no confirmó el cierre de la toma.'
          :'Spatializer todavía no confirmó el inicio de la toma.';
      }else{
        lastProblem=response.status===409?'Cambió el instrumento. Revisá los controles y volvé a intentar.':
          response.ok?'':'No se pudo confirmar el cambio.';
      }
    }catch{
      if(!signal.aborted)lastProblem='No se pudo confirmar el cambio.';
    }
    if(!signal.aborted&&latestView)showModel();
  }
  function connect(){
    stream?.close();
    source=null;
    const opening=new EventSource(url('/events'));
    stream=opening;
    const timeout=setTimeout(()=>{
      if(stream!==opening||source||signal.aborted)return;
      opening.close();
      stream=null;
      retry('No llegaron los controles del instrumento. Reintentá.');
    },18000);
    signal.addEventListener('abort',()=>clearTimeout(timeout),{once:true});
    opening.onerror=()=>{
      if(stream!==opening||signal.aborted)return;
      clearTimeout(timeout);
      opening.close();
      stream=null;
      source=null;
      retry('Se perdió la conexión con el instrumento.');
    };
    opening.onmessage=event=>{
      if(signal.aborted||stream!==opening)return;
      try{
        const messages=JSON.parse(event.data);
        if(!Array.isArray(messages)||!messages.length)throw Error();
        if(messages[0]?.createSurface?.surfaceId===surface){
          clearTimeout(timeout);
          source=true;
        }
        if(!source)return;
        model.receive(messages);
        preview?.receive(messages);
        showModel();
      }catch{
        clearTimeout(timeout);
        opening.close();
        stream=null;
        source=null;
        retry('No se pudo leer el estado del instrumento.');
      }
    };
  }
  async function refresh(){
    clearTimeout(timer);
    if(signal.aborted||refreshing)return;
    refreshing=true;
    try{
      const summary=await readStatus(AbortSignal.any([signal,AbortSignal.timeout(18000)]));
      if(signal.aborted)return;
      if(summary?.denied){status('Se necesita acceso a Harmonic Lab.');return;}
      if(!summary?.hosts?.length){retry('No se pudo consultar el laboratorio.');return;}
      if(!selected&&summary.hosts.length===1)selected=summary.hosts[0].id;
      if(!selected){
        status('Elegí la estación que querés usar.',summary.hosts.map((host,i)=>({
          id:'host_'+i,component:'HudButton',label:host.label,action:nativeAction('chooseStation',{host:host.id})})));
        return;
      }
      const host=summary.hosts.find(host=>host.id===selected);
      if(!host?.online){retry('La estación no responde.');return;}
      if(surface==='operator'){
        csrf=summary.csrf;
        if(!csrf){status('Se necesita acceso a Harmonic Lab.');return;}
        status('Consultando al equipo…');
        connect();
        return;
      }
      const service=host.services?.find(service=>service.id===station.service);
      if(!host.projectionSurfaces?.includes(surface)||!service?.installed){
        status('Este instrumento no está disponible en esta estación.');return;
      }
      csrf=summary.csrf;
      if(service.status==='ready'&&service[readFlag[surface]??'projectionReady']&&csrf){
        binding=surface==='router'?service.projectionSession:undefined;
        if(surface==='router'&&!/^[a-f0-9]{16}$/.test(binding??'')){
          retry('No se pudo identificar la sesión de Ruteos.');return;
        }
        status('Conectando con el instrumento…');
        connect();
        return;
      }
      if(!service.enabled){status('El instrumento está desactivado en esta estación.');return;}
      const failure=startFailure(host.job,service.id);
      if(pendingPhases.has(host.job?.phase)){
        status(host.job.services?.includes(service.id)?'Preparando el instrumento…':'La estación está preparando otro instrumento.');
      }else if(failure&&!explicit){
        retry(failure);return;
      }else if(!attempted.has(selected)&&(service.status==='stopped'||surface==='spatializer')&&csrf){
        explicit=false;
        attempted.add(selected);
        status('Preparando el instrumento…');
        const id=crypto.randomUUID();
        try{
          const response=await fetch(panel+'api/start',{method:'POST',credentials:'same-origin',
            signal:AbortSignal.any([signal,AbortSignal.timeout(18000)]),
            headers:{'Content-Type':'application/json','X-Lab-CSRF':csrf},
            body:JSON.stringify({host:selected,service:service.id,id,
              ...(surface==='spatializer'?{projection:surface}:{})})});
          if(response.status===401||response.status===403){status('Se necesita acceso a Harmonic Lab.');return;}
        }catch{
          if(signal.aborted)return;
          // A missing receipt can hide an accepted start. Observe the station before showing retry.
        }
      }else{
        retry('Los controles del instrumento todavía no están disponibles.');return;
      }
      timer=setTimeout(refresh,1800);
    }catch{
      if(!signal.aborted)retry('No se pudo confirmar el estado de la estación.');
    }finally{
      refreshing=false;
    }
  }
  let explicit=false;
  status('Consultando al laboratorio…');
  void refresh();
  return {
    draw,
    focus(){stage.tabIndex=-1;stage.focus({preventScroll:true});},
    contains(event){
      return event.composedPath().includes(stage)||outbound.ownsAccessibleInput(event.target)||outbound.ownsTextInput(event.target)||bench?.owns(event.target);
    },
    key(event){
      if(outbound.ownsTextInput(event.target))return true;
      if(event.key==='Escape')return false;
      if(bench?.owns(event.target))return true;
      if(outbound.handleKey(event,{surfaceId:nativeId}))event.preventDefault();
      return true;
    },
    dispose(){
      controller.abort();
      clearTimeout(timer);
      stream?.close();
      release();
      bench?.dispose();
      clearGuitar();
      if(guitarLink){
        guitarLink.geometry.dispose();
        guitarLink.material.dispose();
      }
      preview?.dispose();
      outbound.dispose();
      layer?.dispose();
      parent.removeFromParent();
    },
  };
}
