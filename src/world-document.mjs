import {EditableNetworkedDOM,LocalObservableDOMFactory} from '@mml-io/networked-dom-server';

// EditableNetworkedDOM.load() returns before its initial snapshot exists, and
// its public isLoaded() cannot distinguish that state. Observe the supported
// factory callback after the real consumer has accepted its snapshot instead.
export class WorldDocument{
 constructor(htmlPath,{factory=LocalObservableDOMFactory,timeoutMs=8000,maxQueued=8}={}){
  if(typeof factory!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||!Number.isInteger(maxQueued)||maxQueued<1||maxQueued>8)throw Error('Select bounded document loading');
  Object.assign(this,{factory,timeoutMs,maxQueued});this.queue=[];this.active=null;this.runners=new Set();this.disposed=false;this.error=null;this.loaded=false;
  this.document=new EditableNetworkedDOM(htmlPath,(parameters,consumer)=>this.createObservable(parameters,consumer));
 }
 createObservable(parameters,consumer){
  const task=this.active;let actual,closed=false;
  const facade={
   addConnectedUserId:(...args)=>actual.addConnectedUserId(...args),
   removeConnectedUserId:(...args)=>actual.removeConnectedUserId(...args),
   dispatchRemoteEventFromConnectionId:(...args)=>actual.dispatchRemoteEventFromConnectionId(...args),
   dispose:()=>{if(closed)return;closed=true;this.runners.delete(facade);actual?.dispose();}
  };
  this.runners.add(facade);
  actual=this.factory(parameters,(message,observable)=>{
   if(this.disposed||this.error||closed)return;
   actual=observable;
   try{
    consumer(message,facade);
    // A synchronous factory can deliver before EditableNetworkedDOM.load's
    // constructor returns. Complete only after that stack has unwound too.
    if(message.snapshot)queueMicrotask(()=>this.complete(task));
   }catch(error){this.fail(error);}
  });
  return facade;
 }
 load(markup,params){
  if(this.disposed||this.error)return Promise.reject(this.error||Error('World document disposed'));
  if(typeof markup!=='string'||Buffer.byteLength(markup)>128*1024)return Promise.reject(Error('World markup exceeds bound'));
  if(this.queue.length+(this.active?1:0)>=this.maxQueued)return Promise.reject(Error('World document load queue is full'));
  return new Promise((resolve,reject)=>{
   const task={markup,params,resolve,reject};
   // Deadline includes queue wait. Expiry fences all later loads; a caller must
   // never receive an applied state after its acknowledgment already failed.
   task.timer=setTimeout(()=>this.fail(Error('World document snapshot deadline exceeded')),this.timeoutMs);
   this.queue.push(task);this.drain();
  });
 }
 drain(){
  if(this.active||this.disposed||this.error||!this.queue.length)return;
  this.active=this.queue.shift();this.loaded=false;
  try{this.document.load(this.active.markup,this.active.params);}catch(error){this.fail(error);}
 }
 complete(task){
  if(!task||this.active!==task||this.disposed||this.error)return;
  clearTimeout(task.timer);this.active=null;this.loaded=true;task.resolve();this.drain();
 }
 fail(error){
  if(this.error||this.disposed)return;
  this.error=error instanceof Error?error:Error('World document failed');this.loaded=false;
  this.rejectPending(this.error);this.cleanup();
 }
 rejectPending(error){
  const tasks=[...(this.active?[this.active]:[]),...this.queue];this.active=null;this.queue=[];
  for(const task of tasks){clearTimeout(task.timer);task.reject(error);}
 }
 cleanup(){
  if(this.cleaning)return;this.cleaning=true;
  queueMicrotask(()=>{
   try{this.document.dispose();}catch(error){this.cleanupError=error;}finally{for(const runner of [...this.runners])try{runner.dispose();}catch{}}
  });
 }
 isLoaded(){return this.loaded&&!this.error&&!this.disposed;}
 addWebSocket(socket){if(this.disposed||this.error){socket.close();return;}this.document.addWebSocket(socket);}
 hasWebSocket(socket){return this.document.hasWebSocket(socket);}
 removeWebSocket(socket){this.document.removeWebSocket(socket);}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.loaded=false;this.rejectPending(Error('World document disposed'));this.cleanup();
 }
}
