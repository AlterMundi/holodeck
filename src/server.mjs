import express from 'express';
import { Networked3dWebExperienceServer } from '@mml-io/3d-web-experience-server';
import { EditableNetworkedDOM, LocalObservableDOMFactory, NetworkedDOM } from '@mml-io/networked-dom-server';
import { handleExperienceWebsocketSubprotocol } from '@mml-io/3d-web-experience-protocol';
import enableWs from 'express-ws';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { Room, RoomError, LIMITS } from './room.mjs';
import { RoomStore } from './room-store.mjs';
import { homeIdentityResolver } from './home-identity.mjs';
import { worldDocument } from './world.mjs';
import { createWorldPort } from './world-port.mjs';

const cookieToken=req=>req.headers.cookie?.match(/(?:^|; )holodeck_session=([a-f0-9]{40})(?:;|$)/)?.[1];
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export async function createHolodeck({basePath='/',production=false,identityResolver=null,publicOrigin=null,stateDir=null,nativeFactory=null,worldSocket=null}={}){
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(basePath))throw Error('Select a bounded absolute base path');
  if(production&&(!identityResolver||!publicOrigin||!stateDir))throw Error('Shared identity, audience and state are required in production');
  const route=path=>basePath+path;
  const app=express();
  enableWs(app,undefined,{wsOptions:{handleProtocols:(protocols,req)=>req.url?.split('?')[0]===route('world')
    ?NetworkedDOM.handleWebsocketSubprotocol(protocols):handleExperienceWebsocketSubprotocol(protocols)}});
  const sessions=new Map();let nextId=0;
  const localBoot=randomBytes(4).toString('hex');
  const store=stateDir?new RoomStore(stateDir):null;
  const room=new Room({state:store?.load(),persist:store?s=>store.save(s):null,
    presence:()=>[...sessions.values()].filter(s=>s.connection!==null&&Date.now()-s.created<1800000)
      .map(s=>({actor:s.actor.id,kind:'human',name:s.actor.name||'Explorador',scope:'authenticated-room-presence',position:null}))});
  const document=new EditableNetworkedDOM('http://localhost'+route('world'),LocalObservableDOMFactory);
  let projectionHealthy=true;
  const project=()=>{try{document.load(worldDocument(room,{basePath}));projectionHealthy=true;}catch{projectionHealthy=false;}};
  project();room.on('change',project);
  const native=nativeFactory?await nativeFactory({room,stateDir}):null;
  let worldPort=null;
  async function currentActor(req,session){
    if(!session||Date.now()-session.created>1800000)return null;
    if(!identityResolver)return session.actor;
    const actor=await identityResolver(req);
    if(!actor||actor.id!==session.actor.id)return null;
    session.actor=actor;return actor;
  }
  if(worldSocket&&native)worldPort=await createWorldPort({socketPath:worldSocket,room,native,resolveRights:async verified=>{
    const session=[...sessions.values()].find(s=>s.actor.id===verified.humanRef&&Date.now()-s.created<1800000);
    if(!session)return [];
    const actor=await currentActor({method:'POST',headers:{cookie:session.sourceCookie,origin:publicOrigin}},session);
    return actor?.rights||[];
  }});
  const auth={
    async generateAuthorizedSessionToken(req){
      const actor=identityResolver?await identityResolver(req):{id:`local-${localBoot}-${nextId+1}`,kind:'human',name:`Explorador ${nextId+1}`,rights:['observe','edit','project']};
      if(!actor)return null;
      for(const [token,s]of sessions)if(Date.now()-s.created>1800000&&s.connection===null)sessions.delete(token);
      if(sessions.size>=LIMITS.sessions){const inactive=[...sessions].find(([,s])=>s.connection===null);if(inactive)sessions.delete(inactive[0]);else return null;}
      const token=randomBytes(20).toString('hex'),id=++nextId;
      sessions.set(token,{id,actor,created:Date.now(),times:[],connection:null,sourceCookie:req.headers.cookie});
      req.res.cookie('holodeck_session',token,{httpOnly:true,secure:production,sameSite:'lax',path:basePath,maxAge:1800000});
      return token;
    },
    getClientIdForSessionToken(token){const s=sessions.get(token);return s?{id:s.id}:null;},
    async onClientConnect(connection,token){
      const s=sessions.get(token);
      if(!s||s.connection!==null)return new Error('Room session unavailable');
      const actor=await currentActor({method:'GET',headers:{cookie:s.sourceCookie}},s);
      if(!actor)return new Error('Room access expired');
      s.connection=connection;
      room.atomic(()=>room.event(actor,'participant.joined',{name:actor.name||'Explorador'}));
      return {userId:actor.id,username:actor.name||`Explorador ${s.id}`,characterDescription:{meshFileUrl:route('assets/avatar-1-bodyA-skin01.glb')},colors:null};
    },
    onClientDisconnect(connection){for(const s of sessions.values())if(s.connection===connection){s.connection=null;room.atomic(()=>room.event(s.actor,'participant.left',{}));}},
    onClientUserIdentityUpdate(){return false;}
  };
  const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8').replace('<head>','<head><base href="'+basePath+'">');
  const network=new Networked3dWebExperienceServer({networkPath:route('network'),userAuthenticator:auth,
    webClientServing:{indexUrl:basePath,indexContent:index,clientBuildDir:new URL('../build',import.meta.url).pathname,clientUrl:route('client/')},
    assetServing:{assetsDir:new URL('../public/assets',import.meta.url).pathname,assetsUrl:route('assets/')},
    worldConfig:{mmlDocuments:{workshop:{url:'ws://'+route('world')}},enableChat:false,enableTweakPane:false,
      environmentConfiguration:{groundPlane:false,sun:{intensity:1.4},ambientLight:{intensity:1.2},fog:{fogNear:45,fogFar:140,fogColor:{r:.67,g:.78,b:.79}}},
      avatarConfiguration:{allowCustomAvatars:false},allowCustomDisplayName:false,allowOrbitalCamera:true,
      spawnConfiguration:{spawnPosition:{x:0,y:1,z:6},spawnYRotation:180},hud:{respawnButton:false}}
  });
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.use(express.json({limit:'48kb',strict:true}));
  network.registerExpressRoutes(app);
  if(basePath!=='/')app.get(basePath.slice(0,-1),(_req,res)=>res.redirect(308,basePath));
  app.get(route('health'),(_req,res)=>res.status(projectionHealthy?200:503).json({ok:projectionHealthy}));
  app.ws(route('world'),(ws,req)=>{
    currentActor(req,sessions.get(cookieToken(req))).then(actor=>{
      if(!actor){ws.close(1008);return;}
      document.addWebSocket(ws);ws.on('close',()=>document.removeWebSocket(ws));
    }).catch(()=>ws.close(1008));
  });
  app.use(route('api'),asyncRoute(async(req,res,next)=>{
    // Bearer fallback is confined to the local development harness.
    const token=cookieToken(req)||(!production?req.headers.authorization?.replace(/^Bearer /,''):null);
    const session=sessions.get(token),actor=await currentActor(req,session);
    if(!actor)return res.status(401).json({message:'Volvé a entrar al taller.'});
    if(req.method==='POST'){
      const expectedOrigin=publicOrigin||`http://${req.headers.host}`;
      if((production||req.headers.origin)&&req.headers.origin!==expectedOrigin)return res.status(403).json({message:'Abrí esta acción desde el taller.'});
      const now=Date.now();session.times=session.times.filter(time=>now-time<1000);
      if(session.times.length>=4)return res.status(429).json({message:'Esperá un momento antes de intentar otra acción.'});
      session.times.push(now);
    }
    req.actor=actor;next();
  }));
  app.get(route('api/state'),asyncRoute(async(req,res)=>res.json({run:room.run,edition:room.edition,sequence:room.sequence,entities:room.entities,
    native:native?await native.availability(req.actor):{available:false}})));
  app.post(route('api/observe'),(req,res)=>res.json(room.observe(req.actor,req.body)));
  app.post(route('api/commands'),(req,res)=>res.json(room.command(req.actor,req.body)));
  app.get(route('api/commands/:id'),(req,res)=>{
    const result=room.result(req.actor,req.params.id);
    if(!result)return res.status(404).json({message:'Todavía no hay un resultado confirmado.'});res.json(result);
  });
  app.post(route('api/projection'),(req,res)=>res.json(room.project(req.actor,req.body)));
  app.post(route('api/interactions'),asyncRoute(async(req,res)=>{
    if(!native)return res.status(503).json({message:'La conversación todavía no está conectada a este mundo.'});
    res.json(await native.submit(req.actor,req.body));
  }));
  app.get(route('api/interactions/:id'),asyncRoute(async(req,res)=>{
    if(!native)return res.status(503).json({message:'La conversación todavía no está conectada a este mundo.'});
    res.json(await native.status(req.actor,req.params.id));
  }));
  app.use((error,_req,res,_next)=>{
    const known=error instanceof RoomError;
    res.status(known?409:error.type==='entity.too.large'?413:503).json({message:known?'El mundo cambió o esa acción no está disponible. Revisá el lugar antes de intentarlo de nuevo.':'No pude completar esa acción. Conservé los cambios que ya estaban confirmados.'});
  });
  return {app,room,native,close(){worldPort?.close();network.dispose();document.dispose();}};
}

