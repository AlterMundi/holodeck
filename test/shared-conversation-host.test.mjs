import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SharedConversationHost} from '../src/shared-conversation-host.mjs';
import {COMPAII_BEING} from '../src/avatar-registry.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(onTopicModeReset){
 const sent=[],calls=[],frames=[],statuses=[];let actor='human:fixture',position=1,unblock;
 const binding='b'.repeat(64),file={file_id:randomUUID(),sha256:'c'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000};
 const window={location:{origin:'https://world.test'},crypto:{randomUUID},addEventListener(){},removeEventListener(){}};
 const document={createElement:()=>({contentWindow:{postMessage:(d,o)=>sent.push({d,o})},remove(){this.removed=true;}})};
 const host=new SharedConversationHost({window,document,container:{append:f=>frames.push(f)},currentActor:()=>actor,onTopicModeReset,
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

test('a fresh authenticated Conversation document resets direct selection',async()=>{
 let resets=0;
 const f=fixture(()=>resets++);await f.host.mount();
 const ready=f.envelope('ready',{features:{topicDirect:true}});f.receive(ready);
 const selection=f.host.selectTopicMode('a'.repeat(64));
 const request=f.sent.at(-1).d;
 f.receive(f.envelope('ready',{features:{topicDirect:true}}));
 await assert.rejects(selection,{reset:true});
 f.receive({...request,type:'topic-direct-readback'});
 assert.equal(resets,1);
 assert.equal(f.host.topicMode,undefined);
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
 let repositories=[],projectRevision=1;
 const nativeFactory=async()=>({availability:async()=>({available:true}),contexts:{},
   async topicRoom(actor,topic,includeProjects,cursor){
    assert.equal(actor.ref,actorRef);
    if(!visible||topic!==room.room)throw Object.assign(Error('Unavailable'),{code:'topic-room-unavailable'});
    const restarted=!!cursor&&cursor!==projectRevision+'.3';
    const older=cursor&&!restarted;
    return {schema:'holodeck.topic-room/v1',actorRef,room:topic,title:room.title,general:false,
      ...(includeProjects?{projects:{repositories:older?repositories.slice(8):repositories.slice(0,8),
        next:!older&&repositories.length>8?projectRevision+'.3':null,restarted}}:{})};
   },
   conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',actorRef,binding,
    beingRef:COMPAII_BEING,homeRef:'home:'+'c'.repeat(32),url:origin+'/interaction/'})});
 const runtime=await createHolodeck({conversationOrigins:[origin],nativeFactory,
  nativeRoomAuthority:async()=>['observe'],
  identityResolver:async()=>({id:actorRef,ref:actorRef,kind:'human',rights:['observe','edit','project'],name:'Visitor'})});
 const server=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>{runtime.close();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
 const readbacks=[],errors=[],modes=[],name='Proyecto de las islas';
 const room={room:'7'.repeat(64),title:name,general:false,direct_available:true};
 let visible=true;const posted=[];
 const protocol=await readFile(childSource,'utf8');
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.method()==='POST')posted.push(new URL(request.url()).pathname);});
 await page.route(url=>url.origin===origin,async route=>{
  const address=new URL(route.request().url());
  if(address.pathname==='/api/fixture-mode'){
   const selected=address.searchParams.get('room');modes.push(selected);
   return route.fulfill({json:{room:selected}});
  }
  if(address.pathname==='/interaction/'){
   const parent=address.searchParams.get('surface_parent'),visit=address.searchParams.get('surface_visit');
   const start=`document.documentElement.dataset.surfaceParent=${JSON.stringify(parent)};
    document.documentElement.dataset.surfaceVisit=${JSON.stringify(visit)};
    const surface=ConversationSurface.create({readTopics:async room=>{
      const target=new URL('/api/interaction/sessions',location.origin);
      target.searchParams.set('projection','holodeck');if(room)target.searchParams.set('room',room);
      const response=await fetch(target);if(!response.ok)throw Error('unavailable');return response.json();
    },selectTopic:async (room,current)=>{
      const target=new URL('/api/fixture-mode',location.origin);
      if(room)target.searchParams.set('room',room);
      const response=await fetch(target);
      return current()?response.json():null;
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
 await dialog.getByRole('button',{name:'Entrar a la sala'}).tap();
 await dialog.waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.body.classList.contains('inside-house')&&
   !document.body.classList.contains('room-transition')&&document.querySelector('m-group[id^="topic-"]'));
 const entered=await page.evaluate(()=>fetch('api/space?live=1').then(response=>response.json()));
 assert.equal(entered.topic,room.room);
 assert.equal(entered.returnTo,'outside');
 assert.equal(entered.title,name);
 assert.equal(runtime.spaces.current({id:actorRef}),entered.id);
 const table=page.getByRole('dialog',{name:'Mesa de proyectos'});
 const openTable=()=>page.getByRole('button',{name:'Mesa de proyectos'}).tap();
 const closeTable=()=>table.getByRole('button',{name:'Cerrar'}).tap();
 await openTable();
 await table.getByText('Todavía no hay proyectos visibles en esta sala.').waitFor({timeout:6000}).catch(async error=>{
  const diagnostics=await page.evaluate(async room=>({
   dialog:document.querySelector('#topic-projects-dialog').open,
   status:document.querySelector('#topic-projects-status').textContent,
   http:await fetch('api/topic-projects?room='+room).then(async r=>[r.status,await r.text()])
  }),room.room);
  throw Error(JSON.stringify({diagnostics,errors}),{cause:error});
 });
 await closeTable();
 const projectA=randomUUID(),projectB=randomUUID();
 repositories=[
  {project:projectA,repository:randomUUID(),label:'Cuento',commit:'1'.repeat(40),locator:'/must-not-leak'},
  {project:projectA,repository:randomUUID(),label:'Ilustraciones',commit:'2'.repeat(40)},
  {project:projectB,repository:randomUUID(),label:'Juego',commit:'3'.repeat(40)},
 ];
 const read=await page.evaluate(async room=>await fetch('api/topic-projects?room='+room).then(response=>response.json()),room.room);
 assert.equal(read.repositories.length,3);
 assert.equal('locator' in read.repositories[0],false);
 await openTable();
 await table.getByText('Cuento',{exact:true}).waitFor();
 assert.equal(await table.getByRole('list',{name:'Repositorios de un proyecto'}).count(),2);
 await table.getByText('3'.repeat(40),{exact:true}).waitFor();
 await closeTable();
 repositories=repositories.filter(row=>row.label!=='Juego');
 repositories[0].commit='4'.repeat(40);
 await openTable();
 await table.getByText('4'.repeat(40),{exact:true}).waitFor();
 assert.equal(await table.getByText('1'.repeat(40),{exact:true}).count(),0);
 assert.equal(await table.getByText('Juego',{exact:true}).count(),0);
 await closeTable();
 repositories.push(...Array.from({length:8},(_,index)=>({
  project:randomUUID(),repository:randomUUID(),label:'Anexo '+index,commit:'c'.repeat(40),
 })));
 await openTable();
 const nextPage=table.getByRole('button',{name:'Siguiente',exact:true});
 const previousPage=table.getByRole('button',{name:'Anterior',exact:true});
 await nextPage.tap();
 await table.getByText('Anexo 7',{exact:true}).waitFor();
 assert.equal(await table.getByText('Cuento',{exact:true}).count(),0);
 await previousPage.tap();
 await table.getByText('Cuento',{exact:true}).waitFor();
 assert.equal(await table.getByText('Anexo 7',{exact:true}).count(),0);
 projectRevision++;
 await nextPage.tap();
 await table.getByText(/Volvimos a la primera página/).waitFor();
 await table.getByText('Cuento',{exact:true}).waitFor();
 await closeTable();
 await page.getByRole('button',{name:'Conversar',exact:true}).tap();
 await page.getByRole('heading',{name:'Nuestra conversación general',exact:true}).waitFor();
 await page.getByRole('button',{name:'Hablar directo al topic',exact:true}).tap();
 await page.locator('#conversation-panel').getByRole('heading',{name,exact:true}).waitFor();
 assert.deepEqual(modes,[room.room]);
 const audience=page.locator('#conversation-audience'),portrait=page.locator('#conversation-companion');
 await portrait.and(page.locator('[data-appearance]')).waitFor();
 assert.equal(await audience.getAttribute('data-recipient'),'topic');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#conversation-companion')).opacity==='0.45');
 const drawing=await portrait.locator('canvas').evaluate(canvas=>({
  width:canvas.width,height:canvas.height,bounds:canvas.getBoundingClientRect().toJSON(),
  pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value)
 }));
 assert.ok(drawing.pixels,JSON.stringify(drawing));
 await page.getByRole('button',{name:'Volver a la conversación general',exact:true}).tap();
 await page.getByRole('heading',{name:'Nuestra conversación general',exact:true}).waitFor();
 assert.equal(await audience.getAttribute('data-recipient'),'general');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#conversation-companion')).opacity==='1');
 assert.equal(runtime.spaces.current({id:actorRef}),entered.id);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await portrait.evaluate(element=>getComputedStyle(element).transitionDuration),'0s');
 await page.getByRole('button',{name:'Hablar directo al topic',exact:true}).tap();
 await page.locator('#conversation-panel').getByRole('heading',{name,exact:true}).waitFor();
 await page.locator('#conversation-close').tap();
 await page.locator('#space-travel summary').tap();
 await page.locator('#space-travel').getByRole('button',{name:'Volver al lugar anterior',exact:true}).tap();
 await page.waitForFunction(()=>!document.body.classList.contains('inside-house')&&
   !document.body.classList.contains('room-transition'));
 assert.equal(runtime.spaces.current({id:actorRef}),'outside');
 await page.getByRole('button',{name:'Topics',exact:true}).tap();
 await dialog.getByRole('button',{name}).waitFor();
 visible=false;
 await dialog.getByRole('button',{name}).tap();
 await dialog.getByText('Ese topic ya no está disponible.').waitFor();
 assert.deepEqual(readbacks,[null,room.room,null,room.room]);
 assert.deepEqual(posted,['/api/topic-space','/api/space']);
 assert.deepEqual(modes,[room.room,null,room.room,null]);
 assert.deepEqual(errors,[]);
});

test('the authenticated room reader renders an empty MML room without a house or movement',async t=>{
 const {createHolodeck}=await import('../src/server.mjs');
 const actorRef='human:topic-reader',topic='9'.repeat(64),title='Our <ideas> & plans';
 let reads=0,permitted=true;
 const runtime=await createHolodeck({
  identityResolver:async req=>req.headers.cookie?.includes('home=topic-reader')
    ? {id:actorRef,ref:actorRef,kind:'human',rights:['observe'],name:'Reader'}:null,
  nativeFactory:async()=>({topicRoom:async(actor,ref)=>{
   reads++;
   assert.equal(actor.ref,actorRef);
   if(!permitted||ref!==topic)throw Object.assign(Error('Unavailable'),{code:'topic-room-unavailable'});
   return {schema:'holodeck.topic-room/v1',actorRef,room:topic,title,general:false};
  }}),
 });
 const http=runtime.app.listen(0,'127.0.0.1');await new Promise(resolve=>http.once('listening',resolve));
 t.after(()=>{runtime.close();http.closeAllConnections();return new Promise(resolve=>http.close(resolve));});
 const base='http://127.0.0.1:'+http.address().port+'/';
 const route='api/topic-space?room='+topic;
 assert.equal((await fetch(base+route)).status,401);
 assert.equal(reads,0);
 const start=await fetch(base,{headers:{Cookie:'home=topic-reader'}});
 const token=start.headers.get('set-cookie').split(';')[0];
 await start.text();
 const headers={Cookie:'home=topic-reader; '+token};
 const first=await fetch(base+route,{headers});
 assert.equal(first.status,200);
 assert.equal(first.headers.get('cache-control'),'no-store');
 const value=await first.json();
 assert.equal(value.from,'outside');
 assert.equal(value.topic,topic);
 assert.equal(value.title,title);
 assert.equal(value.scene.actor,actorRef);
 assert.match(value.scene.markup,/Our &lt;ideas&gt; &amp; plans/);
 assert.doesNotMatch(value.scene.markup,/<ideas>/);
 assert.deepEqual(await (await fetch(base+route,{headers})).json(),value);
 assert.equal(runtime.spaces.current({id:actorRef}),'outside');
 permitted=false;
 assert.equal((await fetch(base+route,{headers})).status,404);
 assert.equal(reads,3);
});
