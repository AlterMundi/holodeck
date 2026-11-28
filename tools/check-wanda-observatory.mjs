import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {houseId} from '../src/houses.mjs';
import {RoomStore} from '../src/room-store.mjs';
import {createHolodeck} from '../src/server.mjs';

const [bundle,playwright,output]=process.argv.slice(2);
if(!bundle||!playwright)throw Error('Usage: check-wanda-observatory.mjs BUNDLE PLAYWRIGHT_ESM [SCREENSHOT_DIRECTORY]');
const {chromium}=await import(pathToFileURL(resolve(playwright)));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=path=>readFile(join(bundle,path));
const stateDir=await mkdtemp(join(tmpdir(),'holodeck-wanda-check-'));
const owner='dm:being:v1:'+'A'.repeat(43),house=houseId(owner);
const visitor='human:wanda-visitor',guest=[visitor];
const foyer='nix-fixture-foyer',room='nix-fixture-observatory';
let runtime,listener,browser;

try{
  const manifest=await bytes('latest.json'),thumbnail=await bytes('poster.jpg');
  const capture=JSON.parse(manifest),original=await bytes(capture.image.path);
  assert.equal(digest(manifest),'0ed7c094de8701a49577d04303a5ad23402820378c5811fd37744568e98a3e33');
  const guestRoom=(id,title,entry,links)=>({id,house,title,entry,level:0,links,guests:guest});
  const link=to=>({kind:'door',to});
  new RoomStore(join(stateDir,'houses'),{maxBytes:65536}).save({schema:'holodeck.houses/v1',receipts:[],
    houses:[{id:house,owner,parcel:'parcel-east-1',revision:1,facade:{title:'Nix (fixture)',color:'#364552',width:3,depth:1.4,height:2.6}}]});
  const identityResolver=req=>{
    const user=req.headers.cookie?.match(/(?:^|; )wanda-trial=(wanda-visitor|wanda-outsider)(?:;|$)/)?.[1];
    return user?{id:'human:'+user,ref:'human:'+user,kind:'human',name:user,rights:['observe']}:null;
  };
  runtime=await createHolodeck({stateDir,identityResolver,basePath:'/holodeck/',
    interiorSpaces:[guestRoom(foyer,'Entrada de Nix',true,[link(room)]),
      guestRoom(room,'Observatorio de Nix',false,[link(foyer)])],
    wandaFixture:{room,directory:bundle,manifestSha256:digest(manifest),thumbnailSha256:digest(thumbnail)}});
  listener=runtime.app.listen(0,'127.0.0.1');await once(listener,'listening');
  const entry='http://127.0.0.1:'+listener.address().port+'/holodeck/';
  browser=await chromium.launch({executablePath:process.env.WANDA_CHROMIUM||'/usr/bin/chromium',
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const boot=async user=>{
    const context=await browser.newContext({viewport:{width:1120,height:720}});
    await context.addCookies([{name:'wanda-trial',value:user,url:entry}]);
    assert.equal((await context.request.get(entry)).status(),200);
    return context;
  };
  const admitted=await boot('wanda-visitor'),uninvited=await boot('wanda-outsider');
  const reach=(context,from,to)=>context.request.post(entry+'api/space',{data:{from,to,live:1}});
  assert.equal((await reach(uninvited,'outside',foyer)).status(),409);
  assert.equal((await reach(admitted,'outside',foyer)).status(),200);
  const transition=await reach(admitted,foyer,room);
  assert.equal(transition.status(),200);
  const space=await transition.json(),projection=space.wandaObservatory;
  assert.equal(space.id,room);
  assert.equal(projection.captureId,capture.capture_id);
  assert.equal(projection.nodeId,capture.node_id);
  assert.equal(projection.phase,'latest');
  assert.equal(projection.simulated,true);
  assert.deepEqual(projection.orientation,capture.orientation);
  assert.equal(projection.sha256,digest(original));
  assert.ok(space.scene.markup.includes(projection.eyepiece)&&space.scene.markup.includes(projection.poster));
  const fullUrl=new URL(projection.eyepiece,entry).href,posterUrl=new URL(projection.poster,entry).href;
  const denied=await uninvited.request.get(fullUrl);
  assert.equal(denied.status(),404);
  const poster=await admitted.request.get(posterUrl);
  assert.deepEqual(await poster.body(),thumbnail);
  assert.equal(poster.headers()['cache-control'],'private, no-store');
  assert.deepEqual(await (await admitted.request.get(fullUrl)).body(),original);
  assert.equal((await admitted.request.post(entry+'api/space/wanda/action',{data:{surfaceId:'wanda-observatory',
    name:'inspect_poster',context:{nodeId:projection.nodeId,captureId:'wrong',revision:projection.revision}}})).status(),409);
  assert.equal((await admitted.request.post(entry+'api/space/wanda/action',{data:{surfaceId:'wanda-observatory',
    name:'move-mount',context:{nodeId:projection.nodeId,captureId:projection.captureId,revision:projection.revision}}})).status(),409);

  const page=await admitted.newPage();
  const media=new Map();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if([fullUrl,posterUrl].includes(response.url())&&response.ok())media.set(response.url(),response);});
  await page.goto(entry,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('m-group#wanda-eyepiece m-image')&&
    document.querySelector('m-group#wanda-poster m-image'),null,{timeout:35000});
  await page.waitForFunction(()=>document.body.querySelector('[aria-label="Ver póster completo"]')||
    Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Ver póster completo'),
    null,{timeout:35000}).catch(async error=>{
      console.error(await page.evaluate(()=>({body:document.body.className,heading:document.querySelector('#hud h1')?.textContent,
        entry:document.querySelector('#world-entry')?.innerText,
        buttons:[...document.querySelectorAll('[data-spatial-hud-accessibility] button')].map(button=>button.textContent)})));
      console.error(errors);
      if(output)await page.screenshot({path:join(output,'observatory-diagnostic.png')});
      throw error;
    });
  await page.getByText('Última captura · Simulación',{exact:true}).waitFor({state:'attached'});
  if(output)await page.screenshot({path:join(output,'observatory-room.png')});
  for(const [name,title] of [['Ver póster completo','Observación fijada'],['Abrir ocular','Ocular WANDA']]){
    if(title==='Ocular WANDA')await page.setViewportSize({width:400,height:760});
    const [receipt]=await Promise.all([
      page.waitForResponse(response=>response.url().endsWith('/api/space/wanda/action')),
      page.getByRole('button',{name,exact:true}).evaluate(button=>button.click()),
    ]);
    assert.equal(receipt.status(),200);
    const result=await receipt.json();
    assert.equal(result.media,projection.eyepiece);
    assert.deepEqual(result.orientation,capture.orientation);
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('.wanda-inspection img')?.naturalWidth===640);
    const image=await page.locator('.wanda-inspection img').evaluate(img=>({
      width:img.naturalWidth,height:img.naturalHeight,mode:getComputedStyle(img).objectFit}));
    assert.deepEqual(image,{width:640,height:480,mode:'contain'});
    const dialog=await page.locator('.wanda-inspection').boundingBox();
    assert.ok(dialog.x>=0&&dialog.x+dialog.width<=page.viewportSize().width);
    if(output)await page.locator('.wanda-inspection').screenshot({path:join(output,result.target+'.png')});
    if(title==='Ocular WANDA')await page.keyboard.press('Escape');
    else await page.getByRole('button',{name:'Volver a la sala'}).click();
    await page.locator('.wanda-inspection').waitFor({state:'detached'});
  }
  for(const [url,expected] of [[fullUrl,original],[posterUrl,thumbnail]])assert.deepEqual(await media.get(url)?.body(),expected);
  assert.deepEqual(errors,[]);
  assert.equal((await reach(admitted,room,foyer)).status(),200);
  assert.equal((await admitted.request.get(fullUrl)).status(),404);
  console.log(JSON.stringify({node:projection.nodeId,capture:projection.captureId,sha256:projection.sha256,
    orientation:projection.orientation,posterBytes:thumbnail.length,fullBytes:original.length,
    nativeActions:2,foreignMedia:404,afterLeaving:404,scope:'local authenticated fixture'}));
}finally{
  await browser?.close();
  runtime?.close();
  if(listener)await new Promise(resolve=>listener.close(resolve));
  await rm(stateDir,{recursive:true,force:true});
}
