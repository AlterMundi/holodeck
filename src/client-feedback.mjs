const hintDuration=4000,hintFade=240;

// Errors and uncertain operations outlast a retry hint.
export class WorldNotice {
 constructor(element,{setTimeout:schedule=(...args)=>globalThis.setTimeout(...args),clearTimeout:cancel=(...args)=>globalThis.clearTimeout(...args),
   clock=Date.now,motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}={}){
  Object.assign(this,{element,schedule,cancel,clock,motion});this.timer=null;this.serial=0;
 }
 get opacity(){
  if(this.expires===undefined||this.motion?.matches)return 1;
  return Math.max(0,Math.min(1,(this.expires-this.clock())/hintFade));
 }
 get temporary(){return this.timer!==null;}
 clear(){
  this.serial++;if(this.timer!==null)this.cancel(this.timer);this.timer=null;this.expires=undefined;
  this.animation?.cancel();this.animation=null;this.element.textContent='';
 }
 show(text,{transient=false,hint=false}={}){
  if(hint&&this.element.textContent&&this.timer===null)return;
  this.clear();this.element.textContent=text;
  if(!transient&&!hint)return;
  if(hint){
   this.expires=this.clock()+hintDuration;
   if(!this.motion?.matches)this.animation=this.element.animate?.([{opacity:1},{opacity:0}],{
     delay:hintDuration-hintFade,duration:hintFade,fill:'forwards'});
  }
  const serial=this.serial;
  this.timer=this.schedule(()=>{if(this.serial===serial)this.clear();},hint?hintDuration:6000);
 }
}
