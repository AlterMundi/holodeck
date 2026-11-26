import {createPrivateKey,randomUUID,sign} from 'node:crypto';
import {closeSync,constants,fstatSync,openSync,readFileSync} from 'node:fs';
import net from 'node:net';
import {ActivityError} from './activity.mjs';

const DOMAIN=Buffer.from('daimon/atelier/native-request/v1\0');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BEING=/^dm:being:v1:[A-Za-z0-9_-]{43}$/;
const ERRORS=new Set(['workspace-unavailable','stale-revision','operation-conflict','revision-unavailable',
  'workspace-storage-full','invalid-command','invalid-selection','invalid-brush']);
const FIELDS=new Map([['read',''],['result','operationId'],
  ['smooth','expectedRevision,operationId,radiusMm,selection,strength,type']]);

function exchange(path,request){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(path);
    let buffer=Buffer.alloc(0),finished=false;
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
      if(buffer.length+chunk.length>8192)return done(Error('Atelier reply exceeds its bound'));
      buffer=Buffer.concat([buffer,chunk]);
      const end=buffer.indexOf(10);
      if(end<0)return;
      try{done(null,JSON.parse(buffer.subarray(0,end)));}catch(error){done(error);}
    });
  });
}

export function createAtelierRoomAuthority(selection){
  if(!selection||Object.keys(selection).sort().join(',')!=='room,signingKey,socket,workspace'||
     typeof selection.room!=='string'||!/^[a-z0-9][a-z0-9-]{0,80}$/.test(selection.room)||selection.room==='outside'||
     typeof selection.workspace!=='string'||!UUID.test(selection.workspace)||
     typeof selection.socket!=='string'||!selection.socket.startsWith('/')||selection.socket.includes('\0')||Buffer.byteLength(selection.socket)>103||
     typeof selection.signingKey!=='string'||!selection.signingKey.startsWith('/'))throw Error('Select one fixed Atelier room, workspace and transport');
  const {room,workspace,socket,signingKey}=selection;
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
  async function dispatch(actor,position,operation,args){
    if(position?.id!==room||actor?.kind!=='daimon'||actor.id!==actor.ref||!BEING.test(actor.ref)||
       !Array.isArray(actor.rights)||!actor.rights.includes('observe')||!FIELDS.has(operation)||
       (operation==='smooth'&&!actor.rights.includes('edit')))throw Error('The native actor must be admitted in the configured Atelier room');
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).sort().join(',')!==FIELDS.get(operation)||
       (operation!=='read'&&!UUID.test(args.operationId??''))||
       (operation==='smooth'&&(args.type!=='smooth'||!UUID.test(args.expectedRevision??''))))throw Error('Invalid Atelier action');
    const issuedAtMs=Date.now();
    const request=Buffer.from(JSON.stringify({schema:'atelier.native-request/v1',audience:'atelier-shared-workshop',
      requestId:randomUUID(),actorRef:actor.ref,workspace,operation,issuedAtMs,expiresAtMs:issuedAtMs+15_000,args}));
    if(request.length>8192)throw Error('Atelier action exceeds its bound');
    const proof={schema:'atelier.native-proof/v1',payload:request.toString('base64url'),
      signature:sign(null,Buffer.concat([DOMAIN,request]),key).toString('base64url')};
    const reply=await exchange(socket,proof);
    if(reply?.ok===false&&ERRORS.has(reply.error))throw new ActivityError(reply.error,409,'Atelier no aceptó esta operación.');
    if(reply?.ok!==true||(!reply.result&&!(operation==='result'&&reply.result===null)))throw Error('The Atelier response is unconfirmed');
    if(reply.result!==null&&(reply.result.workspace!==workspace||
      (operation==='read'&&(!UUID.test(reply.result.revision?.id??'')||!(/^[a-f0-9]{64}$/).test(reply.result.revision?.sha256??'')))||
      (operation!=='read'&&(reply.result.actor!==actor.ref||reply.result.operationId!==args.operationId||
        !UUID.test(reply.result.revisionId??'')))))throw Error('The Atelier response does not match the requested workspace');
    return reply.result;
  }
  return {description,dispatch};
}
