// The immutable package carries its native dependency compressed. Expand only
// that exact selected binary in the receiver's kernel-bounded private /tmp.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const metadata=JSON.parse(readFileSync(new URL('./runtime/canvas.json',import.meta.url)));
if(metadata.schema!=='holodeck.native-asset/v1'||metadata.file!=='canvas.node.gz'||metadata.bytes!==33253808)throw Error('Native asset contract changed');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=readFileSync(new URL('./runtime/canvas.node.gz',import.meta.url));
if(hash(compressed)!==metadata.compressedSha256)throw Error('Compressed native asset changed');
const binary=gunzipSync(compressed,{maxOutputLength:metadata.bytes});
if(binary.length!==metadata.bytes||hash(binary)!==metadata.sha256)throw Error('Native asset changed');
const directory=mkdtempSync('/tmp/holodeck-native-');
const file=directory+'/canvas.node';writeFileSync(file,binary,{mode:0o500,flag:'wx'});
process.env.NAPI_RS_NATIVE_LIBRARY_PATH=file;
process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));
process.env.HOLODECK_JSDOM_HELPERS=new URL('./runtime/jsdom/lib/jsdom/living/helpers',import.meta.url).pathname;
process.env.HOLODECK_XHR_WORKER=new URL('./src/xhr-sync-worker.mjs',import.meta.url).pathname;
const {main}=await import('./src/server.mjs');
await main();
