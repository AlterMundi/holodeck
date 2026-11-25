import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const worldHeaderId='world-header',worldNoticeId='world-notice';
export const worldHeaderWidth=2.5,worldNoticeWidth=3.05;
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
const notice=lines=>[
  {id:'root',component:'HudPanel',label:'Aviso del mundo',width:worldNoticeWidth,children:['message']},
  text('message',{style:'body',lines}),
];

export class WorldStatusHud{
  constructor({document,send,toggleSound,focusSound,hasSoundFocus,focusWorld}){
    Object.assign(this,{send,toggleSound,focusSound,hasSoundFocus,focusWorld});
    this.headerAdapter=document.getElementById('hud');
    this.sound=this.headerAdapter.querySelector('#sound');
    this.title=this.headerAdapter.querySelector('h1');
    this.people=this.headerAdapter.querySelector('#people');
    this.conversation=document.getElementById('companion-status');
    this.noticeAdapter=document.getElementById('notice');
  }

  updateSurface(id,components,value,layoutKey=0){
    const isHeader=id===worldHeaderId;
    const group=isHeader?'headerGroup':'noticeGroup';
    const signature=isHeader?'headerSignature':'noticeSignature';
    if(!value){
      if(this[group]){
        this.present(isHeader,false);
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

  update({headerVisible,showExterior,noticeVisible,width}){
    const people=this.people.textContent,conversation=showExterior?this.conversation.textContent:'';
    const soundAvailable=headerVisible&&showExterior;
    const moveFocus=this.hasSound&&!soundAvailable&&this.hasSoundFocus();
    this.hasSound=soundAvailable;
    this.updateSurface(worldHeaderId,header,headerVisible?{
      title:this.title.textContent,people,hasPeople:Boolean(people),
      conversation,hasConversation:Boolean(conversation),
      sound:this.sound.textContent,hasSound:this.hasSound,soundDisabled:this.sound.disabled,
      soundActive:this.sound.getAttribute('aria-pressed')==='true',
    }:null);
    if(moveFocus&&this.headerGroup)this.focusWorld();
    const message=noticeVisible?this.noticeAdapter.textContent:'';
    const lines=Math.max(1,Math.min(8,Math.ceil(Array.from(message).length/(width<680?42:65))));
    this.noticeLines=lines;
    this.updateSurface(worldNoticeId,notice(lines),message?{message}:null,lines);
  }

  activate({name}){
    if(name==='sound'&&this.headerGroup&&this.hasSound&&!this.sound.disabled)this.toggleSound();
  }

  present(isHeader,visible){
    const adapter=isHeader?this.headerAdapter:this.noticeAdapter;
    if(adapter.hasAttribute('data-native-status')===visible)return;
    const active=adapter.ownerDocument.activeElement;
    const fromNative=isHeader&&!visible&&this.hasSoundFocus();
    adapter.toggleAttribute('data-native-status',visible);
    if(!isHeader)return;
    this.conversation.toggleAttribute('data-native-status',visible);
    if(visible&&active===this.sound){if(this.hasSound)this.focusSound();else this.focusWorld();}
    if(fromNative&&this.sound.getClientRects().length)this.sound.focus({preventScroll:true});
  }

  dispose(){
    this.updateSurface(worldHeaderId,header,null);
    this.updateSurface(worldNoticeId,notice(1),null);
    this.present(true,false);
    this.present(false,false);
  }
}
