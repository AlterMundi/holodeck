import {indexMatterPart} from './matter-contact.mjs';
import {pointingBounds} from './tabletop-point-view.mjs';
import {Box3,BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshStandardMaterial,Plane,Vector3} from 'three';
import {disposeModel} from './gallery-models.mjs';

const key=edition=>edition.resource+':'+edition.version+':'+edition.gallerySha256;
const selectionKey=(entry,pinned)=>entry?.resource?
  (pinned?entry.resource+':'+entry.version:entry.resource):'';
const same=(a,b)=>a&&b&&key(a)===key(b);
const reviewPrefix=edition=>'/works/'+edition.resource+'/'+edition.version+'/';

function loadReview(base,edition,scene,signal){
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted();
    const worker=new Worker(new URL('client/collection-review-worker.js',base),{type:'module'});
    const finish=(callback,value)=>{
      signal.removeEventListener('abort',abort);
      worker.terminate();
      callback(value);
    };
    const abort=()=>finish(reject,signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>data.review?finish(resolve,data.review):finish(reject,Error('Review unavailable'));
    worker.onerror=()=>finish(reject,Error('Review reader unavailable'));
    worker.postMessage({edition,scene});
  });
}
function makeModel(review,anchor){
  const group=new Group(),inside=new Group(),bounds=new Box3(),parts=new Map();
  group.add(inside);
  try{
    for(const part of review.parts){
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new BufferAttribute(part.positions,3));
      geometry.setIndex(new BufferAttribute(part.indices,1));
      geometry.computeVertexNormals();geometry.computeBoundingBox();
      indexMatterPart(geometry,part.contactIndex);
      const mesh=new Mesh(geometry,new MeshStandardMaterial({color:part.color,roughness:.54,metalness:.12,clipShadows:true}));
      mesh.name=part.id;mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.userData.matterClosed=part.closed;
      inside.add(mesh);parts.set(part.id,mesh);
      bounds.union(geometry.boundingBox);
    }
    const size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
    const scale=Math.min(1.22/Math.hypot(size.x,size.z),.93/size.y);
    if(!Number.isFinite(scale)||scale<=0)throw Error('Empty worktable model');
    inside.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    inside.scale.setScalar(scale);
    group.position.set(anchor.x,anchor.y+.022,anchor.z);
    group.name='collection-worktable-model';
    return {group,parts,height:size.y*scale};
  }catch(error){disposeModel(group);throw error;}
}

function options(select,rows){
  const prior=select.value;
  select.replaceChildren(...rows.map(({id,title})=>{
    const option=select.ownerDocument.createElement('option');
    option.value=id;option.textContent=title;
    return option;
  }));
  if(rows.some(row=>row.id===prior))select.value=prior;
}

export class CollectionWorktable{
  constructor({base,scene,panel,webgl,onSharedChange,onReference,onPoint}){
    Object.assign(this,{base,scene,panel,webgl,onSharedChange,onReference,onPoint,yaw:0,editions:[],hidden:new Set()});
    this.details=panel.querySelector('details');
    this.project=panel.querySelector('[data-project]');
    this.sceneChoice=panel.querySelector('[data-scenes]');
    this.part=panel.querySelector('[data-parts]');
    this.discuss=panel.querySelector('[data-discuss]');
    this.discuss.onclick=()=>this.discussSelection();
    this.status=panel.querySelector('[role=status]:not([data-shared-status])');
    this.sharedStatus=panel.querySelector('[data-shared-status]');
    this.share=panel.querySelector('[data-share]');
    this.follow=panel.querySelector('[data-follow]');
    this.clearTable=panel.querySelector('[data-clear-table]');
    this.share.onclick=()=>this.publish(this.editions.find(edition=>edition.selection===this.selection));
    this.clearTable.onclick=()=>this.publish(null);
    this.follow.onclick=()=>this.followTable();
    this.section=panel.querySelector('[data-section]');
    this.visibility=panel.querySelector('[data-visibility]');
    this.controls=panel.querySelector('fieldset');
    this.project.onchange=()=>this.chooseLocal(this.project.value);
    this.sceneChoice.onchange=()=>this.chooseScene(this.sceneChoice.value);
    this.part.onchange=()=>this.projectModel();
    this.section.oninput=()=>this.projectModel();
    this.visibility.onclick=()=>this.toggleVisibility();
    for(const button of panel.querySelectorAll('[data-turn]'))
      button.onclick=()=>this.turn(Number(button.dataset.turn));
  }

