import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {loadOwnerExteriors} from '../src/owner-exterior.mjs';

const house='house-'+'a'.repeat(64);
const houses={directory:()=>[{id:house,parcel:'parcel-east-1',facade:{title:'Test house'}}]};
const manifest='https://owner.dmn.homes/works/'+'b'.repeat(32)+'/'+'c'.repeat(64)+'/manifest.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function fixture({uri=false,changedManifest={}}={}){
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},meshes:[{}],
    ...(uri?{images:[{uri:'external.png'}]}:{})}));
  const bytes=Buffer.alloc(20+json.length);
  bytes.write('glTF');
  bytes.writeUInt32LE(2,4);
  bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(json.length,12);
  bytes.write('JSON',16);
  json.copy(bytes,20);
  const assets=Object.fromEntries(['near','distance','collision']
    .map(key=>[key,{file:key+'.glb',bytes:bytes.length,sha256:hash(bytes)}]));
  const edition=Buffer.from(JSON.stringify({
    schema:'casa-linterna.exterior-candidate/v1',parcel:'parcel-east-1',units:'m',up:'+Y',towardPath:'+Z',
    plot:{width:72,depth:72,stand:[0,.11,2.45],doorway:[0,0,1.6],yaw:-90},
    display:{nearUntilMetres:75,distanceFromMetres:95},assets,...changedManifest,
  }));
  return {selection:{house,manifest,sha256:hash(edition)},
    request:async url=>new Response(url.pathname.endsWith('/manifest.json')?edition:bytes)};
}

test('a published exterior receives the accepted lot transform and a single arrival anchor',async()=>{
  const {selection,request}=fixture();
  const exterior=(await loadOwnerExteriors([selection],houses,request)).get(house);
  assert.deepEqual(exterior.origin,{x:1855,y:498,z:15.5});
  assert.deepEqual(exterior.door,{x:1852.55,y:498.11,z:15.5,facing:1});
  assert.deepEqual(Object.keys(exterior.assets),['near','distance','collision']);
});

test('exterior placement requires its exact Home version, accepted plot and self-contained assets',async()=>{
  const {selection,request}=fixture();
  await assert.rejects(loadOwnerExteriors([{...selection,manifest:manifest.replace('c'.repeat(64),'current')}],houses,request),/exact Home edition/);
  await assert.rejects(loadOwnerExteriors([{...selection,sha256:'d'.repeat(64)}],houses,request),/published revision/);
  const other=fixture({changedManifest:{parcel:'parcel-east-2'}});
  await assert.rejects(loadOwnerExteriors([other.selection],houses,other.request),/differs from its parcel/);
  const external=fixture({uri:true});
  await assert.rejects(loadOwnerExteriors([external.selection],houses,external.request),/self-contained/);
});
