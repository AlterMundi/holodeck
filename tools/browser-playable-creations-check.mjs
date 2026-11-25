// Real MML/browser and HTTP/native-wire play, with explicit local authority
// fixtures. No real human original, model/provider call or live-world mutation.
import WebSocket from 'ws';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {nearestCreationPosition} from '../src/world-layout.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const {createHolodeck}=await import(process.env.HOLODECK_SERVER_MODULE||new URL('../src/server.mjs',import.meta.url).href);
const execute=promisify(execFile),wait=ms=>new Promise(r=>setTimeout(r,ms));
const hudMode=process.env.HOLODECK_PLAYABLE_HUD==='1';
const directory=process.env.HOLODECK_EVIDENCE_DIR;if(!directory)throw Error('Select a bounded evidence directory');
const cdpOrigin='http://127.0.0.1:18943',worldOrigin='http://127.0.0.1:18944';
const stateDir=await mkdtemp(join(tmpdir(),'holodeck-playable-creations-')),socketPath=join(stateDir,'world.sock');
const being='dm:being:v1:'+'c'.repeat(43),nodeId='node-play-fixture';
const recipe={schema:'signal-garden/v1',targets:[],minContributors:2,requiredBridgeRaised:true};
const visitors=[],nativeReceipts=[],humanReceipts=[],browserActions=[],checkpoints=[];
let runtime,listener,browser,authorityReads=0,originalLookups=0;const started=Date.now();
const deadline=setTimeout(()=>{console.error('240s fixture deadline');process.exit(124)},240000);
async function connection(url){
 const ws=new WebSocket(url);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});let next=0;const pending=new Map();
 ws.on('message',raw=>{const v=JSON.parse(raw),p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result)}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},method==='Runtime.evaluate'?30000:15000);pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v)},reject:e=>{clearTimeout(t);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const v=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description||'Browser evaluation failed');return v.result.value;};
 return {ws,call,evaluate};
}
async function until(check,ms=15000,label='condition'){const start=Date.now();while(Date.now()-start<ms){if(await check())return;await wait(100)}throw Error('Timed out: '+label);}
async function visitor(who,mobile){
 console.log('Preparing controlled MML visitor '+who);
 const {browserContextId}=await browser.call('Target.createBrowserContext'),{targetId}=await browser.call('Target.createTarget',{url:'about:blank',browserContextId});
 const target=(await(await fetch(cdpOrigin+'/json/list')).json()).find(t=>t.id===targetId);if(!target)throw Error('Owned browser target unavailable');
 const value=await connection(target.webSocketDebuggerUrl),v={...value,who,mobile,browserContextId,targetId};visitors.push(v);
 await v.call('Page.enable');await v.call('Network.enable');await v.call('Network.setCookie',{name:'fixture_player',value:who,url:worldOrigin+'/'});
 await v.call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1100,height:mobile?844:800,deviceScaleFactor:1,mobile});if(mobile)await v.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await v.call('Page.addScriptToEvaluateOnNewDocument',{source:'window.fixtureErrors=[];window.pageIdentity=crypto.randomUUID();addEventListener("error",e=>{if(fixtureErrors.length<32)fixtureErrors.push(String(e.message).slice(0,500))});addEventListener("unhandledrejection",e=>{if(fixtureErrors.length<32)fixtureErrors.push(String(e.reason).slice(0,500))})'});
 await v.call('Page.navigate',{url:worldOrigin+'/'});await v.call('Page.bringToFront');
 await until(()=>v.evaluate('!!window.holodeckDevelopment?.client.getLocalCharacterState()'),45000,'MML player '+who);await until(()=>v.evaluate('holodeckDevelopment.client.getLocalCharacterState().position.y>.05&&holodeckDevelopment.client.getLocalCharacterState().position.y<.2'),20000,'settled player '+who);
 v.pageIdentity=await v.evaluate('pageIdentity');v.token=await v.evaluate('window.SESSION_TOKEN');console.log('Controlled MML visitor ready '+who);return v;
}
async function native(operation,args={}){
 const {stdout}=await execute('python3',[new URL('../integrations/world_port.py',import.meta.url).pathname,'--socket',socketPath,'--own',operation,'--json',JSON.stringify(args)],{timeout:15000,maxBuffer:131072});
 const reply=JSON.parse(stdout);if(!reply.ok||reply.authoritySource?.access!=='current-being-grant')throw Error('Native fixture refused '+stdout);nativeReceipts.push({operation,args,reply});return reply.result;
}
async function click(v,selector){
 const at=await v.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 if(v.mobile){await v.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...at,id:1}]});await v.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await v.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...at});await v.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...at});}
}
const position=v=>v.evaluate('holodeckDevelopment.client.getLocalCharacterState().position');
async function walkToPlantingSpot(v,color){
 await v.call('Page.bringToFront');
 const before=await position(v);
 const keys=[{key:'a',code:'KeyA',windowsVirtualKeyCode:65},{key:'w',code:'KeyW',windowsVirtualKeyCode:87}];
 if(v.mobile){
  const stick=await v.evaluate(`(()=>{const r=document.querySelector('.touch-controls span').getBoundingClientRect();if(r.width<100)throw Error('Missing joystick');return{x:r.x+r.width/2,y:r.y+r.height/2,id:2}})()`);
  await v.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});
  await v.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...stick,x:stick.x+39,y:stick.y-47}]});
 }else for(const key of keys)await v.call('Input.dispatchKeyEvent',{type:'keyDown',...key});
 try{
  await until(async()=>{const now=await position(v);return now.z<4.5&&Math.hypot(now.x-before.x,now.z-before.z)>1.25;},7000,'walk into the garden '+v.who);
 }finally{
  if(v.mobile)await v.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else for(const key of keys)await v.call('Input.dispatchKeyEvent',{type:'keyUp',...key});
 }
 await wait(300);
 const after=await position(v);
 browserActions.push({who:v.who,input:v.mobile?'touch joystick':'WASD',before,after});
 return {...nearestCreationPosition(after.x+1,after.z),radius:.8,color};
}
async function plantFromPreview(v,target){
 await v.call('Page.bringToFront');
 const before=runtime.room.snapshot().entities;
 await click(v,'#plant');
 await until(()=>v.evaluate('!document.querySelector("#creator").hidden'),3000,'private planting preview');
 await click(v,`[data-color="${target.color}"]`);
 if(Object.keys(runtime.room.snapshot().entities).length!==Object.keys(before).length)throw Error('Preview changed the room before confirmation');
 await click(v,'#preview-accept');
 let planted;
 await until(()=>{
  planted=Object.values(runtime.room.snapshot().entities).find(entity=>!before[entity.id]&&entity.color===target.color);
  return !!planted;
 },8500,'committed light '+v.who);
 if(Math.hypot(planted.x-target.x,planted.z-target.z)>target.radius)throw Error('Ordinary planting missed its signal target');
 browserActions.push({who:v.who,input:v.mobile?'touch':'mouse',type:'garden.place',target:planted.id,revision:planted.revision});
 return planted.id;
}
async function human(v,type,target,expectedRevision,args){
 // Each supported action uses observe+command. Respect the existing four POSTs
 // per second per session; a fixture must not create an artificial burst.
 if(v.nextActionAt>Date.now())await wait(v.nextActionAt-Date.now());v.nextActionAt=Date.now()+650;
 const id=randomUUID();
 const reply=await v.evaluate(`(async()=>{const request=async(path,body)=>{const r=await fetch('api/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(JSON.stringify({path,status:r.status,result}));return result;};const o=await request('observe',{});const command={id:${JSON.stringify(id)},issuedAt:Date.now(),run:o.run,edition:o.edition,observation:o.id,type:${JSON.stringify(type)},target:${JSON.stringify(target)},expectedRevision:${JSON.stringify(expectedRevision)},args:${JSON.stringify(args)}};return {actor:o.observer,command,result:await request('commands',command)}})()`);
 if(reply.actor!=='human:play-fixture-'+v.who||reply.result.status!=='completed')throw Error('Authorized fixture action failed '+JSON.stringify(reply));humanReceipts.push(reply);return reply;
}
async function checkpoint(label,expected){
 const states=[];
 for(const v of visitors){
  await until(()=>v.evaluate(`fetch('api/state').then(r=>r.json()).then(s=>{const p=s.nodes[${JSON.stringify(nodeId)}]?.progress;return p&&${JSON.stringify(expected)}&&Object.entries(${JSON.stringify(expected)}).every(([k,value])=>p[k]===value)})`),10000,'derived progress '+label+' '+v.who);
  states.push(await v.evaluate('fetch("api/state").then(r=>r.json())'));
 }
 const p=states[0].nodes[nodeId].progress;
 if(JSON.stringify(states[1].nodes[nodeId].progress)!==JSON.stringify(p)||states.some(s=>s.nodes[nodeId].revision!==1||s.nodes[nodeId].progress.definitionRevision!==1||s.nodes[nodeId].progress.through!==s.sequence))throw Error('Two actors disagree on canonical derived progress');
 const geometry=[];
 for(const v of visitors){
  await v.call('Page.bringToFront');
  await until(()=>v.evaluate(`(()=>{const root=document.querySelector('#${nodeId}'),state=${JSON.stringify(states[0].nodes[nodeId])};return root?.getAttribute('data-play-schema')==='signal-garden/v1'&&root.getAttribute('data-play-complete')===String(state.progress.complete)&&state.progress.targets.every(t=>document.querySelector('#play-${nodeId}-target-'+t.index)?.getAttribute('data-play-filled')===String(t.entity!==null))&&[...root.querySelectorAll('m-label')].some(e=>e.getAttribute('content')===state.title)})()`),20000,'projected play '+label+' '+v.who);
  const record=await v.evaluate(`(()=>{const node=document.querySelector('#${nodeId}'),scene=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group,live=e=>{if(!e?.isConnected)return false;for(let p=e.getContainer();p;p=p.parent)if(p===scene)return true;return false;},meshCount=e=>{let n=0;e.getContainer().traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position?.count)n++});return n;},textured=e=>{let n=0;e.getContainer().traverse(o=>{if(o.isMesh&&o.material?.map)n++});return n;};const title=[...node.querySelectorAll('m-label')].find(e=>e.getAttribute('content')==='Jardín de señales');return {complete:node.getAttribute('data-play-complete'),nodeAttached:live(node),nodeMeshes:meshCount(node),title:{text:title?.getAttribute('content'),attached:live(title),textures:title?textured(title):0},targets:[0,1].map(index=>{const e=document.querySelector('#play-${nodeId}-target-'+index),c=e.querySelector('m-cylinder'),mesh=c.getContainer().children.find(o=>o.isMesh);return{index,filled:e.getAttribute('data-play-filled'),attached:live(e),meshes:meshCount(e),color:c.getAttribute('color'),opacity:Number(c.getAttribute('opacity')),materialOpacity:mesh?.material.opacity,sign:{text:e.querySelector('m-label')?.getAttribute('content'),attached:live(e.querySelector('m-label')),textures:e.querySelector('m-label')?textured(e.querySelector('m-label')):0}}})}})()`);
  if(!record.nodeAttached||record.nodeMeshes<3||!record.title.attached||!record.title.textures||record.title.text!=='Jardín de señales'||record.targets.some(t=>!t.attached||!t.meshes||!t.sign.attached||!t.sign.textures||t.sign.text!==`${t.index+1} · ${['menta','ámbar'][t.index]}${t.filled==='true'?' · lista':''}`||t.color.toLowerCase()!==['#8ce4c2','#efc87a'][t.index]||Math.abs(t.opacity-(t.filled==='true'?.65:.22))>.0001||Math.abs(t.opacity-t.materialOpacity)>.0001))throw Error('Playable definition lacks attached rendered geometry '+JSON.stringify(record));
   await until(()=>v.evaluate(`(()=>{const e=document.querySelector('#play-near');return e&&!e.hidden&&getComputedStyle(e).display!=='none'&&document.querySelector('#play-title').textContent==='Jardín de señales'&&document.querySelector('#play-progress').textContent===${JSON.stringify(states[0].nodes[nodeId].status)}&&document.querySelector('#play-instruction').textContent===${JSON.stringify(states[0].nodes[nodeId].instruction)}})()`),10000,'authoritative readable HUD '+label+' '+v.who);
  if(hudMode){
   if(await v.evaluate('document.querySelector("#play-near").open'))await click(v,'#play-near summary');
   const collapsed=await v.evaluate('(()=>{const e=document.querySelector("#play-progress"),r=e.getBoundingClientRect();return{visible:r.width>0&&r.height>0,text:e.textContent}})()');if(!collapsed.visible)throw Error('Collapsed game HUD hides progress');
   await click(v,'#play-near summary');await until(()=>v.evaluate('document.querySelector("#play-near").open'),1000,'expanded instructions');
   record.hud=await v.evaluate('(()=>{const root=document.querySelector("#play-near"),p=document.querySelector("#play-instruction"),r=p.getBoundingClientRect(),b=root.getBoundingClientRect();const points=[[r.left+2,r.top+2],[r.right-2,r.bottom-2],[(r.left+r.right)/2,(r.top+r.bottom)/2]];return{open:root.open,title:document.querySelector("#play-title").textContent,status:document.querySelector("#play-progress").textContent,instruction:p.textContent,bounds:{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:innerWidth,height:innerHeight},textBounds:{width:r.width,height:r.height},unobscured:points.every(([x,y])=>root.contains(document.elementFromPoint(x,y)))}})()');
   const h=record.hud;if(!h.open||!h.unobscured||h.bounds.left<0||h.bounds.right>h.bounds.width||h.bounds.top<0||h.bounds.bottom>h.bounds.height||h.textBounds.height<15)throw Error('Game instructions are clipped or obscured '+JSON.stringify(h));record.hud.collapsedStatus=collapsed;
  }
  geometry.push({who:v.who,record});
 }
 checkpoints.push({label,progress:p,status:states[0].nodes[nodeId].status,instruction:states[0].nodes[nodeId].instruction,sequence:states[0].sequence,geometry});return states;
}
try{
 await mkdir(directory,{recursive:true});
 runtime=await createHolodeck({lightExercise:true,stateDir,publicOrigin:worldOrigin,galleryAuthorization:async()=>false,ownNative:true,worldSocket:socketPath,worldSocketBeingRef:being,
  identityResolver:async req=>{const who=req.headers.cookie?.match(/(?:^|; )fixture_player=([ab])(?:;|$)/)?.[1];return who?{id:'human:play-fixture-'+who,ref:'human:play-fixture-'+who,kind:'human',rights:['observe','edit','project']}:null;},
  nativeRoomAuthority:async verified=>{authorityReads++;if(verified.actor?.ref!==being)throw Error('Wrong synthetic receiving actor');return ['observe','edit','project'];},
  nativeFactory:async()=>({availability:async()=>({available:false}),authorizeWorldRequest:async()=>{originalLookups++;throw Error('Own native creation must not require a human original');}})});
 listener=runtime.app.listen(18944,'127.0.0.1');await new Promise((r,j)=>{listener.once('listening',r);listener.once('error',j)});
 const metadata=await(await fetch(cdpOrigin+'/json/version')).json();browser=await connection(metadata.webSocketDebuggerUrl);
 const a=await visitor('a',false),b=await visitor('b',true);
 await until(async()=>await a.evaluate('holodeckDevelopment.client.getCharacterStates().size===2')&&await b.evaluate('holodeckDevelopment.client.getCharacterStates().size===2'),20000,'two independent MML participants');
 recipe.targets.push(await walkToPlantingSpot(a,'mint'),await walkToPlantingSpot(b,'amber'));
 const observation=await native('observe'),definition={id:randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type:'node.place',target:nodeId,expectedRevision:null,args:{title:'Jardín de señales',shape:'pedestal',position:{x:0,z:1},play:recipe,links:[]}};
 const created=await native('act',definition);if(created.status!=='completed')throw Error('Play definition refused '+JSON.stringify(created));
 await checkpoint('new definition',{complete:false,filledTargets:0,contributors:0,bridgeReady:false});
 const firstLight=await plantFromPreview(a,recipe.targets[0]);if(!hudMode)await checkpoint('first contributor',{complete:false,filledTargets:1,contributors:1,bridgeReady:false});
 const secondLight=await plantFromPreview(b,recipe.targets[1]);if(!hudMode)await checkpoint('two targets need bridge',{complete:false,filledTargets:2,contributors:2,bridgeReady:false});
 await b.call('Page.bringToFront');await click(b,'#bridge');
 await checkpoint('completed together',{complete:true,filledTargets:2,contributors:2,bridgeReady:true});
 browserActions.push({who:b.who,input:'touch',type:'bridge.set',target:'bridge',revision:runtime.room.snapshot().entities.bridge.revision});
 const first=runtime.room.snapshot().entities[firstLight];
 await human(a,'garden.update',firstLight,1,{x:first.x,z:first.z,color:'violet'});await checkpoint('light edit invalidates completion',{complete:false,filledTargets:1,contributors:1,bridgeReady:true});
 await human(a,'garden.update',firstLight,2,{x:first.x,z:first.z,color:'mint'});await checkpoint('light restoration completes again',{complete:true,filledTargets:2,contributors:2,bridgeReady:true});
 let finalStates;if(!hudMode){await human(b,'bridge.set','bridge',1,{raised:false});await checkpoint('bridge edit invalidates completion',{complete:false,filledTargets:2,contributors:2,bridgeReady:false});await human(b,'bridge.set','bridge',2,{raised:true});finalStates=await checkpoint('bridge restoration completes again',{complete:true,filledTargets:2,contributors:2,bridgeReady:true});}else finalStates=await Promise.all(visitors.map(v=>v.evaluate('fetch("api/state").then(r=>r.json())')));
 const nativeView=await native('observe');if(JSON.stringify(nativeView.nodes[nodeId].progress)!==JSON.stringify(finalStates[0].nodes[nodeId].progress))throw Error('Native and human derived progress differ');
 const editors=runtime.room.snapshot().entityEditors;if(editors[firstLight]?.actorRef!=='human:play-fixture-a'||editors[secondLight]?.actorRef!=='human:play-fixture-b'||editors.bridge?.actorRef!=='human:play-fixture-b')throw Error('Contributors were not derived from actual authenticated actors');
 const overlayChecks=[];
 if(hudMode){
  await a.call('Page.bringToFront');
  for(const [open,close,label]of [['#plant','#preview-cancel','creator'],['#talk','#conversation-close','conversation']]){
   await click(a,open);if(!await a.evaluate('getComputedStyle(document.querySelector("#play-near")).display==="none"'))throw Error('Game HUD overlaps '+label);
   await click(a,close);await until(()=>a.evaluate('getComputedStyle(document.querySelector("#play-near")).display!=="none"&&!document.querySelector("#play-near").hidden'),1000,'game HUD restored after '+label);overlayChecks.push({label,hiddenWhileOpen:true,restored:true});
  }
 }
 for(const v of visitors){if(await v.evaluate('pageIdentity')!==v.pageIdentity||await v.evaluate('window.SESSION_TOKEN')!==v.token)throw Error('Play required a page reload');await v.call('Page.bringToFront');await wait(250);const shot=await v.call('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,v.mobile?'phone.png':'desktop.png'),Buffer.from(shot.data,'base64'));}
 const errors=await Promise.all(visitors.map(v=>v.evaluate('fixtureErrors')));if(originalLookups||errors.some(e=>e.length))throw Error('Unexpected human-original lookup or browser error');
 const evidence={schema:'holodeck.playable-creations-browser/v1',qualification:'Two independent MML contexts; ordinary desktop and emulated phone play; supported HTTP commands for edit and reversal. Identities/grants are local fixtures; the native definition uses the real private --own wire. No human, physical phone, model/provider or live-world effect.',independentActors:2,nativeDefinitionCommands:1,humanCommands:humanReceipts.length+3,authorityReads,humanOriginalLookups:originalLookups,definition,created,recipe,nativeReceipts,humanReceipts,browserActions,checkpoints,entityEditors:editors,nativeProgress:nativeView.nodes[nodeId].progress,hudMode,overlayChecks,errors,pageReloads:false,elapsedMs:Date.now()-started};
 await writeFile(join(directory,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({passed:true,checkpoints:checkpoints.length,humanCommands:evidence.humanCommands,actors:2,completeReversible:true,elapsedMs:evidence.elapsedMs}));
}catch(error){
 const diagnostics=[];for(const v of visitors)diagnostics.push({who:v.who,value:await v.evaluate('({body:document.body.innerText.slice(-1000),errors:window.fixtureErrors,local:window.holodeckDevelopment?.client.getLocalCharacterState(),labels:[...document.querySelectorAll("m-label")].map(e=>e.getAttribute("content")).slice(-12)})').catch(e=>({error:e.message}))});
 await writeFile(join(directory,'failure.json'),JSON.stringify({error:error.message,diagnostics,nativeReceipts,humanReceipts,checkpoints},null,2));console.error(JSON.stringify(diagnostics));throw error;
}finally{
 clearTimeout(deadline);for(const v of visitors){v.ws.close();await browser?.call('Target.disposeBrowserContext',{browserContextId:v.browserContextId}).catch(()=>{});}browser?.ws.close();runtime?.close();if(listener){listener.closeAllConnections();await new Promise(r=>listener.close(r));}await rm(stateDir,{recursive:true,force:true});
 await writeFile(join(directory,'worker-cleanup.json'),JSON.stringify({contextsDisposed:visitors.length,stateRemoved:true,temporarySocketRemoved:true,deadlineSeconds:240,logBoundBytes:2097152}));
}
