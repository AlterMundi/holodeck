import {Raycaster,Vector2,Vector3} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';

const header='conversation-header',grip='conversation-grip',scale=286;
const depthScale=new Vector3(1,1,1/scale);
const path=name=>({'@path':'/'+name});
const button=(id,label,fields={},context)=>({id,component:'HudButton',label,action:{event:{name:id,...(context?{context}:{})}},...fields});
const label=(id,value,fields={})=>({id,component:'HudText',label:value,...fields});
const row=(id,children)=>({id,component:'HudRow',children});
const panelRoot=(width,children)=>({id:'root',component:'HudPanel',label:'Controles de Conversar',width,gap:.015,children});

export class ConversationChrome{
  constructor({panel,canvas,parent,camera,invalidate,readReferences}){
    Object.assign(this,{panel,canvas,camera,invalidate,readReferences,look:null,groups:new Map()});
    const document=panel.ownerDocument;
    this.elements=Object.fromEntries(['conversation-move','conversation-resize','conversation-close',
      'room-topic','room-topic-choice','history-reference-clear','worktable-reference-clear','conversation-hint']
      .map(id=>[id,panel.querySelector('#'+id)]));
    this.a11y=document.createElement('div');
    panel.prepend(this.a11y);
    this.hud=createSpatialHud({parent,document,accessibilityRoot:this.a11y,
      placeSurface:(group,id)=>this.groups.set(id,group),
      send:({action})=>{if(action)this.activate(action.name,action.context);},
    });
    this.events=new AbortController();
    const options={capture:true,signal:this.events.signal};
    for(const event of ['pointerdown','pointerup','pointercancel','focusin','focusout','keydown'])
      panel.addEventListener(event,invalidate,options);
    canvas.addEventListener('webglcontextlost',()=>{
      this.contextLost=true;
      delete panel.dataset.hudChrome;
      delete panel.dataset.worldDisplay;
    },options);
    canvas.addEventListener('webglcontextrestored',()=>{
      this.contextLost=false;
      invalidate();
    },options);
    const ray=new Raycaster(),cursor=new Vector2();
    this.unbind=bindSpatialHudPointer({element:panel,hud:this.hud,rayForPointer:event=>{
      if(this.contextLost||panel.hidden||panel.dataset.displayMotion==='restore'||event.target.closest?.('#conversation-move,#conversation-resize,input,textarea,select,[contenteditable]'))return;
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      cursor.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
      ray.setFromCamera(cursor,camera);
      return {ray:ray.ray};
    }});
  }

  receive(id,type,body={}){
    this.hud.receive({version:'1.0',[type]:{surfaceId:id,...body}});
    this.invalidate();
  }

  state(){
    const elements=this.elements,select=elements['room-topic-choice'];
    const references=this.readReferences();
    const enabled=Array.from(select.options).filter(option=>!option.disabled);
    const history=references.history&&!elements['history-reference-clear'].hidden?JSON.stringify(references.history):'';
    const worktable=references.worktable&&!elements['worktable-reference-clear'].hidden?JSON.stringify(references.worktable):'';
    return {topics:!elements['room-topic'].hidden&&!select.disabled&&enabled.length>1,
      topic:select.selectedOptions[0]?.textContent??'Este lugar',history,worktable,
      hint:elements['conversation-hint'].hidden?'':elements['conversation-hint'].textContent.trim(),
    };
  }

  activate(name,context){
    if(this.contextLost||this.panel.hidden||this.panel.dataset.displayMotion==='restore')return;
    const elements=this.elements,state=this.state();
    if(name==='minimize')elements['conversation-close'].click();
    const clear=name==='clearWorktable'&&state.worktable&&state.worktable===context?.source?'worktable-reference-clear':
      name==='clearHistory'&&state.history&&state.history===context?.source?'history-reference-clear':null;
    if(clear){
      elements[clear].click();
      if(this.a11y?.contains(this.panel.ownerDocument.activeElement))this.hud.focusAccessibleControl(header,'minimize');
    }
    if(state.topics&&(name==='previous'||name==='next')){
      const select=elements['room-topic-choice'];
      const options=Array.from(select.options).filter(option=>!option.disabled);
      const index=options.indexOf(select.selectedOptions[0]);
      const step=name==='previous'?-1:1;
      const next=index<0?(step===1?0:options.length-1):(index+step+options.length)%options.length;
      select.value=options[next].value;
      select.dispatchEvent(new select.ownerDocument.defaultView.Event('change',{bubbles:true}));
    }
    this.invalidate();
  }

