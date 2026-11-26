import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel,placeGalleryModel} from './gallery-models.mjs';
import {CollectionArchive} from './collection-archive.mjs';
import {CollectionWorktable} from './collection-worktable.mjs';
import {CollectionContactShadow} from './collection-contact-shadow.mjs';
import {staticModelLevels,wantsDetailedModel} from './static-model-lod.mjs';

const REFRESH_MS=12000;
const MODEL_LIMIT=384*1024;
const hex=(value,length)=>typeof value==='string'&&value.length===length&&/^[a-f0-9]+$/.test(value);
const distance=(point,anchor)=>Math.hypot(point.x-anchor.x,point.z-anchor.z);
const shelfIdentity=({item,edition})=>JSON.stringify([item.project.id,edition.resource,edition.version]);
const editionKey=edition=>edition.resource+':'+edition.version+':'+(edition.representative?.sha256??'');

async function modelBytes(base,edition,signal){
  const url=new URL('api/space/collection-model/'+edition.resource+'/'+edition.version,base);
  const response=await fetch(url,{cache:'no-store',redirect:'error',signal});
  if(!response.ok||Number(response.headers.get('content-length'))>MODEL_LIMIT){
    await response.body?.cancel();
    throw Error('Collection model unavailable');
  }
  const reader=response.body.getReader(),bytes=new Uint8Array(MODEL_LIMIT);
  let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(size+value.length>MODEL_LIMIT)throw Error('Collection model exceeds its byte limit');
      bytes.set(value,size);size+=value.length;
    }
  }finally{reader.cancel().catch(()=>{});}
  const payload=bytes.buffer.slice(0,size);
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',payload)),x=>x.toString(16).padStart(2,'0')).join('');
  if(sha!==edition.representative.sha256)throw Error('Collection model changed');
  return payload;
}

export class CollectionShelves {
  constructor({base,scene,panel,archivePanel,worktablePanel,webgl,onReference,onPlaced,onTabletop,onPoint,onCatalogUnavailable}){
    Object.assign(this,{base,scene,panel,onPlaced,onTabletop,onCatalogUnavailable,webgl,loader:new GLTFLoader()});
    this.items=new Map();
    this.list=panel.querySelector('ul');
    this.archiveStatus=panel.ownerDocument.createElement('p');
    this.archiveStatus.setAttribute('role','status');
    this.archiveStatus.style.cssText='margin:0; font-size:13px';
    panel.append(this.archiveStatus);
    this.visibleLinks='';
    this.shelfEntries=[];
    this.hudShelfOptions=[];
    this.tabletopPlayers=new Set();
    const refreshSoon=this.refreshSoon=()=>{this.flight?.abort();this.flight=null;this.refreshAt=0;};
    this.archive=new CollectionArchive({base,scene,panel:archivePanel,loader:this.loader,
      readModel:(edition,signal)=>modelBytes(base,edition,signal),onRestored:refreshSoon});
    this.worktable=new CollectionWorktable({base,scene,panel:worktablePanel,webgl,onReference,onPoint,onSharedChange:refreshSoon});
  }

