// Finite local rendering check against an explicitly selected isolated Chromium.
// Start Chromium with software WebGL and --remote-debugging-port=18941.
import WebSocket from 'ws';
import { writeFile } from 'node:fs/promises';
const base='http://127.0.0.1:18941';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function page(){
  const target=await (await fetch(`${base}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  let next=0;const pending=new Map();
  ws.on('message',raw=>{const message=JSON.parse(raw);const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
  async function send(method,params={}){
    const id=++next;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},30000);
      pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||'Browser evaluation failed');return result.result.value;}
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.holodeckErrors=[];addEventListener("error",e=>holodeckErrors.push(e.message));addEventListener("unhandledrejection",e=>holodeckErrors.push(String(e.reason?.stack||e.reason)));'});
  await send('Page.navigate',{url:'http://127.0.0.1:18940/'});
  return {send,evaluate,async close(){ws.close();await fetch(`${base}/json/close/${target.id}`);}};
}
const pages=[];
try{
  const a=await page();pages.push(a);
  const deadline=Date.now()+25000;
  while(Date.now()<deadline){if(await a.evaluate('!!window.holodeckDevelopment?.client.getLocalCharacterState()'))break;await wait(500);}
  const first=await a.evaluate('({errors:holodeckErrors,canvas:document.querySelectorAll("canvas").length,character:!!window.holodeckDevelopment?.client.getLocalCharacterState(),text:document.body.innerText})');
  console.log(JSON.stringify({first},null,2));
  if(!first.character||first.errors.length)throw Error('First client did not render cleanly');
  const initial=await a.evaluate('fetch("/api/state",{headers:{Authorization:"Bearer "+SESSION_TOKEN}}).then(r=>r.json()).then(s=>s.entities.bridge.raised)');
  const beforeShot=await a.send('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/holodeck-desktop.png',Buffer.from(beforeShot.data,'base64'));
  const b=await page();pages.push(b);
  const secondDeadline=Date.now()+25000;
  while(Date.now()<secondDeadline){if(await b.evaluate('!!window.holodeckDevelopment?.client.getLocalCharacterState()') && await a.evaluate('window.holodeckDevelopment.client.getCharacterStates().size===2'))break;await wait(500);}
  const presence=await a.evaluate('window.holodeckDevelopment.client.getCharacterStates().size');
  if(presence!==2){console.log(await b.evaluate('({errors:holodeckErrors,text:document.body.innerText})'));throw Error(`Expected two participants, got ${presence}`);}
  await a.send('Page.bringToFront');
  await a.evaluate('document.querySelector("#bridge").click()');await wait(1000);
  const second=await b.evaluate('fetch("/api/state",{headers:{Authorization:"Bearer "+SESSION_TOKEN}}).then(r=>r.json()).then(state=>({raised:state.entities.bridge.raised,errors:holodeckErrors}))');
  if(second.raised===initial||second.errors.length){console.log({second,first:await a.evaluate('({notice:document.querySelector("#notice").textContent,errors:holodeckErrors})')});throw Error('Shared mutation was not observed');}
  const screenshot=await a.send('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/holodeck-desktop.png',Buffer.from(screenshot.data,'base64'));
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await b.send('Emulation.setTouchEmulationEnabled',{enabled:true});await wait(500);
  const mobile=await b.send('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/holodeck-mobile.png',Buffer.from(mobile.data,'base64'));
  console.log(JSON.stringify({twoClientPresence:presence,sharedBridge:second.raised,desktopScreenshot:'/tmp/holodeck-desktop.png',emulatedMobileScreenshot:'/tmp/holodeck-mobile.png'}));
}finally{for(const item of pages)await item.close();}
