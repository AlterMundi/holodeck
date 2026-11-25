const searchText=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es');

function exhibitionLabel({title,editionTitle}){
  if(!editionTitle||editionTitle===title)return title||editionTitle||'Contenido';
  return title?editionTitle+' · '+title:editionTitle;
}

export class ExhibitionIndex {
  constructor(document,openEntry){
    this.document=document;
    this.openEntry=openEntry;
    this.dialog=document.querySelector('#exhibition-index');
    this.search=document.querySelector('#exhibition-search');
    this.list=document.querySelector('#exhibition-results');
    this.empty=document.querySelector('#exhibition-empty');
    this.entries=[];this.version=0;
    this.search.addEventListener('input',()=>{this.version++;this.render();});
    this.dialog.addEventListener('close',()=>{
      if(!this.dialog.open&&!this.native)this.close();
    });
  }

  update(entries,{invalidate=!entries.length}={}){
    const signature=JSON.stringify(entries.map(entry=>[entry.id,entry.nodeRevision,entry.pin,exhibitionLabel(entry)]));
    if(signature!==this.signature){this.signature=signature;this.version++;}
    this.entries=entries;
    if(!entries.length&&invalidate)this.close({resume:false});
    else if(this.dialog.open)this.render();
  }

  open({native=false,onCancel}={}){
    if(this.opened||!this.entries.length)return;
    this.opened=true;this.onCancel=onCancel;
    this.version++;
    this.search.value='';
    this.setNative(native);
    if(!native){this.render();this.dialog.showModal();}
  }

  setNative(active){
    if(Boolean(this.native)===active)return;
    this.native=active;
    if(active){
      this.inertTargets=[...this.document.querySelectorAll('#conversation-panel,#creator,#content-visit,#world-tools,#dock,#space-travel,#hud,#visit-controls')]
        .filter(element=>!element.inert);
      for(const element of this.inertTargets)element.inert=true;
    }else{
      for(const element of this.inertTargets??[])element.inert=false;
      this.inertTargets=null;
    }
  }

  fallback(){
    if(!this.native||!this.opened)return;
    this.setNative(false);
    this.render();
    this.dialog.showModal();
  }

  close({resume=true}={}){
    if(!this.opened)return;
    this.opened=false;
    this.version++;
    this.setNative(false);
    if(this.dialog.open)this.dialog.close();
    this.list.replaceChildren();
    const cancel=this.onCancel;this.onCancel=null;
    if(resume)cancel?.();
  }

  searchFor(value){
    if(typeof value!=='string'||value.length>80||!this.opened||value===this.search.value)return;
    this.search.value=value;
    this.version++;
  }

  results(){
    const query=searchText(this.search.value.trim());
    return this.entries.filter(entry=>searchText(exhibitionLabel(entry)).includes(query));
  }

  listing(){
    return this.results().map(entry=>({id:entry.id,label:exhibitionLabel(entry)}));
  }

  choose(id,version=this.version){
    if(!this.opened||version!==this.version)return;
    const entry=this.results().find(entry=>entry.id===id);
    if(!entry)return;
    this.close({resume:false});
    return this.openEntry(entry);
  }

  render(){
    const focused=this.document.activeElement?.dataset.visitEntry;
    const results=this.results();
    this.list.replaceChildren();
    for(const entry of results){
      const item=this.document.createElement('li'),button=this.document.createElement('button');
      button.type='button';
      button.textContent=exhibitionLabel(entry);
      button.dataset.visitEntry=entry.id;
      const version=this.version;
      button.onclick=()=>this.choose(entry.id,version);
      item.append(button);
      this.list.append(item);
      if(focused===entry.id)button.focus();
    }
    if(focused&&!results.some(entry=>entry.id===focused))this.search.focus();
    this.empty.hidden=results.length>0;
  }
}
