// Existing Home auth and service audience are authoritative on every operation.
// Receiving addresses are operator-selected configuration, never browser input.
export function homeIdentityResolver(config,{fetcher=fetch}={}) {
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
    const access=await fetcher(config.authorizeEndpoint,{headers,redirect:'error',signal:AbortSignal.timeout(4000)});
    if(access.status!==204)return null;
    const identity=await fetcher(config.identityEndpoint,{headers:{Host:config.authHost,Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(4000)});
    if(!identity.ok)return null;
    const value=await identity.json();
    if(value.contract!=='dm.home-session/v1'||value.origin!==config.publicOrigin
      || !Number.isFinite(value.expires)||value.expires<=Date.now()/1000
      || value.actor?.kind!=='human'||typeof value.actor.ref!=='string'||value.actor.ref.length>200
      ||typeof value.actor.revision!=='string')return null;
    return {id:value.actor.ref,ref:value.actor.ref,kind:'human',revision:value.actor.revision,
      name:typeof value.actor.name==='string'?value.actor.name.slice(0,80):'Explorador',
      rights:['observe','edit','project'],expires:value.expires};
  };
}
