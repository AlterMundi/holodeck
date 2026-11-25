import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const collectionHudId='matter-collection';
export const collectionHudWidth=2.28;
const path=key=>({'@path':'/'+key});
const action=(name,context={})=>({event:{name,context:{scope:path('scope'),mode:path('mode'),...context}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const row=(id,children,fields={})=>({id,component:'HudRow',children,...fields});
const column=(id,children,visible)=>({id,component:'HudColumn',children,visible:path(visible)});
const activeEdition={edition:path('edition')};

const components=[
  {id:'root',component:'HudPanel',label:'Colección de Materia',width:collectionHudWidth,children:['title','tabs','shelf','archive','status']},
  text('title',path('title'),{style:'title'}),
  row('tabs',['showShelf','showArchive'],{visible:path('both')}),
  button('showShelf','Repisa',{pressed:path('shelfOpen')}),
  button('showArchive','Archivo',{pressed:path('archiveOpen')}),
  column('shelf',['editionChoice','shelfActions'],'shelfOpen'),
  {id:'editionChoice',component:'HudChoice',label:'Edición',options:path('editions'),value:path('edition'),
    draft:path('editionDraft'),action:action('editionChoice',{edition:path('editionDraft')})},
  row('shelfActions',['place','viewShelf']),
  button('place','A la mesa',{action:action('place',activeEdition)}),
  button('viewShelf','Abrir en Visor 3D',{action:action('viewShelf',activeEdition)}),
  column('archive',['archiveName','browse','viewArchive','restore'],'archiveOpen'),
  text('archiveName',path('archiveName')),
  row('browse',['previous','page','next']),
  button('previous','Anterior',{disabled:path('stepDisabled'),action:action('previous',activeEdition)}),
  text('page',path('page')),
  button('next','Siguiente',{disabled:path('stepDisabled'),action:action('next',activeEdition)}),
  button('viewArchive','Abrir en Visor 3D',{action:action('viewArchive',activeEdition)}),
  button('restore','Devolver a la repisa',{visible:path('canRestore'),disabled:path('busy'),action:action('restore',activeEdition)}),
  text('status',path('status'),{style:'status',visible:path('hasStatus')}),
];

export class CollectionHud{
  constructor({owner,send,openViewer,focusControl,currentFocus,focusLauncher}){
    Object.assign(this,{owner,send,openViewer,focusControl,currentFocus,focusLauncher,scope:0});
  }

  update(visible){
    this.visible=visible;
    const state=visible?this.owner.hudCollection():null;
    if(!state||(!state.entries.length&&!state.archive)){
      this.reset();
      return;
    }
    this.room=state.room;
    const both=Boolean(state.entries.length&&state.archive);
    if(!both||!this.mode)this.mode=state.entries.length?'shelf':'archive';
    if(!state.entries.some(entry=>entry.id===this.edition))this.edition=state.entries[0]?.id??'';
    const archiveOpen=this.mode==='archive';
    const edition=archiveOpen?state.archive.id:this.edition;
    const current=JSON.stringify([state.room,this.mode,edition]);
    let focus;
    if(current!==this.current){
      if(this.group){
        focus=this.currentFocus();
        this.send('deleteSurface',{},collectionHudId);
        this.group=null;
        this.signature=null;
      }
      this.current=current;
      this.viewerProblem='';
      this.scope++;
    }
    if(!this.group){
      this.signature=null;
      this.send('createSurface',{catalogId:spatialHudCatalog.id},collectionHudId);
      this.send('updateComponents',{components},collectionHudId);
    }
    const status=this.viewerProblem||(archiveOpen?state.archive.status:'');
    const value={scope:this.scope,mode:this.mode,edition,editions:state.entries,
      title:archiveOpen?'Vitrina de archivo':'En esta repisa',both,shelfOpen:!archiveOpen,archiveOpen,
      archiveName:state.archive?.label??'',page:state.archive?.page??'',stepDisabled:!state.archive?.canStep,
      canRestore:state.archive?.canRestore??false,busy:state.archive?.busy??false,
      status,hasStatus:Boolean(status)};
    const signature=JSON.stringify(value);
    if(signature!==this.signature){
      const previous=focus??this.currentFocus();
      this.signature=signature;
      this.send('updateDataModel',{value},collectionHudId);
      if(previous==='restore'&&(!value.canRestore||value.busy))this.focusControl('viewArchive');
      else if(focus&&!this.focusControl(focus))this.focusControl(archiveOpen?'viewArchive':'viewShelf');
    }
  }

  activate({name,context}){
    if(!this.visible||!this.group||context?.scope!==this.scope||context.mode!==this.mode)return;
    const state=this.owner.hudCollection();
    if(!state)return;
    const {entries,archive,room}=state;
    if(room!==this.room)return;
    if(name==='showShelf'&&entries.length&&archive)this.mode='shelf';
    else if(name==='showArchive'&&entries.length&&archive)this.mode='archive';
    else if(this.mode==='shelf'){
      if(name==='editionChoice'&&entries.some(entry=>entry.id===context.edition))this.edition=context.edition;
      else if(context.edition===this.edition){
        if(name==='place')this.owner.placeShelfEdition(context.edition);
        if(name==='viewShelf')this.view(this.owner.shelfViewerPath(context.edition));
      }
    }else if(archive?.id===context.edition){
      if(name==='previous'||name==='next')this.owner.archive.step(name==='next'?1:-1);
      if(name==='viewArchive')this.view(this.owner.archive.viewerPath(context.edition));
      if(name==='restore'&&archive.canRestore&&!archive.busy)void this.owner.archive.returnToShelf();
    }
    this.update(this.visible);
  }

  view(path){
    if(path)this.viewerProblem=this.openViewer(path)?'':'Permití las ventanas emergentes para abrir el Visor 3D.';
  }

  presented(visible){
    const shelf=this.owner.panel,archive=this.owner.archive.panel;
    if(shelf.hasAttribute('data-native-collection')===visible)return false;
    const active=shelf.ownerDocument.activeElement;
    const fromLegacy=visible&&(shelf.contains(active)||archive.contains(active));
    const fromNative=!visible&&this.group&&this.currentFocus();
    shelf.toggleAttribute('data-native-collection',visible);
    archive.toggleAttribute('data-native-collection',visible);
    if(fromLegacy)this.focusControl(this.mode==='archive'?'viewArchive':'viewShelf');
    if(fromNative){
      const panel=this.mode==='archive'?archive:shelf;
      const control=panel.getClientRects().length&&panel.querySelector('a[href]');
      if(control){control.focus({preventScroll:true});return true;}
    }
    return false;
  }

  reset(){
    const focused=this.group&&this.currentFocus();
    const transferred=this.presented(false);
    if(this.group)this.send('deleteSurface',{},collectionHudId);
    if(focused&&!transferred)this.focusLauncher();
    this.group=null;
    this.mode=null;
    this.edition=null;
    this.room=null;
    this.current=null;
    this.signature=null;
  }
}
