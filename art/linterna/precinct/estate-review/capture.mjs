import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here=dirname(fileURLToPath(import.meta.url));
const inputs=process.argv.slice(2);
if(inputs.length!==4)throw Error('Usage: capture.mjs OWNER_EDITION RESIDENCE_GLB OUTPUT_DIR PLAYWRIGHT_ESM');
const [edition,residence,out,playwright]=inputs.map(value=>resolve(value));
const repo=resolve(here,'../../../..');
const require=createRequire(join(repo,'package.json'));
const {build}=require('esbuild');
const {chromium}=await import(playwright);
const files=await readFile(join(edition,'manifest.json'));
const arrival=JSON.parse(files).cells.arrival.models;
const selected=new Set(arrival.map(entry=>entry.file));
if(arrival.length!==6||selected.size!==6||[...selected].some(name=>!/^[a-z][a-z0-9-]{0,95}\.glb$/.test(name)))
  throw Error('Select the six authored arrival parts of the HD edition');
const {outputFiles:[js]}=await build({entryPoints:[join(here,'estate-preview.mjs')],write:false,bundle:true,format:'esm',
  platform:'browser',nodePaths:[join(repo,'node_modules')]});
await mkdir(out,{recursive:true});
const server=createServer((req,res)=>{
  const name=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method==='GET'){
    if(name==='/')return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<meta charset="utf-8"><style>body{margin:0}</style><script type="module" src="/estate.js"></script>');
    if(name==='/estate.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end(js.contents);
    if(name==='/edition/manifest.json')return res.writeHead(200,{'Content-Type':'application/json'}).end(files);
    const path=name==='/residencia.glb'?residence:
      name.startsWith('/edition/')&&selected.has(name.slice(9))?join(edition,name.slice(9)):null;
    if(path)return readFile(path).then(bytes=>res.writeHead(200,{'Content-Type':'model/gltf-binary'}).end(bytes),()=>res.writeHead(404).end());
  }
  return res.writeHead(404).end();
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.LINTERNA_CHROMIUM||'/usr/bin/chromium',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
  const context=await browser.newContext({viewport:{width:1400,height:900},serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  page.on('console',e=>{if(e.type()==='error')console.error(e.text());});
  await page.goto(origin+'/');
  await page.waitForFunction(()=>window.done||false,null,{timeout:90000});
  const status={};
  for(const camera of ['approach','threshold','corner','plan','palace']){
    status[camera]=await page.evaluate(name=>window.paint(name),camera);
    await page.locator('canvas').screenshot({path:join(out,camera+'.png'),timeout:90000});
  }
  if(errors.length)throw Error(errors.join('\n'));
  const measurements=await page.evaluate(()=>window.survey);
  await writeFile(join(out,'render-receipt.json'),JSON.stringify({measurements,views:status},null,2)+'\n');
}finally{await browser.close();server.close();}
