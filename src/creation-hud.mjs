import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const creationHudId='world-creation';
const path=key=>({'@path':'/'+key});
const creatorActions=[
  ['mint','[data-color="mint"]'],['amber','[data-color="amber"]'],
  ['rose','[data-color="rose"]'],['violet','[data-color="violet"]'],
  ['move','#preview-move'],['accept','#preview-accept'],['cancel','#preview-cancel'],
];
const pointingActions=[['visit','#point-visit'],['send','#point-send'],['edit','#point-edit'],['clear','#point-clear']];

function components(mode,width,items){
  const ids=items.map(item=>item.id);
  const groups=mode==='creator'?
    [ids.slice(0,2),ids.slice(2,4),['move','cancel'],['accept']]:
    Array.from({length:Math.ceil(ids.length/2)},(_,index)=>ids.slice(index*2,index*2+2));
  return [
    {id:'root',component:'HudPanel',label:mode==='creator'?'Editar luz':'Indicar un objeto',width,
      children:['title','description',...groups.map((_,index)=>'row'+index)]},
    {id:'title',component:'HudText',label:path('title'),style:'title',visible:path('hasTitle')},
    {id:'description',component:'HudText',label:path('description'),style:'body',lines:2},
    ...groups.map((children,index)=>({id:'row'+index,component:'HudRow',children})),
    ...items.map(({id,pressed})=>({id,component:'HudButton',label:path(id+'/label'),
      disabled:path(id+'/disabled'),...(pressed!==null?{pressed:path(id+'/pressed')}:{}),
      action:{event:{name:id,context:{revision:path('revision')}}}})),
  ];
}

export class CreationHud{
  constructor({document,context,send,focus,isFocused,focusWorld}){
    Object.assign(this,{document,context,send,focus,isFocused,focusWorld,revision:0});
    this.creator=document.getElementById('creator');
    this.pointing=document.getElementById('pointing');
  }

  read(){
    const mode=!this.creator.hidden?'creator':!this.pointing.hidden?'pointing':null;
    if(!mode)return null;
    const panel=this[mode];
    const actions=(mode==='creator'?creatorActions:pointingActions).flatMap(([id,selector])=>{
      const control=panel.querySelector(selector);
      return !control||control.hidden?[]:[{
        id,control,label:control.getAttribute('aria-label')??control.textContent.trim(),disabled:control.disabled,
        pressed:control.hasAttribute('aria-pressed')?control.getAttribute('aria-pressed')==='true':null,
      }];
    });
    const title=panel.querySelector('h2')?.textContent??'';
    const description=panel.querySelector(mode==='creator'?'#preview-hint':'#point-label').textContent;
    const {draft,point,shared}=this.context();
    const subject=mode==='creator'?draft:point;
    const value={title,hasTitle:Boolean(title),description};
    for(const {id,label,disabled,pressed} of actions)value[id]={label,disabled,pressed};
    return {mode,panel,actions,value,subject,shared:mode==='pointing'?shared:null,key:JSON.stringify(value)};
  }

  update({visible,width,maxHeight}){
    const next=visible&&width>=250?this.read():null;
    const needed=next?.mode==='creator'?288:168;
    if(maxHeight<needed){this.clear();return;}
    if(!next){this.clear();return;}
    const changed=!this.view||this.view.mode!==next.mode||this.view.subject!==next.subject||
      this.view.shared!==next.shared||this.view.key!==next.key;
    if(changed){
      if(this.isFocused())this.restoreFocus=true;
      this.revision++;
    }
    this.view=next;
    const scale=220,size=Math.min(420,width)/scale;
    this.placement={scale,width:size};
    if(!this.group)this.send('createSurface',{catalogId:spatialHudCatalog.id},creationHudId);
    const layout=JSON.stringify([next.mode,size,next.actions.map(item=>item.id)]);
    if(layout!==this.layout){
      this.layout=layout;
      this.send('updateComponents',{components:components(next.mode,size,next.actions)},creationHudId);
    }
    if(changed)this.send('updateDataModel',{value:{...next.value,revision:this.revision}},creationHudId);
  }

  activate({name,context}){
    if(!this.presented||context?.revision!==this.revision)return;
    const current=this.read(),prior=this.view;
    if(!current||!prior||current.mode!==prior.mode||current.subject!==prior.subject||current.shared!==prior.shared||current.key!==prior.key)return;
    const action=current.actions.find(item=>item.id===name);
    if(!action||action.disabled||!action.control.isConnected)return;
    this.restoreFocus=this.isFocused();
    action.control.click();
  }

  cancel(){
    if(!this.presented||this.view?.mode!=='creator')return false;
    this.activate({name:'cancel',context:{revision:this.revision}});
    return true;
  }

  present(visible,restore=true){
    const focused=this.isFocused();
    const previouslyPresented=this.presented;
    this.presented=visible;
    const active=this.document.activeElement,view=this.view;
    this.creator.toggleAttribute('data-native-creation',Boolean(visible&&view?.mode==='creator'));
    this.pointing.toggleAttribute('data-native-creation',visible);
    if(visible){
      const item=view?.actions.find(action=>action.control===active);
      if(item)this.focus(item.id);
      else if(this.restoreFocus&&!focused){
        const next=view?.actions.find(action=>!action.disabled);
        if(next&&this.focus(next.id))this.restoreFocus=false;
      }
    }else if(restore&&previouslyPresented&&(focused||this.restoreFocus)){
      this.restoreFocus=false;
      const fallback=view&&!view.panel.hidden?view.actions.find(action=>!action.disabled):null;
      if(fallback&&fallback.control.getClientRects().length)fallback.control.focus({preventScroll:true});
      else this.focusWorld(view?.mode);
    }
  }

  clear(restore=true){
    this.present(false,restore);
    if(this.group)this.send('deleteSurface',{},creationHudId);
    this.group=null;this.view=null;this.layout=null;
  }
}