  get reviewCameraTarget(){
    const anchor=this.anchor;
    return anchor?new Vector3(anchor.x,anchor.y+.4,anchor.z):null;
  }

  referenceFor(part){
    const {review,shown}=this;
    return review&&shown?{resource:shown.resource,version:shown.version,scene:review.id,
      sceneVersion:review.version,part}:null;
  }

  discussSelection(){
    const part=this.review?.parts.find(item=>item.id===this.part.value);
    const reference=this.referenceFor(part?.id??null);
    if(!this.discuss.hidden&&reference)this.onReference?.(reference,part?.label??this.review.title);
  }

  pointingTarget(reference,revision){
    if(!reference||this.local||!this.available||this.shared?.revision!==revision||
       reference.resource!==this.shared.resource||
       (this.shared.version&&reference.version!==this.shared.version))return null;
    const current=this.referenceFor(reference.part);
    if(!current||Object.keys(current).some(key=>current[key]!==reference[key]))return null;
    return this.model?.parts.get(reference.part)??null;
  }

  canPoint(reference,revision){
    return !!pointingBounds(this.pointingTarget(reference,revision),this.pointBounds??=new Box3());
  }

  pointSelection(){
    const reference=this.referenceFor(this.part.value);
    const revision=this.shared?.revision;
    if(!this.pointingPending&&this.canPoint(reference,revision))this.onPoint?.(reference,revision);
  }

  followTable(){this.local=false;this.followShared();}

  chooseScene(id){
    if(!this.review?.choices.some(choice=>choice.id===id))return;
    this.requestedScene=id;
    this.load(id);
  }

  choosePart(id){
    if(id!==''&&!this.model?.parts.has(id))return;
    this.part.value=id;
    this.projectModel();
  }

  setSection(fraction){
    if(!Number.isFinite(fraction)||fraction<0||fraction>100)return;
    this.section.value=String(Math.round(fraction));
    this.projectModel();
  }

  turn(direction){
    if(direction!==-1&&direction!==1)return;
    this.yaw+=direction*Math.PI/8;
    this.projectModel();
  }

  toggleVisibility(){
    const id=this.part.value;
    if(!id)return;
    if(this.hidden.has(id))this.hidden.delete(id);else this.hidden.add(id);
    this.projectModel();
  }

  hudState(){
    const choices=select=>Array.from(select.options,option=>({id:option.value,label:option.textContent}));
    const collectionStatus=this.catalogUnavailable?'La colección no está disponible. Volviendo a intentar…':
      'No hay proyectos disponibles para esta mesa.';
    const status=this.editions.length
      ?this.sharedStatus.textContent||this.status.textContent||
        (this.shareRequest?'Actualizando mesa…':this.local?'Inspección local':'Siguiendo la mesa')
      :collectionStatus;
    const reference=this.referenceFor(this.part.value);
    return {
      pointDisabled:this.pointingPending===true||!this.canPoint(reference,this.shared?.revision),
      projects:choices(this.project),project:this.project.value,scenes:choices(this.sceneChoice),scene:this.review?.id??'',
      parts:choices(this.part),part:this.part.value,section:Number(this.section.value),
      ready:!!this.model,hasPart:!!this.part.value,visibility:this.visibility.textContent,
      canShare:!this.share.hidden,canClear:!this.clearTable.hidden,canFollow:!this.follow.hidden,
      canDiscuss:!!this.model&&!this.discuss.hidden,
      busy:!!this.shareRequest,status,revision:this.shared?.revision??null,
    };
  }

  publishSelection(revision,selection){
    if(this.shared?.revision!==revision||selection!==null&&this.selection!==selection){
      this.sharedStatus.textContent='La mesa cambió. Revisá la selección y volvé a intentar.';
      return;
    }
    if(selection===null&&!this.clearTable.hidden)return this.publish(null);
    if(selection!==null&&!this.share.hidden)return this.publish(this.editions.find(edition=>edition.selection===selection));
  }

