import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const exhibitionHudId='world-exhibitions',visitHudId='world-visit';
export const exhibitionHudWidth=2.45,visitHudWidth=3.1;
const path=key=>({'@path':'/'+key});
const scope=fields=>({epoch:path('epoch'),...fields});
const event=(name,fields)=>({event:{name,context:scope(fields)}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:event(id),...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const row=(id,children)=>({id,component:'HudRow',children});

const exhibition=epoch=>[
  {id:'root',component:'HudPanel',label:'Exposiciones',width:exhibitionHudWidth,gap:.026,
    children:['heading','search','searchActions','choice_'+epoch,'result']},
  row('heading',['title','close']),text('title','Exposiciones',{style:'title',weight:3}),
  button('close','Volver',{weight:1}),
  {id:'search',component:'HudTextInput',label:'Buscar obra o etapa',value:path('query'),draft:path('searchDraft'),maxLength:80,
    action:event('search',{query:path('searchDraft')})},
  row('searchActions',['apply','clear']),
  button('apply','Buscar',{submitFor:'search',action:event('search',{query:path('searchDraft')})}),button('clear','Limpiar'),
  {id:'choice_'+epoch,component:'HudChoice',label:'Abrir exposición',options:path('options'),value:path('selected'),draft:path('choiceDraft'),
    visible:path('found'),action:event('choice',{epoch,id:path('choiceDraft')})},
  text('result',path('result'),{style:'body'}),
];

const chrome=visit=>[
  {id:'root',component:'HudPanel',label:'Controles de la presentación',width:visitHudWidth,gap:.022,
    children:['title','actions']},
  text('title',path('title'),{style:'title',lines:2}),
  row('actions',['walk','edition','end']),
  button('walk','Volver al mundo',{weight:1.4,action:event('walk',{epoch:visit})}),
  button('edition','Cambiar edición',{weight:1.4,visible:path('hasEditions'),disabled:path('busy'),action:event('edition',{epoch:visit})}),
  button('end','Cerrar contenido',{weight:1.4,disabled:path('busy'),action:event('end',{epoch:visit})}),
];

export class VisitHud{
  constructor({owner,send,focus}){
    Object.assign(this,{owner,send,focus,models:new Map()});
  }

  get indexActive(){return Boolean(this.owner()?.index?.native);}
  get viewerActive(){return Boolean(this.owner()?.panel?.hasAttribute('data-visit-hud'));}
  get openViewer(){
    const visitor=this.owner();
    return Boolean(visitor?.frame&&!visitor.panel.hidden&&!visitor.panel.classList.contains('is-walking'));
  }

  setSurface(id,group,components,value){
    if(!value){
      if(this[group])this.send('deleteSurface',{},id);
      this[group]=null;this.models.delete(id);
      this[group+'Epoch']=undefined;
      return;
    }
    const created=!this[group];
    if(created)this.send('createSurface',{catalogId:spatialHudCatalog.id},id);
    if(created||this[group+'Epoch']!==value.epoch){
      this.send('updateComponents',{components},id);
      this[group+'Epoch']=value.epoch;
    }
    const signature=JSON.stringify(value);
    if(this.models.get(id)!==signature){
      this.models.set(id,signature);
      this.send('updateDataModel',{value},id);
    }
  }

  update(){
    const visitor=this.owner(),index=visitor?.index;
    const options=index?.native?index.listing():null;
    if(!options)this.indexPresented=false;
    this.setSurface(exhibitionHudId,'indexGroup',exhibition(index?.version),options?{
      epoch:index.version,query:index.search.value,selected:'',options,
      found:options.length>0,result:options.length===0?'No hay obras que coincidan.':
        options.length===1?'Una exposición disponible':options.length+' exposiciones disponibles',
    }:null);
    this.setSurface(visitHudId,'viewerGroup',chrome(visitor?.visitId),this.openViewer&&visitor.canUseFrame()&&visitor.visitId!==this.fallbackVisit?{
      epoch:visitor.visitId,title:visitor.title??'Presentación',hasEditions:visitor.entries.length>1,
      busy:Boolean(visitor.opening||visitor.closing),
    }:null);
  }

  activate({surfaceId,name,context}){
    const visitor=this.owner(),index=visitor?.index;
    if(!visitor)return;
    if(surfaceId===exhibitionHudId&&index?.native&&context?.epoch===index.version){
      if(name==='close')index.close();
      else if(name==='search')index.searchFor(context.query);
      else if(name==='clear')index.searchFor('');
      else if(name==='choice'&&typeof context.id==='string')void index.choose(context.id,context.epoch);
    }else if(surfaceId===visitHudId&&this.viewerActive&&context?.epoch===visitor.visitId){
      if(name==='walk')visitor.walk();
      else if(name==='end')void visitor.endVisit();
      else if(name==='edition'&&!visitor.opening&&!visitor.closing&&visitor.entries.length>1){
        const frame=visitor.frame,visitId=visitor.visitId;
        visitor.minimize();
        index.update(visitor.entries);
        index.open({native:true,onCancel:()=>{
          if(visitor.frame===frame&&visitor.visitId===visitId&&visitor.canUseFrame())visitor.reveal();
        }});
      }
    }
  }

  present({painted,launcher,viewer,index}){
    const visitor=this.owner();
    if(!visitor)return;
    const wasViewer=this.viewerActive;
    const visible=Boolean(painted&&viewer&&this.openViewer&&visitor.visitId!==this.fallbackVisit);
    if(wasViewer&&!visible&&this.openViewer)this.fallbackVisit=visitor.visitId;
    visitor.button.parentElement.toggleAttribute('data-visit-launchers',Boolean(painted&&launcher));
    visitor.panel.toggleAttribute('data-visit-hud',visible);
    if(wasViewer&&!visible&&this.openViewer)visitor.document.querySelector('#visit-walk')?.focus({preventScroll:true});
    if(!this.openViewer)this.fallbackVisit=null;
    if(this.indexActive){
      if(!painted||!index)visitor.index.fallback();
      else if(!this.indexPresented){this.indexPresented=true;this.focus(exhibitionHudId,'close');}
    }
  }

  close(){
    if(this.indexActive)this.owner().index.close();
    else if(this.viewerActive)this.owner().walk();
  }
}
