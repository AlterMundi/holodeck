import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile,execFileSync} from 'node:child_process';
import net from 'node:net';
import {promisify} from 'node:util';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createHolodeck} from '../src/server.mjs';
import {homeIdentityResolver} from '../src/home-identity.mjs';
import {createNativeRoomAuthority} from '../src/native-authority.mjs';
import {configuredQuestbook} from '../src/questbook.mjs';

const binary = process.env.DAIMON_CARDS_BIN;

test('the authenticated questbook credits only its original Room action', {skip:!binary}, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'holodeck-questbook-'));
  t.after(() => rmSync(directory, {recursive:true,force:true}));
  const store = join(directory, 'questbook.sqlite');
  const project = randomUUID(), otherProject = randomUUID(), card = randomUUID(), objective = randomUUID();
  const origin = 'https://quest.test', human = 'human:quest-fixture';
  const cookie = 'home=quest-fixture';
  const daimon = 'dm:being:v1:' + 'A'.repeat(43);
  let allowed = true, projectWrite = true, nativeRead = true, nativeWrite = true;
  const authoritySocket = join(directory,'authority.sock'), worldSocket = join(directory,'world.sock');
  let requestedProject;
  let otherProjectRead = false;
  const authority = net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      if (!buffer.includes('\n')) return;
      const request = JSON.parse(buffer.split('\n')[0]);
      if(request.actorRef!==undefined){
        assert.equal(request.actorRef,human);
        assert.equal(request.project,project);
        socket.end(JSON.stringify({ok:true,result:{schema:'holodeck.questbook-access/v1',
          project,actorRef:human,requestedWrite:request.write,read:allowed,
          write:allowed&&request.write&&projectWrite}})+'\n');
        return;
      }
      assert.equal(request.beingRef,daimon);
      const result = request.operation === 'world-access'
        ? {schema:'holodeck.world-access/v1',beingRef:daimon,allowed:true}
        : {schema:'holodeck.questbook-access/v1',project:requestedProject??request.project,beingRef:daimon,
          requestedWrite:request.write,read:request.project===project?nativeRead:otherProjectRead,
          write:request.project===project&&nativeRead&&request.write&&nativeWrite};
      socket.end(JSON.stringify({ok:true,result})+'\n');
    });
  });
  await new Promise(resolve => authority.listen(authoritySocket,resolve));
  t.after(() => new Promise(resolve => authority.close(resolve)));
  async function native(input,source = ['--own'],operation = 'questbook') {
    const args = [new URL('../integrations/world_port.py',import.meta.url).pathname,
      '--socket',worldSocket,...source,operation,'--json',JSON.stringify(input)];
    const reply = await promisify(execFile)('python3',args,{timeout:12000})
      .then(value=>value.stdout,error=>error.stdout || Promise.reject(error));
    return JSON.parse(reply);
  }
  const home = createServer((req,res) => {
    if (req.headers.host !== 'quest.test' || !req.headers.cookie?.includes(cookie) || !allowed) {
      return res.writeHead(403).end();
    }
    if (req.url === '/service-access/holodeck') return res.writeHead(204).end();
    if (req.url !== '/access/identity') return res.writeHead(404).end();
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({contract:'dm.home-session/v1',origin,expires:Date.now()/1000+60,
      actor:{ref:human,kind:'human',revision:'fixture-current',name:'Quest player'}}));
  });
  await new Promise(resolve => home.listen(0,'127.0.0.1',resolve));
  t.after(() => { home.closeAllConnections(); return new Promise(resolve => home.close(resolve)); });
  const homeBase = 'http://127.0.0.1:' + home.address().port;

  function tool(input) {
    return JSON.parse(execFileSync(binary,[store],{input:JSON.stringify({
      project, actor:{kind:'daimon',subject:daimon}, can_write:true,input,
    }),encoding:'utf8'}));
  }
  function typed(revision, action) {
    return tool({type:'apply',command:{operation:randomUUID(),card,expected_revision:revision,action}});
  }
  assert.equal(typed(0,{type:'create',title:'Raise the workshop bridge'}).result.status,'applied');
  assert.equal(typed(1,{type:'require_world',objective:{id:objective,place:'island-workshop',
    event:{type:'bridge_state',raised:true}}}).result.status,'applied');

  const runtime = await createHolodeck({production:true,basePath:'/holodeck/',publicOrigin:origin,
    stateDir:directory,worldSocket,worldSocketBeingRef:daimon,ownNative:true,
    nativeFactory:async()=>({authorizeWorldRequest:async()=>{throw Error('No delegated input in this fixture');}}),
    nativeRoomAuthority:createNativeRoomAuthority(authoritySocket),
    identityResolver:homeIdentityResolver({publicOrigin:origin,authHost:'quest.test',
      authorizeEndpoint:homeBase+'/service-access/holodeck',identityEndpoint:homeBase+'/access/identity'}),
    questbook:configuredQuestbook({origin,authHost:'quest.test',authEndpoint:homeBase+'/access/identity',authoritySocket,
      questbook:[
        {project,binary,paired:true},
        {project:otherProject,binary,viewEndpoint:homeBase+'/other/view',editEndpoint:homeBase+'/other/edit'},
      ]},directory)});
  const listener = runtime.app.listen(0,'127.0.0.1');
  await new Promise(resolve => listener.once('listening',resolve));
  t.after(() => { runtime.close(); listener.closeAllConnections(); return new Promise(resolve => listener.close(resolve)); });
  const base = 'http://127.0.0.1:'+listener.address().port+'/holodeck/';
  const journal = 'api/questbook?selected='+card;
  assert.equal((await fetch(base+journal)).status,401);
  const root = await fetch(base,{headers:{Cookie:cookie}});
  const issued = root.headers.get('set-cookie');
  await root.text();
  assert.equal(root.status,200);
  const headers = {Cookie:cookie+'; '+issued.split(';')[0],Origin:origin,'Content-Type':'application/json'};
  const view = async () => {
    const response = await fetch(base+journal,{headers});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    return (await response.json()).result[2].updateDataModel.value;
  };
  const post = (path,body) => fetch(base+'api/questbook/'+path,{method:'POST',headers,body:JSON.stringify(body)});
  const creationPage = await fetch(base,{headers:{Cookie:cookie}});
  const creationHeaders = {...headers,Cookie:cookie+'; '+creationPage.headers.get('set-cookie').split(';')[0]};
  await creationPage.text();
  const create = {operation:randomUUID(),card:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'Find the map'};
  const createPost = body => fetch(base+'api/questbook/create',
    {method:'POST',headers:creationHeaders,body:JSON.stringify(body)});
  assert.equal((await fetch(base+'api/questbook/receipt?operation='+create.operation)).status,401);
  projectWrite = false;
  assert.equal((await createPost(create)).status,403);
  projectWrite = true;
  const firstCreation = (await (await createPost(create)).json()).result;
  assert.equal(firstCreation.status,'applied');
  assert.equal((await (await createPost(create)).json()).result.status,'retained');
  assert.equal((await (await createPost({...create,title:'Changed original'})).json()).result.reason,'operation_changed');
  const receipt = await fetch(base+'api/questbook/receipt?operation='+create.operation,{headers});
  assert.equal(receipt.status,200);
  assert.deepEqual((await receipt.json()).result,firstCreation.event);
  const fromDaimon = await native({type:'read',card:create.card});
  assert.equal(fromDaimon.result.title,create.title);
  assert.equal(fromDaimon.result.revised_by.subject,human);
  assert.deepEqual(await native({type:'read',project:otherProject,card:create.card}),{ok:false,code:'access'});
  otherProjectRead=true;
  assert.equal((await native({type:'read',project:otherProject,card:create.card})).result,null);
  assert.deepEqual(await native({type:'apply',project:otherProject,command:{
    operation:randomUUID(),card:create.card,expected_revision:0,action:{type:'create',title:'Another board'},
  }}),{ok:false,code:'access'});
  assert.equal((await native({type:'read',project,card:create.card})).result.title,create.title);
  const foreignReceipt = await native({type:'receipt',operation:create.operation});
  assert.equal(foreignReceipt.result,null);
  for (let i = 1; i <= 32; i++) {
    const cardId='00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');
    assert.equal(tool({type:'apply',command:{operation:randomUUID(),card:cardId,
      expected_revision:0,action:{type:'create',title:'Page entry '+i}}}).result.status,'applied');
  }
  const offPage = await fetch(base+'api/questbook?selected='+create.card,{headers}).then(reply=>reply.json());
  const model = offPage.result[2].updateDataModel.value;
  assert.equal(model.title,create.title);
  assert.equal(model.next,'00000000-0000-4000-8000-000000000020');

  // Race an authenticated player action and a native daimon action on the
  // same card and revision. Recover the winner through its original actor.
  const humanClaim = {operation:randomUUID(),card:create.card,event:{
    surfaceId:'questbook-'+project,name:'claim',context:{card:create.card,revision:1},
  }};
  const daimonClaim = {operation:randomUUID(),card:create.card,expected_revision:1,
    action:{type:'claim'}};
  const readHumanReceipt = async operation => {
    const response = await fetch(base+'api/questbook/receipt?operation='+operation,{headers});
    assert.equal(response.status,200);
    return (await response.json()).result;
  };
  // Use an independent browser session for this action so the later
  // workshop journey keeps its own bounded action window.
  const claimPage = await fetch(base,{headers:{Cookie:cookie}});
  assert.equal(claimPage.status,200);
  const claimHeaders = {...headers,Cookie:cookie+'; '+claimPage.headers.get('set-cookie').split(';')[0]};
  await claimPage.text();
  const [humanAction,daimonAction] = await Promise.all([
    fetch(base+'api/questbook/action',{method:'POST',headers:claimHeaders,
      body:JSON.stringify(humanClaim)}).then(reply=>reply.json()),
    native({type:'apply',command:daimonClaim}),
  ]);
  const both = [humanAction.result,daimonAction.result];
  assert.deepEqual(both.map(result=>result.status).sort(),['applied','conflict']);
  const winner = both.find(result=>result.status==='applied').event;
  const conflict = both.find(result=>result.status==='conflict');
  assert.equal(conflict.reason,'stale_revision');
  const humanWon = humanAction.result.status==='applied';
  assert.equal(winner.card.assignee.subject,humanWon?human:daimon);
  assert.equal(winner.card.revision,2);
  assert.deepEqual(await readHumanReceipt(humanClaim.operation),humanWon?winner:null);
  const daimonReceipt = await native({type:'receipt',operation:daimonClaim.operation});
  assert.deepEqual(daimonReceipt.result,humanWon?null:winner);
  assert.equal(await readHumanReceipt(daimonClaim.operation),null);
  assert.equal((await native({type:'receipt',operation:humanClaim.operation})).result,null);
  assert.deepEqual((await native({type:'read',card:create.card})).result,winner.card);
  const updated = await fetch(base+'api/questbook?selected='+create.card,{headers})
    .then(reply=>reply.json());
  const updatedModel = updated.result[2].updateDataModel.value;
  assert.equal(updatedModel.revision,2);
  assert.equal(updatedModel.claimDisabled,true);
  const claimHistory = tool({type:'history',card:create.card,after:0}).result;
  assert.equal(claimHistory.length,2);
  assert.deepEqual(claimHistory[1],winner);

  const action = {operation:randomUUID(),card,event:{surfaceId:'questbook-'+project,name:'claim',
    context:{card,revision:2}}};
  assert.equal((await view()).progress,'0/1');
  assert.equal((await (await post('action',action)).json()).result.status,'applied');
  assert.equal((await view()).doneDisabled,true);
  assert.equal(typed(3,{type:'complete'}).result.reason,'objectives_pending');

  const actor = {id:human,kind:'human',rights:['observe','edit']};
  const observation = runtime.room.observe(actor);
  const original = {id:randomUUID(),issuedAt:runtime.room.clock(),run:runtime.room.run,edition:runtime.room.edition,
    observation:observation.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  const report = {operation:randomUUID(),card,revision:3,objective,originalCommand:original.id};
  const missing = await post('objective',{...report,receipt:{status:'completed',command:original.id}});
  assert.equal(missing.status,409);
  assert.equal((await missing.json()).code,'unresolved');
  assert.equal(runtime.room.entities.bridge.revision,0);
  const effect = runtime.room.command(actor,original);
  assert.equal(effect.status,'completed');

  const denied = typed(3,{type:'record_world',objective,receipt:
    runtime.room.objectiveReceipt(actor,original.id,{place:'island-workshop',event:{type:'bridge_state',raised:true}})});
  assert.deepEqual(denied,{ok:false,code:'access'});
  const confirmed = await (await post('objective',report)).json();
  assert.equal(confirmed.result.status,'applied',JSON.stringify(confirmed));
  assert.equal(confirmed.result.event.card.objectives[0].receipt.sequence,effect.event);
  assert.equal(confirmed.result.event.card.objectives[0].receipt.command,original.id);
  assert.equal(runtime.room.entities.bridge.revision,1);
  assert.equal((await view()).progress,'1/1');
  assert.equal((await view()).doneDisabled,false);
  runtime.room.reset();
  const retried = await (await post('objective',report)).json();
  assert.equal(retried.result?.status,'retained',JSON.stringify(retried));
  assert.deepEqual(retried.result.event,confirmed.result.event);
  assert.equal(runtime.room.entities.bridge.revision,0);

  const found = await native({type:'read',card});
  assert.equal(found.result.revision,4);
  assert.equal(found.result.objectives[0].receipt.command,original.id);
  assert.equal((await native({type:'receipt',operation:report.operation})).result,null,'cannot read another actor’s receipt');
  assert.equal((await native({type:'read',card},['--interaction',randomUUID()])).ok,false);
  const command = {operation:randomUUID(),card,expected_revision:4,action:{type:'complete'}};
  nativeWrite=false;
  assert.deepEqual(await native({type:'apply',command}),{ok:false,code:'access'});
  nativeWrite=true;
  const finished = await native({type:'apply',command});
  assert.deepEqual(finished.authoritySource,{identity:'receiving-lane',access:'current-being-grant'});
  assert.equal(finished.result.event.card.revised_by.subject,daimon);
  assert.equal(finished.result.event.card.status,'done');
  assert.deepEqual((await native({type:'receipt',operation:command.operation})).result,finished.result.event);
  assert.equal((await native({type:'apply',command})).result.status,'retained');
  const changed = await native({type:'apply',command:{...command,action:{type:'edit_title',title:'Changed'}}});
  assert.equal(changed.result.reason,'operation_changed');
  nativeWrite=false;
  assert.deepEqual(await native({type:'apply',command}),{ok:false,code:'access'});
  assert.deepEqual((await native({type:'receipt',operation:command.operation})).result,finished.result.event);
  nativeRead=false;
  assert.deepEqual(await native({type:'receipt',operation:command.operation}),{ok:false,code:'access'});
  nativeRead=true;
  requestedProject=randomUUID();
  assert.equal((await native({type:'read',card})).ok,false);
  assert.equal((await view()).status,'Completada');
  assert.equal(tool({type:'history',card,after:0}).result.length,5);
  requestedProject=project;
  nativeWrite=true;
  const nativeCard=randomUUID(), nativeObjective=randomUUID();
  const nativeEdit=(revision,action)=>native({type:'apply',
    command:{operation:randomUUID(),card:nativeCard,expected_revision:revision,action}});
  assert.equal((await nativeEdit(0,{type:'create',title:'Native bridge mission'})).result.status,'applied');
  assert.equal((await nativeEdit(1,{type:'require_world',objective:{id:nativeObjective,place:'island-workshop',
    event:{type:'bridge_state',raised:true}}})).result.status,'applied');
  assert.equal((await nativeEdit(2,{type:'claim'})).result.status,'applied');
  const observed=(await native({},['--own'],'observe')).result;
  const nativeWorld={id:randomUUID(),issuedAt:runtime.room.clock(),run:observed.run,edition:observed.edition,
    observation:observed.id,type:'bridge.set',target:'bridge',expectedRevision:0,args:{raised:true}};
  const record={type:'confirm_objective',operation:randomUUID(),card:nativeCard,revision:3,
    objective:nativeObjective,originalCommand:nativeWorld.id};
  assert.deepEqual(await native({...record,originalCommand:original.id}),{ok:false,code:'unresolved'});
  assert.equal((await native(nativeWorld,['--own'],'act')).result.status,'completed');
  const credited=await native(record);
  assert.equal(credited.result.event.card.objectives[0].receipt.actor,daimon);
  assert.equal(runtime.room.entities.bridge.revision,1);
  const nativeView=await fetch(base+'api/questbook?selected='+nativeCard,{headers}).then(reply=>reply.json());
  assert.equal(nativeView.result[2].updateDataModel.value.progress,'1/1');

  projectWrite = false;
  assert.equal((await view()).claimDisabled,true);
  allowed=false;
  assert.equal((await fetch(base+journal,{headers})).status,401);
});