  update(player,anchor,canDiscuss){
    this.anchor=anchor;
    this.discuss.hidden=!canDiscuss;
    const near=!!(player&&anchor&&Math.hypot(player.x-anchor.x,player.z-anchor.z)<2.05);
    // The room fixture can explain a temporary failure while its protected contents are cleared.
    this.available=near&&!!(this.editions.length||this.selection||this.shared||this.catalogUnavailable);
    this.panel.hidden=!this.available||this.panel.hasAttribute('data-spatial');

  }

  sync(projects,shared,catalogUnavailable=false){
    this.catalogUnavailable=catalogUnavailable===true;
    const editions=(projects??[]).flatMap(project=>project.editions.map(edition=>({
      ...edition,pinned:project.restored===true,selection:selectionKey(edition,project.restored===true),
    })));
    const signature=JSON.stringify(editions.map(edition=>[edition.selection,edition.title]));
    if(signature!==this.signature){
      this.signature=signature;
      options(this.project,[{id:'',title:'Elegí un proyecto'},...editions.map(edition=>({id:edition.selection,title:edition.title}))]);
    }
    this.editions=editions;
    this.shared=shared;
    this.followShared();
    if(!this.selection)return;
    const desired=editions.find(edition=>edition.selection===this.selection);
    if(!desired){this.closeModel();this.updateSharing();return;}
    if(this.shown&&!same(this.shown,desired))this.verifyShown();
    if(!same(this.flight?.edition,desired)&&(!same(this.shown,desired)||!this.model))
      this.load(this.requestedScene);
  }

  followShared(){
    const shared=selectionKey(this.shared,!!this.shared?.version);
    if(!this.local&&shared!==(this.selection??''))this.choose(shared);
    this.updateSharing();
  }

  updateSharing(){
    this.share.hidden=!(this.shared?.canShare&&this.selection&&this.selection!==selectionKey(this.shared,!!this.shared.version));
    this.clearTable.hidden=!(this.shared?.canShare&&this.shared.resource);
    this.follow.hidden=!(this.shared&&this.local);
    this.share.disabled=this.clearTable.disabled=!!this.shareRequest;
  }

