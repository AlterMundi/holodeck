import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {SharedConversationHost} from '../src/shared-conversation-host.mjs';
import {COMPAII_BEING} from '../src/avatar-registry.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({mode,avatarMicrophone,onTopicModeReset}={}){
 const sent=[],calls=[],frames=[],statuses=[],speech=[];let actor='human:fixture',position=1,unblock,now=0;const dom={};
 const binding='b'.repeat(64),file={file_id:randomUUID(),sha256:'c'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000};
 const window={location:{origin:'https://world.test'},crypto:{randomUUID},performance:{now:()=>now},addEventListener(){},removeEventListener(){}};
 const document={hidden:false,addEventListener:(name,handler)=>dom[name]=handler,removeEventListener:name=>delete dom[name],createElement:()=>({contentWindow:{postMessage:(d,o)=>sent.push({d,o})},remove(){this.removed=true;}})};
 const host=new SharedConversationHost({window,document,avatarMicrophone,onTopicModeReset,container:{append:f=>frames.push(f)},currentActor:()=>actor,
  api:async(path,body)=>{calls.push({path,body});if(path==='conversation-surface')return {schema:'holodeck.conversation-surface/v1',actorRef:actor,binding,url:'https://conversation.test/interaction/',machineSource:mode};
   if(path==='conversation-contexts')return body.mode
     ?{id:body.id,binding,files:[],machine_source:file.file_id,work_admitted:false}
     :{id:body.id,binding,files:[file],work_admitted:false};return {released:false};},
  capture:async()=>{const view={local:{position:{x:position}}};await new Promise(resolve=>unblock=resolve);return view;},onStatus:value=>statuses.push(value),onSpeechLevel:value=>speech.push(value)});
 const envelope=(type,rest={})=>({schema:'conversation.surface/v1',visit:host.visit,channel:randomUUID(),actor:'human:fixture',binding,type,...rest});
 const receive=d=>host.receive({source:host.frame.contentWindow,origin:host.origin,data:d});
 return {host,sent,calls,frames,statuses,speech,envelope,receive,advance:ms=>now+=ms,visible:value=>{document.hidden=!value;dom.visibilitychange?.();},move:x=>position=x,unblock:()=>unblock(),rebind:()=>actor='human:other'};
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

test('prepared receipt preserves every attachment slot and stays on the negotiated channel',async()=>{
 const mode='owner-journal/v1',f=fixture({mode});
 await f.host.mount();
 const original=f.envelope('ready',{features:{machineSource:true}});
 f.receive(original);
 assert.equal(f.sent.at(-1).d.features.machineSource,mode);
 f.receive({...original,type:'avatar-playback',level:.75});
 f.receive({...original,features:{}});
 assert.deepEqual(f.speech,[0,.75,0]);
 assert.equal(f.sent.at(-1).d.features.machineSource,mode,'a same-channel handshake silences speech without changing context mode');
 const d={...original,type:'prepare',id:randomUUID(),request:randomUUID(),mode,modality:'audio',
  capacity:{files:0,bytes:0,context_bytes:65536}};
 f.receive(d);f.receive(d);f.unblock();await tick();
 const reservations=f.calls.filter(x=>x.path==='conversation-contexts');
 assert.equal(reservations.length,1);
 assert.equal(reservations[0].body.mode,mode);
 const prepared=f.sent.filter(x=>x.d.type==='prepared');
 assert.equal(prepared.length,2);
 assert.equal(prepared[0].d.machine_source,prepared[1].d.machine_source);
 assert.equal(prepared[0].d.file,undefined);

 const older=f.envelope('ready');
 f.receive(older);
 assert.equal(f.sent.at(-1).d.features.machineSource,undefined);
 f.receive({...d,channel:older.channel,id:randomUUID()});
 assert.equal(f.sent.at(-1).d.type,'error','a new channel cannot force its old negotiated mode');
 assert.equal(f.calls.filter(x=>x.path==='conversation-contexts').length,1);
 f.host.dispose();
});

