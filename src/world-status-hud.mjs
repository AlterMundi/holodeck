import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const worldHeaderId='world-header',worldNoticeId='world-notice',worldControlsId='world-controls';
export const worldHeaderWidth=2.5,worldControlsWidth=3.45;
const parts={[worldHeaderId]:'header',[worldNoticeId]:'notice',[worldControlsId]:'controls'};
const path=key=>({'@path':'/'+key});
const text=(id,fields={})=>({id,component:'HudText',label:path(id),...fields});
const header=[
  {id:'root',component:'HudPanel',label:'Lugar actual',width:worldHeaderWidth,children:['heading','people','conversation']},
  {id:'heading',component:'HudRow',children:['title','sound']},
  text('title',{style:'title',weight:3}),
  {id:'sound',component:'HudButton',label:path('sound'),visible:path('hasSound'),
    disabled:path('soundDisabled'),pressed:path('soundActive'),action:{event:{name:'sound'}}},
  text('people',{style:'body',visible:path('hasPeople')}),
  text('conversation',{style:'body',visible:path('hasConversation')}),
];
const notice=(width,count)=>[
  {id:'root',component:'HudPanel',label:'Aviso del mundo',width,gap:.008,
    children:Array.from({length:count},(_,i)=>'line'+i)},
  ...Array.from({length:count},(_,i)=>text('line'+i,{label:path('lines/'+i)})),
];
const controls=[
  {id:'root',component:'HudPanel',label:'Controles de teclado',width:worldControlsWidth,gap:.008,children:['move','mode']},
  text('move',{style:'status'}),text('mode',{style:'body'}),
];

export function wrapNotice(message,measure,maxWidth){
  const lines=[];
  for(const paragraph of message.split('\n')){
    let line='';
    for(const word of paragraph.trim().split(/\s+/u)){
      const next=line?line+' '+word:word;
      if(measure(next)<=maxWidth){line=next;continue;}
      if(line)lines.push(line);
      line='';
      for(const character of word){
        if(line&&measure(line+character)>maxWidth){
          lines.push(line);line='';
          if(lines.length===8)return [];
        }
        line+=character;
      }
    }
    lines.push(line||' ');
    if(lines.length>8)return [];
  }
  return lines;
}

export class WorldStatusHud{
  constructor({document,send,toggleSound,focusSound,hasSoundFocus,focusWorld,invalidate}){
    Object.assign(this,{send,toggleSound,focusSound,hasSoundFocus,focusWorld,invalidate});
    this.noticeMaterials=new WeakMap();
    this.headerAdapter=document.getElementById('hud');
    this.sound=this.headerAdapter.querySelector('#sound');
    this.title=this.headerAdapter.querySelector('h1');
    this.people=this.headerAdapter.querySelector('#people');
    this.conversation=document.getElementById('companion-status');
    this.noticeAdapter=document.getElementById('notice');
    this.controlsAdapter=document.getElementById('help');
    this.verticalHelp=document.getElementById('world-vertical-help');
    this.measure=document.createElement('canvas').getContext('2d');
    if(this.measure)this.measure.font='600 13px system-ui';
  }

  updateSurface(id,components,value,layoutKey=0){
    const group=parts[id]+'Group';
    const signature=parts[id]+'Signature';
    if(!value){
      if(this[group]){
        this.present(id,false);
        this.send('deleteSurface',{},id);
        this[group]=null;
        this[signature]=null;
      }
      return;
    }
    if(!this[group]){
      this[signature]=null;
      this.send('createSurface',{catalogId:spatialHudCatalog.id},id);
      this[id+'Layout']=undefined;
    }
    if(this[id+'Layout']!==layoutKey){
      this[id+'Layout']=layoutKey;
      this.send('updateComponents',{components},id);
    }
    const next=JSON.stringify(value);
    if(next===this[signature])return;
    this[signature]=next;
    this.send('updateDataModel',{value},id);
  }

