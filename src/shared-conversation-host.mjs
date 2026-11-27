// Only correlation and immutable machine context cross this boundary.
// Canonical Conversation retains all human content, drafts, media and sends.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SCHEMA='conversation.surface/v1';
const microphoneLifetime=300;
const machineMode='owner-journal/v1';
const bounded=value=>{try{return JSON.stringify(value).length<=8192;}catch{return false;}};
export class SharedConversationHost{
  constructor({window,document,container,api,capture,currentActor,onDismiss,onVoiceControls=()=>{},onStatus=()=>{},onError=()=>{},onSpeechLevel,avatarMicrophone=false}){
    Object.assign(this,{window,document,container,api,capture,currentActor,onDismiss,onVoiceControls,onStatus,onError,onSpeechLevel,avatarMicrophone});
    this.records=new Map();this.visit=window.crypto.randomUUID();this.receive=this.receive.bind(this);
    window.addEventListener('message',this.receive);
    this.clearMicrophone=()=>{this.microphoneSample=null;};
    if(avatarMicrophone)document.addEventListener('visibilitychange',this.clearMicrophone);
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
    if(target.origin===this.window.location.origin&&typeof this.onDismiss==='function')
      frame.addEventListener('load',()=>this.bindLocalDismiss(frame));
    this.target=target;this.frame=frame;frame.src=target.href;this.container.append(frame);
  }
  bindLocalDismiss(frame){
    this.localDismiss?.abort();
    if(this.closed||frame!==this.frame)return;
    this.voiceObserver?.disconnect();
    const page=this.composerDocument();
    if(!page)return;
    this.voiceObserver=new page.defaultView.MutationObserver(()=>this.syncVoiceControls());
    for(const node of page.querySelectorAll('#conversation-talk,#conversation-voice-replies'))
      this.voiceObserver.observe(node,{attributes:true,attributeFilter:['aria-pressed','disabled']});
    this.syncVoiceControls();
    // Older same-origin shells can share the shortcut without forwarding any
    // data. Once the child negotiates dismissal it owns the key.
    this.localDismiss=new page.defaultView.AbortController();
    page.defaultView.addEventListener('keydown',event=>{
      if(this.closed||event.key!=='Escape'||event.isComposing)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(!event.repeat)this.onDismiss();
    },{capture:true,signal:this.localDismiss.signal});
  }
  composerDocument(){
    if(this.closed||!this.frame||this.origin!==this.window.location.origin)return null;
    const page=this.frame.contentDocument;
    if(!page)return null;
    const url=new URL(page.URL);
    return url.origin===this.origin&&url.pathname===this.target.pathname&&
      url.searchParams.get('surface_visit')===this.visit?page:null;
  }

  voiceControls(){
    const page=this.composerDocument();
    return {page,mic:page?.querySelector('#conversation-talk'),speaker:page?.querySelector('#conversation-voice-replies')};
  }

  syncVoiceControls(){
    const {mic,speaker}=this.voiceControls();
    this.onVoiceControls({
      recording:mic?.getAttribute('aria-pressed')==='true',
      speaking:speaker?.getAttribute('aria-pressed')==='true',
      speakerReady:!!speaker&&!this.closed,
    });
    if(mic&&!mic.disabled&&this.channel)this.toolbarVoiceReady?.();
  }

  async pressToolbarMic(){
    await this.mount();
    const start=()=>{
      const {page,mic}=this.voiceControls();
      if(!this.channel||!mic||mic.disabled||this.currentActor()!==this.selected?.actorRef)return false;
      if(mic.getAttribute('aria-pressed')!=='true'&&mic.title==='Retry sending the same recording')
        throw Error('Hay una grabación pendiente. Revisala en Conversar.');
      // Prime the canonical playback from the microphone gesture when the
      // composer already exists. Enable its queue only after the audio receipt.
      page.defaultView.PcmSpeech?.unlock();
      if(mic.getAttribute('aria-pressed')==='true'){
        if(this.lastAudioRecord)this.lastAudioRecord.toolbarMic=true;
      }else this.toolbarRecording=true;
      mic.click();
      return true;
    };
    if(start())return;
    await new Promise((resolve,reject)=>{
      const done=()=>{clearTimeout(timer);this.toolbarVoiceReady=null;this.cancelToolbarVoice=null;};
      const timer=setTimeout(()=>{done();reject(Error('El micrófono todavía no está disponible.'));},3500);
      this.toolbarVoiceReady=()=>{
        try{if(start()){done();resolve();}}
        catch(error){done();reject(error);}
      };
      this.cancelToolbarVoice=()=>{done();reject(Error('Se cerró la conversación antes de grabar.'));};
    });
  }

  toggleToolbarSpeaker(){
    const {speaker}=this.voiceControls();
    if(speaker&&!speaker.disabled&&this.currentActor()===this.selected?.actorRef)speaker.click();
  }

