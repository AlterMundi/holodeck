import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {AVATARS} from './avatar-registry.mjs';

// Keep the canonical bytes and URLs of bundled animated characters.
const companion=AVATARS['compaii-navegante-white-v1'];
export const ANIMATION_ASSET_REVISIONS=Object.freeze({
  [companion.model]:companion.modelSha256,
  'assets/footballer-10.glb':'ced2ad8de32a214685d2315f60b2ec0a0637682dcca8fd3722cb9fd9918a6e26',
  'assets/anim_air.glb':'370b7b800de11d66cb365ec8a147135a789c476922daee80ed664cbce9941c8f',
  'assets/anim_double_jump.glb':'a40ea3c384d4428e7a3c584f726f6a1c73adb4ea3fa3fa943447d1dcf2c05cd7',
  'assets/anim_idle.glb':'616abbfb6997bb1ebf149ce7fa272c740dbbabd75c53651214b0f52eb24e0841',
  'assets/anim_jog.glb':'553512641d0ffcbed244f1129d5bfa1c31d4c6e3ee2b154663cc14f9aea18cce',
  'assets/anim_run.glb':'9edf0340d0b17a4dbb84a33f773e076f60d136b6d99eb0094578408da3a332b3',
});

const MAX_ART_BYTES=4*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function readPackedArt(path,revision) {
  const file=new URL('../runtime/art/'+path+'.br',import.meta.url);
  const stat=statSync(file,{throwIfNoEntry:false});
  if(!stat)return null;
  if(!stat.isFile()||stat.size>MAX_ART_BYTES)throw Error('Invalid packed art size: '+path);
  const packed=readFileSync(file);
  const bytes=brotliDecompressSync(packed,{maxOutputLength:MAX_ART_BYTES});
  if(digest(bytes)!==revision)throw Error('Packed art differs from the qualified export: '+path);
  return {bytes,packed,revision:revision+'.glb',modified:stat.mtime.toUTCString(),
    identityTag:'"'+revision+'"',packedTag:'"'+digest(packed)+'"'};
}

function freshRange(req,{identityTag,modified}) {
  const validator=req.headers['if-range'];
  if(!validator)return true;
  if(validator.startsWith('"'))return validator===identityTag;
  return Date.parse(validator)>=Date.parse(modified);
}

export function sendPackedArt(req,res,art,exterior=false) {
  res.vary('Accept-Encoding');
  let encoding=req.acceptsEncodings('br','identity');
  if(exterior)res.set('Access-Control-Allow-Origin','*');
  if(!encoding)return res.sendStatus(406);

  // Range offsets describe the canonical GLB rather than the compressed stream.
  let range;
  if(exterior&&/^bytes=/.test(req.headers.range??'')&&freshRange(req,art)&&req.acceptsEncodings('identity')){
    range=req.range(art.bytes.length,{combine:true});
    encoding='identity';
  }

  if(exterior){
    const tag=encoding==='br'?art.packedTag:art.identityTag;
    res.set({'Last-Modified':art.modified,'ETag':tag});
    if(encoding==='identity')res.set('Accept-Ranges','bytes');
    const match=req.headers['if-match'];
    const modifiedSince=Date.parse(req.headers['if-unmodified-since']);
    if(match ? match!=='*'&&!match.split(',').some(value=>value.trim()===tag)
       : modifiedSince<Date.parse(art.modified))return res.status(412).end();
    if(req.fresh)return res.status(304).end();
  }
  res.type('model/gltf-binary');
  if(encoding==='br') {
    res.set('Content-Encoding','br');
    return res.send(art.packed);
  }

  const length=art.bytes.length;
  if(range===-1)return res.status(416).set('Content-Range','bytes */'+length).end();
  if(range?.length===1) {
    const {start,end}=range[0];
    return res.status(206).set('Content-Range',`bytes ${start}-${end}/${length}`)
      .send(art.bytes.subarray(start,end+1));
  }
  return res.send(art.bytes);
}
