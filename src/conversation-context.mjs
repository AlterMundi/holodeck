import {constants,promises as fs} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {captureNativeSituation,NativeConversationError} from './native-conversation.mjs';

const MAX_RECORDS=32,MAX_BYTES=1800*1024;
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
export async function createConversationContexts({room,stateDir,transport}){
  await fs.mkdir(stateDir,{recursive:true,mode:0o700});
  const meta=await fs.lstat(stateDir);
  if(!meta.isDirectory()||meta.isSymbolicLink()||meta.uid!==process.getuid()||(meta.mode&0o077))throw Error('Private context source state required');
  const path=join(stateDir,'conversation-contexts.json');let records={},serial=Promise.resolve(),fenced=false;
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
      records=saved.records;
    }finally{await file.close();}
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const transaction=fn=>{const work=serial.then(fn);serial=work.catch(()=>{});return work;};
  async function persist(){
    if(fenced)throw fail('context-recovery','Context source ledger needs receiving recovery');
    const bytes=Buffer.from(encode({schema:'holodeck.conversation-contexts/v1',records}));
    if(bytes.length>MAX_BYTES||Object.keys(records).length>MAX_RECORDS)throw fail('capacity','Context source capacity reached');
    const stage=path+'.stage';const file=await fs.open(stage,constants.O_CREAT|constants.O_TRUNC|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
    try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
    let replaced=false;
    try{await fs.rename(stage,path);replaced=true;const dir=await fs.open(stateDir,constants.O_RDONLY);try{await dir.sync();}finally{await dir.close();}}
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
  async function retireConfirmed(){
    // Bounded metadata reads, no model work and no unconfirmed source eviction.
    const available=Object.values(records).filter(r=>r.phase==='prepared');
    const selected=Array.from({length:Math.min(4,available.length)},(_,i)=>available[(retireCursor+i)%available.length]);
    if(available.length)retireCursor=(retireCursor+selected.length)%available.length;
    for(const candidate of selected){
      let status;try{status=await transport.status(statusPayload(candidate));}catch{continue;}
      if(status.retainedOriginal===true&&status.tracking===false&&['completed','problem'].includes(status.phase)){
        await transaction(async()=>{if(records[candidate.id]!==candidate)return;delete records[candidate.id];
          try{await persist();}catch(error){if(!error.replaced)records[candidate.id]=candidate;throw error;}});
        return true;
      }
    }
    return false;
  }
  return {
    has:id=>!!records[id],
    async prepare(actor,request){
      const ref=actorRef(actor);
      if(!request||Object.keys(request).some(k=>!['id','binding','view','displayedSequence'].includes(k))||!uuid(request.id)
        ||!/^[a-f0-9]{64}$/.test(request.binding))throw fail('input','Select the shared original and current binding');
      if(fenced)throw fail('context-recovery','Context source ledger needs receiving recovery');
      const requestHash=digest({id:request.id,binding:request.binding,view:request.view??null,displayedSequence:request.displayedSequence??null});
      const existing=records[request.id];
      if(existing&&(existing.actorRef!==ref||existing.requestHash!==requestHash))throw fail('id-reuse','Preserve the originally captured source');
      const pending=inflight.get(request.id);
      if(pending){if(pending.actorRef!==ref||pending.requestHash!==requestHash)throw fail('id-reuse','This source identity is in use');return pending.work;}
      if(inflight.size>=8)throw fail('capacity','Source preparation is busy');
      const work=(async()=>{
        const frozen=await transport.inspect(ref);
        if(frozen.actorRef!==ref||request.binding!==frozen.binding||Buffer.byteLength(encode(frozen))>4096)throw fail('binding','The continuing Conversation changed');
        let record=records[request.id];
        if(record){
          if(encode(record.frozen)!==encode(frozen)||record.observation.run!==room.run)throw fail('binding','Preserve the source from the earlier room or binding');
          if(record.phase==='prepared')return result(record);
        }else{
          const canonical=await transport.lookup({actorRef:ref,id:request.id,textSha256:null});
          if(canonical.state!=='absent')throw fail('id-reuse','Recover the existing canonical original before preparing another source');
          if(Object.keys(records).length>=MAX_RECORDS&&!await retireConfirmed())throw fail('capacity','Prepared sources need their retained results before new admission');
          record=await transaction(async()=>{
            if(Object.keys(records).length>=MAX_RECORDS)throw fail('capacity','Context source capacity reached');
            const observation=captureNativeSituation(room,actor,request,{pairedBeing:frozen.beingRef,serverCapture:'at-machine-context-preparation'});
            const value={id:request.id,actorRef:ref,requestHash,frozen,observation,phase:'frozen'};records[value.id]=value;
            try{await persist();}catch(error){if(!error.replaced)delete records[value.id];throw error;}return value;
          });
        }
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
    },
    async authorizeWorldRequest(id,expectedBeingRef){
      if(fenced)throw fail('context-recovery','Context source ledger needs receiving recovery');
      const record=records[id];if(!record||record.phase!=='prepared'||record.observation.run!==room.run
        ||record.frozen.beingRef!==expectedBeingRef)throw fail('native-scope','The prepared source does not belong to this room and return lane');
      const current=await transport.inspect(record.actorRef);
      if(encode(current)!==encode(record.frozen))throw fail('binding','The current pair or Conversation changed');
      const status=await transport.status(statusPayload(record));
      if(status.nativeAcceptance!=='observed'||status.phase==='problem'||status.retainedOriginal!==true)
        throw fail('native-scope','Actual canonical admission is not observed');
      const final=await transport.inspect(record.actorRef);
      if(encode(final)!==encode(record.frozen))throw fail('binding','The pair or Conversation changed during canonical observation');
      return {actor:{id:current.beingRef,ref:current.beingRef,kind:'daimon'},humanRef:record.actorRef,nativeRequest:record.id};
    },
    async release(actor,id){
      const record=owned(actor,id);if(fenced||record.phase!=='prepared')return {released:false};
      const status=await transport.status(statusPayload(record));
      if(status.retainedOriginal!==true||status.tracking!==false||!['completed','problem'].includes(status.phase))return {released:false};
      await transaction(async()=>{if(records[id]!==record)return;delete records[id];try{await persist();}catch(error){if(!error.replaced)records[id]=record;throw error;}});
      return {released:true,canonicalOriginalPreserved:true};
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
      return record.phase==='prepared'?{...result(record),prepared:true}:{id,prepared:false,work_admitted:false};
    },
    async retry(actor,id,binding){
      const record=owned(actor,id);if(binding!==record.frozen.binding)throw fail('binding','The original source belongs to another binding');
      return this.prepare(actor,{id,binding,view:record.observation.clientReportedView?.value,
        displayedSequence:record.observation.source.displayedSequence??null});
    },
    async inspect(actor,id){const record=owned(actor,id);return {id:record.id,prepared:record.phase==='prepared',work_admitted:false};}
  };
}
