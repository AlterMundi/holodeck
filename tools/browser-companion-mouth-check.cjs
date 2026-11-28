const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT||'/home/debian/Projects/daimon-nexus/frontend/node_modules/playwright');
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

  await page.waitForFunction(()=>!!holodeckDevelopment.companion?.(),null,{timeout:30000});
  const face=async(level,name)=>{
    // speak continuously at `level` and frame the companion's face from the front
    await page.evaluate(level=>{window.__speak&&clearInterval(window.__speak);
      const set=()=>holodeckDevelopment.client&&window.holodeckSpeech?.(level);
      window.__speakLevel=level;},level);
    await page.evaluate(level=>{
      const c=holodeckDevelopment.companion();
      window.__speak=setInterval(()=>{holodeckDevelopment.companionSpeech(level);},50);
    },level);
    await page.waitForTimeout(900);
    const info=await page.evaluate(()=>{
      const c=holodeckDevelopment.companion(),r=holodeckDevelopment.client.getRenderer();
      let open=null;c.traverse(o=>{const i=o.morphTargetDictionary?.['mouth-open'];if(i!==undefined)open=o.morphTargetInfluences[i];});
      const cam=r.mmlCompositionScene.mmlScene.getGraphicsAdapter().getCamera();
      const head=c.getObjectByName('head'),p=head.getWorldPosition(head.position.clone());
      const q=c.getWorldQuaternion(c.quaternion.clone());
      const fwd=c.position.clone().set(0,0,1).applyQuaternion(q),up=c.position.clone().set(0,1,0).applyQuaternion(q);
      const eye=p.clone().addScaledVector(fwd,.9).addScaledVector(up,.05);
      window.__hold&&cancelAnimationFrame(window.__hold);
      const hold=()=>{cam.position.copy(eye);cam.up.copy(up);cam.lookAt(p);window.__hold=requestAnimationFrame(hold);};hold();
      return {open};
    });
    await page.waitForTimeout(300);
    console.log('face',name,JSON.stringify(info));
    await page.screenshot({path:join(process.env.SHOTS||__dirname,'mouth-'+name+'.png'),clip:{x:300,y:120,width:600,height:500}});
    return info;
  };
  const closed=await face(0,'closed');
  const open=await face(1,'speaking');
  assert.ok(open.open>.9,'speech opens the luminous mouth in the running client: '+open.open);
  assert.ok(closed.open<.05);
  assert.deepEqual(errors,[]);
  console.log('MOUTH CHECK PASS');
 }finally{await browser?.close();listener?.close();app?.close?.();rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
