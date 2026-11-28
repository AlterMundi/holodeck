import {parentPort} from 'node:worker_threads';
import {buildIcon} from './teleport-icons.mjs';

// Icon generation parses whole room exports; keep it off the server's event loop.
parentPort.on('message',async({id,source})=>{
  try{
    const bytes=await buildIcon(source);
    parentPort.postMessage({id,bytes},bytes?[bytes.buffer]:[]);
  }catch{
    parentPort.postMessage({id,bytes:null});
  }
});
