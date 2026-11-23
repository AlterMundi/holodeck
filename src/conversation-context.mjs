import {constants,promises as fs} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {captureNativeSituation,NativeConversationError} from './native-conversation.mjs';

const MAX_RECORDS=32,MAX_RECEIPTS=32,MAX_BYTES=1800*1024;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const encode=value=>JSON.stringify(value);
const digest=value=>createHash('sha256').update(encode(value)).digest('hex');
// Context preparation is not proof that a human original is absent. Never feed
// its errors into an automatic original-retry/known-not-submitted decision.
const fail=(code,message)=>new NativeConversationError(code,message,{contextOnly:true,workAdmitted:false});
const fileRef=value=>value&&Object.keys(value).length===5&&uuid(value.file_id)
  &&/^[a-f0-9]{64}$/.test(value.sha256)&&value.name==='holodeck-situation.json'
  &&value.mime==='application/json'&&Number.isSafeInteger(value.size)&&value.size>0&&value.size<=49152;

// This is a bounded ledger of machine-source preparation, never chat history.
// Conversation owns human text/audio/files, recording, originals and all sends.
export async function createConversationContexts({room,stateDir,transport,allowInteriorSource}){
  await fs.mkdir(stateDir,{recursive:true,mode:0o700});
  const meta=await fs.lstat(stateDir);
  if(!meta.isDirectory()||meta.isSymbolicLink()||meta.uid!==process.getuid()||(meta.mode&0o077))throw Error('Private context source state required');
  const path=join(stateDir,'conversation-contexts.json');let records={},receipts={},serial=Promise.resolve(),fenced=false;
  const inflight=new Map();let retireCursor=0;
  try{
    const file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{
      const stat=await file.stat();if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o077)||stat.size>MAX_BYTES)throw Error('Invalid context source ledger');
      const saved=JSON.parse(await file.readFile('utf8'));
      if(saved.schema!=='holodeck.conversation-contexts/v1'||!saved.records||Array.isArray(saved.records)||Object.keys(saved.records).length>MAX_RECORDS)throw Error('Invalid context source ledger');
      for(const [id,r]of Object.entries(saved.records)){
        if(!uuid(id)||r.id!==id||typeof r.actorRef!=='string'||!r.actorRef.startsWith('human:')
          ||!/^[a-f0-9]{64}$/.test(r.requestHash)||!r.frozen||r.frozen.actorRef!==r.actorRef
          ||r.observation?.schema!=='holodeck.situation/v1'||r.observation.observer!==r.actorRef
          ||r.observation.inputAssociation?.humanInputId!==id||!['frozen','prepared'].includes(r.phase)
          ||r.phase==='prepared'&&!fileRef(r.file))throw Error('Invalid context source record');
      }
      const retained=saved.receipts??{};
      if(typeof retained!=='object'||Array.isArray(retained)||Object.keys(retained).length>MAX_RECEIPTS)
        throw Error('Invalid context receipt index');
      for(const [id,r] of Object.entries(retained)){
        if(!uuid(id)||saved.records[id]||!r||typeof r.actorRef!=='string'||!r.actorRef.startsWith('human:')
          ||r.frozen?.actorRef!==r.actorRef||typeof r.frozen.beingRef!=='string'
          ||!uuid(r.run)||typeof r.space!=='string'||typeof r.observationId!=='string'||!fileRef(r.file))
          throw Error('Invalid context receipt reference');
      }
      records=saved.records;receipts=retained;
    }finally{await file.close();}
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const transaction=fn=>{const work=serial.then(fn);serial=work.catch(()=>{});return work;};
  async function persist(nextReceipts=receipts){
    if(fenced)throw fail('context-recovery','Context source ledger needs receiving recovery');
    nextReceipts={...nextReceipts};
    const serialize=()=>Buffer.from(encode({schema:'holodeck.conversation-contexts/v1',records,receipts:nextReceipts}));
    const oldest=Object.keys(nextReceipts);
    while(oldest.length>MAX_RECEIPTS)delete nextReceipts[oldest.shift()];
    let bytes=serialize();
    while(bytes.length>MAX_BYTES&&oldest.length){
      delete nextReceipts[oldest.shift()];
      bytes=serialize();
    }
    if(bytes.length>MAX_BYTES||Object.keys(records).length>MAX_RECORDS)throw fail('capacity','Context source capacity reached');
    const stage=path+'.stage';const file=await fs.open(stage,constants.O_CREAT|constants.O_TRUNC|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
    try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
    let replaced=false;
    try{await fs.rename(stage,path);replaced=true;const dir=await fs.open(stateDir,constants.O_RDONLY);try{await dir.sync();}finally{await dir.close();}receipts=nextReceipts;}
    catch(error){if(replaced){fenced=true;error.replaced=true;}throw error;}
  }
  const actorRef=actor=>{
    if(actor?.kind!=='human'||typeof actor.ref!=='string'||!actor.ref.startsWith('human:')||actor.id!==actor.ref)throw fail('identity','Select the current authenticated human');
    return actor.ref;
  };
  function owned(actor,id){const record=records[id];if(!record||record.actorRef!==actorRef(actor))throw fail('not-found','No prepared source belongs to this participant');return record;}
  const result=record=>({id:record.id,binding:record.frozen.binding,files:[structuredClone(record.file)],work_admitted:false});
  const statusPayload=record=>({actorRef:record.actorRef,frozen:record.frozen,id:record.id,textSha256:null,
    observationId:record.observation.id,contextFile:record.file});
  async function retire(record,status){
    return transaction(async()=>{
      if(records[record.id]!==record)return false;
      const next={...receipts};
      if(status.phase==='completed'&&status.nativeAcceptance==='observed'&&record.observation.scope==='structured-interior-room'){
        const {actorRef,frozen,file,observation}=record;
        next[record.id]={actorRef,frozen,file,run:observation.run,space:observation.place.id,observationId:observation.id};
      }
      delete records[record.id];
      try{await persist(next);}catch(error){if(!error.replaced)records[record.id]=record;throw error;}
      return true;
    });
  }
  async function retireConfirmed(){
    // Bounded metadata reads, no model work and no unconfirmed source eviction.
    const available=Object.values(records).filter(r=>r.phase==='prepared');
    const selected=Array.from({length:Math.min(4,available.length)},(_,i)=>available[(retireCursor+i)%available.length]);
    if(available.length)retireCursor=(retireCursor+selected.length)%available.length;
    for(const candidate of selected){
      let status;try{status=await transport.status(statusPayload(candidate));}catch{continue;}
      if(status.retainedOriginal===true&&status.tracking===false&&['completed','problem'].includes(status.phase)){
        if(await retire(candidate,status))return true;
      }
    }
    return false;
  }
  async function prepareSource(actor,request,retryRecord=null,capturePlace=null){
      const ref=actorRef(actor);
      if(!request||Object.keys(request).some(k=>!['id','binding','view','displayedSequence'].includes(k))||!uuid(request.id)
        ||!/^[a-f0-9]{64}$/.test(request.binding))throw fail('input','Select the shared original and current binding');
      if(fenced)throw fail('context-recovery','Context source ledger needs receiving recovery');
      const requestHash=retryRecord?retryRecord.requestHash:digest({id:request.id,binding:request.binding,view:request.view??null,displayedSequence:request.displayedSequence??null});
      if(receipts[request.id])throw fail('id-reuse','Recover the existing canonical original before preparing another source');
      const existing=records[request.id];
      if(existing&&(existing.actorRef!==ref||existing.requestHash!==requestHash))throw fail('id-reuse','Preserve the originally captured source');
      const pending=inflight.get(request.id);
      if(pending){if(pending.actorRef!==ref||pending.requestHash!==requestHash)throw fail('id-reuse','This source identity is in use');return pending.work;}
      if(inflight.size>=8)throw fail('capacity','Source preparation is busy');
      if(request.view!==undefined&&(!request.view||typeof request.view!=='object'||
        Buffer.byteLength(encode(request.view))>4096))throw fail('input','Select a bounded client-reported view');
      const interior=existing||!capturePlace?null:capturePlace(actor,request);
      const work=(async()=>{
        const frozen=await transport.inspect(ref);
        if(frozen.actorRef!==ref||request.binding!==frozen.binding||Buffer.byteLength(encode(frozen))>4096)throw fail('binding','The continuing Conversation changed');
        // Explicit recovery resumes this exact retained record. Cancellation or
        // retirement during the authority read must never create a new capture.
        if(retryRecord&&records[request.id]!==retryRecord)throw fail('not-found','The retained source changed before recovery');
        let record=records[request.id];
        const indoorId=record?.observation.scope==='structured-interior-room'?
          record.observation.place.id:interior?.place.id;
        if(indoorId&&(!allowInteriorSource||!await allowInteriorSource(actor,frozen.beingRef,indoorId)))
          throw fail('forbidden','Tu daimon necesita acceso actual a esa sala para recibir su contexto');
        if(record){
          if(encode(record.frozen)!==encode(frozen)||record.observation.run!==room.run)throw fail('binding','Preserve the source from the earlier room or binding');
          if(record.phase==='prepared')return result(record);
        }else{
          const canonical=await transport.lookup({actorRef:ref,id:request.id,textSha256:null});
          if(canonical.state!=='absent')throw fail('id-reuse','Recover the existing canonical original before preparing another source');
          if(Object.keys(records).length>=MAX_RECORDS&&!await retireConfirmed())throw fail('capacity','Prepared sources need their retained results before new admission');
          record=await transaction(async()=>{
            if(interior&&interior.run!==room.run)throw fail('scope-changed','El mundo cambió durante la preparación');
            if(Object.keys(records).length>=MAX_RECORDS)throw fail('capacity','Context source capacity reached');
            const observation=captureNativeSituation(room,actor,request,{pairedBeing:frozen.beingRef,serverCapture:'at-machine-context-preparation',interior});
            const value={id:request.id,actorRef:ref,requestHash,frozen,observation,phase:'frozen'};records[value.id]=value;
            try{await persist();}catch(error){if(!error.replaced)delete records[value.id];throw error;}return value;
          });
        }
        if(indoorId&&!await allowInteriorSource(actor,frozen.beingRef,indoorId))
          throw fail('forbidden','El acceso a la sala cambió antes de preparar el contexto');
        if(record.observation.run!==room.run)throw fail('scope-changed','El mundo cambió antes de preparar el contexto');
        const prepared=await transport.prepareContext({actorRef:ref,frozen:record.frozen,id:record.id,observation:record.observation});
        if(prepared?.schema!=='holodeck.prepared-conversation-context/v1'||prepared.id!==record.id
          ||prepared.binding!==record.frozen.binding||encode(prepared.entry_binding)!==encode(record.frozen.entry)
          ||prepared.observation_id!==record.observation.id||prepared.work_admitted!==false||!fileRef(prepared.file))
          throw fail('source','The immutable source acknowledgment is unconfirmed');
        await transaction(async()=>{const previous={phase:record.phase,file:record.file};record.file=structuredClone(prepared.file);record.phase='prepared';
          try{await persist();}catch(error){if(!error.replaced){record.phase=previous.phase;if(previous.file)record.file=previous.file;else delete record.file;}throw error;}});
        return result(record);
      })();
      inflight.set(request.id,{actorRef:ref,requestHash,work});
      try{return await work;}catch(error){error.contextOnly=true;error.workAdmitted=false;delete error.knownNotSubmitted;throw error;}
      finally{inflight.delete(request.id);}
  }
  return {
    has:id=>!!records[id],
    hasWorldRequest:id=>!!(records[id]||receipts[id]),
    prepare:(actor,request,capturePlace)=>prepareSource(actor,request,null,capturePlace),
    async authorizeWorldRequest(id,expectedBeingRef){
      if(fenced)throw fail('context-recovery','Context source ledger needs receiving recovery');
      const record=records[id],receipt=receipts[id],source=record??receipt;
      const capturedSpace=receipt?.space??(record?.observation.scope==='structured-interior-room'?record.observation.place.id:null);
      if(!source||(record&&record.phase!=='prepared')||(receipt?.run??record?.observation.run)!==room.run
        ||source.frozen.beingRef!==expectedBeingRef)throw fail('native-scope','The prepared source does not belong to this room and return lane');
      const current=await transport.inspect(source.actorRef);
      if(encode(current)!==encode(source.frozen))throw fail('binding','The current pair or Conversation changed');
      const status=await transport.status(record?statusPayload(record):{
        actorRef:receipt.actorRef,frozen:receipt.frozen,id,textSha256:null,
        observationId:receipt.observationId,contextFile:receipt.file,
      });
      if(status.nativeAcceptance!=='observed'||status.phase==='problem'||status.retainedOriginal!==true
        ||(receipt&&(status.phase!=='completed'||status.tracking!==false)))
        throw fail('native-scope','Actual canonical admission is not observed');
      if(capturedSpace&&(!allowInteriorSource||
        !await allowInteriorSource({id:source.actorRef,ref:source.actorRef,kind:'human'},expectedBeingRef,capturedSpace)))
        throw fail('forbidden','El acceso a esa sala cambió');
      const final=await transport.inspect(source.actorRef);
      if(encode(final)!==encode(source.frozen))throw fail('binding','The pair or Conversation changed during canonical observation');
      if(fenced||(records[id]??receipts[id])!==source||(receipt?.run??record?.observation.run)!==room.run)
        throw fail('native-scope','The retained room source changed');
      return {actor:{id:current.beingRef,ref:current.beingRef,kind:'daimon'},humanRef:source.actorRef,nativeRequest:id,
        ...(capturedSpace?{capturedSpace,working:status.phase==='working',receiptOnly:!!receipt}: {})};
    },
    async release(actor,id){
      const previous=receipts[id];
      if(previous&&previous.actorRef===actorRef(actor)&&!fenced)return {released:true,canonicalOriginalPreserved:true};
      const record=owned(actor,id);if(fenced||record.phase!=='prepared')return {released:false};
      const status=await transport.status(statusPayload(record));
      if(status.retainedOriginal!==true||status.tracking!==false||!['completed','problem'].includes(status.phase))return {released:false};
      const released=await retire(record,status);
      return {released,canonicalOriginalPreserved:true};
    },
    async discard(actor,id,binding,reason){
      const ref=actorRef(actor);
      if(!['capture-cancelled','preparation-failed'].includes(reason))throw fail('input','Select a source-only cancellation');
      const pending=inflight.get(id);
      if(pending){if(pending.actorRef!==ref)throw fail('not-found','No source belongs to this participant');try{await pending.work;}catch{/* Inspect the retained preparation below. */}}
      if(!records[id])return {released:false,sourceReservationRetained:false};
      const record=owned(actor,id);if(fenced||binding!==record.frozen.binding)throw fail('binding','Preserve the original source binding');
      const canonical=await transport.lookup({actorRef:ref,id,textSha256:null});
      if(canonical.state!=='absent')return {released:false,sourceReservationRetained:true};
      // The shared component signals this only before attempting its writer.
      // Verify canonical absence too, then forget machine preparation only.
      // No original/file is deleted, cancelled or declared never submitted.
      await transaction(async()=>{if(records[id]!==record)return;delete records[id];try{await persist();}catch(error){if(!error.replaced)records[id]=record;throw error;}});
      return {released:true,canonicalOriginalAltered:false,canonicalFilesPreserved:true};
    },
    async recover(actor,id,binding){
      const record=owned(actor,id);const current=await transport.inspect(record.actorRef);
      if(fenced||binding!==record.frozen.binding||encode(current)!==encode(record.frozen)||record.observation.run!==room.run)
        throw fail('binding','Preserve the source from the earlier room or binding');
      if(record.observation.scope==='structured-interior-room'&&(!allowInteriorSource||
        !await allowInteriorSource(actor,record.frozen.beingRef,record.observation.place.id)))
        throw fail('forbidden','El acceso a esa sala cambió');
      return record.phase==='prepared'?{...result(record),prepared:true}:{id,prepared:false,work_admitted:false};
    },
    async retry(actor,id,binding){
      const record=owned(actor,id);if(binding!==record.frozen.binding)throw fail('binding','The original source belongs to another binding');
      // Optional client view may omit historyReference or all view detail. It is
      // not the original request and cannot reconstruct its immutable hash.
      return prepareSource(actor,{id,binding},record);
    },
    async inspect(actor,id){const record=owned(actor,id);return {id:record.id,prepared:record.phase==='prepared',work_admitted:false};}
  };
}
