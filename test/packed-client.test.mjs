import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {brotliCompressSync,brotliDecompressSync} from 'node:zlib';
import express from 'express';
import {packedClientHandler} from '../src/packed-client.mjs';

test('the package delivers the same client code as Brotli or identity, with correct negotiation',async t=>{
  const javascript=Buffer.from('const title = "Holodeck";\n'.repeat(400));
  const packed=brotliCompressSync(javascript);
  const app=express();
  app.get('/client/client.js',packedClientHandler(packed));
  const server=app.listen(0,'127.0.0.1');
  t.after(()=>new Promise(done=>server.close(done)));
  await once(server,'listening');
  function read(encoding,method='GET'){
    return new Promise((resolve,reject)=>{
      request({host:'127.0.0.1',port:server.address().port,path:'/client/client.js',
        method,...(encoding?{headers:{'Accept-Encoding':encoding}}:{})},res=>{
        const chunks=[];
        res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));
      }).on('error',reject).end();
    });
  }
  const br=await read('gzip, br');
  assert.equal(br.status,200);
  assert.equal(br.headers['content-encoding'],'br');
  assert.equal(br.headers.vary,'Accept-Encoding');
  assert.match(br.headers['content-type'],/javascript/);
  assert.deepEqual(brotliDecompressSync(br.bytes),javascript);
  for(const accept of [undefined,'gzip','br;q=0','identity;q=1, br;q=.2']){
    const identity=await read(accept);
    assert.equal(identity.status,200);
    assert.equal(identity.headers['content-encoding'],undefined);
    assert.deepEqual(identity.bytes,javascript);
  }
  const head=await read('br','HEAD');
  assert.equal(head.headers['content-encoding'],'br');
  assert.equal(head.bytes.length,0);
  assert.equal((await read('br;q=0, identity;q=0')).status,406);
});
