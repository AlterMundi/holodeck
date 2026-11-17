import net from 'node:net';
import { chmodSync,lstatSync } from 'node:fs';
import { DaimonPort } from './daimon-port.mjs';

// The receiving operator owns the directory/socket filesystem capability.
// Native identity and current room rights are independently rechecked per request.
export async function createWorldPort({socketPath,room,native,resolveRights,expectedBeingRef=null}){
  if(!socketPath?.startsWith('/')||!native?.authorizeWorldRequest||typeof resolveRights!=='function')
    throw Error('Select the installed native world port and authority resolver');
  let active=0;
  const server=net.createServer(socket=>{
    if(active>=4){socket.end(JSON.stringify({ok:false,message:'El mundo está ocupado; consultá el resultado antes de repetir una acción.'})+'\n');return;}
    active++;let bytes=Buffer.alloc(0),handled=false;
    socket.setTimeout(55000,()=>socket.destroy());
    socket.once('close',()=>active--);
    socket.on('error',()=>{});
    socket.on('data',async data=>{
      if(handled)return;
      bytes=Buffer.concat([bytes,data]);
      if(bytes.length>16384){handled=true;socket.destroy();return;}
      const end=bytes.indexOf(10);if(end<0)return;handled=true;
      try{
        const request=JSON.parse(bytes.subarray(0,end));
        if(!request||Object.keys(request).sort().join(',')!=='args,interactionId,operation'
          ||!['observe','project','act','result'].includes(request.operation)
          ||!request.args||typeof request.args!=='object'||Array.isArray(request.args))throw Error('Invalid world operation');
        const verified=await native.authorizeWorldRequest(request.interactionId,expectedBeingRef);
        if(expectedBeingRef!==null&&verified.actor?.ref!==expectedBeingRef)throw Error('Native return lane identity changed');
        const rights=await resolveRights(verified);
        if(!rights?.includes('observe'))throw Error('Room admission expired');
        const actor={...verified.actor,rights};
        const port=new DaimonPort(room,async()=>actor);
        let result;
        if(request.operation==='observe')result=await port.observe(null,request.args);
        else if(request.operation==='project')result=await port.project(null,request.args);
        else if(request.operation==='result')result=await port.result(null,request.args.id);
        else{
          if(request.args.nativeRequest&&request.args.nativeRequest!==verified.nativeRequest)throw Error('Native request changed');
          result=await port.act(null,{...request.args,nativeRequest:verified.nativeRequest});
        }
        const response=JSON.stringify({ok:true,result});
        if(Buffer.byteLength(response)>131072)throw Error('World response exceeds its bound');
        socket.end(response+'\n');
      }catch{socket.end(JSON.stringify({ok:false,message:'No pude confirmar esa operación. Revisá el turno, el acceso y el estado del mundo antes de intentar otra acción.'})+'\n');}
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve);});
  chmodSync(socketPath,0o660);
  const stat=lstatSync(socketPath);
  if(!stat.isSocket()||stat.uid!==process.getuid()){server.close();throw Error('World port ownership changed');}
  return {close:()=>new Promise(resolve=>server.close(resolve))};
}