test('optional microphone levels expire and remain on the negotiated current frame',async()=>{
 const f=fixture({avatarMicrophone:true});
 await f.host.mount();
 const legacy=f.envelope('ready');
 f.receive(legacy);
 assert.equal(f.sent.at(-1).d.features.avatarMicrophone,undefined);
 f.receive({...legacy,type:'avatar-microphone',level:.75});
 assert.equal(f.host.microphoneLevel(),null);
 const ready=f.envelope('ready',{features:{avatarMicrophone:true}});
 f.receive(ready);
 assert.equal(f.sent.at(-1).d.features.avatarMicrophone,true);
 const level=f.envelope('avatar-microphone',{channel:ready.channel,level:.75});
 f.receive({...level,channel:legacy.channel});
 f.receive({...level,level:.7});
 f.receive({...level,source:'remote'});
 f.host.receive({source:{},origin:f.host.origin,data:level});
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 assert.equal(f.host.microphoneLevel(),.75);
 f.advance(300);
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 f.visible(false);
 f.receive(level);
 assert.equal(f.host.microphoneLevel(),null);
 f.visible(true);
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 f.receive({...level,level:0});
 assert.equal(f.host.microphoneLevel(),0);
 f.receive(level);
 f.rebind();
 assert.equal(f.host.microphoneLevel(),null);
 f.host.dispose();
 assert.equal(f.host.microphoneLevel(),null);
 assert.equal(f.calls.length,1,'No level reaches the server');
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
 const f=fixture({onTopicModeReset:()=>resets++});await f.host.mount();
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
 const {createHolodeck}=await import(process.env.HOLODECK_QUESTBOOK_SERVER??'../src/server.mjs');
 const actorRef='human:room-visitor',origin='https://conversation.test',binding='a'.repeat(64);
 const projectA=randomUUID(),projectB=randomUUID(),storyRepository=randomUUID(),mission='Revisar las ilustraciones';
 const publishedURL='https://home.test/access/sso/start?return='+encodeURIComponent('/view/'+'a'.repeat(32)+'?display=work&version='+'b'.repeat(64));
 let card;
 const binary=process.env.DAIMON_CARDS_BIN;
 let cardTool,questbook,storyCommit='1'.repeat(40),laterCommit;
 let projectAReadable=true,projectBReadable=false,projectBWritable=false;
 const secondCard='00000000-0000-4000-8000-000000000001',secondMission='Preparar el mapa del juego';
 if(binary){
  const {mkdtemp,rm}=await import('node:fs/promises');
  const {join}=await import('node:path'),{tmpdir}=await import('node:os');
  const {execFileSync}=await import('node:child_process');
  const dir=await mkdtemp(join(tmpdir(),'holodeck-room-quest-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
  git('init','--quiet');
  const commit=message=>{
   git('-c','user.name=Questbook fixture','-c','user.email=fixture@example.test',
     'commit','--quiet','--allow-empty','-m',message);
   return git('rev-parse','HEAD');
  };
  storyCommit=commit('Story draft');
  laterCommit=commit('Second draft');
  const store=join(dir,'cards.sqlite');
  cardTool=(input,project=projectA)=>JSON.parse(execFileSync(binary,[store],{encoding:'utf8',input:JSON.stringify({
    project,actor:{kind:'daimon',subject:COMPAII_BEING},can_write:true,input,
  })}));
  const {configuredQuestbook}=await import('../src/questbook.mjs');
  const [selected]=configuredQuestbook({origin:'https://home.test',authoritySocket:join(dir,'unused.sock'),
   questbook:{project:projectA,binary,paired:true,publication:{
    repository:storyRepository,commit:storyCommit,artifact:'a'.repeat(32),version:'b'.repeat(64),
   }}},dir);
  questbook=[
   {project:projectA,binary,store,published:selected.published,
    authorize:async actor=>({read:actor.id===actorRef&&projectAReadable,write:actor.id===actorRef&&projectAReadable})},
   {project:projectB,binary,store,authorize:async actor=>({read:actor.id===actorRef&&projectBReadable,write:actor.id===actorRef&&projectBWritable})},
  ];
  assert.equal(cardTool({type:'apply',command:{operation:randomUUID(),card:secondCard,expected_revision:0,
    action:{type:'create',title:secondMission}}},projectB).result.status,'applied');
 }
 let repositories=[],historical=[],projectRevision=1,work;
 const nativeFactory=async()=>({availability:async()=>({available:true}),contexts:{},
   async topicRoom(actor,topic,includeProjects,cursor,selection){
    assert.equal(actor.ref,actorRef);
    if(!visible||topic!==room.room)throw Object.assign(Error('Unavailable'),{code:'topic-room-unavailable'});
    const scoped=selection?repositories.filter(row=>row.project===selection.project):repositories;
    if(selection&&!scoped.some(row=>row.repository===selection.repository))
      throw Object.assign(Error('Unavailable'),{code:'topic-room-unavailable'});
    const restarted=!!cursor&&cursor!==projectRevision+'.3';
    const older=cursor&&!restarted;
    return {schema:'holodeck.topic-room/v1',actorRef,room:topic,title:room.title,general:false,
      ...(includeProjects?{work,projects:{repositories:older?scoped.slice(8):scoped.slice(0,8),
        next:!older&&scoped.length>8?projectRevision+'.3':null,restarted,
        ...(selection?{project:selection.project}:{}),
        ...(selection?.evidence?{evidence:historical.filter(row=>row.project===selection.project&&
          selection.evidence.some(ref=>ref.repository===row.repository&&ref.commit===row.commit))}:{})}}:{})};
   },
   conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',actorRef,binding,
    beingRef:COMPAII_BEING,homeRef:'home:'+'c'.repeat(32),url:origin+'/interaction/'})});
 const runtime=await createHolodeck({conversationOrigins:[origin],nativeFactory,questbook,
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
 const attention=await readFile(new URL('attention.js',pathToFileURL(childSource)),'utf8');
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
    const line=document.createElement('div'),panel=document.createElement('div');
    document.body.append(line,panel);
    const questions=['Pregunta privada del topic','Pregunta de otro topic'].map((title,id)=>{
      const box=document.createElement('article');box.textContent=title;panel.append(box);
      return {id:String(id),title,box,open:async()=>true};
    });
    const pending=AttentionCarousel.mount({line,panel,getItems:()=>questions,localOnly:true});
    const surface=ConversationSurface.create({readTopics:async room=>{
      const target=new URL('/api/interaction/sessions',location.origin);
      target.searchParams.set('projection','holodeck');if(room)target.searchParams.set('room',room);
      const response=await fetch(target);if(!response.ok)throw Error('unavailable');return response.json();
    },selectTopic:async (room,current)=>{
      const target=new URL('/api/fixture-mode',location.origin);
      if(room)target.searchParams.set('room',room);
      const response=await fetch(target);
      return current()?response.json():null;
    },openResult:async (room,current)=>{
      if(room!==${JSON.stringify(room.room)}||!current())return false;
      const result=document.createElement('dialog');
      result.id='fixture-result';
      result.textContent='Resultado privado del topic';
      document.body.append(result);result.showModal();return true;
    },closeResult:()=>document.querySelector('#fixture-result')?.remove(),
    openQuestion:(room,current)=>room===${JSON.stringify(room.room)}&&pending.openSelected(['0'],current),
    closeQuestion:()=>pending.closeSelected()
    });surface.identity(${JSON.stringify(actorRef)});surface.bind(${JSON.stringify(binding)});`;
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>.pending-panel article:not(.for-you-items > article){display:none}</style></head><body><script>${protocol}\n${attention}\n${start}</script></body></html>`});
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
 const tapTool=async (id,surface='toolBounds')=>{
  const bounds=await page.waitForFunction(({id,surface})=>{
   const rect=window.holodeckDevelopment?.[surface](id);
   return rect&&rect.width>0&&rect.height>0?rect:null;
  },{id,surface},{timeout:10000});
  const {left,top,width,height}=await bounds.jsonValue();
  await page.touchscreen.tap(left+width/2,top+height/2);
 };
 const openTable=()=>tapTool('projects');
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
 assert.equal(await page.locator('#topic-project-doors').count(),0);
 work={execution:'working',question:true,result:false,private_native_id:'must-not-leak'};
 const cueRead=await page.evaluate(async room=>fetch('api/topic-projects?room='+room).then(r=>r.json()),room.room);
 assert.deepEqual(cueRead.work,{execution:'working',question:true,result:false});
 assert.equal(await page.evaluate(async()=>fetch('api/topic-projects?room='+'8'.repeat(64)).then(r=>r.status)),404);
 await openTable();
 await table.getByRole('status').filter({hasText:'El daimon estaba trabajando al abrir la mesa. Hay una pregunta pendiente.'}).waitFor();
 await table.getByRole('button',{name:'Ver pregunta del topic'}).tap();
 const attentionDialog=page.frameLocator('#shared-conversation iframe').getByRole('dialog',{name:'For you'});
 await attentionDialog.getByText('Pregunta privada del topic').waitFor();
 assert.equal(await attentionDialog.getByText('Pregunta de otro topic').isVisible(),false);
 assert.equal(await page.locator('#conversation-audience').getAttribute('data-recipient'),'general');
 await page.locator('#conversation-close').tap();
 await attentionDialog.waitFor({state:'hidden'});
 work={execution:'unknown',question:false,result:true};
 repositories=[
  {project:projectA,repository:storyRepository,label:'Cuento',commit:storyCommit,locator:'/must-not-leak'},
  {project:projectA,repository:randomUUID(),label:'Ilustraciones',commit:'2'.repeat(40)},
  {project:projectB,repository:randomUUID(),label:'Juego',commit:'3'.repeat(40)},
 ];
 const read=await page.evaluate(async room=>await fetch('api/topic-projects?room='+room).then(response=>response.json()),room.room);
 assert.equal(read.repositories.length,3);
 assert.equal('locator' in read.repositories[0],false);
 assert.deepEqual(read.work,work);
 await openTable();
 const status=table.getByRole('status').filter({hasText:'Hay un resultado en la conversación del topic.'});
 await status.waitFor();
 assert.doesNotMatch(await status.textContent(),/estaba trabajando|pregunta pendiente/);
 await table.getByText('Cuento',{exact:true}).waitFor();
 assert.equal(await table.getByRole('list',{name:'Repositorios de un proyecto'}).count(),2);
 await table.getByText('3'.repeat(40),{exact:true}).waitFor();
 const doors=page.locator('#topic-project-doors > m-group');
 await doors.nth(1).waitFor({state:'attached'});
 assert.equal(await doors.count(),2);
 assert.equal(await doors.first().locator('m-label').getAttribute('content'),'Cuento');
 await table.getByRole('button',{name:'Ver resultado del topic'}).tap();
 const resultDialog=page.frameLocator('#shared-conversation iframe').getByRole('dialog');
 await resultDialog.getByText('Resultado privado del topic').waitFor();
 assert.doesNotMatch(await page.locator('body').innerText(),/Resultado privado del topic/);
 assert.equal(await page.locator('#conversation-audience').getAttribute('data-recipient'),'general');
 assert.deepEqual(modes,[]);
 await page.locator('#conversation-close').tap();
 await resultDialog.waitFor({state:'detached'});
 await page.waitForFunction(()=>!document.body.classList.contains('room-transition')&&
  document.querySelector('#room-passage')&&getComputedStyle(document.querySelector('#room-passage')).pointerEvents==='none');
 const point=await page.evaluate(()=>{
   const door=document.querySelector('#topic-project-door-0 > m-cube:nth-child(2)').getContainer();
   const camera=holodeckDevelopment.client.getCameraManager().getCameraState();
   const p=door.getWorldPosition(door.position.clone()).sub(camera.position);
   p.applyQuaternion(door.quaternion.clone().set(camera.rotation.x,camera.rotation.y,camera.rotation.z,camera.rotation.w).invert());
   const scale=Math.tan(camera.fov*Math.PI/360)*-p.z;
   const point={x:innerWidth*(1+p.x/(scale*camera.aspect))/2,y:innerHeight*(1-p.y/scale)/2,depth:p.z};
   const hit=(dx,dy)=>holodeckDevelopment.pickedWorldKind(point.x+dx,point.y+dy);
   for(const dy of [0,-14,14,-28,28,-42,42,-56,56])for(const dx of [0,-12,12,-24,24,-36,36]){
    if(hit(dx,dy)==='topic-project-door')return {...point,x:point.x+dx,y:point.y+dy,kind:hit(dx,dy)};
   }
   return {...point,kind:hit(0,0),element:document.elementFromPoint(point.x,point.y)?.tagName};
 });
 assert.ok(point.depth<0&&point.x>0&&point.x<390&&point.y>0&&point.y<700,JSON.stringify(point));
 assert.equal(point.kind,'topic-project-door',JSON.stringify(point));
 await page.evaluate(()=>{
  window.doorEvents=[];
  const canvas=document.querySelector('.world-interaction-canvas');
  for(const node of [document,canvas])for(const type of ['pointerdown','pointerup','pointercancel','click']){
   for(const capture of [true,false])node.addEventListener(type,event=>{
    doorEvents.push([node===document?'document':'canvas',type,capture,event.target.id,event.target.className,event.target===canvas,event.defaultPrevented,event.button,
     event.isPrimary,event.clientX,event.clientY,event.timeStamp,document.body.classList.contains('room-transition'),
     holodeckDevelopment.pickedWorldKind(event.clientX,event.clientY)]);
   },{capture,once:true});
  }
 });
 await page.touchscreen.tap(point.x,point.y);
 const detail=page.getByRole('dialog',{name:'Proyecto vinculado'});
 await detail.getByText('Ilustraciones',{exact:true}).waitFor({timeout:6000}).catch(async error=>{
  throw Error(JSON.stringify({point,events:await page.evaluate(()=>window.doorEvents),errors}),{cause:error});
 });
 assert.equal(await detail.getByText('Juego',{exact:true}).count(),0);
 if(questbook){
  const selectors={room:room.room,project:projectA,repository:repositories[0].repository};
  const projectRead=scope=>page.evaluate(async scope=>
    fetch('api/topic-projects?'+new URLSearchParams(scope)).then(response=>response.json()),scope);
  const publicationLink=detail.getByRole('link',{name:'Abrir versión publicada'});
  assert.equal(await publicationLink.getAttribute('href'),publishedURL);
  assert.deepEqual((await projectRead(selectors)).publication,{url:publishedURL,commit:storyCommit});
  assert.equal((await projectRead({...selectors,repository:repositories[1].repository})).publication,undefined);
  projectAReadable=false;
  assert.equal((await projectRead(selectors)).publication,undefined);
  projectAReadable=true;
  const foreign={room:room.room,project:projectB,repository:repositories[2].repository};
  const request=(path,scope)=>page.evaluate(async ({path,scope})=>
    fetch('api/'+path+'?'+new URLSearchParams(scope)).then(response=>response.status),{path,scope});
  assert.equal(await request('questbook',foreign),403);
  projectBReadable=true;
  const second=await page.evaluate(async scope=>
    fetch('api/questbook?'+new URLSearchParams(scope)).then(response=>response.json()),foreign);
  assert.equal(second.result[2].updateDataModel.value.title,secondMission);
  assert.equal(second.canCreate,false);
  assert.equal(await request('questbook',{...selectors,selected:secondCard}),404);
  assert.equal(await request('questbook',{...foreign,repository:selectors.repository}),404);
  projectBReadable=false;
  assert.equal(await request('questbook',foreign),403);
  await detail.getByRole('button',{name:'Abrir diario de misiones'}).tap();
  const journal=page.getByRole('dialog',{name:'Diario de misiones'});
  await journal.getByText('Todavía no hay misiones.').waitFor();
  const creates=[];
  const createPath='**/api/questbook/create', receiptPath='**/api/questbook/receipt?*';
  let operation;
  await page.route(createPath,async route=>{
    const original=route.request().postDataJSON();
    creates.push(original.project);
    const reply=await route.fetch();
    const body=await reply.json();
    assert.equal(body.result.status,'applied');
    assert.deepEqual(body.result.event.card.revised_by,{kind:'human',subject:actorRef});
    if(original.project===projectA){
      card=body.result.event.card.id;
      operation=original.operation;
      await route.abort('failed');
    }else await route.fulfill({response:reply});
  });
  await page.route(receiptPath,route=>route.abort('failed'));
  const createMission=async title=>{
    await journal.getByRole('button',{name:'Nueva misión'}).tap();
    await journal.getByLabel('Título de la nueva misión').fill(title);
    await journal.getByRole('button',{name:'Crear misión'}).tap();
  };
  await createMission(mission);
  await journal.getByText('Falta confirmar la misión. Podés reintentar el mismo envío.').waitFor();
  assert.equal(cardTool({type:'read',card}).result.title,mission);
  await journal.getByRole('button',{name:'Volver al mundo',exact:true}).tap();
  await openTable();
  projectBReadable=projectBWritable=true;
  await table.getByRole('button',{name:'Abrir proyecto de Juego',exact:true}).tap();
  await detail.getByRole('button',{name:'Abrir diario de misiones'}).tap();
  await createMission('Revisar los controles del juego');
  await journal.getByText('Misión creada.').waitFor();
  await journal.getByRole('button',{name:'Volver al mundo',exact:true}).tap();
  projectBReadable=projectBWritable=false;
  await openTable();
  await table.getByRole('button',{name:'Abrir proyecto de Cuento',exact:true}).tap();
  await detail.getByRole('button',{name:'Abrir diario de misiones'}).tap();
  await page.unroute(receiptPath);
  await journal.getByRole('button',{name:'Confirmar misión pendiente'}).tap();
  assert.equal(await journal.getByLabel('Título de la nueva misión').inputValue(),mission);
  const receipt=page.waitForResponse(response=>{
    const url=new URL(response.url());
    return url.pathname.endsWith('/api/questbook/receipt')&&url.searchParams.get('operation')===operation
      &&url.searchParams.get('project')===projectA;
  });
  await journal.getByRole('button',{name:'Comprobar misión'}).tap();
  assert.equal((await (await receipt).json()).result.command.card,card);
  await journal.getByText('Misión creada.').waitFor();
  assert.deepEqual(creates,[projectA,projectB]);
  assert.equal(cardTool({type:'history',card,after:0}).result.length,1);
  await page.unroute(createPath);
  await journal.getByText(mission,{exact:true}).last().waitFor({state:'attached'});
  const changed=page.waitForResponse(response=>response.url().endsWith('/api/questbook/action'));
  await journal.getByRole('button',{name:'Aceptar misión'}).focus();
  await page.keyboard.press('Space');
  assert.equal((await (await changed).json()).result.status,'applied');
  await journal.getByText('En curso',{exact:true}).waitFor({state:'attached'});
  assert.equal(cardTool({type:'read',card}).result.status,'in_progress');
  await journal.getByRole('button',{name:'Editar título'}).focus();
  await page.keyboard.press('Space');
  const draft=journal.getByLabel('Título de la misión');
  const humanTitle='Revisar primero la segunda escena';
  const otherTitle='Ordenar las láminas';
  await draft.fill(humanTitle);
  const nativeEdit=cardTool({type:'apply',command:{operation:randomUUID(),card,expected_revision:2,
    action:{type:'edit_title',title:otherTitle}}});
  assert.equal(nativeEdit.result.status,'applied');
  assert.deepEqual(nativeEdit.result.event.card.revised_by,{kind:'daimon',subject:COMPAII_BEING});
  const stale=page.waitForResponse(response=>response.url().endsWith('/api/questbook/action'));
  await journal.getByRole('button',{name:'Guardar título'}).tap();
  assert.equal((await (await stale).json()).result.status,'conflict');
  await journal.getByText('La misión cambió. Tu borrador sigue disponible.').waitFor();
  await journal.getByText(otherTitle,{exact:true}).last().waitFor({state:'attached'});
  assert.equal(await draft.inputValue(),humanTitle);
  const edited=page.waitForResponse(response=>response.url().endsWith('/api/questbook/action'));
  await journal.getByRole('button',{name:'Guardar título'}).tap();
  const written=(await (await edited).json()).result;
  assert.equal(written.status,'applied');
  await draft.waitFor({state:'hidden'});
  await journal.getByText(humanTitle,{exact:true}).last().waitFor({state:'attached'});
  const shared=cardTool({type:'read',card}).result;
  assert.equal(shared.title,humanTitle);
  assert.equal(shared.revision,4);
  assert.deepEqual(shared.revised_by,{kind:'human',subject:actorRef});
  const linkRevision=(expected_revision,repository,commit)=>cardTool({type:'apply',command:{
    operation:randomUUID(),card,expected_revision,action:{type:'link_revision',revision:{repository,commit}},
  }}).result;
  assert.equal(linkRevision(4,repositories[0].repository,storyCommit).status,'applied');
  assert.equal(linkRevision(5,repositories[2].repository,storyCommit).status,'applied');
  const mount=()=>page.evaluate(async scope=>
    fetch('api/questbook?'+new URLSearchParams(scope)).then(response=>response.json()),selectors);
  assert.equal((await mount()).result[2].updateDataModel.value.revisions,'Cuento · '+storyCommit);
  historical=[{...repositories[0]}];
  repositories[0].commit=laterCommit;
  await journal.getByRole('button',{name:'Volver al mundo',exact:true}).tap();
  await openTable();
  await table.getByRole('button',{name:'Abrir proyecto de Cuento',exact:true}).tap();
  await detail.getByRole('button',{name:'Abrir diario de misiones'}).tap();
  await journal.getByText('Cuento · '+storyCommit,{exact:true}).waitFor({state:'attached'});
  assert.deepEqual((await projectRead(selectors)).publication,{url:publishedURL,commit:storyCommit});
  const previous=(await mount()).result[2].updateDataModel.value;
  assert.equal(previous.revisions,'Cuento · '+storyCommit);
  assert.equal('revisionCandidates' in previous,false);
  assert.equal(JSON.stringify(previous).includes('/must-not-leak'),false);
  historical=[];
  assert.equal((await projectRead(selectors)).publication,undefined);
  assert.equal((await mount()).result[2].updateDataModel.value.hasRevisions,false);
  assert.equal(cardTool({type:'read',card}).result.evidence.length,2);
  repositories[0].commit=storyCommit;
  const linkedRepositories=repositories;
  repositories=repositories.slice(1);
  assert.equal(await request('questbook',selectors),404);
  const denied=await page.evaluate(async ({selectors,card,operation})=>{
    const response=await fetch('api/questbook/action',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({...selectors,operation,card,event:{surfaceId:'questbook-'+selectors.project,
        name:'edit_title',context:{card,revision:6,title:'Escritura sin vínculo'}}})});
    return response.status;
  },{selectors,card,operation:randomUUID()});
  assert.equal(denied,404);
  assert.equal(cardTool({type:'read',card}).result.title,humanTitle);
  repositories=linkedRepositories;
  await journal.getByRole('button',{name:'Volver al mundo',exact:true}).tap();
  await openTable();
  projectBReadable=true;
  await table.getByRole('button',{name:'Abrir proyecto de Juego',exact:true}).tap();
  await detail.getByRole('button',{name:'Abrir diario de misiones'}).tap();
  await journal.getByText(secondMission,{exact:true}).last().waitFor({state:'attached'});
  assert.equal(await journal.getByRole('button',{name:'Nueva misión'}).isVisible(),false);
  await journal.getByRole('button',{name:'Volver al mundo',exact:true}).tap();
  projectBReadable=false;
  await openTable();
 }else await detail.getByRole('button',{name:'Volver a la mesa',exact:true}).tap();
 await table.getByText('Cuento',{exact:true}).waitFor();
 const openStory=()=>table.getByRole('button',{name:'Abrir proyecto de Cuento',exact:true}).tap();
 await openStory();
 await detail.getByText('Ilustraciones',{exact:true}).waitFor();
 assert.equal(await detail.getByText('Juego',{exact:true}).count(),0);
 await detail.getByRole('button',{name:'Volver a la mesa',exact:true}).tap();
 await table.getByText('Cuento',{exact:true}).waitFor();
 const allRepositories=repositories;
 repositories=repositories.filter(row=>row.label!=='Cuento');
 await openStory();
 await detail.getByText('El proyecto no está disponible desde esta sala.').waitFor();
 assert.equal(await detail.getByText('Ilustraciones',{exact:true}).count(),0);
 repositories=allRepositories;
 await detail.getByRole('button',{name:'Volver a la mesa',exact:true}).tap();
 await table.getByText('Cuento',{exact:true}).waitFor();
 await closeTable();
 repositories=repositories.filter(row=>row.label!=='Juego');
 repositories[0].commit='4'.repeat(40);
 await openTable();
 await table.getByText('4'.repeat(40),{exact:true}).waitFor();
 assert.equal(await table.getByText(storyCommit,{exact:true}).count(),0);
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
 await tapTool('talk');
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
 await tapTool('map');
 await tapTool('exit','mapBounds');
 await page.waitForFunction(()=>!document.body.classList.contains('inside-house')&&
   !document.body.classList.contains('room-transition'));
 assert.equal(runtime.spaces.current({id:actorRef}),'outside');
 assert.equal(await page.locator('#topic-project-doors').count(),0);
 await page.getByRole('button',{name:'Topics',exact:true}).tap();
 await dialog.getByRole('button',{name}).waitFor();
 visible=false;
 await dialog.getByRole('button',{name}).tap();
 await dialog.getByText('Ese topic ya no está disponible.').waitFor();
 assert.deepEqual(readbacks,[null,room.room,null,room.room]);
 // The current renderer publishes its pose separately from work and travel.
 assert.deepEqual(posted.filter(path=>path!=='/api/space/avatar-pose'),questbook?['/api/topic-space','/api/questbook/create','/api/questbook/create',
   '/api/questbook/action','/api/questbook/action','/api/questbook/action','/api/questbook/action','/api/space']:
   ['/api/topic-space','/api/space']);
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
