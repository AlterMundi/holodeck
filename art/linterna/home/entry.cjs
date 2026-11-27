'use strict';

const {createHash}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');

const prefix='/taller-oliva/casa-linterna/';
const types={'index.html':'text/html; charset=utf-8','linterna.js':'text/javascript; charset=utf-8',
  'linterna.css':'text/css; charset=utf-8'};
const fileLimit=1024*1024;
const idPattern=/^[a-f0-9]{32}$/;
const digestPattern=/^[a-f0-9]{64}$/;
const headers={
  'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

async function createServer(root=__dirname,{authenticate,fetchAsset=fetch}={}){
  const {resource,version,humanRef,files}=JSON.parse(readFileSync(join(root,'linterna-selection.json'),'utf8'));
  if(!idPattern.test(resource)||!digestPattern.test(version)||!/^human:telegram:[1-9][0-9]*$/.test(humanRef)||
     Object.keys(files??{}).sort().join(',')!==Object.keys(types).sort().join(',')||
     Object.values(files).some(value=>!digestPattern.test(value)))throw Error('Invalid Casa Linterna publication selection');
  const origin='https://oliva.dmn.homes';
  const {createHomeAuth}=await import('./home-auth.mjs');
  const authorize=authenticate??createHomeAuth({origin,humanRef}).authenticate;
  const server=await require('./sculpt-workshop-entry.cjs').createServer(root);
  const original=server.listeners('request');
  server.removeAllListeners('request');
  server.on('request',async(req,res)=>{
    const path=req.url?.split('?',1)[0];
    if(path!==prefix.slice(0,-1)&&!path?.startsWith(prefix)){
      for(const listener of original)listener.call(server,req,res);
      return;
    }
    const reply=(status,body='',extra={})=>{
      res.writeHead(status,{...headers,...extra});
      res.end(req.method==='HEAD'?undefined:body);
    };
    const file=path.slice(prefix.length)||'index.html';
    if(!['GET','HEAD'].includes(req.method))return reply(405,'',{Allow:'GET, HEAD'});
    try{
      await authorize(req);
      if(path===prefix.slice(0,-1))return reply(308,'',{Location:prefix});
      if(!Object.hasOwn(types,file))return reply(404);
      const tokens=(req.headers.cookie??'').split(';').map(value=>value.trim())
        .filter(value=>/^__Host-home=[A-Za-z0-9_-]{43}$/.test(value));
      if(tokens.length!==1)return reply(401);
      const response=await fetchAsset(`${origin}/works/${resource}/${version}/${file}`,{
        headers:{Cookie:tokens[0]},redirect:'error',signal:AbortSignal.timeout(10000),
      });
      if(!response.ok||!response.body)throw Error('Pinned Linterna bytes unavailable');
      let length=0;
      const chunks=[];
      for await(const chunk of response.body){
        length+=chunk.length;
        if(length>fileLimit)throw Error('Pinned Linterna asset too large');
        chunks.push(chunk);
      }
      const body=Buffer.concat(chunks,length);
      if(createHash('sha256').update(body).digest('hex')!==files[file])throw Error('Pinned Linterna asset changed');
      return reply(200,body,{'Content-Type':types[file],'Content-Length':body.length});
    }catch(error){
      if(error.status===401&&file==='index.html')
        return reply(303,'',{Location:`/access/sso/start?return=${encodeURIComponent(prefix)}`});
      return reply([401,403].includes(error.status)?error.status:503);
    }
  });
  return server;
}

module.exports={createServer};
if(require.main===module){
  createServer().then(server=>server.listen(Number(process.env.PORT),process.env.HOST))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