  async selectWorldView(blob){
    if(!blob.size||blob.type!=='image/png'||!this.channel||this.currentActor()!==this.selected?.actorRef)
      throw Error('Abrí tu conversación antes de adjuntar la vista.');
    const page=this.composerDocument(),input=page?.querySelector('#conversation-image');
    const selection=page?.querySelector('#conversation-visual');
    const shell=page?.defaultView;
    if(!input||input.type!=='file'||input.disabled||!selection||!shell?.DataTransfer)
      throw Error('No pude adjuntar la vista a esta conversación.');
    const count=Number(selection.querySelector('summary')?.dataset.count??0);
    // Hand off to the canonical image chooser. It owns the preview, upload,
    // image limits, and the decision to include it in the next original.
    if(count>=8)throw Error('Quitá una de las ocho imágenes para adjuntar la vista.');
    const files=new shell.DataTransfer();
    files.items.add(new shell.File([blob],'Vista de Holodeck.png',{type:'image/png'}));
    input.files=files.files;
    selection.open=true;
    input.dispatchEvent(new shell.Event('change',{bubbles:true}));
    const rail=selection.querySelector('#conversation-image-list');
    if(!rail)return;
    await new Promise((resolve,reject)=>{
      const observer=new shell.MutationObserver(check);
      const timer=setTimeout(()=>{observer.disconnect();reject(Error('No pude abrir la vista en el borrador.'));},3500);
      function check(){
        const choices=rail.querySelectorAll('.image-thumbnail');
        if(choices.length!==count+1||!choices[count].querySelector('canvas'))return;
        observer.disconnect();clearTimeout(timer);resolve();
      }
      observer.observe(rail,{childList:true,subtree:true});
      check();
    });
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
      this.clearMicrophone();
      this.dismissBound=typeof this.onDismiss==='function'&&d.features?.dismiss===true;
      this.microphoneBound=this.avatarMicrophone&&d.features?.avatarMicrophone===true;
      if(this.channel!==d.channel){
        this.channel=d.channel;
        this.toolbarRecording=false;this.lastAudioRecord=null;
        this.mode=d.features?.machineSource===true&&this.selected.machineSource===machineMode?machineMode:undefined;
      }
      this.send(d,'connect',{features:{...(this.onSpeechLevel?{avatarPlayback:true}:{}),...(this.microphoneBound?{avatarMicrophone:true}:{}),...(this.mode?{machineSource:this.mode}:{}),...(this.dismissBound?{dismiss:true}:{})}});this.syncVoiceControls();return;
    }
    if(d.channel!==this.channel)return;
    if(d.type==='dismiss'&&this.dismissBound&&Object.keys(d).length===6){
      this.onDismiss();
    }else if(d.type==='avatar-playback'&&typeof d.level==='number'&&Number.isFinite(d.level)&&d.level>=0&&d.level<=1){
      this.onSpeechLevel?.(d.level);
    }else if(d.type==='avatar-microphone'){
      if(this.microphoneBound&&!this.document.hidden&&Object.keys(d).length===7&&typeof d.level==='number'&&
        Number.isInteger(d.level*4)&&d.level>=0&&d.level<=1){
        this.microphoneSample=d.level?{level:d.level,at:this.window.performance.now()}:null;
      }
    }else if(d.type==='prepare')this.prepare(d).catch(()=>{});
    else if(d.type==='status'&&this.records.has(d.id)&&typeof d.phase==='string'&&d.phase.length<=64&&typeof d.busy==='boolean'){
      this.onStatus({phase:d.phase,busy:d.busy});
      const record=this.records.get(d.id);
      if(record.toolbarMic&&['accepted','queued','foreground','routed','completed','matrix_requested'].includes(d.phase)){
        record.toolbarMic=false;
        const {speaker}=this.voiceControls();
        if(speaker&&speaker.getAttribute('aria-pressed')!=='true')this.toggleToolbarSpeaker();
      }
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
      if(d.modality==='audio'){
        record.toolbarMic=this.toolbarRecording===true;
        this.toolbarRecording=false;this.lastAudioRecord=record;
      }
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
  microphoneLevel(){
    if(this.closed||this.document.hidden||!this.microphoneBound||this.currentActor()!==this.selected.actorRef){
      this.clearMicrophone();
      return null;
    }
    const sample=this.microphoneSample;
    return sample&&this.window.performance.now()-sample.at<microphoneLifetime?sample.level:0;
  }
  dispose(){
    this.closed=true;
    this.localDismiss?.abort();
    this.voiceObserver?.disconnect();
    this.cancelToolbarVoice?.();
    this.clearMicrophone();
    if(this.avatarMicrophone)this.document.removeEventListener('visibilitychange',this.clearMicrophone);
    this.onSpeechLevel?.(0);this.window.removeEventListener('message',this.receive);this.frame?.remove();}
}
