import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SharedConversationHost} from '../src/shared-conversation-host.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const sent=[],calls=[],frames=[],statuses=[];let actor='human:fixture',position=1,unblock;
 const binding='b'.repeat(64),file={file_id:randomUUID(),sha256:'c'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000};
 const window={location:{origin:'https://world.test'},crypto:{randomUUID},addEventListener(){},removeEventListener(){}};
 const document={createElement:()=>({contentWindow:{postMessage:(d,o)=>sent.push({d,o})},remove(){this.removed=true;}})};
 const host=new SharedConversationHost({window,document,container:{append:f=>frames.push(f)},currentActor:()=>actor,
  api:async(path,body)=>{calls.push({path,body});if(path==='conversation-surface')return {schema:'holodeck.conversation-surface/v1',actorRef:actor,binding,url:'https://conversation.test/interaction/'};
   if(path==='conversation-contexts')return {id:body.id,binding,files:[file],work_admitted:false};return {released:false};},
  capture:async()=>{const view={local:{position:{x:position}}};await new Promise(resolve=>unblock=resolve);return view;},onStatus:value=>statuses.push(value)});
 const envelope=(type,rest={})=>({schema:'conversation.surface/v1',visit:host.visit,channel:randomUUID(),actor:'human:fixture',binding,type,...rest});
 const receive=d=>host.receive({source:host.frame.contentWindow,origin:host.origin,data:d});
 return {host,sent,calls,frames,statuses,envelope,receive,move:x=>position=x,unblock:()=>unblock(),rebind:()=>actor='human:other'};
}
test('actual frame origin actor visit binding and channel bound the handshake and all context work',async()=>{
 const f=fixture();await f.host.mount();assert.equal(f.frames.length,1);await f.host.mount();assert.equal(f.frames.length,1);
 assert.equal(new URL(f.host.frame.src).searchParams.get('surface'),'holodeck');assert.equal(f.host.frame.allow,'microphone https://conversation.test; autoplay https://conversation.test');
 const ready=f.envelope('ready');
 for(const change of [{origin:'https://foreign.test'},{source:{}},{data:{...ready,actor:'human:other'}},{data:{...ready,binding:'a'.repeat(64)}},{data:{...ready,visit:randomUUID()}}])f.host.receive({origin:f.host.origin,source:f.host.frame.contentWindow,data:ready,...change});
 assert.equal(f.sent.length,0);f.receive(ready);assert.equal(f.sent[0].d.type,'connect');assert.equal(f.sent[0].o,'https://conversation.test');
 const d={...ready,type:'prepare',request:randomUUID(),id:randomUUID(),modality:'text',capacity:{files:8,bytes:40*1024*1024,context_bytes:65536}};
 f.receive({...d,channel:randomUUID()});assert.equal(f.host.records.size,0);
 f.receive(d);f.move(5);f.unblock();await tick();
 const captured=f.calls.find(x=>x.path==='conversation-contexts');assert.equal(captured.body.view.local.position.x,1,'walking during content preparation does not relabel the original');
 assert.equal('text' in captured.body,false);assert.equal(f.sent.at(-1).d.type,'prepared');assert.equal('files' in f.sent.at(-1).d,false);
 f.receive({...ready,type:'status',id:d.id,phase:'working',busy:true,text:'private body ignored'});assert.deepEqual(f.statuses,[{phase:'working',busy:true}]);
 f.rebind();f.receive({...d,id:randomUUID()});assert.equal(f.host.records.size,1);f.host.dispose();assert.equal(f.frames[0].removed,true);
});
test('discard during a delayed view prevents source upload without touching human originals',async()=>{
 const f=fixture();await f.host.mount();const ready=f.envelope('ready');f.receive(ready);
 const d={...ready,type:'prepare',request:randomUUID(),id:randomUUID(),modality:'audio',capacity:{files:8,bytes:40*1024*1024,context_bytes:65536}};
 f.receive(d);f.receive({...ready,type:'discard',id:d.id,reason:'capture-cancelled'});f.unblock();await tick();
 assert.equal(f.calls.filter(x=>x.path==='conversation-contexts').length,0);assert.equal(f.sent.filter(x=>x.d.type==='prepared').length,0);
 assert.equal(f.calls.some(x=>/interactions/.test(x.path)),false);
});

