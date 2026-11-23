import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {test} from 'node:test';
import {brotliCompressSync,brotliDecompressSync} from 'node:zlib';
import express from 'express';
import {sendPackedArt} from '../src/packed-art.mjs';

test('packed art preserves decoded bytes, representation validators and public byte ranges',async t=>{
  const bytes=Buffer.from('glTF'+('qualified mesh data').repeat(100));
  const art={bytes,packed:brotliCompressSync(bytes),identityTag:'"identity"',packedTag:'"packed"',
    modified:'Sun, 22 Nov 2026 20:00:00 GMT'};
  const app=express();
  app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.get('/exterior',(req,res)=>sendPackedArt(req,res,art,true));
  app.get('/room',(req,res)=>sendPackedArt(req,res,art));
  const server=app.listen(0,'127.0.0.1');
  t.after(()=>new Promise(done=>server.close(done)));
  await once(server,'listening');
  const read=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{
    request({host:'127.0.0.1',port:server.address().port,path,headers,method},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));
    }).on('error',reject).end();
  });
  const compressed=await read('/exterior',{'Accept-Encoding':'br'});
  assert.equal(compressed.status,200);
  assert.equal(compressed.headers['content-encoding'],'br');
  assert.equal(compressed.headers.vary,'Accept-Encoding');
  assert.equal(compressed.headers['cache-control'],'no-store');
  assert.equal(compressed.headers['access-control-allow-origin'],'*');
  assert.deepEqual(brotliDecompressSync(compressed.bytes),bytes);

  const full=await read('/exterior',{'Accept-Encoding':'identity, br;q=0.2'});
  assert.deepEqual(full.bytes,bytes);
  assert.equal(full.headers['accept-ranges'],'bytes');
  assert.equal(full.headers['last-modified'],art.modified);
  assert.notEqual(full.headers.etag,compressed.headers.etag);
  const conditional=await read('/exterior',{'If-None-Match':full.headers.etag});
  assert.equal(conditional.status,304);
  const cross=await read('/exterior',{'If-None-Match':full.headers.etag,'Accept-Encoding':'br'});
  assert.equal(cross.status,200);
  const stale=await read('/exterior',{'If-Match':full.headers.etag,'Accept-Encoding':'br'});
  assert.equal(stale.status,412);
  assert.equal((await read('/exterior',{'If-Unmodified-Since':'Sat, 21 Nov 2026 20:00:00 GMT'})).status,412);
  const partial=await read('/exterior',{'Accept-Encoding':'br',Range:'bytes=0-11','If-Range':full.headers.etag});
  assert.deepEqual(partial.bytes,bytes.subarray(0,12));
  assert.equal(partial.status,206);
  assert.equal(partial.headers['content-range'],'bytes 0-11/'+bytes.length);
  assert.equal(partial.headers['content-encoding'],undefined);
  const expiredRange=await read('/exterior',{'Accept-Encoding':'br',Range:'bytes=0-11','If-Range':'"old"'});
  assert.equal(expiredRange.status,200);
  assert.equal(expiredRange.headers['content-encoding'],'br');
  const impossible=await read('/exterior',{Range:`bytes=${bytes.length}-`});
  assert.equal(impossible.status,416);
  assert.equal(impossible.headers['content-range'],'bytes */'+bytes.length);

  const head=await read('/room',{'Accept-Encoding':'br'},'HEAD');
  assert.equal(head.headers['content-length'],String(art.packed.length));
  assert.equal(head.bytes.length,0);
  const room=await read('/room',{Range:'bytes=0-11'});
  assert.deepEqual(room.bytes,bytes);
  assert.equal(room.status,200);
  assert.equal(room.headers['access-control-allow-origin'],undefined);
  assert.equal((await read('/room',{'Accept-Encoding':'br;q=0, identity;q=0'})).status,406);
});