  update(room,root,player,bench,canDiscuss,contactShadows,camera,pixels,inspectionMix=0){
    if(this.room!==room||this.root!==root){
      this.clear();
      this.room=room;this.root=root;
    }
    if(!room||!root||!player)return;
    if(!this.events&&performance.now()>=(this.nextStreamAt??0)){
      const stream=new EventSource(new URL('api/space/collection/events',this.base));
      this.events=stream;
      let opened=false;
      stream.onopen=()=>{
        if(this.events!==stream)return;
        if(opened)this.refreshAt=0;
        opened=true;
      };
      stream.onerror=()=>{
        if(this.events!==stream||stream.readyState!==EventSource.CLOSED)return;
        this.events=null;
        this.tabletopPlayers.clear();
        this.nextStreamAt=performance.now()+3000;
      };
      stream.addEventListener('tabletop',event=>{
        if(this.events!==stream)return;
        try{
          const players=JSON.parse(event.data);
          if(Array.isArray(players)&&players.every(id=>Number.isSafeInteger(id)&&id>=0)){
            this.tabletopPlayers=new Set(players);
            this.onTabletop?.(this.tabletopPlayers);
          }
        }catch{}
      });
      stream.addEventListener('refresh',()=>{
        if(this.events===stream)this.refreshAt=0;
      });
    }
    const now=performance.now();
    if(!this.flight&&now>=(this.refreshAt??0))this.refresh();
    const nearest=[...this.items.values()].map(item=>({item,distance:distance(player,item.project.anchor)}))
      .sort((a,b)=>a.distance-b.distance);
    const detailed=nearest.filter(({item,distance})=>wantsDetailedModel({
      anchor:item.project.anchor,diameter:.85,distance,camera,pixels,near:item.levels?.near,
    })).slice(0,3);
    const detailItems=new Set(detailed.map(({item})=>item));
    for(const {item} of nearest)item.levels?.setNear(detailItems.has(item));
    // Admit one shelf fetch/decode at a time. Loaded representatives remain
    // qualified in this room and change tier without another network request.
    if(!nearest.some(({item})=>item.pending)){
      const next=nearest.find(({item})=>item.edition.representative&&!item.mesh&&now>=(item.retryAt??0));
      if(next)this.load(next.item,detailItems.has(next.item));
    }
    this.nearby=nearest.filter(value=>value.distance<=1.85).map(value=>value.item);
    this.links(this.nearby);
    this.archive.update(player,camera,pixels);
    this.worktable.update(player,bench,canDiscuss);
    if(contactShadows){
      const casters=[
        ['worktable',this.worktable.model?.group,bench,this.worktable.model?.shadowRevision],
        ['archive',this.archive.shadowModel,this.archive.anchor,this.archive.angle],
      ];
      for(const [fixture,model,anchor,revision] of casters){
        const fields=this.shadows??=new Map();
        if(model&&!fields.has(fixture))
          fields.set(fixture,new CollectionContactShadow(this.webgl,this.scene,fixture));
        fields.get(fixture)?.update(model,anchor,revision,now,fixture==='worktable'?inspectionMix:0);
      }
    }else this.clearShadows();
  }

