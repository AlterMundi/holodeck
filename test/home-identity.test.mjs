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
