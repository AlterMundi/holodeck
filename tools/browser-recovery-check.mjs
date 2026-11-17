// Regression for browser-side missing-write/reload recovery, with a clearly
// labeled local fixture. It never contacts a real native provider or session.
// Requires an explicitly started isolated Chromium CDP on127.0.0.1:18943 and a
// built client. Opens/closes only its own target; fixture18944 ends in finally.
// No screenshots, private originals or unbounded logs are retained.
// Test-only stable identity/native transport. No real model/session submission.
import {createHolodeck} from '../src/server.mjs';
import {NativeConversationError} from '../src/native-conversation.mjs';
import WebSocket from 'ws';
const origin='http://127.0.0.1:18943';
let service=null,server=null,target=null,ws=null;
try{
await fetch(origin+'/json/version',{signal:AbortSignal.timeout(3000)});
const acceptedOriginals=[],records=new Map();
function missing(){const e=new NativeConversationError('not-retained','Test fixture has no original');Object.assign(e,{retained:false,knownNotSubmitted:true,retryable:true});throw e;}
service=await createHolodeck({identityResolver:async()=>({id:'fixture-human',kind:'human',name:'Fixture',rights:['observe','edit','project']}),nativeFactory:async()=>({
 availability:async()=>({available:true,active:null}),
 submit:async(_actor,body)=>{acceptedOriginals.push(structuredClone(body));const result={id:body.id,phase:'completed',retained:true,updates:[],knownNotSubmitted:false,retryable:false};records.set(body.id,result);return result;},
 status:async(_actor,id)=>records.get(id)||missing(),
 retry:async(_actor,id)=>records.get(id)||missing()
})});
service.app.get('/fixture/stats',(_req,res)=>res.json({accepted:acceptedOriginals,bridge:service.room.entities.bridge,outcomes:[...service.room.outcomes.keys()]}));
server=service.app.listen(18944,'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});

let id=0;const pending=new Map();
target=await(await fetch(origin+'/json/new?about:blank',{method:'PUT'})).json();
ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
let failCommand=true,failNative=true;const requests=[];
ws.on('message',raw=>{const m=JSON.parse(raw);if(pending.has(m.id)){const t=pending.get(m.id);pending.delete(m.id);m.error?t.j(Error(m.error.message)):t.r(m.result)}
 if(m.method==='Fetch.requestPaused'){
  const p=m.params,kind=p.request.url.endsWith('/api/commands')?'command':'native';
  if(p.request.method==='POST')requests.push({kind,body:JSON.parse(p.request.postData)});
  if(p.request.method==='POST'&&((kind==='command'&&failCommand)||(kind==='native'&&failNative))){if(kind==='command')failCommand=false;else failNative=false;cdp('Fetch.failRequest',{requestId:p.requestId,errorReason:'Failed'}).catch(()=>{});}
  else cdp('Fetch.continueRequest',{requestId:p.requestId}).catch(()=>{});
 }
});
function cdp(method,params={}){return new Promise((r,j)=>{const i=++id,t=setTimeout(()=>{pending.delete(i);j(Error('Timed out: '+method))},20000);pending.set(i,{r:v=>{clearTimeout(t);r(v)},j:e=>{clearTimeout(t);j(e)}});ws.send(JSON.stringify({id:i,method,params}))})}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Evaluation error');return r.result.value}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,ms=10000){const start=Date.now();while(Date.now()-start<ms){if(await evaluate(expression))return;await wait(250)}throw Error('Condition failed: '+expression)}
async function stats(){return(await fetch('http://127.0.0.1:18944/fixture/stats')).json()}
 await cdp('Page.enable');await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.checkErrors=[];addEventListener("error",e=>checkErrors.push(e.message));addEventListener("unhandledrejection",e=>checkErrors.push(String(e.reason)))'});
 await cdp('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:18944/api/commands',requestStage:'Request'},{urlPattern:'http://127.0.0.1:18944/api/interactions',requestStage:'Request'}]});
 await cdp('Page.navigate',{url:'http://127.0.0.1:18944/'});
 await until('!!window.holodeckDevelopment?.client.getLocalCharacterState()&&!document.querySelector("#send").disabled');
 await evaluate('document.querySelector("#bridge").click()');
 await until('!!document.querySelector(".recovery-item[data-kind=command]")');
 const command=await evaluate('JSON.parse(sessionStorage.getItem("holodeck.pending:/")).command');
 if((await stats()).outcomes.length)throw Error('Lost command reached the fixture');
 await cdp('Page.reload');await until('!!document.querySelector(".recovery-item[data-kind=command] button[data-action=retry]")&&!document.querySelector(".recovery-item[data-kind=command] button[data-action=retry]").disabled');
 if(requests.filter(r=>r.kind==='command').length!==1)throw Error('Reload automatically resubmitted command');
 await evaluate('document.querySelector(".recovery-item[data-kind=command] button[data-action=retry]").click()');
 await until('!document.querySelector(".recovery-item[data-kind=command]")');
 if(!(await stats()).bridge.raised)throw Error('Explicit retry did not update world');
 const commandRequests=requests.filter(r=>r.kind==='command');
 if(JSON.stringify(commandRequests[1].body)!==JSON.stringify(command))throw Error('Command retry changed the frozen request');
 const text='  fixture original\n unchanged  ';
 await evaluate(`document.querySelector('#talk').click();document.querySelector('#message').value=${JSON.stringify(text)};document.querySelector('#conversation-form').requestSubmit()`);
 await until('!!document.querySelector(".recovery-item[data-kind=native]")');
 const turn=await evaluate('JSON.parse(sessionStorage.getItem("holodeck.turn:/"))');
 if((await stats()).accepted.length)throw Error('Lost native request reached fixture');
 await cdp('Page.reload');await until('!!document.querySelector(".recovery-item[data-kind=native] button[data-action=retry]")&&!document.querySelector(".recovery-item[data-kind=native] button[data-action=retry]").disabled');
 if(requests.filter(r=>r.kind==='native').length!==1)throw Error('Reload automatically resubmitted native original');
 await evaluate('document.querySelector(".recovery-item[data-kind=native] button[data-action=retry]").click()');
 await until('!document.querySelector(".recovery-item[data-kind=native]")&&!document.querySelector("#send").disabled');
 const accepted=(await stats()).accepted;
 if(accepted.length!==1||JSON.stringify(accepted[0])!==JSON.stringify(turn.body)||accepted[0].text!==text)throw Error('Native retry replaced original/capture/ID');
 failCommand=true;await evaluate('document.querySelector("#bridge").click()');
 await until('!!document.querySelector(".recovery-item[data-kind=command]")');
 const discarded=await evaluate('JSON.parse(sessionStorage.getItem("holodeck.pending:/"))');
 await evaluate('document.querySelector(".recovery-item[data-kind=command] button[data-action=close]").click()');
 const warning=await evaluate('document.querySelector(".recovery-warning").textContent');
 if(!warning.includes('no cancela ni deshace'))throw Error('Closing tracking misrepresented cancellation');
 await evaluate('document.querySelector(".recovery-item[data-kind=command] button[data-action=close]").click()');
 await until('!document.querySelector(".recovery-item[data-kind=command]")');
 const archived=await evaluate('JSON.parse(sessionStorage.getItem("holodeck.closed-intents:/"))');
 if(archived[0].command.id!==discarded.command.id||(await stats()).bridge.raised!==true)throw Error('Close lost original or cancelled world effect');
 await evaluate('document.querySelector("#bridge").click()');await until('document.querySelector("#bridge").textContent.includes("Conectar")');
 const evidence={commandInitialNeverArrived:true,reloadDidNotAutoResend:true,explicitCommandRetryExact:true,nativeInitialNeverArrived:true,explicitNativeRetryExactOriginalAndView:true,capturedAtUnchanged:accepted[0].view.capturedAt===turn.body.view.capturedAt,closeTrackingPreservedOriginal:true,closeTrackingDidNotCancel:true,newActionUnlocked:true,errors:await evaluate('checkErrors'),nativeProvider:'fixture only; no real provider/session input'};
 console.log(JSON.stringify(evidence));
}finally{
 ws?.close();
 if(target)await fetch(origin+'/json/close/'+target.id).catch(()=>{});
 service?.close();
 if(server?.listening)await new Promise(resolve=>server.close(resolve));
}

