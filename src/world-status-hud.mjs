import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const worldNoticeId='world-notice',worldControlsId='world-controls';
export const worldControlsWidth=3.45;
const parts={[worldNoticeId]:'notice',[worldControlsId]:'controls'};
const path=key=>({'@path':'/'+key});
const text=(id,fields={})=>({id,component:'HudText',label:path(id),...fields});
const notice=(width,count)=>[
  {id:'root',component:'HudPanel',label:'Aviso del mundo',width,gap:.008,
    children:Array.from({length:count},(_,i)=>'line'+i)},
  ...Array.from({length:count},(_,i)=>text('line'+i,{label:path('lines/'+i)})),
];
const controls=[
  {id:'root',component:'HudPanel',label:'Controles de teclado',width:worldControlsWidth,gap:.008,children:['move','mode']},
  text('move',{style:'status'}),text('mode',{style:'body'}),
];
const noticeGraphemes=typeof Intl.Segmenter==='function'?
  new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;

export function wrapNotice(message,measure,maxWidth){
  const lines=[];
  for(const paragraph of message.split('\n')){
    let line='';
    for(const word of paragraph.trim().split(/\s+/u)){
      const next=line?line+' '+word:word;
      if(measure(next)<=maxWidth){line=next;continue;}
      if(line)lines.push(line);
      if(measure(word)<=maxWidth){line=word;continue;}
      if(!noticeGraphemes)return [];
      line='';
      for(const {segment} of noticeGraphemes.segment(word)){
        if(measure(segment)>maxWidth)return [];
        if(line&&measure(line+segment)>maxWidth){
          lines.push(line);line='';
          if(lines.length===8)return [];
        }
        line+=segment;
      }
    }
    lines.push(line||' ');
    if(lines.length>8)return [];
  }
  return lines;
}

export class WorldStatusHud{
  constructor({document,send,invalidate}){
    Object.assign(this,{send,invalidate});
    this.noticeMaterials=new WeakMap();
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

  update({noticeVisible,controlsVisible,width,height,noticeOpacity=1}){
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

  present(id,visible){
    this[parts[id]+'Adapter'].toggleAttribute('data-native-status',visible);
  }

  dispose(){
    this.updateSurface(worldNoticeId,null,null);
    this.updateSurface(worldControlsId,controls,null);
    for(const id of Object.keys(parts))this.present(id,false);
  }
}
