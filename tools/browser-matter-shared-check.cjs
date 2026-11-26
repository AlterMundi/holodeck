// Qualified receiving check for the shared Matter table using loopback fixture identity and CAD sources.
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {once}=require('node:events');
const {join,resolve}=require('node:path');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {HOLODECK_STAGE,HOLODECK_PLAYWRIGHT,HOLODECK_EVIDENCE_DIR,HOLODECK_CHROMIUM}=process.env;
if(!HOLODECK_STAGE||!HOLODECK_PLAYWRIGHT||!HOLODECK_EVIDENCE_DIR)
  throw Error('Select the built package, Playwright module and a bounded evidence directory');
const {chromium}=require(resolve(HOLODECK_PLAYWRIGHT));
const packageRoot=resolve(HOLODECK_STAGE),evidence=resolve(HOLODECK_EVIDENCE_DIR);
mkdirSync(evidence,{recursive:true});
(async()=>{
  process.env.HOLODECK_JSDOM_HELPERS=packageRoot+'/runtime/jsdom/lib/jsdom/living/helpers';
  process.env.HOLODECK_XHR_WORKER=packageRoot+'/src/xhr-sync-worker.mjs';
  const {createHolodeck}=await import(packageRoot+'/src/server.mjs');
  const foyer='compaii-vestibulo',lab='compaii-lab',matter='matter';
  const guest='human:matter-review',peer='human:matter-peer';
  const {COMPAII_HOUSE:house}=await import('../src/interior-art.mjs');
  const {COMPAII_BEING:owner}=await import('../src/avatar-registry.mjs');
  const {RoomStore}=await import('../src/room-store.mjs');
  const directory=mkdtempSync(join(tmpdir(),'holodeck-matter-'));
  new RoomStore(join(directory,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[
    {id:house,owner,revision:1,parcel:'parcel-west-1',facade:{color:'#226655',title:'Casa',width:2,depth:1,height:2}},
  ]});
  const definition=(id,title,level,entry,links)=>({id,title,level,entry,house,guests:[guest,peer],links:links.map(([kind,to])=>({kind,to}))});
  const gallery='compaii-galeria',tower='compaii-torre';
  const entries=['Alfa','Beta'].map((label,index)=>{
    const resource=(index?'d':'e').repeat(32),version=(index?'a':'f').repeat(64);
    const part=label.toLowerCase()+'-triangle';
    const gallery=JSON.stringify({scenes:[{id:'shape-'+label.toLowerCase(),title:label,version,units:'mm',
      parts:[{id:part,label:'Pieza '+label,color:index?'#bd6c49':'#007766',
        vertices:[[0,0,0],[1000+900*index,0,0],[300*index,1000,250*index]],faces:[[0,1,2]]}]}]});
    const live=JSON.stringify({schema:'dm.review-live/v1',gallery:'gallery.json',
      sha256:createHash('sha256').update(gallery).digest('hex')});
    return {label,resource,version,part,gallery,live};
  });
  function fixtureFile(path){
    const pieces=path.split('/');
    const entry=entries.find(item=>pieces.includes(item.resource));
    const file=pieces.at(-1);
    const body=file==='gallery.json'?entry?.gallery:file==='review-live.json'?entry?.live:null;
    return body?{body,version:entry.version}:null;
  }
  let peerCanEdit=true;
  const app=await createHolodeck({basePath:'/holodeck/',stateDir:directory,publicOrigin:'https://fixture.test',
    worldTerrain:'toroidal-terrain@1',artProfile:'compaii-atelier-v1',
    matterCollection:{room:matter,art:'matter-workshop-orbital-focused-v1',projects:[{id:'example',resources:entries.map(e=>e.resource)}]},
    interiorSpaces:[
      definition(foyer,'Vestíbulo',0,true,[['door',gallery],['portal',matter]]),
      definition(gallery,'Galería',0,false,[['door',foyer],['stair',lab],['portal',tower]]),
      definition(lab,'Laboratorio',-1,false,[['stair',gallery]]),
      definition(tower,'Torre',2,false,[['portal',gallery]]),
      definition(matter,'Materia',0,false,[['portal',foyer]]),
    ],
    async collectionSourceRequest(url){
      if(url.pathname==='/catalog.json')return Response.json({entries:entries.map(e=>({
        resource_ref:'dm:resource:v1:'+e.resource,kind:'artifact',model_review:true,title:e.label,version_ref:e.version,
      }))});
      const source=fixtureFile(url.pathname);
      return source?new Response(source.body,{headers:{'X-Home-Version':source.version}}):new Response('',{status:404});
    },
    nativeFactory:async()=>({contexts:{},availability:async()=>({available:true}),close(){},
      async conversationSurface(actor){return {schema:'holodeck.conversation-surface/v1',actorRef:actor.ref,
        beingRef:owner,homeRef:'home:'+'c'.repeat(32),binding:'b'.repeat(64),url:'https://fixture.test/conversation'};}}),
    identityResolver:async req=>req.headers.cookie?.includes('fixture=reviewer')?
      {id:guest,ref:guest,kind:'human',name:'Visitante',rights:['observe','edit']}:
      req.headers.cookie?.includes('fixture=peer')?{id:peer,ref:peer,kind:'human',name:'Par',
        rights:peerCanEdit?['observe','edit']:['observe']}:null});
  app.app.get('/works/:resource/:version/:file',(req,res)=>{
    const source=fixtureFile(req.path);
    if(!source)return res.sendStatus(404);
    res.set('X-Home-Version',source.version).type('application/json').send(source.body);
  });
  const server=app.app.listen(0,'127.0.0.1');
  server.prependListener('request',req=>{if(req.method==='POST')req.headers.origin='https://fixture.test';if(req.headers.cookie?.includes('fixture='))req.headers.cookie+='; __Host-home='+String(req.headers.cookie?.match(/fixture=(reviewer|peer)/)?.[1]??'visitor');});
  server.prependListener('upgrade',req=>{req.headers.origin='https://fixture.test';});
  await once(server,'listening');
  let browser;
  try{
    const url='http://127.0.0.1:'+server.address().port+'/holodeck/';
    browser=await chromium.launch({executablePath:HOLODECK_CHROMIUM||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
    const failures=[];
    async function open(actor,mobile){
      const viewport=mobile?{width:568,height:320}:{width:1200,height:800};
      const context=await browser.newContext({viewport,deviceScaleFactor:mobile?1.25:1.5,
        hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
      context.setDefaultTimeout(28000);
      await context.addCookies([{name:'fixture',value:actor,url}]);
      const tab=await context.newPage();
      tab.on('pageerror',error=>failures.push(error.message));
      await tab.bringToFront();
      await tab.goto(url+(mobile?'?graficos=livianos':''),{waitUntil:'domcontentloaded'});
      console.log('Moving fixture actor',actor);
      assert.equal(await move(tab,'outside',foyer),200);
      await tab.reload({waitUntil:'domcontentloaded'});
      const ready=title=>tab.waitForFunction(title=>window.holodeckDevelopment?.client.getLocalCharacterState()&&
        document.querySelector('#hud h1')?.textContent===title&&
        document.querySelector('#world-entry').hidden&&!document.body.classList.contains('room-transition'),
        title,{timeout:40000});
      await ready('Vestíbulo');
      const space=() => tab.evaluate(async()=>(await (await fetch('api/space?live=1')).json()));
      const approach=async position=>{
        await tab.evaluate(position=>{
          const c=holodeckDevelopment.client;
          c.updateConfig({spawnConfiguration:{spawnPosition:position,spawnYRotation:180}});
          c.respawn();
        },position);
        await tab.waitForFunction(({x,z})=>{
          const pos=holodeckDevelopment.client.getLocalCharacterState()?.position;
          return pos&&Math.hypot(pos.x-x,pos.z-z)<.22;
        },position);
      };
      const doorway=(await space()).exits.find(exit=>exit.to===matter)?.door;
      assert.ok(doorway);
      await approach(doorway);
      await tab.waitForFunction(()=>!document.querySelector('#house-door').hidden,null,{timeout:12000});
      await tab.keyboard.press('e');
      await ready('Materializador de Materia');
      console.log('Reached Matter',actor,(await space()).id,(await read(tab))?.revision);
      await approach({x:0,y:.12,z:1.4});
      await tab.waitForFunction(()=>document.querySelector('[data-spatial-hud-accessibility] [aria-label="Usar mesa"]'),null,{timeout:8000})
        .catch(async error=>{
          console.log('Table prompt state',actor,await tab.evaluate(()=>({
            hidden:document.querySelector('#world-entry')?.hidden,
            position:holodeckDevelopment.client.getLocalCharacterState()?.position,
            buttons:[...document.querySelectorAll('[data-spatial-hud-accessibility] button')].map(b=>b.getAttribute('aria-label')),
          })),await read(tab),failures);
          throw error;
        });
      await tab.keyboard.press('e');
      const controls=tab.getByRole('group',{name:'Mesa de trabajo',exact:true});
      const project=controls.getByRole('combobox',{name:'Proyecto',exact:true});
      await project.locator('option').filter({hasText:'Beta'}).waitFor({state:'attached',timeout:16000});
      return {tab,controls,project,ready,approach,space};
    }
    async function move(tab,from,to){
      return tab.evaluate(async({from,to})=>(await fetch('api/space',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({from,to})})).status,{from,to});
    }
    const read=tab=>tab.evaluate(async()=>(await (await fetch('api/space/collection')).json()).worktable);
    const status=(tab,body)=>tab.evaluate(async body=>(await fetch('api/space/collection',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status,body);
    const go=(view,name)=>view.controls.getByRole('button',{name,exact:true}).evaluate(el=>el.click());
    const select=(view,entry)=>view.project.selectOption({label:entry.label},{force:true});
    const waitProject=(view,value)=>view.tab.waitForFunction(value=>document.querySelector(
      '[data-spatial-hud-accessibility] select[aria-label="Proyecto"]')?.value===value,value,{timeout:12000});
    const waitPiece=(view,label)=>view.controls.getByRole('combobox',{name:'Pieza',exact:true})
      .locator('option').filter({hasText:label}).waitFor({state:'attached',timeout:15000});
    const share=async(view,action,expected,{keyboard=false}={})=>{
      await view.tab.bringToFront();
      const pending=view.tab.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/space/collection'));
      if(keyboard)await view.controls.getByRole('button',{name:action,exact:true}).press('Enter');
      else await go(view,action);
      const response=await pending;
      assert.equal(response.status(),204);
      assert.deepEqual(response.request().postDataJSON(),expected);
    };
    const camera=tab=>tab.evaluate(()=>{
      const state=holodeckDevelopment.client.getCameraManager().getCameraState();
      return [state.position.x,state.position.y,state.position.z,state.rotation.x,state.rotation.y,state.rotation.z,state.rotation.w];
    });
    const framebuffer=async tab=>tab.evaluate(()=>{
      const world=holodeckDevelopment.client.getRenderer().composer.renderer.domElement;
      const overlay=document.querySelector('canvas[data-hud-render-layer]');
      const bounds=canvas=>{
        const {left,top,width,height}=canvas.getBoundingClientRect();
        return {left,top,width,height};
      };
      return {world:bounds(world),overlay:bounds(overlay),worldWidth:world.width,worldHeight:world.height,
        hudWidth:overlay.width,hudHeight:overlay.height,dpr:devicePixelRatio,
        overlayIgnoresPointer:getComputedStyle(overlay).pointerEvents==='none'};
    });
    function checkFramebuffer({world,overlay,worldWidth,worldHeight,hudWidth,hudHeight,dpr,overlayIgnoresPointer},light){
      assert.ok(world.width>0&&world.height>0);
      assert.deepEqual(overlay,world);
      assert.equal(overlayIgnoresPointer,true);
      assert.equal(hudWidth,Math.round((world.left+world.width)*dpr)-Math.round(world.left*dpr));
      assert.equal(hudHeight,Math.round((world.top+world.height)*dpr)-Math.round(world.top*dpr));
      if(light){
        assert.ok(worldWidth<=world.width*.55+1);
        assert.ok(worldHeight<=world.height*.55+1);
        assert.ok(hudWidth>worldWidth&&hudHeight>worldHeight);
      }
    }
    const overlayRendered=tab=>tab.waitForFunction(()=>{
      const overlay=document.querySelector('canvas[data-hud-render-layer]');
      return overlay&&!overlay.hidden&&overlay.width>0&&overlay.width!==300&&overlay.getBoundingClientRect().width>0;
    });
    const [alpha,beta]=entries;
    const left=await open('reviewer',false);
    const right=await open('peer',true);
    await overlayRendered(left.tab);
    await overlayRendered(right.tab);
    const normalBuffer=await framebuffer(left.tab);
    const lightBuffer=await framebuffer(right.tab);
    assert.equal(normalBuffer.dpr,1.5);
    assert.equal(lightBuffer.dpr,1.25);
    checkFramebuffer(normalBuffer,false);
    checkFramebuffer(lightBuffer,true);
    await right.tab.setViewportSize({width:592,height:344});
    await right.tab.waitForFunction(width=>document.querySelector('canvas[data-hud-render-layer]')
      .getBoundingClientRect().width===width,592);
    const resizedBuffer=await framebuffer(right.tab);
    checkFramebuffer(resizedBuffer,true);
    assert.notEqual(resizedBuffer.hudWidth,lightBuffer.hudWidth);
    assert.equal((await read(left.tab)).revision,0);
    await select(left,alpha);
    await waitPiece(left,'Pieza Alfa');
    await share(left,'Compartir',{resource:alpha.resource,revision:0});
    await waitProject(right,alpha.resource);
    await waitPiece(right,'Pieza Alfa');
    assert.deepEqual(await read(right.tab),{revision:1,resource:alpha.resource,canShare:true});
    console.log('Desktop published Alfa and the touch table followed it');
    await left.tab.bringToFront();
    await select(left,beta);
    await waitPiece(left,'Pieza Beta');
    await select(left,alpha);
    await waitPiece(left,'Pieza Alfa');
    const cut=left.controls.getByRole('slider',{name:'Corte horizontal',exact:true});
    await cut.evaluate(el=>{el.value='64';el.dispatchEvent(new Event('change',{bubbles:true}));});
    await left.tab.waitForFunction(()=>document.querySelector('[data-spatial-hud-accessibility] input[aria-label="Corte horizontal"]')?.value==='64');
    const beforeCamera=await camera(left.tab);

    await right.tab.bringToFront();
    await select(right,beta);
    await waitPiece(right,'Pieza Beta');
    await go(right,'Mesa');
    const matterAction=(view,name)=>view.controls.getByRole('button',{name,exact:true});
    for(const [view,names] of [[left,['Seguir mesa','Señalar pieza','Hablar del modelo']],
      [right,['Compartir','Seguir','Despejar','Señalar','Hablar']]]){
      for(const name of names)await matterAction(view,name).waitFor({state:'attached'});
    }
    await right.tab.setViewportSize({width:568,height:320});
    await right.tab.waitForFunction(()=>holodeckDevelopment.hudWindow('matter-worktable')?.view.width===568);
    await right.tab.screenshot({path:join(evidence,'touch-table-actions.png')});
    await right.tab.evaluate(()=>{
      const overlay=document.querySelector('canvas[data-hud-render-layer]');
      const loss=overlay.getContext('webgl2').getExtension('WEBGL_lose_context');
      if(!loss)throw Error('Missing WebGL context-loss extension');
      window.fixtureRestoreMatterHud=()=>loss.restoreContext();
      loss.loseContext();
    });
    await right.tab.waitForFunction(()=>{
      const overlay=document.querySelector('canvas[data-hud-render-layer]');
      const world=holodeckDevelopment.client.getRenderer().composer.renderer.domElement;
      return overlay.hidden&&overlay.getContext('webgl2').isContextLost()&&!world.getContext('webgl2').isContextLost();
    });
    await share(right,'Compartir',{resource:beta.resource,revision:1},{keyboard:true});
    await right.tab.evaluate(()=>window.fixtureRestoreMatterHud());
    await overlayRendered(right.tab);
    checkFramebuffer(await framebuffer(right.tab),true);
    assert.deepEqual(await read(left.tab),{revision:2,resource:beta.resource,canShare:true});
    assert.equal(await left.project.inputValue(),alpha.resource);
    assert.equal(await cut.inputValue(),'64');
    const afterCamera=await camera(left.tab);
    assert.ok(beforeCamera.every((v,i)=>Math.abs(v-afterCamera[i])<.025));
    await left.tab.screenshot({path:join(evidence,'desktop-local-after-touch-publish.png')});
    await right.tab.screenshot({path:join(evidence,'touch-shared-beta.png')});
    console.log('Keyboard fallback published Beta on the touch layout; desktop inspection stayed local');
    assert.equal(await status(left.tab,{resource:alpha.resource,revision:1}),409);
    await go(left,'Seguir mesa');
    await waitProject(left,beta.resource);
    await waitPiece(left,'Pieza Beta');
    assert.equal(await cut.inputValue(),'100');

    peerCanEdit=false;
    assert.equal(await status(right.tab,{resource:null,revision:2}),403);
    assert.equal((await read(left.tab)).revision,2);
    peerCanEdit=true;
    await right.tab.bringToFront();
    await matterAction(right,'Despejar').and(right.tab.locator(':enabled')).waitFor({state:'attached'});
    // Follow mode shows Despejar as the full row beneath the Mesa tabs.
    const clearPoint={x:418,y:78};
    assert.equal(await right.tab.evaluate(({x,y})=>
      document.elementFromPoint(x,y)?.classList.contains('world-interaction-canvas'),clearPoint),true);
    await right.tab.evaluate(()=>{
      window.fixtureMatterTouch=null;
      document.addEventListener('pointerdown',event=>{
        window.fixtureMatterTouch={trusted:event.isTrusted,type:event.pointerType,
          canvas:event.target.classList.contains('world-interaction-canvas')};
      },{capture:true,once:true});
    });
    const clearing=right.tab.waitForResponse(response=>response.request().method()==='POST'&&
      response.url().endsWith('/api/space/collection'));
    await right.tab.touchscreen.tap(clearPoint.x,clearPoint.y);
    const cleared=await clearing;
    assert.equal(cleared.status(),204);
    assert.deepEqual(cleared.request().postDataJSON(),{resource:null,revision:2});
    assert.deepEqual(await right.tab.evaluate(()=>window.fixtureMatterTouch),{trusted:true,type:'touch',canvas:true});
    await waitProject(left,'');
    assert.equal((await read(left.tab)).revision,3);
    await right.tab.locator('canvas').first().focus();
    await right.tab.keyboard.press('Escape');
    await right.controls.waitFor({state:'detached'});
    assert.equal((await right.space()).id,matter);
    const returnDoor=(await right.space()).exits.find(exit=>exit.to===foyer)?.door;
    assert.ok(returnDoor);
    await right.approach(returnDoor);
    await right.tab.waitForFunction(()=>!document.querySelector('#house-door').hidden);
    await right.tab.keyboard.press('e');
    await right.ready('Vestíbulo');
    assert.equal((await right.space()).id,foyer);
    assert.equal(await right.tab.evaluate(async()=>(await fetch('api/space/collection')).status),404);
    assert.deepEqual(failures,[]);
    console.log(JSON.stringify({desktopPublished:true,keyboardPublishedOnTouchLayout:true,touchCleared:true,localCut:64,cameraIndependent:true,
      rejoinedSharedBeta:true,staleWrite:409,revokedEdit:403,clearedRevision:3,tableClosedInsideRoom:true,
      returnedThroughDoor:true,readAfterExit:404,overlayFallbackShare:true,
      hudFramebuffers:{normal:normalBuffer,light:lightBuffer,lightAfterResize:resizedBuffer}}));
  }finally{
    await browser?.close();
    app.close();server.closeAllConnections();
    await new Promise(done=>server.close(done));
    rmSync(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
