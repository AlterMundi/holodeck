import {spatialHudCatalog} from 'proyeccion/spatial-hud';
import {wrapNotice} from './world-status-hud.mjs';

export const recoveryHudId='world-recovery';
const path=key=>({'@path':'/'+key});
const label=(id,key,fields={})=>({id,component:'HudText',label:path(key),...fields});
const button=(id,caption)=>({id,component:'HudButton',label:caption,disabled:path(id+'Disabled'),
  action:{event:{name:id,context:{revision:path('revision')}}}});
const row=(id,children)=>({id,component:'HudRow',children});

function components(width,count,actions,browse){
  const lines=Array.from({length:count},(_,index)=>'line'+index);
  return [
    {id:'root',component:'HudPanel',label:'Envíos por confirmar',width,gap:.025,
      children:['heading',...(browse?['next']:[]),...lines,'checks','tracking',...(actions.includes('confirm')?['confirm']:[])]},
    label('heading','title',{style:'title'}),
    ...(browse?[button('next',path('nextLabel'))]:[]),
    ...lines.map((id,index)=>label(id,'lines/'+index)),
    row('checks',actions.filter(id=>id==='check'||id==='retry')),
    row('tracking',actions.filter(id=>id==='close'||id==='reveal')),
    ...actions.map(id=>button(id,path(id+'Label'))),
  ];
}

export class RecoveryHud{
  constructor({document,send,focus,isFocused,invalidate}){
    Object.assign(this,{document,send,focus,isFocused,invalidate,revision:0});
    this.panel=document.getElementById('recovery-panel');
    this.measure=document.createElement('canvas').getContext('2d');
    if(this.measure)this.measure.font='600 15px system-ui';
  }

  update({visible,width,maxHeight}){
    const cards=this.panel&&!this.panel.hidden?[...this.panel.querySelectorAll('.recovery-item')]:[];
    if(!visible||width<250||!cards.length||!this.measure||cards.some(card=>card.querySelector('details[open]'))){
      this.clear(visible);
      return;
    }
    const card=cards.find(item=>item.dataset.kind===this.selected)??cards[0];
    this.selected=card.dataset.kind;
    const keys=['check','retry','close','confirm'];
    const controls=new Map(keys.map(key=>[key,card.querySelector('button[data-action="'+key+'"]')]).filter(([,element])=>element));
    const detail=card.querySelector('summary');
    if(detail)controls.set('reveal',detail);
    if(!controls.has('check')||!controls.has('close')){this.clear();return;}
    const scale=238;
    const size=Math.min(width,460)/scale;
    const source=[...card.children].filter(element=>element.tagName==='P'&&!element.classList.contains('recovery-title'))
      .map(element=>element.textContent.trim()).join('\n');
    const controlState=JSON.stringify([source,...[...controls].map(([key,element])=>[key,element.textContent,Boolean(element.disabled)])]);
    if(card!==this.card||controlState!==this.controlState||[...controls].some(([key,element])=>this.controls?.get(key)!==element))
      this.revision++;
    this.controlState=controlState;
    this.card=card;
    this.controls=controls;
    const wrapKey=JSON.stringify([source,size]);
    if(wrapKey!==this.wrapKey){
      this.wrapKey=wrapKey;
      this.lines=wrapNotice(source,message=>this.measure.measureText(message).width,size*scale-36);
    }
    const lines=this.lines,actions=[...controls.keys()];
    const browse=cards.length>1;
    const height=(lines.length+3+Number(browse)+Number(controls.has('confirm')))*.215*scale+24;
    if(!lines.length||height>maxHeight){this.clear();return;}
    this.placement={scale,width:size};
    const data={title:card.querySelector('.recovery-title')?.textContent??'Envíos por confirmar',lines,revision:this.revision};
    if(browse)data.nextLabel=this.selected==='command'?'Ver mensaje pendiente':'Ver cambio pendiente';
    for(const [key,element] of controls){
      data[key+'Label']=key==='retry'?'Reintentar':key==='reveal'?'Ver original':element.textContent;
      data[key+'Disabled']=Boolean(element.disabled);
    }
    if(!this.group)this.send('createSurface',{catalogId:spatialHudCatalog.id},recoveryHudId);
    const layout=JSON.stringify([size,lines.length,actions,browse]);
    if(layout!==this.layout){
      this.layout=layout;
      this.send('updateComponents',{components:components(size,lines.length,actions,browse)},recoveryHudId);
    }
    const key=JSON.stringify(data);
    if(key!==this.key){
      this.key=key;
      this.send('updateDataModel',{value:data},recoveryHudId);
    }
  }

  activate({name,context}){
    if(!this.presented||context?.revision!==this.revision||this.panel.hidden||!this.card?.isConnected)return;
    if(name==='next'){
      this.selected=this.selected==='command'?'native':'command';
      this.revision++;
      this.invalidate();
      return;
    }
    const target=this.controls?.get(name);
    if(!target?.isConnected||target.disabled)return;
    target.click();
    if(name==='reveal'){
      this.clear();
      target.focus({preventScroll:true});
    }
  }

  present(visible,restoreFocus=true){
    this.presented=visible;
    if(!this.panel)return;
    const active=this.document.activeElement;
    const previous=active?.closest?.('button[data-action],summary');
    this.panel.toggleAttribute('data-native-recovery',visible);
    if(visible&&previous&&this.card?.contains(previous)){
      this.focus(previous.dataset.action??'reveal');
    }else if(!visible&&restoreFocus&&this.isFocused()&&!this.panel.hidden){
      const selector='button[data-action="check"]:not([disabled])';
      (this.card?.querySelector(selector)??this.panel.querySelector(selector))?.focus({preventScroll:true});
    }
  }

  clear(restoreFocus=true){
    this.present(false,restoreFocus);
    if(this.group)this.send('deleteSurface',{},recoveryHudId);
    this.group=null;this.card=null;this.controls=null;this.key=null;this.layout=null;
  }
}
