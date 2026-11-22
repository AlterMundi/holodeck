// Real walked spatial composition QA. Only local synthetic authority/state;
// sanitized public geometry is supplied explicitly, never a live room journal.
import WebSocket from 'ws';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const {createHolodeck}=await import(process.env.HOLODECK_SERVER_MODULE||new URL('../src/server.mjs',import.meta.url).href);
const execute=promisify(execFile),wait=ms=>new Promise(r=>setTimeout(r,ms));
const housesOnly=process.env.HOLODECK_HOUSES_ONLY==='1';
const clickOnly=process.env.HOLODECK_SPATIAL_CLICK_ONLY==='1',surfacesOnly=process.env.HOLODECK_SPATIAL_SURFACES_ONLY==='1';
const directory=process.env.HOLODECK_EVIDENCE_DIR;if(!directory)throw Error('Select bounded evidence directory');
const cdpOrigin='http://127.0.0.1:18943',worldOrigin='http://127.0.0.1:18944';
const stateDir=await mkdtemp(join(tmpdir(),'holodeck-spatial-layout-')),socketPath=join(stateDir,'world.sock');
const being='dm:being:v1:'+'c'.repeat(43),visitors=[],nativeReceipts=[],views=[],route=[];
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

async function position(v){return v.evaluate('structuredClone(holodeckDevelopment.client.getLocalCharacterState().position)');}
async function walk(v,x,z,label){
 await v.evaluate('document.activeElement?.blur();window.focus();holodeckDevelopment.client.getCameraManager().setOrbitAngle(Math.PI/2)');await wait(350);
 const began=Date.now();let stuck=0,last=await position(v);
 while(Math.hypot(last.x-x,last.z-z)>.5){
  if(Date.now()-began>22000)throw Error('Walk route timed out '+label+' '+JSON.stringify(last));
  const dx=x-last.x,dz=z-last.z,key=Math.abs(dx)>Math.abs(dz)?(dx>0?'d':'a'):(dz>0?'s':'w');
  const duration=Math.min(280,Math.max(75,Math.max(Math.abs(dx),Math.abs(dz))*110));
  await v.call('Input.dispatchKeyEvent',{type:'keyDown',key,code:'Key'+key.toUpperCase(),windowsVirtualKeyCode:key.toUpperCase().charCodeAt(0)});
  try{await wait(duration);}finally{await v.call('Input.dispatchKeyEvent',{type:'keyUp',key,code:'Key'+key.toUpperCase(),windowsVirtualKeyCode:key.toUpperCase().charCodeAt(0)});}
  await wait(50);const next=await position(v);route.push({label,key,position:next});
  if(next.y<-.25||next.y>1)throw Error('Walk lost grounded platform '+label+' '+JSON.stringify(next));
  stuck=Math.hypot(next.x-last.x,next.z-last.z)<.02?stuck+1:0;if(stuck>8)throw Error('Blocked physical route '+label+' '+JSON.stringify(next)+' camera '+JSON.stringify(await v.evaluate('holodeckDevelopment.client.getCameraManager().getCameraState()')));last=next;
 }
 return last;
}
async function shot(v,name,{mobile=false,angle=Math.PI/2,aerial=false}={}){
 await v.call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1100,height:mobile?844:800,deviceScaleFactor:1,mobile});
 await v.evaluate(`(()=>{const c=holodeckDevelopment.client.getCameraManager();c.setOrbitAngle(${angle});${aerial?'c.maxDistance=100;c.minFOV=70;c.maxFOV=70;c.reverseUpdateFromPositions({x:0,y:64,z:.01},c.getCameraRotation());':''}})()`);
 await wait(750);
 const state=await v.evaluate('({position:structuredClone(holodeckDevelopment.client.getLocalCharacterState().position),camera:holodeckDevelopment.client.getCameraManager().getCameraState(),labels:[...document.querySelectorAll("m-label")].map(e=>({text:e.getAttribute("content"),x:e.getAttribute("x"),z:e.getAttribute("z")})),hud:{playHidden:document.querySelector("#play-near")?.hidden,title:document.querySelector("#play-title")?.textContent},viewport:{width:innerWidth,height:innerHeight},errors:fixtureErrors})');
 const image=await v.call('Page.captureScreenshot',{format:'jpeg',quality:76});await writeFile(join(directory,name+'.jpg'),Buffer.from(image.data,'base64'));
 views.push({name,mobile,qualification:mobile?'Mobile viewport composition only; existing actual touch baseline is reused.':'Actual desktop MML renderer',aerial, ...state});
}
try{
 await mkdir(directory,{recursive:true});
 const geometryBytes=housesOnly
  ? Buffer.from(JSON.stringify({entities:{bridge:{id:'bridge',revision:0,raised:false}}}))
  : await readFile(process.env.HOLODECK_GEOMETRY_FILE);
 const geometry=JSON.parse(geometryBytes);
 const contentNodes=process.env.HOLODECK_CONTENT_NODES_FILE?JSON.parse(await readFile(process.env.HOLODECK_CONTENT_NODES_FILE)):undefined;
 runtime=await createHolodeck({stateDir,publicOrigin:worldOrigin,contentNodes,ownNative:true,worldSocket:socketPath,worldSocketBeingRef:being,
  identityResolver:async req=>req.headers.cookie?.includes('fixture_player=a')?{id:'human:spatial-fixture-a',ref:'human:spatial-fixture-a',kind:'human',rights:['observe','edit','project']}:null,
  nativeRoomAuthority:async verified=>{authorityReads++;if(verified.actor?.ref!==being)throw Error('Wrong synthetic receiving actor');return ['observe','edit','project'];},
  nativeFactory:async()=>({availability:async()=>({available:false}),authorizeWorldRequest:async()=>{originalLookups++;throw Error('No human original permitted');}})});
 // Local checkpoint only, with sanitized public retained positions. No live writes.
 const snapshot=runtime.room.snapshot();snapshot.entities=geometry.entities;runtime.room.restore(snapshot);
 runtime.app.get('/fixture-three-core.mjs',async(_req,res)=>{res.type('text/javascript').send(await readFile(new URL('../node_modules/three/build/three.core.js',import.meta.url),'utf8'));});
 listener=runtime.app.listen(18944,'127.0.0.1');await new Promise((r,j)=>{listener.once('listening',r);listener.once('error',j)});
 browser=await connection((await(await fetch(cdpOrigin+'/json/version')).json()).webSocketDebuggerUrl);
 if(!housesOnly){
 for(const args of [
  {title:'Jardín de señales',shape:'pedestal',position:{x:22,z:4},play:{schema:'signal-garden/v1',targets:[{x:19,z:-1,radius:1,color:'violet'},{x:25,z:-1,radius:1,color:'amber'}],minContributors:2,requiredBridgeRaised:true},links:[]},
  {title:'Obra compartida',shape:'portal',position:{x:-25,z:-2},result:{pin:{tableId:'spatial-fixture',reportId:'spatial-report',revision:'edition-one'}},links:[]}
 ]){const observation=await native('observe');const outcome=await native('act',{id:randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type:'node.place',target:args.play?'node-spatial-game':'node-spatial-result',expectedRevision:null,args});if(outcome.status!=='completed')throw Error('Fixture node refused '+JSON.stringify(outcome));}
 const previous=geometry.entities['garden-compaii-first-signal'];if(previous.x!==19||previous.z!==-1){const o=await native('observe');const moved=await native('act',{id:randomUUID(),issuedAt:Date.now(),run:o.run,edition:o.edition,observation:o.id,type:'garden.update',target:previous.id,expectedRevision:previous.revision,args:{x:19,z:-1,color:previous.color}});if(moved.status!=='completed')throw Error('Local own-signal move failed');}
 }
 const v=await visitor('a',false);await wait(700);
 if(housesOnly){
  const seen=await native('observe');
  const id=seen.place.housing.ownHouse;
  const outcome=await native('act',{
   id:randomUUID(),issuedAt:Date.now(),run:seen.run,edition:seen.edition,
   observation:seen.id,type:'house.claim',target:id,expectedRevision:null,
   args:{parcel:'parcel-east-1',facade:{title:'Casa del atlas',color:'#526779',width:3.2,depth:1.6,height:2.2}},
  });
  if(outcome.status!=='completed')throw Error('House claim failed '+JSON.stringify(outcome));
  await until(()=>v.evaluate(`document.querySelector('#${id}')?.getAttribute('data-house-revision')==='1'`),10000,'owner facade projection');
  const locator=await v.evaluate(`(async()=>{
    const headers={Authorization:'Bearer '+window.SESSION_TOKEN};
    const response=await fetch('/api/places/${id}',{headers});
    return {status:response.status, house:(await response.json()).house};
  })()`);
  if(locator.status!==200||locator.house?.id!==id||locator.house.owner!==being)
    throw Error('Protected durable house address did not resolve '+JSON.stringify(locator));
  await walk(v,0,10.8,'arrival to house connector');
  await walk(v,0,15.5,'connected house commons');
  await walk(v,2.15,15.5,'public approach to owned facade');
  await shot(v,'house-approach');
  await walk(v,0,15.5,'return to common aisle');
  await walk(v,0,23,'walk past all eight plots');
  await walk(v,0,8.7,'return to arrival');
 }else if(surfacesOnly){
  const start=await position(v);await shot(v,'arrival-surfaces');
  await v.evaluate('(()=>{const c=holodeckDevelopment.client.getCameraManager();c.maxDistance=100;c.reverseUpdateFromPositions({x:0,y:25,z:11},c.getCameraRotation());})()');await wait(300);
  await v.evaluate('(()=>{const c=holodeckDevelopment.client.getCameraManager(),s=c.getCameraState(),p=holodeckDevelopment.client.getLocalCharacterState().position,dy=s.position.y-(p.y+1.75),dz=s.position.z-p.z,distance=Math.hypot(dy,dz);window.surfaceInspection={distance,cosPhi:dy/distance};c.toggleFlyCamera();c.panFlyCameraLookAt(22/(distance*.01),6/(distance*.01*(dy/distance)));})()');await shot(v,'gallery-surfaces');
  await v.evaluate('(()=>{const c=holodeckDevelopment.client.getCameraManager();c.panFlyCameraLookAt(-44/(surfaceInspection.distance*.01),0);})()');await shot(v,'game-surfaces');
  const end=await position(v);if(Math.hypot(end.x-start.x,end.z-start.z)>.01)throw Error('Inspection moved avatar');views.push({qualification:'Surface inspection uses public fly camera and pan only. Avatar unchanged; no traversal claimed.',start,end});
 }else if(clickOnly){
  for(const [x,z,label]of [[0,2,'main aisle'],[-3,2,'west aisle'],[-3,0,'former stop point'],[-6,0,'west gap'],[-6,1.7,'human light bypass'],[-8,1.7,'west approach'],[-10,0,'bridge entrance'],[-22,0,'gallery'],[-24,0,'gallery aisle'],[-24,5.5,'gallery south approach'],[-22,5.5,'gallery south']])await walk(v,x,z,label);
  await v.evaluate('holodeckDevelopment.client.getCameraManager().setOrbitAngle(Math.PI/2)');await wait(400);
  const at=await v.evaluate(`(()=>{const c=holodeckDevelopment.client.getCameraManager().getCameraState(),g=document.querySelector('#content-reading-room m-label').getContainer(),p=g.getWorldPosition(g.position.clone());p.sub(c.position);const q=g.quaternion.clone();q.set(c.rotation.x,c.rotation.y,c.rotation.z,c.rotation.w).invert();p.applyQuaternion(q);const t=Math.tan(c.fov*Math.PI/360),r=[...document.querySelectorAll('canvas')].map(e=>e.getBoundingClientRect()).find(r=>r.width>=innerWidth*.9&&r.height>=innerHeight*.9);if(!r)throw Error('Visible world canvas unavailable');return{x:r.left+r.width*(1+p.x/(-p.z*t*c.aspect))/2,y:r.top+r.height*(1-p.y/(-p.z*t))/2,depth:p.z}})()`);
  if(at.depth>=0||at.x<0||at.x>1100||at.y<0||at.y>800)throw Error('Reading-room click point outside actual viewport '+JSON.stringify(at));
  const inspection=await v.evaluate(`(async()=>{const {PerspectiveCamera,Raycaster,Vector2}=await import('/fixture-three-core.mjs'),state=holodeckDevelopment.client.getCameraManager().getCameraState(),camera=new PerspectiveCamera(state.fov,state.aspect,.01,200);camera.position.copy(state.position);camera.quaternion.copy(state.rotation);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const scene=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group;scene.updateMatrixWorld(true);const ray=new Raycaster();ray.setFromCamera(new Vector2(${at.x}/1100*2-1,-${at.y}/800*2+1),camera);const hit=ray.intersectObjects(scene.children,true).filter(h=>(h.object.isMesh||h.object.isSprite)&&[...(Array.isArray(h.object.material)?h.object.material:[h.object.material])].some(m=>m?.visible&&m.opacity>0)).slice(0,8).map(h=>{let owner=null;for(let p=h.object;p;p=p.parent){const element=[...document.querySelectorAll('m-group[data-content-node]')].find(e=>e.getContainer()===p);if(element){owner=element.getAttribute('data-content-node');break;}}return{distance:h.distance,owner,name:h.object.name,type:h.object.type,material:h.object.material.type}});return{at:${JSON.stringify(at)},hits:hit,proof:holodeckDevelopment.appliedGeometry(),root:{run:document.querySelector('#workshop').getAttribute('data-run'),sequence:document.querySelector('#workshop').getAttribute('data-semantic-sequence')}}})()`);
  await writeFile(join(directory,'click-diagnostic.json'),JSON.stringify(inspection,null,2));if(process.env.HOLODECK_SKIP_COMPOSITION_SHOTS!=='1'){await shot(v,'gallery-click-desktop');await shot(v,'gallery-click-phone',{mobile:true});}await v.call('Emulation.setDeviceMetricsOverride',{width:1100,height:800,deviceScaleFactor:1,mobile:false});await wait(300);
  await v.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:at.x,y:at.y});await v.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:at.x,y:at.y});
  await wait(400);await writeFile(join(directory,'click-result.json'),JSON.stringify(await v.evaluate('({notice:document.querySelector("#notice").textContent,element:document.elementFromPoint('+at.x+','+at.y+')?.tagName})')));await until(()=>v.evaluate('document.querySelector("#notice").textContent.includes("No hay contenido disponible para tu acceso en este lugar.")'),3000,'actual mesh click dispatch to ContentVisitor');
  await shot(v,'reading-room-click');views.push({click:at,result:'Actual CDP mouse gesture → live MML raycast → ContentVisitor.openNode; access absence reported; no authorized viewer claimed.'});
 }else{await shot(v,'arrival-desktop');await shot(v,'arrival-phone',{mobile:true});
 await walk(v,0,2,'main junction');await v.evaluate('window.beforeAerial=(()=>{const c=holodeckDevelopment.client.getCameraManager(),p=holodeckDevelopment.client.getLocalCharacterState().position,q=c.getCameraPosition();return{offset:{x:q.x-p.x,y:q.y-p.y,z:q.z-p.z},minFOV:c.minFOV,maxFOV:c.maxFOV,maxDistance:c.maxDistance}})()');await shot(v,'aerial',{aerial:true});
 // Restore normal main-camera distance after the explicitly diagnostic aerial.
 await v.evaluate('(()=>{const c=holodeckDevelopment.client.getCameraManager(),s=beforeAerial,p=holodeckDevelopment.client.getLocalCharacterState().position;c.minFOV=s.minFOV;c.maxFOV=s.maxFOV;c.maxDistance=s.maxDistance;c.reverseUpdateFromPositions({x:p.x+s.offset.x,y:p.y+s.offset.y,z:p.z+s.offset.z},c.getCameraRotation());})()');
 await walk(v,-3,2,'main west aisle');await walk(v,-3,0,'west ring gap');await walk(v,-6,0,'west ring crossing');await walk(v,-6,1.7,'preserved violet light bypass');await walk(v,-8,1.7,'west approach');await walk(v,-10,0,'west bridge entrance');await walk(v,-12,0,'west bridge');await shot(v,'west-bridge');
 await walk(v,-22,0,'west gallery');await walk(v,-24,0,'gallery aisle');await walk(v,-24,5.5,'gallery south approach');await walk(v,-22,5.5,'gallery south');await shot(v,'gallery-desktop');await shot(v,'gallery-phone',{mobile:true});await walk(v,-24,5.5,'gallery departure aisle');await walk(v,-24,0,'gallery departure');
 await walk(v,-22,0,'gallery junction');await walk(v,-10,0,'west bridge return');await walk(v,-8,1.7,'west approach return');await walk(v,-6,1.7,'violet light bypass return');await walk(v,-6,0,'ring return');await walk(v,-3,0,'main ring return');await walk(v,-3,2,'main aisle return');await walk(v,3,2,'control bypass');await walk(v,3,0,'east ring approach');await walk(v,13,0,'east bridge');await shot(v,'east-bridge');
 await walk(v,22,0,'east game');await walk(v,26,0,'game pedestal bypass');await walk(v,26,7,'game south approach');await walk(v,24,5.5,'game south');await shot(v,'game-desktop',{angle:1.2});await shot(v,'game-phone',{mobile:true,angle:1.2});await shot(v,'game-side',{angle:.4});
 }
 const errors=await v.evaluate('fixtureErrors');if(errors.length||originalLookups)throw Error('Unexpected browser error or human-original lookup');
 const evidence={schema:'holodeck.spatial-layout-browser/v1',qualification:surfacesOnly?'Actual MML renderer; arrival camera comparison and public fly-camera surface inspection. Avatar unchanged; no new traversal or interaction claimed. Local synthetic identity/native grants and sanitized public geometry.':'Actual MML renderer and grounded WASD route. Local synthetic identity/native grants; sanitized retained public geometry. Mobile images are viewport composition, not new device acceptance. Aerial is public camera inspection, not avatar traversal.',geometrySha256:createHash('sha256').update(geometryBytes).digest('hex'),preservedLights:Object.keys(geometry.entities).length-1,clickOnly,surfacesOnly,housesOnly,contentNodes,nativeReceipts,authorityReads,originalLookups,route,views,errors,elapsedMs:Date.now()-started};
 await writeFile(join(directory,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:true,views:views.length,walkSamples:route.length,elapsedMs:evidence.elapsedMs}));
}catch(error){await writeFile(join(directory,'failure.json'),JSON.stringify({error:error.message,route,views,nativeReceipts},null,2));throw error;}
finally{clearTimeout(deadline);for(const v of visitors){v.ws.close();await browser?.call('Target.disposeBrowserContext',{browserContextId:v.browserContextId}).catch(()=>{});}browser?.ws.close();runtime?.close();if(listener){listener.closeAllConnections();await new Promise(r=>listener.close(r));}await rm(stateDir,{recursive:true,force:true});await writeFile(join(directory,'worker-cleanup.json'),JSON.stringify({contextsDisposed:visitors.length,stateRemoved:true,socketRemoved:true,deadlineSeconds:240,evidenceBoundBytes:2097152}));}
