import express from 'express';
import { Networked3dWebExperienceServer } from '@mml-io/3d-web-experience-server';
import { NetworkedDOM } from '@mml-io/networked-dom-server';
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
import {validateContentVisits,visitsForActor} from './content-visits.mjs';
import {createNativeRoomAuthority} from './native-authority.mjs';
import {WorldDocument} from './world-document.mjs';
import {SessionBindings,SESSION_MS,sessionKey} from './session-bindings.mjs';

const cookieToken=req=>req.headers.cookie?.match(/(?:^|; )holodeck_session=([a-f0-9]{40})(?:;|$)/)?.[1];
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export async function createHolodeck({basePath='/',production=false,identityResolver=null,publicOrigin=null,stateDir=null,nativeFactory=null,worldSocket=null,worldSocketBeingRef=null,worldPorts=[],contentVisits=[],nativeRoomAuthority=null}={}){
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(basePath))throw Error('Select a bounded absolute base path');
  if(production&&(!identityResolver||!publicOrigin||!stateDir))throw Error('Shared identity, audience and state are required in production');
  const selectedContentVisits=validateContentVisits(contentVisits);
  if(nativeRoomAuthority!==null&&typeof nativeRoomAuthority!=='function')throw Error('Select the installed native service authority reader');
  const route=path=>basePath+path;
  const app=express();
  // Express4 does not forward a rejected async handler. The upstream MML index
  // issues the session in such a handler; include its persistence errors in the
  // same bounded failure path as our own API routes.
  const registerGet=app.get.bind(app);
  app.get=(path,...handlers)=>registerGet(path,...handlers.map(handler=>
    handler.constructor?.name==='AsyncFunction'?asyncRoute(handler):handler));
  enableWs(app,undefined,{wsOptions:{handleProtocols:(protocols,req)=>req.url?.split('?')[0]===route('world')
    ?NetworkedDOM.handleWebsocketSubprotocol(protocols):handleExperienceWebsocketSubprotocol(protocols)}});
  const sessions=new Map();const sockets=new Map();let nextId=0,authorizationTimer=null,pendingSockets=0;
  const sessionBindings=production?new SessionBindings(stateDir,LIMITS.sessions):null;
  for(const binding of sessionBindings?.load()||[])sessions.set(binding.key,{id:++nextId,
    actor:{id:binding.actorRef,kind:'human'},created:binding.created,times:[],connection:null,sourceCookie:undefined});
  const sessionFor=token=>sessions.get(sessionKey(token));
  const localBoot=randomBytes(4).toString('hex');
  const store=stateDir?new RoomStore(stateDir):null;
  const room=new Room({state:store?.load(),persist:store?s=>store.save(s):null,
    presence:()=>[...sessions.values()].filter(s=>s.connection!==null&&Date.now()-s.created<SESSION_MS)
      .map(s=>({actor:s.actor.id,kind:'human',name:s.actor.name||'Explorador',scope:'authenticated-room-presence',position:null}))});
  const document=new WorldDocument('http://localhost'+route('world'));
  let projectionHealthy=true,projectionQueued=false,projectionRunning=false;
  const project=async()=>{
    projectionQueued=true;if(projectionRunning)return;projectionRunning=true;
    try{while(projectionQueued){projectionQueued=false;
      await Promise.all([...sockets].map(([socket,record])=>checkSocket(socket,record)));
      if(room.commitUncertain){projectionHealthy=false;return;}
      await document.load(worldDocument(room,{basePath}));projectionHealthy=true;
    }}catch{projectionHealthy=false;}finally{projectionRunning=false;}
  };
  await project();if(!projectionHealthy){document.dispose();throw Error('The initial world representation could not load');}room.on('change',project);
  const native=nativeFactory?await nativeFactory({room,stateDir}):null;
  const installedWorldPorts=[];
  async function currentActor(req,session){
    if(!session||Date.now()-session.created>=SESSION_MS)return null;
    if(!identityResolver)return session.actor;
    const actor=await identityResolver(req);
    if(!actor||actor.id!==session.actor.id)return null;
    session.actor=actor;session.sourceCookie=req.headers.cookie;return actor;
  }
  async function checkSocket(socket,record){
    if(record.checking)return record.checking;
    record.checking=(async()=>{
      try{
        const actor=await currentActor({method:'GET',headers:{cookie:record.session.sourceCookie}},record.session);
        if(!actor||room.commitUncertain)socket.close(1008);
      }catch{socket.close(1008);}
    })();
    try{await record.checking;}finally{record.checking=null;}
  }
  // Existing HTTP forward-auth does not reauthorize an established WebSocket.
  // Keep one bounded timer only while this room has connections, with no model
  // attention; semantic updates additionally recheck before publishing geometry.
  const registerSocket=app.ws.bind(app);
  app.ws=(path,handler)=>registerSocket(path,(socket,req)=>{
    if(sockets.size+pendingSockets>=LIMITS.sessions*2){socket.close(1013);return;}
    const expected=publicOrigin||`http://${req.headers.host}`;
    if((production||req.headers.origin)&&req.headers.origin!==expected){socket.close(1008);return;}
    const session=sessionFor(cookieToken(req));
    pendingSockets++;
    currentActor(req,session).then(actor=>{
      if(!actor||socket.readyState!==1){socket.close(1008);return;}
      const record={session,checking:null};sockets.set(socket,record);
      socket.once('close',()=>{sockets.delete(socket);if(!sockets.size&&authorizationTimer){clearInterval(authorizationTimer);authorizationTimer=null;}});
      if(!authorizationTimer){authorizationTimer=setInterval(()=>{
        for(const [current,state]of sockets)checkSocket(current,state);
      },2000);authorizationTimer.unref();}
      handler(socket,req);
    }).catch(()=>socket.close(1008)).finally(()=>pendingSockets--);
  });
  const selectedWorldPorts=validateWorldPorts({worldSocket,worldSocketBeingRef,worldPorts});
  if(selectedWorldPorts.length&&!native)throw Error('Native authority is required for world return ports');
  for(const selected of selectedWorldPorts)installedWorldPorts.push(await createWorldPort({socketPath:selected.socket,expectedBeingRef:selected.beingRef,room,native,resolveRights:async verified=>{
    if(nativeRoomAuthority){const rights=await nativeRoomAuthority(verified);return projectionHealthy?rights:rights.filter(right=>right==='observe');}
    // Compatibility for older receivers only. New native authority selection
    // is explicit and never falls back here after a failed policy query.
    const session=[...sessions.values()].find(s=>s.actor.id===verified.humanRef&&Date.now()-s.created<SESSION_MS&&s.sourceCookie!==undefined);
    if(!session)return [];
    const actor=await currentActor({method:'POST',headers:{cookie:session.sourceCookie,origin:publicOrigin}},session);
    const rights=actor?.rights||[];return projectionHealthy?rights:rights.filter(right=>right==='observe');
  }}));
  const auth={
    async generateAuthorizedSessionToken(req){
      const actor=identityResolver?await identityResolver(req):{id:`local-${localBoot}-${nextId+1}`,kind:'human',name:`Explorador ${nextId+1}`,rights:['observe','edit','project']};
      if(!actor)return null;
      const next=new Map(sessions);
      for(const [key,s]of next)if(Date.now()-s.created>=SESSION_MS&&s.connection===null)next.delete(key);
      if(next.size>=LIMITS.sessions){const inactive=[...next].find(([,s])=>s.connection===null);if(inactive)next.delete(inactive[0]);else return null;}
      const token=randomBytes(20).toString('hex'),id=++nextId;
      next.set(sessionKey(token),{id,actor,created:Date.now(),times:[],connection:null,sourceCookie:req.headers.cookie});
      sessionBindings?.save(next);
      sessions.clear();for(const [key,session]of next)sessions.set(key,session);
      req.res.cookie('holodeck_session',token,{httpOnly:true,secure:production,sameSite:'lax',path:basePath,maxAge:SESSION_MS});
      return token;
    },
    getClientIdForSessionToken(token){const s=sessionFor(token);return s?{id:s.id}:null;},
    async onClientConnect(connection,token,_presentedIdentity,socket){
      const s=sessionFor(token);
      if(!s||s.connection!==null)return new Error('Room session unavailable');
      // The MML handshake token is independent of the HTTP upgrade cookie.
      // Validate its owner against THIS socket's current shared-Home identity,
      // never against another session's remembered authentication cookie.
      const record=sockets.get(socket);
      if(!record||socket.readyState!==1||record.session.actor.id!==s.actor.id)return new Error('Room identity does not match this connection');
      const actor=await currentActor({method:'GET',headers:{cookie:record.session.sourceCookie}},s);
      if(!actor)return new Error('Room access expired');
      if(s.connection!==null||sessionFor(token)!==s||socket.readyState!==1||!sockets.has(socket))return new Error('Room connection changed');
      s.connection=connection;
      room.atomic(()=>room.event(actor,'participant.joined',{name:actor.name||'Explorador'}));
      return {userId:actor.id,username:actor.name||`Explorador ${s.id}`,characterDescription:{meshFileUrl:route('assets/avatar-1-bodyA-skin01.glb')},colors:null};
    },
    onClientDisconnect(connection){for(const s of sessions.values())if(s.connection===connection){s.connection=null;if(!room.commitUncertain)room.atomic(()=>room.event(s.actor,'participant.left',{}));}},
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
  app.get(route('health'),(_req,res)=>res.status(projectionHealthy&&!room.commitUncertain?200:503).json({ok:projectionHealthy&&!room.commitUncertain}));
  app.ws(route('world'),(ws,req)=>{
    currentActor(req,sessionFor(cookieToken(req))).then(actor=>{
      if(!actor){ws.close(1008);return;}
      document.addWebSocket(ws);ws.on('close',()=>{if(document.hasWebSocket(ws))document.removeWebSocket(ws);});
    }).catch(()=>ws.close(1008));
  });
  app.use(route('api'),asyncRoute(async(req,res,next)=>{
    // Bearer fallback is confined to the local development harness.
    const token=cookieToken(req)||(!production?req.headers.authorization?.replace(/^Bearer /,''):null);
    const session=sessionFor(token),actor=await currentActor(req,session);
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
  app.get(route('api/state'),asyncRoute(async(req,res)=>{
    if(room.commitUncertain)return res.status(503).json({message:'El taller necesita recuperar su último cambio antes de continuar.'});
    res.json({run:room.run,edition:room.edition,sequence:room.sequence,actorRef:req.actor.id,entities:room.entities,focus:room.focusState(),
      native:native?await native.availability(req.actor):{available:false}});
  }));
  app.get(route('api/content-visits'),(req,res)=>res.json({visits:visitsForActor(selectedContentVisits,req.actor)}));
  app.post(route('api/observe'),(req,res)=>res.json(room.observe(req.actor,req.body)));
  app.post(route('api/commands'),(req,res)=>projectionHealthy?res.json(room.command(req.actor,req.body)):res.status(503).json({message:'La vista del taller necesita recuperarse antes de agregar cambios.'}));
  app.get(route('api/commands/:id'),(req,res)=>{
    const result=room.result(req.actor,req.params.id);
    if(!result)return res.status(404).json({code:'not-recorded',serverTime:Date.now(),run:room.run,retryWindowMs:LIMITS.retryMs,
      message:'Todavía no hay un resultado confirmado. No repetí la acción.'});res.json(result);
  });
  app.post(route('api/projection'),(req,res)=>projectionHealthy?res.json(room.project(req.actor,req.body)):res.status(503).json({message:'La vista del taller necesita recuperarse antes de agregar cambios.'}));
  app.post(route('api/interactions'),asyncRoute(async(req,res)=>{
    if(!native)return res.status(503).json({message:'La conversación todavía no está conectada a este mundo.'});
    res.json(await native.submit(req.actor,req.body));
  }));
  app.get(route('api/interactions/:id'),asyncRoute(async(req,res)=>{
    if(!native)return res.status(503).json({message:'La conversación todavía no está conectada a este mundo.'});
    res.json(await native.status(req.actor,req.params.id));
  }));
  app.post(route('api/interactions/:id/retry'),asyncRoute(async(req,res)=>{
    if(!native)return res.status(503).json({message:'La conversación todavía no está conectada a este mundo.'});
    res.json(await native.retry(req.actor,req.params.id));
  }));
  app.use((error,_req,res,_next)=>{
    if(room.commitUncertain)for(const socket of sockets.keys())socket.close(1011);
    if(error.code==='not-found'||error.code==='not-retained')return res.status(404).json({code:error.code==='not-retained'?'not-retained':'not-found',retained:error.retained??false,knownNotSubmitted:error.knownNotSubmitted===true,retryable:error.retryable===true,
      message:'No encontré un envío guardado para este turno. No lo reenvié.'});
    if(error.knownNotSubmitted)return res.status(error.code==='capacity'?409:400).json({code:error.code,knownNotSubmitted:true,
      retained:error.retained??false,retryable:error.retryable===true,
      message:error.code==='capacity'?'El taller necesita cerrar turnos anteriores antes de iniciar otro.':'Este mensaje no se envió. Revisalo antes de intentar de nuevo.'});
    const known=error instanceof RoomError;
    res.status(known?409:error.type==='entity.too.large'?413:503).json({message:known?'El mundo cambió o esa acción no está disponible. Revisá el lugar antes de intentarlo de nuevo.':'No pude completar esa acción. Conservé los cambios que ya estaban confirmados.'});
  });
  return {app,room,native,close(){if(authorizationTimer)clearInterval(authorizationTimer);for(const socket of sockets.keys())socket.close(1001);for(const port of installedWorldPorts)port.close();network.dispose();document.dispose();}};
}

export function validateWorldPorts({worldSocket=null,worldSocketBeingRef=null,worldPorts=[],nativeRoutes=null}={}){
  if(!Array.isArray(worldPorts)||worldPorts.length>8)throw Error('Select bounded native world return ports');
  const selected=[...(worldSocket?[{socket:worldSocket,beingRef:worldSocketBeingRef}]:[]),...worldPorts];
  if(selected.length>8)throw Error('Select at most eight native world return ports');
  const paths=new Set();
  for(const port of selected){
    if(!port||Object.keys(port).some(key=>!['socket','beingRef'].includes(key))
      ||typeof port.socket!=='string'||!port.socket.startsWith('/')||port.socket.includes('\0')||paths.has(port.socket)
      ||(port.beingRef!==null&&!/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(port.beingRef)))throw Error('Select unique fixed native world return ports');
    if((worldPorts.length||nativeRoutes?.length)&&!port.beingRef)throw Error('Every multi-pair return port needs its receiving being identity');
    if(nativeRoutes?.length&&!nativeRoutes.some(route=>route.beingRef===port.beingRef))throw Error('World return port has no selected native lane');
    paths.add(port.socket);
  }
  return selected;
}

export async function main(){
  const production=process.env.NODE_ENV==='production';
  const stateDir=process.env.STATE_DIR||null;
  const receiving=production?JSON.parse(readFileSync(join(stateDir||'','receiving.json'),'utf8')):null;
  if(production&&receiving.schema!=='holodeck.receiving/v1')throw Error('Select the existing Holodeck receiving configuration');
  const resolver=production?homeIdentityResolver({publicOrigin:receiving.origin,authHost:receiving.authHost,identityEndpoint:receiving.authEndpoint,authorizeEndpoint:receiving.authorizeEndpoint}):null;
  let nativeFactory=null;
  if(receiving?.nativeRoutes!==undefined&&(!Array.isArray(receiving.nativeRoutes)||receiving.nativeRoutes.length>8))
    throw Error('Select at most eight registered native routes');
  if(receiving?.nativeSocket||receiving?.nativeRoutes?.length){
    const integration=await import('./native-conversation.mjs');
    nativeFactory=options=>integration.nativeFactory({...options,receiving});
  }
  validateWorldPorts({...receiving});
  const nativeRoomAuthority=receiving&&Object.hasOwn(receiving,'authoritySocket')?createNativeRoomAuthority(receiving.authoritySocket):null;
  const runtime=await createHolodeck({production,stateDir,basePath:receiving?.basePath||'/',publicOrigin:receiving?.origin,identityResolver:resolver,nativeFactory,worldSocket:receiving?.worldSocket,worldSocketBeingRef:receiving?.worldSocketBeingRef,worldPorts:receiving?.worldPorts,contentVisits:receiving?.contentVisits,nativeRoomAuthority});
  const port=Number(process.env.PORT||18940);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Select a valid loopback port');
  if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('Use the existing loopback gateway');
  const listener=runtime.app.listen(port,'127.0.0.1',()=>console.log('Holodeck receiver listening on loopback port '+port));
  const close=()=>{listener.close();runtime.close();};
  process.once('SIGINT',()=>{close();process.exit(0);});process.once('SIGTERM',()=>{close();process.exit(0);});
  return {runtime,listener};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
