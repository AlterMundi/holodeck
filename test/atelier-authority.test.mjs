import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,verify} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import net from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {createAtelierRoomAuthority} from '../src/atelier-authority.mjs';
import {createWorldPort} from '../src/world-port.mjs';

function roundtrip(path,request){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(path);
    let response='';
    socket.setEncoding('utf8');
    socket.once('error',reject);
    socket.on('connect',()=>socket.write(JSON.stringify(request)+'\n'));
    socket.on('data',chunk=>{response+=chunk;});
    socket.once('end',()=>{
      try{resolve(JSON.parse(response));}catch(error){reject(error);}
    });
  });
}

test('the own world lane signs an Atelier call only in its admitted room and through existing rights',async context=>{
  const folder=await mkdtemp(join(tmpdir(),'holodeck-atelier-'));
  const atelierSocket=join(folder,'atelier.sock'),worldSocket=join(folder,'world.sock'),signingKey=join(folder,'test.pem');
  const issuer=generateKeyPairSync('ed25519');
  await writeFile(signingKey,issuer.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  const workspace=randomUUID(),room='fixture-atelier',revisionId=randomUUID();
  const beingRef='dm:being:v1:'+'a'.repeat(43);
  let access=['observe','edit'],position='outside';
  const received=[];
  const receiver=net.createServer(socket=>{
    let input='';
    socket.setEncoding('utf8');
    socket.on('data',chunk=>{
      input+=chunk;
      if(!input.endsWith('\n'))return;
      const proof=JSON.parse(input),payload=Buffer.from(proof.payload,'base64url');
      assert.equal(proof.schema,'atelier.native-proof/v1');
      assert.equal(verify(null,Buffer.concat([Buffer.from('daimon/atelier/native-request/v1\0'),payload]),
        issuer.publicKey,Buffer.from(proof.signature,'base64url')),true);
      const request=JSON.parse(payload);
      assert.equal(request.actorRef,beingRef);
      assert.equal(request.workspace,workspace);
      assert.equal(request.audience,'atelier-shared-workshop');
      assert.ok(request.expiresAtMs>Date.now());
      received.push(request);
      const value=request.operation==='read'?{workspace,revision:{id:revisionId,sha256:'a'.repeat(64)},selection:null}:
        request.operation==='result'?null:{workspace,actor:beingRef,operationId:request.args.operationId,revisionId,changedVertices:1};
      socket.end(JSON.stringify({ok:true,result:value})+'\n');
    });
  });
  await new Promise(resolve=>receiver.listen(atelierSocket,resolve));
  const atelierWorkshop=createAtelierRoomAuthority({room,workspace,socket:atelierSocket,signingKey});
  const port=await createWorldPort({socketPath:worldSocket,expectedBeingRef:beingRef,room:{run:'fixture',edition:'fixture'},
    native:{authorizeWorldRequest:async()=>({actor:{id:beingRef,ref:beingRef,kind:'daimon'}})},
    resolveRights:async()=>access,resolveOwnNativeRights:async()=>access,
    describeSpace:()=>({id:position,entrances:[]}),moveSpace:(_,step)=>{position=step.to;return {id:position};},atelierWorkshop});
  context.after(async()=>{
    await port.close();
    await new Promise(resolve=>receiver.close(resolve));
    await rm(folder,{recursive:true,force:true});
  });
  const act=args=>roundtrip(worldSocket,{ownNative:true,operation:'act',args});
  assert.equal((await act({type:'atelier.read'})).ok,false);
  assert.equal(received.length,0);
  assert.equal((await act({type:'space.move',from:'outside',to:room})).ok,true);
  const observation=await roundtrip(worldSocket,{ownNative:true,operation:'observe',args:{}});
  assert.deepEqual(observation.result.atelier,{room,workspace});
  assert.equal((await act({type:'atelier.read'})).result.revision.id,revisionId);
  assert.equal((await act({type:'atelier.read',actorRef:'forged'})).ok,false);
  assert.equal((await roundtrip(worldSocket,{interactionId:randomUUID(),operation:'act',args:{type:'atelier.read'}})).ok,false);
  assert.equal(received.length,1);

  const operationId=randomUUID();
  const edit={type:'atelier.smooth',operationId,expectedRevision:revisionId,radiusMm:5,strength:.4,
    selection:{objectId:randomUUID(),triangleIndex:2,barycentric:[.2,.3,.5]}};
  access=['observe'];
  assert.equal((await act(edit)).ok,false);
  assert.equal(received.length,1);
  access=['observe','edit'];
  assert.equal((await act(edit)).result.operationId,operationId);
  assert.deepEqual(received[1].args,{...edit,type:'smooth'});
  assert.deepEqual((await act({type:'atelier.result',operationId})).result,null);
  access=[];
  assert.equal((await act({type:'atelier.read'})).ok,false);
  assert.equal(received.length,3);
  access=['observe','edit'];
  assert.equal((await act({type:'space.move',from:room,to:'outside'})).ok,true);
  assert.equal((await act({type:'atelier.read'})).ok,false);
  assert.equal(received.length,3);
});