  update(rect,viewport,dpr,look){
    if(this.contextLost||!rect.width||!rect.height)return;
    const state=this.state();
    const {topics,history,worktable,hint}=state;
    const layout=[rect.width,topics,Boolean(history),Boolean(worktable),Boolean(hint)].join(':');
    if(this.layout!==layout){
      this.layout=layout;
      const children=['head'];
      const entries=[row('head',['heading','minimize']),label('heading','Conversar',{weight:1.75}),
        button('minimize','Minimizar')];
      if(topics){
        children.push('topics');
        entries.push(row('topics',['previous','topic','next']),
          button('previous','Atrás',{weight:1}),label('topic',path('topic'),{weight:2}),
          button('next','Otro',{weight:1}));
      }
      if(hint||history||worktable){
        children.push('reference');
        const controls=[];
        if(hint){controls.push('hint');entries.push(label('hint',path('hint'),{weight:2.1}));}
        if(history){
          controls.push('clearHistory');
          entries.push(button('clearHistory','Quitar tema',{weight:1.1},{source:path('history')}));
        }
        if(worktable){
          controls.push('clearWorktable');
          entries.push(button('clearWorktable','Quitar pieza',{weight:1.1},{source:path('worktable')}));
        }
        entries.push(row('reference',controls));
      }
      if(!this.groups.has(header))this.receive(header,'createSurface',{catalogId:spatialHudCatalog.id});
      this.receive(header,'updateComponents',{components:[panelRoot((rect.width-42)/scale,children),...entries]});
      if(!this.groups.has(grip)){
        this.receive(grip,'createSurface',{catalogId:spatialHudCatalog.id});
        this.receive(grip,'updateComponents',{components:[panelRoot(.5,['size']),label('size','Tamaño')]});
      }
      this.panel.style.setProperty('--conversation-header-height',Math.ceil((children.length*.18+(children.length-1)*.015)*scale)+'px');
    }
    const data=JSON.stringify(state);
    if(data!==this.data){
      this.data=data;
      this.receive(header,'updateDataModel',{value:state});
    }
    if(this.look!==look){
      this.look=look;
      const css=this.panel.ownerDocument.defaultView.getComputedStyle(this.panel);
      const value=name=>css.getPropertyValue(name).trim();
      this.hud.setPalette({background:value('--panel'),button:value('--control-fill'),
        pressed:value('--control-hover'),text:value('--ink'),focus:value('--gold')});
      this.invalidate();
    }
    const placement=[rect.left,rect.top,rect.width,rect.height,viewport.width,viewport.height,viewport.left,viewport.top,dpr,layout].join(':');
    if(this.placement!==placement){
      this.placement=placement;
      const within={width:viewport.width,height:viewport.height,pixelsPerUnit:scale,depth:1};
      for(const [id,x,y] of [[header,rect.left+rect.width/2,rect.top+11],
        [grip,rect.right-91,rect.bottom-60]]){
        const group=this.groups.get(id);
        if(!group)continue;
        placeHudInViewport(group,this.camera,{...within,x:x-viewport.left,y:y-viewport.top});
        // This orthographic viewport uses CSS pixels on X/Y. Keep the catalog's
        // mesh thickness in scene units so it stays between the clip planes.
        group.matrix.scale(depthScale);
        group.matrixWorldNeedsUpdate=true;
        this.hud.setTextDensity(id,{cssPixelsPerUnit:scale,pixelRatio:dpr,fontSize:13});
      }
      this.invalidate();
    }
    this.hud.update();
    this.panel.dataset.hudChrome='';
  }

  dispose(){
    this.unbind();
    this.events.abort();
    this.hud.dispose();
    this.a11y.remove();
    delete this.panel.dataset.hudChrome;
    this.panel.style.removeProperty('--conversation-header-height');
  }
}
