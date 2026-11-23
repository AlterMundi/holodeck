import {Readable,pipeline} from 'node:stream';
import {createBrotliDecompress} from 'node:zlib';

export function packedClientHandler(bytes) {
  return (req,res)=>{
    const encoding=req.acceptsEncodings('br','identity');
    res.vary('Accept-Encoding');
    if(!encoding)return res.sendStatus(406);
    res.type('text/javascript');
    if(encoding==='br'){
      res.set('Content-Encoding','br');
      return res.send(bytes);
    }
    if(req.method==='HEAD')return res.end();
    pipeline(Readable.from([bytes]),createBrotliDecompress(),res,error=>{
      if(error&&!res.destroyed)res.destroy(error);
    });
  };
}
