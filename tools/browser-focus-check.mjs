import WebSocket from 'ws';
import {createHolodeck} from '../src/server.mjs';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {PerspectiveCamera,Vector3} from 'three';
import {createNativeConversation} from '../src/native-conversation.mjs';
import {DaimonPort} from '../src/daimon-port.mjs';
import {writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:18943',wait=ms=>new Promise(r=>setTimeout(r,ms));
async function connection(target){
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});let next=0;const pending=new Map();
 ws.on('message',raw=>{const m=JSON.parse(raw);if(pending.has(m.id)){const t=pending.get(m.id);pending.delete(m.id);m.error?t.j(Error(m.error.message)):t.r(m.result)}});
 function cdp(method,params={}){return new Promise((r,j)=>{const id=++next,t=setTimeout(()=>{pending.delete(id);j(Error('Timed out: '+method))},20000);pending.set(id,{r:v=>{clearTimeout(t);r(v)},j:e=>{clearTimeout(t);j(e)}});ws.send(JSON.stringify({id,method,params}))})}
 async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Evaluation error');return r.result.value}
 async function until(expression,ms=10000){const begin=Date.now();while(Date.now()-begin<ms){if(await evaluate(expression))return;await wait(100)}throw Error('Condition failed: '+expression)}
 async function click(selector){const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});}
 return {target,cdp,evaluate,until,click,detach(){ws.close();},async close(){ws.close();await fetch(origin+'/json/close/'+target.id)}};
}
// Finite loopback UI/native-transport fixture. No real original/model/peer calls.
// Needs an explicitly started isolated Chromium CDP18943 and built client.
const owned=[],contexts=[],calls=[],evidence={},directory=process.env.HOLODECK_EVIDENCE_DIR;
const pairedBeing='dm:being:v1:'+'q'.repeat(43),native={id:pairedBeing,ref:pairedBeing,kind:'daimon',name:'Fixture nativo',rights:['observe','edit','project']};
let browser,service,server,stateDir;
const frozen=ref=>({actorRef:ref,beingRef:pairedBeing,homeRef:'home:controlled-fixture',pairingRevision:'controlled-fixture',binding:'a'.repeat(64),entry:[1,{chat_id:1,thread_id:1},1,'fixture-native']});
const action=(room,actor,type,target,args,expectedRevision)=>{const observation=room.observe(actor);return room.command(actor,{id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observation.id,type,target,args,expectedRevision,...(actor.kind==='daimon'?{nativeRequest:'controlled-native-indication'}:{})});};
async function screenPoint(page,id){
 const value=await page.evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),g=e.getContainer(),r=[...document.querySelectorAll('canvas')].find(c=>{const r=c.getBoundingClientRect();return r.width>100&&r.height>100&&r.left>=0&&r.top>=0}).getBoundingClientRect();return{position:g.getWorldPosition(g.position.clone()).toArray(),camera:holodeckDevelopment.client.getCameraManager().getCameraState(),rect:{left:r.left,top:r.top,width:r.width,height:r.height}}})()`);
 const c=value.camera,camera=new PerspectiveCamera(c.fov,c.aspect,.01,200);camera.position.set(c.position.x,c.position.y,c.position.z);camera.quaternion.set(c.rotation.x,c.rotation.y,c.rotation.z,c.rotation.w);camera.updateMatrixWorld(true);
 const p=new Vector3(...value.position).project(camera),x=value.rect.left+(p.x+1)*value.rect.width/2,y=value.rect.top+(1-p.y)*value.rect.height/2;
 if(x<5||y<5||x>value.rect.width-5||y>value.rect.height-5)throw Error('Fixture target outside actual camera viewport '+id+' '+JSON.stringify({x,y,...value}));return {x,y};
}
async function mouse(page,point){await page.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await page.cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await page.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
async function touch(page,point,drag=null){await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1,radiusX:1,radiusY:1,force:1}]});if(drag)await page.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...drag,id:1,radiusX:1,radiusY:1,force:1}]});await wait(drag?400:40);await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
async function settled(page){await page.until('!!holodeckDevelopment.appliedGeometry()');await wait(180);}
try{
 stateDir=await mkdtemp(join(tmpdir(),'holodeck-pointing-'));
 service=await createHolodeck({stateDir,identityResolver:async req=>{
  const slot=req.headers.cookie?.match(/(?:^|; )fixture_human=([ab])(?:;|$)/)?.[1];
  return slot?{id:'human:point-'+slot,ref:'human:point-'+slot,kind:'human',name:'Prueba '+slot.toUpperCase(),rights:['observe','edit','project']}:null;
 },nativeFactory:async({room})=>createNativeConversation({room,stateDir,transport:{inspect:async ref=>frozen(ref),lookup:async({actorRef})=>({state:'absent',frozen:frozen(actorRef)}),submit:async value=>{calls.push(structuredClone(value));return {phase:'completed',tracking:false,retainedOriginal:true,nativeAcceptance:'observed'};},status:async()=>({phase:'completed',tracking:false,retainedOriginal:true,nativeAcceptance:'observed',updates:[]})}})});
 const author={id:'human:fixture-author',kind:'human',rights:['observe','edit']};
 action(service.room,author,'garden.place','garden-alpha',{x:-1.3,z:3.8,color:'mint'},null);action(service.room,author,'garden.place','garden-beta',{x:1.3,z:3.8,color:'amber'},null);
 const port=new DaimonPort(service.room,async()=>native);
 service.app.post('/fixture/native-indicate',async(_req,res)=>{const observation=await port.observe(null);res.json(await port.act(null,{id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,nativeRequest:'controlled-native-indication',type:'focus.set',target:'garden-alpha',expectedRevision:observation.entities['garden-alpha'].revision,args:{}}));});
 service.app.post('/fixture/revise',(_req,res)=>res.json(action(service.room,author,'garden.update','garden-alpha',{x:-1.8,z:3.8,color:'violet'},1)));
 server=service.app.listen(18944,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 // Distinct loopback host cookies keep two fixture actors independent without
 // extra browser contexts or touching any managed/authenticated browser.
 for(const [i,slot]of ['a','b'].entries()){
  const page=await connection(await(await fetch(origin+'/json/new?about:blank',{method:'PUT'})).json());owned.push(page);
  await page.cdp('Page.enable');await page.cdp('Network.enable');await page.cdp('Network.setCookie',{name:'fixture_human',value:slot,url:i?'http://localhost:18944/':'http://127.0.0.1:18944/'});
  await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.checkErrors=[];addEventListener("error",e=>checkErrors.push(e.message));addEventListener("unhandledrejection",e=>checkErrors.push(String(e.reason)))'});
  if(i){await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true});}
  await page.cdp('Page.navigate',{url:i?'http://localhost:18944/':'http://127.0.0.1:18944/'});await page.until('!!window.holodeckDevelopment?.appliedGeometry()&&holodeckDevelopment.client.getLocalCharacterState()?.position.z>5.9&&holodeckDevelopment.client.getCameraManager().getCameraState().position.z>6');await wait(500);await settled(page);
 }
 const [a,b]=owned;await a.cdp('Page.bringToFront');await settled(a);
 await mouse(a,await screenPoint(a,'garden-alpha-light'));await a.until('!document.querySelector("#pointing").hidden&&!document.querySelector("#point-send").hidden');
 if(service.room.focusState().length)throw Error('Picking automatically shared an indication');
 await a.click('#point-send');await a.until('document.querySelector("#point-label").textContent.includes("Compartiste")');
 if(service.room.focusState()[0]?.target!=='garden-alpha')throw Error('Human click selected wrong canonical object');
 await b.cdp('Page.bringToFront');await b.until('!!document.querySelector("[data-focus-target=garden-alpha]")');
 await fetch('http://127.0.0.1:18944/fixture/native-indicate',{method:'POST'});
 await a.cdp('Page.bringToFront');await a.until('document.querySelector("[data-focus-target=garden-alpha] m-label")?.getAttribute("content")==="2 indicaciones"');await settled(a);
 await mouse(a,await screenPoint(a,'garden-beta-light'));await a.until('!document.querySelector("#point-send").hidden');
 await mouse(a,await screenPoint(a,'garden-alpha-light'));await a.until('document.querySelector("#point-send").hidden');
 evidence.cueDoesNotBlockPicking=true;
 await a.click('#talk');await a.evaluate('document.querySelector("#message").focus()');
 const beforeTyping=await a.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 for(const key of ['w','a','s','d']){await a.cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:'Key'+key.toUpperCase(),windowsVirtualKeyCode:key.toUpperCase().charCodeAt(0),text:key});await a.cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:'Key'+key.toUpperCase(),windowsVirtualKeyCode:key.toUpperCase().charCodeAt(0)});}
 await wait(200);const typing=await a.evaluate('({text:document.querySelector("#message").value,position:holodeckDevelopment.client.getLocalCharacterState().position})');
 if(typing.text!=='wasd'||Math.hypot(typing.position.x-beforeTyping.x,typing.position.z-beforeTyping.z)>.1)throw Error('Typing moved the world or lost draft');
 await a.click('#conversation-close');await a.click('#talk');if(await a.evaluate('document.querySelector("#message").value')!=='wasd')throw Error('Draft was not preserved');await a.click('#conversation-close');
 await b.cdp('Page.bringToFront');await settled(b);
 const beta=await screenPoint(b,'garden-beta-light');await touch(b,beta,{x:beta.x-45,y:beta.y+25});await wait(200);
 if(!await b.evaluate('document.querySelector("#pointing").hidden')||service.room.focusState().some(f=>f.actor==='human:point-b'))throw Error('Camera drag selected/shared an indication');
 await b.evaluate('window.focusFixtureReloading=true');await b.cdp('Page.reload');await b.until('!window.focusFixtureReloading&&!!window.holodeckDevelopment?.appliedGeometry()&&holodeckDevelopment.client.getLocalCharacterState()?.position.z>5.9&&holodeckDevelopment.client.getCameraManager().getCameraState().position.z>6');await settled(b);
 // Joystick lives outside the renderer canvas; its gesture must not pick.
 const joystick=await b.evaluate(`(()=>{const host=document.querySelector('.touch-controls');const elements=[...host.querySelectorAll('span')];const e=elements.find(e=>{const r=e.getBoundingClientRect();return r.width===116&&r.height===116});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 if(!joystick)throw Error('Actual standard touch joystick not found');
 const beforeStick=await b.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 await b.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...joystick,id:1,radiusX:1,radiusY:1,force:1}]});await b.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:joystick.x,y:joystick.y+40,id:1,radiusX:1,radiusY:1,force:1}]});try{await b.until(`Math.hypot(holodeckDevelopment.client.getLocalCharacterState().position.x-${beforeStick.x},holodeckDevelopment.client.getLocalCharacterState().position.z-${beforeStick.z})>.15`,4000);}finally{await b.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}await wait(150);
 const afterStick=await b.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');if(Math.hypot(afterStick.x-beforeStick.x,afterStick.z-beforeStick.z)<.1||!await b.evaluate('document.querySelector("#pointing").hidden'))throw Error('Joystick movement interfered with pointing');evidence.joystick={before:beforeStick,after:afterStick};
 await settled(b);await touch(b,await screenPoint(b,'garden-beta-light'));await b.until('!document.querySelector("#point-send").hidden');if(service.room.focusState().some(f=>f.actor==='human:point-b'))throw Error('Touch selection shared without confirmation');await touch(b,await b.evaluate(`(()=>{const r=document.querySelector('#point-send').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`));await b.until('document.querySelector("#point-label").textContent.includes("Compartiste")');
 if(service.room.focusState().find(f=>f.actor==='human:point-b')?.target!=='garden-beta')throw Error('Touch selected wrong canonical target');
 await a.cdp('Page.bringToFront');await a.click('#talk');await a.evaluate('document.querySelector("#message").value="  Esta luz compartida.  ";document.querySelector("#conversation-form").requestSubmit()');
 const started=Date.now();while(!calls.length&&Date.now()-started<8000)await wait(100);if(calls.length!==1)throw Error('Native fixture original did not arrive once');
 const captured=calls[0].observation;if(calls[0].input.text!=='  Esta luz compartida.  ')throw Error('Human original was changed');
 for(const actor of ['human:point-a',pairedBeing])if(!captured.focus.some(f=>f.actor===actor&&f.target==='garden-alpha'&&f.revision===1&&f.status==='current'))throw Error('Native context lost exact speaker/pair reference');
 await a.click('#conversation-close');
 const walkStart=await a.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
 await a.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65});try{await a.until(`Math.hypot(holodeckDevelopment.client.getLocalCharacterState().position.x-${walkStart.x},holodeckDevelopment.client.getLocalCharacterState().position.z-${walkStart.z})>.15`,4000);}finally{await a.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65});}evidence.walkAfterIndicating=true;
 if(directory){await mkdir(directory,{recursive:true});for(const [name,page]of [['desktop',a],['mobile',b]]){await page.cdp('Page.bringToFront');await wait(150);const shot=await page.cdp('Page.captureScreenshot',{format:'png'});await writeFile(directory+'/'+name+'.png',Buffer.from(shot.data,'base64'));}}
 await fetch('http://127.0.0.1:18944/fixture/revise',{method:'POST'});await a.cdp('Page.bringToFront');await a.until('document.querySelector("#point-label").textContent.includes("cambió")');await a.until('!document.querySelector("[data-focus-target=garden-alpha]")');
 if(service.room.focusState().filter(f=>f.target==='garden-alpha').some(f=>f.status!=='revised'||f.revision!==1||f.currentRevision!==2)||captured.focus.some(f=>f.target==='garden-alpha'&&f.status!=='current'))throw Error('Revised statement retargeted or changed frozen source');
 await a.click('#point-clear');await a.until('document.querySelector("#pointing").hidden');if(service.room.focusState().some(f=>f.actor==='human:point-a')||!service.room.focusState().some(f=>f.actor===pairedBeing))throw Error('Clear erased another actor');
 evidence.focus=service.room.focusState().map(({actor,target,revision,currentRevision,status})=>({actor:actor===pairedBeing?'fixture-native':actor,target,revision,currentRevision,status}));
 evidence.capture={bytes:Buffer.byteLength(JSON.stringify(captured)),focusCount:captured.focus.length,exactOriginal:true,exactSpeakerPairRefs:true};evidence.errors=[];for(const p of owned)evidence.errors.push(...await p.evaluate('checkErrors'));if(evidence.errors.length)throw Error('Browser JavaScript error');
 evidence.qualification='Actual isolated desktop/mobile MML/Three pointer picking, shared canonical refs and server-frozen native context through controlled transport; no real human/native model participation.';
 if(directory)await writeFile(directory+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await Promise.allSettled(owned.map(p=>p.close()));for(const id of contexts)await browser?.cdp('Target.disposeBrowserContext',{browserContextId:id}).catch(()=>{});browser?.detach();service?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(stateDir)await rm(stateDir,{recursive:true,force:true});}