export async function main(){
  const production=process.env.NODE_ENV==='production';
  const stateDir=process.env.STATE_DIR||null;
  const receiving=production?JSON.parse(readFileSync(join(stateDir||'','receiving.json'),'utf8')):null;
  if(production&&receiving.schema!=='holodeck.receiving/v1')throw Error('Select the existing Holodeck receiving configuration');
  const resolver=production?homeIdentityResolver({publicOrigin:receiving.origin,authHost:receiving.authHost,identityEndpoint:receiving.authEndpoint,authorizeEndpoint:receiving.authorizeEndpoint}):null;
  let nativeFactory=null;
  if(receiving?.nativeSocket){
    const integration=await import('./native-conversation.mjs');
    nativeFactory=options=>integration.nativeFactory({...options,receiving});
  }
  const runtime=await createHolodeck({production,stateDir,basePath:receiving?.basePath||'/',publicOrigin:receiving?.origin,identityResolver:resolver,nativeFactory,worldSocket:receiving?.worldSocket});
  const port=Number(process.env.PORT||18940);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Select a valid loopback port');
  if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('Use the existing loopback gateway');
  const listener=runtime.app.listen(port,'127.0.0.1',()=>console.log('Holodeck receiver listening on loopback port '+port));
  const close=()=>{listener.close();runtime.close();};
  process.once('SIGINT',()=>{close();process.exit(0);});process.once('SIGTERM',()=>{close();process.exit(0);});
  return {runtime,listener};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
