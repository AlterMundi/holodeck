// Only correlation and immutable machine context cross this boundary.
// Canonical Conversation retains all human content, drafts, media and sends.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const topicKey=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const SCHEMA='conversation.surface/v1';
const bounded=value=>{try{return JSON.stringify(value).length<=8192;}catch{return false;}};
export class SharedConversationHost{
  constructor({window,document,container,api,capture,currentActor,onStatus=()=>{},onError=()=>{}}){
    Object.assign(this,{window,document,container,api,capture,currentActor,onStatus,onError});
    this.records=new Map();this.topicReady=[];this.visit=window.crypto.randomUUID();this.receive=this.receive.bind(this);
    window.addEventListener('message',this.receive);
  }
  async mount(){
    if(this.mounting)return this.mounting;
    this.mounting=this.install();
    try{return await this.mounting;}catch(error){this.mounting=null;throw error;}
  }
  async install(){
    const selected=await this.api('conversation-surface');
    if(this.closed)throw Error('La conversación se cerró.');
    if(selected.schema!=='holodeck.conversation-surface/v1'||selected.actorRef!==this.currentActor()
      ||!/^[a-f0-9]{64}$/.test(selected.binding||''))throw Error('Tu acceso cambió. Volvé a entrar al mundo.');
    const target=new URL(selected.url);
    if(target.protocol!=='https:'||target.username||target.password||target.hash||target.search)throw Error('No pude abrir tu conversación.');
    this.selected=selected;this.origin=target.origin;
    target.searchParams.set('view','conversation');target.searchParams.set('client','standalone');
    target.searchParams.set('surface','holodeck');target.searchParams.set('surface_parent',this.window.location.origin);
    target.searchParams.set('surface_visit',this.visit);
    const frame=this.document.createElement('iframe');frame.title='Conversación con tu daimon';
    frame.allow=`microphone ${this.origin}; autoplay ${this.origin}`;frame.referrerPolicy='origin';
    this.frame=frame;frame.src=target.href;this.container.append(frame);
  }
  envelope(d){return {schema:SCHEMA,type:d.type,visit:this.visit,channel:d.channel,actor:this.selected.actorRef,binding:this.selected.binding};}
  send(d,type,fields={}){if(!this.closed)this.frame.contentWindow.postMessage({...this.envelope(d),type,...fields},this.origin);}
  valid(event){
    const d=event.data;
    return !this.closed&&this.frame&&event.source===this.frame.contentWindow&&event.origin===this.origin
      &&d&&typeof d==='object'&&bounded(d)&&d.schema===SCHEMA&&d.visit===this.visit
      &&d.actor===this.selected.actorRef&&d.actor===this.currentActor()&&d.binding===this.selected.binding&&UUID.test(d.channel||'');
  }
  receive(event){
    if(!this.valid(event))return;
    const d=event.data;
    if(d.type==='ready'){
      // A reload establishes a fresh channel; old async replies stay on the old channel.
      if(this.channel!==d.channel)this.finishTopicRead(Error('La conexión cambió.'));
      this.channel=d.channel;this.supportsTopics=d.features?.topicRooms===true;
      this.send(d,'connect',this.supportsTopics?{features:{topicRooms:true}}:{});
      for(const ready of this.topicReady.splice(0))ready();
      return;
    }
    if(d.channel!==this.channel)return;
    if(d.type==='topic-rooms-readback')this.receiveTopicRead(d);
    else if(d.type==='prepare')this.prepare(d).catch(()=>{});
    else if(d.type==='status'&&this.records.has(d.id)&&typeof d.phase==='string'&&d.phase.length<=64&&typeof d.busy==='boolean'){
      this.onStatus({phase:d.phase,busy:d.busy});
      // This is a UI hint only. The server verifies real canonical terminal state.
      if(!d.busy)this.api(`conversation-contexts/${d.id}/release`,{}).then(value=>{if(value.released)this.records.delete(d.id);}).catch(()=>{});
    }else if(d.type==='discard'&&this.records.has(d.id)&&['capture-cancelled','preparation-failed'].includes(d.reason)){
      const record=this.records.get(d.id);record.discarded=true;record.reason=d.reason;
      this.api(`conversation-contexts/${d.id}/discard`,{binding:d.binding,reason:d.reason})
        .then(value=>{if(value.released)this.records.delete(d.id);}).catch(()=>{});
    }
  }
  async readTopicRooms({room,after}={}){
    if(room!==undefined&&!topicKey(room)||after!==undefined&&!topicKey(after)||
      room!==undefined&&after!==undefined)throw Error('Seleccioná un topic válido.');
    await this.mount();
    if(!this.channel)await new Promise((resolve,reject)=>{
      const ready=()=>{clearTimeout(timeout);resolve();};
      const timeout=setTimeout(()=>{
        this.topicReady=this.topicReady.filter(item=>item!==ready);
        reject(Error('No pude conectar con tus topics.'));
      },8000);
      this.topicReady.push(ready);
    });
    if(this.closed||!this.supportsTopics||this.currentActor()!==this.selected.actorRef)
      throw Error('Tus topics todavía no están disponibles acá.');
    if(this.topicRead)throw Error('La lectura anterior sigue pendiente.');
    const request=this.window.crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.finishTopicRead(Error('No pude confirmar tus topics.')),8000);
      this.topicRead={request,room,after,resolve,reject,timer};
      this.send({channel:this.channel},'topic-rooms-read',{request,...(room?{room}:{}),...(after?{after}:{})});
    });
  }
  receiveTopicRead(d){
    const wanted=this.topicRead;
    if(!wanted||d.request!==wanted.request)return;
    const rows=d.rooms;
    if(d.unavailable||!Array.isArray(rows)||rows.length>12||
      rows.some((row,index)=>!row||Object.keys(row).sort().join(',')!=='direct_available,general,room,title'||
        !topicKey(row.room)||typeof row.title!=='string'||Array.from(row.title).length>80||
        typeof row.general!=='boolean'||typeof row.direct_available!=='boolean'||
        row.room<=(index>0?rows[index-1].room:wanted.after??''))||
      !(d.next===null||rows.length===12&&d.next===rows.at(-1).room)||
      wanted.room&&(rows.length!==1||rows[0].room!==wanted.room||d.next!==null)){
      this.finishTopicRead(Error('Ese topic no está disponible.'));
      return;
    }
    this.finishTopicRead(null,{rooms:rows,next:d.next});
  }
  finishTopicRead(error,value){
    const read=this.topicRead;
    if(!read)return;
    this.topicRead=undefined;
    clearTimeout(read.timer);
    if(error)read.reject(error);
    else read.resolve(value);
  }
  async prepare(d){
    if(!UUID.test(d.id||'')||!UUID.test(d.request||'')||!['text','audio'].includes(d.modality)
      ||!Number.isSafeInteger(d.capacity?.files)||d.capacity.files<1||d.capacity.files>8
      ||!Number.isSafeInteger(d.capacity?.bytes)||d.capacity.bytes<65536||d.capacity.bytes>40*1024*1024
      ||d.capacity.context_bytes!==65536)return;
    let record=this.records.get(d.id);
    if(record&&(record.request!==d.request||record.channel!==d.channel||record.modality!==d.modality))return;
    if(!record){
      if(this.records.size>=128){const old=[...this.records].find(([,value])=>value.prepared&&!value.discarded);if(old)this.records.delete(old[0]);}
      if(this.records.size>=128){this.send(d,'error',{request:d.request,id:d.id,message:'Hay intervenciones por confirmar. Conservá tu borrador.'});return;}
      // capture() copies world position synchronously before its first await.
      record={request:d.request,channel:d.channel,modality:d.modality};this.records.set(d.id,record);
      record.work=(async()=>{
        const view=await this.capture();
        if(record.discarded||this.currentActor()!==d.actor||this.closed)throw Error('El acceso al mundo cambió.');
        const result=await this.api('conversation-contexts',{id:d.id,binding:d.binding,displayedSequence:null,view});
        if(result.id!==d.id||result.binding!==d.binding||result.work_admitted!==false||result.files?.length!==1)throw Error('No pude conservar el contexto.');
        record.prepared=true;
        if(record.discarded)this.api(`conversation-contexts/${d.id}/discard`,{binding:d.binding,reason:record.reason}).then(value=>{if(value.released)this.records.delete(d.id);}).catch(()=>{});
        return result.files[0];
      })();
    }
    try{
      const file=await record.work;
      if(!record.discarded&&this.channel===d.channel&&this.currentActor()===d.actor)this.send(d,'prepared',{request:d.request,id:d.id,file});
    }catch{
      if(!record.discarded&&this.channel===d.channel)this.send(d,'error',{request:d.request,id:d.id,message:'No pude conservar el contexto de este lugar. Tu borrador sigue en la conversación.'});
    }
  }
  dispose(){this.closed=true;this.finishTopicRead(Error('La conversación se cerró.'));for(const ready of this.topicReady.splice(0))ready();this.window.removeEventListener('message',this.receive);this.frame?.remove();}
}
