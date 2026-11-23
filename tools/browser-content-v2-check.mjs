import WebSocket from 'ws';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {CONTENT_NODE} from '../src/content-visits.mjs';
const origin=process.env.HOLODECK_BROWSER_ORIGIN||'http://127.0.0.1:18943',wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Select an explicitly owned loopback browser');
async function connection(target){
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});let next=0;const pending=new Map();
 ws.on('message',raw=>{const m=JSON.parse(raw);if(pending.has(m.id)){const t=pending.get(m.id);pending.delete(m.id);m.error?t.j(Error(m.error.message)):t.r(m.result)}});
 function cdp(method,params={}){return new Promise((r,j)=>{const id=++next,t=setTimeout(()=>{pending.delete(id);j(Error('Timed out: '+method))},20000);pending.set(id,{r:v=>{clearTimeout(t);r(v)},j:e=>{clearTimeout(t);j(e)}});ws.send(JSON.stringify({id,method,params}))})}
 async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Evaluation error');return r.result.value}
 async function until(expression,ms=10000){const begin=Date.now();while(Date.now()-begin<ms){if(await evaluate(expression))return;await wait(100)}throw Error('Condition failed: '+expression)}
 async function click(selector){const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});}
 return {target,cdp,evaluate,until,click,async close(){ws.close();await fetch(origin+'/json/close/'+target.id)}};
}
async function backgroundTarget(){
 const metadata=await(await fetch(origin+'/json/version')).json(),socket=new WebSocket(metadata.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Background target unavailable')),5000);socket.on('message',raw=>{const value=JSON.parse(raw);if(value.id===1){clearTimeout(timer);value.error?reject(Error(value.error.message)):resolve(value.result);}});socket.send(JSON.stringify({id:1,method:'Target.createTarget',params:{url:'about:blank',background:true}}));});socket.close();
 const target=(await(await fetch(origin+'/json/list')).json()).find(value=>value.id===result.targetId);if(!target)throw Error('Background target missing');return target;
}
// Focused real ContentVisitor/markup qualification. No MML physics, identity,
// native input, selected content or renderer acknowledgment is simulated as real.
const report={tableId:'fixture-report',reportId:'report',revision:'r1'};
const model={kind:'artifact_review',tableId:'fixture-model',reviewId:'model',revision:'m1',adapter:'interactive_3d'};
const field={kind:'context',tableId:'fixture-field',contextId:'field-context',revision:'historical-v1'};
const landmark={id:'research-fixture',title:'Selected research fixture',position:{x:9,y:0,z:0}};
const entries=[{id:'report',node:'reading-room',entry:'/nexus/?table=fixture-report&report_revision=r1',descriptor:'/nexus/descriptor/report',pin:report},
 {id:'model',node:landmark.id,entry:'/nexus/?table=fixture-model',descriptor:'/nexus/descriptor/model',pin:model},
 {id:'field',node:landmark.id,entry:'/nexus/?table=fixture-field&entry=web&context_id=field-context&context_version=historical-v1',descriptor:'/nexus/descriptor/field',pin:field}];
const markup=(await readFile(new URL('../public/index.html',import.meta.url),'utf8')).replace(/<script[\s\S]*?<\/script>/g,'');
const realBridge=process.env.HOLODECK_NEXUS_CONTEXT_BRIDGE?new TextDecoder().decode((await build({entryPoints:[process.env.HOLODECK_NEXUS_CONTEXT_BRIDGE],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})).outputFiles[0].contents):null;
let page,server,galleryAllowed=true;
try{
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){
   res.setHeader('content-type','text/html');res.end(markup+`<script type="module">import {ContentVisitor} from '/src/content-visitor.mjs';window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.visitor=new ContentVisitor({document,window,base:new URL('/',location),say:text=>document.querySelector('#notice').textContent=text});visitor.catalog.then(()=>visitor.update(${JSON.stringify(CONTENT_NODE.position)}));</script>`);return;
  }
  if(url.pathname==='/api/content-visits'){res.setHeader('content-type','application/json');res.end(JSON.stringify({nodes:[CONTENT_NODE,landmark],visits:entries}));return;}
  if(url.pathname==='/api/space/content-visits'){
   res.setHeader('content-type','application/json');
   res.end(JSON.stringify({visits:galleryAllowed?[{...entries[1],position:landmark.position,nodeRevision:2}]:[]}));return;
  }
  if(url.pathname.startsWith('/src/')){
   if(!['/src/content-visitor.mjs','/src/content-visits.mjs'].includes(url.pathname)){res.writeHead(404).end();return;}
   res.setHeader('content-type','text/javascript');res.end(await readFile(new URL('..'+url.pathname,import.meta.url)));return;
  }
  if(url.pathname.startsWith('/nexus/descriptor/')){
   const selected=entries.find(e=>url.pathname.endsWith('/'+e.id));res.setHeader('content-type','application/json');res.end(JSON.stringify({...(selected.id==='field'?{schema:'dm.holodeck-visit/descriptor-v3',kind:'context',entry:selected.entry}:{}),pin:selected.pin,title:selected.id==='field'?'Field · contexto histórico':selected.id==='model'?'Modelo protegido de prueba':('Informe sobre la creación compartida y sus perspectivas en el tiempo '.repeat(3)).slice(0,160)}));return;
  }
  if(url.pathname==='/fixture-context-bridge.js'&&realBridge){res.setHeader('content-type','text/javascript');res.end(realBridge);return;}
  if(url.pathname==='/nexus/'){
   const pin=url.searchParams.get('table')===field.tableId?field:url.searchParams.get('table')===model.tableId?model:report,version=pin.kind==='context'?3:pin.kind?2:1;
   res.setHeader('content-type','text/html');res.end(`<!doctype html><h1>Controlled Nexus protocol fixture</h1><textarea>Retained draft</textarea><script type="module">
    ${version===3&&realBridge?"import {installContextVisit} from '/fixture-context-bridge.js';":''}
    const pin=${JSON.stringify(pin)},version=${version},visitId=new URL(location).searchParams.get('holodeck_visit');
    const state={dirty:false,recording:false,processing:false,playing:false};
    window.fixture={state,requests:[],readiness:version>=2?'loading':'ready',identity:crypto.randomUUID(),ready:readiness=>{fixture.readiness=readiness;if(version===3&&${!!realBridge}){fixture.dispose?.();fixture.dispose=installContextVisit(window,pin,()=>fixture.readiness==='ready'&&!fixture.wrongPin?{visit_id:'fixture-personal-visit',view_revision:3,focus:'project-node',selection:{kind:'relation',object_id:'project-relation'},state}:null,async()=>true);return;}parent.postMessage({schema:'dm.holodeck-visit/ready-v'+version,pin,visitId,readiness},location.origin)}};
    addEventListener('message',event=>{const q=event.data;if(event.source!==parent||event.origin!==location.origin||q.schema!=='dm.holodeck-visit/request-v'+version)return;fixture.requests.push(q);if(version===3&&${!!realBridge})return;
     const result=q.method==='describe'?{capabilities:{describe:true,getContext:true,pauseAndFreeze:true,prepareClose:true},readiness:fixture.readiness,state}:q.method==='prepareClose'?{canClose:!state.dirty&&!state.recording&&!state.processing&&!state.playing,state}:version===3?{pin:fixture.wrongPin?{...pin,revision:'later'}:pin,visit_id:'fixture-personal-visit',view_revision:3,context_status:'acknowledged-client-view',focus:'project-node',selection:{kind:'relation',object_id:'project-relation'},state,draft:'private-not-for-world',graph:{private:'not-for-world'}}:version===2?{context_status:'playback-only',playback:{clock:null,source_time_ms:null,paused:true},artifact_anchor:null,review_context:null,state}:{state,report_anchor:{report_id:'report',report_revision:'r1'}};
     parent.postMessage({schema:'dm.holodeck-visit/response-v'+version,id:q.id,visitId,pin,ok:true,result},location.origin);
    });fixture.ready(fixture.readiness);
   </script>`);return;
  }
  res.writeHead(404).end();
 });
 server.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j)});
 page=await connection(await backgroundTarget());await page.cdp('Page.enable');await page.cdp('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});await page.until('window.visitor?.entries.length===3');
 await page.evaluate('void visitor.open()');await page.until('!!visitor.frame?.contentWindow.fixture?.requests.length');await page.evaluate('window.original=visitor.frame');
 await page.evaluate('visitor.update({x:9,y:0,z:0})');
 if(!await page.evaluate('document.querySelector("#visit-near").textContent.startsWith("Visitar " )'))throw Error('Research entrance did not replace the nearby action');
 for(const flag of ['dirty','recording','processing']){
  await page.evaluate(`original.contentWindow.fixture.state.${flag}=true`);await page.evaluate("visitor.openNode('research-fixture')");
  if(!await page.evaluate("visitor.frame===original&&visitor.entry.id==='report'&&document.querySelector('#content-visit select').value==='report'"))throw Error('Protected visit replaced: '+flag);
  await page.evaluate(`original.contentWindow.fixture.state.${flag}=false`);
 }
 await page.evaluate("void visitor.openNode('research-fixture')");await page.until('visitor.frame!==original&&!!visitor.frame?.contentWindow.fixture');await wait(150);
 if(await page.evaluate('visitor.frame.contentWindow.fixture.requests.length'))throw Error('Loading accepted as ready');
 await page.evaluate("visitor.frame.contentWindow.fixture.ready('ready')");await page.until('visitor.readyAcknowledged===true');const context=await page.evaluate('visitor.context()');
 if(context.node!==landmark.id||context.pin.kind!=='artifact_review'||context.context.context_status!=='playback-only'||context.context.review_context!==null||context.context.playback.source_time_ms!==null||!context.evidence.includes('playback-only'))throw Error('Artifact context missing or fabricated');
 await page.evaluate('window.modelFrame=visitor.frame;visitor.walk()');await page.evaluate("visitor.open('model')");
 const evidence=await page.evaluate('({sameFrame:visitor.frame===modelFrame,frames:document.querySelectorAll("#visit-stage iframe").length,title:document.querySelector("#visit-title").textContent,errors,selector:document.querySelector("#content-visit select").value})');
 if(!evidence.sameFrame||evidence.frames!==1||evidence.errors.length||evidence.selector!=='model')throw Error('Retention/browser failure '+JSON.stringify(evidence));
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(50);
 const mobile=await page.evaluate(`(()=>{const panel=document.querySelector('#content-visit').getBoundingClientRect(),selector=document.querySelector('#content-visit select').getBoundingClientRect();return {panel:{left:panel.left,right:panel.right},selector:{left:selector.left,right:selector.right,height:selector.height},viewport:innerWidth}})()`);
 if(mobile.selector.left<mobile.panel.left||mobile.selector.right>mobile.panel.right||mobile.selector.height<40)throw Error('Long protected content title overflows/undersizes the mobile selector '+JSON.stringify(mobile));
 evidence.mobile=mobile;
 await page.evaluate("void visitor.open('field')");await page.until('visitor.entry?.id==="field"&&!!visitor.frame?.contentWindow.fixture');await wait(150);
 if(await page.evaluate('visitor.readyAcknowledged'))throw Error('Context loading accepted as acknowledged');
 await page.evaluate("visitor.frame.contentWindow.fixture.ready('ready')");await page.until('visitor.readyAcknowledged===true');
 const fieldContext=await page.evaluate('visitor.context()');
 if(fieldContext.pin.kind!=='context'||fieldContext.pin.revision!==field.revision||fieldContext.context.visit_id!=='fixture-personal-visit'||fieldContext.context.view_revision!==3||fieldContext.context.focus!=='project-node'||'graph'in fieldContext.context||'draft'in fieldContext.context||!fieldContext.evidence.includes('not canonical native-ingress'))throw Error('Context pin/reference isolation failed');
 await page.evaluate('visitor.frame.contentWindow.fixture.wrongPin=true');const wrong=await page.evaluate('visitor.context()');if(!wrong.contextUnavailable||wrong.context)throw Error('Different context revision accepted');
 await page.evaluate('visitor.frame.contentWindow.fixture.wrongPin=false;window.fieldFrame=visitor.frame;fieldFrame.contentWindow.fixture.state.dirty=true');
 await page.evaluate("visitor.open('report')");if(!await page.evaluate('visitor.frame===fieldFrame'))throw Error('Dirty context frame replaced');
 await page.evaluate('visitor.walk()');await page.evaluate("visitor.open('field')");
 if(!await page.evaluate("visitor.frame===fieldFrame&&fieldFrame.contentWindow.document.querySelector('textarea').value==='Retained draft'"))throw Error('Context return lost frame/draft');
 if(process.env.HOLODECK_EVIDENCE_DIR){const shot=await page.cdp('Page.captureScreenshot',{format:'jpeg',quality:65});await writeFile(process.env.HOLODECK_EVIDENCE_DIR+'/context-phone.jpg',Buffer.from(shot.data,'base64'));}
 evidence.context={pin:fieldContext.pin,visit:fieldContext.context,wrongPinUnavailable:wrong.contextUnavailable,dirtyFrameRetained:true,draftRetained:true};

 await page.evaluate('visitor.changeRoom(true)');
 await page.until('visitor.entries.length===1');
 await page.evaluate('visitor.update({x:9,y:0,z:0});document.querySelector("#visit-near").click()');
 await page.until('!!visitor.frame?.contentWindow.fixture');
 await page.evaluate("visitor.frame.contentWindow.fixture.ready('ready')");
 await page.until('visitor.readyAcknowledged===true');
 await page.evaluate('window.galleryFrame=visitor.frame;document.querySelector("#visit-walk").click()');
 await page.evaluate("visitor.open('model',{nodeRevision:2})");
 if(!await page.evaluate("visitor.frame===galleryFrame&&!visitor.panel.inert"))throw Error('Gallery resume replaced the viewer');
 galleryAllowed=false;
 await page.evaluate("visitor.open('model',{nodeRevision:2})");
 await page.evaluate('visitor.update({x:9,y:0,z:0})');
 if(!await page.evaluate("visitor.frame===galleryFrame&&visitor.panel.inert&&visitor.selector.options.length===0&&visitor.button.hidden"))
  throw Error('Revoked gallery edition still offered as an active visit');
 if(await page.evaluate('visitor.context()'))throw Error('Revoked gallery edition still projected as current context');
 evidence.gallery={sameFrame:true,revokedChoiceHidden:true,revokedContextSuppressed:true};

 console.log(JSON.stringify({qualification:'Actual ContentVisitor and markup; controlled Nexus protocol only, not renderer, participant or native acceptance',protectedSwitches:3,readinessTransition:'loading-to-ready',artifactContext:context,contextV3:evidence.context,actualNexusBridge:!!realBridge,evidence}));
}finally{await page?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
