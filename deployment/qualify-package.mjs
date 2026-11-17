// Finite local development-harness check of the exact standalone server package.
// Real MML networking/Networked DOM clients; no native/model/human input is sent.
import WebSocket from 'ws';
import { UserNetworkingClient } from '@mml-io/3d-web-user-networking';
import { experienceClientSubProtocols, experienceProtocolToDeltaNetSubProtocol } from '@mml-io/3d-web-experience-protocol';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:18944';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const peers=[],documents=[];
async function session(){const r=await fetch(base+'/',{headers:{Accept:'application/json'}});assert.equal(r.status,200);const json=await r.json();return{token:json.sessionToken,cookie:r.headers.get('set-cookie').split(';')[0]};}
async function request(s,path,body){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Cookie:s.cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();assert.equal(r.status,200,text);return JSON.parse(text);}
async function document(s){const socket=new WebSocket(base.replace('http:','ws:')+'/world',['networked-dom-v0.1'],{headers:{Cookie:s.cookie}});let messages=[];socket.on('message',data=>messages.push(data.toString()));await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});documents.push(socket);return{socket,messages};}
function client(s){let identity=null,users=new Set(),errors=[];const peer=new UserNetworkingClient({url:base.replace('http:','ws:')+'/network',sessionToken:s.token,websocketFactory:url=>new WebSocket(url,[...experienceClientSubProtocols],{headers:{Cookie:s.cookie}}),statusUpdateCallback:()=>{},assignedIdentity:id=>identity=id,onServerError:error=>errors.push(error),resolveProtocol:experienceProtocolToDeltaNetSubProtocol,onUpdate:update=>{for(const id of update.addedConnectionIds.keys())users.add(id);for(const id of update.removedConnectionIds)users.delete(id);}},undefined,{position:{x:0,y:1,z:6},rotation:{eulerY:0},state:0});peers.push(peer);return{get identity(){return identity},users,errors};}
const timeout=setTimeout(()=>{throw Error('Qualification deadline exceeded');},25000);
try{
 const a=await session(),b=await session();const ca=client(a),cb=client(b);const da=await document(a),db=await document(b);
 const deadline=Date.now()+10000;while(Date.now()<deadline&&(!ca.identity||!cb.identity||!da.messages.some(x=>/m-group/i.test(x))||!db.messages.some(x=>/m-group/i.test(x))||!ca.users.has(cb.identity)||!cb.users.has(ca.identity)))await wait(50);
 assert.ok(ca.identity&&cb.identity);assert.notEqual(ca.identity,cb.identity);assert.ok(ca.users.has(cb.identity)&&cb.users.has(ca.identity));assert.equal(ca.errors.length+cb.errors.length,0);assert.ok(da.messages.some(x=>/m-group/i.test(x))&&db.messages.some(x=>/m-group/i.test(x)));
 const before=[da.messages.length,db.messages.length];
 const observed=await request(a,'observe',{});
 const command={id:crypto.randomUUID(),issuedAt:Date.now(),run:observed.run,edition:observed.edition,observation:observed.id,type:'bridge.set',target:'bridge',expectedRevision:observed.entities.bridge.revision,args:{raised:!observed.entities.bridge.raised}};
 const result=await request(a,'commands',command);assert.equal(result.status,'completed');
 const changed=await request(b,'state');assert.equal(changed.entities.bridge.raised,command.args.raised);
 const changedDeadline=Date.now()+5000;while(Date.now()<changedDeadline&&(da.messages.length<=before[0]||db.messages.length<=before[1]))await wait(50);
 assert.ok(da.messages.length>before[0]&&db.messages.length>before[1]);assert.deepEqual(await request(a,'commands',command),result);
 const health=await fetch(base+'/health');assert.equal(health.status,200);
 console.log(JSON.stringify({standaloneNodePackage:true,mmlPresenceClients:2,networkedDomClients:2,initialGeometryReceived:true,sharedMutation:true,geometryUpdatesBoth:true,exactRetry:true,serverHtmlCanvas:'absent-supported-upstream-optional',modelCalls:0}));
}finally{clearTimeout(timeout);for(const peer of peers)peer.stop();for(const socket of documents)socket.close();}
