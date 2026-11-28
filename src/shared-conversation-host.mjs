// Only correlation and immutable machine context cross this boundary.
// Canonical Conversation retains all human content, drafts, media and sends.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const topicKey=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const SCHEMA='conversation.surface/v1';
const microphoneLifetime=300;
const machineMode='owner-journal/v1';
const bounded=value=>{try{return JSON.stringify(value).length<=8192;}catch{return false;}};
export class SharedConversationHost{
  constructor({window,document,container,api,capture,captureRender,currentActor,onDismiss,onVoiceControls=()=>{},onStatus=()=>{},onError=()=>{},onSpeechLevel,avatarMicrophone=false,onTopicModeReset=()=>{}}){
    Object.assign(this,{window,document,container,api,capture,captureRender,currentActor,onDismiss,onVoiceControls,onStatus,onError,onSpeechLevel,avatarMicrophone,onTopicModeReset});
    this.records=new Map();this.topicReady=[];this.visit=window.crypto.randomUUID();this.receive=this.receive.bind(this);
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
    const selected=await this.api('conversation-surface',undefined,{signal:AbortSignal.timeout(4500)}).catch(error=>{
      if(error.name==='TimeoutError')throw Error('La conversación tardó en abrir. Probá de nuevo.');
      throw error;
    });
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
      this.voiceObserver.observe(node,{attributes:true,attributeFilter:['aria-pressed','disabled','aria-label','data-capture-phase','data-capture-opening-error']});
    const caption=page.querySelector('#conversation-voice-state');
    if(caption)this.voiceObserver.observe(caption,{attributes:true,attributeFilter:['data-voice-transcript','data-live-caption','data-attention'],
      childList:true,subtree:true,characterData:true});
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
    return {page,mic:page?.querySelector('#conversation-talk'),speaker:page?.querySelector('#conversation-voice-replies'),caption:page?.querySelector('#conversation-voice-state')};
  }

