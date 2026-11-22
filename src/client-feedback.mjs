// Only explicitly confirmed success/navigation messages expire. Errors and
// uncertain operations stay visible until another deliberate message replaces them.
export class WorldNotice {
 constructor(element,{setTimeout:schedule=(...args)=>globalThis.setTimeout(...args),clearTimeout:cancel=(...args)=>globalThis.clearTimeout(...args)}={}){
  Object.assign(this,{element,schedule,cancel});this.timer=null;this.serial=0;
 }
 clear(){this.serial++;if(this.timer!==null)this.cancel(this.timer);this.timer=null;this.element.textContent='';}
 show(text,{transient=false}={}){
  this.clear();this.element.textContent=text;
  if(transient){const serial=this.serial;this.timer=this.schedule(()=>{if(this.serial===serial){this.element.textContent='';this.timer=null;}},6000);}
 }
}
