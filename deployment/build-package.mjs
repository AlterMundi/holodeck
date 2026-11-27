/** Build a bounded, fully vendored Node24 Home package; no runtime downloads. */
import { build } from 'esbuild';
import { readdir, readFile, writeFile, mkdir, rm, copyFile, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants as zlib } from 'node:zlib';
import {SAND3D_TRAIL_REVISIONS} from '../src/sand3d-trail-assets.mjs';
import {RESIDENCE_REVISIONS} from '../src/toroidal-residence-assets.mjs';
import {ANIMATION_ASSET_REVISIONS} from '../src/packed-art.mjs';
import {VALLEY_ASSET_REVISIONS} from '../src/continuous-valley.mjs';
import {ATELIER_ASSET_REVISIONS} from '../src/compaii-atelier.mjs';
import {OWNED_PACKED_ART_REVISIONS} from '../src/owned-room-art.mjs';
import {MATTER_ART_REVISIONS} from '../src/matter-workshop-art.mjs';
import {ensureMmlServerAuthContext} from '../tools/mml-server-auth-context.mjs';
ensureMmlServerAuthContext({check:true});
const root=resolve(new URL('..',import.meta.url).pathname);
const stage=process.argv[2];
if(!stage || !resolve(stage).startsWith(root+'/.state/'))throw Error('Stage must be task-owned .state subdirectory');
await rm(stage,{recursive:true,force:true});await mkdir(join(stage,'src'),{recursive:true});
const resourcePlugin={name:'qualified-jsdom-sidecars',setup(api){
 api.onLoad({filter:/style-rules\.js$/},async args=>{const source=await readFile(args.path,'utf8');if((source.match(/__dirname/g)||[]).length!==1)throw Error('JSDOM stylesheet source changed');return{contents:source.replace('__dirname','process.env.HOLODECK_JSDOM_HELPERS'),loader:'js'};});
 api.onLoad({filter:/XMLHttpRequest-impl\.js$/},async args=>{const source=await readFile(args.path,'utf8');const key='require.resolve("./xhr-sync-worker.js")';if(!source.includes(key))throw Error('JSDOM XHR source changed');return{contents:source.replace(key,'process.env.HOLODECK_XHR_WORKER'),loader:'js'};});
}};
// Compact the vendored server within the receiving archive limit. Preserve
// runtime function and class names used by the router and dependency adapters.
await build({entryPoints:{server:join(root,'src/server.mjs'),'xhr-sync-worker':join(root,'node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js')},outdir:join(stage,'src'),outExtension:{'.js':'.mjs'},bundle:true,splitting:true,format:'esm',platform:'node',target:'node24',minify:true,keepNames:true,
  banner:{js:"import{createRequire as __createRequire}from'node:module';const require=__createRequire(import.meta.url);"},external:['canvas'],plugins:[resourcePlugin]});
await mkdir(join(stage,'runtime/jsdom/lib/jsdom/browser'),{recursive:true});
await copyFile(join(root,'node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css'),join(stage,'runtime/jsdom/lib/jsdom/browser/default-stylesheet.css'));
const digest=b=>createHash('sha256').update(b).digest('hex');
async function copyTree(from,to){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){const src=join(from,entry.name),dst=join(to,entry.name);if(entry.isDirectory())await copyTree(src,dst);else if(entry.isFile())await copyFile(src,dst);else throw Error('Regular selected files only');}}
await copyTree(join(root,'public'),join(stage,'public'));await copyTree(join(root,'build'),join(stage,'build'));
// Preserve the qualified bytes and their existing URLs with one disk representation.
for(const [path,revision] of Object.entries({...ATELIER_ASSET_REVISIONS,...VALLEY_ASSET_REVISIONS,...ANIMATION_ASSET_REVISIONS,...OWNED_PACKED_ART_REVISIONS,...MATTER_ART_REVISIONS,...SAND3D_TRAIL_REVISIONS,...RESIDENCE_REVISIONS})){
  if(!path.endsWith('.glb'))continue;
  const original=join(stage,'public',path),bytes=await readFile(original);
  if(bytes.length>4*1024*1024||digest(bytes)!==revision)throw Error('Unqualified art export: '+path);
  const packed=brotliCompressSync(bytes,{params:{[zlib.BROTLI_PARAM_QUALITY]:path in SAND3D_TRAIL_REVISIONS?11:6}});
  if(packed.length+1024>=bytes.length)continue;
  const output=join(stage,'runtime/art',path+'.br');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,packed);
  await rm(original);
}
// Keep one exact browser bundle in the archive. The receiving HTTP route
// serves this wire representation or streams its identity representation.
const clientBundle=join(stage,'build/client.js');
const packedClient=brotliCompressSync(await readFile(clientBundle),{params:{
 [zlib.BROTLI_PARAM_MODE]:zlib.BROTLI_MODE_TEXT,[zlib.BROTLI_PARAM_QUALITY]:11,
}});
await writeFile(join(stage,'runtime/client.js.br'),packedClient);
await rm(clientBundle);
await copyFile(join(root,'deployment/entry.mjs'),join(stage,'entry.mjs'));
// Retain notices for the actual installed runtime dependency closure used by
// the server/client bundles, Canvas remains an upstream optional server capability and is not shipped.
const dependencyRoots=new Set();
async function packageRoot(name,from){let directory=from;for(;;){const candidate=join(directory,'node_modules',name);try{await readFile(join(candidate,'package.json'));return candidate;}catch{}const parent=dirname(directory);if(parent===directory)throw Error('Missing installed dependency: '+name);directory=parent;}}
async function dependency(name,from,optional=false){let directory;try{directory=await packageRoot(name,from);}catch(error){if(optional)return;throw error;}if(dependencyRoots.has(directory))return;dependencyRoots.add(directory);const metadata=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));for(const child of Object.keys(metadata.dependencies||{}))await dependency(child,directory);for(const child of Object.keys(metadata.optionalDependencies||{}))await dependency(child,directory,true);}
const project=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
for(const name of Object.keys(project.dependencies||{}))await dependency(name,root);
let notices='Third-party runtime dependency notices\n';
for(const directory of [...dependencyRoots].sort()){const metadata=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));for(const name of (await readdir(directory)).sort()){if(!/^(license|copying|notice|copyright)(\.|$)/i.test(name))continue;const selected=join(directory,name);if(!(await lstat(selected)).isFile())continue;const data=await readFile(selected);if(data.length>512*1024)throw Error('Unexpectedly large dependency notice');notices+='\n\n=== '+metadata.name+'@'+metadata.version+' / '+name+' ===\n'+data.toString('utf8');}}
await writeFile(join(stage,'THIRD_PARTY_NOTICES.txt'),notices);
const inventory=[];async function collect(dir,relative=''){for(const entry of await readdir(dir,{withFileTypes:true})){const name=relative?relative+'/'+entry.name:entry.name;const p=join(dir,entry.name);if(entry.isDirectory())await collect(p,name);else{const b=await readFile(p);inventory.push({path:name,sha256:digest(b)});}}}await collect(stage);inventory.sort((a,b)=>a.path.localeCompare(b.path));
const health=Buffer.from(JSON.stringify({ok:true}));
const manifest={schema:'dm.home-service-package/v1',service:'holodeck',runtime:'node24-http',entry:'entry.mjs',state_schema:'holodeck-v1',health:{path:'/holodeck/health',sha256:digest(health)},files:inventory};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
await writeFile(join(stage,'service.json'),JSON.stringify(canonical(manifest)));
console.log(JSON.stringify({stage,files:inventory.length,healthSha256:digest(health)}));