test('the room catalogue accepts only its correlated, same-actor response',async()=>{
 const f=fixture();await f.host.mount();
 const ready=f.envelope('ready',{features:{topicRooms:true}});f.receive(ready);
 assert.equal(f.sent.at(-1).d.features.topicRooms,true);
 const opening=f.host.readTopicRooms({room:'a'.repeat(64)});await tick();
 const read=f.sent.at(-1).d;
 const row={room:read.room,title:'A topic',general:false,direct_available:true};
 const response={...ready,type:'topic-rooms-readback',request:read.request,rooms:[row],next:null};
 f.host.receive({source:f.host.frame.contentWindow,origin:'https://other.test',data:response});
 f.receive({...response,request:randomUUID()});
 assert.ok(f.host.topicRead);f.receive(response);
 assert.deepEqual(await opening,{rooms:[row],next:null});

 const withdrawn=f.host.readTopicRooms({room:row.room});await tick();
 f.receive({...response,request:f.sent.at(-1).d.request,rooms:undefined,unavailable:true});
 await assert.rejects(withdrawn,/no está disponible/);
 assert.deepEqual(f.calls,[{path:'conversation-surface',body:undefined}]);
 f.host.dispose();
});

const browserModule=process.env.HOLODECK_PLAYWRIGHT;
const childSource=process.env.HOLODECK_CONVERSATION_SURFACE;
test('a house-free Holodeck visitor reads and revalidates a topic through the Conversation frame',
 {skip:!browserModule||!childSource},async t=>{
 const {readFile}=await import('node:fs/promises');
 const {chromium}=await import(browserModule);
 const {createHolodeck}=await import('../src/server.mjs');
 const actorRef='human:room-visitor',origin='https://conversation.test',binding='a'.repeat(64);
 const nativeFactory=async()=>({availability:async()=>({available:true}),contexts:{},
   conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',actorRef,binding,
    beingRef:'dm:being:v1:'+'b'.repeat(43),homeRef:'home:'+'c'.repeat(32),url:origin+'/interaction/'})});
 const runtime=await createHolodeck({conversationOrigins:[origin],nativeFactory,
  identityResolver:async()=>({id:actorRef,ref:actorRef,kind:'human',rights:['observe','edit','project'],name:'Visitor'})});
 const server=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>{runtime.close();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
 const readbacks=[],errors=[],name='Proyecto de las islas';
 const room={room:'7'.repeat(64),title:name,general:false,direct_available:true};
 let visible=true,posted=0;
 const protocol=await readFile(childSource,'utf8');
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.method()==='POST')posted++;});
 await page.route(url=>url.origin===origin,async route=>{
  const address=new URL(route.request().url());
  if(address.pathname==='/interaction/'){
   const parent=address.searchParams.get('surface_parent'),visit=address.searchParams.get('surface_visit');
   const start=`document.documentElement.dataset.surfaceParent=${JSON.stringify(parent)};
    document.documentElement.dataset.surfaceVisit=${JSON.stringify(visit)};
    const surface=ConversationSurface.create({readTopics:async room=>{
      const target=new URL('/api/interaction/sessions',location.origin);
      target.searchParams.set('projection','holodeck');if(room)target.searchParams.set('room',room);
      const response=await fetch(target);if(!response.ok)throw Error('unavailable');return response.json();
    }});surface.identity(${JSON.stringify(actorRef)});surface.bind(${JSON.stringify(binding)});`;
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html><script>${protocol}\n${start}</script></html>`});
  }
  assert.equal(address.pathname,'/api/interaction/sessions');
  assert.equal(address.searchParams.get('projection'),'holodeck');
  const selected=address.searchParams.get('room');readbacks.push(selected);
  return route.fulfill({status:selected&&!visible?404:200,json:{schema:'daimon.topic-rooms/v1',rooms:visible?[room]:[]}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.getByRole('button',{name:'Topics',exact:true}).tap();
 const dialog=page.getByRole('dialog',{name:'Explorar topics'});
 await dialog.getByRole('button',{name}).tap();
 await dialog.getByRole('heading',{name}).waitFor();
 await dialog.getByRole('button',{name:'Volver a los topics'}).tap();
 await dialog.getByRole('button',{name}).waitFor();
 visible=false;
 await dialog.getByRole('button',{name}).tap();
 await dialog.getByText('Ese topic ya no está disponible.').waitFor();
 assert.deepEqual(readbacks,[null,room.room,null,room.room]);
 assert.equal(posted,0);
 assert.deepEqual(errors,[]);
});
