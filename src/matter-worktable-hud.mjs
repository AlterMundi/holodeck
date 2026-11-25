import {hudAppearanceKey,readHudAppearance} from './hud-appearance.mjs';
import {PassageHud} from './passage-hud.mjs';
import {HudLookPreview} from './hud-look-preview.mjs';
import {Matrix4,OrthographicCamera,PerspectiveCamera,Raycaster,Scene,Vector2,Vector3} from 'three';
import {WorldMapHud,worldMapId,worldBearingId} from './world-map-hud.mjs';
import {DoorPromptHud,compactDoorPromptWidth,doorPromptId,doorPromptWidth} from './door-prompt-hud.mjs';
import {CollectionHud,collectionHudId,collectionHudWidth} from './collection-hud.mjs';
import {WorldStatusHud,worldHeaderId,worldNoticeId,worldHeaderWidth} from './world-status-hud.mjs';
import {RecoveryHud,recoveryHudId} from './recovery-hud.mjs';
import {CreationHud,creationHudId} from './creation-hud.mjs';
import {BeaconHud,beaconStationId,beaconViewerId,beaconStationWidth,beaconViewerWidth} from './beacon-hud.mjs';
import {SettingsHud,settingsId} from './settings-hud.mjs';
import {HudRenderLayer} from './hud-render-layer.mjs';
import {WorldActivityHud,activityHudId,activityHudWidth} from './world-activity-hud.mjs';
import {VisitHud,exhibitionHudId,visitHudId,exhibitionHudWidth,visitHudWidth} from './visit-hud.mjs';
import {SpatialHudWindows} from './spatial-hud-windows.mjs';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';

