import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const here=dirname(fileURLToPath(import.meta.url));
const [sourceArg,outputArg,playwrightEntry,meshoptEntry,ratio='0.79']=process.argv.slice(2);
if(!meshoptEntry||!Number.isFinite(Number(ratio))||Number(ratio)<=0||Number(ratio)>1)
  throw Error('Usage: export.mjs PRIVATE_SOURCE OUTPUT_DIR PLAYWRIGHT_ESM MESHOPT_ESM [0 < geometry profile <= 1]');
const project=resolve(here,'../../../..'), source=resolve(sourceArg), out=resolve(outputArg);
const require=createRequire(join(project,'package.json'));
const {build}=require('esbuild');
const {chromium}=await import(pathToFileURL(resolve(playwrightEntry)));
await mkdir(out,{recursive:true});
const main=await readFile(join(source,'main.js'),'utf8');
const first=main.indexOf('M.sea = seaMaterial();');
const last=main.indexOf('// Post processing',first);
if(first<0||last<0)throw Error('Selected source material initialization changed');
const {outputFiles:[bundled]}=await build({entryPoints:[join(here,'export-scene.mjs')],platform:'browser',bundle:true,
  write:false,format:'esm',plugins:[{name:'approved-hd-candidate',setup(api){
    api.onResolve({filter:/^approved-hd-source$/},()=>({path:'selected-scene.js',namespace:'private-hd'}));
    api.onLoad({filter:/.*/,namespace:'private-hd'},()=>({resolveDir:source,loader:'js',contents:`
      export {buildStage} from './scene.js';
      export {buildMaterials,NOISE,KINDS} from './materials.js';
      export {loadStatues} from './statues.js';
      export {terrain,foliageMaterials} from './nature.js';
      import * as THREE from 'three';
      import {proc} from './materials.js';
      import {seaMaterial} from './nature.js';
      export function prepareMaterials(M) { ${main.slice(first,last)} }
    `}));
    api.onResolve({filter:/^meshoptimizer$/},()=>({path:resolve(meshoptEntry)}));
    api.onResolve({filter:/^three$/},()=>({path:resolve(project,'node_modules/three/build/three.module.js')}));
    api.onResolve({filter:/^three\/addons\//},({path})=>({path:resolve(project,'node_modules/three/examples/jsm',path.slice(13))}));
    api.onLoad({filter:/\/materials\.js$/},async ({path})=>({contents:(await readFile(path,'utf8'))+'\nexport {NOISE,KINDS};',loader:'js'}));
  }}]});
const server=createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url.startsWith('/?')){res.setHeader('content-type','text/html');return res.end('<style>body{margin:0}</style><script type="module" src="/bundle.js"></script>');}
  if(req.method==='GET'&&req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundled.contents);}
  const name=req.method==='POST'&&/^\/out\/(hall|hall-detail|temples|landscape|planting|foliage|arrival-report)\.(glb|json)$/.exec(req.url);
  if(!name)return res.writeHead(404).end();
  const chunks=[];let bytes=0;
  for await(const part of req){bytes+=part.length;if(bytes>768*1024)return res.writeHead(413).end();chunks.push(part);}
  await writeFile(join(out,name[1]+'.'+name[2]),Buffer.concat(chunks));res.end('ok');
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.LINTERNA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
  const context=await browser.newContext({viewport:{width:1050,height:660},serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(url+'/')?r.continue():r.abort());
  const page=await context.newPage();
  let fail;
  page.on('pageerror',e=>{fail?.(e);console.error(e.stack);});
  page.on('console',line=>{if(line.type()==='warning'||line.type()==='error'||line.type()==='log')console.error(line.text().slice(0,700));});
  const failure=new Promise((_,rej)=>{fail=rej;});
  await page.goto(url+'/?ratio='+ratio);
  await Promise.race([page.waitForFunction(()=>window.done,null,{timeout:180000}),failure]);
  for(const name of ['hall','garden']) {
    const stats=await page.evaluate(name=>window.paint(name),name);
    console.log(name,JSON.stringify(stats));
    await page.locator('canvas').screenshot({path:join(out,name+'.png'),timeout:45000});
  }
}finally{await browser.close();server.close();}
