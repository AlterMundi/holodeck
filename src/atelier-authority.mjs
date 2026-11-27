import {createHash,createPrivateKey,randomUUID,sign} from 'node:crypto';
import {closeSync,constants,fstatSync,openSync,readFileSync} from 'node:fs';
import net from 'node:net';
import {ActivityError} from './activity.mjs';

const DOMAIN=Buffer.from('daimon/atelier/native-request/v1\0');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BEING=/^dm:being:v1:[A-Za-z0-9_-]{43}$/;
const HUMAN=/^human:telegram:[1-9][0-9]*$/;
const DIGEST=/^[a-f0-9]{64}$/;
const ERRORS=new Set(['workspace-unavailable','stale-revision','operation-conflict','revision-unavailable',
  'workspace-storage-full','invalid-command','invalid-selection','invalid-brush']);
const FIELDS=new Map([['read',''],['result','operationId'],
  ['view',''],['projection','asset'],['select','expectedRevision,selection'],
  ['smooth','expectedRevision,operationId,radiusMm,selection,strength,type']]);
const replyLimits=new Map([['view',21*1024**2],['projection',6*1024**2]]);

function exchange(path,request,limit){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(path);
    const chunks=[];
    let bytes=0,finished=false;
    const timeout=setTimeout(()=>done(Error('Atelier reply unconfirmed')),6500);
    function done(error,result){
      if(finished)return;
      finished=true;
      clearTimeout(timeout);
      socket.destroy();
      if(error)reject(error);else resolve(result);
    }
    socket.on('error',error=>done(error));
    socket.on('end',()=>done(Error('Atelier reply incomplete')));
    socket.on('connect',()=>socket.write(JSON.stringify(request)+'\n'));
    socket.on('data',chunk=>{
      const end=chunk.indexOf(10);
      if(end!==-1&&end!==chunk.length-1)return done(Error('Atelier reply contains an extra frame'));
      const data=end<0?chunk:chunk.subarray(0,end);
      bytes+=data.length;
      if(bytes>limit)return done(Error('Atelier reply exceeds its bound'));
      chunks.push(data);
      if(end===-1)return;
      try{done(null,JSON.parse(Buffer.concat(chunks,bytes)));}catch(error){done(error);}
    });
  });
}

export function createAtelierRoomAuthority(selection){
  if(!selection||Object.keys(selection).filter(key=>key!=='projection').sort().join(',')!=='room,signingKey,socket,workspace'||
     typeof selection.room!=='string'||!/^[a-z0-9][a-z0-9-]{0,80}$/.test(selection.room)||selection.room==='outside'||
     typeof selection.workspace!=='string'||!UUID.test(selection.workspace)||
     typeof selection.socket!=='string'||!selection.socket.startsWith('/')||selection.socket.includes('\0')||Buffer.byteLength(selection.socket)>103||
     typeof selection.signingKey!=='string'||!selection.signingKey.startsWith('/'))throw Error('Select one fixed Atelier room, workspace and transport');
  const {room,workspace,socket,signingKey,projection}=selection;
  if(projection!==undefined&&(!projection||Object.keys(projection).sort().join(',')!=='anchor,htmlSha256,humanRef,scriptSha256'||
    typeof projection.anchor!=='string'||!/^[a-z0-9][a-z0-9-]{0,87}$/.test(projection.anchor)||
    typeof projection.humanRef!=='string'||!HUMAN.test(projection.humanRef)||
    ![projection.htmlSha256,projection.scriptSha256].every(value=>typeof value==='string'&&DIGEST.test(value))))
    throw Error('Select the authorized human, room anchor and exact Atelier projection assets');
  const fd=openSync(signingKey,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  let key;
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.uid!==process.getuid()||stat.mode&0o077||stat.size>4096)
      throw Error('The Atelier issuer requires an owner-only service key');
    key=createPrivateKey(readFileSync(fd));
  }finally{closeSync(fd);}
  if(key.asymmetricKeyType!=='ed25519')throw Error('Select the registered Atelier Ed25519 issuer');

  const description=Object.freeze({room,workspace});
  function browserAnchor(actor,position){
    if(!projection||position?.id!==room||actor?.kind!=='human'||actor.ref!==projection.humanRef||actor.id!==actor.ref||
       !actor.rights?.includes('observe'))return null;
    return position.objects?.find(object=>object.id===projection.anchor)??null;
  }
  async function dispatch(actor,position,operation,args){
    const human=Boolean(browserAnchor(actor,position));
    const native=position?.id===room&&actor?.kind==='daimon'&&actor.id===actor.ref&&BEING.test(actor.ref)&&
      actor.rights?.includes('observe')&&['read','smooth','result'].includes(operation);
    if(!(human||native)||!FIELDS.has(operation)||(['smooth','select'].includes(operation)&&!actor.rights.includes('edit')))
      throw Error('The actor must be admitted in the configured Atelier room');
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).sort().join(',')!==FIELDS.get(operation)||
       (['smooth','result'].includes(operation)&&!UUID.test(args.operationId??''))||
       (['smooth','select'].includes(operation)&&!UUID.test(args.expectedRevision??''))||
       (operation==='smooth'&&args.type!=='smooth')||
       (operation==='projection'&&!['html','script'].includes(args.asset)))throw new ActivityError('invalid-command',400,'Operación de Atelier inválida.');
    const issuedAtMs=Date.now();
    const request=Buffer.from(JSON.stringify({schema:'atelier.native-request/v1',audience:'atelier-shared-workshop',
      requestId:randomUUID(),actorRef:actor.ref,workspace,operation,issuedAtMs,expiresAtMs:issuedAtMs+15_000,args}));
    if(request.length>8192)throw Error('Atelier action exceeds its bound');
    const proof={schema:'atelier.native-proof/v1',payload:request.toString('base64url'),
      signature:sign(null,Buffer.concat([DOMAIN,request]),key).toString('base64url')};
    const reply=await exchange(socket,proof,replyLimits.get(operation)??8192);
    if(reply?.ok===false&&ERRORS.has(reply.error))throw new ActivityError(reply.error,409,'Atelier no aceptó esta operación.');
    if(reply?.ok!==true||(!reply.result&&!(operation==='result'&&reply.result===null)))throw Error('The Atelier response is unconfirmed');
    const value=reply.result;
    if(value===null)return null;
    if(value.workspace!==workspace)throw Error('The Atelier response does not match the requested workspace');
    if(operation==='projection'){
      if(value.asset!==args.asset||typeof value.content!=='string')throw Error('The Atelier projection asset is unavailable');
      const content=Buffer.from(value.content,'base64');
      if(createHash('sha256').update(content).digest('hex')!==projection[args.asset+'Sha256'])
        throw Error('The Atelier projection asset does not match its selected digest');
      return content;
    }
    if((['read','view'].includes(operation)&&(!UUID.test(value.revision?.id??'')||!DIGEST.test(value.revision?.sha256??'')))||
       (operation==='select'&&(value.actor!==actor.ref||value.revisionId!==args.expectedRevision))||
       (['smooth','result'].includes(operation)&&(value.actor!==actor.ref||value.operationId!==args.operationId||
        !UUID.test(value.revisionId??''))))throw Error('The Atelier response does not match the requested operation');
    return reply.result;
  }
  return {description,browserAnchor,dispatch};
}
