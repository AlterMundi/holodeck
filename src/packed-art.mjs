import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';

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
