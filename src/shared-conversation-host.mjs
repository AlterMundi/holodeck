// Only correlation and immutable machine context cross this boundary.
// Canonical Conversation retains all human content, drafts, media and sends.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SCHEMA='conversation.surface/v1';
const machineMode='owner-journal/v1';
const bounded=value=>{try{return JSON.stringify(value).length<=8192;}catch{return false;}};
export class SharedConversationHost{
  constructor({window,document,container,api,capture,currentActor,onStatus=()=>{},onError=()=>{},onSpeechLevel}){
    Object.assign(this,{window,document,container,api,capture,currentActor,onStatus,onError,onSpeechLevel});
    this.records=new Map();this.visit=window.crypto.randomUUID();this.receive=this.receive.bind(this);
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
      this.onSpeechLevel?.(0);
      if(this.channel!==d.channel){
        this.channel=d.channel;
        this.mode=d.features?.machineSource===true&&this.selected.machineSource===machineMode?machineMode:undefined;
      }
      this.send(d,'connect',{features:{...(this.onSpeechLevel?{avatarPlayback:true}:{}),...(this.mode?{machineSource:this.mode}:{})}});return;
    }
    if(d.channel!==this.channel)return;
    if(d.type==='avatar-playback'&&typeof d.level==='number'&&Number.isFinite(d.level)&&d.level>=0&&d.level<=1){
      this.onSpeechLevel?.(d.level);
    }else if(d.type==='prepare')this.prepare(d).catch(()=>{});
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
  async prepare(d){
    const inline=d.mode===machineMode;
    if(!UUID.test(d.id||'')||!UUID.test(d.request||'')||!['text','audio'].includes(d.modality)
      ||!Number.isSafeInteger(d.capacity?.files)||d.capacity.files<(inline?0:1)||d.capacity.files>8
      ||!Number.isSafeInteger(d.capacity?.bytes)||d.capacity.bytes<(inline?0:65536)||d.capacity.bytes>40*1024*1024
      ||d.capacity.context_bytes!==65536)return;
    if(d.mode!==this.mode){this.send(d,'error',{request:d.request,id:d.id,message:'La conexión del contexto cambió. Conservá tu borrador.'});return;}
    let record=this.records.get(d.id);
    if(record&&(record.request!==d.request||record.channel!==d.channel||record.modality!==d.modality||record.mode!==d.mode))return;
    if(!record){
      if(this.records.size>=128){const old=[...this.records].find(([,value])=>value.prepared&&!value.discarded);if(old)this.records.delete(old[0]);}
      if(this.records.size>=128){this.send(d,'error',{request:d.request,id:d.id,message:'Hay intervenciones por confirmar. Conservá tu borrador.'});return;}
      // capture() copies world position synchronously before its first await.
      record={request:d.request,channel:d.channel,modality:d.modality,mode:d.mode};this.records.set(d.id,record);
      record.work=(async()=>{
        const view=await this.capture();
        if(record.discarded||this.currentActor()!==d.actor||this.closed)throw Error('El acceso al mundo cambió.');
        const result=await this.api('conversation-contexts',{id:d.id,binding:d.binding,displayedSequence:null,view,...(inline?{mode:machineMode}:{})});
        if(result.id!==d.id||result.binding!==d.binding||result.work_admitted!==false||(inline?
          !UUID.test(result.machine_source||'')||result.files?.length!==0:
          result.files?.length!==1||result.machine_source!==undefined))throw Error('No pude conservar el contexto.');
        record.prepared=true;
        if(record.discarded)this.api(`conversation-contexts/${d.id}/discard`,{binding:d.binding,reason:record.reason}).then(value=>{if(value.released)this.records.delete(d.id);}).catch(()=>{});
        return inline?{machine_source:result.machine_source}:{file:result.files[0]};
      })();
    }
    try{
      const source=await record.work;
      if(!record.discarded&&this.channel===d.channel&&this.currentActor()===d.actor)this.send(d,'prepared',{request:d.request,id:d.id,...source});
    }catch{
      if(!record.discarded&&this.channel===d.channel)this.send(d,'error',{request:d.request,id:d.id,message:'No pude conservar el contexto de este lugar. Tu borrador sigue en la conversación.'});
    }
  }
  dispose(){this.closed=true;this.onSpeechLevel?.(0);this.window.removeEventListener('message',this.receive);this.frame?.remove();}
}
