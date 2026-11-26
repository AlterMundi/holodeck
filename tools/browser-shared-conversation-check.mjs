// Actual installed Conversation shell/assets in a cross-origin HTTPS iframe.
// Synthetic loopback I/O only: no real credentials, native/model/provider calls.
import WebSocket from 'ws';
import {createServer as createHttpsServer} from 'node:https';
import {readFile,realpath,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {brotliDecompressSync} from 'node:zlib';
const directory=process.env.HOLODECK_EVIDENCE_DIR,tls=process.env.HOLODECK_FIXTURE_TLS,conversationRelease=process.env.HOLODECK_CONVERSATION_RELEASE;
if(!directory||!tls||!conversationRelease)throw Error('Select bounded isolated fixture evidence/TLS directories and the installed Conversation release');
const stage=process.env.HOLODECK_STAGE?await realpath(process.env.HOLODECK_STAGE):null;
if(stage){
 process.env.HOLODECK_JSDOM_HELPERS=join(stage,'runtime/jsdom/lib/jsdom/living/helpers');
 process.env.HOLODECK_XHR_WORKER=join(stage,'src/xhr-sync-worker.mjs');
}
const {createHolodeck}=await import(stage?pathToFileURL(join(stage,'src/server.mjs')):new URL('../src/server.mjs',import.meta.url));
const installed=await realpath(conversationRelease),web=join(installed,'dashboard/web');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),served=new Map(),wait=ms=>new Promise(r=>setTimeout(r,ms));
const frameOrigin='https://127.0.0.1:18945',worldOrigin='http://127.0.0.1:18944',actor='human:surface-fixture',binding='b'.repeat(64),being='dm:being:v1:'+'a'.repeat(43),home='home:'+'c'.repeat(32);
const pin={tableId:'fixture-table',reportId:'fixture-report',revision:'r1'},accepted=[],prepared=[],released=[],requests=[],fileWrites=[];
let world,worldServer,frameServer,page,loads=0,releaseFile;
let nextId=0,ws;const pending=new Map(),events=[];
async function cdp(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},15000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params,sessionId}));});}
async function evaluate(expression,contextId,sessionId){const value=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,...(contextId?{contextId}:{})},sessionId);if(value.exceptionDetails)throw Error(value.exceptionDetails.exception?.description||JSON.stringify(value.exceptionDetails));return value.result.value;}
async function until(fn,ms=15000,label='condition'){const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await wait(100)}throw Error('Timed out: '+label);}
async function bytes(name){const value=await readFile(join(web,name));served.set(name,digest(value));return value;}
async function body(req,max=65536){let all=Buffer.alloc(0);for await(const chunk of req){all=Buffer.concat([all,chunk]);if(all.length>max)throw Error('Fixture body bound');}return all;}
const cursor={delivery:0,native:0,matrix:0,inbox:0,responses:0,publications:0};
function apiResponse(path){
 if(path==='/api/interaction/access')return {csrf:'fixture-csrf',actor_ref:actor,label:'Controlled participant'};
 if(path==='/api/interaction')return {binding,csrf:'fixture-csrf',items:[],cursor,newest:cursor,more:false,can_listen:true,can_speak:true,can_send:true,can_decide_requests:false,can_download_files:false,activity:{state:'idle'},presentation_profile:'simple'};
 if(path==='/api/interaction/inputs')return {binding,csrf:'fixture-csrf',items:accepted,cursor:accepted.length,newest:accepted.length,more:false,routing_choices:[]};
 if(path==='/api/interaction/telegram-inputs')return {schema:'telecodex.telegram-input-list/v1',binding,items:[],cursor:0,newest:0,more:false};
 if(path==='/api/interaction/alerts')return {state:'available',observer_state:'observed',read_only:true,attention:{schema:'telecodex.alert-attention/v1',level:'warning',count:1,symbol:'🟠'},incidents:[{projection:{producer_id:'fixture-surface',incident_id:'fixture',processing_state:'open',severity:'warning',phase:'test',summary:'Controlled existing alerts surface',action:'No external action',source_at:Math.floor(Date.now()/1000)},acknowledgments:[],deliveries:[],freshness:'current'}],resolved_incidents:[],local_deliveries:[]};
 if(path==='/api/interaction/heartbeat')return {state:'unavailable',available:false};
 if(path==='/api/interaction/sonic')return {state:'not_configured'};
 return {binding,csrf:'fixture-csrf',items:[],cursor:0,newest:0,more:false,state:'available'};
}
try{
 await mkdir(directory,{recursive:true});
 frameServer=createHttpsServer({key:await readFile(join(tls,'key.pem')),cert:await readFile(join(tls,'cert.pem'))},async(req,res)=>{
  try{
   const url=new URL(req.url,frameOrigin);requests.push({kind:'canonical',method:req.method,path:url.pathname});if(requests.length>4000)throw Error('Fixture request bound');
   if(url.pathname==='/'){
    loads++;let html=(await bytes('index.html')).toString();
    html=html.replace('<html lang="en"',`<html lang="en" data-shared-auth="true" data-style-policy="authored" data-surface-parent="${worldOrigin}" data-surface-visit="${url.searchParams.get('surface_visit')}"`)
     .replace('<body>','<body class="conversation-mode standalone-conversation conversation-surface">')
     .replace('<section id="conversation" hidden','<section id="conversation"')
     .replace('    <script src="https://telegram.org/js/telegram-web-app.js" defer></script>\n','');
    res.setHeader('Content-Type','text/html');res.end(html);return;
   }
   if(url.pathname.startsWith('/assets/')){
    const name=url.pathname.slice(8);if(!/^[a-z0-9._-]+$/.test(name)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.woff2')?'font/woff2':'application/octet-stream');res.end(await bytes(name));return;
   }
   if(url.pathname==='/api/interaction/files'&&req.method==='POST'){
    const content=await body(req),ref=JSON.parse(decodeURIComponent(req.headers['x-file-reference']||''));
    if(ref.sha256!==digest(content)||ref.size!==content.length)throw Error('Synthetic original file mismatch');fileWrites.push(ref);
    releaseFile=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(ref));releaseFile=null;};return;
   }
   if(url.pathname==='/api/interaction/inputs'&&req.method==='POST'){
    const value=JSON.parse((await body(req)).toString());if(value.binding!==binding)throw Error('Canonical binding mismatch');
    const result={...value,phase:'accepted',received_at:new Date().toISOString(),entry:1,files:value.files||[]};accepted.push(result);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(apiResponse(url.pathname)));
  }catch(error){res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({detail:error.message}));}
 });
 await new Promise((r,j)=>{frameServer.once('error',j);frameServer.listen(18945,'127.0.0.1',r)});
 world=await createHolodeck({publicOrigin:worldOrigin,galleryAuthorization:async()=>false,conversationOrigins:[frameOrigin],identityResolver:async()=>({id:actor,ref:actor,kind:'human',rights:['observe','edit','project']}),
  contentVisits:[{id:'fixture',node:'reading-room',entry:'/nexus/?table=fixture-table&report_revision=r1',descriptor:'/nexus/descriptor',pin,discoverActors:[actor]}],
  nativeFactory:async()=>({availability:async()=>({available:true}),conversationSurface:async()=>({schema:'holodeck.conversation-surface/v1',actorRef:actor,beingRef:being,homeRef:home,binding,url:frameOrigin+'/'}),
   contexts:{prepare:async(_actor,value)=>{prepared.push(structuredClone(value));return {id:value.id,binding,work_admitted:false,files:[{file_id:randomUUID(),sha256:'d'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000}]};},release:async(_actor,id)=>{released.push(id);return {released:false}},discard:async()=>({released:true})}})});
 world.app.get('/nexus/descriptor',(_req,res)=>res.json({pin,title:'Controlled presentation'}));
 world.app.get('/nexus/',(_req,res)=>res.type('html').send(`<!doctype html><h1>Controlled content fixture</h1><script>
 const pin=${JSON.stringify(pin)},visitId=new URL(location).searchParams.get('holodeck_visit');
 window.fixture={hold:false,held:[],state:{recording:false,processing:false,dirty:false,playing:false},reply:r=>parent.postMessage({schema:'dm.holodeck-visit/response-v1',id:r.id,visitId,pin,ok:true,result:r.method==='describe'?{capabilities:{describe:true,getContext:true,pauseAndFreeze:true,prepareClose:true},state:fixture.state}:r.method==='getContext'?{state:fixture.state,source_time_ms:1234}:{canClose:true,state:fixture.state}},location.origin)};
 addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data.schema!=='dm.holodeck-visit/request-v1')return;if(fixture.hold&&e.data.method==='getContext')fixture.held.push(e.data);else fixture.reply(e.data)});parent.postMessage({schema:'dm.holodeck-visit/ready-v1',visitId,pin},location.origin);
 </script>`));
 worldServer=world.app.listen(18944,'127.0.0.1');await new Promise((r,j)=>{worldServer.once('listening',r);worldServer.once('error',j)});
 const clientResponse=await fetch(worldOrigin+'/client/client.js');
 const expectedClient=stage?brotliDecompressSync(await readFile(join(stage,'runtime/client.js.br'))):await readFile(new URL('../build/client.js',import.meta.url));
 const clientSHA256=digest(Buffer.from(await clientResponse.arrayBuffer()));
 if(!clientResponse.ok||clientSHA256!==digest(expectedClient))throw Error('Fixture served a different Holodeck client');
 page=await(await fetch('http://127.0.0.1:18943/json/new?about:blank',{method:'PUT'})).json();ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
 const attach=(async({sessionId,targetInfo})=>{
  if(targetInfo.type==='iframe'){
   await cdp('Page.enable',{},sessionId);
   await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.checkErrors=[];addEventListener('error',e=>checkErrors.push(e.message));addEventListener('unhandledrejection',e=>checkErrors.push(String(e.reason)));"},sessionId);
   await cdp('Runtime.enable',{},sessionId);
  }
  await cdp('Runtime.runIfWaitingForDebugger',{},sessionId);
 });
 let attachError;
 ws.on('message',raw=>{const v=JSON.parse(raw),p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result);}else{events.push(v);if(events.length>4000)events.shift();if(v.method==='Target.attachedToTarget')attach(v.params).catch(error=>{attachError=error;});}});
 await cdp('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'iframe'}]});
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.checkErrors=[];window.surfaceMessages=[];addEventListener('error',e=>checkErrors.push(e.message));addEventListener('unhandledrejection',e=>checkErrors.push(String(e.reason)));addEventListener('message',e=>{if(e.data?.schema==='conversation.surface/v1')surfaceMessages.push(structuredClone(e.data));if(e.data?.schema==='fixture.submit-point')window.submissionMoment={capturedAt:e.data.capturedAt,receivedAt:Date.now(),local:structuredClone(window.holodeckDevelopment?.client.getLocalCharacterState())}});`});
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:worldOrigin+'/'});await cdp('Page.bringToFront');
 await until(()=>evaluate('!!window.holodeckDevelopment?.client.getLocalCharacterState()?.position'),30000,'walkable world');
 await until(()=>evaluate(`(()=>{const help=document.querySelector('#help');return help.hasAttribute('data-native-status')&&getComputedStyle(help).clipPath==='inset(50%)';})()`),10000,'native desktop keyboard help');
 const keyboardHelp=await evaluate(`document.querySelector('#help').textContent.trim()`);
 if(!['W','A','S','D','Shift','Alt','Espacio'].every(key=>keyboardHelp.includes(key)))throw Error('Keyboard help omits existing bindings '+keyboardHelp);
 const keyboardShot=await cdp('Page.captureScreenshot',{format:'png'});
 await writeFile(join(directory,'world-keyboard-help.png'),Buffer.from(keyboardShot.data,'base64'));
 await evaluate('(()=>{const {client}=holodeckDevelopment;client.updateConfig({spawnConfiguration:{spawnPosition:{x:-22,y:.3,z:3}}});client.respawn();return true})()');
 await until(()=>evaluate('!document.querySelector("#visit-near").hidden'),10000,'presentation in reach');
 await evaluate('document.querySelector("#visit-near").click();true');await until(()=>evaluate('!!document.querySelector("#visit-stage iframe")?.contentWindow.fixture'),10000,'content fixture');
 await evaluate('window.retainedContent=document.querySelector("#visit-stage iframe");true');await wait(150);
 await evaluate('document.querySelector("#visit-walk").click();true');await until(()=>evaluate('document.querySelector("#content-visit").classList.contains("is-walking")'),10000,'retained content return');
 await evaluate('document.querySelector("#talk").click();true');await until(()=>evaluate('!!document.querySelector("#shared-conversation iframe")'),10000,'canonical frame');
 const findFrame=()=>events.findLast(e=>e.method==='Runtime.executionContextCreated'&&e.params.context.origin===frameOrigin&&e.params.context.auxData?.isDefault);
 await until(()=>{if(attachError)throw attachError;return findFrame();},10000,'canonical runtime context');
 const frameContext=findFrame();
 const frame=expression=>evaluate(expression,frameContext.params.context.id,frameContext.sessionId);
 await until(()=>frame('!!window.Conversation&&!!window.ConversationSurface&&!document.querySelector("#conversation-send").disabled'),15000,'actual canonical composer');
 await until(()=>evaluate('surfaceMessages.some(m=>m.type==="ready")'),10000,'bound canonical ready');
 const ready=await evaluate('surfaceMessages.findLast(m=>m.type==="ready")');
 if(process.env.HOLODECK_LAYOUT_ONLY==='1'){
  const observations=[];
  for(const [name,width,height,mobile]of [['desktop',1100,800,false],['mobile',390,844,true]]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await wait(150);
   const outer=await evaluate('(()=>{const p=document.querySelector("#conversation-panel").getBoundingClientRect(),f=document.querySelector("#shared-conversation iframe").getBoundingClientRect();return{left:p.left,right:p.right,top:p.top,bottom:p.bottom,frameWidth:f.width,frameHeight:f.height}})()');
   const inner=await frame(`(()=>{const nodes=[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{tag:e.tagName,id:e.id,classes:e.className,left:r.left,right:r.right,width:r.width,display:c.display,position:c.position,minWidth:c.minWidth,maxWidth:c.maxWidth,flex:c.flex,overflow:c.overflowX,whiteSpace:c.whiteSpace,text:e.children.length?'':e.textContent.slice(0,100)}}).filter(e=>e.width>0&&(e.right>innerWidth+.5||e.left<-.5));return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,overflow:nodes.slice(0,40)}})()`);
   observations.push({name,outer,inner});const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'layout-'+name+'.png'),Buffer.from(shot.data,'base64'));
  }
  await writeFile(join(directory,'layout-observation.json'),JSON.stringify({observations,installed,clientSHA256,assets:Object.fromEntries(served),canonicalOriginalPosts:accepted.length,contextPreparations:prepared.length},null,2));console.log(JSON.stringify({observations}));
 }else{
 const position=()=>evaluate('structuredClone(holodeckDevelopment.client.getLocalCharacterState().position)');
 const walked=(before,after)=>Math.hypot(after.x-before.x,after.z-before.z);
 const running=()=>evaluate('holodeckDevelopment.client.keyInputManager.getRun()');
 const keyEvent=(type,fields)=>cdp('Input.dispatchKeyEvent',{type,...fields});
 async function holdShift(action){
  const shift={key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16};
  await keyEvent('rawKeyDown',{...shift,modifiers:8});
  try{return await action();}finally{await keyEvent('keyUp',shift);}
 }
 async function holdA(shift=false){
  const key=shift?'A':'a',stroke={key,code:'KeyA',windowsVirtualKeyCode:65,modifiers:shift?8:0};
  await keyEvent('keyDown',{...stroke,text:key});
  try{await wait(550);}finally{await keyEvent('keyUp',stroke);}
 }
 await frame('document.querySelector("#conversation-message").focus();true');
 const writingFrom=await position();
 const composerSprint=await holdShift(async()=>{await holdA(true);return running();});
 const writingDistance=walked(writingFrom,await position());
 if(composerSprint||writingDistance>.02||await frame('document.activeElement.value')!=='A')throw Error('Composer keyboard input leaked into world movement');
 const forged={...ready,type:'prepare',id:randomUUID(),request:randomUUID(),modality:'text',capacity:{files:8,bytes:40*1024*1024,context_bytes:65536}};
 for(const [label,source,origin,data]of [['wrong-source','window',frameOrigin,forged],['wrong-origin','document.querySelector("#shared-conversation iframe").contentWindow','https://foreign.test',forged],['wrong-binding','document.querySelector("#shared-conversation iframe").contentWindow',frameOrigin,{...forged,binding:'e'.repeat(64)}],['wrong-actor','document.querySelector("#shared-conversation iframe").contentWindow',frameOrigin,{...forged,actor:'human:other'}]]){
  await evaluate(`dispatchEvent(new MessageEvent('message',{source:${source},origin:${JSON.stringify(origin)},data:${JSON.stringify(data)}}));true`);await wait(50);if(prepared.length)throw Error('Forged host context admitted: '+label);
 }
 await frame(`(()=>{const input=document.querySelector('#conversation-files'),dt=new DataTransfer();dt.items.add(new File(['Synthetic retained file'],'fixture.txt',{type:'text/plain'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);await until(()=>frame('document.querySelector("#conversation-files-state").textContent.includes("Original files selected")'),10000,'actual file preparation');
 await evaluate('retainedContent.contentWindow.fixture.hold=true;true');
 await frame(`document.querySelector('#conversation-compose').addEventListener('submit',()=>{window.fixtureSubmitTime=Date.now();parent.postMessage({schema:'fixture.submit-point',capturedAt:fixtureSubmitTime},${JSON.stringify(worldOrigin)})},{capture:true,once:true});document.querySelector('#conversation-message').value='Synthetic canonical situated original';document.querySelector('#conversation-compose').requestSubmit();true`);
 await until(()=>evaluate('retainedContent.contentWindow.fixture.held.length===1'),10000,'content context held while canonical file upload awaits');
 await until(()=>!!releaseFile,10000,'original file acknowledgment held');const submit=await evaluate('submissionMoment');
 async function replaceDraft(){
  await frame(`(()=>{
   const draft=document.querySelector('#conversation-message');
   window.fixtureDraftLock=undefined;
   draft.addEventListener('beforeinput',event=>{window.fixtureDraftLock=event.defaultPrevented;},{once:true});
   draft.focus();
   draft.setSelectionRange(0,draft.value.length);
   return true;
  })()`);
  await cdp('Input.insertText',{text:'Next canonical draft retained'});
  await until(()=>frame('typeof fixtureDraftLock==="boolean"'),4000,'canonical frame received the draft edit');
  return frame('fixtureDraftLock');
 }
 const sentDraftLocked=await replaceDraft();
 const drafting=()=>frame('document.querySelector("#conversation-message").value');
 if(await drafting()!==(sentDraftLocked?'Synthetic canonical situated original':'Next canonical draft retained'))
  throw Error('Unexpected canonical draft during preparation');
 const minimizeMotion=await evaluate(`(()=>{
  window.retainedConversation=document.querySelector('#shared-conversation iframe');
  window.frameIdentity=retainedConversation.src;
  document.querySelector('#conversation-close').click();
  return document.querySelector('#conversation-panel').dataset.displayMotion;
 })()`);
 if(await evaluate('document.querySelector("#conversation-panel").contains(document.activeElement)'))throw Error('Closing left keyboard focus inside Conversation');
 const worldSprint=await holdShift(running);
 if(!worldSprint||await running())throw Error('World Shift did not enter and release the run state');
 await holdA();
 const later=await evaluate('({capturedAt:Date.now(),local:structuredClone(holodeckDevelopment.client.getLocalCharacterState())})');
 const walkingDistance=walked(submit.local.position,later.local.position);
 if(walkingDistance<.1)throw Error('World did not move independently during canonical preparation');
 await evaluate('retainedContent.contentWindow.fixture.hold=false;retainedContent.contentWindow.fixture.reply(retainedContent.contentWindow.fixture.held.shift());true');await until(()=>prepared.length===1,10000,'immutable machine context');
 if(accepted.length)throw Error('Canonical original admitted before file acknowledgment');releaseFile();await until(()=>accepted.length===1,10000,'one canonical original');
 const restoreMotion=await evaluate(`(()=>{
  document.querySelector('#talk').click();
  return document.querySelector('#conversation-panel').dataset.displayMotion;
 })()`);
 if(minimizeMotion!=='minimize'||restoreMotion!=='restore')throw Error('Canonical panel did not animate to and from its toolbelt control');
 if(!await evaluate('retainedConversation===document.querySelector("#shared-conversation iframe")&&retainedConversation.src===frameIdentity'))throw Error('Hiding replaced canonical frame');
 const captured=prepared[0].view,positionError=Math.hypot(...['x','y','z'].map(axis=>captured.local.position[axis]-submit.local.position[axis]));
 if(positionError>.0001||captured.capturedAt<submit.capturedAt-10||captured.capturedAt>submit.capturedAt+100)throw Error('Canonical preparation moved initial situation '+JSON.stringify({submit,later,captured}));
 if(accepted[0].text!=='Synthetic canonical situated original'||accepted[0].files.length!==2||accepted[0].files.filter(f=>f.name==='holodeck-situation.json').length!==1)throw Error('Canonical original/files changed');
 if(sentDraftLocked){
  await until(()=>frame('!document.querySelector("#conversation-send").disabled'),8000,'canonical draft unlocked after the original was accepted');
  if(await replaceDraft())throw Error('Canonical frame kept the draft locked after acceptance');
  await evaluate('document.querySelector("#conversation-close").click();document.querySelector("#talk").click();true');
  if(!await evaluate('retainedConversation===document.querySelector("#shared-conversation iframe")'))throw Error('Hiding replaced canonical frame after acknowledgment');
 }
 if(await drafting()!=='Next canonical draft retained')throw Error('Canonical send erased newer draft');
 const layouts=[];for(const [name,width,height,lane]of [['desktop',1100,800,''],['mobile',390,844,'bottom'],['landscape',844,390,'side']]){
  const mobile=Boolean(lane);
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:mobile,...(mobile?{maxTouchPoints:1}:{})});
  const worldHeader=()=>evaluate(`(()=>{
   const panel=document.querySelector('#conversation-panel'),header=document.querySelector('#hud');
   return {priority:panel.hasAttribute('data-compact-priority'),native:header.hasAttribute('data-native-status'),lane:panel.dataset.travelLane??'',
    fallbackHidden:getComputedStyle(header).visibility==='hidden'};
  })()`);
  await until(async()=>{const status=await worldHeader();return status.priority===mobile&&status.native!==mobile&&status.fallbackHidden&&status.lane===lane;},8000,'world header and travel lane respect Conversation priority on '+name);
  await wait(120);
  const outer=await evaluate('(()=>{const p=document.querySelector("#conversation-panel").getBoundingClientRect(),f=document.querySelector("#shared-conversation iframe").getBoundingClientRect();return{left:p.left,right:p.right,top:p.top,bottom:p.bottom,frameWidth:f.width,frameHeight:f.height}})()');
  const inner=await frame('(()=>{const e=document.querySelector("#conversation-compose").getBoundingClientRect(),s=document.querySelector("#conversation-send").getBoundingClientRect(),a=document.querySelector("#conversation-talk").getBoundingClientRect();return{audio:{left:a.left,right:a.right,top:a.top,bottom:a.bottom,width:a.width,height:a.height},width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,compose:{left:e.left,right:e.right,top:e.top,bottom:e.bottom},send:{left:s.left,right:s.right,top:s.top,bottom:s.bottom}}})()');
  if(outer.left<0||outer.right>width||outer.top<0||outer.bottom>height||outer.frameHeight<150||inner.scrollWidth>inner.width+1||inner.send.right>inner.width||inner.send.left<0||inner.send.top<0||inner.send.bottom>inner.height||inner.audio.width<40||inner.audio.height<40||inner.audio.left<0||inner.audio.right>inner.width||inner.audio.top<0||inner.audio.bottom>inner.height)throw Error('Canonical frame layout overflow '+JSON.stringify({name,outer,inner}));layouts.push({name,outer,inner,worldHeader:await worldHeader()});
  const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'layout-'+name+'.png'),Buffer.from(shot.data,'base64'));
 }
 await evaluate('document.querySelector("#conversation-close").click();true');
 await until(()=>evaluate('document.querySelector("#hud").hasAttribute("data-native-status")'),8000,'compact world header restored after minimizing');
 const errors=await evaluate('checkErrors'),frameErrors=await frame('checkErrors');if(errors.length||frameErrors.length)throw Error('Browser errors '+JSON.stringify({errors,frameErrors}));
 const evidence={schema:'holodeck.shared-conversation-browser/v1',qualification:'Actual installed canonical full shell/assets and Holodeck MML world, synthetic loopback Home/context/files/original I/O; no real human/native/model/provider input or acceptance.',canonicalRelease:installed.split('/').at(-1),canonicalAssets:Object.fromEntries(served),loads,acceptedOriginals:accepted.length,exactOriginal:true,contextFiles:1,userFiles:1,fileUploads:fileWrites.length,draftRetained:true,operationalAlerts:'Canonical quiet frame intentionally hides the ordinary launcher; not an exercised capability.',recordingControlVisibleAndFits:true,recordingCountdownSounds:'Not exercised by this text/files fixture; use separate canonical recorder qualification.',forgeriesRefused:4,retainedOneFrame:true,submit,later,captured,positionError,layouts,keyboardHelp,errors,frameErrors};
 if(loads!==1)throw Error('Canonical frame unexpectedly reloaded');await writeFile(join(directory,'evidence.json'),JSON.stringify({...evidence,clientSHA256,writingDistance,walkingDistance,minimizeMotion,restoreMotion,composerSprint,worldSprint,sentDraftLocked},null,2)+'\n');console.log(JSON.stringify(evidence));
 }
}catch(error){console.error('diagnostic-world',JSON.stringify(await evaluate('({body:document.body.innerText.slice(-1200),messages:window.surfaceMessages,errors:window.checkErrors})').catch(e=>({error:e.message}))));console.error('requests',JSON.stringify(requests.slice(-35)));console.error('contexts',JSON.stringify(events.filter(e=>['Runtime.executionContextCreated','Runtime.exceptionThrown'].includes(e.method)).slice(-12)));throw error;
}finally{
 if(ws){ws.close();if(page)await fetch('http://127.0.0.1:18943/json/close/'+page.id).catch(()=>{});}
 world?.close();if(worldServer){worldServer.closeAllConnections();await new Promise(r=>worldServer.close(r));}if(frameServer){frameServer.closeAllConnections();await new Promise(r=>frameServer.close(r));}
}
