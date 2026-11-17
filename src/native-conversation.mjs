import { constants, promises as fs } from 'node:fs';
import { join } from 'node:path';
import net from 'node:net';

const JOURNAL_BYTES=1800*1024, MAX_RECORDS=32, MAX_OBSERVATION_BYTES=16384;
const encode=value=>JSON.stringify(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export class NativeConversationError extends Error {
  constructor(code,message){super(message);this.code=code;}
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
          if(reply.ok!==true)return finish(new NativeConversationError(reply.code||'unavailable',reply.message||'Native operation unavailable'));
          finish(null,reply.result);
        }catch(error){finish(error);}
      });
      socket.on('end',()=>{if(!done)finish(new Error('Native response unconfirmed'));});
    });
  }
  return {inspect:actorRef=>call('inspect',{actorRef}),
    submit:payload=>call('submit',payload),status:payload=>call('status',payload)};
}

export async function createNativeConversation({room,stateDir,transport}){
  if(!room||!stateDir||!transport)throw Error('Select room, bounded state and receiving native transport');
  await fs.mkdir(stateDir,{recursive:true,mode:0o700});
  const directory=await fs.lstat(stateDir);
  if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==process.getuid()||(directory.mode&0o077))
    throw Error('Native intents require owner-private state');
  const path=join(stateDir,'native-turns.json');let records={};let serial=Promise.resolve();
  try{
    const file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{const stat=await file.stat();if(!stat.isFile()||stat.size>JOURNAL_BYTES||stat.uid!==process.getuid()||(stat.mode&0o077))throw Error('Invalid native intent journal');
      const value=JSON.parse(await file.readFile('utf8'));
      if(value.schema!=='holodeck.native-intents/v1'||!value.records||Object.keys(value.records).length>MAX_RECORDS)throw Error('Invalid native intent journal');
      records=value.records;
    }finally{await file.close();}
  }catch(error){if(error.code!=='ENOENT')throw error;}
  async function persist(){
    const bytes=Buffer.from(encode({schema:'holodeck.native-intents/v1',records}));
    if(bytes.length>JOURNAL_BYTES)throw new NativeConversationError('capacity','Native intent storage is full');
    const stage=path+'.stage';
    const file=await fs.open(stage,constants.O_CREAT|constants.O_TRUNC|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
    try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
    await fs.rename(stage,path);const dir=await fs.open(stateDir,constants.O_RDONLY);
    try{await dir.sync();}finally{await dir.close();}
  }
  function transaction(fn){const work=serial.then(fn);serial=work.catch(()=>{});return work;}
  function actorRef(actor){
    if(actor?.kind!=='human'||typeof actor.ref!=='string'||!actor.ref.startsWith('human:'))
      throw new NativeConversationError('identity','Sign in with your existing human identity');
    return actor.ref;
  }
  function own(actor,id){const record=records[id];if(!record||record.actorRef!==actorRef(actor))throw new NativeConversationError('not-found','No interaction belongs to this participant');return record;}
  function view(record,result=null){return {id:record.id,phase:result?.phase||record.phase,
    observation:record.observation.id,run:record.observation.run,
    message:result?.message??null,updates:result?.updates??[],
    nativeAcceptance:result?.nativeAcceptance??'unconfirmed',
    error:record.phase==='unknown'?'La respuesta todavía no está confirmada. Comprobá su estado antes de volver a intentar.':record.phase==='problem'?'No pude iniciar este turno.':null};}
  async function execute(record){
    await transaction(async()=>{record.phase='submitting';await persist();});
    try{
      const result=await transport.submit({actorRef:record.actorRef,frozen:record.frozen,
        input:{id:record.id,text:record.text},observation:record.observation});
      await transaction(async()=>{record.phase=result.phase;await persist();});
      return view(record,result);
    }catch(error){
      const refused=error instanceof NativeConversationError&&['binding','identity','context','input'].includes(error.code);
      await transaction(async()=>{record.phase=refused?'problem':'unknown';await persist();});
      return view(record);
    }
  }
  return {
    async availability(actor){
      try{const ref=actorRef(actor),binding=await transport.inspect(ref);
        const active=Object.values(records).reverse().find(record=>record.actorRef===ref
          &&record.observation.run===room.run&&!['completed','problem'].includes(record.phase)
          &&(!record.frozen||encode(record.frozen)===encode(binding)));
        return {available:true,beingRef:binding.beingRef,active:active?{id:active.id,phase:active.phase}:null};}
      catch{return {available:false};}
    },
    async submit(actor,request){
      const ref=actorRef(actor);
      if(!request||Object.keys(request).some(key=>!['id','text','displayedSequence','view'].includes(key))
        ||!uuid(request.id)||typeof request.text!=='string'||!request.text.trim()||request.text.includes('\0')||Buffer.byteLength(request.text)>32768)
        throw new NativeConversationError('input','Provide one bounded original interaction');
      let duplicate=false;
      const record=await transaction(async()=>{
        const existing=records[request.id];
        if(existing){if(existing.actorRef!==ref||existing.text!==request.text)throw new NativeConversationError('id-reuse','Interaction ID has different contents');duplicate=true;return existing;}
        if(Object.keys(records).length>=MAX_RECORDS)throw new NativeConversationError('capacity','Native intent storage is full');
        const observation=room.observe(actor,{after:Math.max(0,room.sequence-16),displayedSequence:request.displayedSequence??null});
        if(request.view!==undefined){
          if(!request.view||typeof request.view!=='object'||Buffer.byteLength(encode(request.view))>4096)
            throw new NativeConversationError('view','Provide a bounded client-reported view');
          observation.clientReportedView={evidence:'client-reported-at-interaction-capture',value:structuredClone(request.view),
            uncertainty:'Not authoritative location, line of sight, attention or understanding.'};
        }
        if(Buffer.byteLength(encode(observation))>MAX_OBSERVATION_BYTES)
          throw new NativeConversationError('context-capacity','The captured situation exceeds the native context bound');
        const value={id:request.id,actorRef:ref,text:request.text,observation,phase:'preparing',frozen:null};
        records[value.id]=value;
        if(Buffer.byteLength(encode({schema:'holodeck.native-intents/v1',records}))>JOURNAL_BYTES-8192){
          delete records[value.id];throw new NativeConversationError('capacity','Native intent storage is full');
        }
        try{await persist();}catch(error){delete records[value.id];throw error;}
        return value;
      });
      if(duplicate)return this.status(actor,record.id);
      try{
        const frozen=await transport.inspect(ref);
        if(Buffer.byteLength(encode(frozen))>4096)throw new NativeConversationError('binding','Native binding exceeds its bound');
        await transaction(async()=>{record.frozen=frozen;await persist();});
      }catch{
        await transaction(async()=>{record.phase='problem';await persist();});return view(record);
      }
      return execute(record);
    },
    async status(actor,id){
      const record=own(actor,id);
      if(!record.frozen)return view(record);
      try{const result=await transport.status({actorRef:record.actorRef,frozen:record.frozen,id});
        await transaction(async()=>{record.phase=result.phase;await persist();});return view(record,result);
      }catch{return {...view(record),phase:'unknown',error:'No puedo actualizar este turno. Tu mensaje no se reenviará solo.'};}
    },
    async authorizeWorldRequest(interactionId){
      const record=records[interactionId];
      if(!record?.frozen||record.observation.run!==room.run)
        throw new NativeConversationError('native-scope','The retained interaction does not belong to this room run');
      const current=await transport.inspect(record.actorRef);
      if(encode(current)!==encode(record.frozen))
        throw new NativeConversationError('binding','The human/daimon pairing or continuing Conversation changed');
      const status=await transport.status({actorRef:record.actorRef,frozen:record.frozen,id:interactionId});
      if(status.nativeAcceptance!=='observed'||status.phase==='problem')
        throw new NativeConversationError('native-scope','Native admission of this interaction is not confirmed');
      return {actor:{id:current.beingRef,ref:current.beingRef,kind:'daimon'},
        humanRef:record.actorRef,nativeRequest:record.id};
    },
    // Explicit exact-original retry only; status never resubmits. The owning
    // native journal decides whether the same identity already has an effect.
    async retry(actor,id){
      const record=own(actor,id);
      if(!['unknown','problem'].includes(record.phase))return this.status(actor,id);
      if(!record.frozen){const frozen=await transport.inspect(record.actorRef);if(Buffer.byteLength(encode(frozen))>4096)throw new NativeConversationError('binding','Native binding exceeds its bound');await transaction(async()=>{record.frozen=frozen;await persist();});}
      return execute(record);
    }
  };
}

export async function nativeFactory({room,stateDir,receiving}){
  if(!receiving?.nativeSocket)return null;
  return createNativeConversation({room,stateDir:join(stateDir,'native'),
    transport:createUnixNativeTransport(receiving.nativeSocket)});
}
