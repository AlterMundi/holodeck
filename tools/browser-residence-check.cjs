const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT||'playwright');
const {mkdtempSync,rmSync,writeFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {once}=require('node:events');
(async()=>{
 const root=process.env.EXACT_SOURCE;
 const bundle=process.env.HUD_PACKAGE||root;
 if(process.env.HUD_PACKAGE){process.env.HOLODECK_JSDOM_HELPERS=bundle+'/runtime/jsdom/lib/jsdom/living/helpers';
 process.env.HOLODECK_XHR_WORKER=bundle+'/src/xhr-sync-worker.mjs';}
 const [{createHolodeck},{RoomStore},{ATELIER_PROFILE,ATELIER_ROOMS},{COMPAII_HOUSE}]=await Promise.all(
  ['server','room-store','compaii-atelier','interior-art'].map(file=>import((file==='server'?bundle:root)+'/src/'+file+'.mjs')));
 const {foyer,gallery,lab,tower}=ATELIER_ROOMS;
 const guest='human:beacon-hud-fixture';
 const owner='dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU';
 const directory=mkdtempSync(join(tmpdir(),'holodeck-beacon-'));
 const allowDoor=!process.env.NO_DOOR;
 const room=(id,title,level,entry,links)=>({id,title,level,entry,house:COMPAII_HOUSE,guests:allowDoor?[guest]:[],
  links:links.map(([kind,to])=>({kind,to}))});
 new RoomStore(join(directory,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[
  {id:COMPAII_HOUSE,owner,revision:1,parcel:'parcel-west-1',facade:{title:'Casa',color:'#4a746f',width:3.15,depth:1.5,height:2.65}}]});
 const matter='home-0ff5a86d4833282e-matter',sensorial='home-0ff5a86d4833282e-sensorial';
 const originals=[
   room(foyer,'Vestíbulo',0,true,[['door',gallery]]),
   room(gallery,'Galería',0,false,[['door',foyer],['stair',lab],['portal',tower]]),
   room(lab,'Laboratorio',-1,false,[['stair',gallery]]),
   room(tower,'Torre',2,false,[['portal',gallery]])];
 const adopted=[room(foyer,'Vestíbulo',0,true,[['door',gallery],['portal',sensorial],['portal',matter]]),
   ...originals.slice(1),room(sensorial,'Sensorial',0,false,[['portal',foyer]]),
   room(matter,'Manipulación de Materia',0,false,[['portal',foyer]])];
 new RoomStore(join(directory,'atelier-layout')).save({schema:'holodeck.interior-layouts/v1',
   layouts:[{house:COMPAII_HOUSE,revision:1,rooms:adopted}],receipts:[]});
 let app,listener,browser,peerBrowser;
 try{
  app=await createHolodeck({stateDir:directory,basePath:'/holodeck/',worldTerrain:'toroidal-terrain@1',artProfile:ATELIER_PROFILE,
    matterCollection:{room:matter,art:'matter-workshop-orbital-focused-v1',projects:[{id:'fixture',resources:['a'.repeat(32)]}]},
    collectionSourceRequest:async()=>new Response('',{status:404}),
    publicOrigin:'https://fixture.test',
    interiorSpaces:originals,
    interiorGuestAccess:()=>allowDoor,
    identityResolver:async req=>req.headers.cookie?.includes('fixture=beacon')?
      {id:guest,ref:guest,kind:'human',rights:['observe'],name:'Visitante'}:req.headers.cookie?.includes('fixture=follower')?
        {id:'human:pose-peer',ref:'human:pose-peer',kind:'human',rights:['observe'],name:'Par'}:null});
  listener=app.app.listen(Number(process.env.SKY_PORT??0),'127.0.0.1');
  listener.prependListener('request',req=>{if(req.method==='POST')req.headers.origin='https://fixture.test';});
  listener.prependListener('request',(req,res)=>{
    res.once('finish',()=>{
      if(res.statusCode>=400)console.log('receiver HTTP',res.statusCode,new URL(req.url,'http://fixture').pathname);
    });
  });
  listener.prependListener('upgrade',req=>{req.headers.origin='https://fixture.test';});
  await once(listener,'listening');
  const base='http://127.0.0.1:'+listener.address().port+'/holodeck/';
  browser=process.env.SKY_CDP?await chromium.connectOverCDP(process.env.SKY_CDP):await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const touch=process.argv[2]==='touch';
  const context=await browser.newContext({viewport:touch?{width:390,height:780}:{width:process.env.PI_PERF?660:1200,height:process.env.PI_PERF?445:740},hasTouch:touch,isMobile:touch});
  await context.addCookies([{name:'fixture',value:'beacon',url:base}]);
  const entry=await context.request.get(base,{headers:{Accept:'application/json'}});
  assert.equal(entry.status(),200);
  const page=await context.newPage(),errors=[];
  for(const tab of [page])tab.on('response',response=>{
    if(response.status()>=400)console.log('fixture HTTP',response.status(),new URL(response.url()).pathname);
    if(response.status()===404&&!new URL(response.url()).pathname.endsWith('/favicon.ico'))
      errors.push('Unexpected '+new URL(response.url()).pathname);
  });
  page.on('pageerror',error=>{errors.push(error.message);if(errors.length<4)console.log('page error',error.stack);});
  page.on('console',m=>{
    if(m.type()!=='error')return;
    console.log(m.text().slice(0,600));
    if(/Shader Error|shader is not compiled|GL_INVALID_OPERATION/.test(m.text()))errors.push(m.text().slice(0,600));
  });
  await page.addInitScript(fixed=>{
    const native=Date;
    Date=new Proxy(native,{apply:()=>new native(fixed).toString(),
      construct:(type,args)=>Reflect.construct(type,args.length?args:[fixed]),
      get:(type,key)=>key==='now'?()=>fixed:Reflect.get(type,key)});
  },Date.parse(process.env.SKY_CLOCK||'2026-11-25T22:40:00Z'));
  const tag=process.env.SKY_TAG||'baseline';
  const query=process.env.SKY_LIGHT?'?graficos=livianos':'';
  await page.goto(base+query,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    const r=window.holodeckDevelopment?.client.getRenderer();
    const sky=r?.mmlCompositionScene.group.parent.getObjectByName('Toroidal atmosphere');
    return document.querySelector('#world-entry').hidden&&sky?.material.uniforms.showCosmos.value===true;
  },null,{timeout:52000});
  const read=()=>page.evaluate(async()=>{
    const world=await fetch('api/space?live=1').then(r=>r.json());
    const game=holodeckDevelopment.client,player=game.getLocalCharacterState().position;
    const cm=game.getCameraManager(),view=cm.getCameraState(),dir=cm.getCameraRotation();
    const room=game.getRenderer().mmlCompositionScene;
    const camera=room.mmlScene.getGraphicsAdapter().getCamera();
    const door=world.entrances?.[0]?.door;
    if(!door)return {space:world.id,theta:cm.theta,door:null};
    const p=camera.position.clone().set(door.x,door.y+.8,door.z);
    const forward=camera.getWorldDirection(camera.position.clone());
    const angle=Math.acos(forward.dot(p.clone().sub(camera.position).normalize()))*180/Math.PI;
    return {space:world.id,door,player:[player.x,player.y,player.z],eye:[view.position.x,view.position.y,view.position.z],
      theta:cm.theta,yaw:dir,forward:forward.toArray(),portalNDC:p.project(camera).toArray(),angle,
      floorMesh:Boolean(room.group.getObjectByName('Toroidal terrain'))};
  });
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('m-model[id^=facade-]'))
    .some(model=>model.modelGraphics?.hasLoadedModel()),null,{timeout:30000});
  await page.waitForTimeout(400);
  if(process.env.SKY_CDP){
    const adapter=await page.evaluate(()=>{
      const gl=holodeckDevelopment.client.getRenderer().composer.renderer.getContext();
      const e=gl.getExtension('WEBGL_debug_renderer_info');
      return e&&gl.getParameter(e.UNMASKED_RENDERER_WEBGL);
    });
    assert.match(adapter,process.env.PI_PERF?/V3D|Broadcom/i:/RTX 2060/);
    console.log('WebGL adapter:',adapter);
  }
  const terrain=await import(root+'/src/toroidal-terrain.mjs');
  const R=terrain.TOROIDAL_RESIDENCE;
  // (u, v) for palace-local Blender (x, y)
  const at=(x,y)=>{let u=R.u,v=R.v;for(let k=0;k<40;k++){const a=terrain.residenceLocal(u,v),d=1e-7,b=terrain.residenceLocal(u+d,v),c=terrain.residenceLocal(u,v+d);
    const j=[[(b.x-a.x)/d,(c.x-a.x)/d],[(b.y-a.y)/d,(c.y-a.y)/d]],ex=x-a.x,ey=y-a.y,det=j[0][0]*j[1][1]-j[0][1]*j[1][0];
    u+=(j[1][1]*ex-j[0][1]*ey)/det;v+=(-j[1][0]*ex+j[0][0]*ey)/det;}return {u,v};};
  const local=async()=>{const p=await page.evaluate(()=>{const q=holodeckDevelopment.client.getLocalCharacterState().position;return [q.x,q.y,q.z];});
    const c=terrain.terrainCoordinates(p);return {...terrain.residenceLocal(c.u,c.v),height:c.height};};
  // facing: the palace entrance (+Y in Blender is north); theta chosen by search below
  const place=async(x,y,theta)=>{
    const {u,v}=at(x,y),p=terrain.terrainPosition(u,v,terrain.terrainElevation(u,v)+.17);
    await page.evaluate(({p,theta})=>{const game=holodeckDevelopment.client;
      game.updateConfig({spawnConfiguration:{spawnPosition:{x:p[0],y:p[1],z:p[2]},spawnYRotation:0,respawnTrigger:{minY:-2500}}});
      game.respawn();game.getCameraManager().setOrbitAngle(theta);},{p,theta});
    await page.waitForFunction(p=>{const q=holodeckDevelopment.client.getLocalCharacterState().position;return Math.hypot(q.x-p[0],q.y-p[1],q.z-p[2])<.9;},p,{timeout:15000});
    await page.waitForTimeout(800);
  };
  const shot=async name=>{console.log('shot',name,JSON.stringify(await local()));await page.screenshot({path:join(process.env.SHOTS||__dirname,'residence-'+name+'.png')});};
  await place(0,-60,0);
  await page.waitForFunction(()=>{const g=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group.parent;
    const r=g.getObjectByName('Residencia de la Nobleza IA');return r?.visible&&r.children.length>=2;},null,{timeout:40000});
  // measure the W heading at two orbit angles and solve for the one pointing to +Y (into the palace)
  const walk=async(theta,ms=2500)=>{await place(0,-80,theta);const a=await local();
    await page.keyboard.down('KeyW');await page.waitForTimeout(ms);await page.keyboard.up('KeyW');const b=await local();
    return {dx:b.x-a.x,dy:b.y-a.y};};
  let best={theta:0,score:-1e9};
  for(let k=0;k<16;k++){const theta=k*Math.PI/8,w=await walk(theta,1800);const score=w.dy-Math.abs(w.dx);
    if(score>best.score)best={theta,score,w};}
  for(const d of [-.2,-.1,.1,.2]){const theta=best.theta+d,w=await walk(theta,1800);const score=w.dy-Math.abs(w.dx);
    if(score>best.score)best={theta,score,w};}
  console.log('heading',best);
  await place(0,-75,best.theta);await shot('approach');
  await place(-40,-95,best.theta+Math.PI/6);await shot('three-quarter');
  const walkUntil=async(x,y0,target,limit=100)=>{await place(x,y0,best.theta);let p;
    await page.keyboard.down('KeyW');
    try{for(let i=0;i<limit;i++){await page.waitForTimeout(500);p=await local();if(i%4==0)console.log('  at',p.x.toFixed(2),p.y.toFixed(2),p.height.toFixed(2));if(p.y>target)break;}}finally{await page.keyboard.up('KeyW');}
    return p;};
  const stair=await walkUntil(0,-54,-37.5);
  console.log('stair',JSON.stringify(stair));
  assert.ok(stair.y>-37.5,'climbed the fan stair to the atrium: '+stair.y);
  await shot('atrium');
  const gate=await walkUntil(0,-35,-23);
  console.log('through portal',JSON.stringify(gate));
  assert.ok(gate.y>-23,'walked through the open portal into the hall: '+gate.y);
  const hall=await walkUntil(0,-23,-11);
  console.log('into the inner ring',JSON.stringify(hall));
  assert.ok(hall.y>-11,'crossed the ring corridor and the drum wall opening: '+hall.y);
  await shot('hall');
  // keep walking north: the drum wall / core ring must stop or pass only via openings
  await place(0,-17,best.theta);
  await page.keyboard.down('KeyW');await page.waitForTimeout(6000);await page.keyboard.up('KeyW');
  const core=await local();console.log('core',JSON.stringify(core));await shot('core');
  // a chamber wall must stop the avatar: walk east from the corridor at radius ~16 toward the room ring
  await place(16.2,0,best.theta+Math.PI/2);
  await page.keyboard.down('KeyW');await page.waitForTimeout(4000);await page.keyboard.up('KeyW');
  const wall=await local();console.log('wall',JSON.stringify(wall),Math.hypot(wall.x,wall.y));
  await shot('corridor');
  assert.ok(Math.hypot(wall.x,wall.y)<18.9,'the chamber ring wall stops the walk');
  assert.deepEqual(errors,[]);
  console.log('RESIDENCE CHECK PASS');
 }finally{await browser?.close();listener?.close();app?.close?.();rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
