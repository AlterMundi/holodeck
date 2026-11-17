/** Build a bounded, fully vendored Node24 Home package; no runtime downloads. */
import { build } from 'esbuild';
import { readdir, readFile, writeFile, mkdir, rm, copyFile, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname);
const stage=process.argv[2];
if(!stage || !resolve(stage).startsWith(root+'/.state/'))throw Error('Stage must be task-owned .state subdirectory');
await rm(stage,{recursive:true,force:true});await mkdir(join(stage,'src'),{recursive:true});
const resourcePlugin={name:'qualified-jsdom-sidecars',setup(api){
 api.onLoad({filter:/style-rules\.js$/},async args=>{const source=await readFile(args.path,'utf8');if((source.match(/__dirname/g)||[]).length!==1)throw Error('JSDOM stylesheet source changed');return{contents:source.replace('__dirname','process.env.HOLODECK_JSDOM_HELPERS'),loader:'js'};});
 api.onLoad({filter:/XMLHttpRequest-impl\.js$/},async args=>{const source=await readFile(args.path,'utf8');const key='require.resolve("./xhr-sync-worker.js")';if(!source.includes(key))throw Error('JSDOM XHR source changed');return{contents:source.replace(key,'process.env.HOLODECK_XHR_WORKER'),loader:'js'};});
}};
await build({entryPoints:{server:join(root,'src/server.mjs'),'xhr-sync-worker':join(root,'node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js')},outdir:join(stage,'src'),outExtension:{'.js':'.mjs'},bundle:true,splitting:true,format:'esm',platform:'node',target:'node24',minify:false,
  banner:{js:"import{createRequire as __createRequire}from'node:module';const require=__createRequire(import.meta.url);"},external:['canvas','@napi-rs/canvas*'],plugins:[resourcePlugin]});
await mkdir(join(stage,'runtime/jsdom/lib/jsdom/browser'),{recursive:true});
await copyFile(join(root,'node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css'),join(stage,'runtime/jsdom/lib/jsdom/browser/default-stylesheet.css'));
const digest=b=>createHash('sha256').update(b).digest('hex');
async function copyTree(from,to){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){const src=join(from,entry.name),dst=join(to,entry.name);if(entry.isDirectory())await copyTree(src,dst);else if(entry.isFile())await copyFile(src,dst);else throw Error('Regular selected files only');}}
await copyTree(join(root,'public'),join(stage,'public'));await copyTree(join(root,'build'),join(stage,'build'));
const canvas=join(stage,'node_modules/canvas');await mkdir(canvas,{recursive:true});
for(const name of ['package.json','index.js','js-binding.js','geometry.js','load-image.js','LICENSE'])await copyFile(join(root,'node_modules/@mml-io/observable-dom/node_modules/canvas',name),join(canvas,name));
const native=await readFile(join(root,'node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node'));
if(native.length!==33253808)throw Error('Native asset revision changed: requalify bounds');
await mkdir(join(stage,'runtime'),{recursive:true});const compressed=gzipSync(native,{level:9});
await writeFile(join(stage,'runtime/canvas.node.gz'),compressed);
await writeFile(join(stage,'runtime/canvas.json'),JSON.stringify({schema:'holodeck.native-asset/v1',file:'canvas.node.gz',bytes:native.length,sha256:digest(native),compressedSha256:digest(compressed)}));
await copyFile(join(root,'deployment/entry.mjs'),join(stage,'entry.mjs'));
const inventory=[];async function collect(dir,relative=''){for(const entry of await readdir(dir,{withFileTypes:true})){const name=relative?relative+'/'+entry.name:entry.name;const p=join(dir,entry.name);if(entry.isDirectory())await collect(p,name);else{const b=await readFile(p);inventory.push({path:name,sha256:digest(b)});}}}await collect(stage);inventory.sort((a,b)=>a.path.localeCompare(b.path));
const health=Buffer.from(JSON.stringify({ok:true}));
const manifest={schema:'dm.home-service-package/v1',service:'holodeck',runtime:'node24-http',entry:'entry.mjs',state_schema:'holodeck-v1',health:{path:'/holodeck/health',sha256:digest(health)},files:inventory};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
await writeFile(join(stage,'service.json'),JSON.stringify(canonical(manifest)));
console.log(JSON.stringify({stage,files:inventory.length,nativeBytes:native.length,compressedBytes:compressed.length,healthSha256:digest(health)}));
