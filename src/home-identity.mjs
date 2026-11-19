import {request as httpRequest} from 'node:http';

// Node fetch may replace a custom Host on loopback requests. The existing Home
// gateway needs its selected virtual host, so preserve it through node:http.
function loopbackGet(endpoint,{headers,signal}){
  return new Promise((resolve,reject)=>{
    const request=httpRequest(endpoint,{method:'GET',headers,signal},response=>{
      const chunks=[];let bytes=0;
      response.on('error',reject);
      response.on('aborted',()=>reject(Error('Home response interrupted')));
      response.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>8192){response.destroy(Error('Home response exceeds limit'));return;}
        chunks.push(chunk);
      });
      response.on('end',()=>{
        const status=response.statusCode;
        resolve({status,ok:status>=200&&status<300,
          json:async()=>JSON.parse(Buffer.concat(chunks).toString('utf8'))});
      });
    });
    request.on('error',reject);
    request.end();
  });
}

// Existing Home auth and service audience are authoritative on every operation.
// Receiving addresses are operator-selected configuration, never browser input.
export function homeIdentityResolver(config,{fetcher=loopbackGet}={}) {
  if(!config?.publicOrigin||!config.authHost||!config.identityEndpoint||!config.authorizeEndpoint)
    throw Error('The existing Home identity and audience routes are required');
  const origin=new URL(config.publicOrigin);
  if(origin.protocol!=='https:'||origin.origin!==config.publicOrigin)throw Error('Select the canonical HTTPS origin');
  for(const value of [config.identityEndpoint,config.authorizeEndpoint]){
    const endpoint=new URL(value);
    if(endpoint.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(endpoint.hostname))
      throw Error('Home auth must use the selected loopback receiver');
  }
  return async request=>{
    const cookie=request.headers.cookie;
    if(typeof cookie!=='string'||Buffer.byteLength(cookie)>8192) return null;
    const headers={Host:config.authHost,Cookie:cookie,'X-Forwarded-Method':request.method||'GET'};
    if(request.method!=='GET'&&request.method!=='HEAD'){
      if(request.headers.origin!==config.publicOrigin)return null;
      headers.Origin=config.publicOrigin;
    }
    // Both GETs share one total deadline. An unavailable Home denies admission
    // instead of leaking a rejected promise into Express/MML authentication.
    try{
      const signal=AbortSignal.timeout(4000);
      const access=await fetcher(config.authorizeEndpoint,{headers,redirect:'error',signal});
      if(access.status!==204)return null;
      const identity=await fetcher(config.identityEndpoint,{headers:{Host:config.authHost,Cookie:cookie},redirect:'error',signal});
      if(!identity.ok)return null;
      const value=await identity.json();
      if(value.contract!=='dm.home-session/v1'||value.origin!==config.publicOrigin
        || !Number.isFinite(value.expires)||value.expires<=Date.now()/1000
        || value.actor?.kind!=='human'||typeof value.actor.ref!=='string'||value.actor.ref.length>200
        ||typeof value.actor.revision!=='string')return null;
      return {id:value.actor.ref,ref:value.actor.ref,kind:'human',revision:value.actor.revision,
        name:typeof value.actor.name==='string'?value.actor.name.slice(0,80):'Explorador',
        rights:['observe','edit','project'],expires:value.expires};
    }catch{return null;}
  };
}
