import {OrthographicCamera,Raycaster,Scene,Vector2} from 'three';
import {HudRenderLayer} from './hud-render-layer.mjs';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';

const surfaceId='matter-worktable';
const path=name=>({'@path':'/'+name});
const action=(name,context={})=>({event:{name,context:{scope:path('scope'),...context}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const row=(id,children,fields={})=>({id,component:'HudRow',children,...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const choice=(id,label,options,value)=>({id,component:'HudChoice',label,
  options:path(options),value:path(value),draft:path(id+'Draft'),action:action(id,{value:path(id+'Draft')})});
const enter=[{id:'root',component:'HudPanel',label:'Mesa de trabajo',width:1.30,children:['open']},
  button('open','Usar mesa de trabajo')];
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
  constructor({document,webgl,table,onActive,onError}){
    Object.assign(this,{document,webgl,table,onActive,scope:0,mode:null,blocked:false});
    this.canvas=webgl.domElement;
    this.layer=new HudRenderLayer(webgl);
    this.events=new AbortController();
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
    document.body.append(this.a11y);
    this.hud=createSpatialHud({parent:this.scene,document,accessibilityRoot:this.a11y,
      placeSurface:group=>{this.group=group;},
      send:({action:requested})=>this.handleAction(requested),onTransportError:onError,
    });
    const ray=new Raycaster(),point=new Vector2();
    this.unbind=bindSpatialHudPointer({element:this.canvas,hud:this.hud,rayForPointer:event=>{
      if(!this.mode||this.blocked||!this.table.available)return;
      const rect=this.canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      point.set((event.clientX-rect.left)*2/rect.width-1,1-(event.clientY-rect.top)*2/rect.height);
      ray.setFromCamera(point,this.camera);
      return {ray:ray.ray};
    }});
    table.panel.setAttribute('data-spatial','');
  }

  get active(){return this.mode==='work';}

  ownsAccessibleInput(target){return this.hud.ownsAccessibleInput(target);}

  send(type,content){
    this.hud.receive({version:'1.0',[type]:{surfaceId,...content}});
    this.layer.invalidate();
  }

  setMode(mode){
    if(this.mode===mode)return;
    const leaving=this.active;
    if(this.mode)this.send('deleteSurface',{});
    this.mode=mode;
    this.scope++;
    this.signature=null;
    this.group=null;
    if(mode){
      this.send('createSurface',{catalogId:spatialHudCatalog.id});
      this.send('updateComponents',{components:mode==='work'?work:enter});
      this.sync();
    }
    if(leaving!==this.active)this.onActive(this.active);
  }

  enter(){
    if(this.mode!=='enter'||this.blocked||!this.table.available)return;
    this.previousFocus=this.document.activeElement;
    this.restoreEntryFocus=this.ownsAccessibleInput(this.previousFocus);
    this.previousFocus?.blur();
    this.setMode('work');
    this.hud.focusControl(surfaceId,'project');
  }

  leave(){
    this.setMode(this.table.available&&!this.blocked?'enter':null);
    if(this.restoreEntryFocus&&this.mode==='enter')this.hud.focusAccessibleControl(surfaceId,'open');
    else if(this.previousFocus?.isConnected&&this.previousFocus!==this.document.body)
      this.previousFocus.focus({preventScroll:true});
    this.restoreEntryFocus=false;
    this.previousFocus=null;
  }

  handleAction(requested){
    const {name,context}=requested??{};
    if(!this.mode||this.blocked||!this.table.available||context?.scope!==this.scope)return;
    if(name==='open'){this.enter();return;}
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

  update(blocked){
    this.blocked=blocked;
    if(blocked||!this.table.available){
      if(this.active)this.leave();
      else this.setMode(null);
      return;
    }
    if(!this.mode)this.setMode('enter');
    this.sync();
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

  key(event){
    if(!this.mode)return false;
    if(this.active&&event.key==='Escape'&&!event.defaultPrevented){this.leave();return true;}
    if(this.ownsAccessibleInput(event.target))return false;
    const modifier=event.altKey||event.metaKey||event.ctrlKey;
    if(!this.active){
      if(!modifier&&event.key==='Tab'&&(event.target===this.document.body||event.target===this.canvas))
        return this.hud.focusAccessibleControl(surfaceId,'open');
      return false;
    }
    return this.hud.handleKey(event,{surfaceId})||(!modifier&&movement.has(event.code));
  }

  draw(){
    if(!this.mode||!this.group){this.layer.hide();return;}
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    if(!width||!height)return;
    const active=this.active;
    const scale=active?Math.min(170,(width-24)/2.2,(height-124)/1.9):Math.min(165,(width-24)/1.4);
    if(scale<=0)return;
    const x=active?width-14-scale*1.10:width/2;
    const dock=this.document.querySelector('#dock')?.getBoundingClientRect();
    const dockTop=dock?.height?dock.top-this.canvas.getBoundingClientRect().top:height;
    const touch=this.document.defaultView.matchMedia('(pointer: coarse)').matches;
    // Reserve the input band until the joystick and the dock share the toolbelt layout.
    const y=active?(height<520?54:95):Math.max(12,Math.min(height-(touch?258:104),dockTop-56));
    const size=[width,height,x,y,scale].join(':');
    if(this.placedGroup!==this.group||this.placedSize!==size){
      placeHudInViewport(this.group,this.camera,{width,height,x,y,pixelsPerUnit:scale,depth:1});
      this.placedGroup=this.group;
      this.placedSize=size;
      this.layer.invalidate();
    }
    this.hud.update();
    this.layer.draw(this.scene,this.camera);
  }

  dispose(){
    if(this.active)this.onActive(false);
    this.unbind();
    this.events.abort();
    this.layer.dispose();
    this.hud.dispose();
    this.a11y.remove();
    this.table.panel.removeAttribute('data-spatial');
  }
}
