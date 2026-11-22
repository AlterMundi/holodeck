// Dynamic authored entrances through the real private native wire and browser
// consumers. Home/Nexus authority is an explicit local fixture, never real access.
import WebSocket from 'ws';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const {createHolodeck}=await import(process.env.HOLODECK_SERVER_MODULE||new URL('../src/server.mjs',import.meta.url).href);
const run=promisify(execFile),wait=ms=>new Promise(r=>setTimeout(r,ms)),digest=v=>createHash('sha256').update(v).digest('hex');
const cdpOrigin='http://127.0.0.1:18943',httpOrigin='http://127.0.0.1:18944',directory=process.env.HOLODECK_EVIDENCE_DIR;
if(!directory)throw Error('Select a bounded evidence directory');
const stateDir=await mkdtemp(join(tmpdir(),'holodeck-runtime-creations-')),socketPath=join(stateDir,'world.sock');
const being='dm:being:v1:'+'c'.repeat(43),firstId='node-first-creation',secondId='node-linked-creation';
const firstPin={tableId:'controlled-first',reportId:'first-report',revision:'r1'},nextPin={...firstPin,tableId:'controlled-first-r2',revision:'r2'},secondPin={tableId:'controlled-restricted',reportId:'restricted-report',revision:'r1'};
const pins=[firstPin,nextPin,secondPin],nativeReceipts=[],viewerLoads=[],descriptorReads=[],visitors=[];
let runtime,listener,browser,originalLookups=0,authorityReads=0;const started=Date.now();
const timeout=setTimeout(()=>{console.error('240s fixture deadline');process.exit(124)},240000);
async function connection(url){
 const ws=new WebSocket(url);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});let next=0;const pending=new Map();
 ws.on('message',raw=>{const v=JSON.parse(raw),p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result)}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},15000);pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v)},reject:e=>{clearTimeout(t);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const v=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description||'Browser evaluation failed');return v.result.value;};
 return {ws,call,evaluate};
}
async function until(check,ms=15000,label='condition'){const start=Date.now();while(Date.now()-start<ms){if(await check())return;await wait(120)}throw Error('Timed out: '+label);}
async function visitor(who,{mobile=false}={}){
 const {browserContextId}=await browser.call('Target.createBrowserContext'),{targetId}=await browser.call('Target.createTarget',{url:'about:blank',browserContextId});
 const target=(await(await fetch(cdpOrigin+'/json/list')).json()).find(t=>t.id===targetId);if(!target)throw Error('Owned browser target unavailable');
 const client=await connection(target.webSocketDebuggerUrl),v={...client,who,browserContextId,targetId,mobile};visitors.push(v);
 await client.call('Page.enable');await client.call('Network.enable');await client.call('Network.setCookie',{name:'fixture_visitor',value:who,url:httpOrigin+'/'});
 await client.call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1100,height:mobile?844:800,deviceScaleFactor:1,mobile});
 if(mobile)await client.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await client.call('Page.addScriptToEvaluateOnNewDocument',{source:'window.fixtureErrors=[];window.pageIdentity=crypto.randomUUID();addEventListener("error",e=>{if(fixtureErrors.length<32)fixtureErrors.push(String(e.message).slice(0,500))});addEventListener("unhandledrejection",e=>{if(fixtureErrors.length<32)fixtureErrors.push(String(e.reason).slice(0,500))})'});
 await client.call('Page.navigate',{url:httpOrigin+'/'});await client.call('Page.bringToFront');
 await until(()=>client.evaluate('!!window.holodeckDevelopment?.client.getLocalCharacterState()'),45000,'actual MML visitor '+who);
 await until(()=>client.evaluate('holodeckDevelopment.client.getLocalCharacterState().position.y>.05&&holodeckDevelopment.client.getLocalCharacterState().position.y<.2'),20000,'settled visitor '+who);
 v.pageIdentity=await client.evaluate('pageIdentity');v.token=await client.evaluate('window.SESSION_TOKEN');return v;
}
async function native(operation,args={}){
 const {stdout}=await run('python3',[new URL('../integrations/world_port.py',import.meta.url).pathname,'--socket',socketPath,'--own',operation,'--json',JSON.stringify(args)],{timeout:15000,maxBuffer:131072});
 const value=JSON.parse(stdout);if(!value.ok||value.authoritySource?.identity!=='receiving-lane'||value.authoritySource?.access!=='current-being-grant')throw Error('Native operation refused: '+stdout);
 nativeReceipts.push({operation,args:structuredClone(args),result:value});return value.result;
}
async function act(type,target,expectedRevision,args){
 const observation=await native('observe'),id=randomUUID(),request={id,issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type,target,expectedRevision,args};
 const outcome=await native('act',request);if(outcome.status!=='completed')throw Error('Native creation failed '+JSON.stringify(outcome));return {request,outcome};
}
const who=req=>req.headers.cookie?.match(/(?:^|; )fixture_visitor=([ab])(?:;|$)/)?.[1];
const selected=(table,revision)=>pins.find(p=>p.tableId===table&&p.revision===revision);
const nodeArgs=(title,shape,position,pin,links=[])=>({title,shape,position,result:{pin},links});
const state=async v=>v.evaluate('fetch("api/state").then(r=>r.json())');
const catalog=async v=>v.evaluate('fetch("api/content-visits").then(r=>r.json()).then(v=>v.visits)');
async function geometry(v,{firstRevision,secondRevision,firstTitle,link}){
 await v.call('Page.bringToFront');
 await until(()=>v.evaluate(`(()=>{const a=document.querySelector('#${firstId}'),b=document.querySelector('#${secondId}');return a?.getAttribute('data-content-revision')==='${firstRevision}'&&b?.getAttribute('data-content-revision')==='${secondRevision}'&&a.querySelector('m-label')?.getAttribute('content')===${JSON.stringify(firstTitle)}&&${link?'!!':'!'}document.querySelector('[data-content-link="${secondId}:${firstId}"]')})()`),20000,'matching node geometry '+v.who);
 return v.evaluate(`(()=>{const result={};for(const id of ${JSON.stringify([firstId,secondId])}){const e=document.querySelector('#'+id),container=e.getContainer(),label=e.querySelector('m-label');let meshes=0,textures=0;container.traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position?.count)meshes++});label.getContainer().traverse(o=>{if(o.isMesh&&o.material?.map)textures++});let attached=false;for(let o=container;o;o=o.parent)if(o===holodeckDevelopment.client.getRenderer().mmlCompositionScene.group)attached=true;result[id]={revision:Number(e.getAttribute('data-content-revision')),selection:e.getAttribute('data-result-selection'),node:e.getAttribute('data-content-node'),label:label.getAttribute('content'),meshes,labelTextures:textures,attached};}const line=document.querySelector('[data-content-link="${secondId}:${firstId}"]');result.link={present:!!line,geometry:!!line?.getContainer().children.some(o=>o.isMesh&&o.geometry?.attributes?.position?.count)};return result})()`);
}
function assertGeometry(g,link){for(const id of [firstId,secondId])if(!g[id].attached||g[id].meshes<3||g[id].labelTextures<1||g[id].node!==id)throw Error('Declared node is not attached real geometry '+JSON.stringify(g));if(g.link.present!==link||(link&&!g.link.geometry))throw Error('Declared link is not rendered correctly');}
async function choose(v,id){
 await v.evaluate(`(()=>{const e=document.querySelector('#content-visit select');if(!e)throw Error('Dynamic content choices missing');e.value=${JSON.stringify(id)};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
}
try{
 await mkdir(directory,{recursive:true});
 runtime=await createHolodeck({stateDir,publicOrigin:httpOrigin,ownNative:true,worldSocket:socketPath,worldSocketBeingRef:being,
  identityResolver:async req=>who(req)?{id:'human:runtime-fixture-'+who(req),ref:'human:runtime-fixture-'+who(req),kind:'human',rights:['observe','edit','project']}:null,
  nativeRoomAuthority:async verified=>{authorityReads++;if(verified.actor?.ref!==being)throw Error('Wrong synthetic receiving being');return ['observe','edit','project'];},
  nativeFactory:async()=>({availability:async()=>({available:false}),authorizeWorldRequest:async()=>{originalLookups++;throw Error('Own creation must not inspect a human original');}})});
 runtime.app.get('/nexus/api/tables/:table/reports/:report/:revision/visit',(req,res)=>{
  const pin=selected(req.params.table,req.params.revision),allowed=!!who(req)&&pin&&pin.reportId===req.params.report&&!(who(req)==='b'&&pin.tableId===secondPin.tableId);
  descriptorReads.push({who:who(req),table:req.params.table,revision:req.params.revision,allowed:!!allowed});
  if(!allowed)return res.status(403).json({message:'Controlled private content refused'});
  res.json({title:pin.tableId===secondPin.tableId?'Restricted creation':'Creation edition '+pin.revision,pin});
 });
 runtime.app.get('/nexus/',(req,res)=>{
  const pin=selected(req.query.table,req.query.report_revision);if(!pin||!who(req)||(who(req)==='b'&&pin.tableId===secondPin.tableId))return res.status(403).send('Controlled private content refused');
  viewerLoads.push({who:who(req),pin});res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;background:#f1eadb;color:#264440;font:18px system-ui}textarea{max-width:90%;width:440px;height:100px}</style></head><body><h1>Creation edition ${pin.revision}</h1><p>Controlled protected viewer fixture; not a real review.</p><textarea>Retained creation note</textarea><script>
 const pin=${JSON.stringify(pin)},visitId=new URL(location).searchParams.get('holodeck_visit');
 window.fixture={pin,identity:crypto.randomUUID(),state:{playing:false,recording:false,dirty:false,processing:false},requests:[]};
 const send=v=>parent.postMessage(v,location.origin);
 addEventListener('message',e=>{const r=e.data;if(e.source!==parent||e.origin!==location.origin||r.schema!=='dm.holodeck-visit/request-v1')return;fixture.requests.push(r);send({schema:'dm.holodeck-visit/response-v1',id:r.id,visitId,pin,ok:true,result:r.method==='describe'?{state:fixture.state,capabilities:{describe:true,getContext:true,pauseAndFreeze:true,prepareClose:true}}:r.method==='getContext'?{state:fixture.state,source_time_ms:1234}:{canClose:!Object.values(fixture.state).some(Boolean),state:fixture.state}})});
 send({schema:'dm.holodeck-visit/ready-v1',visitId,pin});
 </script></body></html>`);
 });
 listener=runtime.app.listen(18944,'127.0.0.1');await new Promise((r,j)=>{listener.once('listening',r);listener.once('error',j)});
 const metadata=await(await fetch(cdpOrigin+'/json/version')).json();browser=await connection(metadata.webSocketDebuggerUrl);
 const a=await visitor('a'),b=await visitor('b',{mobile:true});
 await until(async()=>await a.evaluate('holodeckDevelopment.client.getWorldConnection().isConnected()&&holodeckDevelopment.client.getCharacterStates().size===2')&&await b.evaluate('holodeckDevelopment.client.getWorldConnection().isConnected()&&holodeckDevelopment.client.getCharacterStates().size===2'),20000,'two independent actual MML participants');
 for(const v of visitors){if((await catalog(v)).length)throw Error('Fixture must begin with no configured content');}
 const first=await act('node.place',firstId,null,nodeArgs('Primer portal','portal',{x:-1,z:4},firstPin));
 const second=await act('node.place',secondId,null,nodeArgs('Creación vinculada','pedestal',{x:2,z:3.5},secondPin,[{id:firstId,revision:1}]));
 const before=await native('observe');if(before.observer!==being||!before.nodes[firstId]?.declaredResultPin)throw Error('Native creator cannot inspect its declared pin');
 for(const v of visitors)await until(()=>v.evaluate('!document.querySelector("#visit-near").hidden&&document.querySelector("#visit-near").textContent.includes("Primer portal")'),20000,'live discovery without reload '+v.who);
 const initialGeometry=[];for(const v of visitors){const g=await geometry(v,{firstRevision:1,secondRevision:1,firstTitle:'Primer portal',link:true});assertGeometry(g,true);initialGeometry.push({who:v.who,geometry:g});}
 const initialStates=await Promise.all(visitors.map(state));for(const value of initialStates)if(value.nodes[secondId].links[0].status!=='current'||value.nodes[firstId].id!==firstId)throw Error('Independent observers disagree on initial links');
 for(const v of visitors){const c=await catalog(v);if(JSON.stringify(c.find(entry=>entry.id===firstId)?.pin)!==JSON.stringify(before.nodes[firstId].declaredResultPin))throw Error('Native/human declared pointer discovery diverged');}
 for(const v of visitors){await v.call('Page.bringToFront');await v.evaluate('document.querySelector("#visit-near").click();true');await until(()=>v.evaluate('document.querySelector("#visit-stage iframe")?.contentWindow.fixture?.pin.revision==="r1"'),10000,'exact first visit '+v.who);await wait(100);}
 await b.evaluate('window.allowedFrame=document.querySelector("#visit-stage iframe");true');await choose(b,secondId);await until(()=>b.evaluate('document.querySelector("#notice").textContent.includes("acceso a Nexus")'),10000,'private pin denial');
 if(!await b.evaluate('allowedFrame===document.querySelector("#visit-stage iframe")&&allowedFrame.contentWindow.fixture.pin.tableId==="controlled-first"'))throw Error('Denied content replaced an authorized visit');
 if(viewerLoads.some(load=>load.who==='b'&&load.pin.tableId===secondPin.tableId))throw Error('Denied private content loaded');
 await a.evaluate('window.originalFrame=document.querySelector("#visit-stage iframe");window.originalIdentity=originalFrame.contentWindow.fixture.identity;originalFrame.contentWindow.fixture.state.dirty=true;originalFrame.contentDocument.querySelector("textarea").value="Draft before new edition";true');
 const updated=await act('node.update',firstId,1,nodeArgs('Portal renovado','portal',{x:-1,z:4},nextPin));
 const revisedGeometry=[];for(const v of visitors){const g=await geometry(v,{firstRevision:2,secondRevision:1,firstTitle:'Portal renovado',link:false});assertGeometry(g,false);revisedGeometry.push({who:v.who,geometry:g});}
 for(const v of visitors){const value=await state(v);if(value.nodes[secondId].links[0].status!=='revised'||value.nodes[secondId].links[0].currentRevision!==2)throw Error('Stale relationship did not report revised target');}
 if(!await a.evaluate('originalFrame===document.querySelector("#visit-stage iframe")&&originalFrame.contentWindow.fixture.identity===originalIdentity&&originalFrame.contentWindow.fixture.pin.revision==="r1"&&originalFrame.contentDocument.querySelector("textarea").value==="Draft before new edition"'))throw Error('Node update moved an open visit to another pin');
 await until(()=>a.evaluate('document.querySelector("#content-visit select")?.selectedOptions[0]?.textContent==="Portal renovado"'),10000,'catalogue title update');
 await a.evaluate('document.querySelector("#visit-walk").click();true');await a.evaluate('document.querySelector("#visit-near").click();true');await until(()=>a.evaluate('document.querySelector("#notice").textContent.includes("trabajo pendiente")'),10000,'explicit replacement preserves dirty prior edition');
 if(!await a.evaluate('originalFrame===document.querySelector("#visit-stage iframe")&&originalFrame.contentWindow.fixture.pin.revision==="r1"'))throw Error('Unsafe explicit replacement erased prior edition');
 await a.evaluate('originalFrame.contentWindow.fixture.state.dirty=false;document.querySelector("#visit-walk").click();document.querySelector("#visit-near").click();true');
 await until(()=>a.evaluate('document.querySelector("#visit-stage iframe")?.contentWindow.fixture?.pin.revision==="r2"'),10000,'intentional next edition');
 await a.evaluate('window.revisionTwoFrame=document.querySelector("#visit-stage iframe");document.querySelector("#visit-walk").click();true');
 if(!await a.evaluate('revisionTwoFrame===document.querySelector("#visit-stage iframe")&&document.querySelector("#content-visit").classList.contains("is-walking")'))throw Error('Return destroyed the new exact edition');
 const rebound=await act('node.update',secondId,1,nodeArgs('Creación vinculada','pedestal',{x:2,z:3.5},secondPin,[{id:firstId,revision:2}]));
 const indicated=await act('focus.set',firstId,2,{});
 const finalGeometry=[];for(const v of visitors){const g=await geometry(v,{firstRevision:2,secondRevision:2,firstTitle:'Portal renovado',link:true});assertGeometry(g,true);finalGeometry.push({who:v.who,geometry:g});await until(()=>v.evaluate(`document.querySelector('[data-focus-target="${firstId}"]')?.getAttribute('data-focus-revision')==='2'`),10000,'same shared node indication '+v.who);}
 const finalNative=await native('observe'),finalStates=await Promise.all(visitors.map(state));
 for(const value of finalStates){if(value.run!==finalNative.run||value.nodes[firstId].revision!==finalNative.nodes[firstId].revision||value.nodes[firstId].result.selection!==finalNative.nodes[firstId].result.selection||value.nodes[secondId].links[0].status!=='current')throw Error('Native/browser situated references diverged');}
 const recovered=await native('result',{id:updated.request.id});if(JSON.stringify(recovered)!==JSON.stringify(updated.outcome))throw Error('Native exact result changed');
 for(const v of visitors){if(await v.evaluate('pageIdentity')!==v.pageIdentity||await v.evaluate('window.SESSION_TOKEN')!==v.token)throw Error('Dynamic creation required a reload/token replacement');await v.evaluate('document.querySelector("#visit-walk").click();true');await v.call('Page.bringToFront');await wait(250);const shot=await v.call('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,v.mobile?'phone.png':'desktop.png'),Buffer.from(shot.data,'base64'));}
 const errors=await Promise.all(visitors.map(v=>v.evaluate('fixtureErrors')));if(errors.some(v=>v.length))throw Error('Browser errors '+JSON.stringify(errors));if(originalLookups)throw Error('Own native creation used a human original');
 const evidence={schema:'holodeck.runtime-creations-browser/v1',qualification:'Two actual independent MML browser consumers and real private world-port Python --own CLI. Home/grants/Nexus are explicit synthetic loopback fixtures; zero real human/native model/provider inputs.',nativeAuthority:'synthetic current grant, real receiving-lane wire/CLI',humanOriginalLookups:originalLookups,authorityReads,runtimeOrConfigReplacement:false,pageReloads:false,independentMMLParticipants:2,ownNativeCommands:5,initialGeometry,revisedGeometry,finalGeometry,initialStates,finalStates,finalNative,retainedOldPinUntilIntentionalOpen:true,unsafeReplacementPreservedDraft:true,deniedPrivateDescriptorKeptOldFrame:true,descriptorReads,viewerLoads,exactNativeResultRecovered:true,nativeReceipts,errors,elapsedMs:Date.now()-started};
 await writeFile(join(directory,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({passed:true,authorityReads,humanOriginalLookups:originalLookups,ownNativeCommands:5,visitors:2,oldPinRetained:true,privateDescriptorDenied:true,elapsedMs:evidence.elapsedMs}));
}catch(error){
 const diagnostics=[];for(const v of visitors)diagnostics.push({who:v.who,value:await v.evaluate('({body:document.body.innerText.slice(-1600),errors:window.fixtureErrors,local:window.holodeckDevelopment?.client.getLocalCharacterState(),nodes:document.querySelectorAll("m-group[data-content-node]").length,near:document.querySelector("#visit-near")?.textContent})').catch(e=>({error:e.message}))});
 await writeFile(join(directory,'failure.json'),JSON.stringify({error:error.message,diagnostics,nativeReceipts,descriptorReads,viewerLoads},null,2));console.error(JSON.stringify(diagnostics));throw error;
}finally{
 clearTimeout(timeout);for(const v of visitors){v.ws.close();await browser?.call('Target.disposeBrowserContext',{browserContextId:v.browserContextId}).catch(()=>{});}browser?.ws.close();runtime?.close();if(listener){listener.closeAllConnections();await new Promise(r=>listener.close(r));}await rm(stateDir,{recursive:true,force:true});
 await writeFile(join(directory,'worker-cleanup.json'),JSON.stringify({contextsDisposed:visitors.length,stateRemoved:true,temporarySocketRemoved:true,deadlineSeconds:240,logBoundBytes:2097152}));
}