  async refresh(){
    const controller=new AbortController();
    this.flight=controller;
    this.refreshAt=performance.now()+REFRESH_MS;
    try{
      const response=await fetch(new URL('api/space/collection',this.base),
        {cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6500)])});
      const data=response.ok?await response.json():null;
      if(controller.signal.aborted)return;
      if(response.status===503)this.retryCatalog();
      else if(response.ok)this.catalogUnavailable=false;
      const current=data?.room===this.room?data:null;
      this.sync(current?.projects);
      this.archive.sync(current?.archive,this.root);
      this.worktable.sync(current?.projects,current?.worktable);
    }catch{
      if(!controller.signal.aborted){
        this.retryCatalog();
        this.sync([]);this.archive.clear();this.worktable.clear();
      }
    }finally{
      if(this.flight===controller)this.flight=null;
    }
  }

  retryCatalog(){
    this.refreshAt=performance.now()+3000;
    if(this.catalogUnavailable)return;
    this.catalogUnavailable=true;
    this.onCatalogUnavailable?.();
  }

  sync(projects){
    const current=new Set();
    for(const project of Array.isArray(projects)?projects.slice(0,6):[]){
      if(!project.anchor||!Array.isArray(project.editions))continue;
      const editions=project.editions.filter(edition=>hex(edition.resource,32)&&hex(edition.version,64)&&typeof edition.title==='string');
      const edition=editions[0];
      if(!edition)continue;
      current.add(project.id);
      const existing=this.items.get(project.id),key=editionKey(edition);
      if(existing?.key===key&&existing.edition.title===edition.title){
        existing.project=project;existing.edition=edition;existing.editions=editions;
        continue;
      }
      if(existing)this.remove(existing);
      const label=this.root.ownerDocument.createElement('m-label');
      const title=Array.from(edition.title);
      const values={content:title.length>31?title.slice(0,30).join('')+'…':edition.title,
        x:project.anchor.x+.39,y:project.anchor.y-.09,z:project.anchor.z,ry:90,
        width:1.58,height:.135,'font-size':9,padding:3,alignment:'center',color:'#19332f','font-color':'#fff0cc',
        collide:'false'};
      for(const [name,value] of Object.entries(values))label.setAttribute(name,String(value));
      label.setAttribute('data-collection-project',project.id);
      this.root.append(label);
      this.items.set(project.id,{project,edition,editions,key,label});
    }
    for(const [id,item] of this.items)if(!current.has(id))this.remove(item);
  }

  async load(item,near){
    const controller=new AbortController();
    item.pending=controller;
    try{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]);
      const payload=await modelBytes(this.base,item.edition,signal);
      const {scene}=await this.loader.parseAsync(payload,'');
      if(signal.aborted){disposeModel(scene);return;}
      item.levels=staticModelLevels(placeGalleryModel(scene,item.project.anchor,{width:.64,depth:1.13,height:.47}),near);
      item.mesh=item.levels.group;
      item.mesh.name='collection-'+item.project.id;
      this.scene.add(item.mesh);
    }catch{item.retryAt=performance.now()+REFRESH_MS;}
    finally{if(item.pending===controller)item.pending=null;}
  }

  placeOnTable(item,edition){
    if(!this.nearby?.includes(item)||this.items.get(item.project.id)!==item||
       !item.editions.includes(edition)||!this.worktable.fromShelf(edition,item.project.restored===true))return;
    this.onPlaced?.();
  }

  hudCollection(){
    if(!this.room||!this.root)return null;
    return {room:this.room,entries:this.hudShelfOptions,archive:this.archive.hudState(),
      shelfArchive:{busy:Boolean(this.archiveRequest),problem:this.archiveProblem}};
  }

  placeShelfEdition(id){
    if(!this.room||!this.root)return;
    const entry=this.shelfEntries.find(item=>shelfIdentity(item)===id);
    if(entry)this.placeOnTable(entry.item,entry.edition);
  }

  async archiveShelfEdition(id){
    const entry=this.shelfEntries.find(item=>shelfIdentity(item)===id);
    if(!this.room||!entry?.item.project.canArchive||this.archiveRequest)return;
    const controller=new AbortController();
    this.archiveRequest=controller;
    this.setArchiveStatus(id,'');
    this.links(this.nearby);
    try{
      const {resource,version}=entry.edition;
      const response=await fetch(new URL('api/space/collection/archive',this.base),{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resource,version,action:'rearchive'}),
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]),redirect:'error',
      });
      if(controller.signal.aborted)return;
      if(response.ok){
        if(this.items.get(entry.item.project.id)===entry.item)this.remove(entry.item);
        this.nearby=this.nearby.filter(item=>item!==entry.item);
        this.refreshSoon();
      }else{
        const detail=response.status===409?await response.json().catch(()=>null):null;
        if(controller.signal.aborted)return;
        this.setArchiveStatus(id,detail?.reason==='shared-worktable'
          ?'Retirá esta edición de la mesa compartida para volver a archivarla.'
          :'No se pudo archivar la edición. Volvé a intentar.');
        this.refreshSoon();
      }
    }catch{
      if(!controller.signal.aborted){
        this.setArchiveStatus(id,'No se pudo confirmar el archivo. Estamos actualizando la colección.');
        this.refreshSoon();
      }
    }finally{
      if(this.archiveRequest===controller){this.archiveRequest=null;this.links(this.nearby);}
    }
  }

  setArchiveStatus(id,message){
    this.archiveProblem=message?{id,message}:null;
    this.archiveStatus.textContent=message;
  }

  shelfViewerPath(id){
    const entry=this.shelfEntries.find(item=>shelfIdentity(item)===id);
    if(!this.room||!entry||!this.nearby.includes(entry.item))return null;
    const {resource,version}=entry.edition;
    return '/view/'+resource+'?version='+version+'&display=work';
  }

  pickTargets(){
    const targets=new Map();
    for(const item of this.nearby??[]){
      const target={kind:'collection-shelf',item,edition:item.edition};
      if(item.mesh)targets.set(item.mesh,target);
      if(item.label.isConnected)targets.set(item.label.getContainer(),target);
    }
    this.worktable.partTargets(targets);
    return targets;
  }

  links(items){
    const entries=items.flatMap(item=>item.editions.map(edition=>({item,edition})));
    this.shelfEntries=entries;
    if(this.archiveProblem&&!entries.some(entry=>shelfIdentity(entry)===this.archiveProblem.id&&entry.item.project.canArchive))
      this.setArchiveStatus(null,'');
    for(const control of this.list.querySelectorAll('[data-rearchive]'))
      control.setAttribute('aria-disabled',String(Boolean(this.archiveRequest)));
    const signature=JSON.stringify(entries.map(entry=>[shelfIdentity(entry),entry.edition.title,entry.item.project.canArchive===true]));
    if(signature===this.visibleLinks)return;
    const hadFocus=this.list.contains(this.list.ownerDocument.activeElement);
    this.visibleLinks=signature;
    this.hudShelfOptions=entries.map(entry=>({id:shelfIdentity(entry),label:entry.edition.title,canArchive:entry.item.project.canArchive===true}));
    const doc=this.panel.ownerDocument;
    this.list.replaceChildren(...entries.map(({item,edition})=>{
      const row=doc.createElement('li'),link=doc.createElement('a'),button=doc.createElement('button');
      link.textContent=edition.title;
      link.href='/view/'+edition.resource+'?version='+edition.version+'&display=work';
      link.target='_blank';link.rel='noopener';
      button.type='button';button.textContent='A la mesa';
      button.setAttribute('aria-label','Llevar '+edition.title+' a la mesa');
      button.onclick=()=>{
        const current=item.editions.find(candidate=>candidate.resource===edition.resource&&candidate.version===edition.version);
        if(current)this.placeOnTable(item,current);
      };
      row.append(link,button);
      if(item.project.canArchive){
        const archive=doc.createElement('button');
        archive.type='button';archive.textContent='Volver a la vitrina';
        archive.setAttribute('data-rearchive','');
        archive.setAttribute('aria-disabled',String(Boolean(this.archiveRequest)));
        archive.onclick=()=>void this.archiveShelfEdition(shelfIdentity({item,edition}));
        row.append(archive);
      }
      return row;
    }));
    this.panel.hidden=entries.length===0;
    if(hadFocus)(this.list.querySelector('a')??this.panel.ownerDocument.querySelector('#game-canvas'))?.focus({preventScroll:true});
  }

  removeMesh(item){
    item.pending?.abort();item.pending=null;
    if(item.mesh){disposeModel(item.mesh);item.mesh=null;item.levels=null;}
  }

  remove(item){
    this.removeMesh(item);
    item.label.remove();
    this.items.delete(item.project.id);
  }

  clearShadows(){
    for(const shadow of this.shadows?.values()??[])shadow.dispose();
    this.shadows=null;
  }

  clear(){
    this.clearShadows();
    this.events?.close();this.events=null;this.nextStreamAt=0;this.tabletopPlayers.clear();
    this.flight?.abort();this.flight=null;
    this.archiveRequest?.abort();this.archiveRequest=null;this.setArchiveStatus(null,'');
    for(const item of this.items.values())this.remove(item);
    this.nearby=[];this.links([]);this.archive.clear();this.worktable.clear();
    this.room=null;this.root=null;this.refreshAt=0;this.catalogUnavailable=false;
  }
}
