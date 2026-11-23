import {PerspectiveCamera,Raycaster,Vector2,BoxHelper} from 'three';
import {entityLabel} from './focus.mjs';
const visible=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
export function selectionLabel(id,state){
 const node=state?.nodes?.[id];
 return node&&!node.deleted&&typeof node.title==='string'&&node.title.trim()
  ?`${node.play?'el juego':'el contenido'} «${node.title}»`:entityLabel(id);
}
export class PublicWorldPicker{
 constructor({document,canvas,scene,cameraState,proof,onPick,onUnavailable=()=>{},gallery=()=>null}){
  Object.assign(this,{document,canvas,scene,cameraState,proof,onPick,onUnavailable,gallery});this.ray=new Raycaster();this.camera=new PerspectiveCamera();this.gesture=null;
  this.down=e=>{this.gesture=e.isPrimary!==false&&e.button===0?{id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()}:null;};
  this.move=e=>{if(this.gesture&&Math.hypot(e.clientX-this.gesture.x,e.clientY-this.gesture.y)>6)this.gesture=null;};
  this.cancel=()=>{this.gesture=null;};
  this.up=e=>{
   const g=this.gesture;this.gesture=null;
   if(!g||g.id!==e.pointerId||performance.now()-g.time>800||Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)return;
   const picked=this.pick(e.clientX,e.clientY);if(picked)this.onPick(picked);
  };
  for(const[type,listener]of [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel]])canvas.addEventListener(type,listener);
 }
 hit(x,y,skip=()=>false){
  const state=this.cameraState(),rect=this.canvas.getBoundingClientRect();if(!state||!rect.width||!rect.height)return null;
  Object.assign(this.camera,{fov:state.fov,aspect:state.aspect,near:.01,far:200});this.camera.position.set(state.position.x,state.position.y,state.position.z);
  this.camera.quaternion.set(state.rotation.x,state.rotation.y,state.rotation.z,state.rotation.w);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);this.scene.updateMatrixWorld(true);
  this.ray.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.camera);
  return this.ray.intersectObjects(this.scene.children,true).find(hit=>
    (hit.object.isMesh||hit.object.isSprite)&&!skip(hit.object)&&visible(hit.object)&&
    [hit.object.material].flat().some(material=>material?.visible&&material.opacity>0))??null;
 }
 pick(x,y){
  const gallery=this.gallery();
  if(gallery){
   if(!gallery.size)return null;
   const hit=this.hit(x,y);
   for(let object=hit?.object;object;object=object.parent){
    const entry=gallery.get(object);
    if(entry)return {kind:'gallery',entry};
   }
   return null;
  }
  const root=this.document.querySelector('m-group#workshop'),proof=this.proof();
  if(!root||!proof||proof.run!==root.getAttribute('data-run')||proof.edition!==root.getAttribute('data-edition')||String(proof.sequence)!==root.getAttribute('data-semantic-sequence')){this.onUnavailable();return null;}
  const owners=new Map();
  for(const entity of root.querySelectorAll('m-group[data-entity-revision]')){
   if(!(entity.id==='bridge'||/^(?:garden|node)-[a-z0-9-]{1,40}$/.test(entity.id)))continue;
   const record={target:entity.id,revision:Number(entity.getAttribute('data-entity-revision')),container:entity.getContainer(),element:entity};owners.set(entity.getContainer(),record);
   if(entity.id==='bridge'){const control=root.querySelector('m-group#bridge-control');if(control)owners.set(control.getContainer(),{...record,container:control.getContainer(),element:control});}
  }
  for(const element of root.querySelectorAll('m-group[data-content-node]')){
   const node=element.getAttribute('data-content-node');
   if(node==='reading-room'||/^research-[a-z0-9-]{1,40}$/.test(node))owners.set(element.getContainer(),{kind:'content',node,container:element.getContainer(),element});
  }
  const cues=new Set([...root.querySelectorAll('m-group[data-focus-target]')].map(element=>element.getContainer()));
  const communication=object=>{for(let p=object;p;p=p.parent)if(cues.has(p))return true;return false;};
  const hit=this.hit(x,y,communication);
  if(!hit)return null;
  for(let object=hit.object;object;object=object.parent){const owner=owners.get(object);if(owner)return {...owner,run:proof.run,edition:proof.edition};}
  return null; // Visible scenery/private preview occludes objects behind it.
 }
 dispose(){for(const[type,listener]of [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel]])this.canvas.removeEventListener(type,listener);this.cancel();}
}
export class WorldIndication{
 constructor({document,scene,getState,set,clear,edit,visit}){
  Object.assign(this,{document,scene,getState,set,clear,edit,visit});this.selected=null;this.panel=document.querySelector('#pointing');this.send=document.querySelector('#point-send');this.cancel=document.querySelector('#point-clear');this.editButton=document.querySelector('#point-edit');this.visitButton=document.querySelector('#point-visit');
  this.send.onclick=async()=>{if(this.selected)await set(this.selected);};
  if(this.editButton)this.editButton.onclick=()=>{if(this.editable())edit?.(this.selected);};
  if(this.visitButton)this.visitButton.onclick=()=>{if(this.visitable())visit(this.selected);};
  this.cancel.onclick=async()=>{this.selected=null;this.removeOutline();const own=this.own();if(own)await clear(own);this.update();};
 }
 own(){const state=this.getState();return state?.focus?.find(signal=>signal.actor===state.actorRef);}
 select(record){this.selected=record;this.removeOutline();this.outline=new BoxHelper(record.container,0xc7ecff);this.scene.add(this.outline);this.update();}
 removeOutline(){if(!this.outline)return;this.outline.removeFromParent();this.outline.geometry.dispose();this.outline.material.dispose();this.outline=null;}
 current(){
  const s=this.selected,root=this.document.querySelector('m-group#workshop');if(!s||!root)return false;
  return !!s.element?.isConnected&&root.contains(s.element)&&s.element.getContainer()===s.container&&root.getAttribute('data-run')===s.run&&root.getAttribute('data-edition')===s.edition&&root.querySelector(`[id="${s.target}"]`)?.getAttribute('data-entity-revision')===String(s.revision);
 }
 editable(){const s=this.selected,entity=this.getState()?.entities?.[s?.target];return !!this.edit&&this.current()&&s.target.startsWith('garden-')&&!!entity&&!entity.deleted&&entity.revision===s.revision;}
 visitable(){const s=this.selected,node=this.getState()?.nodes?.[s?.target];return !!this.visit&&this.current()&&!!node&&!node.deleted&&!node.play&&node.revision===s.revision;}
 update(){
  const state=this.getState(),own=this.own(),selected=this.selected,current=this.current();
  const shared=current&&own?.target===selected.target&&own.revision===selected.revision&&own.status==='current';
  if(this.outline){this.outline.visible=current&&!shared;if(this.outline.visible)this.outline.update();}
  const content=this.document.querySelector('#content-visit');
  const busyPanel=!this.document.querySelector('#conversation-panel').hidden||!this.document.querySelector('#creator').hidden||(content&&!content.hidden&&!content.classList.contains('is-walking'));
  this.panel.hidden=(!selected&&!own)||busyPanel;
  const message=selected&&!shared?(current?`Elegiste ${selectionLabel(selected.target,state)}.`:'El objeto cambió. Volvé a elegirlo.'):
   own?(own.status==='current'?`Compartiste ${selectionLabel(own.target,state)} como referencia.`:own.status==='deleted'?'El objeto que señalaste fue retirado.':'El objeto que señalaste cambió.'):'';
  this.document.querySelector('#point-label').textContent=message;this.send.hidden=!selected||!current||shared;this.cancel.textContent=own?'Dejar de señalar':'Cancelar';
  if(this.editButton)this.editButton.hidden=!this.editable();
  if(this.visitButton)this.visitButton.hidden=!this.visitable();
  this.send.classList.toggle('primary',!this.visitable());
  const active=this.document.activeElement;if((this.panel.hidden&&this.panel.contains(active))||(this.send.hidden&&active===this.send))active?.blur();
  if(state&&selected&&state.run!==selected.run){this.selected=null;this.removeOutline();}
 }
 dispose(){this.removeOutline();}
}