  syncVoiceControls(){
    const {mic,speaker,caption}=this.voiceControls();
    const recording=mic?.getAttribute('aria-pressed')==='true';
    const owned=this.toolbarCaptureActive;
    const phase=owned?(mic?.dataset.capturePhase??
      (recording?'recording':mic?.getAttribute('aria-label')==='Send recording'?'ready':mic?.disabled?'permission':'idle')):null;
    const openingError=owned&&phase==='idle'?mic?.dataset.captureOpeningError:undefined;
    const words=owned&&recording&&caption?.dataset.voiceTranscript==='true'?
      Array.from(caption.textContent.trim().replace(/\s+/g,' ')).slice(-145).join(''):'';
    this.onVoiceControls({
      recording,phase,words,openingError,previewUnavailable:owned&&recording&&caption?.textContent==='Recording… Live text unavailable.',
      needsReview:owned&&mic?.title==='Retry sending the same recording',
      speaking:speaker?.getAttribute('aria-pressed')==='true',
      speakerReady:!!speaker&&!this.closed,
    });
    if(owned&&(phase==='idle'||phase==='ready')){
      this.toolbarCaptureActive=false;this.toolbarRecording=false;
    }
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
      }else{this.toolbarRecording=true;this.toolbarCaptureActive=true;}
      mic.click();
      if(mic.dataset.capturePhase==='idle'&&!mic.dataset.captureOpeningError){
        this.syncVoiceControls();
        throw Error('No se inició la grabación. Probá de nuevo.');
      }
      this.syncVoiceControls();
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
        this.finishTopicRead(Error('La conexión cambió.'));
        this.closeTopicItem();
        this.finishTopicMode(Object.assign(Error('La conversación volvió al modo general.'),{reset:true}));
        if(this.channel)this.onTopicModeReset();
        this.channel=d.channel;
        this.toolbarRecording=false;this.lastAudioRecord=null;
        this.mode=d.features?.machineSource===true&&this.selected.machineSource===machineMode?machineMode:undefined;
      }
      this.supportsTopics=d.features?.topicRooms===true;
      this.supportsDirect=d.features?.topicDirect===true;
      this.supportsResult=d.features?.topicResult===true;
      this.supportsQuestion=d.features?.topicQuestion===true;
      const features={...(this.supportsTopics?{topicRooms:true}:{}),...(this.supportsDirect?{topicDirect:true}:{}),...(this.supportsResult?{topicResult:true}:{}),...(this.supportsQuestion?{topicQuestion:true}:{})};
      this.send(d,'connect',{features:{...features,...(this.onSpeechLevel?{avatarPlayback:true}:{}),...(this.microphoneBound?{avatarMicrophone:true}:{}),...(this.mode?{machineSource:this.mode}:{}),...(this.dismissBound?{dismiss:true}:{})}});this.syncVoiceControls();
      for(const ready of this.topicReady.splice(0))ready();
      return;
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
    }else if(d.type==='topic-direct-readback'){
      if(this.topicMode?.request!==d.request)return;
      if(d.unavailable===true)this.finishTopicMode(Object.assign(Error('No pude cambiar el destinatario.'),{refused:true}));
      else if(d.room===this.topicMode.room)this.finishTopicMode(null);
      else this.finishTopicMode(Error('No pude confirmar el destinatario.'));
    }
    else if(d.type==='topic-result-readback'||d.type==='topic-question-readback'){
      const result=this.topicResult;
      if(!result||d.type!==`topic-${result.kind}-readback`||result.request!==d.request||result.room!==d.room||!result.resolve)return;
      if(d.opened===true){
        clearTimeout(result.timer);
        result.resolve();
        result.resolve=result.reject=undefined;
      }else this.closeTopicItem();
    }
    else if(d.type==='topic-rooms-readback')this.receiveTopicRead(d);
    else if(d.type==='prepare')this.prepare(d).catch(()=>{});
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
  selectTopicMode(room){
    if(this.closed||!this.supportsDirect||!this.channel||this.topicMode||
      this.currentActor()!==this.selected?.actorRef||room!==null&&!topicKey(room))
      return Promise.reject(Object.assign(Error('El modo directo todavía no está disponible.'),{refused:true}));
    const request=this.window.crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.finishTopicMode(Error('No pude confirmar el destinatario.')),8000);
      this.topicMode={request,room,resolve,reject,timer};
      this.send({channel:this.channel},'topic-direct-select',{request,room});
    });
  }
  finishTopicMode(error){
    const selection=this.topicMode;
    if(!selection)return;
    this.topicMode=undefined;
    clearTimeout(selection.timer);
    if(error)selection.reject(error);
    else selection.resolve();
  }
  async waitForTopicChannel(){
    await this.mount();
    if(!this.channel)await new Promise((resolve,reject)=>{
      const ready=()=>{clearTimeout(timeout);resolve();};
      const timeout=setTimeout(()=>{
        this.topicReady=this.topicReady.filter(item=>item!==ready);
        reject(Error('No pude conectar con tus topics.'));
      },8000);
      this.topicReady.push(ready);
    });
  }
  async openTopicItem(kind,room,current){
    if(!['result','question'].includes(kind)||!topicKey(room))throw Error('Seleccioná un topic válido.');
    await this.waitForTopicChannel();
    const supported=kind==='question'?this.supportsQuestion:this.supportsResult;
    if(this.closed||!supported||this.currentActor()!==this.selected.actorRef||!current())
      throw Error('No pude abrir ese elemento del topic.');
    this.closeTopicItem();
    const request=this.window.crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.closeTopicItem(),8000);
      this.topicResult={request,room,resolve,reject,timer,kind};
      this.send({channel:this.channel},`topic-${kind}-open`,{request,room});
    });
  }
  closeTopicItem(){
    const result=this.topicResult;
    if(!result)return;
    this.topicResult=undefined;
    clearTimeout(result.timer);
    this.send({channel:this.channel},`topic-${result.kind}-cancel`,{request:result.request});
    result.reject?.(Error('Ese elemento del topic ya no está disponible.'));
  }
  async readTopicRooms({room,after}={}){
    if(room!==undefined&&!topicKey(room)||after!==undefined&&!topicKey(after)||
      room!==undefined&&after!==undefined)throw Error('Seleccioná un topic válido.');
    await this.waitForTopicChannel();
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
        const frozenView=this.capture();
        const frozenRender=this.captureRender?.();
        const view=await frozenView;
        const frame=await frozenRender;
        if(record.discarded||this.currentActor()!==d.actor||this.closed)throw Error('El acceso al mundo cambió.');
        const result=await this.api('conversation-contexts',{id:d.id,binding:d.binding,displayedSequence:null,view,...(frame?{frame}:{}),...(inline?{mode:machineMode}:{})});
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
    this.closeTopicItem();
    this.closed=true;
    this.finishTopicMode(Error('La conversación se cerró.'));
    this.finishTopicRead(Error('La conversación se cerró.'));
    for(const ready of this.topicReady.splice(0))ready();
    this.localDismiss?.abort();
    this.voiceObserver?.disconnect();
    this.cancelToolbarVoice?.();
    this.clearMicrophone();
    if(this.avatarMicrophone)this.document.removeEventListener('visibilitychange',this.clearMicrophone);
    this.onSpeechLevel?.(0);this.window.removeEventListener('message',this.receive);this.frame?.remove();}
}
