import {disposeModel,placeGalleryModel} from './gallery-models.mjs';
import {staticModelLevels,wantsDetailedModel} from './static-model-lod.mjs';

const identity=edition=>edition.resource+':'+edition.version;
const fullKey=edition=>identity(edition)+':'+(edition.representative?.sha256??'');
const hex=(value,length)=>typeof value==='string'&&value.length===length&&/^[a-f0-9]+$/.test(value);

export class CollectionArchive{
  constructor({base,scene,panel,loader,readModel,onRestored}){
    Object.assign(this,{base,scene,panel,loader,readModel,onRestored,entries:[],angle:0});
    this.name=panel.querySelector('strong');
    this.count=panel.querySelector('output');
    this.inspect=panel.querySelector('a');
    this.restore=panel.querySelector('[data-restore]');
    this.status=panel.querySelector('[role=status]');
    this.restore.onclick=()=>this.returnToShelf();
    this.previous=panel.querySelector('[data-previous]');
    this.next=panel.querySelector('[data-next]');
    this.previous.onclick=()=>this.step(-1);
    this.next.onclick=()=>this.step(1);
  }

  get shadowModel(){
    return this.levels?.low?.visible?this.levels.low:this.levels?.detail;
  }

  sync(data,root){
    this.root=root;
    this.anchor=data?.anchor;
    this.canRestore=data?.canRestore===true;
    this.entries=(Array.isArray(data?.editions)?data.editions.slice(0,6):[]).filter(edition=>
      hex(edition.resource,32)&&hex(edition.version,64)&&typeof edition.label==='string');
    const prior=this.edition&&identity(this.edition);
    const equivalent=this.entries.find(edition=>identity(edition)===prior);
    this.select(this.anchor&&(equivalent??this.entries[0]));
  }

  select(edition){
    if(edition&&this.edition&&fullKey(edition)===fullKey(this.edition)&&edition.label===this.edition.label){
      this.edition=edition;
      this.controls();
      return;
    }
    this.removeModel();
    this.label?.remove();this.label=null;
    this.edition=edition;
    this.status.textContent='';
    if(edition){
      const label=this.root.ownerDocument.createElement('m-label');
      const chars=Array.from(edition.label),short=chars.length>35?chars.slice(0,34).join('')+'…':edition.label;
      const values={content:short,x:this.anchor.x,y:1.12,z:this.anchor.z+.75,
        width:2.01,height:.165,'font-size':12,padding:4,alignment:'center',color:'#19332f','font-color':'#fff0cc',
        collide:'false'};
      for(const [key,value] of Object.entries(values))label.setAttribute(key,String(value));
      label.setAttribute('data-collection-archive','');
      this.root.append(label);
      this.label=label;
    }
    this.controls();
  }

  controls(){
    const edition=this.edition;
    this.restore.hidden=!edition||!this.canRestore;
    this.restore.disabled=!!this.restoring;
    if(!edition){
      this.panel.hidden=true;
      this.name.textContent='';
      this.count.value='';
      this.inspect.removeAttribute('href');
      return;
    }
    this.name.textContent=edition.label;
    const index=this.entries.findIndex(item=>identity(item)===identity(edition));
    this.count.value=(index+1)+' / '+this.entries.length;
    this.previous.disabled=this.next.disabled=this.entries.length<2;
    this.inspect.href='/view/'+edition.resource+'?version='+edition.version+'&display=work';
  }

  async returnToShelf(){
    if(this.panel.hidden||!this.canRestore||!this.edition||this.restoring)return;
    const {resource,version}=this.edition;
    const controller=new AbortController();
    this.restoring=controller;this.restore.disabled=true;this.status.textContent='';
    try{
      const response=await fetch(new URL('api/space/collection/archive',this.base),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({resource,version}),
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8500)]),
      });
      if(controller.signal.aborted)return;
      this.status.textContent=response.ok?'La edición volvió a la repisa.':'No pude devolver esta edición a la repisa.';
    }catch{
      if(!controller.signal.aborted)this.status.textContent='No pude confirmar el cambio. Podés comprobarlo en la repisa.';
    }finally{
      if(this.restoring===controller){
        this.restoring=null;this.restore.disabled=false;
        this.onRestored();
      }
    }
  }

  step(direction){
    if(this.panel.hidden||!this.edition||this.entries.length<2)return;
    const index=this.entries.findIndex(item=>identity(item)===identity(this.edition));
    this.turn={start:performance.now(),from:this.angle,direction};
    this.select(this.entries[(index+direction+this.entries.length)%this.entries.length]);
  }

  update(player,camera,pixels){
    if(!this.edition||!player)return;
    const distance=Math.hypot(player.x-this.anchor.x,player.z-this.anchor.z);
    this.panel.hidden=distance>2.15;
    const near=wantsDetailedModel({anchor:this.anchor,diameter:.88,distance,camera,pixels,near:this.levels?.near});
    this.levels?.setNear(near);
    if(this.edition.representative&&!this.mesh&&!this.pending&&performance.now()>=(this.retryAt??0))this.load(near);
    if(this.turn){
      const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:620;
      const progress=Math.min(1,(performance.now()-this.turn.start)/duration);
      const ease=progress*progress*(3-2*progress);
      this.angle=this.turn.from+this.turn.direction*Math.PI*ease;
      if(progress===1){this.turn=null;this.angle%=2*Math.PI;}
      const platform=this.root.querySelector('#room-art')?.getContainer?.().getObjectByName('archive_turntable_platform');
      if(platform)platform.rotation.y=this.angle;
      if(this.mesh)this.mesh.rotation.y=this.angle;
    }
  }

  async load(near){
    const controller=new AbortController(),edition=this.edition;
    this.pending=controller;
    try{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]);
      const payload=await this.readModel(edition,signal);
      const {scene}=await this.loader.parseAsync(payload,'');
      if(signal.aborted){disposeModel(scene);return;}
      const model=placeGalleryModel(scene,{x:0,y:0,z:0},{width:.88,depth:.88,height:.62});
      this.levels=staticModelLevels(model,near);
      const mesh=this.levels.group;
      mesh.name='collection-archive-model';
      mesh.position.set(this.anchor.x,this.anchor.y,this.anchor.z);
      mesh.rotation.y=this.angle;
      this.scene.add(mesh);this.mesh=mesh;
    }catch{
      if(!controller.signal.aborted)this.retryAt=performance.now()+12000;
    }finally{
      if(this.pending===controller)this.pending=null;
    }
  }

  removeModel(){
    this.pending?.abort();this.pending=null;this.retryAt=0;
    if(this.mesh){disposeModel(this.mesh);this.mesh=null;this.levels=null;}
  }

  clear(){
    this.restoring?.abort();this.restoring=null;
    this.entries=[];
    this.select(null);
    this.root=null;this.anchor=null;this.angle=0;this.turn=null;
  }
}
