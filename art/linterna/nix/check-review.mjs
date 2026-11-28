import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [html,playwright,output] = process.argv.slice(2);
if (!html || !playwright || !output) throw Error('Usage: node check-review.mjs REVIEW_HTML PLAYWRIGHT_ESM OUTPUT');
const {chromium} = await import(pathToFileURL(resolve(playwright)).href);
const url = pathToFileURL(resolve(html));
const browser = await chromium.launch({
  executablePath:process.env.CHROMIUM || '/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const file = (name) => resolve(output,name);
await mkdir(output,{recursive:true});
const original = '35a68ced654fac9bfd21a160168ce1aab5ecd385b54ac4c5dba60022c1646e50';
const preview02 = '0ee9113c2a9ef1b4d5d3e27cb041eccc21e4a6915f6e21a6f880d660f2e20282';
const digest = (href) => createHash('sha256').update(Buffer.from(href.split(',')[1],'base64')).digest('hex');
async function frameInfo(page) {
  return page.locator('#frame-image').evaluate(async frame => {
    await frame.decode();
    return {href:frame.src,width:frame.naturalWidth,height:frame.naturalHeight,fit:getComputedStyle(frame).objectFit};
  });
}
try {
  const page = await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  const errors = [];
  const requests = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('request', req => {
    if (req.url().startsWith('http:') || req.url().startsWith('https:')) requests.push(req.url());
  });
  await page.goto(url.href);
  await page.waitForSelector('body[data-ready=true]');
  const survey = await page.evaluate(()=>nixReview.survey());
  console.log("Geometry survey complete");
  assert.equal(survey.anchors.length,9);
  assert.equal(survey.sightlines.length,10);
  assert.equal(survey.minimumWalkDiameter,1.12);

  // Movement through architectural threshold using the preview's own collision checks.
  await page.setViewportSize({width:960,height:600});
  await page.locator('[data-pose=approach]').click();
  await page.keyboard.down('w');
  await page.waitForFunction(()=>nixReview.state().eye[2]<5.5,{},{timeout:38000});
  await page.keyboard.up('w');
  assert.ok(Math.abs((await page.evaluate(()=>nixReview.state().eye))[0])<1.1);

  await page.setViewportSize({width:1440,height:900});
  const eye = page.locator('#open-eye');
  console.log("Keyboard crossed the threshold");
  await page.locator('[data-pose=ocular]').click();
  await page.locator('canvas').click({position:{x:720,y:450}});
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);
  const ocular = await frameInfo(page);
  assert.deepEqual([ocular.width,ocular.height,ocular.fit],[640,480,'contain']);
  assert.equal(digest(ocular.href),original);
  await page.locator('#zoom').click();
  assert.equal(await page.locator('#frame-window').evaluate(w=>w.scrollWidth>w.clientWidth),true);
  await page.locator('#fit').click();
  assert.equal(await page.locator('#frame-window').evaluate(w=>w.scrollWidth===w.clientWidth && w.scrollHeight===w.clientHeight),true);
  const cameraBefore = await page.evaluate(()=>nixReview.state().eye);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
  assert.deepEqual(await page.evaluate(()=>nixReview.state().eye),cameraBefore);

  await page.locator('[data-state=offline]').click();
  assert.equal(await eye.isDisabled(),true);
  assert.match(await page.locator('#status').innerText(),/^Sin señal/);
  assert.equal(await page.evaluate(()=>nixReview.state().displayed),null);
  await page.locator('#open-gallery').click();
  assert.equal(digest((await frameInfo(page)).href),original);
  await page.locator('#close').click();
  assert.equal(await page.locator('#open-gallery').evaluate(btn=>btn===document.activeElement),true);

  await page.locator('[data-state=preview]').click();
  await page.waitForFunction(()=>nixReview.state().displayed==='preview-03');
  assert.match(await page.locator('#status').innerText(),/Demostración simulada/);
  await page.evaluate(()=>nixReview.inspect('preview-02'));
  assert.equal(digest((await frameInfo(page)).href),preview02);
  await page.locator('#close').click();
  assert.deepEqual(errors,[]);
  assert.deepEqual(requests,[]);

  console.log("Desktop inspection and three fixture states complete");
  const mobile = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await mobile.goto(url.href);
  await mobile.waitForSelector('body[data-ready=true]');
  const panels = await mobile.locator('header,.dock').evaluateAll(els => els.map(el => {
    const {right,bottom,width,top}=el.getBoundingClientRect();
    return {right,bottom,width,top};
  }));
  assert.ok(panels.every(p=>p.right<=390 && p.bottom<=844));
  assert.ok(panels[0].bottom<panels[1].top);
  await mobile.locator('[data-state=offline]').tap();
  assert.match(await mobile.locator('#status').innerText(),/Archivo de prueba/);
  await mobile.locator('#open-gallery').tap();
  assert.equal(digest((await frameInfo(mobile)).href),original);
  assert.equal(await mobile.locator('#frame-window').evaluate(w=>w.scrollWidth===w.clientWidth && w.scrollHeight===w.clientHeight),true);
  const mobileDialog = await mobile.locator('dialog').boundingBox();
  assert.ok(mobileDialog.x>=0 && mobileDialog.x+mobileDialog.width<=390);
  await mobile.locator('#zoom').tap();
  assert.equal(await mobile.locator('#frame-window').evaluate(w=>w.scrollWidth>w.clientWidth),true);
  await mobile.locator('#close').tap();
  assert.equal(await mobile.locator('#open-gallery').evaluate(btn=>btn===document.activeElement),true);
  await mobile.close();
  console.log("Touch inspection complete");

  await page.goto(url.href+'?art');
  await page.waitForSelector('body[data-ready=true]');
  for(const view of ['approach','entry','ocular','gallery','photo']) {
    await page.evaluate(name=>nixReview.pose(name),view);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:file(view+'.jpg'),quality:91,type:'jpeg'});
  }
  await page.goto(url.href);
  await page.waitForSelector('body[data-ready=true]');
  await page.locator('[data-pose=ocular]').click();
  await page.locator('#open-eye').click();
  await frameInfo(page);
  await page.screenshot({path:file('full-frame.jpg'),quality:91,type:'jpeg'});

  const download = page.waitForEvent('download');
  const glb = await page.evaluate(()=>nixReview.exportModel());
  await (await download).saveAs(file('Templo-de-Nix.glb'));
  assert.deepEqual(glb.anchors.sort(),survey.anchors.sort());
  await page.goto(url.href+'?jardin');
  await page.waitForSelector('body[data-ready=true]');
  const garden = await page.evaluate(()=>nixReview.gardenSurvey());
  assert.equal(garden.walkingWidthM,1.12);
  assert.equal(garden.sightlines.length,2);
  assert.ok(garden.samples>500);
  const situated = await page.evaluate(()=>nixReview.survey());
  assert.deepEqual(situated.anchors.sort(),survey.anchors);
  assert.equal(situated.sightlines.length,10);

  const walk = page.locator('#context-walk');
  await walk.click();
  await page.waitForSelector('body[data-journey=nix]',{timeout:25000});
  assert.equal(await page.locator('body').getAttribute('data-view'),'entry');
  assert.ok((await page.evaluate(()=>nixReview.state().eye))[0]<garden.threshold[0]);
  await page.locator('#open-eye').click();
  assert.equal(digest((await frameInfo(page)).href),original);
  await page.keyboard.press('Escape');
  await walk.click();
  await page.waitForSelector('body[data-journey=columnata]',{timeout:25000});
  assert.deepEqual(await page.evaluate(()=>nixReview.state().eye),[0,1.64,4.08]);
  assert.deepEqual(errors,[]);
  assert.deepEqual(requests,[]);

  await page.goto(url.href+'?jardin&art');
  await page.waitForSelector('body[data-ready=true]');
  for(const view of ['columnata','desvio','jardin','approach']) {
    await page.evaluate(name=>nixReview.pose(name),view);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:file('garden-'+view+'.jpg'),quality:91,type:'jpeg'});
  }
  await writeFile(file('survey.json'),JSON.stringify({survey,glb,garden},null,2)+'\n');
  console.log(JSON.stringify({survey,glb,garden}));
} finally {
  await browser.close();
}
