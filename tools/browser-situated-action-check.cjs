// Loopback qualification using the installed canonical web client and real
// Holodeck context ledger, world port and scene. Synthetic participants,
// writer/admission and final events. No provider or production requests.
const {createServer}=require('node:https');
const {readFileSync,writeFileSync}=require('node:fs');
const {createHash,randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const net=require('node:net');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {mkdtempSync,rmSync}=require('node:fs');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const root=join(__dirname,'..');
const {HOLODECK_PLAYWRIGHT,HOLODECK_STAGE,HOLODECK_CONVERSATION_RELEASE,HOLODECK_FIXTURE_TLS,HOLODECK_EVIDENCE_DIR}=process.env;
if(!HOLODECK_PLAYWRIGHT||!HOLODECK_STAGE||!HOLODECK_CONVERSATION_RELEASE||!HOLODECK_FIXTURE_TLS||!HOLODECK_EVIDENCE_DIR)
  throw Error('Select the installed browser/Conversation assets, existing package stage, local TLS and bounded evidence directory');
const {chromium}=require(resolve(HOLODECK_PLAYWRIGHT));
const stage=resolve(HOLODECK_STAGE);
const owner='dm:being:v1:'+'m'.repeat(43), guest='human:guest';

(async()=>{
  Object.assign(process.env,{HOLODECK_JSDOM_HELPERS:stage+'/runtime/jsdom/lib/jsdom/living/helpers',
    HOLODECK_XHR_WORKER:stage+'/src/xhr-sync-worker.mjs'});
  const [{createHolodeck},{RoomStore},{houseId}]=await Promise.all([
    import(stage+'/src/server.mjs'),import(root+'/src/room-store.mjs'),import(root+'/src/houses.mjs')]);
  const dir=mkdtempSync(join(tmpdir(),'holodeck-kits-browser-'));
  const path=join(dir,'world.sock'),house=houseId(owner);
  new RoomStore(join(dir,'houses')).save({schema:'holodeck.houses/v1',houses:[{
    id:house,owner,revision:1,parcel:'parcel-west-1',facade:{title:'Casa de prueba',color:'#355b62',width:2.1,depth:1.3,height:2.15},
  }],receipts:[]});
  let runtime,listener,conversation;
  const browsers=[],originals=[],situations=[],finals=[];
  let uploads=0,canonicalPosts=0;
  const canonicalRequests=[],presentationReads=[];
  const freeze=Object.freeze({actorRef:'human:player',beingRef:owner,homeRef:'home:'+'c'.repeat(32),
    binding:'b'.repeat(64),entry:[1,{},1,'synthetic-native-turn']});
  let releaseContext;
  const holdContext=new Promise(resolve=>{releaseContext=resolve});
  const binding='b'.repeat(64), home='home:'+'c'.repeat(32);
  let frameOrigin,worldOrigin;
  const web=join(process.env.HOLODECK_CONVERSATION_RELEASE,'dashboard/web');
  const headers={'Content-Type':'application/json'};
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const cursor={delivery:0,native:0,matrix:0,inbox:0,responses:0,publications:0};
  const {createConversationContexts}=await import(pathToFileURL(join(root,'src/conversation-context.mjs')));
  const worldRequest=async(operation,args,interactionId)=>{
    if(interactionId){
      const cli=join(root,'integrations/world_port.py');
      const argv=[cli,'--socket',path,'--interaction',interactionId,operation,'--json',JSON.stringify(args)];
      try{
        const {stdout}=await execFile('/usr/bin/python3',argv,{timeout:10000});
        return JSON.parse(stdout);
      }catch(error){
        if(error.code!==1||!error.stdout)throw error;
        const refusal=JSON.parse(error.stdout);
        if(refusal.ok!==false)throw error;
        return refusal;
      }
    }
    const stream=net.createConnection(path);
    await once(stream,'connect');stream.write(JSON.stringify({...(interactionId?{interactionId}:{ownNative:true}),operation,args})+'\n');
    let text='';for await(const block of stream)text+=block;
    return JSON.parse(text);
  };
  const act=args=>worldRequest('act',args);
  try{
    conversation=createServer({key:readFileSync(join(HOLODECK_FIXTURE_TLS,'key.pem')),cert:readFileSync(join(HOLODECK_FIXTURE_TLS,'cert.pem'))},async(req,res)=>{
      const url=new URL(req.url,frameOrigin);
      if(canonicalRequests.length<160)canonicalRequests.push(req.method+' '+url.pathname);
      if(url.pathname==='/'){
        const html=readFileSync(join(web,'index.html'),'utf8')
          .replace('<html lang="en"',`<html lang="en" data-shared-auth="true" data-style-policy="authored" data-surface-parent="${worldOrigin}" data-surface-visit="${url.searchParams.get('surface_visit')}"`)
          .replace('<body>','<body class="conversation-mode standalone-conversation conversation-surface">')
          .replace('<section id="conversation" hidden','<section id="conversation"')
          .replace(/<script src="https:\/\/telegram.org[^>]*><\/script>/,'');
        return res.writeHead(200,{'Content-Type':'text/html'}).end(html);
      }
      if(/^\/assets\/[a-z0-9._-]+$/.test(url.pathname)){
        const name=url.pathname.slice(8);
        return res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'application/octet-stream'}).end(readFileSync(join(web,name)));
      }
      let result={binding,csrf:'fixture-csrf',items:[],cursor:0,newest:0,more:false,state:'available'};
      if(url.pathname==='/api/interaction/access')result={csrf:'fixture-csrf',actor_ref:'human:player',label:'Simulated player'};
      if(url.pathname==='/api/interaction'){
        const newest={...cursor,native:finals.length};
        if(presentationReads.length<60)presentationReads.push({direction:url.searchParams.get('direction'),count:finals.length});
        result={...result,items:finals.map(({originalId,...card})=>card),cursor:newest,newest,
          can_send:true,can_speak:true,can_listen:true,activity:{state:'idle'},presentation_profile:'simple'};
      }
      if(url.pathname==='/api/interaction/inputs'&&req.method==='POST'){
        canonicalPosts++;
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>65536)return res.writeHead(413).end();chunks.push(chunk);}
        const original=JSON.parse(Buffer.concat(chunks));
        const source=situations.find(entry=>entry.id===original.id);
        if(original.binding!==binding||!source||originals.length>=2||originals.some(row=>row.id===original.id)||
          original.files?.length!==1||original.files[0].sha256!==source.file.sha256||
          original.files[0].file_id!==source.file.file_id){
          console.error('Canonical fixture refused',JSON.stringify({matchedSource:!!source,fileCount:original.files?.length,actorBinding:original.binding===binding}));
          return res.writeHead(409).end();
        }
        result={...original,phase:'accepted',received_at:new Date().toISOString(),entry:originals.length+1};
        originals.push(result);
      }
      if(url.pathname==='/api/interaction/inputs'&&req.method==='GET')result={...result,items:originals,cursor:originals.length,newest:originals.length,routing_choices:[]};
      res.writeHead(200,headers).end(JSON.stringify(result));
    });
    conversation.listen(0,'127.0.0.1');await once(conversation,'listening');
    frameOrigin='https://127.0.0.1:'+conversation.address().port;
    runtime=await createHolodeck({basePath:'/holodeck/',stateDir:dir,ownNative:true,worldSocket:path,
      worldSocketBeingRef:owner,nativeRoomAuthority:async()=>['observe','edit'],
      conversationOrigins:[frameOrigin],
      nativeFactory:async({room,stateDir,allowInteriorSource})=>{
        const transport={
          inspect:async actor=>{
            assert.equal(actor,freeze.actorRef);
            return structuredClone(freeze);
          },
          lookup:async({id})=>({state:originals.some(row=>row.id===id)?'observed':'absent'}),
          prepareContext:async request=>{
            const {id,observation}=request;
            assert.equal(observation.inputAssociation.humanInputId,id);
            const bytes=Buffer.from(JSON.stringify(observation));
            const file={file_id:randomUUID(),sha256:digest(bytes),name:'holodeck-situation.json',mime:'application/json',size:bytes.length};
            situations.push({id,capture:observation,file});uploads++;
            await holdContext;
            return {schema:'holodeck.prepared-conversation-context/v1',id,binding,entry_binding:freeze.entry,
              observation_id:observation.id,work_admitted:false,file};
          },
          status:async request=>{
            const original=originals.find(row=>row.id===request.id), source=situations.find(row=>row.id===request.id);
            const retained=!!original&&source?.capture.id===request.observationId&&
              original.files[0].file_id===request.contextFile.file_id&&original.files[0].sha256===request.contextFile.sha256;
            const finished=retained&&finals.some(card=>card.originalId===request.id);
            return {phase:finished?'completed':'working',nativeAcceptance:retained?'observed':'unavailable',
              retainedOriginal:retained,tracking:!finished};
          },
        };
        const contexts=await createConversationContexts({room,stateDir:join(stateDir,'contexts'),transport,allowInteriorSource});
        return {contexts,availability:async()=>({available:true}),authorizeWorldRequest:contexts.authorizeWorldRequest,
          conversationSurface:async actor=>({schema:'holodeck.conversation-surface/v1',
            actorRef:actor.id,beingRef:owner,homeRef:home,binding,url:frameOrigin+'/'})};
      },
      identityResolver:async req=>{
        const name=req.headers.cookie?.match(/(?:^|; )fixture=(guest|player)(?:;|$)/)?.[1];
        return name?{id:'human:'+name,ref:'human:'+name,kind:'human',rights:['observe','edit'],name}:null;
      }});
    listener=runtime.app.listen(0,'127.0.0.1');await once(listener,'listening');
    const base='http://127.0.0.1:'+listener.address().port+'/holodeck/';
    worldOrigin=new URL(base).origin;
    const definitions=[{id:'owned-foyer',house,title:'Sala de prueba',level:0,entry:true,guests:[guest,'human:player'],links:[]}];
    assert.equal((await act({type:'layout.publish',id:'trial-layout-01',house,expectedRevision:null,rooms:definitions})).ok,true);
    const publication={type:'design.put',id:'trial-design-01',room:'owned-foyer',kit:'listening-workshop',expectedRevision:null};
    assert.equal((await act(publication)).ok,true);
    const game={type:'garden.put',id:'trial-game-01',room:'owned-foyer',expectedRevision:null,title:'Jardín interior',
      play:{schema:'signal-garden/v1',minContributors:2,
        targets:[{x:0,z:1.3,radius:.45,color:'mint'},{x:0,z:2.6,radius:.45,color:'amber'}]}};
    assert.equal((await act(game)).ok,true);
    const launch=()=>chromium.launch({executablePath:'/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disk-cache-size=8388608','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows']});
    const errors=[];
    const open=async(who,mobile)=>{
      const browser=await launch();browsers.push(browser);
      const context=await browser.newContext({ignoreHTTPSErrors:true,...(mobile?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{viewport:{width:1000,height:700}})});
      await context.addInitScript(()=>{
        window.fixtureSurfaceEvents=[];
        addEventListener('message',e=>{
          if(e.data?.schema==='conversation.surface/v1'&&window.fixtureSurfaceEvents.length<30)
            window.fixtureSurfaceEvents.push(e.data.type);
        });
      });
      await context.addCookies([{name:'fixture',value:who,url:base}]);
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      assert.equal(await page.evaluate(async()=>{
        const response=await fetch('api/space',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({from:'outside',to:'owned-foyer',live:1})});
        return response.status;
      }),200);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.bringToFront();
      await page.waitForFunction(()=>document.querySelector('#hud h1')?.textContent==='Sala de prueba'&&
        !!window.holodeckDevelopment?.client.getLocalCharacterState()?.position&&!document.body.classList.contains('room-transition'),null,{timeout:45000}).catch(async error=>{
        console.error(who,await page.evaluate(()=>({heading:document.querySelector('#hud h1')?.textContent,
          className:document.body.className,visible:document.visibilityState,pose:globalThis.holodeckDevelopment?.client.getLocalCharacterState()?.position})),errors);
        throw error;
      });
      await page.locator('#indoor-garden summary').waitFor({timeout:15000});
      return page;
    };
    const touch=await open('guest',true),keyboard=await open('player',false);
    await touch.bringToFront();
    await touch.locator('#indoor-garden summary').tap();
    await touch.locator('#indoor-garden-colors button').filter({hasText:'ámbar'}).tap();
    await touch.locator('#indoor-garden-targets button').filter({hasText:'Círculo 2'}).tap();
    const progress=(page,value)=>page.waitForFunction(value=>document.querySelector('#indoor-garden-progress')?.textContent.includes(value),value,{timeout:20000}).catch(async e=>{
      console.error(await page.evaluate(async()=>({visible:document.visibilityState,
        hud:document.querySelector('#indoor-garden-progress')?.textContent,
        garden:await (await fetch('api/space/garden?room=owned-foyer')).json()})));
      throw e;
    });
    await progress(touch,'1/2 señales');
    await keyboard.bringToFront();
    await progress(keyboard,'1/2 señales');
    await keyboard.locator('#talk').click();
    const compose=keyboard.frameLocator('#shared-conversation iframe');
    await compose.locator('body').evaluate(async()=>{
      const until=performance.now()+10000;
      while(!fixtureSurfaceEvents.includes('connect')&&performance.now()<until)
        await new Promise(resolve=>setTimeout(resolve,50));
      if(!fixtureSurfaceEvents.includes('connect'))throw Error('World context handshake unavailable');
    });
    for(let step=0;!canonicalRequests.includes('GET /api/interaction/inputs')&&step<150;step++)
      await new Promise(resolve=>setTimeout(resolve,100));
    assert.ok(canonicalRequests.includes('GET /api/interaction/inputs'));
    await compose.locator('#conversation-message').fill('The first signal is in this room.');
    await compose.locator('#conversation-compose').evaluate(form=>form.requestSubmit());
    await keyboard.waitForFunction(()=>document.querySelector('#companion-status'),null);
    for(let attempt=0;!situations.length&&attempt<100;attempt++)await new Promise(r=>setTimeout(r,100));
    if(!situations.length)console.error('surface',await compose.locator('body').evaluate(el=>({
      events:window.fixtureSurfaceEvents, text:el.innerText.slice(-1400)
    })),await keyboard.evaluate(()=>window.fixtureSurfaceEvents),errors,canonicalRequests);
    assert.equal(situations.length,1);
    const original=situations[0];
    assert.equal(original.capture.place.id,'owned-foyer');
    assert.equal(original.capture.place.activity.progress.contributors,1);
    assert.equal(original.capture.place.activity.revision,1);
    assert.deepEqual([...new Set(original.capture.participants.map(p=>p.actor))].sort(),['human:guest','human:player']);
    assert.equal(originals.length,0);
    await keyboard.locator('#conversation-close').click();
    const frameHandle=await keyboard.locator('#shared-conversation iframe').elementHandle({timeout:10000});

    await keyboard.evaluate(()=>{holodeckDevelopment.client.getCameraManager().setOrbitAngle(Math.PI/2);});
    const before=await keyboard.evaluate(()=>holodeckDevelopment.client.getLocalCharacterState().position.z);
    await keyboard.keyboard.down('w');
    try{await keyboard.waitForFunction(before=>holodeckDevelopment.client.getLocalCharacterState().position.z<before-.9,before,{timeout:7500});}
    finally{await keyboard.keyboard.up('w');}
    releaseContext();
    for(let attempt=0;!originals.length&&attempt<100;attempt++)await new Promise(r=>setTimeout(r,100));
    assert.equal(originals.length,1);
    assert.equal((await act({type:'space.move',from:'outside',to:'owned-foyer'})).ok,true);
    const whileWalking=await keyboard.evaluate(()=>document.querySelector('#shared-conversation iframe')!==null&&
      document.querySelector('#conversation-panel').hidden);
    assert.equal(whileWalking,true);
    // The second synthetic input uses the ordinary context endpoint with the
    // same authorized browser. Retain it as a separate record in the fixture.
    const sibling=randomUUID();
    const siblingContext=await keyboard.evaluate(async({id,binding})=>{
      const reply=await fetch('api/conversation-contexts',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id,binding,view:{spaceId:'owned-foyer'}})});
      return {status:reply.status,body:await reply.json()};
    },{id:sibling,binding});
    assert.equal(siblingContext.status,200,JSON.stringify(siblingContext.body));
    assert.equal(siblingContext.body.work_admitted,false);
    originals.push({id:sibling,binding,text:'Fixture sibling original.',files:siblingContext.body.files,
      phase:'accepted',entry:2,received_at:new Date().toISOString()});
    const command={type:'garden.signal',id:'readable-native-signal',room:'owned-foyer',expectedRevision:1,index:0,color:'mint'};
    const effect=await worldRequest('act',command,original.id);
    assert.equal(effect.ok,true);
    assert.deepEqual(await worldRequest('result',{id:command.id},original.id),effect);
    assert.deepEqual(await worldRequest('act',command,original.id),effect);
    assert.equal((await worldRequest('result',{id:command.id},originals[1].id)).ok,false);
    assert.equal((await worldRequest('observe',{},original.id)).result.space.activity.progress.complete,true);
    await progress(keyboard,'¡Jardín completado!');
    await touch.bringToFront();
    await progress(touch,'¡Jardín completado!');
    for(const page of [touch,keyboard]){
      const markerCount=await page.locator('#indoor-garden-markers m-sphere').count();
      assert.equal(markerCount,2);
    }
    const primaryText='Fixture result: mint signal committed in the captured room. Two contributors completed the garden.';
    const siblingText='Fixture sibling result: read-only question completed.';
    function final(originalId,text){
      const entry=originals.find(row=>row.id===originalId);
      assert.ok(entry);
      entry.phase='completed';
      finals.push({originalId,id:'native:'+entry.entry,kind:'integrator_answer',revision:digest(text),
        sequence:finals.length+1,local_turn:entry.entry,native_turn:'synthetic-turn-'+entry.entry,
        native_item:'synthetic-final-'+entry.entry,label:'Controlled Conversation',preview:text,
        text_sha256:digest(text),text_characters:text.length,native_binding_current:true,current:true,
        observed_at:new Date().toISOString(),artifacts:[]});
    }
    final(originals[1].id,siblingText);
    await keyboard.bringToFront();
    await keyboard.locator('#talk').click();
    assert.ok(await frameHandle.evaluate(frame=>frame===document.querySelector('#shared-conversation iframe')));
    const answer=text=>compose.getByText(text,{exact:true});
    async function waitForAnswer(text){
      try{
        await compose.locator('#conversation-refresh').evaluate(button=>button.click());
        await answer(text).waitFor({timeout:25000});
      }catch(error){
        console.error('Canonical reply',JSON.stringify({presentationReads,errors,view:await compose.locator('body').evaluate(el=>({
          text:el.innerText.slice(-2000),cards:[...el.querySelectorAll('article.reply')].map(node=>[node.dataset.sourceId,node.innerText.slice(0,160)]),
          visibility:document.visibilityState
        }))}));
        throw error;
      }
    }
    await waitForAnswer(siblingText);
    assert.equal(await answer(primaryText).count(),0,'sibling completion settled the wrong original');
    assert.equal(originals[0].phase,'accepted');
    assert.equal(runtime.native.contexts.has(original.id),true);
    await keyboard.locator('#conversation-close').click();
    final(original.id,primaryText);
    await keyboard.locator('#talk').click();
    await waitForAnswer(primaryText);
    assert.equal(await answer(primaryText).count(),1);
    assert.equal(await answer(siblingText).count(),1);
    const reply=compose.locator('article[data-source-id="native:'+originals[0].entry+'"]');
    assert.equal(await reply.count(),1);
    assert.match(await reply.innerText(),/mint signal committed/);
    assert.equal(originals[0].text,'The first signal is in this room.');
    assert.equal(originals[0].files[0].sha256,original.file.sha256);
    assert.equal(await touch.locator('#shared-conversation iframe').count(),0);
    assert.ok(!(await touch.locator('body').innerText()).includes(primaryText));
    const replyText=reply.locator('.reply-text');
    await replyText.scrollIntoViewIfNeeded();
    assert.ok(await replyText.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),'canonical result was clipped or obscured after scrolling');
    await keyboard.screenshot({path:join(HOLODECK_EVIDENCE_DIR,'canonical-reply.png')});
    await keyboard.locator('#conversation-close').click();
    await touch.reload({waitUntil:'domcontentloaded'});await touch.bringToFront();
    await progress(touch,'¡Jardín completado!');
    assert.equal(await touch.locator('#hud h1').textContent(),'Sala de prueba');
    const recovered=await touch.evaluate(()=>fetch('api/space/garden?room=owned-foyer').then(r=>r.json()));
    assert.equal(recovered.revision,1);
    assert.equal(recovered.progress.contributors,2);
    assert.equal(recovered.progress.complete,true);
    assert.equal(original.capture.place.activity.progress.contributors,1);
    assert.equal(originals.length,2);
    assert.equal(uploads,2);
    assert.equal(canonicalPosts,1);
    await touch.screenshot({path:join(HOLODECK_EVIDENCE_DIR,'reconnected-game.png')});
    assert.deepEqual(errors,[]);
    const evidence={simulatedActors:true,actualModel:false,touchActions:true,keyboardMovement:true,matchingProgress:true,
      situatedRoom:original.capture.place.id,initialContributors:original.capture.place.activity.progress.contributors,
      canonicalOriginals:originals.length,canonicalPosts,machineAttachments:uploads,replyRenderedOnce:true,siblingCompletedFirst:true,
      sameConversationFrame:true,foreignReceiptDenied:true,worldReceipt:effect.result,recoveredComplete:recovered.progress.complete};
    writeFileSync(join(HOLODECK_EVIDENCE_DIR,'result.json'),JSON.stringify(evidence,null,2)+'\n');
    console.log(JSON.stringify(evidence));
  }finally{
    conversation?.closeAllConnections();conversation?.close();
    for(const browser of browsers)await browser.close();runtime?.close();
    if(listener){listener.closeAllConnections();await new Promise(done=>listener.close(done));}
    rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
