import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const [output,playwright]=process.argv.slice(2);
if(!output||!playwright)throw Error('Usage: export.mjs OUTPUT_DIRECTORY PLAYWRIGHT_ESM');
const dir=dirname(fileURLToPath(import.meta.url)), out=resolve(output);
const repo=resolve(dir,'../../../..');
const require=createRequire(join(repo,'package.json'));
const {build}=require('esbuild');
const {chromium}=await import(pathToFileURL(resolve(playwright)));
const {outputFiles:[bundle]}=await build({entryPoints:[join(dir,'export-scene.mjs')],write:false,
  format:'esm',platform:'browser',bundle:true});
await mkdir(out,{recursive:false});
const limits=new Map([['near.glb',6*1024*1024],['distance.glb',768*1024],['collision.glb',128*1024],['geometry.json',96000]]);
const server=createServer(async(req,res)=>{
  try{
    if(req.method==='GET'&&req.url==='/')
      return res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(
        '<style>body{margin:0}</style><script type="module" src="/compiled.js"></script>');
    if(req.method==='GET'&&req.url==='/compiled.js')
      return res.writeHead(200,{'content-type':'text/javascript'}).end(bundle.contents);
    const name=req.method==='POST'&&req.url.startsWith('/result/')?req.url.slice(8):'';
    if(!limits.has(name))return res.writeHead(404).end();
    const chunks=[];let size=0;
    for await(const data of req){
      size+=data.byteLength;
      if(size>limits.get(name))return res.writeHead(413).end();
      chunks.push(data);
    }
    await writeFile(join(out,name),Buffer.concat(chunks),{flag:'wx'});
    res.writeHead(201).end();
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.LINTERNA_CHROMIUM||'/usr/bin/chromium',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
  await page.route('**/*',request=>request.request().url().startsWith(origin+'/')?request.continue():request.abort());
  let reject;
  const failure=new Promise((_,fail)=>{reject=fail;});
  page.on('pageerror',error=>reject(error));
  await page.goto(origin+'/');
  await Promise.race([failure,page.waitForFunction(()=>window.done,null,{timeout:90000})]);
  for(const view of ['arrival','doorway']){
    await page.evaluate(value=>window.paint(value),view);
    await page.locator('canvas').screenshot({path:join(out,view+'.png'),timeout:45000});
  }
}finally{await browser.close();server.close();}

const geometry=await readFile(join(out,'geometry.json'));
const evidence=JSON.parse(geometry);
const assets={};
for(const data of evidence.assets){
  const file=data.role+'.glb',body=await readFile(join(out,file));
  if(body.length!==data.bytes||body.toString('ascii',0,4)!=='glTF')throw Error('Invalid exported model');
  assets[data.role]={file,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};
}
// This author manifest carries the proposed exterior placement. It is not
// an installed receiver API and contains no house access or app bindings.
const manifest={schema:'casa-linterna.exterior-candidate/v1',parcel:'parcel-east-1',
  units:'m',up:'+Y',towardPath:'+Z',plot:evidence.plot,assets,
  geometry:{file:'geometry.json',bytes:geometry.length,sha256:createHash('sha256').update(geometry).digest('hex')},
  display:{nearUntilMetres:75,distanceFromMetres:95}};
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({assets:evidence.assets,walkSamples:evidence.pathSamples,collisionBoxes:evidence.boxes.length}));
