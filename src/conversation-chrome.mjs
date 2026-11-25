import {HudLookPreview} from './hud-look-preview.mjs';
import {Group,Mesh,MeshBasicMaterial,PlaneGeometry,Raycaster,Vector2,Vector3} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';

const header='conversation-header',scale=286,sharedScale=200;
const depthScale=new Vector3(1,1,1/scale);
const sharedDepthScale=new Vector3(1,1,1/sharedScale);
const path=name=>({'@path':'/'+name});
const button=(id,label,fields={},context)=>({id,component:'HudButton',label,action:{event:{name:id,...(context?{context}:{})}},...fields});
const label=(id,value,fields={})=>({id,component:'HudText',label:value,...fields});
const row=(id,children)=>({id,component:'HudRow',children});
const panelRoot=(width,children)=>({id:'root',component:'HudPanel',label:'Controles de Conversar',width,gap:.015,children});

function resizeMark(parent){
  const group=new Group();
  group.name='Conversation resize mark';
  const ink=new MeshBasicMaterial({color:0xe6f5f4,toneMapped:false,depthWrite:false,transparent:true});
  const shadow=new MeshBasicMaterial({color:0x092b32,toneMapped:false,depthWrite:false,transparent:true});
  for(const [x,y,length] of [[-4,0,11],[0,-1,7],[3,-2,3]]){
    for(const [material,width,offset] of [[shadow,3,-.4],[ink,1.35,0]]){
      const line=new Mesh(new PlaneGeometry(length,width),material);
      line.rotation.z=Math.PI/4;
      line.position.set(x,y+offset,material===ink?.013:.01);
      line.renderOrder=material===ink?12:11;
      group.add(line);
    }
  }
  parent.add(group);
  return {group,ink,shadow};
}

export class ConversationChrome{
  constructor({panel,canvas,parent,camera,invalidate,readReferences}){
    Object.assign(this,{panel,canvas,camera,invalidate,readReferences,groups:new Map()});
    const document=panel.ownerDocument;
    this.elements=Object.fromEntries(['conversation-move','conversation-resize','conversation-close',
      'room-topic','room-topic-choice','history-reference-clear','worktable-reference-clear','conversation-hint']
      .map(id=>[id,panel.querySelector('#'+id)]));
    this.a11y=document.createElement('div');
    panel.prepend(this.a11y);
    this.lookPreview=new HudLookPreview({document,parent,invalidate});
    this.hud=createSpatialHud({parent,document,accessibilityRoot:this.a11y,controlStyle:'optical',
      placeSurface:(group,id)=>this.groups.set(id,group),
      send:({action})=>{if(action)this.activate(action.name,action.context);},
    });
    this.mark=resizeMark(parent);
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
    const shared=this.panel.classList.contains('shared-conversation');
    return {shared,topics:!shared&&!elements['room-topic'].hidden&&!select.disabled&&enabled.length>1,
      topic:select.selectedOptions[0]?.textContent??'Este lugar',history,worktable,
      hint:elements['conversation-hint'].hidden?'':elements['conversation-hint'].textContent.trim(),
    };
  }

  activate(name,context){
    if(this.contextLost||this.panel.hidden||this.panel.dataset.displayMotion==='restore')return;
    const elements=this.elements,state=this.state();
    this.lookPreview.hit(header);
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

  update(rect,viewport,dpr,appearance,style){
    if(this.contextLost||!rect.width||!rect.height)return;
    const state=this.state();
    const {shared,topics,history,worktable,hint}=state;
    const unit=shared?sharedScale:scale;
    const layout=[rect.width,shared,topics,Boolean(history),Boolean(worktable),Boolean(hint)].join(':');
    if(this.layout!==layout){
      this.layout=layout;
      const children=['head'];
      const entries=[row('head',['heading','minimize']),label('heading','Conversar',{weight:8,style:'title'}),
        button('minimize','Minimizar conversación',{icon:'minimize',weight:.65,quiet:true})];
      if(topics){
        children.push('topics');
        entries.push(row('topics',['previous','topic','next']),
          button('previous','Atrás',{weight:1}),label('topic',path('topic'),{weight:2}),
          button('next','Otro',{weight:1}));
      }
      if(hint||history||worktable){
        children.push('reference');
        const controls=[];
        if(hint){controls.push('hint');entries.push(label('hint',path('hint'),{weight:2.1,lines:2,style:'body'}));}
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
      this.receive(header,'updateComponents',{components:[panelRoot((rect.width-42)/unit,children),...entries]});
      const headerHeight=children.length*.18+(children.length-1)*.015+(hint ? .053 : 0);
      this.panel.style.setProperty('--conversation-header-height',Math.ceil(headerHeight*unit)+'px');
    }
    const data=JSON.stringify(state);
    if(data!==this.data){
      this.data=data;
      this.receive(header,'updateDataModel',{value:state});
    }
    if(this.appearance!==appearance){
      this.appearance=appearance;
      this.hud.setPalette(style.palette);
      this.mark.ink.color.set(style.palette.focus);
      this.invalidate();
    }
    const placement=[rect.left,rect.top,rect.width,rect.height,viewport.width,viewport.height,viewport.left,viewport.top,dpr,layout].join(':');
    if(this.placement!==placement){
      this.placement=placement;
      const within={width:viewport.width,height:viewport.height,pixelsPerUnit:unit,depth:1};
      const group=this.groups.get(header);
      if(group){
        placeHudInViewport(group,this.camera,{...within,x:rect.left+rect.width/2-viewport.left,y:rect.top+11-viewport.top});
        group.matrix.scale(shared?sharedDepthScale:depthScale);
        group.matrixWorldNeedsUpdate=true;
        this.hud.setTextDensity(header,{cssPixelsPerUnit:scale,pixelRatio:dpr,fontSize:15});
      }
      placeHudInViewport(this.mark.group,this.camera,{...within,pixelsPerUnit:1,
        x:rect.right-13-viewport.left,y:rect.bottom-13-viewport.top});
      this.invalidate();
    }
    this.hud.update();
    this.lookPreview.draw(header,this.groups.get(header),this.hud.getSurfaceBounds(header));
    this.panel.dataset.hudChrome='';
  }

  dispose(){
    this.unbind();
    this.events.abort();
    this.lookPreview.dispose();
    this.hud.dispose();
    this.mark.group.removeFromParent();
    this.mark.group.traverse(object=>object.geometry?.dispose());
    this.mark.ink.dispose();this.mark.shadow.dispose();
    this.a11y.remove();
    delete this.panel.dataset.hudChrome;
    this.panel.style.removeProperty('--conversation-header-height');
  }
}
