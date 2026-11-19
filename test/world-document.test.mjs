import {test} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import WebSocket,{WebSocketServer} from 'ws';
import {LocalObservableDOMFactory,NetworkedDOM} from '@mml-io/networked-dom-server';
import {BufferReader,decodeServerMessages} from '@mml-io/networked-dom-protocol';
import {WorldDocument} from '../src/world-document.mjs';
const markup=cursor=>`<m-group id="world" data-run="fixture" data-cursor="${cursor}"><m-sphere id="light" color="${cursor===2?'#a77bea':'#8ce4c2'}"></m-sphere></m-group>`;
const stub=()=>({disposed:0,addConnectedUserId(){},removeConnectedUserId(){},dispatchRemoteEventFromConnectionId(){},dispose(){this.disposed++;}});
test('real initial snapshots serialize immediate loads and deliver ordered latest geometry over the actual v0.2 socket',async()=>{
 const callbacks=[];
 const document=new WorldDocument('http://localhost/world',{factory:(parameters,consumer)=>LocalObservableDOMFactory(parameters,(message,dom)=>{
  consumer(message,dom);if(message.snapshot)callbacks.push(parameters.htmlContents);
 })});
 const server=createServer(),sockets=new WebSocketServer({server,handleProtocols:protocols=>NetworkedDOM.handleWebsocketSubprotocol(protocols)});
 sockets.on('connection',socket=>document.addWebSocket(socket));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=new WebSocket(`ws://127.0.0.1:${server.address().port}`,'networked-dom-v0.2.1');
 const nodes=new Map(),cursors=[];let snapshots=0,attributeDiffs=0,readyResolve;
 const ready=new Promise(resolve=>{readyResolve=resolve;});
 const track=node=>{if(node.type==='element'){nodes.set(node.nodeId,{...node,attributes:Object.fromEntries(node.attributes)});for(const child of node.children)track(child);}};
 client.on('message',bytes=>{
  for(const message of decodeServerMessages(new BufferReader(new Uint8Array(bytes)))){
   if(message.type==='snapshot'){snapshots++;track(message.snapshot);}
   if(message.type==='attributesChanged'){attributeDiffs++;Object.assign(nodes.get(message.nodeId).attributes,Object.fromEntries(message.attributes));}
   const world=[...nodes.values()].find(node=>node.attributes.id==='world');
   if(world&&cursors.at(-1)!==world.attributes['data-cursor'])cursors.push(world.attributes['data-cursor']);
   if(world?.attributes['data-cursor']==='2'&&[...nodes.values()].some(node=>node.attributes.id==='light'&&node.attributes.color==='#a77bea'))readyResolve();
  }
 });
 try{
  await new Promise((resolve,reject)=>{client.once('open',resolve);client.once('error',reject);});
  assert.equal(document.isLoaded(),false);
  const first=document.load(markup(0)),second=document.load(markup(1)),third=document.load(markup(2));
  await first;assert.ok(callbacks.includes(markup(0)),'actual consumer returned before load acknowledgment');
  await Promise.all([second,third]);assert.equal(callbacks.length,3);assert.equal(document.isLoaded(),true);
  let timer;try{await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Actual socket did not receive latest state')),3000);})]);}finally{clearTimeout(timer);}
  assert.deepEqual(cursors,['0','1','2']);assert.equal(snapshots,1);assert.ok(attributeDiffs>=2);
 }finally{client.terminate();document.dispose();for(const socket of sockets.clients)socket.terminate();await new Promise(resolve=>sockets.close(resolve));await new Promise(resolve=>server.close(resolve));}
});
test('missing snapshot has a total deadline, rejects queued work and disposes its runner once',async()=>{
 const runner=stub(),document=new WorldDocument('http://localhost/world',{factory:()=>runner,timeoutMs:30,maxQueued:2});
 const first=document.load(markup(0)),second=document.load(markup(1));
 await assert.rejects(document.load(markup(2)),/queue is full/);
 const results=await Promise.allSettled([first,second]);
 assert.ok(results.every(result=>result.status==='rejected'&&/snapshot deadline/.test(result.reason.message)));
 await Promise.resolve();assert.equal(runner.disposed,1);assert.equal(document.isLoaded(),false);
 await assert.rejects(document.load(markup(3)),/snapshot deadline/);document.dispose();await Promise.resolve();assert.equal(runner.disposed,1);
});
test('consumer failure and late callbacks cannot report success or revive a disposed document',async()=>{
 const runner=stub();let callback;
 const document=new WorldDocument('http://localhost/world',{factory:(_parameters,consumer)=>{callback=consumer;return runner;}});
 const loading=document.load(markup(0));
 assert.doesNotThrow(()=>callback({snapshot:{nodeId:1,tag:'DIV',attributes:{},childNodes:null}},runner));
 await assert.rejects(loading);await Promise.resolve();assert.equal(runner.disposed,1);assert.equal(document.isLoaded(),false);
 assert.doesNotThrow(()=>callback({snapshot:{nodeId:1,tag:'DIV',attributes:{},childNodes:[]}},runner));
 await assert.rejects(document.load(markup(1)));document.dispose();
 const pendingRunner=stub(),pending=new WorldDocument('http://localhost/world',{factory:()=>pendingRunner});
 const p=pending.load(markup(0));pending.dispose();await assert.rejects(p,/disposed/);await Promise.resolve();assert.equal(pendingRunner.disposed,1);
});
test('synchronous snapshot acknowledgment still waits for the consumer and outer load stack',async()=>{
 const runner=stub();let returned=false;
 const document=new WorldDocument('http://localhost/world',{factory:(_parameters,consumer)=>{consumer({snapshot:{nodeId:1,tag:'DIV',attributes:{},childNodes:[]}},runner);returned=true;return runner;}});
 const p=document.load(markup(0));assert.equal(document.isLoaded(),false);await p;assert.equal(returned,true);assert.equal(document.isLoaded(),true);document.dispose();
});
