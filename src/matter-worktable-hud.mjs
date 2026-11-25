import {OrthographicCamera,Raycaster,Scene,Vector2} from 'three';
import {WorldMapHud,worldMapId,worldBearingId} from './world-map-hud.mjs';
import {DoorPromptHud,doorPromptId,doorPromptWidth} from './door-prompt-hud.mjs';
import {CollectionHud,collectionHudId,collectionHudWidth} from './collection-hud.mjs';
import {SettingsHud,settingsId} from './settings-hud.mjs';
import {HudRenderLayer} from './hud-render-layer.mjs';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';

const surfaceId='matter-worktable',toolbeltId='world-toolbelt';
const path=name=>({'@path':'/'+name});
const action=(name,context={})=>({event:{name,context:{scope:path('scope'),...context}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const row=(id,children,fields={})=>({id,component:'HudRow',children,...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const choice=(id,label,options,value)=>({id,component:'HudChoice',label,
  options:path(options),value:path(value),draft:path(id+'Draft'),action:action(id,{value:path(id+'Draft')})});
const toolScale=286,toolGap=.035,toolRowHeight=.18,toolPadding=.12;
const toolNames=['map','open','talk','appearance','video','bridge','plant','undo'];
const toolPixels={map:90,open:154,talk:96,appearance:98,video:70,bridge:122,plant:88,undo:84};

function layoutTools(tools,maxWidth){
  const gap=toolGap*toolScale;
  const rows=[];
  for(const id of toolNames.filter(name=>tools[name]?.visible)){
    let row=rows.at(-1);
    if(!row||row.width+gap+toolPixels[id]>maxWidth){
      row={ids:[],width:0};
      rows.push(row);
    }
    row.width+=(row.ids.length?gap:0)+toolPixels[id];
    row.ids.push(id);
  }
  const width=Math.min(maxWidth,Math.max(150,...rows.map(item=>item.width)))/toolScale;
  return {width,rows,height:rows.length*toolRowHeight+Math.max(0,rows.length-1)*toolGap};
}

function toolComponents({width,rows}){
  const rowIds=rows.map((_,index)=>'toolRow'+index);
  return [
    {id:'root',component:'HudPanel',label:'Herramientas de Holodeck',width,gap:toolGap,children:rowIds},
    ...rows.flatMap(({ids},index)=>[
      row(rowIds[index],ids,{gap:toolGap}),
      ...ids.map(id=>button(id,path(id+'Label'),{
        disabled:path(id+'Disabled'),...(['map','talk','appearance','video'].includes(id)?{pressed:path(id+'Pressed')}:{}),
        weight:toolPixels[id]/66,
      })),
    ]),
  ];
}
const work=[
  {id:'root',component:'HudPanel',label:'Mesa de trabajo',width:2.20,
    children:['heading','project','sharing','inspection','discuss','status']},
  row('heading',['title','close']),
  text('title','Mesa de trabajo',{style:'title',weight:2}),button('close','Salir de la mesa'),
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
  button('discuss',path('discuss'),{visible:path('canDiscuss')}),
  text('status',path('status'),{style:'status'}),
];
const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE']);

export class MatterWorktableHud{
  constructor({document,webgl,table,collection,onActive,canEnter=()=>true,onError,readTools,activateTool,navigation}){
    Object.assign(this,{document,webgl,table,onActive,canEnter,readTools,activateTool,scope:0,toolScope:0,mode:null,blocked:false});
    this.canvas=webgl.domElement;
    const releaseHudOverrides=()=>{
      this.map?.markBearingPresented(false);
      this.door?.presented(false);
      this.collection?.presented(false);
    };
    this.releaseHudOverrides=releaseHudOverrides;
    this.layer=new HudRenderLayer(webgl,{onLoss:releaseHudOverrides});
    this.events=new AbortController();
    this.canvas.addEventListener('webglcontextlost',releaseHudOverrides,{signal:this.events.signal});
    for(const event of ['pointerdown','pointermove','pointerup','pointercancel','keydown','focusin','focusout','input','click']){
      document.addEventListener(event,this.layer.invalidate,{capture:true,signal:this.events.signal});
    }
    this.scene=new Scene();
    this.camera=new OrthographicCamera(-1,1,1,-1,.1,12);
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
    this.settings=new SettingsHud({document,send:(type,content,id)=>this.send(type,content,id),
      focusControl:name=>this.hud.focusAccessibleControl(settingsId,name),focusLauncher:name=>this.focusTool(name),
      onSurfaceChange:()=>this.syncSettingsInput()});
    this.hud=createSpatialHud({parent:this.scene,document,accessibilityRoot:this.a11y,
      placeSurface:(group,id)=>{
        if(id===toolbeltId)this.toolGroup=group;
        else if(id===worldMapId)this.map.group=group;
        else if(id===worldBearingId)this.map.bearingGroup=group;
        else if(id===doorPromptId)this.door.group=group;
        else if(id===collectionHudId)this.collection.group=group;
        else if(id===settingsId)this.settings.group=group;
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
        else this.handleAction(requested);
      },onTransportError:onError,
    });
    const consumeSettingsPointer=event=>{
      if(!this.settings.group||(event.type==='pointerdown'&&event.button===0))return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for(const type of ['wheel','pointerdown'])this.canvas.addEventListener(type,consumeSettingsPointer,
      {capture:true,passive:false,signal:this.events.signal});
    this.pointerRay=new Raycaster();
    this.pointerPosition=new Vector2();
    this.unbind=bindSpatialHudPointer({element:this.canvas,hud:this.hud,rayForPointer:event=>this.rayForPointer(event)});
    table.panel.setAttribute('data-spatial','');
  }

  rayForPointer(event){
    if(!this.toolGroup&&!this.group&&!this.map.group&&!this.map.bearingGroup&&!this.door.group&&!this.collection.group&&!this.settings.group)return;
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
    this.hud.focusAccessibleControl(surfaceId,'project');
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
      clear:()=>table.publishSelection(revision,null),discuss:()=>table.discussSelection(),
    };
    if(Object.hasOwn(local,name))local[name]();
  }

  sync(){
    const state={scope:this.scope,...(this.active?this.table.hudState():{})};
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
      this.insets={left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight),bottom:parseFloat(style.height)};
      this.insetWidth=width;
      this.insetHeight=height;
    }
    return this.insets;
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
    const maxWidth=this.canvas.clientWidth-left-right-toolPadding*toolScale;
    this.document.body.toggleAttribute('data-native-settings-available',maxWidth>=150);
    if(maxWidth<150)return;
    const layout=layoutTools(tools,Math.min(590,maxWidth));
    if(!this.toolGroup)this.send('createSurface',{catalogId:spatialHudCatalog.id},toolbeltId);
    const layoutKey=JSON.stringify(layout);
    if(this.toolLayoutKey!==layoutKey){
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
    const look=this.document.body.dataset.roomLook;
    if(this.look!==look){
      this.look=look;
      this.layer.invalidate();
      if(!look)this.hud.setPalette();
      else{
        const css=this.document.defaultView.getComputedStyle(this.document.body);
        const color=name=>css.getPropertyValue(name).trim();
        this.hud.setPalette({background:color('--panel'),button:color('--control-fill'),
          pressed:color('--control-hover'),text:color('--ink'),focus:color('--gold')});
      }
    }
  }

  syncSettingsInput(){
    const open=Boolean(this.settings.group);
    if(open===this.settingsInput)return;
    this.settingsInput=open;
    this.hud.setInteractionScope(open?{surfaceIds:[settingsId],blockOutside:true}:undefined);
  }

  updateBearing(visible){
    const {left,right}=this.toolInsets();
    this.map.updateBearing(visible&&this.canvas.clientWidth-left-right>=218);
  }

  settingsKey(event){
    if(event.defaultPrevented)return false;
    if(event.repeat&&(event.key==='Enter'||event.key===' '))return true;
    if(event.key==='Tab'){
      const active=this.document.activeElement;
      const group=this.ownsAccessibleInput(active)&&active.closest('[role="group"]');
      if(group){
        const controls=Array.from(group.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)'));
        const current=controls.indexOf(active);
        const next=(current+(event.shiftKey?-1:1)+controls.length)%controls.length;
        controls[next]?.focus({preventScroll:true});
      }else this.hud.focusAccessibleControl(settingsId,'close');
      return true;
    }
    const handled=this.hud.handleKey(event,{surfaceId:settingsId});
    if(event.key==='Escape'){
      if(!handled||!this.hud.currentFocus())this.settings.close();
      return true;
    }
    if(event.target?.closest?.('input,textarea,select,[contenteditable]'))return false;
    return handled||(!event.altKey&&!event.metaKey&&!event.ctrlKey&&movement.has(event.code));
  }

  key(event){
    if(this.map.group&&event.key==='Escape'&&!event.defaultPrevented){this.map.close();return true;}
    if(this.active&&event.key==='Escape'&&!event.defaultPrevented){this.leave();return true;}
    if(this.ownsAccessibleInput(event.target)){
      return event.repeat&&(event.key==='Enter'||event.key===' ')&&this.hud.currentFocus()?.surfaceId===doorPromptId;
    }
    const modifier=event.altKey||event.metaKey||event.ctrlKey;
    if(!this.active){
      return this.mode==='enter'&&!modifier&&event.key==='Tab'&&!event.shiftKey&&
        (event.target===this.document.body||event.target===this.canvas)&&this.focusTool('open');
    }
    return this.hud.handleKey(event,{surfaceId})||(!modifier&&movement.has(event.code));
  }

  place(group,key,viewport,x,y,scale){
    if(!group||scale<=0)return;
    const pixelRatio=this.layer.pixelRatio;
    const signature=[viewport.width,viewport.height,x,y,scale,pixelRatio].join(':');
    if(this[key]?.group===group&&this[key].signature===signature)return;
    placeHudInViewport(group,this.camera,{...viewport,x,y,pixelsPerUnit:scale,depth:1});
    this.hud.setTextDensity(group.name,{cssPixelsPerUnit:Math.round(scale),pixelRatio,
      fontSize:13});
    this[key]={group,signature,x,y,scale};
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
    const total=ids.reduce((sum,id)=>sum+toolPixels[id],0);
    const widthFor=id=>available*toolPixels[id]/total;
    const xOffset=ids.slice(0,index).reduce((sum,id)=>sum+widthFor(id)+toolGap,-width/2);
    const viewport=this.canvas.getBoundingClientRect();
    return {left:viewport.left+x+xOffset*scale,top:viewport.top+y+rowIndex*(toolRowHeight+toolGap)*scale,
      width:widthFor(name)*scale,height:toolRowHeight*scale};
  }

  draw(additional){
    if(!this.toolGroup&&!this.group&&!this.map.group&&!this.map.bearingGroup&&!this.door.group&&!this.collection.group&&!this.settings.group&&!additional){
      this.releaseHudOverrides();
      this.layer.hide();
      return;
    }
    const {clientWidth:width,clientHeight:height}=this.canvas;
    if(!width||!height){this.releaseHudOverrides();return;}
    const viewport={width,height};
    const scale=Math.min(170,(width-24)/2.2,(height-124)/1.9);
    this.place(this.group,'workPlacement',viewport,width-14-scale*1.10,height<520?54:95,scale);
    if(this.toolGroup){
      const {left,right,bottom}=this.toolInsets();
      const barTop=height-bottom-(this.toolLayout.height+.035)*toolScale;
      this.place(this.toolGroup,'toolPlacement',viewport,(width+left-right)/2,barTop,toolScale);
      const promptGap=this.door.finePointer()?52:138;
      const promptTop=this.door.group?Math.max(36,barTop-promptGap):barTop;
      if(this.door.group){
        const promptScale=Math.min(200,(width-left-right)/(doorPromptWidth+.12));
        this.place(this.door.group,'doorPlacement',viewport,(width+left-right)/2,promptTop,promptScale);
      }
      const noticeOffset=Math.ceil(height-promptTop+12)+'px';
      if(noticeOffset!==this.noticeOffset){
        this.noticeOffset=noticeOffset;
        this.document.body.style.setProperty('--holodeck-notice-bottom',noticeOffset);
      }
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
      const top=height<500?54:92;
      const reserved=(this.toolLayout?.height??0)*toolScale+bottom+15;
      const scale=Math.min(178,(width-left-right)/2.25,Math.max(70,height-top-reserved)/2.0);
      this.place(this.settings.group,'settingsPlacement',viewport,(width+left-right)/2,top,scale);
    }
    this.hud.update();
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
    }
    if(this.toolGroup)this.document.body.dataset.a2uiToolbelt='';
  }

  dispose(){
    if(this.active)this.onActive(false);
    this.unbind();
    this.events.abort();
    this.layer.dispose();
    this.map.dispose();
    this.door.update(false);
    this.collection.reset();
    this.settings.close(false);
    this.hud.dispose();
    this.a11y.remove();
    this.toolInset.remove();
    delete this.document.body.dataset.a2uiToolbelt;
    this.document.body.removeAttribute('data-native-settings-available');
    this.document.body.style.removeProperty('--holodeck-notice-bottom');
    this.table.panel.removeAttribute('data-spatial');
  }
}
