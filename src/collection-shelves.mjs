import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel,placeGalleryModel} from './gallery-models.mjs';

const REFRESH_MS=12000;
const MODEL_LIMIT=384*1024;
const hex=(value,length)=>typeof value==='string'&&value.length===length&&/^[a-f0-9]+$/.test(value);
const distance=(point,anchor)=>Math.hypot(point.x-anchor.x,point.z-anchor.z);
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
  constructor({base,scene,panel}){
    Object.assign(this,{base,scene,panel,loader:new GLTFLoader()});
    this.items=new Map();
    this.list=panel.querySelector('ul');
    this.visibleLinks='';
  }

  update(room,root,player){
    if(this.room!==room||this.root!==root){
      this.clear();
      this.room=room;this.root=root;
    }
    if(!room||!root||!player)return;
    const now=performance.now();
    if(!this.flight&&now>=(this.refreshAt??0))this.refresh();
    const nearest=[...this.items.values()].map(item=>({item,distance:distance(player,item.project.anchor)}))
      .filter(value=>value.distance<=5.8).sort((a,b)=>a.distance-b.distance);
    const visible=new Set(nearest.slice(0,3).map(value=>value.item));
    for(const item of this.items.values()){
      if(!visible.has(item)){this.removeMesh(item);continue;}
      if(item.edition.representative&&!item.mesh&&!item.pending&&now>=(item.retryAt??0))this.load(item);
    }
    this.links(nearest.filter(value=>value.distance<=1.85).map(value=>value.item));
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
      this.sync(data?.room===this.room?data.projects:[]);
    }catch{
      if(!controller.signal.aborted)this.sync([]);
    }finally{
      if(this.flight===controller)this.flight=null;
    }
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
        existing.editions=editions;
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

  async load(item){
    const controller=new AbortController();
    item.pending=controller;
    try{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]);
      const payload=await modelBytes(this.base,item.edition,signal);
      const {scene}=await this.loader.parseAsync(payload,'');
      if(signal.aborted){disposeModel(scene);return;}
      item.mesh=placeGalleryModel(scene,item.project.anchor,{width:.64,depth:1.13,height:.47});
      item.mesh.name='collection-'+item.project.id;
      this.scene.add(item.mesh);
    }catch{item.retryAt=performance.now()+REFRESH_MS;}
    finally{if(item.pending===controller)item.pending=null;}
  }

  links(items){
    const entries=items.flatMap(item=>item.editions);
    const signature=JSON.stringify(entries.map(edition=>[edition.resource,edition.version,edition.title]));
    if(signature===this.visibleLinks)return;
    this.visibleLinks=signature;
    const doc=this.panel.ownerDocument;
    this.list.replaceChildren(...entries.map(edition=>{
      const row=doc.createElement('li'),link=doc.createElement('a');
      link.textContent=edition.title;
      link.href='/view/'+edition.resource+'?version='+edition.version+'&display=work';
      link.target='_blank';link.rel='noopener';
      row.append(link);
      return row;
    }));
    this.panel.hidden=entries.length===0;
  }

  removeMesh(item){
    item.pending?.abort();item.pending=null;
    if(item.mesh){disposeModel(item.mesh);item.mesh=null;}
  }

  remove(item){
    this.removeMesh(item);
    item.label.remove();
    this.items.delete(item.project.id);
  }

  clear(){
    this.flight?.abort();this.flight=null;
    for(const item of this.items.values())this.remove(item);
    this.links([]);
    this.room=null;this.root=null;this.refreshAt=0;
  }
}
