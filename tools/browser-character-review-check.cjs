// Verify the packaged world with two independent visitors and an own-native actor.
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {createConnection}=require('node:net');
const {randomUUID}=require('node:crypto');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {pathToFileURL}=require('node:url');

const {HOLODECK_STAGE,HOLODECK_PLAYWRIGHT,HOLODECK_EVIDENCE_DIR,HOLODECK_CHROMIUM}=process.env;
if(!HOLODECK_STAGE||!HOLODECK_PLAYWRIGHT||!HOLODECK_EVIDENCE_DIR)
  throw Error('Select the built package, Playwright module and a bounded evidence directory');
const {chromium}=require(resolve(HOLODECK_PLAYWRIGHT));
const stage=resolve(HOLODECK_STAGE),evidence=resolve(HOLODECK_EVIDENCE_DIR);
const visitor='human:character-review',peer='human:character-peer';
const foyer='compaii-vestibulo',studio='compaii-character-studio',matter='matter';
const lab='compaii-lab',gallery='compaii-galeria',tower='compaii-torre';
const origin='https://fixture.test';
const conversationURL=origin+'/conversation-fixture/';
const binding='b'.repeat(64);

async function moveVisitor(page,from,to){
  return page.evaluate(async body=>(await fetch('api/space',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status,{from,to});
}

async function main(){
  process.env.HOLODECK_JSDOM_HELPERS=join(stage,'runtime/jsdom/lib/jsdom/living/helpers');
  process.env.HOLODECK_XHR_WORKER=join(stage,'src/xhr-sync-worker.mjs');
  const [{createHolodeck},{RoomStore},{COMPAII_HOUSE:house},{COMPAII_BEING:owner},{createConversationContexts}]=await Promise.all([
    import(pathToFileURL(join(stage,'src/server.mjs'))),
    import('../src/room-store.mjs'),
    import('../src/interior-art.mjs'),
    import('../src/avatar-registry.mjs'),
    import('../src/conversation-context.mjs'),
  ]);
  let roomGrant=true,writeGrant=true,admitted=false;
  const execution={status:'running',instruction:randomUUID(),local_turn:1};
  const contexts=[];
  mkdirSync(evidence,{recursive:true});
  const dir=mkdtempSync(join(tmpdir(),'holodeck-characters-'));
  const socketPath=join(dir,'review.sock');
  const room=(id,title,level,entry,links)=>({id,title,level,entry,house,guests:[visitor,peer],
    links:links.map(([kind,to])=>({kind,to}))});
  const port=body=>new Promise((accept,reject)=>{
    const socket=createConnection(socketPath);
    let buffer='';
    socket.once('error',reject);
    socket.setTimeout(8000,()=>socket.destroy(Error('Native result timed out')));
    socket.once('connect',()=>socket.write(JSON.stringify(body)+'\n'));
    socket.on('data',chunk=>{
      buffer+=chunk;
      const eol=buffer.indexOf('\n');
      if(eol!==-1){socket.end();accept(JSON.parse(buffer.slice(0,eol)));}
    });
  });
  const native=async(type,args={})=>(await port({ownNative:true,operation:'act',args:{type,...args}})).result;
  let runtime,server,browser;
  try{
    new RoomStore(join(dir,'houses')).save({schema:'holodeck.houses/v1',receipts:[],houses:[{
      id:house,owner,revision:1,parcel:'parcel-west-1',
      facade:{title:'Casa de prueba',color:'#355b62',width:2.1,depth:1.3,height:2.15},
    }]});
    runtime=await createHolodeck({basePath:'/holodeck/',stateDir:dir,publicOrigin:origin,
      worldTerrain:'toroidal-terrain@1',artProfile:'compaii-atelier-v1',
      matterCollection:{room:matter,art:'matter-workshop-orbital-focused-v1',
        projects:[{id:'review',resources:['e'.repeat(32)]}]},
      interiorSpaces:[
        room(foyer,'Vestíbulo',0,true,[['door',gallery],['portal',matter]]),
        room(gallery,'Galería',0,false,[['door',foyer],['stair',lab],['portal',tower]]),
        room(lab,'Laboratorio',-1,false,[['stair',gallery]]),
        room(tower,'Torre',2,false,[['portal',gallery]]),
        room(matter,'Materia',0,false,[['portal',foyer]]),
      ],
      nativeFactory:async({room,stateDir,allowInteriorSource})=>{
        const transport={
          inspect:async actorRef=>({actorRef,beingRef:owner,binding,entry:[1,{},2,'character-fixture']}),
          lookup:async()=>({state:'absent'}),
          status:async()=>({phase:'working',tracking:true,retainedOriginal:admitted,nativeAcceptance:admitted?'observed':'unavailable',
            activeExecution:execution}),
          prepareContext:async request=>{
            contexts.push(request.observation);
            return {schema:'holodeck.prepared-conversation-context/v1',id:request.id,binding,
              entry_binding:request.frozen.entry,observation_id:request.observation.id,work_admitted:false,
              file:{file_id:randomUUID(),sha256:'d'.repeat(64),name:'holodeck-situation.json',mime:'application/json',size:2000}};
          },
        };
        const prepared=await createConversationContexts({room,stateDir:join(stateDir,'contexts'),transport,allowInteriorSource});
        return {contexts:prepared,
          conversationSurface:async actor=>({schema:'holodeck.conversation-surface/v1',actorRef:actor.ref,
            beingRef:owner,homeRef:'home:'+'c'.repeat(32),binding,url:conversationURL}),
          availability:async()=>({available:true}),
          authorizeWorldRequest:(...args)=>prepared.authorizeWorldRequest(...args)};
      },
      nativeRoomAuthority:async verified=>roomGrant&&verified.actor.id===owner?(writeGrant?['observe','edit']:['observe']):[],
      ownNative:true,worldPorts:[{socket:socketPath,beingRef:owner}],
      identityResolver:async req=>{
        const token=(req.headers.cookie??'').match(/(?:^|;\s*)fixture=(reviewer|peer)(?:;|$)/)?.[1];
        if(!token)return null;
        const id=token==='reviewer'?visitor:peer;
        return {id,ref:id,kind:'human',name:token==='reviewer'?'Visitante':'Segunda visitante',rights:['observe']};
      },
    });
    server=runtime.app.listen(0,'127.0.0.1');
    server.prependListener('request',req=>{if(req.method==='POST')req.headers.origin=origin;});
    server.prependListener('upgrade',req=>{req.headers.origin=origin;});
    await once(server,'listening');
    const url='http://127.0.0.1:'+server.address().port+'/holodeck/';
    browser=await chromium.launch({executablePath:HOLODECK_CHROMIUM||undefined,
      args:['--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:1200,height:800},reducedMotion:'reduce'});
    await context.addCookies([{name:'fixture',value:'reviewer',url}]);
    context.setDefaultTimeout(30000);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route(conversationURL+'*',route=>route.fulfill({contentType:'text/html',body:`
      <button disabled>Preparar contexto</button><output></output>
      <script>
        const params=new URLSearchParams(location.search),target=params.get('surface_parent');
        const base={schema:'conversation.surface/v1',visit:params.get('surface_visit'),
          channel:crypto.randomUUID(),actor:${JSON.stringify(visitor)},binding:${JSON.stringify(binding)}};
        const button=document.querySelector('button');
        button.onclick=()=>parent.postMessage({...base,type:'prepare',id:crypto.randomUUID(),request:crypto.randomUUID(),
          modality:'text',capacity:{files:8,bytes:65536,context_bytes:65536}},target);
        addEventListener('message',event=>{
          if(event.source!==parent||event.origin!==target||event.data?.channel!==base.channel)return;
          if(event.data.type==='connect')button.disabled=false;
          if(['prepared','error'].includes(event.data.type))document.querySelector('output').textContent=event.data.type;
        });
        parent.postMessage({...base,type:'ready'},target);
      </script>`}));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    const currentSpace=(clientPage=page)=>clientPage.evaluate(()=>fetch('api/space?live=1').then(r=>r.json()));
    const worldReady=(clientPage=page)=>clientPage.waitForFunction(()=>window.holodeckDevelopment?.client.getLocalCharacterState()&&
      document.querySelector('#world-entry').hidden&&!document.body.classList.contains('room-transition'));
    const placeAvatar=(position,yaw=180,clientPage=page)=>clientPage.evaluate(({position,yaw})=>{
      const client=holodeckDevelopment.client;
      client.updateConfig({spawnConfiguration:{spawnPosition:position,spawnYRotation:yaw,respawnTrigger:{minY:-2500}}});
      client.respawn();
    },{position,yaw});
    const approachDoor=async destination=>{
      const space=await currentSpace();
      const exit=space.exits.find(link=>link.to===destination&&link.kind==='door');
      assert.ok(exit,'Missing reciprocal world door for '+destination);
      const {x,y,z,yaw}=exit.door,angle=yaw*Math.PI/180;
      await placeAvatar({x:x+Math.sin(angle)*.58,y:y+.12,z:z+Math.cos(angle)*.58},-yaw);
      const button=page.getByRole('group',{name:'Cruzar un paso',exact:true})
        .getByRole('button',{name:'Ir a · '+exit.title+' [E]',exact:true});
      await button.press('Enter',{timeout:15000});
      await page.waitForFunction(async id=>(await fetch('api/space?live=1').then(r=>r.json())).id===id,destination);
      await worldReady();
      assert.equal(new URL(page.url()).searchParams.has('taller'),false);
      return currentSpace();
    };
    const openWorktable=async (space,clientPage=page,offset=0)=>{
      const bench=space.objects.find(object=>object.id==='character-worktable');
      assert.ok(bench,'The Character room has no worktable');
      await placeAvatar({x:bench.position.x+offset,y:.25,z:bench.position.z+1.62},180,clientPage);
      await clientPage.getByRole('button',{name:'Usar mesa',exact:true}).press('Enter',{timeout:15000});
      const table=clientPage.getByRole('group',{name:'Mesa de Char Design',exact:true});
      await table.getByRole('button',{name:'Pose',exact:true}).waitFor({state:'attached'});
      return table;
    };

    assert.deepEqual(await native('character-review.current'),{status:403});
    for(const [from,to] of [['outside',foyer],[foyer,studio]]){
      assert.equal((await native('space.move',{from,to})).id,to);
    }
    assert.equal(await moveVisitor(page,'outside',foyer),200);
    const worldLoaded=()=>page.waitForURL(value=>!value.searchParams.has('taller'));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await worldReady();
    const doorRoom=await approachDoor(studio);
    const walkedInTable=await openWorktable(doorRoom);
    await page.screenshot({path:join(evidence,'character-room-world-door.png')});
    await page.keyboard.press('Escape');
    await walkedInTable.waitFor({state:'detached'});
    assert.equal((await currentSpace()).id,studio);
    await approachDoor(foyer);
    await page.goto(url+'?taller=personajes',{waitUntil:'domcontentloaded'});
    await page.getByRole('link',{name:'Entrar al taller',exact:true}).click();
    await worldLoaded();
    assert.equal((await currentSpace()).id,studio);
    await page.goto(url+'?taller=personajes',{waitUntil:'domcontentloaded'});
    const panel=page.getByRole('group',{name:'Revisión de movimiento',exact:true});
    const action=name=>panel.getByRole('button',{name,exact:true});
    await action('Ver pose del Taller').waitFor({state:'attached',timeout:28000});
    const current=await native('character-review.current');
    assert.equal(current.room,studio);
    const pose={rig:'humanoid',clip:'estudio-vuelo',edition:current.catalog.humanoid['estudio-vuelo'].edition,frame:36};
    const committed=await native('character-review.focus',{expectedRevision:current.revision,pose});
    assert.equal(committed.status,200);
    assert.deepEqual(committed.presentation.pose,pose);
    await action('Ver pose del Taller').press('Enter');
    await page.waitForFunction(frame=>document.querySelector('input[aria-label="Fotograma"]')?.valueAsNumber===frame,pose.frame);
    assert.equal(await panel.getByRole('combobox',{name:'Ciclo',exact:true}).inputValue(),pose.clip);
    assert.equal((await page.evaluate(()=>fetch('api/space?live=1').then(r=>r.json()))).actorRef,visitor);
    const readback=await page.evaluate(()=>fetch('api/space/character-presentation').then(r=>r.json()));
    assert.deepEqual(readback.presentation,committed.presentation);
    assert.equal(readback.revision,committed.revision);

    const note='Revisar la posición del hombro.';
    await action('Nota para este fotograma').press('Enter');
    await page.getByRole('textbox',{name:'Nota para este fotograma',exact:true}).fill(note);
    const pending=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/character-pose-review'));
    await page.keyboard.press('Enter');
    const saved=await pending;
    assert.equal(saved.status(),200);
    assert.deepEqual(saved.request().postDataJSON().pose,pose);
    const result=await native('character-review.notes',{pose});
    assert.equal(result.status,200);
    assert.deepEqual(result.notes.map(({author,text})=>[author,text]),[['Visitante',note]]);
    await page.screenshot({path:join(evidence,'character-review-roundtrip.png')});

    // The shared pose stays at frame 36. Frame 37 is a visitor-local choice.
    await page.getByRole('link',{name:'Abrir sala 3D',exact:true}).click();
    await worldLoaded();
    await worldReady();
    const roomView=await currentSpace();
    assert.equal(roomView.id,studio);
    const table=await openWorktable(roomView);
    const tableButton=name=>table.getByRole('button',{name,exact:true});
    await tableButton('Notas').press('Enter');
    await tableButton('Ver pose del Taller').press('Enter');
    await tableButton('Pose').press('Enter');
    const frame=(expected,clientPage=page)=>clientPage.waitForFunction(value=>document.querySelector('input[aria-label="Fotograma"]')?.valueAsNumber===value,expected,{polling:100});
    await frame(pose.frame);
    const followedStatus=table.getByText('Pose recibida de '+committed.presentation.author+'.',{exact:true});
    await followedStatus.waitFor({state:'attached'});
    const chooseTable=(name,value)=>table.getByRole('combobox',{name,exact:true}).selectOption(value,{force:true});
    const checkPhases=async (clip,expected,images)=>{
      const observed={};
      for(const [phase,expectedFrame] of Object.entries(expected)){
        await chooseTable('Fase',phase);
        await frame(expectedFrame);
        observed[phase]=Number(await table.getByRole('slider',{name:'Fotograma',exact:true}).inputValue());
        if(images.includes(phase))await page.screenshot({path:join(evidence,'character-'+clip+'-'+phase+'.png')});
      }
      return observed;
    };
    const flightChapters=await checkPhases('flight',{ground:0,lift:22,hover:36,turn:65,land:110},['lift','land']);
    await tableButton('Clips').press('Enter');
    await chooseTable('Ciclo','estudio-marcha');
    await page.waitForFunction(()=>document.querySelector('select[aria-label="Ciclo"]')?.value==='estudio-marcha');
    await tableButton('Pose').press('Enter');
    const groundChapters=await checkPhases('ground',{ground:0,walk:17,brake:57,settled:63},['brake']);
    await tableButton('Notas').press('Enter');
    await tableButton('Ver pose del Taller').press('Enter');
    await tableButton('Pose').press('Enter');
    await frame(pose.frame);
    await followedStatus.waitFor({state:'attached'});
    await tableButton('+1').press('Enter');
    await frame(pose.frame+1);
    await followedStatus.waitFor({state:'detached'});

    // A second visitor with a distinct fixture identity reviews the same presentation.
    const peerContext=await browser.newContext({viewport:{width:1200,height:800},reducedMotion:'reduce'});
    peerContext.setDefaultTimeout(30000);
    await peerContext.addCookies([{name:'fixture',value:'peer',url}]);
    const peerPage=await peerContext.newPage();
    peerPage.on('pageerror',error=>errors.push(error.message));
    await peerPage.bringToFront();
    await peerPage.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(await moveVisitor(peerPage,'outside',foyer),200);
    assert.equal(await moveVisitor(peerPage,foyer,studio),200);
    await peerPage.goto(url,{waitUntil:'domcontentloaded'});
    await worldReady(peerPage);
    const peerSpace=await currentSpace(peerPage);
    assert.equal(peerSpace.actorRef,peer);
    assert.equal(peerSpace.id,studio);
    const peerTable=await openWorktable(peerSpace,peerPage,-.65);
    const peerButton=name=>peerTable.getByRole('button',{name,exact:true});
    await peerButton('Notas').press('Enter');
    const presentationRoute='**/api/space/character-presentation';
    let releasePresentation;
    const presentationGate=new Promise(resolve=>{releasePresentation=resolve;});
    await peerPage.route(presentationRoute,async route=>{
      await presentationGate;
      await route.continue();
    },{times:1});
    const reviewButton=peerButton('Ver notas');
    try{
      await peerButton('Ver pose del Taller').press('Enter');
      assert.equal(await reviewButton.isDisabled(),true,'Notes must wait for the shared pose to finish loading');
    }finally{
      releasePresentation();
    }
    await peerButton('Pose').press('Enter');
    await frame(pose.frame,peerPage);
    await peerButton('Notas').press('Enter');
    const peerNotesResponse=peerPage.waitForResponse(response=>
      new URL(response.url()).pathname.endsWith('/character-pose-review'));
    assert.equal(await reviewButton.isEnabled(),true);
    await reviewButton.press('Enter');
    const peerNotes=await peerNotesResponse;
    assert.equal(peerNotes.status(),200);
    assert.equal(new URL(peerNotes.url()).searchParams.get('frame'),String(pose.frame));
    assert.deepEqual((await peerNotes.json()).notes.map(({author,text})=>[author,text]),[['Visitante',note]]);
    const peerNote=peerTable.getByRole('combobox',{name:'Notas de esta pose',exact:true});
    await peerNote.locator('option').filter({hasText:'Visitante · '+note}).waitFor({state:'attached'});
    await peerButton('Pose').press('Enter');
    await frame(pose.frame,peerPage);
    await frame(pose.frame+1);
    await peerButton('−1').press('Enter');
    await frame(pose.frame-1,peerPage);
    await frame(pose.frame+1);
    const peerReadback=await peerPage.evaluate(()=>fetch('api/space/character-presentation').then(r=>r.json()));
    assert.equal(peerReadback.revision,committed.revision);
    assert.deepEqual(peerReadback.presentation.pose,pose);
    await peerPage.screenshot({path:join(evidence,'character-peer-local-frame.png')});
    await peerContext.close();
    await page.bringToFront();

    await page.getByRole('button',{name:'Conversar',exact:true}).press('Enter');
    const conversation=page.frameLocator('#shared-conversation iframe');
    await conversation.getByRole('button',{name:'Preparar contexto'}).click();
    await conversation.locator('output').filter({hasText:'prepared'}).waitFor();
    assert.equal(contexts.length,1);
    const referredPose={...pose,frame:pose.frame+1};
    assert.deepEqual(contexts[0].referredCharacterPose,{...referredPose,fixture:'character-worktable',
      evidence:'Client-reported frame matched the current pose catalog in the authorized Character Design Room.'});
    assert.equal(contexts[0].scope,'structured-interior-room');
    assert.equal(contexts[0].place.id,studio);
    assert.equal((await native('character-review.current')).presentation.pose.frame,pose.frame);
    const interactionId=contexts[0].inputAssociation.humanInputId;
    const situated=(operation,args={})=>port({interactionId,operation,args});
    assert.equal((await situated('observe')).ok,false);
    admitted=true;
    const review=await situated('observe');
    assert.equal(review.ok,true);
    assert.deepEqual(review.result.referredCharacterPose,contexts[0].referredCharacterPose);
    const readAction={type:'character-review.notes',pose:referredPose};
    const addAction={type:'character-review.add-note',pose:referredPose};
    assert.ok(review.result.actions.some(x=>x.args.type===readAction.type));
    assert.ok(review.result.actions.some(x=>x.args.type===addAction.type));
    assert.deepEqual((await situated('act',readAction)).result,{status:200,notes:[]});
    const nativeNote={...addAction,id:randomUUID(),text:'Revisar el apoyo en este fotograma.'};
    assert.equal((await situated('act',{...nativeNote,pose})).ok,false);
    writeGrant=false;
    assert.equal((await situated('act',nativeNote)).ok,false);
    assert.equal((await situated('act',readAction)).result.status,200);
    writeGrant=true;
    const noted=await situated('act',nativeNote);
    assert.equal(noted.result.status,200);
    assert.deepEqual(await situated('act',nativeNote),noted);
    const notes=await page.evaluate(async pose=>(await fetch('api/space/character-pose-review?'+new URLSearchParams(pose))).json(),referredPose);
    assert.deepEqual(notes.notes.map(row=>row.text),[nativeNote.text]);
    const prepare=(id,spaceId,characterPose)=>page.evaluate(async body=>{
      const response=await fetch('api/conversation-contexts',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)});
      return {status:response.status,scope:(await response.json()).scope};
    },{id,binding,view:{spaceId,characterPose}});
    // Leave the ordinary action burst from opening the table outside the rate window.
    await page.waitForTimeout(1050);
    assert.equal((await prepare(randomUUID(),studio,{...referredPose,edition:'f'.repeat(64)+'.'+'e'.repeat(64)})).status,409);
    roomGrant=false;
    assert.deepEqual(await prepare(randomUUID(),studio,referredPose),{status:409,scope:'machine-context'});
    roomGrant=true;
    assert.equal(await moveVisitor(page,studio,foyer),200);
    assert.equal((await prepare(randomUUID(),foyer,referredPose)).status,409);
    assert.equal(contexts.length,1);
    assert.equal((await native('space.move',{from:studio,to:foyer})).id,foyer);
    assert.deepEqual(await native('character-review.notes',{pose}),{status:403});

    // Reject the initial graphics context and then retry the same exact pose URL.
    await context.addInitScript(() => {
      if (sessionStorage.getItem('graphics-retry')) return;
      sessionStorage.setItem('graphics-retry','attempted');
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        return ['webgl','webgl2','experimental-webgl'].includes(type)?null:original.call(this,type,...args);
      };
    });
    const noGraphics=await context.newPage();
    noGraphics.on('pageerror',error=>errors.push(error.message));
    const retryURL=url+'?'+new URLSearchParams({
      taller:'personajes',rig:pose.rig,clip:pose.clip,fotograma:String(pose.frame),edicion:pose.edition,
    });
    await noGraphics.goto(retryURL,{waitUntil:'domcontentloaded'});
    await noGraphics.getByText('No se pudo iniciar la vista 3D.',{exact:true}).waitFor();
    await noGraphics.getByRole('link',{name:'Entrar al taller',exact:true}).waitFor();
    const retry=noGraphics.getByRole('button',{name:'Reintentar',exact:true});
    assert.equal(await retry.evaluate(button=>button===document.activeElement),true);
    await retry.press('Enter');
    await frame(pose.frame,noGraphics);
    assert.equal(noGraphics.url(),retryURL);

    // Lose a running context after selecting a local frame and writing a draft.
    const viewport=noGraphics.getByRole('group',{name:'Revisión de movimiento',exact:true});
    await viewport.getByRole('button',{name:'+1',exact:true}).press('Enter');
    await frame(pose.frame+1,noGraphics);
    const noteField=viewport.getByRole('button',{name:'Nota para este fotograma',exact:true});
    const noteEditor=noGraphics.getByRole('textbox',{name:'Nota para este fotograma',exact:true});
    await noteField.press('Enter');
    await noteEditor.fill('Borrador durante la interrupción');
    await noGraphics.evaluate(()=>{
      const gl=document.querySelector('.character-studio canvas').getContext('webgl2');
      window.graphicsTest=gl.getExtension('WEBGL_lose_context');
      window.graphicsTest.loseContext();
    });
    const lostNotice=noGraphics.getByText('Se interrumpió la vista 3D. Esperando a que se recupere.',{exact:true});
    await lostNotice.waitFor();
    await viewport.waitFor({state:'detached'});
    assert.equal(await noGraphics.getByRole('link',{name:'Entrar al taller',exact:true}).count(),1);
    await noGraphics.evaluate(()=>window.graphicsTest.restoreContext());
    await lostNotice.waitFor({state:'hidden'});
    await frame(pose.frame+1,noGraphics);
    await noteField.press('Enter');
    assert.equal(await noteEditor.inputValue(),'Borrador durante la interrupción');
    assert.equal(noGraphics.url(),retryURL);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({pose,flightChapters,groundChapters,revision:readback.revision,visitor,observedNote:note,roomScope:true,
      conversationPose:referredPose,peer,independentTableFrames:[pose.frame+1,pose.frame-1],peerSawVisitorNote:true,sharedReceiptMatchesLocalFrame:true,notesWaitedForSharedPose:true,sharedFramePreserved:true,invalidPoseDenied:true,recipientGrantChecked:true,outsidePoseDenied:true,
      situatedNativeNote:notes.notes[0].text,situatedRetryKeptOneNote:true,reciprocalWorldDoors:true,openedTableFromWorldDoor:true,doorFromViewer:true,returnedToRoomFromViewer:true,noGraphicsRetryKeptPose:true,graphicsRestoreKeptLocalFrameAndDraft:true}));
  }finally{
    await browser?.close();
    runtime?.close();
    if(server){
      server.closeAllConnections();
      await new Promise(done=>server.close(done));
    }
    rmSync(dir,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