const playwright = process.env.HOLODECK_PLAYWRIGHT;
test('the exterior A2UI journal preserves a shared mission across browser views', {skip:!binary||!playwright}, async t => {
  const {chromium} = await import(playwright);
  const directory = mkdtempSync(join(tmpdir(),'holodeck-questbook-browser-'));
  t.after(() => rmSync(directory,{recursive:true,force:true}));
  const store = join(directory,'questbook.sqlite');
  const project = randomUUID(), otherProject = randomUUID(), card = randomUUID(), objective = randomUUID();
  const title = 'Volvé a unir las islas';
  function tool(input) {
    return JSON.parse(execFileSync(binary,[store],{input:JSON.stringify({
      project,actor:{kind:'daimon',subject:'fixture-writer'},can_write:true,input,
    }),encoding:'utf8'}));
  }
  function typed(revision, action) {
    return tool({type:'apply',command:{operation:randomUUID(),card,expected_revision:revision,action}});
  }
  assert.equal(typed(0,{type:'create',title}).result.status,'applied');
  assert.equal(typed(1,{type:'require_world',objective:{id:objective,place:'island-workshop',
    event:{type:'bridge_state',raised:true}}}).result.status,'applied');

  const runtime = await createHolodeck({stateDir:directory,questbook:{
    project,binary,store,authorize:async () => ({read:true,write:true}),
  }});
  const listener = runtime.app.listen(0,'127.0.0.1');
  await new Promise(resolve => listener.once('listening',resolve));
  t.after(() => { runtime.close();listener.closeAllConnections();return new Promise(resolve=>listener.close(resolve)); });
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',
    args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  t.after(() => browser.close());
  const base = 'http://127.0.0.1:'+listener.address().port+'/';
  const page = await browser.newPage({viewport:{width:1100,height:800}});
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('#questbook-open').click();
  const dialog = page.getByRole('dialog',{name:'Diario de misiones'});
  const pixels = dialog.locator('canvas');
  await pixels.waitFor({state:'visible'});
  await dialog.getByText(title,{exact:true}).last().waitFor({state:'attached'});
  assert.equal(await dialog.getByRole('button',{name:'Completar misión'}).isDisabled(),true);
  await dialog.getByRole('button',{name:'Aceptar misión'}).focus();
  await page.keyboard.press('Space');
  await dialog.getByText('En curso',{exact:true}).waitFor({state:'attached'});
  if (process.env.HOLODECK_QUESTBOOK_CAPTURE) await dialog.screenshot({path:process.env.HOLODECK_QUESTBOOK_CAPTURE});
  await dialog.getByRole('button',{name:'Volver al mundo'}).click();

  const shared=tool({type:'read',card}).result;
  assert.equal(shared.revision,3);
  assert.equal(shared.status,'in_progress');
  assert.equal(shared.objectives[0].receipt,null);
  assert.equal(typed(3,{type:'complete'}).result.reason,'objectives_pending');

  const mobile = await browser.newPage({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
  await mobile.goto(base);
  await mobile.locator('#questbook-open').tap();
  const mobileDialog = mobile.getByRole('dialog',{name:'Diario de misiones'});
  await mobileDialog.getByText('En curso',{exact:true}).waitFor({state:'attached'});
  assert.ok(await mobileDialog.getByText('0/1',{exact:true}).count());
  assert.equal(await mobileDialog.getByRole('button',{name:'Completar misión'}).isDisabled(),true);
  assert.ok((await mobileDialog.boundingBox()).width < 390);
  assert.deepEqual(errors,[]);
});
