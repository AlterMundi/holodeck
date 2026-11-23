import WebSocket from 'ws';
const {createHolodeck}=await import(process.env.HOLODECK_SERVER_MODULE||new URL('../src/server.mjs',import.meta.url).href);
import {mkdir} from 'node:fs/promises';
import {writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:18943',wait=ms=>new Promise(r=>setTimeout(r,ms));
async function connection(target){
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});let next=0;const pending=new Map();
 ws.on('message',raw=>{const m=JSON.parse(raw);if(pending.has(m.id)){const t=pending.get(m.id);pending.delete(m.id);m.error?t.j(Error(m.error.message)):t.r(m.result)}});
 function cdp(method,params={}){return new Promise((r,j)=>{const id=++next,t=setTimeout(()=>{pending.delete(id);j(Error('Timed out: '+method))},20000);pending.set(id,{r:v=>{clearTimeout(t);r(v)},j:e=>{clearTimeout(t);j(e)}});ws.send(JSON.stringify({id,method,params}))})}
 async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Evaluation error');return r.result.value}
 async function until(expression,ms=10000){const begin=Date.now();while(Date.now()-begin<ms){if(await evaluate(expression))return;await wait(100)}throw Error('Condition failed: '+expression)}
 // Match the focus qualifier: m-label texture canvases have zero layout, not the MML viewport.
 async function click(selector,{touch=false}={}){const box=await evaluate(`(()=>{const e=${JSON.stringify(selector)}==='canvas'?[...document.querySelectorAll('canvas')].find(c=>{const r=c.getBoundingClientRect();return r.width>100&&r.height>100&&r.left>=0&&r.top>=0}):document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Visible interaction target unavailable');const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(touch){await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y,id:1}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});}}
 return {target,cdp,evaluate,until,click,async close(){ws.close();await fetch(origin+'/json/close/'+target.id)}};
}
async function isolatedTarget(){
 const metadata=await(await fetch(origin+'/json/version')).json(),socket=new WebSocket(metadata.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 let id=0;const call=(method,params={})=>new Promise((resolve,reject)=>{const selected=++id,timer=setTimeout(()=>reject(Error('Isolated browser target unavailable')),5000);const receive=raw=>{const value=JSON.parse(raw);if(value.id===selected){clearTimeout(timer);socket.off('message',receive);value.error?reject(Error(value.error.message)):resolve(value.result);}};socket.on('message',receive);socket.send(JSON.stringify({id:selected,method,params}));});
 try{const {browserContextId}=await call('Target.createBrowserContext');const {targetId}=await call('Target.createTarget',{url:'about:blank',browserContextId});return(await(await fetch(origin+'/json/list')).json()).find(value=>value.id===targetId);}finally{socket.close();}
}
// Controlled loopback Nexus/native fixtures only. Requires an explicitly started
// isolated Chromium CDP18943 and built client; owns one temporary HTTP listener
// and at most two browser targets, closed in finally. No provider/human originals.
const owned=[],pin={tableId:'fixture-table',reportId:'fixture-report',revision:'fixture-v1'},accepted=[],records=new Map();
let mode='denied',loads=0,service,server;
const evidence={},directory=process.env.HOLODECK_EVIDENCE_DIR;
async function approachReadingRoom(page,offset){
 const target=await page.evaluate(`(async()=>{
  const {nodes}=await (await fetch('/api/content-visits')).json();
  const {x,y,z}=nodes.find(node=>node.id==='reading-room').position;
  const client=holodeckDevelopment.client;
  client.updateConfig({spawnConfiguration:{spawnPosition:{x:x+${offset},y,z},spawnYRotation:90}});
  client.respawn();client.getCameraManager().setOrbitAngle(0);
  return {x,y,z};
 })()`);
 await page.until(`(()=>{const c=holodeckDevelopment.client,p=c.getLocalCharacterState().position;
  const camera=c.getCameraManager().getCameraState().position;
  return Math.abs(p.x-(${target.x+offset}))<.3&&Math.abs(p.z-(${target.z}))<.3&&camera.x>p.x+.1;
 })()`);
}
try{
 service=await createHolodeck({identityResolver:async req=>({id:req.headers.cookie?.includes('fixture_phone=1')?'human:visit-phone-fixture':'human:visit-fixture',kind:'human',rights:['observe','edit','project']}),
 contentVisits:[{id:'fixture-visit',node:'reading-room',entry:'/nexus/?table=fixture-table&report_revision=fixture-v1',descriptor:'/nexus/api/fixture-visit',pin,discoverActors:['human:visit-fixture','human:visit-phone-fixture']}],
 nativeFactory:async()=>({availability:async()=>({available:true,active:null}),submit:async(_actor,body)=>{accepted.push(structuredClone(body));const result={id:body.id,phase:'completed',retained:true,updates:[]};records.set(body.id,result);return result;},status:async(_actor,id)=>records.get(id)||{phase:'unknown'}})});
 service.app.get('/nexus/api/fixture-visit',(_req,res)=>mode==='denied'?res.status(403).json({fixture:true}):res.json({title:'Presentación de prueba',pin:mode==='wrong-pin'?{...pin,revision:'other'}:pin}));
 service.app.get('/nexus/',(_req,res)=>{loads++;res.type('html').send(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#f1eadb;color:#264440;font:18px system-ui}h1{font:32px Georgia}p{max-width:50ch}textarea{width:90%;max-width:500px;min-height:90px;font:18px system-ui}</style></head><body><h1>Un lugar para crear juntos</h1><p>Fixture de presentación, notas y conversación. No es una sesión real de Nexus.</p><textarea aria-label="Comentario de prueba">Un borrador conservado</textarea><script>
 const pin=${JSON.stringify(pin)},visitId=new URL(location).searchParams.get('holodeck_visit');
 const send=(data)=>parent.postMessage(data,location.origin);
 window.fixture={state:{recording:false,processing:false,playing:true,dirty:false},requests:[],held:[],hold:false,identity:crypto.randomUUID(),
 ready:(changed={})=>send({schema:'dm.holodeck-visit/ready-v1',visitId,pin,...changed}),
 reply:(request,changed={})=>{let result=request.method==='describe'?{capabilities:{describe:true,getContext:true,pauseAndFreeze:true,prepareClose:true},state:{...fixture.state}}:request.method==='getContext'?{state:{...fixture.state},chapterId:'chapter-fixture',source_time_ms:1234,stageWidth:document.documentElement.clientWidth}: {canClose:!fixture.state.recording&&!fixture.state.processing&&!fixture.state.dirty};if(fixture.forced!==undefined){result=fixture.forced;delete fixture.forced;}else if(request.method==='prepareClose'){if(result.canClose)fixture.state.playing=false;result.state={...fixture.state};}send({schema:'dm.holodeck-visit/response-v1',id:request.id,visitId,pin,ok:true,result,...changed});}};
 addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data.schema!=='dm.holodeck-visit/request-v1')return;fixture.requests.push(event.data);if(fixture.hold)fixture.held.push(event.data);else fixture.reply(event.data);});
 fixture.ready({pin:{...pin,revision:'spoof'}});
 </script></body></html>`);});
 server=service.app.listen(18944,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j)});
 const page=await connection(await(await fetch(origin+'/json/new?about:blank',{method:'PUT'})).json());owned.push(page);
 await page.cdp('Page.enable');await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.checkErrors=[];addEventListener("error",e=>checkErrors.push(e.message));addEventListener("unhandledrejection",e=>checkErrors.push(String(e.reason)))'});
 await page.cdp('Page.navigate',{url:'http://127.0.0.1:18944/'});await page.until('window.holodeckDevelopment?.client.getLocalCharacterState()?.position.z>5.9');
 await page.cdp('Page.bringToFront');await page.until('holodeckDevelopment.client.getLocalCharacterState().position.y>.05&&holodeckDevelopment.client.getLocalCharacterState().position.y<.2');await page.click('canvas');
 await approachReadingRoom(page,6);
 const before=await page.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 const approach={key:'w',code:'KeyW',windowsVirtualKeyCode:87};
 await page.cdp('Input.dispatchKeyEvent',{type:'keyDown',...approach});
 try{await page.until('!document.querySelector("#visit-near").hidden');}
 finally{await page.cdp('Input.dispatchKeyEvent',{type:'keyUp',...approach});}
 const after=await page.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 async function moveAfterReturn(label,direction='d'){
  const measured=await page.evaluate('({width:retainedFrame.getBoundingClientRect().width,height:retainedFrame.getBoundingClientRect().height,stageWidth:retainedFrame.contentWindow.document.documentElement.clientWidth})');
  if(measured.width<=0||measured.height<=0||measured.stageWidth<=0)throw Error('Walking frame lost measurable stage');(evidence.walkingLayout??=[]).push(measured);
  const before=await page.evaluate('({position:holodeckDevelopment.client.getLocalCharacterState().position,focus:document.activeElement.tagName})');
  const movement=direction==='a'?{key:'a',code:'KeyA',windowsVirtualKeyCode:65}:{key:'d',code:'KeyD',windowsVirtualKeyCode:68};
  await page.cdp('Input.dispatchKeyEvent',{type:'keyDown',...movement});try{await wait(400);}finally{await page.cdp('Input.dispatchKeyEvent',{type:'keyUp',...movement});}await wait(100);
  const after=await page.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
  if(Math.hypot(after.x-before.position.x,after.z-before.position.z)<.1)throw Error('World input did not resume after '+label+JSON.stringify({before,after}));
  (evidence.resumedMovement??=[]).push({label,before,after});
 }

 if(Math.hypot(after.x-before.x,after.z-before.z)<.1)throw Error('Actual WASD approach did not move '+JSON.stringify({before,after,focus:await page.evaluate('document.activeElement.tagName')}));evidence.approach={before,after};
 const label=await page.evaluate(`(()=>{const l=document.querySelector('#content-reading-room m-label');let meshes=0;l?.getContainer().traverse(o=>{if(o.isMesh&&o.material?.map)meshes++});return{content:l?.getAttribute('content'),meshes}})()`);if(!label.meshes)throw Error('Spatial label did not create textured Three geometry');evidence.label=label;if(directory){await mkdir(directory,{recursive:true});const shot=await page.cdp('Page.captureScreenshot',{format:'png'});await writeFile(directory+'/world.png',Buffer.from(shot.data,'base64'));}
 await page.click('#visit-near');await page.until('document.querySelector("#notice").textContent.includes("acceso a Nexus")');if(await page.evaluate('!!document.querySelector("#visit-stage iframe")'))throw Error('Denied descriptor opened frame');
 mode='wrong-pin';await page.click('#visit-near');await page.until('document.querySelector("#notice").textContent.includes("No pude abrir")');if(await page.evaluate('!!document.querySelector("#visit-stage iframe")'))throw Error('Wrong pin opened frame');
 mode='valid';await page.click('#visit-near');await page.until('!!document.querySelector("#visit-stage iframe")?.contentWindow.fixture');
 if(!await page.evaluate('document.querySelector("#visit-stage iframe").allowFullscreen'))throw Error('Existing viewer fullscreen not enabled');
 await wait(150);if(await page.evaluate('document.querySelector("#visit-stage iframe").contentWindow.fixture.requests.length'))throw Error('Spoofed ready started handshake');
 await page.evaluate('window.retainedFrame=document.querySelector("#visit-stage iframe");true');
 if(!await page.evaluate('document.querySelector("#visit-walk").textContent.trim()==="Volver al mundo"&&document.querySelector("#visit-end").textContent.trim()==="Cerrar contenido"'))throw Error('Return and close controls are unclear');
 async function immediateReturn(label){
  const before=await page.evaluate('({identity:retainedFrame.contentWindow.fixture.identity,state:{...retainedFrame.contentWindow.fixture.state},draft:retainedFrame.contentDocument.querySelector("textarea").value,requests:retainedFrame.contentWindow.fixture.requests.length,held:retainedFrame.contentWindow.fixture.held.length})');
  await page.evaluate('retainedFrame.contentDocument.querySelector("textarea").focus();true');
  await page.click('#visit-walk');
  const result=await page.evaluate('({walking:document.querySelector("#content-visit").classList.contains("is-walking"),sameFrame:retainedFrame===document.querySelector("#visit-stage iframe"),identity:retainedFrame.contentWindow.fixture.identity,state:{...retainedFrame.contentWindow.fixture.state},draft:retainedFrame.contentDocument.querySelector("textarea").value,requests:retainedFrame.contentWindow.fixture.requests.length,held:retainedFrame.contentWindow.fixture.held.length,focus:document.activeElement.tagName})');
  if(!result.walking||!result.sameFrame||result.identity!==before.identity||result.draft!==before.draft||JSON.stringify(result.state)!==JSON.stringify(before.state)||result.requests!==before.requests||result.held!==before.held)throw Error('Return waited for or changed the content: '+JSON.stringify({label,before,result}));
  (evidence.immediateReturns??=[]).push({label,viewerStatePreserved:true,draftPreserved:true,pendingRequestsPreserved:true,noExitRPC:true,focus:result.focus});
 }
 async function reopen(){await page.click('#visit-near');await page.until('!document.querySelector("#content-visit").classList.contains("is-walking")');if(!await page.evaluate('retainedFrame===document.querySelector("#visit-stage iframe")'))throw Error('Return recreated content');}
 await immediateReturn('missing viewer readiness');await moveAfterReturn('missing viewer readiness');await reopen();
 // A genuine handshake request can remain unanswered. Returning must neither
 // wait for it nor consume/cancel it; the same frame may answer later.
 await page.evaluate('retainedFrame.contentWindow.fixture.hold=true;retainedFrame.contentWindow.fixture.ready();true');
 await page.until('retainedFrame.contentWindow.fixture.held.length===1');
 await immediateReturn('unresponsive viewer with held describe response');await moveAfterReturn('unresponsive viewer','a');await reopen();
 await page.evaluate('retainedFrame.contentWindow.fixture.hold=false;retainedFrame.contentWindow.fixture.reply(retainedFrame.contentWindow.fixture.held.shift());true');await wait(100);
 for(const field of ['recording','processing','dirty','playing']){
  await page.evaluate(`retainedFrame.contentWindow.fixture.state={recording:false,processing:false,playing:false,dirty:false,${field}:true};true`);
  await immediateReturn(field);if(field==='recording')await moveAfterReturn('active recording');await reopen();
 }
 await page.evaluate('retainedFrame.contentWindow.fixture.state={recording:true,processing:true,playing:true,dirty:true};retainedFrame.contentWindow.fixture.forced={};true');
 await immediateReturn('all unfinished states and unknown future response');
 if(!await page.evaluate('retainedFrame.contentWindow.fixture.forced&&Object.keys(retainedFrame.contentWindow.fixture.forced).length===0'))throw Error('Returning queried an unknown viewer response');
 await reopen();await page.evaluate('delete retainedFrame.contentWindow.fixture.forced;retainedFrame.contentWindow.fixture.state={recording:false,processing:false,playing:false,dirty:false};true');
 await immediateReturn('viewer paused through its own controls');
 await page.click('#talk');
 const original='  Fixture: este contenido\ncon espacios.  ',nextDraft='Mi siguiente pregunta mientras se prepara el contexto.';
 await page.evaluate(`document.querySelector('#conversation-form').addEventListener('submit',()=>{window.submissionMoment={capturedAt:Date.now(),local:structuredClone(holodeckDevelopment.client.getLocalCharacterState())};},{capture:true,once:true});retainedFrame.contentWindow.fixture.hold=true;document.querySelector('#message').value=${JSON.stringify(original)};document.querySelector('#conversation-form').requestSubmit()`);
 await page.until('retainedFrame.contentWindow.fixture.held.length===1');
 // Context acknowledgments still require exact source/origin/request/visit/pin.
 // These checks are independent of returning, which must not request context.
 const spoofed=await page.evaluate(`(()=>{const f=retainedFrame.contentWindow,r=f.fixture.held[0],good={schema:'dm.holodeck-visit/response-v1',id:r.id,visitId:r.visitId,pin:r.pin,ok:true,result:{state:{recording:false,processing:false,playing:false,dirty:false},source_time_ms:999}};window.spoofs=[{source:window,origin:location.origin,data:good},{source:f,origin:'https://foreign.test',data:good},{source:f,origin:location.origin,data:{...good,id:'other'}},{source:f,origin:location.origin,data:{...good,visitId:'other'}},{source:f,origin:location.origin,data:{...good,pin:{...r.pin,revision:'other'}}}];return spoofs.length})()`);
 for(let i=0;i<spoofed;i++){await page.evaluate(`dispatchEvent(new MessageEvent('message',spoofs[${i}]))`);await wait(50);if(accepted.length)throw Error('Spoofed context acknowledged an interaction');}
 await page.evaluate(`document.querySelector('#message').focus();document.querySelector('#message').setSelectionRange(0,document.querySelector('#message').value.length)`);
 await page.cdp('Input.insertText',{text:nextDraft});
 if(await page.evaluate('document.querySelector("#message").value')!==nextDraft)throw Error('Controlled browser could not type the next draft');
 // Locomotion remains independent while the viewer is obtaining context. The
 // utterance must retain its original situation, rather than its later location.
 const submitted=await page.evaluate('submissionMoment');
 await page.evaluate('document.querySelector("#conversation-close").click()');await page.click('canvas');
 await page.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65});
 try{await wait(500);}finally{await page.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65});}
 const later=await page.evaluate('({capturedAt:Date.now(),local:structuredClone(holodeckDevelopment.client.getLocalCharacterState())})');
 if(Math.hypot(later.local.position.x-submitted.local.position.x,later.local.position.z-submitted.local.position.z)<.1)throw Error('Controlled browser did not move while viewer context was pending');
 await page.click('#talk');
 await page.evaluate('document.querySelector("#message").focus();document.querySelector("#message").setSelectionRange(document.querySelector("#message").value.length,document.querySelector("#message").value.length)');
 await page.evaluate('retainedFrame.contentWindow.fixture.hold=false;retainedFrame.contentWindow.fixture.reply(retainedFrame.contentWindow.fixture.held.shift())');
 const started=Date.now();while(!accepted.length&&Date.now()-started<5000)await wait(100);if(!accepted.length)throw Error('Fixture context was not captured');
 if(accepted.length!==1||accepted[0].text!==original)throw Error('Delayed viewer changed/duplicated the original input');
 if(await page.evaluate('document.querySelector("#message").value')!==nextDraft)throw Error('Delayed viewer erased the next draft');
 if(!await page.evaluate('document.activeElement===document.querySelector("#message")'))throw Error('Delayed viewer blurred a changed draft');
 evidence.delayedDraft={originalExact:true,submissions:accepted.length,nextDraftPreserved:true,focusPreserved:true};
 const captured=accepted[0].view,positionError=Math.hypot(...['x','y','z'].map(axis=>captured.local.position[axis]-submitted.local.position[axis]));
 evidence.delayedSituation={submitted,later,captured:{capturedAt:captured.capturedAt,local:captured.local},positionError,
  originalPositionPreserved:positionError<.0001,originalTimePreserved:captured.capturedAt>=submitted.capturedAt-10&&captured.capturedAt<=submitted.capturedAt+50};
 if(!evidence.delayedSituation.originalPositionPreserved||!evidence.delayedSituation.originalTimePreserved){if(directory)await writeFile(directory+'/capture-failure.json',JSON.stringify(evidence,null,2)+'\n');throw Error('Delayed viewer relabeled the utterance with its later world situation: '+JSON.stringify(evidence.delayedSituation));}
 evidence.captured=accepted[0].view.contentVisit;if(evidence.captured.context.source_time_ms!==1234||evidence.captured.pin.revision!==pin.revision||evidence.captured.context.state.playing||evidence.captured.context.stageWidth<=0)throw Error('Frozen pinned viewer context mismatched');
 await page.evaluate('document.querySelector("#conversation-close").click()');await page.click('#visit-near');
 if(directory){await mkdir(directory,{recursive:true});for(const [name,width,height,mobile]of [['desktop',1000,760,false],['mobile',390,844,true]]){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await wait(150);const bounds=await page.evaluate(`(()=>{const p=document.querySelector('#content-visit').getBoundingClientRect(),f=retainedFrame.getBoundingClientRect();return {left:p.left,right:p.right,top:p.top,bottom:p.bottom,width:innerWidth,height:innerHeight,frameHeight:f.height}})()`);if(bounds.left<0||bounds.right>width||bounds.top<0||bounds.bottom>height||bounds.frameHeight<200)throw Error('Visit layout overflow '+name);evidence[name]=bounds;const shot=await page.cdp('Page.captureScreenshot',{format:'png'});await writeFile(directory+'/'+name+'.png',Buffer.from(shot.data,'base64'));}}
 evidence.singleImmediateReturnControl=true;evidence.fullscreenAllowed=true;evidence.spoofsIgnored=spoofed;evidence.errors=await page.evaluate('checkErrors');evidence.retainedOneFrame=await page.evaluate('document.querySelectorAll("#visit-stage iframe").length===1&&retainedFrame===document.querySelector("#visit-stage iframe")');
 if(loads!==1||evidence.errors.length||!evidence.retainedOneFrame)throw Error('Desktop reload/leak/browser error');
 if(directory)await writeFile(directory+'/desktop-evidence.json',JSON.stringify(evidence,null,2)+'\n');
 // Qualify each real renderer independently: a phone does not need a second
 // software-rendered desktop world consuming its browser process concurrently.
 await page.close();owned.splice(owned.indexOf(page),1);
 const phone=await connection(await isolatedTarget());owned.push(phone);
 await phone.cdp('Page.enable');await phone.cdp('Network.enable');await phone.cdp('Network.setCookie',{name:'fixture_phone',value:'1',url:'http://127.0.0.1:18944/'});
 await phone.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await phone.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await phone.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.checkErrors=[];addEventListener("error",e=>checkErrors.push(e.message));addEventListener("unhandledrejection",e=>checkErrors.push(String(e.reason)))'});
 await phone.cdp('Page.navigate',{url:'http://127.0.0.1:18944/'});await phone.cdp('Page.bringToFront');
 await phone.until('window.holodeckDevelopment?.client.getLocalCharacterState()?.position.y>.05&&holodeckDevelopment.client.getLocalCharacterState().position.y<.2');
 await approachReadingRoom(phone,2);
 await phone.until('!document.querySelector("#visit-near").hidden');await phone.click('#visit-near',{touch:true});await phone.until('!!document.querySelector("#visit-stage iframe")?.contentWindow.fixture');
 await phone.evaluate('window.retainedFrame=document.querySelector("#visit-stage iframe");retainedFrame.contentWindow.fixture.state={recording:true,processing:true,dirty:true,playing:true};retainedFrame.contentDocument.querySelector("textarea").value="Phone draft remains";true');
 if(!await phone.evaluate('getComputedStyle(document.querySelector(".touch-controls")).visibility==="hidden"'))throw Error('World touch controls cover open content');
 await phone.click('#visit-walk',{touch:true});
 if(!await phone.evaluate('document.querySelector("#content-visit").classList.contains("is-walking")&&retainedFrame===document.querySelector("#visit-stage iframe")&&retainedFrame.contentWindow.fixture.requests.length===0'))throw Error('Phone return waited for an unready active viewer');
 if(!await phone.evaluate('getComputedStyle(document.querySelector(".touch-controls")).visibility==="visible"'))throw Error('World touch controls did not return with the world');
 const phoneBefore=await phone.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 const joystick=await phone.evaluate('(()=>{const e=document.querySelector(".touch-controls span"),r=e.getBoundingClientRect();if(r.width<40||r.height<40)throw Error("Touch joystick absent");return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await phone.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...joystick,id:2}]});await phone.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:joystick.x+40,y:joystick.y,id:2}]});
 try{await wait(500);}finally{await phone.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}await wait(100);
 const phoneAfter=await phone.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 if(Math.hypot(phoneAfter.x-phoneBefore.x,phoneAfter.z-phoneBefore.z)<.1)throw Error('Touch locomotion did not resume after immediate return');
 await phone.click('#visit-near',{touch:true});await phone.until('!document.querySelector("#content-visit").classList.contains("is-walking")');
 evidence.phone={before:phoneBefore,after:phoneAfter,emulatedTouch:true,physicalPhoneAcceptance:false};
 const phoneRetained=await phone.evaluate('({sameFrame:retainedFrame===document.querySelector("#visit-stage iframe"),draft:retainedFrame.contentDocument.querySelector("textarea").value,state:retainedFrame.contentWindow.fixture.state,requests:retainedFrame.contentWindow.fixture.requests.length,exitLabel:document.querySelector("#visit-walk").textContent.trim(),worldControlsHidden:getComputedStyle(document.querySelector(".touch-controls")).visibility==="hidden",errors:checkErrors})');
 if(!phoneRetained.sameFrame||phoneRetained.draft!=="Phone draft remains"||!Object.values(phoneRetained.state).every(Boolean)||phoneRetained.requests!==0||!phoneRetained.worldControlsHidden||phoneRetained.errors.length)throw Error('Phone return changed pending content');
 if(directory){const shot=await phone.cdp('Page.captureScreenshot',{format:'png'});await writeFile(directory+'/phone-touch.png',Buffer.from(shot.data,'base64'));}
 evidence.phone={before:phoneBefore,after:phoneAfter,...phoneRetained,emulatedTouch:true,physicalPhoneAcceptance:false};
 evidence.loads=loads;
 if(loads!==2||evidence.errors.length||!evidence.retainedOneFrame)throw Error('Reload/leak/browser error');evidence.qualification='Controlled Nexus/native fixtures; actual browser world/bridge lifecycle only, not actual Nexus/Home/human/model flow.';
 if(directory)await writeFile(directory+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await Promise.allSettled(owned.map(p=>p.close()));service?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
