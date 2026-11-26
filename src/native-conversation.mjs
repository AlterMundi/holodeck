import {resolveHistoryReference} from './activity.mjs';
import {fitSituation} from './situation-budget.mjs';
import { constants, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { createNativeTransportMux } from './native-mux.mjs';

const JOURNAL_BYTES=1800*1024, MAX_RECORDS=32, MAX_TOMBSTONES=128, MAX_OBSERVATION_BYTES=32768;
const encode=value=>JSON.stringify(value);
const textHash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export class NativeConversationError extends Error {
  constructor(code,message,details={}){super(message);this.code=code;Object.assign(this,details);}
}

// Both the legacy text bridge and the shared Conversation surface use this same
// machine-authored capture. No human text, audio or selected files belong here.
export function captureNativeSituation(room,actor,request,{pairedBeing=null,pairFocusBinding='current-native-binding',serverCapture='at-original-retention',interior=null,roomVisit=null,worktable=null}={}){
  const preserveActors=pairedBeing?[pairedBeing]:[];
  const capturedAt=request.view?.capturedAt;
  const clientReportedCaptureTime=Number.isSafeInteger(capturedAt)?capturedAt:null;
  const extra={inputAssociation:{humanInputId:request.id,serverCapture,clientReportedCaptureTime}};
  if(interior&&roomVisit)extra.referredRoomVisit={id:roomVisit.id,revision:roomVisit.revision,
    evidence:'client-reported reference matched the room placement and the speaker had source access'};
  if(interior&&worktable)extra.referredWorktable={...worktable,fixture:'worktable',
    evidence:'Client-selected reference matched the exact Home review that the speaker could access. Opening the edition requires Home access.'};
  if(interior?.characterPose)extra.referredCharacterPose={...interior.characterPose,
    fixture:'character-worktable',evidence:'Client-reported frame matched the current pose catalog in the authorized Character Design Room.'};
  if(request.view!==undefined){
    if(!request.view||typeof request.view!=='object'||Buffer.byteLength(encode(request.view))>4096)
      throw new NativeConversationError('view','Provide a bounded client-reported view',{retained:false,knownNotSubmitted:true,retryable:true});
    const position=request.view.local?.position;
    const local=position&&[position.x,position.y,position.z].every(Number.isFinite)
      ?{position:{x:position.x,y:position.y,z:position.z}}:null;
    const view=interior?{capturedAt:clientReportedCaptureTime,spaceId:interior.place.id,local}:structuredClone(request.view);
    const requested=interior&&(request.view.roomObject??request.view.workstation);
    if(requested&&Number.isSafeInteger(requested.revision)){
      const object=interior.place.objects.find(item=>
        (item.kind==='workstation'||request.view.roomObject&&item.kind==='fixture')&&
        item.id===requested.id&&item.revision===requested.revision);
      if(object){
        if(request.view.roomObject)extra.referredRoomObject={id:object.id,kind:object.kind,title:object.title,
          revision:object.revision,position:structuredClone(object.position),
          evidence:'client-reported reference matched the current authorized room object'};
        if(object.kind==='workstation')extra.referredWorkstation={id:object.id,title:object.title,revision:object.revision,
          evidence:'client-reported reference matched the current authorized room station'};
      }
    }
    // The exact reference is resolved below, never copied event text from a client.
    delete view.historyReference;
    delete view.characterPose;
    extra.clientReportedView={evidence:'client-reported-at-interaction-capture',value:view,
      uncertainty:'Client-reported scene-graph/DOM evidence only, including any appliedGeometry field. Not presented pixels, authoritative location, line of sight, attention or understanding. A not-in-document entity reference proves DOM absence only.'};
  }
  if(!interior&&request.view&&Object.hasOwn(request.view,'historyReference'))extra.selectedActivity=resolveHistoryReference(room,actor,request.view.historyReference);
  // Keep the canonical world and exact speaker/paired indications ahead of an
  // optional client-reported view. The cached capture never contains this view.
  const reserve={inputAssociation:extra.inputAssociation,...(extra.selectedActivity?{selectedActivity:extra.selectedActivity}:{})};
  const observation=interior?{
    schema:'holodeck.situation/v1',id:interior.id,run:interior.run,edition:interior.edition,
    capturedAt:interior.capturedAt,observer:actor.id,scope:'structured-interior-room',
    place:{id:interior.place.id,title:interior.place.title,level:interior.place.level,
      house:interior.place.house,objects:interior.place.objects,
      ...(interior.place.activity?{activity:structuredClone(interior.place.activity)}:{}),
      ...(interior.place.exhibitRevision?{exhibitRevision:interior.place.exhibitRevision}:{})},
    source:{through:interior.sequence,displayedSequence:null},
    activity:null,focus:[],nodes:{},entities:{},events:[],participants:interior.place.participants,
    uncertainty:['This capture covers only the authorized room. Shared presence does not establish location within it, attention or understanding.'],
  }:room.observe(actor,{after:Math.max(0,room.sequence-16),displayedSequence:request.displayedSequence??null,
    maxBytes:MAX_OBSERVATION_BYTES-Buffer.byteLength(encode(reserve))-256,preserveActors});
  Object.assign(observation,extra);observation.source.pairFocusBinding=pairedBeing?pairFocusBinding:'unavailable-at-capture';
  if(!fitSituation(observation,MAX_OBSERVATION_BYTES,{preserveActors})&&observation.clientReportedView){
    const omittedBytes=Buffer.byteLength(encode(observation.clientReportedView.value));
    observation.clientReportedView={evidence:'client-reported-view-omitted-to-fit-context',value:null,
      uncertainty:'The optional client-reported view is unavailable in this capture; no visual perception or attention is established.'};
    observation.source.omissions.clientReportedViewBytes=omittedBytes;
  }
  if(!fitSituation(observation,MAX_OBSERVATION_BYTES,{preserveActors}))
    throw new NativeConversationError('context-capacity','The canonical captured situation exceeds the native context bound',{retained:false,knownNotSubmitted:true,retryable:true});
  return observation;
}

// Fixed owner-local bridge. The receiving service resolves authority; browsers
// never select a command, socket, source directory, binding or paired being.
export function createUnixNativeTransport(socketPath){
  if(typeof socketPath!=='string'||!socketPath.startsWith('/'))throw Error('Select the receiving native socket');
  function call(operation,payload){
    const request=Buffer.from(encode({operation,...payload})+'\n');
    if(request.length>131072)throw Error('Native request exceeds its bound');
    return new Promise((resolve,reject)=>{
      const socket=net.createConnection({path:socketPath});let data=Buffer.alloc(0),done=false;
      function finish(error,value){if(done)return;done=true;socket.destroy();error?reject(error):resolve(value);}
      socket.setTimeout(45000,()=>finish(new Error('Native response unconfirmed')));
      socket.on('error',error=>finish(error));
      socket.on('connect',()=>socket.write(request));
      socket.on('data',block=>{
        data=Buffer.concat([data,block]);
        if(data.length>131072)return finish(new Error('Native reply exceeds its bound'));
        const end=data.indexOf(10);if(end<0)return;
        try{const reply=JSON.parse(data.subarray(0,end));
          if(reply.ok!==true)return finish(new NativeConversationError(reply.code||'unavailable',reply.message||'Native operation unavailable',
            {knownNotSubmitted:reply.knownNotSubmitted===true}));
          finish(null,reply.result);
        }catch(error){finish(error);}
      });
      socket.on('end',()=>{if(!done)finish(new Error('Native response unconfirmed'));});
    });
  }
  return {inspect:actorRef=>call('inspect',{actorRef}),
    surface:actorRef=>call('surface',{actorRef}),
    prepareContext:payload=>call('prepare-context',payload),
    prepareMachineContext:payload=>call('prepare-machine-context',payload),
    machineContextStatus:payload=>call('machine-context-status',payload),
    submit:payload=>call('submit',payload),status:payload=>call('status',payload),lookup:payload=>call('lookup',payload)};
}

export async function createNativeConversation({room,stateDir,transport,fileSystem=fs}){
  const io=fileSystem;
  if(!room||!stateDir||!transport)throw Error('Select room, bounded state and receiving native transport');
  await io.mkdir(stateDir,{recursive:true,mode:0o700});
  const directory=await io.lstat(stateDir);
  if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==process.getuid()||(directory.mode&0o077))
    throw Error('Native intents require owner-private state');
  const path=join(stateDir,'native-turns.json');let records={},tombstones={};let serial=Promise.resolve(),fenced=false;
  const inflight=new Map();
  try{
    const file=await io.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{const stat=await file.stat();if(!stat.isFile()||stat.size>JOURNAL_BYTES||stat.uid!==process.getuid()||(stat.mode&0o077))throw Error('Invalid native intent journal');
      const value=JSON.parse(await file.readFile('utf8'));
      if(value.schema!=='holodeck.native-intents/v1'||!value.records||Object.keys(value.records).length>MAX_RECORDS)throw Error('Invalid native intent journal');
      records=value.records;
      tombstones=value.tombstones??{};
      if(Object.keys(tombstones).length>MAX_TOMBSTONES)throw Error('Invalid native tombstone journal');
    }finally{await file.close();}
  }catch(error){if(error.code!=='ENOENT')throw error;}
  async function persist(){
    if(fenced)throw new NativeConversationError('journal-recovery','Native journal needs receiving recovery',{retained:true,knownNotSubmitted:false});
    const bytes=Buffer.from(encode({schema:'holodeck.native-intents/v1',records,tombstones}));
    if(bytes.length>JOURNAL_BYTES)throw new NativeConversationError('capacity','Native intent storage is full');
    const stage=path+'.stage';
    const file=await io.open(stage,constants.O_CREAT|constants.O_TRUNC|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
    try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
    let replaced=false;
    try{await io.rename(stage,path);replaced=true;const dir=await io.open(stateDir,constants.O_RDONLY);
      try{await dir.sync();}finally{await dir.close();}
    }catch(error){
      if(replaced){fenced=true;throw new NativeConversationError('journal-recovery','Native journal replacement needs receiving reconciliation',
        {retained:true,knownNotSubmitted:false,replaced:true});}
      throw error;
    }
  }
  function transaction(fn){const work=serial.then(fn);serial=work.catch(()=>{});return work;}
  function actorRef(actor){
    if(actor?.kind!=='human'||typeof actor.ref!=='string'||!actor.ref.startsWith('human:'))
      throw new NativeConversationError('identity','Sign in with your existing human identity');
    return actor.ref;
  }
  function own(actor,id){const record=records[id]??tombstones[id];if(!record||record.actorRef!==actorRef(actor))throw new NativeConversationError('not-retained','No interaction belongs to this participant');return record;}
  function statusPayload(record){return {actorRef:record.actorRef,frozen:record.frozen,id:record.id,
    textSha256:textHash(record.text),observationId:record.observation.id};}
  function view(record,result=null){const phase=result?.phase||record.phase;return {id:record.id,phase,
    observation:record.observation.id,run:record.observation.run,
    message:result?.message??null,updates:result?.updates??[],
    nativeAcceptance:result?.nativeAcceptance??'unconfirmed',
    ...(result?.execution?{execution:structuredClone(result.execution)}:{}),
    retained:true,knownNotSubmitted:record.knownNotSubmitted===true,
    retryable:!record.archived&&(record.knownNotSubmitted===true||phase==='unknown'),
    tracking:result?.tracking??!['completed','problem'].includes(phase),
    error:phase==='unknown'?'La respuesta todavía no está confirmada. Comprobá su estado antes de volver a intentar.':phase==='problem'?'Este turno encontró un problema.':null};}
  function update(record,result){record.phase=result.phase;record.tracking=result.tracking??!['completed','problem'].includes(result.phase);
    record.nativeRetained=result.retainedOriginal===true;record.knownNotSubmitted=false;}
  function archive(record){
    tombstones[record.id]={id:record.id,actorRef:record.actorRef,textSha256:textHash(record.text),
      observation:{id:record.observation.id,run:record.observation.run},phase:record.phase,archived:true,
      nativeRetained:true,tracking:false};
    while(Object.keys(tombstones).length>MAX_TOMBSTONES)delete tombstones[Object.keys(tombstones)[0]];
    delete records[record.id];
  }
  async function canonical(actor,id,checksum=null){
    try{return await transport.lookup({actorRef:actorRef(actor),id,textSha256:checksum});}
    catch(error){if(error instanceof NativeConversationError&&error.code==='id-reuse')throw error;
      throw new NativeConversationError('lookup-unavailable','Canonical original status is unavailable; nothing was resubmitted',
        {retained:false,knownNotSubmitted:false,retryable:false});}
  }
  async function recover(actor,id,checksum=null){
    const found=await canonical(actor,id,checksum);
    if(found.state!=='retained')return null;
    return view({id,actorRef:actorRef(actor),phase:found.native.phase,observation:found.observation,archived:true},found.native);
  }
  async function freeConfirmedTerminal(){
    const eligible=Object.values(records).filter(record=>['completed','problem'].includes(record.phase)&&record.tracking!==true
      &&!record.knownNotSubmitted&&record.frozen);
    const candidate=eligible.find(record=>record.nativeRetained)||eligible[0];
    if(!candidate)return false;
    if(!candidate.nativeRetained){
      const found=await transport.lookup({actorRef:candidate.actorRef,id:candidate.id,textSha256:textHash(candidate.text)});
      if(found.state!=='retained'||found.native.retainedOriginal!==true||found.native.tracking===true
        ||!['completed','problem'].includes(found.native.phase))return false;
      update(candidate,found.native);
    }
    await transaction(async()=>{archive(candidate);await persist();});return true;
  }
  async function execute(record){
    await transaction(async()=>{record.phase='submitting';record.writeStarted=true;record.knownNotSubmitted=false;await persist();});
    try{
      const result=await transport.submit({actorRef:record.actorRef,frozen:record.frozen,
        input:{id:record.id,text:record.text},observation:record.observation});
      await transaction(async()=>{update(record,result);await persist();});
      return view(record,result);
    }catch(error){
      if(fenced)throw error;
      const refused=error.knownNotSubmitted===true;
      await transaction(async()=>{record.phase=refused?'problem':'unknown';record.knownNotSubmitted=refused;await persist();});
      return view(record);
    }
  }
  return {
    hasRetainedIntent:id=>!!(records[id]??tombstones[id]),
    async availability(actor){
      try{const ref=actorRef(actor),binding=await transport.inspect(ref);
        const active=Object.values(records).reverse().find(record=>record.actorRef===ref
          &&record.observation.run===room.run&&(record.tracking===true||!['completed','problem'].includes(record.phase))
          &&(!record.frozen||encode(record.frozen)===encode(binding)));
        return {available:!fenced,beingRef:binding.beingRef,active:active?{id:active.id,phase:active.phase}:null};}
      catch{return {available:false};}
    },
    async submit(actor,request){
      const ref=actorRef(actor);
      if(!request||Object.keys(request).some(key=>!['id','text','displayedSequence','view'].includes(key))
        ||!uuid(request.id)||typeof request.text!=='string'||!request.text.trim()||request.text.includes('\0')||Buffer.byteLength(request.text)>32768)
        throw new NativeConversationError('input','Provide one bounded original interaction',{retained:false,knownNotSubmitted:true,retryable:true});
      if(fenced)throw new NativeConversationError('journal-recovery','Native journal needs receiving recovery',{retained:false,knownNotSubmitted:false});
      const checksum=textHash(request.text),existing=records[request.id]??tombstones[request.id];
      if(existing){
        if(existing.actorRef!==ref||(existing.textSha256??textHash(existing.text))!==checksum)
          throw new NativeConversationError('id-reuse','Interaction ID has different contents',{retained:true,knownNotSubmitted:true});
        return this.status(actor,request.id);
      }
      const pending=inflight.get(request.id);
      if(pending){if(pending.actorRef!==ref||pending.checksum!==checksum)throw new NativeConversationError('id-reuse','Interaction ID has different contents');return pending.work;}
      if(inflight.size>=8)throw new NativeConversationError('capacity','Native admission is busy',{retained:false,knownNotSubmitted:true,retryable:true});
      const work=(async()=>{
      const found=await canonical(actor,request.id,checksum);
      if(found.state==='retained')return view({id:request.id,phase:found.native.phase,observation:found.observation,archived:true},found.native);
      if(found.state!=='absent')throw new NativeConversationError('lookup-unavailable','Canonical original status is unavailable',{retained:false,knownNotSubmitted:false});
      const reserve=MAX_OBSERVATION_BYTES+Buffer.byteLength(encode(request.text))+16384;
      while(Object.keys(records).length>=MAX_RECORDS||Buffer.byteLength(encode({schema:'holodeck.native-intents/v1',records,tombstones}))+reserve>JOURNAL_BYTES){
        if(!await freeConfirmedTerminal())throw new NativeConversationError('capacity','Native intent storage is full',{retained:false,knownNotSubmitted:true,retryable:true});
      }
      const record=await transaction(async()=>{
        if(Object.keys(records).length>=MAX_RECORDS)throw new NativeConversationError('capacity','Native intent storage is full',{retained:false,knownNotSubmitted:true,retryable:true});
        const pairedBeing=found.frozen?.actorRef===ref&&typeof found.frozen.beingRef==='string'&&found.frozen.beingRef.length<=200?found.frozen.beingRef:null;
        const observation=captureNativeSituation(room,actor,request,{pairedBeing,pairFocusBinding:'known-from-canonical-lookup'});
        const value={id:request.id,actorRef:ref,text:request.text,observation,phase:'preparing',frozen:null,writeStarted:false,knownNotSubmitted:true};
        records[value.id]=value;
        if(Buffer.byteLength(encode({schema:'holodeck.native-intents/v1',records,tombstones}))>JOURNAL_BYTES-8192){
          delete records[value.id];throw new NativeConversationError('capacity','Native intent storage is full',{retained:false,knownNotSubmitted:true,retryable:true});
        }
        try{await persist();}catch(error){if(!error.replaced){delete records[value.id];error.retained=false;error.knownNotSubmitted=true;}throw error;}
        return value;
      });
      try{
        const frozen=found.frozen??await transport.inspect(ref);
        if(Buffer.byteLength(encode(frozen))>4096)throw new NativeConversationError('binding','Native binding exceeds its bound');
        await transaction(async()=>{record.frozen=frozen;await persist();});
      }catch(error){
        if(fenced)throw error;
        await transaction(async()=>{record.phase='problem';record.knownNotSubmitted=true;await persist();});return view(record);
      }
      return execute(record);
      })();
      inflight.set(request.id,{actorRef:ref,checksum,work});
      try{return await work;}finally{inflight.delete(request.id);}
    },
    async status(actor,id){
      const ref=actorRef(actor);let record=records[id]??tombstones[id];
      if(record&&record.actorRef!==ref)throw new NativeConversationError('not-found','No interaction belongs to this participant');
      if(record?.archived){const recovered=await recover(actor,id,record.textSha256);
        if(!recovered)throw new NativeConversationError('original-unavailable','A confirmed original is no longer available; it was not resubmitted',{retained:true,knownNotSubmitted:false});return recovered;}
      if(!record){
        const pending=inflight.get(id);
        if(pending){if(pending.actorRef!==ref)throw new NativeConversationError('not-found','No interaction belongs to this participant');
          return {id,phase:'preparing',retained:false,knownNotSubmitted:false,retryable:false,tracking:true,message:null,updates:[]};}
        const recovered=await recover(actor,id);
        if(recovered)return recovered;
        if(records[id]||inflight.has(id))return this.status(actor,id);
        throw new NativeConversationError('not-retained','No app intent or canonical original was retained',{retained:false,knownNotSubmitted:true,retryable:true});
      }
      if(fenced)return {...view(record),phase:'unknown',knownNotSubmitted:false,retryable:false,
        error:'El registro del turno necesita recuperarse. Tu mensaje no se reenviará solo.'};
      if(record.phase==='preparing'&&!record.writeStarted){
        if(inflight.has(id))return {...view(record),knownNotSubmitted:false,retryable:false,tracking:true};
        record.phase='problem';record.knownNotSubmitted=true;return view(record);
      }
      if(!record.frozen)return {...view(record),phase:'unknown',retryable:false};
      try{const result=await transport.status(statusPayload(record));
        if(!fenced)await transaction(async()=>{update(record,result);await persist();});return view(record,result);
      }catch{return {...view(record),phase:'unknown',tracking:true,error:'No puedo actualizar este turno. Tu mensaje no se reenviará solo.'};}
    },
    async authorizeWorldRequest(interactionId,expectedBeingRef=null){
      if(fenced)throw new NativeConversationError('journal-recovery','Native journal needs receiving reconciliation');
      const record=records[interactionId];
      if(!record?.frozen||record.observation.run!==room.run)
        throw new NativeConversationError('native-scope','The retained interaction does not belong to this room run');
      if(expectedBeingRef!==null&&record.frozen.beingRef!==expectedBeingRef)
        throw new NativeConversationError('native-scope','This native return lane belongs to another being');
      const current=await transport.inspect(record.actorRef);
      if(encode(current)!==encode(record.frozen))
        throw new NativeConversationError('binding','The human/daimon pairing or continuing Conversation changed');
      const status=await transport.status(statusPayload(record));
      if(status.nativeAcceptance!=='observed'||status.phase==='problem')
        throw new NativeConversationError('native-scope','Native admission of this interaction is not confirmed');
      return {actor:{id:current.beingRef,ref:current.beingRef,kind:'daimon'},
        humanRef:record.actorRef,nativeRequest:record.id};
    },
    // Explicit exact-original retry only; status never resubmits. The owning
    // native journal decides whether the same identity already has an effect.
    async retry(actor,id){
      const pending=inflight.get(id);
      if(pending){if(pending.actorRef!==actorRef(actor))throw new NativeConversationError('not-found','No interaction belongs to this participant');return pending.work;}
      const record=own(actor,id);
      if(fenced)throw new NativeConversationError('journal-recovery','Native journal needs receiving reconciliation',{retained:true,knownNotSubmitted:false});
      if(record.archived||record.nativeRetained&&!record.knownNotSubmitted&&record.phase==='problem')return this.status(actor,id);
      if(!['unknown','problem','preparing'].includes(record.phase))return this.status(actor,id);
      const work=(async()=>{
        if(!record.frozen){const frozen=await transport.inspect(record.actorRef);if(Buffer.byteLength(encode(frozen))>4096)throw new NativeConversationError('binding','Native binding exceeds its bound');await transaction(async()=>{record.frozen=frozen;await persist();});}
        return execute(record);
      })();
      inflight.set(id,{actorRef:record.actorRef,checksum:textHash(record.text),work});
      try{return await work;}finally{inflight.delete(id);}
    }
  };
}

export async function nativeFactory({room,stateDir,receiving,allowInteriorSource}){
  if(!receiving?.nativeSocket&&!receiving?.nativeRoutes)return null;
  const transport=receiving.nativeRoutes
    ?createNativeTransportMux({routes:receiving.nativeRoutes,createTransport:createUnixNativeTransport})
    :createUnixNativeTransport(receiving.nativeSocket);
  const legacy=await createNativeConversation({room,stateDir:join(stateDir,'native'),transport});
  if(receiving.sharedConversation!==undefined&&typeof receiving.sharedConversation!=='boolean')throw Error('Select the shared Conversation capability explicitly');
  if(!receiving.sharedConversation)return legacy;
  const {createConversationContexts}=await import('./conversation-context.mjs');
  const contexts=await createConversationContexts({room,stateDir:join(stateDir,'conversation-context'),transport,allowInteriorSource});
  return {...legacy,contexts,
    conversationSurface:actor=>transport.surface(actor.ref),
    authorizeWorldRequest:(id,being)=>contexts.hasWorldRequest(id)?contexts.authorizeWorldRequest(id,being):legacy.authorizeWorldRequest(id,being)};
}
