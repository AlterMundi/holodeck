import {CanvasTexture,Sprite,SpriteMaterial,SRGBColorSpace} from 'three';
import {AVATARS} from './avatar-registry.mjs';

export function avatarMarkers(document){
 return [...document.querySelectorAll('m-group[data-holodeck-avatar]')].filter(marker=>{
  const entry=AVATARS[marker.getAttribute('data-holodeck-avatar')];
  return entry&&entry.being===marker.getAttribute('data-avatar-being');
 }).slice(0,8);
}
export class NativeAvatarLayer{
 constructor({document,base,onFailure=()=>{},now=()=>performance.now()}){
  Object.assign(this,{document,base,onFailure,now});this.items=new Map();this.sources=new Map();this.disposed=false;
  this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.failures=new Set();
 }
 async source(ref){
  if(!this.sources.has(ref))this.sources.set(ref,(async()=>{
   const entry=AVATARS[ref],response=await fetch(new URL(entry.design,this.base),{signal:AbortSignal.timeout(4000)});
   if(!response.ok)throw Error('Appearance unavailable');
   // Bound retained bytes even if an unexpected response streams without length.
   const reader=response.body.getReader(),chunks=[];let count=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>entry.maxBytes)throw Error('Appearance exceeds bound');chunks.push(value);}}
   finally{await reader.cancel().catch(()=>{});}
   const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(hash!==entry.sha256)throw Error('Appearance revision changed');
   const renderer=await import(/* @vite-ignore */ new URL(entry.renderer,this.base).href);
   return {design:JSON.parse(new TextDecoder().decode(bytes)),prepare:renderer.prepare};
  })());
  return this.sources.get(ref);
 }
 add(marker){
  const ref=marker.getAttribute('data-holodeck-avatar'),entry=AVATARS[ref];
  const item={marker,ref,frame:0,last:-Infinity,loading:true};this.items.set(marker,item);
  this.source(ref).then(({design,prepare})=>{
   if(this.disposed||this.items.get(marker)!==item||!marker.isConnected)return;
   const holder=this.document.createElement('div');holder.className='voice-mode-portrait';holder.setAttribute('aria-hidden','true');
   Object.assign(holder.style,{position:'fixed',left:'-10000px',top:'0',width:'256px',height:'320px',opacity:'0',pointerEvents:'none'});
   const canvas=this.document.createElement('canvas');Object.assign(canvas.style,{width:'256px',height:'320px'});holder.append(canvas);this.document.body.append(holder);item.holder=holder;
   item.paint=prepare(canvas,design);item.texture=new CanvasTexture(canvas);item.texture.colorSpace=SRGBColorSpace;item.texture.generateMipmaps=false;
   item.sprite=new Sprite(new SpriteMaterial({map:item.texture,transparent:true,depthWrite:false,alphaTest:.01}));
   item.sprite.center.set(.5,0);item.sprite.scale.set(entry.width,entry.height,1);item.sprite.userData.holodeckAppearance=ref;
   item.loading=false;this.apply(item);
  }).catch(()=>{
   item.failed=true;this.release(item);
   if(!this.disposed&&!this.failures.has(ref)){this.failures.add(ref);this.onFailure('Mi figura no pudo cargarse. Sigo presente como una luz.');}
  });
 }
 apply(item){
  const group=item.marker.getContainer?.(),fallback=item.marker.querySelector(`[id="${item.marker.id}-fallback"]`)?.getContainer?.();
  if(!group||!item.sprite||!item.marker.isConnected)return;
  if(item.sprite.parent!==group)group.add(item.sprite);
  if(fallback){item.fallback=fallback;fallback.visible=false;}
 }
 update(){
  if(this.disposed)return;
  const markers=new Set(avatarMarkers(this.document));
  for(const [marker,item]of this.items)if(!markers.has(marker)){this.release(item);this.items.delete(marker);}
  for(const marker of markers)if(!this.items.has(marker))this.add(marker);
  const now=this.now();
  for(const item of this.items.values()){
   if(item.loading||item.failed||!item.sprite)continue;
   this.apply(item);
   if(this.document.hidden||this.motion.matches||now-item.last<Math.max(166,item.paint.frameMs||180))continue;
   item.last=now;item.paint(item.frame=(item.frame+1)%Math.min(120,item.paint.frames||12));item.texture.needsUpdate=true;
  }
 }
 release(item){
  if(item.fallback)item.fallback.visible=true;
  item.sprite?.removeFromParent();item.sprite?.material.dispose();item.texture?.dispose();item.holder?.remove();
  item.sprite=null;item.texture=null;item.holder=null;
 }
 status(){return {instances:this.items.size,ready:[...this.items.values()].filter(i=>!!i.sprite).length,frames:[...this.items.values()].map(i=>i.frame),paused:this.document.hidden||this.motion.matches,disposed:this.disposed};}
 dispose(){this.disposed=true;for(const item of this.items.values())this.release(item);this.items.clear();this.sources.clear();}
}
