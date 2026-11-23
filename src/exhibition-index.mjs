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
    this.entries=[];
    this.search.addEventListener('input',()=>this.render());
    this.dialog.addEventListener('close',()=>{
      if(!this.dialog.open)this.list.replaceChildren();
    });
  }

  update(entries){
    this.entries=entries;
    if(!entries.length)this.close();
    else if(this.dialog.open)this.render();
  }

  open(){
    if(this.dialog.open||!this.entries.length)return;
    this.search.value='';
    this.render();
    this.dialog.showModal();
  }

  close(){
    this.dialog.close();
    this.list.replaceChildren();
  }

  render(){
    const query=searchText(this.search.value.trim());
    const focused=this.document.activeElement?.dataset.visitEntry;
    const results=this.entries.filter(entry=>searchText(exhibitionLabel(entry)).includes(query));
    this.list.replaceChildren();
    for(const entry of results){
      const item=this.document.createElement('li'),button=this.document.createElement('button');
      button.type='button';
      button.textContent=exhibitionLabel(entry);
      button.dataset.visitEntry=entry.id;
      button.onclick=()=>{
        this.close();
        this.openEntry(entry);
      };
      item.append(button);
      this.list.append(item);
      if(focused===entry.id)button.focus();
    }
    if(focused&&!results.some(entry=>entry.id===focused))this.search.focus();
    this.empty.hidden=results.length>0;
  }
}
