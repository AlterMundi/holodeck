import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createHolodeck} from '../src/server.mjs';
import {homeIdentityResolver} from '../src/home-identity.mjs';
import {configuredQuestbook} from '../src/questbook.mjs';

const binary = process.env.DAIMON_CARDS_BIN;

test('the authenticated questbook credits only its original Room action', {skip:!binary}, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'holodeck-questbook-'));
  t.after(() => rmSync(directory, {recursive:true,force:true}));
  const store = join(directory, 'questbook.sqlite');
  const project = randomUUID(), card = randomUUID(), objective = randomUUID();
  const origin = 'https://quest.test', human = 'human:quest-fixture';
  const cookie = 'home=quest-fixture';
  const daimon = 'dm:being:v1:' + 'A'.repeat(43);
  let allowed = true, projectWrite = true;
  const home = createServer((req,res) => {
    if (req.headers.host !== 'quest.test' || !req.headers.cookie?.includes(cookie) || !allowed) {
      return res.writeHead(403).end();
    }
    if (['/service-access/holodeck','/project/view'].includes(req.url)) return res.writeHead(204).end();
    if (req.url === '/project/edit') return res.writeHead(projectWrite?204:403).end();
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
    stateDir:directory,identityResolver:homeIdentityResolver({publicOrigin:origin,authHost:'quest.test',
      authorizeEndpoint:homeBase+'/service-access/holodeck',identityEndpoint:homeBase+'/access/identity'}),
    questbook:configuredQuestbook({origin,authHost:'quest.test',authEndpoint:homeBase+'/access/identity',
      questbook:{project,binary,viewEndpoint:homeBase+'/project/view',editEndpoint:homeBase+'/project/edit'}},directory)});
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
  assert.equal(retried.result.status,'retained');
  assert.deepEqual(retried.result.event,confirmed.result.event);
  assert.equal(runtime.room.entities.bridge.revision,0);

  const finished = typed(4,{type:'complete'});
  assert.equal(finished.result.event.card.status,'done');
  assert.equal((await view()).status,'Completada');
  assert.equal(tool({type:'history',card,after:0}).result.length,5);
  projectWrite = false;
  assert.equal((await view()).claimDisabled,true);
  allowed=false;
  assert.equal((await fetch(base+journal,{headers})).status,401);
});

const playwright = process.env.HOLODECK_PLAYWRIGHT;
test('the Holodeck A2UI journal follows the bridge action from the actual workshop', {skip:!binary||!playwright}, async t => {
  const {chromium} = await import(playwright);
  const directory = mkdtempSync(join(tmpdir(),'holodeck-questbook-browser-'));
  t.after(() => rmSync(directory,{recursive:true,force:true}));
  const store = join(directory,'questbook.sqlite');
  const project = randomUUID(), card = randomUUID(), objective = randomUUID();
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

  const credit = page.waitForResponse(response=>response.url().endsWith('/api/questbook/objective'));
  await page.getByRole('button',{name:'Conectar las islas'}).click();
  const applied = await (await credit).json();
  assert.equal(applied.result.status,'applied');
  assert.equal(runtime.room.entities.bridge.revision,1);
  assert.equal(typed(4,{type:'complete'}).result.status,'applied');

  const mobile = await browser.newPage({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
  await mobile.goto(base);
  await mobile.locator('#questbook-open').tap();
  const mobileDialog = mobile.getByRole('dialog',{name:'Diario de misiones'});
  await mobileDialog.getByText('Completada',{exact:true}).waitFor({state:'attached'});
  assert.ok(await mobileDialog.getByText('1/1',{exact:true}).count());
  assert.equal(await mobileDialog.getByRole('button',{name:'Completar misión'}).isDisabled(),true);
  assert.ok((await mobileDialog.boundingBox()).width < 390);
  assert.deepEqual(errors,[]);
});
