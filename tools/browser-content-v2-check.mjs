import WebSocket from 'ws';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const origin='http://127.0.0.1:18943',wait=ms=>new Promise(r=>setTimeout(r,ms));
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
const entries=[{id:'report',node:'reading-room',entry:'/nexus/?table=fixture-report&report_revision=r1',descriptor:'/nexus/descriptor/report',pin:report},
 {id:'model',node:'reading-room',entry:'/nexus/?table=fixture-model',descriptor:'/nexus/descriptor/model',pin:model}];
const markup=(await readFile(new URL('../public/index.html',import.meta.url),'utf8')).replace(/<script[\s\S]*?<\/script>/g,'');
let page,server;
try{
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:18945');
  if(url.pathname==='/'){
   res.setHeader('content-type','text/html');res.end(markup+`<script type="module">import {ContentVisitor} from '/src/content-visitor.mjs';window.errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.visitor=new ContentVisitor({document,window,base:new URL('/',location),say:text=>document.querySelector('#notice').textContent=text});visitor.catalog.then(()=>visitor.update({x:-3,z:3}));</script>`);return;
  }
  if(url.pathname==='/api/content-visits'){res.setHeader('content-type','application/json');res.end(JSON.stringify({visits:entries}));return;}
  if(url.pathname.startsWith('/src/')){
   if(!['/src/content-visitor.mjs','/src/content-visits.mjs'].includes(url.pathname)){res.writeHead(404).end();return;}
   res.setHeader('content-type','text/javascript');res.end(await readFile(new URL('..'+url.pathname,import.meta.url)));return;
  }
  if(url.pathname.startsWith('/nexus/descriptor/')){
   const selected=entries.find(e=>url.pathname.endsWith('/'+e.id));res.setHeader('content-type','application/json');res.end(JSON.stringify({pin:selected.pin,title:selected.id==='model'?'Modelo protegido de prueba':('Informe sobre la creación compartida y sus perspectivas en el tiempo '.repeat(3)).slice(0,160)}));return;
  }
  if(url.pathname==='/nexus/'){
   const pin=url.searchParams.get('table')===model.tableId?model:report,version=pin.kind?2:1;
   res.setHeader('content-type','text/html');res.end(`<!doctype html><h1>Controlled Nexus protocol fixture</h1><textarea>Retained draft</textarea><script>
    const pin=${JSON.stringify(pin)},version=${version},visitId=new URL(location).searchParams.get('holodeck_visit');
    const state={dirty:false,recording:false,processing:false,playing:false};
    window.fixture={state,requests:[],readiness:version===2?'loading':'ready',identity:crypto.randomUUID(),ready:readiness=>{fixture.readiness=readiness;parent.postMessage({schema:'dm.holodeck-visit/ready-v'+version,pin,visitId,readiness},location.origin)}};
    addEventListener('message',event=>{const q=event.data;if(event.source!==parent||event.origin!==location.origin||q.schema!=='dm.holodeck-visit/request-v'+version)return;fixture.requests.push(q);
     const result=q.method==='describe'?{capabilities:{describe:true,getContext:true,pauseAndFreeze:true,prepareClose:true},readiness:fixture.readiness,state}:q.method==='prepareClose'?{canClose:!state.dirty&&!state.recording&&!state.processing&&!state.playing,state}:version===2?{context_status:'playback-only',playback:{clock:null,source_time_ms:null,paused:true},artifact_anchor:null,review_context:null,state}:{state,report_anchor:{report_id:'report',report_revision:'r1'}};
     parent.postMessage({schema:'dm.holodeck-visit/response-v'+version,id:q.id,visitId,pin,ok:true,result},location.origin);
    });fixture.ready(fixture.readiness);
   </script>`);return;
  }
  res.writeHead(404).end();
 });
 server.listen(18945,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j)});
 page=await connection(await backgroundTarget());await page.cdp('Page.enable');await page.cdp('Page.navigate',{url:'http://127.0.0.1:18945/'});await page.until('window.visitor?.entries.length===2');
 await page.evaluate('void visitor.open()');await page.until('!!visitor.frame?.contentWindow.fixture?.requests.length');await page.evaluate('window.original=visitor.frame');
 for(const flag of ['dirty','recording','processing']){
  await page.evaluate(`original.contentWindow.fixture.state.${flag}=true`);await page.evaluate("visitor.open('model')");
  if(!await page.evaluate("visitor.frame===original&&visitor.entry.id==='report'&&document.querySelector('#content-visit select').value==='report'"))throw Error('Protected visit replaced: '+flag);
  await page.evaluate(`original.contentWindow.fixture.state.${flag}=false`);
 }
 await page.evaluate("void visitor.open('model')");await page.until('visitor.frame!==original&&!!visitor.frame?.contentWindow.fixture');await wait(150);
 if(await page.evaluate('visitor.frame.contentWindow.fixture.requests.length'))throw Error('Loading accepted as ready');
 await page.evaluate("visitor.frame.contentWindow.fixture.ready('ready')");const context=await page.evaluate('visitor.context()');
 if(context.pin.kind!=='artifact_review'||context.context.context_status!=='playback-only'||context.context.review_context!==null||context.context.playback.source_time_ms!==null||!context.evidence.includes('playback-only'))throw Error('Artifact context missing or fabricated');
 await page.evaluate('window.modelFrame=visitor.frame;visitor.walk()');await page.evaluate("visitor.open('model')");
 const evidence=await page.evaluate('({sameFrame:visitor.frame===modelFrame,frames:document.querySelectorAll("#visit-stage iframe").length,title:document.querySelector("#visit-title").textContent,errors,selector:document.querySelector("#content-visit select").value})');
 if(!evidence.sameFrame||evidence.frames!==1||evidence.errors.length||evidence.selector!=='model')throw Error('Retention/browser failure '+JSON.stringify(evidence));
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(50);
 const mobile=await page.evaluate(`(()=>{const panel=document.querySelector('#content-visit').getBoundingClientRect(),selector=document.querySelector('#content-visit select').getBoundingClientRect();return {panel:{left:panel.left,right:panel.right},selector:{left:selector.left,right:selector.right,height:selector.height},viewport:innerWidth}})()`);
 if(mobile.selector.left<mobile.panel.left||mobile.selector.right>mobile.panel.right||mobile.selector.height<40)throw Error('Long protected content title overflows/undersizes the mobile selector '+JSON.stringify(mobile));
 evidence.mobile=mobile;
 console.log(JSON.stringify({qualification:'Actual ContentVisitor and markup; controlled Nexus protocol only, not renderer, participant or native acceptance',protectedSwitches:3,readinessTransition:'loading-to-ready',artifactContext:context,evidence}));
}finally{await page?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
