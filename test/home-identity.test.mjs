import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeIdentityResolver} from '../src/home-identity.mjs';
const config={publicOrigin:'https://example.test',authHost:'example.test',identityEndpoint:'http://127.0.0.1:8820/access/identity',authorizeEndpoint:'http://127.0.0.1:8820/service-access/test'};
const identity=()=>({contract:'dm.home-session/v1',origin:config.publicOrigin,expires:Date.now()/1000+60,actor:{ref:'human:test',kind:'human',revision:'current',name:'Test'}});
test('actor identity and room rights come from current existing Home routes, not supplied headers',async()=>{
 const calls=[];const resolve=homeIdentityResolver(config,{fetcher:async(url,options)=>{
   calls.push({url,options});return url===config.authorizeEndpoint?new Response(null,{status:204}):Response.json(identity());
 }});
 const actor=await resolve({method:'POST',headers:{cookie:'existing=opaque',origin:config.publicOrigin,'x-daimon-actor':'fake',authorization:'Bearer fake'}});
 assert.equal(actor.id,'human:test');assert.equal(calls.length,2);
 assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[0].options.headers['X-Daimon-Actor'],undefined);
 assert.equal(calls[0].options.headers['X-Forwarded-Method'],'POST');
 await resolve({method:'GET',headers:{cookie:'existing=opaque'}});assert.equal(calls.length,4);
});
test('wrong audience, cross-origin writes, expiry and wrong session kind deny admission',async()=>{
 let status=403;let value=identity();
 const resolve=homeIdentityResolver(config,{fetcher:async url=>url===config.authorizeEndpoint?new Response(null,{status}):Response.json(value)});
 const request={method:'POST',headers:{cookie:'existing=opaque',origin:config.publicOrigin}};
 assert.equal(await resolve(request),null);status=204;
 assert.equal(await resolve({...request,headers:{...request.headers,origin:'https://foreign.test'}}),null);
 value.expires=0;assert.equal(await resolve(request),null);
 value=identity();value.actor.kind='being';assert.equal(await resolve(request),null);
});

test('real loopback HTTP preserves the Home virtual host and cookie for audience and identity',async t=>{
 const {createServer}=await import('node:http');const calls=[];
 const server=createServer((request,response)=>{
   calls.push({method:request.method,url:request.url,host:request.headers.host,cookie:request.headers.cookie,forwarded:request.headers['x-forwarded-method'],origin:request.headers.origin});
   if(request.headers.host!=='example.test'||request.headers.cookie!=='fixture_session=opaque-test-only'){response.writeHead(403).end();return;}
   if(request.url==='/service-access/test'){response.writeHead(204).end();return;}
   response.setHeader('Content-Type','application/json');response.end(JSON.stringify({...identity(),actor:{ref:'human:loopback-fixture',kind:'human',revision:'fixture-revision'}}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const address=`http://127.0.0.1:${server.address().port}`;
 const resolve=homeIdentityResolver({...config,identityEndpoint:address+'/access/identity',authorizeEndpoint:address+'/service-access/test'});
 const actor=await resolve({method:'POST',headers:{cookie:'fixture_session=opaque-test-only',origin:config.publicOrigin}});
 assert.equal(actor.id,'human:loopback-fixture');assert.deepEqual(actor.rights,['observe','edit','project']);
 assert.deepEqual(calls.map(c=>[c.method,c.host,c.cookie]),[['GET','example.test','fixture_session=opaque-test-only'],['GET','example.test','fixture_session=opaque-test-only']]);
 assert.equal(calls[0].forwarded,'POST');assert.equal(calls[0].origin,config.publicOrigin);
});

test('real HTTP redirects, oversized/interrupted/malformed bodies and unavailable Home fail closed',async t=>{
 const {createServer}=await import('node:http');let mode='redirect',identityCalls=0;
 const server=createServer((request,response)=>{
   if(request.url==='/service-access/test'){
     if(mode==='redirect'){response.writeHead(302,{Location:'/access/identity'}).end();return;}
     response.writeHead(204).end();return;
   }
   identityCalls++;
   if(mode==='oversized'){response.end('x'.repeat(8193));return;}
   if(mode==='interrupted'){response.writeHead(200,{'Content-Length':'100'});response.flushHeaders();response.write('{');setImmediate(()=>response.destroy());return;}
   response.end('invalid JSON');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.closeAllConnections());
 const address=`http://127.0.0.1:${server.address().port}`;
 const resolve=homeIdentityResolver({...config,identityEndpoint:address+'/access/identity',authorizeEndpoint:address+'/service-access/test'});
 const request={method:'GET',headers:{cookie:'fixture_session=opaque-test-only'}};
 assert.equal(await resolve(request),null);assert.equal(identityCalls,0);
 for(mode of ['oversized','interrupted','malformed'])assert.equal(await resolve(request),null,mode);
 await new Promise(done=>server.close(done));
 assert.equal(await resolve(request),null,'closed receiver');
});

test('both Home reads share one four-second deadline and transport errors deny admission',async()=>{
 let first;
 const resolve=homeIdentityResolver(config,{fetcher:async(url,options)=>{
   if(url===config.authorizeEndpoint){first=options.signal;return {status:204};}
   assert.equal(options.signal,first);throw Error('fixture transport unavailable');
 }});
 assert.equal(await resolve({method:'GET',headers:{cookie:'fixture=opaque'}}),null);
});

test('real stalled HTTP receiver is bounded by the total authentication deadline',async t=>{
 const {createServer}=await import('node:http');
 const server=createServer(()=>{});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const address=`http://127.0.0.1:${server.address().port}`;
 const resolve=homeIdentityResolver({...config,identityEndpoint:address+'/identity',authorizeEndpoint:address+'/authorize'});
 const started=Date.now();
 assert.equal(await resolve({method:'GET',headers:{cookie:'fixture=opaque'}}),null);
 assert.ok(Date.now()-started<6000,'stalled authentication must terminate');
});
