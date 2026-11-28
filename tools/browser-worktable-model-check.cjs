const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT || 'playwright');
const {mkdtempSync,rmSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {once}=require('node:events');
(async()=>{
 const root=process.env.EXACT_SOURCE;
 const bundle=process.env.HUD_PACKAGE;
 if(bundle){
   process.env.HOLODECK_JSDOM_HELPERS=bundle+'/runtime/jsdom/lib/jsdom/living/helpers';
   process.env.HOLODECK_XHR_WORKER=bundle+'/src/xhr-sync-worker.mjs';
 }
 const [{createHolodeck},{RoomStore},{houseId}]=await Promise.all(
  ['server','room-store','houses'].map(file=>import((file==='server'&&bundle?bundle:root)+'/src/'+file+'.mjs')));
 const directory=mkdtempSync(join(tmpdir(),'holodeck-matter-'));
 const owner='dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU',house=houseId(owner);
 const guest='human:matter-fixture', reader='human:matter-peer';
 const fixture=process.env.FIXTURE;
 const editions=JSON.parse(readFileSync(join(fixture,'editions.json')));
 const resource=editions[0].resource;
 let selected=editions[0],damaged=false,revoked=false;
 new RoomStore(join(directory,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[
  {id:house,owner,revision:1,parcel:'parcel-west-1',facade:{color:'#226655',title:'Casa',width:2,depth:1,height:2}},
 ]});
 let app,listener,browser,remoteBrowser,peerContext;
 try{
  app=await createHolodeck({stateDir:directory,publicOrigin:'https://fixture.test',basePath:'/holodeck/',worldTerrain:'toroidal-terrain@1',
    matterCollection:{room:'matter',art:'matter-workshop-orbital-focused-v1',projects:[{id:'guitar',resources:[resource]}]},
    interiorSpaces:[
      {id:'foyer',house,title:'Vestíbulo',entry:true,level:0,guests:[guest,reader],links:[{kind:'door',to:'matter'}]},
      {id:'matter',house,title:'Manipulación de Materia',entry:false,level:0,guests:[guest,reader],links:[{kind:'door',to:'foyer'}]},
    ],
    identityResolver:async req=>req.headers.cookie?.includes('fixture=visitor')?
      {id:guest,kind:'human',rights:['observe','edit'],name:'Visitante'}:
      req.headers.cookie?.includes('fixture=peer')?{id:reader,kind:'human',rights:['observe'],name:'Compañero'}:null,
    collectionSourceRequest:async (url,{headers})=>{
      if(revoked&&headers.Cookie.endsWith("peer"))return url.pathname==="/catalog.json"?Response.json({entries:[]}):new Response("",{status:404});
      if(url.pathname==='/catalog.json')return Response.json({entries:[
        {kind:'artifact',model_review:true,resource_ref:'dm:resource:v1:'+resource,
          title:'Estudio de soporte',version_ref:selected.version}
      ]});
      const entry=editions.find(item=>url.pathname==='/works/'+item.resource+'/'+item.version+'/review-live.json');
      if(!entry)return new Response('',{status:404});
      return new Response(readFileSync(join(fixture,entry.version,'review-live.json')),{headers:{'X-Home-Version':entry.version}});
    },
  });
  app.app.get('/works/:resource/:version/:file',(req,res)=>{
    const edition=editions.find(item=>item.version===req.params.version&&item.resource===req.params.resource);
    const file=req.params.file;
    if(!edition||(revoked&&req.headers.cookie?.includes('fixture=peer'))||!/^review-live\.json$|^gallery\.json$|^[a-z0-9._-]+\.glb$/.test(file))return res.sendStatus(404);
    try{res.set('X-Home-Version',edition.version).type(file.endsWith('.glb')?'model/gltf-binary':'application/json').send(readFileSync(join(fixture,edition.version,file)));}
    catch(error){if(error.code==='ENOENT')return res.sendStatus(404);throw error;}
  });
  listener=app.app.listen(Number(process.env.MATTER_PORT??0),'127.0.0.1');
  // Reproduce the test origin at the loopback ingress for both transports.
  listener.prependListener('request',req=>{
    if(req.method==='POST')req.headers.origin='https://fixture.test';
    const identity=req.headers.cookie?.match(/fixture=(visitor|peer)/)?.[1];
    if(identity)req.headers.cookie+='; __Host-home='+identity;
  });
  listener.prependListener('upgrade',req=>{req.headers.origin='https://fixture.test';});
  await once(listener,'listening');
  const base='http://127.0.0.1:'+listener.address().port+'/holodeck/';
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const touch=false;
  const context=await browser.newContext({viewport:{width:1200,height:740},deviceScaleFactor:1});
  remoteBrowser=context;
  await context.addCookies([{name:'fixture',value:'visitor',url:base}]);
  const page=await context.newPage(),errors=[];
  await page.addInitScript(fixed=>{
    const native=Date;
    Date=new Proxy(native,{
      apply:()=>new native(fixed).toString(),
      construct:(type,args)=>Reflect.construct(type,args.length?args:[fixed]),
      get:(type,key)=>key==='now'?()=>fixed:Reflect.get(type,key),
    });
  },Date.parse(process.env.SHADOW_CLOCK||'2026-11-25T15:00:00Z'));
  const measure=async scene=>{
    await page.bringToFront();
    await page.waitForFunction(()=>document.visibilityState==='visible');
    await page.waitForTimeout(900);
    const evidence=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const game=holodeckDevelopment.client,world=game.getRenderer(),composer=world.composer;
      const webgl=composer.renderer,gl=webgl.getContext();
      const debug=gl.getExtension('WEBGL_debug_renderer_info');
      const adapter=debug&&gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      if(!/NVIDIA.*RTX 2060/.test(adapter))return reject(Error('Unexpected WebGL adapter: '+adapter));
      const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if(!timer)return reject(Error('GPU timer unavailable'));
      const render=composer.render,autoReset=webgl.info.autoReset;
      const samples=[],pending=[];
      let previous,frame=0,finished=false,issued=0,skipped=0,disjoint=0;
      const collect=()=>{
        if(gl.getParameter(timer.GPU_DISJOINT_EXT)){
          disjoint+=pending.length;
          for(const {query} of pending.splice(0))gl.deleteQuery(query);
          return;
        }
        while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
          const {query,sample}=pending.shift();
          sample.gpu=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
          gl.deleteQuery(query);
        }
      };
      const deadline=setTimeout(()=>finish(Error('Insufficient live frames')),15000);
      function finish(error){
        if(finished)return;
        finished=true;
        clearTimeout(deadline);
        if(composer.render===sampleFrame)composer.render=render;
        webgl.info.autoReset=autoReset;
        for(const {query} of pending)gl.deleteQuery(query);
        if(error)return reject(error);
        const camera=game.getCameraManager().getCameraState(),player=game.getLocalCharacterState().position;
        resolve({adapter,samples,issued,skipped,disjoint,undrained:pending.length,
          camera:[camera.position.x,camera.position.y,camera.position.z],player:[player.x,player.y,player.z]});
      }
      function sampleFrame(){
        if(gl.isContextLost()||game.getRenderer()!==world)return finish(Error('World renderer changed'));
        collect();
        frame++;
        if(frame>180){
          render.call(this);
          if(!pending.length||frame>195)finish();
          return;
        }
        if(frame<=30){render.call(this);return;}
        const now=performance.now();
        const sample={frame,state:`${gl.drawingBufferWidth}x${gl.drawingBufferHeight}/${webgl.shadowMap.enabled}/${webgl.shadowMap.type}`,
          interval:previous===undefined?null:now-previous};
        previous=now;samples.push(sample);
        const query=pending.length<8&&!gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)?gl.createQuery():null;
        if(query){gl.beginQuery(timer.TIME_ELAPSED_EXT,query);issued++;}
        else skipped++;
        webgl.info.reset();
        try{render.call(this);}
        catch(error){finish(error);}
        finally{
          if(query){
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            if(finished)gl.deleteQuery(query);
            else pending.push({query,sample});
          }
          sample.cpu=performance.now()-now;
          sample.calls=webgl.info.render.calls;
          sample.triangles=webgl.info.render.triangles;
        }
      }
      webgl.info.autoReset=false;
      gl.getParameter(timer.GPU_DISJOINT_EXT);
      composer.render=sampleFrame;
    }));
    console.log('BENCH '+JSON.stringify({scene,clock:process.env.SHADOW_CLOCK||'2026-11-25T15:00:00Z',
      tag:process.env.CAPTURE_TAG,profile:process.env.HUD_NORMAL?'normal':'lightweight',...evidence}));
    await page.screenshot({path:join(__dirname,process.env.CAPTURE_TAG+'-'+scene+'-'+(process.env.HUD_NORMAL?'normal':'light')+'.png')});
  };
  page.on('pageerror',error=>{errors.push(error.message);if(errors.length<3)console.log('pageerror',error.stack)});
  page.on('console',message=>{if(message.type()==='error')console.log('console',message.text());});
  const room=()=>page.evaluate(async()=>(await fetch('api/space?live=1')).json());
  const pose=()=>page.evaluate(()=>({...window.holodeckDevelopment.client.getLocalCharacterState().position}));
  const ready=title=>page.waitForFunction(t=>document.querySelector('#hud h1')?.textContent===t &&
    document.querySelector('#world-entry').hidden &&!document.body.classList.contains('room-transition'),title,{timeout:28000}).catch(async error=>{
      console.log('waiting for',title,await page.evaluate(()=>({title:document.querySelector('#hud h1')?.textContent,
        entry:document.querySelector('#world-entry')?.hidden,entryStatus:document.querySelector('#world-entry-status')?.textContent,
        body:document.body.className, player:window.holodeckDevelopment?.client.getLocalCharacterState()?.position,
        roomExists:!!document.getElementById('foyer'), errors:document.querySelector('#notice')?.textContent})));
      throw error;
    });
  const spawn=async (x,z)=>{
    await page.evaluate(({x,z})=>{
      const game=window.holodeckDevelopment.client;
      game.updateConfig({spawnConfiguration:{spawnPosition:{x,y:.105,z},spawnYRotation:180}});
      game.respawn();
    },{x,z});
    await page.waitForFunction(({x,z})=>{
      const p=window.holodeckDevelopment?.client.getLocalCharacterState()?.position;
      return p&&Math.hypot(p.x-x,p.z-z)<.09&&Math.abs(p.y-.1)<.05;
    },{x,z},{timeout:11000});
  };
  const faceForward=async()=>{
    await page.evaluate(()=>{
      document.activeElement?.blur();
      const c=holodeckDevelopment.client.getCameraManager(),t=c.target;
      c.reverseUpdateFromPositions({x:t.x,y:t.y+1.15,z:t.z+2.8},c.getCameraRotation());
      c.setOrbitAngle(Math.PI/2);
    });
    await page.waitForFunction(()=>{
      const game=holodeckDevelopment.client,p=game.getLocalCharacterState().position,
        eye=game.getCameraManager().getCameraState().position;
      return eye.z-p.z>.06 && Math.abs(eye.x-p.x)<Math.max(.05,(eye.z-p.z)*.12);
    },null,{timeout:9000});
  };
  const walk=async (key,duration)=>{
    await page.keyboard.down(key);
    try{await page.waitForTimeout(duration);}
    finally{await page.keyboard.up(key);}
    await page.waitForTimeout(100);
  };
  const enter=async tab=>{
    const session=await tab.request.get(base,{headers:{Accept:'application/json'}});
    assert.equal(session.status(),200);
    const admission=await tab.request.post(base+'api/space',{data:{from:'outside',to:'matter',live:1}});
    assert.equal(admission.status(),200);
    await tab.goto(base+(process.env.HUD_NORMAL?'':'?graficos=livianos'),{waitUntil:'domcontentloaded'});
    await tab.waitForFunction(()=>document.querySelector('#hud h1')?.textContent==='Manipulación de Materia'&&
      document.querySelector('#world-entry').hidden&&!document.body.classList.contains('room-transition'),null,{timeout:46000}).catch(async err=>{
      console.log('entry stalled',await tab.evaluate(()=>({title:document.querySelector('#hud h1')?.textContent,
        entry:document.querySelector('#world-entry')?.hidden,msg:document.querySelector('#world-entry-status')?.textContent,
        body:document.body.className,loc:window.holodeckDevelopment?.client.getLocalCharacterState()?.position,
        room:document.querySelector('m-model#room-art')?.modelGraphics?.hasLoadedModel()})));
      throw err;
    });
    const space=await tab.evaluate(async()=>(await fetch('api/space?live=1')).json());
    const bench=space.objects.find(x=>x.id==='worktable').position;
    await tab.evaluate(({x,z})=>{
      const game=holodeckDevelopment.client;
      game.updateConfig({spawnConfiguration:{spawnPosition:{x,y:.105,z:z+1.45},spawnYRotation:180}});
      game.respawn();
    },bench);
  };
  const a11y=tab=>tab.locator('[data-spatial-hud-accessibility]');
  const activate=async (tab,byTouch=false)=>{
    await a11y(tab).getByRole('button',{name:'Usar mesa'}).waitFor({state:'attached',timeout:10000}).catch(async error=>{
      console.log('toolbelt state',await tab.evaluate(()=>({hud:document.querySelector('[data-spatial-hud-accessibility]')?.outerHTML,
        body:document.body.className,pos:holodeckDevelopment.client.getLocalCharacterState()?.position,dialogs:[...document.querySelectorAll('dialog[open]')].map(el=>el.id),
        notice:document.querySelector('#notice').textContent,legacy:document.querySelector('#dock').outerHTML})));
      throw error;
    });
    assert.equal(await tab.locator('body').evaluate(b=>b.classList.contains('is-operating-matter')),false);
    const {width,height}=tab.viewportSize(),x=width/2;
    const y=height-22-.125*286;
    assert.equal(await tab.locator('#dock').isVisible(),false);
    const map=tab.getByRole('button',{name:'Minimapa',exact:true});
    if(await map.isEnabled()){
      await map.evaluate(el=>el.click());
      await tab.waitForFunction(()=>document.querySelector('#space-travel').open);
      await tab.keyboard.press('Escape');
      // Close via the same A2UI action if focus belongs to the game canvas.
      if(await tab.locator('#space-travel').evaluate(el=>el.open))await map.evaluate(el=>el.click());
      await tab.waitForFunction(()=>!document.querySelector('#space-travel').open);
    }
    await tab.waitForFunction(width=>Array.from(document.querySelectorAll('canvas[aria-hidden=true]')).some(canvas=>
      canvas.style.position==='fixed'&&canvas.getBoundingClientRect().width===width&&
      canvas.width===Math.round(width*Math.min(2,devicePixelRatio))),width);
    await tab.screenshot({path:join(__dirname,byTouch?'hud-before-touch.png':'hud-before-desktop.png')});
    console.log('target',await tab.evaluate(({x,y})=>document.elementFromPoint(x,y)?.outerHTML.split('>')[0],{x,y}));
    if(byTouch)await tab.touchscreen.tap(width*.66,height-120);
    else {
      await a11y(tab).getByRole('button',{name:'Usar mesa',exact:true}).focus();
      await tab.keyboard.press('Enter');
    }
    await tab.waitForFunction(()=>document.body.classList.contains('is-operating-matter'),null,{timeout:6000});
    await tab.screenshot({path:join(__dirname,byTouch?'hud-after-touch.png':'hud-after-desktop.png')});
    console.log('opened',byTouch?'touch':'desktop');
  };

  await enter(page);
  await activate(page,false);
  const bench=a11y(page);
  await bench.getByRole('combobox',{name:'Proyecto'}).selectOption(resource);
  await page.waitForFunction(()=>{
    const m=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group.getObjectByName('collection-worktable-model');
    return !!m?.getObjectByName('collection-worktable-presentation');
  },null,{timeout:40000});
  const sample=()=>page.evaluate(()=>{
    const m=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group.getObjectByName('collection-worktable-model');
    const p=m.getObjectByName('collection-worktable-presentation');let skinned=0,textured=0,bone=null;
    p.traverse(n=>{if(n.isSkinnedMesh)skinned++;if(n.material?.map)textured++;if(n.isBone&&n.name==='spine_03')bone=n.quaternion.toArray();});
    return {skinned,textured,bone};
  });
  const a=await sample();await page.waitForTimeout(1200);const b=await sample();
  console.log('presentation',JSON.stringify({a,b}));
  assert.ok(a.skinned>0&&a.textured>0,'skinned and textured');
  assert.ok(a.bone.some((v,i)=>Math.abs(v-b.bone[i])>1e-4),'the clip animates the skeleton on the table');
  await page.screenshot({path:join(process.env.SHOTS||__dirname,'mesa-explorer.png')});
  // the A2UI worktable HUD switches the clip
  await bench.getByRole('combobox',{name:'Animación'}).selectOption('hero_landing');
  await page.waitForFunction(()=>{const m=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group.getObjectByName('collection-worktable-model');
    return m?.getObjectByName('collection-worktable-presentation')?.userData.clip==='hero_landing';},null,{timeout:5000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:join(process.env.SHOTS||__dirname,'mesa-explorer-landing.png')});
  const pelvis=await page.evaluate(()=>{const m=holodeckDevelopment.client.getRenderer().mmlCompositionScene.group.getObjectByName('collection-worktable-model');
    let y=null;m.traverse(n=>{if(n.isBone&&n.name==='pelvis')y=n.getWorldPosition(n.position.clone()).y-m.position.y;});return y;});
  console.log('pelvis after landing clip',pelvis);
  assert.deepEqual(errors,[]);
  console.log('MESA CHECK PASS');
 }finally{await browser?.close();listener?.close();app?.close?.();rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
