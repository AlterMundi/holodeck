// Verify the packaged world with an independent browser and own-native actor.
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {createConnection}=require('node:net');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {pathToFileURL}=require('node:url');

const {HOLODECK_STAGE,HOLODECK_PLAYWRIGHT,HOLODECK_EVIDENCE_DIR,HOLODECK_CHROMIUM}=process.env;
if(!HOLODECK_STAGE||!HOLODECK_PLAYWRIGHT||!HOLODECK_EVIDENCE_DIR)
  throw Error('Select the built package, Playwright module and a bounded evidence directory');
const {chromium}=require(resolve(HOLODECK_PLAYWRIGHT));
const stage=resolve(HOLODECK_STAGE),evidence=resolve(HOLODECK_EVIDENCE_DIR);
const visitor='human:character-review';
const foyer='compaii-vestibulo',studio='compaii-character-studio',matter='matter';
const lab='compaii-lab',gallery='compaii-galeria',tower='compaii-torre';
const origin='https://fixture.test';

async function main(){
  process.env.HOLODECK_JSDOM_HELPERS=join(stage,'runtime/jsdom/lib/jsdom/living/helpers');
  process.env.HOLODECK_XHR_WORKER=join(stage,'src/xhr-sync-worker.mjs');
  const [{createHolodeck},{RoomStore},{COMPAII_HOUSE:house},{COMPAII_BEING:owner}]=await Promise.all([
    import(pathToFileURL(join(stage,'src/server.mjs'))),
    import('../src/room-store.mjs'),
    import('../src/interior-art.mjs'),
    import('../src/avatar-registry.mjs'),
  ]);
  mkdirSync(evidence,{recursive:true});
  const dir=mkdtempSync(join(tmpdir(),'holodeck-characters-'));
  const socketPath=join(dir,'review.sock');
  const room=(id,title,level,entry,links)=>({id,title,level,entry,house,guests:[visitor],
    links:links.map(([kind,to])=>({kind,to}))});
  const native=(type,args={})=>new Promise((accept,reject)=>{
    const socket=createConnection(socketPath);
    let buffer='';
    socket.once('error',reject);
    socket.setTimeout(8000,()=>socket.destroy(Error('Native result timed out')));
    socket.once('connect',()=>socket.write(JSON.stringify({ownNative:true,operation:'act',args:{type,...args}})+'\n'));
    socket.on('data',chunk=>{
      buffer+=chunk;
      const eol=buffer.indexOf('\n');
      if(eol!==-1){socket.end();accept(JSON.parse(buffer.slice(0,eol)).result);}
    });
  });
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
      nativeFactory:()=>({authorizeWorldRequest(){throw Error('Fixture uses only own-native');}}),
      nativeRoomAuthority:async verified=>verified.actor.id===owner?['observe','edit']:[],
      ownNative:true,worldPorts:[{socket:socketPath,beingRef:owner}],
      identityResolver:async req=>req.headers.cookie?.includes('fixture=reviewer')?
        {id:visitor,ref:visitor,kind:'human',name:'Visitante',rights:['observe']}:null,
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
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'domcontentloaded'});

    assert.deepEqual(await native('character-review.current'),{status:403});
    for(const [from,to] of [['outside',foyer],[foyer,studio]]){
      assert.equal((await native('space.move',{from,to})).id,to);
      const status=await page.evaluate(async({from,to})=>(await fetch('api/space',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify({from,to})})).status,{from,to});
      assert.equal(status,200);
    }
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
    assert.equal((await native('space.move',{from:studio,to:foyer})).id,foyer);
    assert.deepEqual(await native('character-review.notes',{pose}),{status:403});
    assert.deepEqual(errors,[]);
    await page.screenshot({path:join(evidence,'character-review-roundtrip.png')});
    console.log(JSON.stringify({pose,revision:readback.revision,visitor,observedNote:note,roomScope:true}));
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