  update({headerVisible,showExterior,noticeVisible,controlsVisible,soundBlocked,width,height,noticeOpacity=1}){
    this.showExterior=showExterior;
    this.soundBlocked=soundBlocked;
    const people=this.people.hidden?'':this.people.textContent;
    const conversation=showExterior&&!this.conversation.hidden?this.conversation.textContent:'';
    const soundActive=this.sound.getAttribute('aria-pressed')==='true';
    const soundAvailable=headerVisible&&(showExterior||soundActive);
    const moveFocus=this.hasSound&&!soundAvailable&&this.hasSoundFocus();
    this.hasSound=soundAvailable;
    this.updateSurface(worldHeaderId,header,headerVisible?{
      title:this.title.textContent,people,hasPeople:Boolean(people),
      conversation,hasConversation:Boolean(conversation),
      sound:this.sound.hasAttribute('data-audio-unavailable')?'Sin audio':this.sound.textContent,
      hasSound:this.hasSound,soundDisabled:this.sound.disabled||soundBlocked,soundActive,
    }:null);
    if(moveFocus&&this.headerGroup)this.focusWorld();
    this.updateSurface(worldControlsId,controls,controlsVisible?{
      move:'W  A  S  D · Moverte',mode:this.verticalHelp.textContent.replace(/^\s*·\s*/,''),
    }:null);
    const message=noticeVisible&&!this.noticeAdapter.hidden?this.noticeAdapter.textContent:'';
    if(!message||!this.measure||width<180){
      this.updateSurface(worldNoticeId,null,null);
      return;
    }
    const panelWidth=width<660?2.32:3.05;
    const scale=Math.min(174,width/(panelWidth+.12));
    const key=JSON.stringify([message,width,height]);
    if(this.noticeLayout?.key!==key){
      const lines=wrapNotice(message,text=>this.measure.measureText(text).width,panelWidth*scale-28);
      const usable=lines.length&&(lines.length*.188+.07)*scale<=height*.32;
      this.noticeLayout={key,lines:usable?lines:[],panelWidth,scale};
    }
    const layout=this.noticeLayout;
    const modelKey=layout.panelWidth+':'+layout.lines.length;
    if(this.noticeModelKey!==modelKey){
      this.noticeModelKey=modelKey;
      this.noticeComponents=notice(layout.panelWidth,layout.lines.length);
    }
    this.updateSurface(worldNoticeId,this.noticeComponents,layout.lines.length?{lines:layout.lines}:null,modelKey);
    if(this.noticeGroup&&(noticeOpacity<1||this.noticeOpacity<1)){
      this.noticeGroup.traverse(({material})=>{
        if(!material)return;
        if(!this.noticeMaterials.has(material))this.noticeMaterials.set(material,{
          opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
        const original=this.noticeMaterials.get(material);
        const transparent=noticeOpacity<1||original.transparent;
        material.opacity=original.opacity*noticeOpacity;
        material.depthWrite=noticeOpacity===1&&original.depthWrite;
        if(material.transparent!==transparent){
          material.transparent=transparent;
          material.needsUpdate=true;
        }
      });
      this.invalidate?.();
    }
    this.noticeOpacity=noticeOpacity;
  }

  activate({name}){
    if(name==='sound'&&this.headerGroup&&this.hasSound&&!this.soundBlocked&&!this.sound.disabled)this.toggleSound();
  }

  present(id,visible){
    const isHeader=id===worldHeaderId;
    const adapter=this[parts[id]+'Adapter'];
    if(isHeader)this.conversation.toggleAttribute('data-native-status',visible&&this.showExterior);
    if(adapter.hasAttribute('data-native-status')===visible)return;
    const active=adapter.ownerDocument.activeElement;
    const fromNative=isHeader&&!visible&&this.hasSoundFocus();
    adapter.toggleAttribute('data-native-status',visible);
    if(!isHeader)return;
    if(visible&&active===this.sound){if(this.hasSound)this.focusSound();else this.focusWorld();}
    if(fromNative){
      if(this.sound.getClientRects().length&&adapter.ownerDocument.defaultView.getComputedStyle(this.sound).visibility==='visible')
        this.sound.focus({preventScroll:true});
      else this.focusWorld();
    }
  }

  dispose(){
    this.updateSurface(worldHeaderId,header,null);
    this.updateSurface(worldNoticeId,null,null);
    this.updateSurface(worldControlsId,controls,null);
    for(const id of Object.keys(parts))this.present(id,false);
  }
}
