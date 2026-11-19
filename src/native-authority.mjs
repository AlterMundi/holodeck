import net from 'node:net';

// The existing Home owner bridge answers policy for this fixed service. It
// creates no browser session and shares no owner credential with the web app.
// Source admission and the return-port identity must already be verified.
export function createNativeRoomAuthority(socketPath,{timeoutMs=8000}={}){
 if(typeof socketPath!=='string'||!socketPath.startsWith('/')||socketPath.length>4096||socketPath.includes('\0'))throw Error('Select the existing owner authority socket');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Select a bounded authority deadline');
 return async verified=>{
  const actor=verified?.actor;
  if(actor?.kind!=='daimon'||actor.id!==actor.ref||!/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(actor.ref))throw Error('A verified native being is required');
  const result=await new Promise((resolve,reject)=>{
   const socket=net.createConnection({path:socketPath});let bytes=Buffer.alloc(0),done=false;
   const timer=setTimeout(()=>finish(Error('Current service authority unavailable')),timeoutMs);
   function finish(error,value){if(done)return;done=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve(value);}
   socket.on('error',error=>finish(error));
   socket.on('connect',()=>socket.write(JSON.stringify({operation:'world-access',beingRef:actor.ref})+'\n'));
   socket.on('data',chunk=>{
    bytes=Buffer.concat([bytes,chunk]);if(bytes.length>8192)return finish(Error('Authority response exceeds its bound'));
    const end=bytes.indexOf(10);if(end<0)return;
    try{const value=JSON.parse(bytes.subarray(0,end));if(value.ok!==true)throw Error('Current service authority unavailable');finish(null,value.result);}
    catch(error){finish(error);}
   });
   socket.on('end',()=>{if(!done)finish(Error('Authority response incomplete'));});
  });
  if(!result||result.schema!=='holodeck.world-access/v1'||result.beingRef!==actor.ref||typeof result.allowed!=='boolean')throw Error('Authority response does not match this being');
  // Home admits members to this cooperative workshop. Use the same workshop
  // actions as admitted humans; a query error never falls back to a human cookie.
  return result.allowed?['observe','edit','project']:[];
 };
}