const surfaceId='matter-worktable',toolbeltId='world-toolbelt';
const cockpitDocks={
  toolPlacement:{x:-.26,y:0,depth:1.08,anchor:0},
  headerPlacement:{x:0,y:.22,depth:1.32,anchor:-1},
};
const movementStick='world-move',movementJump='world-jump',movementDown='world-descend',conversationMovementScale=152;
const floatingWindows=new Map([[worldMapId,true],[surfaceId,true],[collectionHudId,false],[settingsId,false]]);
const groundMovement=[
  [movementStick,'Moverse','HudStick',.68,0],
  [movementJump,'Saltar','HudJump',.56,0],
];
const verticalMovement=[
  groundMovement[0],
  [movementJump,'Subir','HudJump',.56,1],
  [movementDown,'Bajar','HudJump',.56,-1],
];
const movementPanels=vertical=>vertical?verticalMovement:groundMovement;
const path=name=>({'@path':'/'+name});
const action=(name,context={})=>({event:{name,context:{scope:path('scope'),...context}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const row=(id,children,fields={})=>({id,component:'HudRow',children,...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const choice=(id,label,options,value)=>({id,component:'HudChoice',label,
  options:path(options),value:path(value),draft:path(id+'Draft'),action:action(id,{value:path(id+'Draft')})});
const toolScale=286,toolGap=.035,toolRowHeight=.18,toolPadding=.12;
const toolNames=['map','open','talk','appearance','video','bridge','plant','undo','activity','visit','endVisit'];
const toolPixels={map:130,open:154,talk:134,appearance:138,video:96,bridge:153,plant:100,undo:92,activity:126,visit:124,endVisit:140};

function opticalRole(surface,id,component){
  if(surface===worldMapId||surface===worldBearingId||id==='map')return 'navigation';
  if(['talk','open','share','discuss'].includes(id))return 'primary';
  if(surface===toolbeltId||component==='HudRange'||component==='HudChoice')return 'utility';
}
const toolIcons={map:'map',talk:'conversation',appearance:'appearance',video:'video',activity:'activity'};
const compactToolPixels={map:110,talk:116,appearance:122,video:82,activity:110};
function pixelsForTool(id,{compact,iconOnly}){
  if(iconOnly&&Object.hasOwn(toolIcons,id))return 48;
  return compact?(compactToolPixels[id]??toolPixels[id]):toolPixels[id];
}

function layoutTools(tools,maxWidth,appearance){
  const gap=toolGap*toolScale;
  const rows=[];
  for(const id of toolNames.filter(name=>tools[name]?.visible)){
    let row=rows.at(-1);
    const pixels=pixelsForTool(id,appearance);
    if(!row||row.width+gap+pixels>maxWidth){
      row={ids:[],width:0};
      rows.push(row);
    }
    row.width+=(row.ids.length?gap:0)+pixels;
    row.ids.push(id);
  }
  const width=Math.min(maxWidth,Math.max(150,...rows.map(item=>item.width)))/toolScale;
  return {width,rows,...appearance,height:rows.length*toolRowHeight+Math.max(0,rows.length-1)*toolGap};
}

function toolComponents(layout){
  const {width,rows}=layout;
  const rowIds=rows.map((_,index)=>'toolRow'+index);
  return [
    {id:'root',component:'HudPanel',label:'Herramientas de Holodeck',width,gap:toolGap,children:rowIds},
    ...rows.flatMap(({ids},index)=>[
      row(rowIds[index],ids,{gap:toolGap}),
      ...ids.map(id=>button(id,path(id+'Label'),{
        disabled:path(id+'Disabled'),...(['map','talk','appearance','video'].includes(id)?{pressed:path(id+'Pressed')}:{}),
        weight:pixelsForTool(id,layout)/66,...(toolIcons[id]?{icon:toolIcons[id]}:{}),
      })),
    ]),
  ];
}
const work=[
  {id:'root',component:'HudPanel',label:'Mesa de trabajo',width:2.20,
    children:['heading','project','sharing','inspection','attention','status']},
  row('heading',['title','close']),
  text('title','Mesa de trabajo',{style:'title'}),button('close',path('closeLabel')),
  choice('project','Proyecto','projects','project'),
  row('sharing',['share','follow','clear']),
  button('share','Compartir',{visible:path('canShare'),disabled:path('busy'),action:action('share',{revision:path('revision'),project:path('project')})}),
  button('follow','Seguir la mesa',{visible:path('canFollow')}),
  button('clear','Despejar',{visible:path('canClear'),disabled:path('busy'),action:action('clear',{revision:path('revision')})}),
  {id:'inspection',component:'HudColumn',visible:path('ready'),children:['scene','part','section','rotation']},
  choice('scene','Escena','scenes','scene'),choice('part','Pieza','parts','part'),
  {id:'section',component:'HudRange',label:'Corte horizontal',min:0,max:100,step:1,
    value:path('section'),draft:path('sectionDraft'),action:action('section',{value:path('sectionDraft')})},
  row('rotation',['left','visibility','right']),
  button('left','Girar izq.'),button('visibility',path('visibility'),{visible:path('hasPart'),weight:1.6}),
  button('right','Girar der.'),
  row('attention',['point','discuss'],{visible:path('ready')}),
  button('point','Señalar esta pieza',{disabled:path('pointDisabled')}),
  button('discuss',path('discuss'),{visible:path('canDiscuss')}),
  text('status',path('status'),{style:'status',lines:2}),
];
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE']);

export class MatterWorktableHud{
  constructor({document,webgl,table,collection,toggleSound,onActive,canEnter=()=>true,onError,readTools,activateTool,navigation,presentMovement,history,visitor,creatorContext,beaconControls,onBeaconOpen}){
    Object.assign(this,{document,webgl,table,onActive,canEnter,readTools,activateTool,presentMovement,movementGroups:new Map(),scope:0,toolScope:0,mode:null,blocked:false});
    this.canvas=webgl.domElement;
    const releaseHudOverrides=()=>{
      this.passage?.fallback(true);
      this.map?.markBearingPresented(false);
      this.door?.presented(false);
      this.collection?.presented(false);
      this.status?.present(true,false);
      this.status?.present(false,false);
      this.recovery?.clear();
      this.creation?.clear();
      this.beacon?.present(false,false);
      this.activity?.present(false,false);
      this.visit?.present({painted:false});
      if(this.hud)this.syncMovement(false);
    };
    this.releaseHudOverrides=releaseHudOverrides;
    this.layer=new HudRenderLayer(webgl,{onLoss:releaseHudOverrides});
    this.passage=new PassageHud({document,layer:this.layer,onError});
    this.events=new AbortController();
    this.canvas.addEventListener('webglcontextlost',releaseHudOverrides,{signal:this.events.signal});
    for(const event of ['pointerdown','pointermove','pointerup','pointercancel','keydown','focusin','focusout','input','click']){
      document.addEventListener(event,this.layer.invalidate,{capture:true,signal:this.events.signal});
    }
    this.scene=new Scene();
    this.cockpit=document.body.dataset.hudLook==='cabina';
    this.fineInput=this.cockpit?document.defaultView.matchMedia('(pointer: fine)'):null;
    this.camera=this.cockpit?new PerspectiveCamera(50,1,.1,12):new OrthographicCamera(-1,1,1,-1,.1,12);
    this.camera.position.z=4;
    this.camera.updateMatrixWorld();
    this.a11y=document.createElement('div');
    this.a11y.addEventListener('keydown',event=>{
      if(this.active||['Enter',' ','Tab'].includes(event.key))event.stopPropagation();
    });
    this.toolInset=document.createElement('div');
    this.toolInset.className='holodeck-tool-inset';
    this.toolInset.setAttribute('aria-hidden','true');
    document.body.append(this.a11y,this.toolInset);
    this.map=new WorldMapHud({...navigation,send:(type,content,id)=>this.send(type,content,id),
      focusBearing:()=>this.hud.focusAccessibleControl(worldBearingId,'dismiss'),
      focusLauncher:()=>this.focusTool('map'),invalidate:this.layer.invalidate});
    const finePointer=this.document.defaultView.matchMedia('(pointer: fine)');
    this.door=new DoorPromptHud({...navigation.door,send:(type,content,id)=>this.send(type,content,id),
      focusControl:name=>this.hud.focusAccessibleControl(doorPromptId,name),
      hasFocus:()=>this.ownsAccessibleInput(this.document.activeElement)&&this.hud.currentFocus()?.surfaceId===doorPromptId,
      finePointer:()=>finePointer.matches});
    this.collection=new CollectionHud({owner:collection,send:(type,content,id)=>this.send(type,content,id),
      openViewer:path=>{
        const viewer=this.document.defaultView.open('','_blank');
        if(!viewer)return false;
        try{viewer.opener=null;viewer.location.replace(path);return true;}
        catch{viewer.close();return false;}
      },
      focusLauncher:()=>this.focusTool('map')||this.focusTool('talk'),
      focusControl:name=>this.hud.focusAccessibleControl(collectionHudId,name),
      currentFocus:()=>{
        if(!this.ownsAccessibleInput(this.document.activeElement))return;
        const focus=this.hud.currentFocus();
        if(focus?.surfaceId===collectionHudId)return focus.instanceId;
      }});
    this.status=new WorldStatusHud({document,toggleSound,send:(type,content,id)=>this.send(type,content,id),
      focusSound:()=>this.hud.focusAccessibleControl(worldHeaderId,'sound'),
      focusWorld:()=>this.focusTool('map')||this.focusTool('talk'),
      hasSoundFocus:()=>this.ownsAccessibleInput(this.document.activeElement)&&this.hud.currentFocus()?.surfaceId===worldHeaderId});
    this.recovery=new RecoveryHud({document,send:(type,content,id)=>this.send(type,content,id),
      focus:name=>this.hud.focusAccessibleControl(recoveryHudId,name),invalidate:this.layer.invalidate,
      isFocused:()=>this.ownsAccessibleInput(this.document.activeElement)&&this.hud.currentFocus()?.surfaceId===recoveryHudId});
    this.creation=new CreationHud({document,context:creatorContext,send:(type,content,id)=>this.send(type,content,id),
      focus:name=>this.hud.focusAccessibleControl(creationHudId,name),
      isFocused:()=>this.hud?.ownsAccessibleInput(this.document.activeElement)&&this.hud.currentFocus()?.surfaceId===creationHudId,
      focusWorld:mode=>{
        if(this.recovery.group&&this.hud.focusAccessibleControl(recoveryHudId,'retry'))return;
        if(mode==='creator'&&this.focusTool('plant'))return;
        this.canvas.tabIndex=-1;
        this.canvas.focus({preventScroll:true});
      }});
    this.settings=new SettingsHud({document,send:(type,content,id)=>this.send(type,content,id),
      focusControl:name=>this.hud.focusAccessibleControl(settingsId,name),focusLauncher:name=>this.focusTool(name),
      onSurfaceChange:()=>this.syncSettingsInput()});
    this.activity=new WorldActivityHud({owner:history,send:(type,content,id)=>this.send(type,content,id),
      focus:name=>this.hud.focusAccessibleControl(activityHudId,name)});
    this.visit=new VisitHud({owner:visitor,send:(type,content,id)=>this.send(type,content,id),
      focus:(id,name)=>this.hud.focusAccessibleControl(id,name)});
    this.beacon=new BeaconHud({owner:beaconControls,send:(type,content,id)=>this.send(type,content,id),
      focus:(id,name)=>this.hud.focusAccessibleControl(id,name),
      isFocused:id=>this.hud?.ownsAccessibleInput(this.document.activeElement)&&this.hud.currentFocus()?.surfaceId===id,
      focusWorld:()=>this.focusTool('map')||this.focusTool('talk'),onOpen:onBeaconOpen,
      canOpenNative:()=>Boolean(this.layer.overlay&&!this.layer.lost&&
        this.canvas.clientWidth>=330&&this.canvas.clientHeight>=320)});
    this.lookPreview=new HudLookPreview({document,parent:this.scene,invalidate:this.layer.invalidate});
    this.hud=createSpatialHud({parent:this.scene,document,accessibilityRoot:this.a11y,controlStyle:'optical',controlRole:opticalRole,
      controlIconOnly:(surface,id)=>surface===toolbeltId&&this.toolLayout?.iconOnly===true&&Object.hasOwn(toolIcons,id),
      placeSurface:(group,id)=>{
        if(id===toolbeltId)this.toolGroup=group;
        else if(id===worldMapId)this.map.group=group;
        else if(id===worldBearingId)this.map.bearingGroup=group;
        else if(id===doorPromptId)this.door.group=group;
        else if(id===collectionHudId)this.collection.group=group;
        else if(id===settingsId)this.settings.group=group;
        else if(id===activityHudId)this.activity.group=group;
        else if(id===exhibitionHudId)this.visit.indexGroup=group;
        else if(id===visitHudId)this.visit.viewerGroup=group;
        else if(id===worldHeaderId)this.status.headerGroup=group;
        else if(id===worldNoticeId)this.status.noticeGroup=group;
        else if(id===recoveryHudId)this.recovery.group=group;
        else if(id===creationHudId)this.creation.group=group;
        else if(id===beaconStationId)this.beacon.stationGroup=group;
        else if(id===beaconViewerId)this.beacon.viewerGroup=group;
        else if(id===movementStick||id===movementJump||id===movementDown)this.movementGroups.set(id,group);
        else this.group=group;
      },
      send:({action:requested})=>{
        if(!requested)return;
        if(requested.surfaceId===toolbeltId)this.handleTool(requested);
        else if(requested.surfaceId===worldMapId)this.map.activate(requested);
        else if(requested.surfaceId===worldBearingId)this.map.activateBearing(requested);
        else if(requested.surfaceId===doorPromptId)this.door.activate(requested);
        else if(requested.surfaceId===collectionHudId)this.collection.activate(requested);
        else if(requested.surfaceId===settingsId)this.settings.activate(requested);
        else if(requested.surfaceId===activityHudId)this.activity.activate(requested);
        else if([exhibitionHudId,visitHudId].includes(requested.surfaceId))this.visit.activate(requested);
        else if(requested.surfaceId===worldHeaderId)this.status.activate(requested);
        else if(requested.surfaceId===recoveryHudId)this.recovery.activate(requested);
        else if(requested.surfaceId===creationHudId)this.creation.activate(requested);
        else if([beaconStationId,beaconViewerId].includes(requested.surfaceId))this.beacon.activate(requested);
        else this.handleAction(requested);
      },onTransportError:onError,
    });
    const consumeSettingsPointer=event=>{
      if((!this.settings.group&&!this.activity.owner()?.native&&!this.visit.indexActive&&!this.visit.viewerActive&&!(this.beacon.owner.opened&&this.beacon.owner.native))||(event.type==='pointerdown'&&event.button===0))return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for(const type of ['wheel','pointerdown'])this.canvas.addEventListener(type,consumeSettingsPointer,
      {capture:true,passive:false,signal:this.events.signal});
    this.pointerRay=new Raycaster();
    this.pointerPosition=new Vector2();
    this.windows=new SpatialHudWindows({canvas:this.canvas,scene:this.scene,camera:this.camera,
      hit:event=>{const projection=this.rayForPointer(event);return projection&&this.hud.pointerTarget(projection.ray);},
      invalidate:this.layer.invalidate});
    const lostMovement=()=>this.syncMovement(false);
    const activity={signal:this.events.signal};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)lostMovement();},activity);
    document.defaultView.addEventListener('blur',lostMovement,activity);
    document.defaultView.addEventListener('pagehide',lostMovement,activity);
    this.capturedPointers=new Set();
    this.canvas.addEventListener('gotpointercapture',event=>this.capturedPointers.add(event.pointerId),activity);
    this.canvas.addEventListener('lostpointercapture',event=>this.capturedPointers.delete(event.pointerId),activity);
    this.unbind=bindSpatialHudPointer({element:this.canvas,hud:this.hud,
      rayForPointer:event=>this.rayForPointer(event)});
    table.panel.setAttribute('data-spatial','');
  }

  rayForPointer(event){
    if(this.priorInert!==undefined)return;
    if(!this.visit.indexGroup&&!this.visit.viewerGroup&&!this.activity.group&&!this.toolGroup&&!this.group&&!this.map.group&&!this.map.bearingGroup&&!this.door.group&&!this.collection.group&&!this.settings.group&&!this.status.headerGroup&&!this.recovery.group&&!this.creation.group&&!this.beacon.stationGroup&&!this.beacon.viewerGroup&&!this.movementGroups.size)return;
    const rect=this.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    this.pointerPosition.set((event.clientX-rect.left)*2/rect.width-1,1-(event.clientY-rect.top)*2/rect.height);
    this.pointerRay.setFromCamera(this.pointerPosition,this.camera);
    return {ray:this.pointerRay.ray};
  }

  overControl(event){
    const projection=this.rayForPointer(event);
    return projection&&this.hud.pointerTarget(projection.ray)!==undefined;
  }

  get active(){return this.mode==='work';}

  ownsAccessibleInput(target){return this.hud.ownsAccessibleInput(target);}

  send(type,content,id=surfaceId){
    this.hud.receive({version:'1.0',[type]:{surfaceId:id,...content}});
    this.layer.invalidate();
  }

  setMode(mode){
    if(this.mode===mode)return;
    const leaving=this.active;
    if(leaving)this.send('deleteSurface',{});
    this.mode=mode;
    this.scope++;
    this.signature=null;
    this.group=null;
    if(this.active){
      this.send('createSurface',{catalogId:spatialHudCatalog.id});
      this.send('updateComponents',{components:work});
      this.sync();
    }
    if(leaving!==this.active)this.onActive(this.active);
  }

  enter(){
    if(this.mode!=='enter'||this.blocked||!this.table.available||!this.canEnter())return;
    this.previousFocus=this.document.activeElement;
    this.restoreEntryFocus=this.ownsAccessibleInput(this.previousFocus);
    this.previousFocus?.blur();
    this.setMode('work');
    this.syncToolbelt(this.toolsVisible);
    if(this.restoreEntryFocus)this.hud.focusAccessibleControl(surfaceId,'project');
    else{this.canvas.tabIndex=-1;this.canvas.focus({preventScroll:true});}
  }

  leave(){
    this.setMode(this.table.available&&!this.blocked?'enter':null);
    this.syncToolbelt(this.toolsVisible);
    const focused=this.restoreEntryFocus&&this.mode==='enter'&&this.focusTool('open');
    if(!focused&&this.previousFocus?.isConnected&&this.previousFocus!==this.document.body)
      this.previousFocus.focus({preventScroll:true});
    this.restoreEntryFocus=false;
    this.previousFocus=null;
  }

  handleAction(requested){
    const {name,context}=requested??{};
    if(!this.mode||this.blocked||!this.table.available||context?.scope!==this.scope)return;
    if(!this.active)return;
    const {value,revision,project}=context;
    const table=this.table;
    const local={
      close:()=>this.leave(),
      project:()=>{if(typeof value==='string')table.chooseLocal(value);},
      scene:()=>table.chooseScene(value),part:()=>table.choosePart(value),section:()=>table.setSection(value),
      left:()=>table.turn(-1),right:()=>table.turn(1),visibility:()=>table.toggleVisibility(),
      follow:()=>table.followTable(),share:()=>table.publishSelection(revision,project),
      clear:()=>table.publishSelection(revision,null),point:()=>table.pointSelection(),discuss:()=>table.discussSelection(),
    };
    if(Object.hasOwn(local,name)){this.lookPreview.hit(surfaceId);local[name]();}
  }

  sync(){
    const compact=this.lookPreview.name==='taller'&&this.canvas.clientWidth<470;
    const state={scope:this.scope,closeLabel:compact?'Salir':'Salir de la mesa',...(this.active?this.table.hudState():{})};
    const signature=JSON.stringify(state);
    if(signature===this.signature)return;
    this.signature=signature;
    this.send('updateDataModel',{value:state});
  }

  toolState(){
    const tools=this.readTools(this.active);
    for(const name of ['appearance','video'])tools[name].pressed=this.settings.current===name;
    return {...tools,
      open:{label:'Usar mesa',visible:this.mode==='enter',disabled:false}};
  }

  handleTool({name,context}){
    if(!this.toolGroup||context?.scope!==this.toolScope||!toolNames.includes(name))return;
    const selected=this.toolState()[name];
    if(!selected?.visible||selected.disabled)return;
    this.lookPreview.hit(toolbeltId);
    if(name==='appearance'||name==='video'){
      if(this.active)this.leave();
      this.settings.open(name);
      return;
    }
    this.settings.close(false);
    if(name==='open')this.enter();
    else this.activateTool(name);
  }

  focusTool(name){
    return this.hud.focusAccessibleControl(toolbeltId,name);
  }

  toolInsets(){
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    if(this.insetWidth!==width||this.insetHeight!==height){
      const style=this.document.defaultView.getComputedStyle(this.toolInset);
      this.insets={left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight),top:parseFloat(style.paddingTop),bottom:parseFloat(style.height)};
      this.insetWidth=width;
      this.insetHeight=height;
    }
    return this.insets;
  }

  conversationSideEdge(){
    const panel=this.document.getElementById('conversation-panel');
    return !panel.hidden&&panel.dataset.travelLane==='side'?
      parseFloat(panel.style.getPropertyValue('--conversation-travel-edge')):NaN;
  }

  conversationTravelInsets(){
    const insets=this.toolInsets();
    const movementReady=Boolean(this.toolGroup&&this.toolLayout)&&!this.webgl.getContext().isContextLost();
    const viewport={width:this.canvas.clientWidth,height:this.canvas.clientHeight};
    const dockClearance=this.usesCockpitDocks(viewport)?21:0;
    const dockHeight=this.toolLayout?(this.toolLayout.height+.035)*this.dockScale(this.toolLayout.compact):0;
    return {...insets,movementReady,travelBottom:Math.ceil(insets.bottom+dockClearance+dockHeight+
      .64*conversationMovementScale+26)};
  }

  compactDock(){
    const {clientWidth:width,clientHeight:height}=this.canvas;
    this.dockCompact=width>height&&height<(this.dockCompact?512:496);
    return this.dockCompact;
  }

  dockScale(compact){
    return compact&&this.document.defaultView.navigator.maxTouchPoints===0?248:toolScale;
  }

  syncToolbelt(visible){
    this.toolsVisible=visible;
    if(!visible){
      this.document.body.removeAttribute('data-native-settings-available');
      if(this.toolGroup){
        this.send('deleteSurface',{},toolbeltId);
        this.toolGroup=null;
        this.toolSignature=null;
        this.toolLayoutKey=null;
        this.toolScope++;
      }
      return;
    }
    const tools=this.toolState();
    const {left,right}=this.toolInsets();
    const compact=this.compactDock(),scale=this.dockScale(compact);
    const sideEdge=this.conversationSideEdge();
    const available=Number.isFinite(sideEdge)?sideEdge-left-12:this.canvas.clientWidth-left-right;
    const maxWidth=available*toolScale/scale-toolPadding*toolScale;
    this.document.body.toggleAttribute('data-native-settings-available',maxWidth>=150);
    if(maxWidth<150)return;
    const touch=this.document.defaultView.navigator.maxTouchPoints>0;
    const iconOnly=touch&&(compact||this.canvas.clientWidth<=600||Number.isFinite(sideEdge));
    const layout=layoutTools(tools,Math.min(this.lookPreview.stylesDock?720:670,maxWidth),{compact,iconOnly});
    if(!this.toolGroup)this.send('createSurface',{catalogId:spatialHudCatalog.id},toolbeltId);
    const layoutKey=JSON.stringify(layout);
    if(this.toolLayoutKey!==layoutKey){
      if(this.toolLayoutKey)this.lookPreview.redock(toolbeltId);
      this.toolLayoutKey=layoutKey;
      this.toolLayout=layout;
      this.send('updateComponents',{components:toolComponents(layout)},toolbeltId);
    }
    const value={scope:this.toolScope};
    for(const id of toolNames){
      const item=tools[id];
      value[id+'Disabled']=Boolean(item?.disabled);
      value[id+'Pressed']=item?.pressed??false;
      value[id+'Label']=item?.label??'';
    }
    const signature=JSON.stringify(value);
    if(signature===this.toolSignature)return;
    this.toolSignature=signature;
    this.send('updateDataModel',{value},toolbeltId);
  }

  update(blocked,toolsVisible){
    this.blocked=blocked;
    const available=!blocked&&this.table.available;
    if(!available&&this.active)this.leave();
    else if(!this.active)this.setMode(available?'enter':null);
    if(this.active)this.sync();
    if(!toolsVisible)this.settings.close(false);
    this.settings.sync();
    this.syncToolbelt(toolsVisible);
    const appearance=hudAppearanceKey(this.document);
    if(this.appearance!==appearance){
      this.appearance=appearance;
      const style=readHudAppearance(this.document);
      this.hud.setPalette(style.defaultWorldPalette?undefined:style.palette);
      this.layer.invalidate();
    }
  }

  syncSettingsInput(){
    const scope=this.beacon.viewerGroup?beaconViewerId:this.activity.owner()?.native?activityHudId:this.visit.indexActive?exhibitionHudId:
      this.visit.viewerGroup?visitHudId:this.settings.group?settingsId:null;
    if(scope===this.modalScope)return;
    this.modalScope=scope;
    this.hud.setInteractionScope(scope?{surfaceIds:[scope],blockOutside:true}:undefined);
  }

  updateBearing(visible){
    const {left,right}=this.toolInsets();
    this.map.updateBearing(visible&&this.canvas.clientWidth-left-right>=218);
  }

  syncMovement(visible,lane='',vertical=false){
    if(!visible||this.movementLane!==lane){
      this.movementPresented=false;
      for(const id of this.movementGroups.keys())this.send('deleteSurface',{},id);
      this.movementGroups.clear();
      this.presentMovement(null);
      this.movementLane=lane;
      if(!visible)return;
    }
    if(this.movementVertical!==vertical){
      for(const id of [movementJump,movementDown]){
        if(this.movementGroups.has(id))this.send('deleteSurface',{},id);
        this.movementGroups.delete(id);
      }
      this.movementVertical=vertical;
    }
    for(const [id,label,component,width,axis] of movementPanels(vertical)){
      if(this.movementGroups.has(id))continue;
      this.send('createSurface',{catalogId:spatialHudCatalog.id},id);
      this.send('updateComponents',{components:[
        {id:'root',component:'HudPanel',width,children:['control']},
        {id:'control',component,label,...(axis?{vertical:axis}:{})},
      ]},id);
    }
  }

  settingsKey(event){
    if(this.beacon.viewerPresented)return this.beacon.key(event,this.hud);
    const history=this.activity.owner();
    const visit=this.visit.indexActive||this.visit.viewerActive;
    const surface=history?.native?activityHudId:this.visit.indexActive?exhibitionHudId:visit?visitHudId:settingsId;
    if(event.defaultPrevented)return false;
    if((history?.native||visit)&&!this.ownsAccessibleInput(event.target)&&
      event.target?.closest?.('input,textarea,button,select,[contenteditable]')){
      if(event.key==='Escape'){if(visit)this.visit.close();else history.close();return true;}
      return false;
    }
    if(this.windows.key(surface,event))return true;
    if(event.repeat&&(event.key==='Enter'||event.key===' '))return true;
    if(event.key==='Tab'){
      const active=this.document.activeElement;
      const group=this.ownsAccessibleInput(active)&&active.closest('[role="group"]');
      if(group){
        const controls=Array.from(group.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)'));
        const current=controls.indexOf(active);
        if(surface===visitHudId&&!event.shiftKey&&current===controls.length-1&&!this.visit.owner()?.frame?.inert){
          this.visit.owner()?.frame?.focus();
          return true;
        }
        const next=(current+(event.shiftKey?-1:1)+controls.length)%controls.length;
        controls[next]?.focus({preventScroll:true});
      }else this.hud.focusAccessibleControl(surface,surface===visitHudId?'walk':'close');
      return true;
    }
    const handled=this.hud.handleKey(event,{surfaceId:surface});
    if(event.key==='Escape'){
      if(!handled||!this.hud.currentFocus()){
        if(visit)this.visit.close();else if(history?.native)history.close();else this.settings.close();
      }
      return true;
    }
    if(event.target?.closest?.('input,textarea,select,[contenteditable]'))return false;
    return handled||(!event.altKey&&!event.metaKey&&!event.ctrlKey&&movement.has(event.code));
  }

  key(event){
    const scope=this.hud.currentFocus()?.surfaceId??(this.map.group?worldMapId:this.active?surfaceId:null);
    if(this.windows.key(scope,event))return true;
    if(this.map.group&&event.key==='Escape'&&!event.defaultPrevented){this.map.close();return true;}
    if(this.active&&event.key==='Escape'&&!event.defaultPrevented){this.leave();return true;}
    if(this.creation.isFocused()&&event.key==='Escape'&&!event.defaultPrevented&&this.creation.cancel())return true;
    if(this.ownsAccessibleInput(event.target)){
      return event.repeat&&(event.key==='Enter'||event.key===' ')&&this.hud.currentFocus()?.surfaceId===doorPromptId;
    }
    const modifier=event.altKey||event.metaKey||event.ctrlKey;
    if(!this.active){
      return this.mode==='enter'&&!modifier&&event.key==='Tab'&&!event.shiftKey&&
        (event.target===this.document.body||event.target===this.canvas)&&this.focusTool('open');
    }
    if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','AltLeft','AltRight','ControlLeft','ControlRight','KeyR'].includes(event.code))
      return false;
    return this.hud.handleKey(event,{surfaceId});
  }

  usesCockpitDocks({width,height}){
    return Boolean(this.fineInput?.matches&&width>=900&&height>=540);
  }

  place(group,key,viewport,x,y,scale){
    if(!group||scale<=0)return;
    const resizable=floatingWindows.get(group.name);
    if(resizable!==undefined)({x,y,scale}=this.windows.place(group.name,viewport,this.hud.getSurfaceBounds(group.name),{x,y,scale},resizable));
    const pixelRatio=this.layer.pixelRatio;
    const dock=this.usesCockpitDocks(viewport)?cockpitDocks[key]:null;
    const bounds=dock?this.hud.getSurfaceBounds(group.name):null;
    const compactText=(key==='toolPlacement'&&this.toolLayout?.compact)||
      (key==='doorPlacement'&&this.door.compact);
    const fontSize=compactText?12:15;
    const signature=[viewport.width,viewport.height,x,y,scale,pixelRatio,fontSize,dock?.depth,
      bounds?.left,bounds?.right,bounds?.top,bounds?.bottom].join(':');
    if(this[key]?.group===group&&this[key].signature===signature)return;
    placeHudInViewport(group,this.camera,{...viewport,x,y,pixelsPerUnit:scale,depth:dock?.depth??1});
    if(bounds){
      const cx=dock.anchor===-1?bounds.left:(bounds.left+bounds.right)/2;
      const cy=(bounds.top+bounds.bottom)/2;
      group.matrix.multiply(new Matrix4().makeTranslation(cx,cy,0))
        .multiply(new Matrix4().makeRotationX(dock.x)).multiply(new Matrix4().makeRotationY(dock.y))
        .multiply(new Matrix4().makeTranslation(-cx,-cy,0));
      group.matrixWorldNeedsUpdate=true;
    }
    this.hud.setTextDensity(group.name,{cssPixelsPerUnit:Math.round(scale*(bounds?1.12:1)),pixelRatio,
      fontSize});
    this[key]={group,signature,x,y,scale,tilted:Boolean(bounds)};
    this.layer.invalidate();
  }

  toolBounds(name){
    if(!this.toolGroup||this.toolPlacement?.group!==this.toolGroup)return null;
    const {rows,width}=this.toolLayout;
    const rowIndex=rows.findIndex(({ids})=>ids.includes(name));
    if(rowIndex<0)return null;
    const {ids}=rows[rowIndex],index=ids.indexOf(name);
    const {x,y,scale}=this.toolPlacement;
    const available=width-toolGap*(ids.length-1);
    const total=ids.reduce((sum,id)=>sum+pixelsForTool(id,this.toolLayout),0);
    const widthFor=id=>available*pixelsForTool(id,this.toolLayout)/total;
    const xOffset=ids.slice(0,index).reduce((sum,id)=>sum+widthFor(id)+toolGap,-width/2);
    const viewport=this.canvas.getBoundingClientRect();
    const localTop=-rowIndex*(toolRowHeight+toolGap);
    if(this.toolPlacement.tilted){
      this.toolGroup.updateWorldMatrix(true,false);
      const points=[xOffset,xOffset+widthFor(name)].flatMap(localX=>[localTop,localTop-toolRowHeight].map(localY=>{
        const p=new Vector3(localX,localY,0).applyMatrix4(this.toolGroup.matrixWorld).project(this.camera);
        return [viewport.left+(p.x+1)*viewport.width/2,viewport.top+(1-p.y)*viewport.height/2];
      }));
      const xs=points.map(([px])=>px),ys=points.map(([,py])=>py);
      const left=Math.min(...xs),top=Math.min(...ys);
      return {left,top,width:Math.max(...xs)-left,height:Math.max(...ys)-top};
    }
    return {left:viewport.left+x+xOffset*scale,top:viewport.top+y-localTop*scale,
      width:widthFor(name)*scale,height:toolRowHeight*scale};
  }

  beginPassage(){
    if(this.passage.active)return;
    this.priorInert??=this.a11y.inert;
    this.a11y.inert=true;
    try{
      this.passage.begin();
      this.windows.cancelDrag();
      for(const pointer of this.capturedPointers){
        if(this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);
      }
      this.syncMovement(false);
      if(this.document.pointerLockElement===this.canvas)this.document.exitPointerLock();
    }catch(error){
      this.passage.fallback(true);
      console.error('Could not open passage HUD',error);
    }
  }

  drawPassage(){
    this.beginPassage();
    this.visit.present({painted:false});
    this.passage.draw();
  }

  endPassage(){
    try{this.passage.end();}
    finally{
      if(this.priorInert!==undefined)this.a11y.inert=this.priorInert;
      this.priorInert=undefined;
    }
  }

  draw(additional){
    this.windows.begin();
    this.activity.update();this.visit.update();
    this.beacon.update(!this.active&&!this.map.group&&!this.settings.group&&!this.visit.openViewer&&
      !this.document.querySelector('dialog[open],#conversation-panel:not([hidden]),.room-transition #beacon-station'));
    this.syncSettingsInput();
    const {clientWidth:width,clientHeight:height}=this.canvas;
    const {left,right,top,bottom}=this.toolInsets();
    const recoveryTop=Math.max(top+100,width<700?146:152);
    const recoveryReserve=bottom+Math.max(88,(this.toolLayout?.height??0)*toolScale+20);
    const outside=!this.document.body.classList.contains('inside-house')&&!this.document.body.classList.contains('room-transition');
    const screenClear=!this.webgl.getContext().isContextLost()&&!this.modalScope&&!this.active&&!this.collection.group&&!this.map.group&&
      !this.document.querySelector('dialog[open],#conversation-panel:not([hidden])');
    this.recovery.update({visible:outside&&screenClear,width:width-left-right-36,maxHeight:height-recoveryTop-recoveryReserve});
    const createTop=Math.max(top+99,width<700?145:135);
    const createClear=outside&&!this.modalScope&&!this.active&&!this.map.group&&!this.collection.group&&!this.recovery.group&&
      !this.webgl.getContext().isContextLost()&&!this.document.querySelector(
        'dialog[open],#signal-editor:not([hidden]),#conversation-panel:not([hidden]),#content-visit:not([hidden]):not(.is-walking)');
    this.creation.update({visible:createClear,width:width-left-right-40,maxHeight:height-createTop-recoveryReserve});
    if(!this.visit.indexGroup&&!this.visit.viewerGroup&&!this.activity.group&&!this.toolGroup&&!this.group&&!this.map.group&&!this.map.bearingGroup&&!this.door.group&&!this.collection.group&&!this.settings.group&&!this.status.headerGroup&&!this.status.noticeGroup&&!this.recovery.group&&!this.creation.group&&!this.beacon.stationGroup&&!this.beacon.viewerGroup&&!this.movementGroups.size&&!additional){
      this.releaseHudOverrides();
      this.windows.end();
      this.layer.hide();
      return;
    }
    if(!width||!height){this.releaseHudOverrides();this.windows.end();return;}
    const viewport={width,height};
    if(this.cockpit&&this.camera.aspect!==width/height){
      this.camera.aspect=width/height;
      this.camera.updateProjectionMatrix();
      this.layer.invalidate();
    }
    const taller=this.lookPreview.name==='taller';
    const scale=taller?Math.min(170,(width-left-right-24)/2.46,(height-top-bottom-124)/1.9):
      Math.min(170,(width-24)/2.2,(height-124)/1.9);
    const workRight=taller?right+12+scale*1.23:14+scale*1.10;
    const workTop=(taller?top:0)+(height<520?54:95);
    this.place(this.group,'workPlacement',viewport,width-workRight,workTop,scale);
    if(this.creation.group){
      const {scale,width:panelWidth}=this.creation.placement;
      const center=width<700?(width+left-right)/2:width-right-22-panelWidth*scale/2;
      this.place(this.creation.group,'creationPlacement',viewport,center,createTop,scale);
    }
    if(this.recovery.group){
      const {scale,width:panelWidth}=this.recovery.placement;
      this.place(this.recovery.group,'recoveryPlacement',viewport,left+18+panelWidth*scale/2,recoveryTop,scale);
    }
    if(this.toolGroup){
      const {left,right,bottom}=this.toolInsets();
      const dockClearance=this.usesCockpitDocks(viewport)?21:0;
      const compact=this.toolLayout.compact;
      const lane=this.movementLane;
      const sideEdge=this.conversationSideEdge();
      const dockScale=Number.isFinite(sideEdge)?
        Math.min(this.dockScale(compact),(sideEdge-left-12)/(this.toolLayout.width+toolPadding)):
        this.dockScale(compact);
      const barTop=height-bottom-dockClearance-(this.toolLayout.height+.035)*dockScale;
      const dockWidth=(this.toolLayout.width+toolPadding)*dockScale;
      const promptCompact=this.door.group?this.door.compact:compact;
      const promptWidth=promptCompact?compactDoorPromptWidth:doorPromptWidth;
      const promptScale=Math.min(promptCompact?dockScale:200,(width-left-right)/(promptWidth+toolPadding));
      const promptPlate=(promptWidth+toolPadding)*promptScale;
      const beside=compact&&promptCompact&&this.toolLayout.rows.length===1&&
        dockWidth+promptPlate+8<=width-left-right;
      let barCenter=Number.isFinite(sideEdge)?(left+sideEdge)/2:
        beside?width-right-dockWidth/2:(width+left-right)/2;
      if(lane!=='side'&&this.lookPreview.stylesDock&&additional&&width>=720&&!additional.panel.hidden){
        const display=additional.panel.getBoundingClientRect(), canvasLeft=this.canvas.getBoundingClientRect().left;
        const half=dockWidth/2;
        if(display.bottom>barTop&&display.top<height-bottom){
          const start=display.left-canvasLeft, end=display.right-canvasLeft;
          if(barCenter+half>start&&barCenter-half<end){
            if(start-left>=half*2+18)barCenter=(left+start-12)/2;
            else if(width-right-end>=half*2+18)barCenter=(end+12+width-right)/2;
          }
        }
      }
      this.place(this.toolGroup,'toolPlacement',viewport,barCenter,barTop,dockScale);
      const preferredScale=lane?conversationMovementScale:width<380?145:166;
      let movementScale=this.movementVertical?Math.min(preferredScale,Math.max(95,(barTop-48)/1.23)):preferredScale;
      let movementTop=Math.max(34,barTop-(this.movementVertical?1.23:.64)*movementScale-14);
      if(this.movementGroups.size){
        let jumpCenter=lane==='side'?left+180:width-right-.34*movementScale;
        let downCenter=jumpCenter;
        let lower=this.movementVertical?.57*movementScale:0;
        const work=this.active&&this.movementVertical?this.windows.geometry.get(surfaceId)?.rect:null;
        if(work&&work.bottom+8>movementTop&&work.top<barTop&&
          work.right>jumpCenter-.34*movementScale&&work.left<jumpCenter+.34*movementScale){
          if(work.left>=left+1.64*movementScale+8){
            jumpCenter=downCenter=left+1.22*movementScale;
          }else{
            // Keep both vertical targets below the worktable sheet on a narrow screen.
            movementScale=Math.min(movementScale,(width-left-right)/2.2);
            movementTop=Math.max(34,barTop-.64*movementScale-14);
            lower=0;
            downCenter=width-right-.34*movementScale;
            jumpCenter=downCenter-.70*movementScale;
          }
        }
        this.place(this.movementGroups.get(movementStick),'stickPlacement',viewport,left+.40*movementScale,movementTop+lower,movementScale);
        this.place(this.movementGroups.get(movementJump),'jumpPlacement',viewport,jumpCenter,
          movementTop+.07*movementScale,movementScale);
        if(this.movementVertical)this.place(this.movementGroups.get(movementDown),'descendPlacement',viewport,downCenter,
          movementTop+.07*movementScale+lower,movementScale);
      }
      let promptTop=barTop;
      if(this.door.group){
        const besideFinal=beside&&barCenter-dockWidth/2+.01>=left+promptPlate+8;
        const hasTouch=this.document.defaultView.navigator.maxTouchPoints>0;
        const idleGap=promptCompact
          ? (hasTouch ? 138 : .24*promptScale+8)
          : (this.door.finePointer() ? 52 : 138);
        const promptGap=this.movementGroups.size
          ? barTop-movementTop+(promptCompact ? .21*promptScale+9 : 51)
          : idleGap;
        const promptCenter=promptCompact?left+promptPlate/2:(width+left-right)/2;
        promptTop=besideFinal?barTop:Math.max(36,barTop-promptGap);
        this.place(this.door.group,'doorPlacement',viewport,promptCenter,promptTop,promptScale);
      }
      const noticeTop=this.movementGroups.size?Math.min(promptTop,movementTop):promptTop;
      const noticeOffset=Math.ceil(height-noticeTop+12)+'px';
      if(noticeOffset!==this.noticeOffset){
        this.noticeOffset=noticeOffset;
        this.document.body.style.setProperty('--holodeck-notice-bottom',noticeOffset);
      }
    }
    if(this.status.headerGroup){
      const {left,right,top}=this.toolInsets();
      const margin=this.usesCockpitDocks(viewport)?16:0;
      const work=this.active&&height<520?this.windows.geometry.get(surfaceId)?.rect:null;
      const roomWidth=work?.left>left+200?work.left-left-margin-12:width-left-right;
      const headerScale=Math.min(152,roomWidth/(worldHeaderWidth+.12));
      this.place(this.status.headerGroup,'headerPlacement',viewport,left+margin+headerScale*(worldHeaderWidth+.06)/2,
        Math.max(top,width<700?18:24)+margin,headerScale);
    }
    if(this.status.noticeGroup){
      const {left,right}=this.toolInsets();
      const {lines,scale}=this.status.noticeLayout;
      const bottom=Number.parseFloat(this.noticeOffset)||100;
      this.place(this.status.noticeGroup,'noticePlacement',viewport,(width+left-right)/2,height-bottom-(.07+.188*lines.length)*scale,scale);
    }
    if(this.map.group){
      const {left,right}=this.toolInsets();
      const top=width<700&&height>=610?132:76;
      const scale=Math.min(250,(width-left-right)/1.28,Math.max(30,height-top-69)/1.82);
      this.place(this.map.group,'mapPlacement',viewport,width-right-scale*.64,top,scale);
    }
    if(this.map.bearingGroup){
      const {left,right}=this.toolInsets();
      const scale=Math.min(170,(width-left-right)/2.12);
      this.place(this.map.bearingGroup,'bearingPlacement',viewport,width-right-scale*1.06,width<700?116:74,scale);
    }
    if(this.collection.group){
      const {left,right,bottom}=this.toolInsets();
      const top=height<510?105:width<620?166:137;
      const reserve=bottom+(this.toolLayout?.height??0)*toolScale+60;
      const scale=Math.min(185,(width-left-right)/(collectionHudWidth+.12),Math.max(70,height-top-reserve)/1.42);
      this.place(this.collection.group,'collectionPlacement',viewport,left+scale*(collectionHudWidth+.06)/2,top,scale);
    }
    if(this.settings.group){
      const {left,right,bottom}=this.toolInsets();
      const top=height<500?54:width<700?128:92;
      const reserved=(this.toolLayout?.height??0)*toolScale+bottom+15;
      const scale=Math.min(178,(width-left-right)/2.25,Math.max(70,height-top-reserved)/2.0);
      this.place(this.settings.group,'settingsPlacement',viewport,(width+left-right)/2,top,scale);
    }
    if(this.activity.group){
      const activityScale=Math.min(176,(width-24)/activityHudWidth,(height-24)/2.47);
      if(activityScale<92){
        this.activity.present(false,false);
        this.activity.update();this.syncSettingsInput();
      }else{
        this.place(this.activity.group,'activityPlacement',viewport,width/2,
          Math.max(12,(height-2.34*activityScale)/2),activityScale);
      }
    }
    if(this.visit.indexGroup){
      const indexScale=Math.min(185,(width-24)/exhibitionHudWidth,(height-24)/1.62);
      if(indexScale<92){
        this.visit.present({painted:false});
        this.visit.update();this.syncSettingsInput();
      }else this.place(this.visit.indexGroup,'exhibitPlacement',viewport,width/2,
        Math.max(12,(height-1.48*indexScale)/2),indexScale);
    }
    if(this.visit.viewerGroup){
      const panel=this.visit.owner().panel,rect=panel.getBoundingClientRect(),canvas=this.canvas.getBoundingClientRect();
      const viewerScale=Math.min(185,(rect.width-16)/visitHudWidth);
      if(viewerScale>=92&&rect.height>=220){
        this.place(this.visit.viewerGroup,'visitPlacement',viewport,rect.left-canvas.left+rect.width/2,rect.top-canvas.top+5,viewerScale);
        const bounds=this.hud.getSurfaceBounds(visitHudId);
        const reserve=Math.ceil(viewerScale*((bounds?.top??0)-(bounds?.bottom??-.5))+12)+'px';
        if(panel.style.getPropertyValue('--visit-hud-reserve')!==reserve)panel.style.setProperty('--visit-hud-reserve',reserve);
      }else this.visit.present({painted:false});
    }
    if(this.beacon.stationGroup){
      const scale=Math.min(164,(width-left-right-36)/(beaconStationWidth+.12));
      this.place(this.beacon.stationGroup,'beaconStationPlacement',viewport,width-right-18-beaconStationWidth*scale/2,
        top+(width<700?200:139),scale);
    }
    let beaconViewerPlaced=false;
    if(this.beacon.viewerGroup&&this.layer.overlay&&!this.layer.lost){
      const panel=this.beacon.owner.panel;
      const rect=panel.getBoundingClientRect(),canvas=this.canvas.getBoundingClientRect();
      const scale=Math.min(170,(rect.width-22)/(beaconViewerWidth+.12));
      if(scale>=101&&rect.height>=245){
        this.place(this.beacon.viewerGroup,'beaconViewerPlacement',viewport,rect.left-canvas.left+rect.width/2,
          rect.top-canvas.top+12,scale);
        if(!this.hud.getSurfaceBounds(beaconViewerId))this.hud.update();
        const bounds=this.hud.getSurfaceBounds(beaconViewerId);
        if(bounds){
          panel.style.setProperty('--beacon-hud-reserve',Math.ceil((bounds.top-bounds.bottom)*scale+16)+'px');
          beaconViewerPlaced=true;
        }
      }
    }
    this.hud.update();
    this.windows.end();
    this.lookPreview.draw(worldHeaderId,this.status.headerGroup,this.hud.getSurfaceBounds(worldHeaderId));
    if(this.cockpit||!this.lookPreview.name||this.document.body.dataset.hudTheme==='light')this.lookPreview.draw(worldMapId,this.map.group,this.hud.getSurfaceBounds(worldMapId));
    this.lookPreview.draw(toolbeltId,this.toolGroup,this.hud.getSurfaceBounds(toolbeltId));
    this.lookPreview.draw(surfaceId,this.group,this.hud.getSurfaceBounds(surfaceId));
    if(!this.lookPreview.name||this.document.body.dataset.hudTheme==='light')this.lookPreview.draw(settingsId,this.settings.group,this.hud.getSurfaceBounds(settingsId));
    this.map.decoration();
    if(this.map.group)this.map.panel.dataset.nativeMap='';
    if(Boolean(additional)!==this.composingAdditional){
      this.composingAdditional=Boolean(additional);
      this.layer.invalidate();
    }
    let painted=false;
    try{painted=this.layer.draw(this.scene,this.camera,additional);}
    finally{
      this.map.markBearingPresented(Boolean(painted&&this.map.bearingGroup&&this.hud.getSurfaceBounds(worldBearingId)));
      this.door.presented(Boolean(painted&&this.door.group&&this.toolGroup&&this.hud.getSurfaceBounds(doorPromptId)));
      this.collection.presented(Boolean(painted&&this.collection.group&&this.hud.getSurfaceBounds(collectionHudId)));
      this.status.present(true,Boolean(painted&&this.status.headerGroup&&this.hud.getSurfaceBounds(worldHeaderId)));
      this.status.present(false,Boolean(painted&&this.status.noticeGroup&&this.hud.getSurfaceBounds(worldNoticeId)));
      this.recovery.present(Boolean(painted&&this.recovery.group&&this.hud.getSurfaceBounds(recoveryHudId)));
      this.creation.present(Boolean(painted&&this.creation.group&&this.hud.getSurfaceBounds(creationHudId)));
      this.beacon.present(Boolean(painted&&this.beacon.stationGroup&&this.hud.getSurfaceBounds(beaconStationId)),
        Boolean(painted&&beaconViewerPlaced));
      this.activity.present(painted,Boolean(!this.activity.owner()?.opened&&this.toolGroup&&
        this.toolLayout?.rows.some(row=>row.ids.includes('activity'))));
      this.visit.present({painted,index:Boolean(this.visit.indexGroup&&this.hud.getSurfaceBounds(exhibitionHudId)),launcher:this.visit.indexActive||Boolean(this.toolGroup&&this.toolLayout?.rows.some(row=>
        row.ids.includes('visit')||row.ids.includes('endVisit'))),
        viewer:Boolean(this.visit.viewerGroup&&this.visitPlacement?.group===this.visit.viewerGroup&&this.hud.getSurfaceBounds(visitHudId))});
      const controlsReady=movementPanels(this.movementVertical).every(([id])=>
        this.movementGroups.has(id)&&this.hud.getSurfaceBounds(id));
      if(painted&&controlsReady){
        this.movementPresented=true;
        this.presentMovement(this.hud.locomotionInput);
      }else if(this.movementGroups.size&&this.movementPresented){
        this.syncMovement(false);
      }
    }
    if(this.toolGroup)this.document.body.dataset.a2uiToolbelt='';
  }

  dispose(){
    if(this.active)this.onActive(false);
    this.unbind();
    this.windows.dispose();
    this.events.abort();
    this.passage.dispose();
    this.layer.dispose();
    this.map.dispose();
    this.door.update(false);
    this.collection.reset();
    this.status.dispose();
    this.recovery.clear();
    this.creation.clear(false);
    this.beacon.dispose();
    this.syncMovement(false);
    this.settings.close(false);
    this.activity.present(false,false);
    this.visit.present({painted:false});
    this.lookPreview.dispose();
    this.hud.dispose();
    this.a11y.remove();
    this.toolInset.remove();
    delete this.document.body.dataset.a2uiToolbelt;
    this.document.body.removeAttribute('data-native-settings-available');
    this.document.body.style.removeProperty('--holodeck-notice-bottom');
    this.table.panel.removeAttribute('data-spatial');
  }
}