  async publish(edition){
    if(this.shareRequest||!this.shared?.canShare||edition===undefined)return;
    const controller=new AbortController();
    this.shareRequest=controller;
    this.updateSharing();
    this.sharedStatus.textContent='';
    try{
      const response=await fetch(new URL('api/space/collection',this.base),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({resource:edition?.resource??null,revision:this.shared.revision,
          ...(edition?.pinned?{version:edition.version}:{})}),
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6500)]),
      });
      if(controller.signal.aborted)return;
      if(response.ok)this.local=false;
      else this.sharedStatus.textContent=response.status===409?'La mesa cambió. Revisá la selección y volvé a intentar.':'No pude actualizar la mesa.';
    }catch{
      if(!controller.signal.aborted)this.sharedStatus.textContent='No pude confirmar el cambio en la mesa.';
    }finally{
      if(this.shareRequest===controller){
        this.shareRequest=null;
        this.updateSharing();
        this.onSharedChange();
      }
    }
  }

  chooseLocal(selection){
    if(selection&&!this.editions.some(edition=>edition.selection===selection))return false;
    this.local=true;
    if(selection!==this.selection)this.choose(selection);
    this.updateSharing();
    return true;
  }

  fromShelf(edition,pinned){
    return this.chooseLocal(selectionKey(edition,pinned));
  }

  partTargets(targets){
    if(!this.available||!this.model)return;
    for(const [id,mesh] of this.model.parts)if(mesh.visible)
      targets.set(mesh,{kind:'worktable-part',id,mesh});
  }

  selectPart({id,mesh}){
    if(!this.available||!mesh.visible||this.model?.parts.get(id)!==mesh)return;
    this.details.open=true;
    this.part.value=id;
    this.projectModel();
    return true;
  }

  choose(selection){
    this.closeModel();
    if(!selection)return;
    this.selection=selection;this.project.value=selection;
    this.load();
  }

  async verifyShown(){
    if(this.lease)return;
    const shown=this.shown,controller=new AbortController();
    this.lease=controller;
    let allowed=false;
    try{
      const response=await fetch(reviewPrefix(shown)+'review-live.json',{cache:'no-store',redirect:'error',
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4500)])});
      allowed=response.ok&&response.headers.get('X-Home-Version')===shown.version;
      await response.body?.cancel();
    }catch{}
    if(this.lease===controller)this.lease=null;
    if(!controller.signal.aborted&&this.shown===shown&&!allowed)this.removeModel();
  }

  async load(sceneId){
    const edition=this.editions.find(item=>item.selection===this.selection);
    if(!edition||!this.anchor)return;
    this.flight?.controller.abort();
    const controller=new AbortController(),flight={controller,edition};
    this.flight=flight;
    this.status.textContent='Cargando modelo…';
    try{
      const review=await loadReview(this.base,edition,sceneId,
        AbortSignal.any([controller.signal,AbortSignal.timeout(26000)]));
      if(this.flight!==flight||controller.signal.aborted)return;
      const replacement=makeModel(review,this.anchor);
      const priorPart=this.part.value;
      this.removeModel();
      this.model=replacement;this.review=review;this.shown=edition;
      this.scene.add(replacement.group);
      if(!review.choices.some(choice=>choice.id===this.requestedScene))this.requestedScene=null;
      options(this.sceneChoice,review.choices);this.sceneChoice.value=review.id;
      options(this.part,[{id:'',title:'Todas las piezas'},...review.parts.map(({id,label})=>({id,title:label}))]);
      if(replacement.parts.has(priorPart))this.part.value=priorPart;
      this.hidden=new Set([...this.hidden].filter(id=>replacement.parts.has(id)));
      this.status.textContent='';
      this.controls.disabled=false;
      this.projectModel();
    }catch{
      if(this.flight===flight&&!controller.signal.aborted){
        this.status.textContent=this.model?'La edición nueva no cargó. Seguís viendo la anterior.':'No pude cargar el modelo.';
        if(this.review)this.sceneChoice.value=this.review.id;
      }
    }finally{if(this.flight===flight)this.flight=null;}
  }

  projectModel(){
    if(!this.model)return;
    const {group,parts,height}=this.model;
    this.model.shadowRevision=(this.model.shadowRevision??0)+1;
    group.rotation.y=this.yaw;
    const fraction=Number(this.section.value)/100;
    const clipping=fraction<1;
    this.webgl.localClippingEnabled=clipping;
    const plane=clipping?[new Plane(new Vector3(0,-1,0),group.position.y+height*fraction)]:null;
    for(const [id,mesh] of parts){
      mesh.visible=!this.hidden.has(id);
      mesh.material.emissive.setHex(id===this.part.value?0x7a4f19:0);
      mesh.material.emissiveIntensity=.65;
      mesh.material.clippingPlanes=plane;
      // The inspection cut opens the mesh. It still casts from the remaining faces.
      mesh.material.shadowSide=clipping?DoubleSide:null;
    }
    this.discuss.textContent=this.part.value?'Conversar sobre esta pieza':'Conversar sobre este modelo';
    this.visibility.disabled=!this.part.value;
    this.visibility.textContent=this.hidden.has(this.part.value)?'Mostrar pieza':'Ocultar pieza';
  }

  removeModel(){
    if(this.model)disposeModel(this.model.group);
    this.model=null;this.shown=null;this.review=null;
    this.controls.disabled=true;this.webgl.localClippingEnabled=false;
  }

  closeModel(){
    this.flight?.controller.abort();this.flight=null;
    this.lease?.abort();this.lease=null;
    this.removeModel();
    this.selection='';this.requestedScene=null;this.project.value='';
    this.yaw=0;this.hidden.clear();this.section.value='100';
    this.sceneChoice.replaceChildren();this.part.replaceChildren();
    this.status.textContent='';
  }

  clear(catalogUnavailable=false){
    this.shareRequest?.abort();this.shareRequest=null;this.local=false;
    this.sharedStatus.textContent='';
    this.closeModel();this.sync([],undefined,catalogUnavailable);this.panel.hidden=true;this.available=false;this.anchor=null;
    this.details.open=!matchMedia('(max-width: 600px)').matches;
  }
}
