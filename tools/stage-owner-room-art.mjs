import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {readOwnerManifest,readOwnerModel} from '../src/owner-room-art.mjs';

const [manifest,sha256,destination,reader='daimon-home']=process.argv.slice(2);
if(!destination)throw Error('Usage: node tools/stage-owner-room-art.mjs MANIFEST_URL SHA256 CACHE_DIR [HOME_READER]');
const run=promisify(execFile);
const temporary=await mkdtemp(join(tmpdir(),'holodeck-owner-art-'));
const file=join(temporary,'download');
async function read(url,_options,{maxBytes}){
  try{
    // The receiving operator's existing reader acquires credentials privately.
    await run(reader,['read',url.href,'--output',file],{timeout:35000,maxBuffer:16384});
    if((await stat(file)).size>maxBytes)throw Error('Owner edition file exceeded its selected size');
    return new Response(await readFile(file));
  }catch{
    throw Error('The selected Home file could not be read by this operator');
  }finally{await rm(file,{force:true});}
}

try{
  const chosen=await readOwnerManifest({manifest,sha256},read);
  const files=new Map([[`${sha256}.json`,chosen.bytes]]);
  const assets=Object.values(chosen.manifest.cells).flatMap(cell=>cell.models);
  if(!assets.length||assets.length>32)throw Error('Select a bounded room edition');
  let total=chosen.bytes.length;
  for(const asset of assets){
    const name=`${asset.sha256}.glb`;
    if(files.has(name))continue;
    const bytes=await readOwnerModel(chosen.from,asset,read);
    total+=bytes.length;
    if(total>12*1024*1024)throw Error('Owner edition exceeds the receiver budget');
    files.set(name,bytes);
  }
  await mkdir(destination,{recursive:true,mode:0o700});
  for(const [name,bytes] of files){
    const path=join(destination,name);
    try{await writeFile(path,bytes,{flag:'wx',mode:0o600});}
    catch(error){
      if(error.code!=='EEXIST'||!(await readFile(path)).equals(bytes))throw error;
    }
  }
  console.log(JSON.stringify({manifestSha256:sha256,files:files.size,bytes:total}));
}finally{await rm(temporary,{recursive:true,force:true});}
