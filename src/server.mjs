import {interiorArt} from './interior-art.mjs';
import {selectAtelier} from './compaii-atelier.mjs';
import {RoomExhibits,EXHIBIT_SAVE_BYTES} from './room-exhibits.mjs';
import {InteriorSpaces, OUTSIDE, SPACE_SAVE_BYTES, interiorDocument} from './interior-spaces.mjs';
import {Houses, HOUSE_SAVE_BYTES} from './houses.mjs';
import {readActivity,ActivityError} from './activity.mjs';
import {nodeVisits} from './content-nodes.mjs';
import express from 'express';
import { Networked3dWebExperienceServer } from '@mml-io/3d-web-experience-server';
import { NetworkedDOM } from '@mml-io/networked-dom-server';
import { handleExperienceWebsocketSubprotocol } from '@mml-io/3d-web-experience-protocol';
import enableWs from 'express-ws';
import { existsSync, readFileSync } from 'node:fs';
import { packedClientHandler } from './packed-client.mjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { Room, RoomError, LIMITS } from './room.mjs';
import { RoomStore } from './room-store.mjs';
import { homeIdentityResolver } from './home-identity.mjs';
import { worldDocument } from './world.mjs';
import { createWorldPort } from './world-port.mjs';
import {sameVisitPin,validateContentNodes,validateContentVisits,visitsForActor} from './content-visits.mjs';
import {allowedGalleryVisits,gallerySlots} from './gallery-catalog.mjs';
import {createGalleryAuthorization} from './gallery-authorization.mjs';
import {createNativeRoomAuthority} from './native-authority.mjs';
import {WorldDocument} from './world-document.mjs';
import {SessionBindings,SESSION_MS,sessionKey} from './session-bindings.mjs';

const cookieToken=req=>req.headers.cookie?.match(/(?:^|; )holodeck_session=([a-f0-9]{40})(?:;|$)/)?.[1];
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export async function createHolodeck({basePath='/',production=false,identityResolver=null,publicOrigin=null,stateDir=null,nativeFactory=null,worldSocket=null,worldSocketBeingRef=null,worldPorts=[],contentVisits=[],contentNodes,nativeRoomAuthority=null,conversationOrigins=[],ownNative=false,interiorSpaces=[],interiorGuestAccess,interiorArtwork=interiorArt,houseVisual,gardenVisual,gallerySelection,galleryAuthorization,artProfile}={}){
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(basePath))throw Error('Select a bounded absolute base path');
  if(production&&(!identityResolver||!publicOrigin||!stateDir))throw Error('Shared identity, audience and state are required in production');
  if(typeof interiorArtwork!=='function'||production&&(interiorArtwork!==interiorArt||houseVisual||gardenVisual))
    throw Error('Select checked-in art for production');
  if(galleryAuthorization!==undefined&&(production||typeof galleryAuthorization!=='function'))
    throw Error('Use the configured Nexus authority for gallery visits');
  const selectedContentNodes=validateContentNodes(contentNodes);
  const selectedContentVisits=validateContentVisits(contentVisits,selectedContentNodes);
  if(!Array.isArray(conversationOrigins)||conversationOrigins.length>8||new Set(conversationOrigins).size!==conversationOrigins.length)
    throw Error('Select bounded Conversation origins');
  for(const value of conversationOrigins){const selected=new URL(value);if(selected.protocol!=='https:'||selected.origin!==value)throw Error('Select exact HTTPS Conversation origins');}
  if(nativeRoomAuthority!==null&&typeof nativeRoomAuthority!=='function')throw Error('Select the installed native service authority reader');
  if(typeof ownNative!=='boolean'||ownNative&&!nativeRoomAuthority)throw Error('Own native access requires selected central authority and receiving socket policy');
  const route=path=>basePath+path;
  const app=express();
  // Express4 does not forward a rejected async handler. The upstream MML index
  // issues the session in such a handler; include its persistence errors in the
  // same bounded failure path as our own API routes.
  const registerGet=app.get.bind(app);
  app.get=(path,...handlers)=>registerGet(path,...handlers.map(handler=>
    handler.constructor?.name==='AsyncFunction'?asyncRoute(handler):handler));
  const activeNetworkPath=route('active/network');
  const isWorldSocket = path => path===route('world') ||
    (path.startsWith(route('spaces/')) && path.endsWith('/world'));
  enableWs(app,undefined,{wsOptions:{handleProtocols:(protocols,req)=>isWorldSocket(req.url?.split('?')[0] ?? '')
    ?NetworkedDOM.handleWebsocketSubprotocol(protocols):handleExperienceWebsocketSubprotocol(protocols)}});
  const sessions=new Map();const sockets=new Map();let nextId=0,authorizationTimer=null,pendingSockets=0;
  const sessionBindings=production?new SessionBindings(stateDir,LIMITS.sessions):null;
  for(const binding of sessionBindings?.load()||[])sessions.set(binding.key,{id:++nextId,
    actor:{id:binding.actorRef,kind:'human'},created:binding.created,times:[],connection:null,sourceCookie:undefined});
  const sessionFor=token=>sessions.get(sessionKey(token));
  const localBoot=randomBytes(4).toString('hex');
  const store=stateDir?new RoomStore(stateDir):null;
  const houseStore=stateDir ? new RoomStore(join(stateDir,'houses'),{maxBytes:HOUSE_SAVE_BYTES}) : null;
  const houses=new Houses({state:houseStore?.load(),persist:houseStore ? state => houseStore.save(state) : null});
  const spaceStore=stateDir ? new RoomStore(join(stateDir,'spaces'),{maxBytes:SPACE_SAVE_BYTES}) : null;
  const spaces=new InteriorSpaces({definitions:interiorSpaces,houses,state:spaceStore?.load(),
    persist:spaceStore ? state=>spaceStore.save(state) : null,guestAccess:interiorGuestAccess});
  const atelier=selectAtelier(artProfile,spaces.rooms,houses.directory());
  const artForRoom=atelier?.interiorArtwork??interiorArtwork;
  const gallery=gallerySlots(gallerySelection,spaces.rooms);
  const authorizeGallery=gallery&&(galleryAuthorization??createGalleryAuthorization(publicOrigin));
  const exhibitStore=stateDir?new RoomStore(join(stateDir,'exhibits'),{maxBytes:EXHIBIT_SAVE_BYTES}):null;
  const exhibits=new RoomExhibits({state:exhibitStore?.load(),spaces,houses,
    persist:exhibitStore?state=>exhibitStore.save(state):null});
  const room=new Room({houses,state:store?.load(),persist:store?s=>store.save(s):null,contentNodes:selectedContentNodes,
    presence:()=>[...sessions.values()].filter(s=>s.connection!==null&&Date.now()-s.created<SESSION_MS&&spaces.current(s.actor)===OUTSIDE)
      .map(s=>({actor:s.actor.id,kind:'human',name:s.actor.name||'Explorador',scope:'authenticated-room-presence',position:null}))});
  const document=new WorldDocument('http://localhost'+route('world'));
  let projectionHealthy=true,projectionQueued=false,projectionRunning=false;
  const project=async()=>{
    projectionQueued=true;if(projectionRunning)return;projectionRunning=true;
    try{while(projectionQueued){projectionQueued=false;
      await Promise.all([...sockets].map(([socket,record])=>checkSocket(socket,record)));
      if(room.commitUncertain){projectionHealthy=false;return;}
      await document.load(worldDocument(room,{basePath,houseVisual:atelier?.houseVisual??houseVisual,
        gardenVisual:atelier?.gardenVisual??gardenVisual,sceneryAsset:atelier?.sceneryAsset,
        commonsVisual:atelier?.commonsVisual}));projectionHealthy=true;
    }}catch{projectionHealthy=false;}finally{projectionRunning=false;}
  };
  await project();if(!projectionHealthy){document.dispose();throw Error('The initial world representation could not load');}room.on('change',project);
  const native=nativeFactory?await nativeFactory({room,stateDir,allowInteriorSource}):null;
  const installedWorldPorts=[];
  async function currentActor(req,session){
    if(!session||Date.now()-session.created>=SESSION_MS)return null;
    if(!identityResolver)return session.actor;
    const actor=await identityResolver(req);
    if(!actor||actor.id!==session.actor.id)return null;
    session.actor=actor;session.sourceCookie=req.headers.cookie;return actor;
  }
  const inScope=(actor,scope)=>actor?.rights?.includes('observe')&&
    (actor.expires===undefined||Date.now()<actor.expires*1000)&&!room.commitUncertain&&!spaces.fenced&&spaces.current(actor)===scope;
  function closeOutOfScope(actor){
    for(const [socket,{session,scope}] of sockets)
      if(session.actor.id===actor.id&&!inScope(actor,scope))socket.close(1008);
  }
  async function checkSocket(socket,record){
    if(record.checking)return record.checking;
    record.checking=(async()=>{
      try{
        const actor=await currentActor({method:'GET',headers:{cookie:record.session.sourceCookie}},record.session);
        if(!inScope(actor,record.scope)||record.projectionAllowed?.()===false)socket.close(1008);
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
      const scope=path===activeNetworkPath?spaces.current(actor):req.params.space??OUTSIDE;
      if(!inScope(actor,scope)||socket.readyState!==1){socket.close(1008);return;}
      const record={session,scope,checking:null};sockets.set(socket,record);
      // Upstream transports broadcast synchronously. Enforce the current room
      // before any client payload enters or leaves those transports.
      const stillAllowed=()=>sessionFor(cookieToken(req))===session&&Date.now()-session.created<SESSION_MS&&inScope(session.actor,scope)&&record.projectionAllowed?.()!==false;
      const send=socket.send.bind(socket),emit=socket.emit.bind(socket);
      socket.send=(...args)=>{
        if(stillAllowed())return send(...args);
        socket.close(1008);
      };
      socket.emit=(event,...args)=>{
        if(event!=='message'||stillAllowed())return emit(event,...args);
        socket.close(1008);return false;
      };
      socket.once('close',()=>{sockets.delete(socket);if(!sockets.size&&authorizationTimer){clearInterval(authorizationTimer);authorizationTimer=null;}});
      if(!authorizationTimer){authorizationTimer=setInterval(()=>{
        for(const [current,state]of sockets)checkSocket(current,state);
      },2000);authorizationTimer.unref();}
      handler(socket,req);
    }).catch(()=>socket.close(1008)).finally(()=>pendingSockets--);
  });
  const cellTransports=new Map();
  function renderInterior(room,passages,exhibit){
    const art=artForRoom(room,passages),src=art?route('api/space/art/'+art.revision):null;
    return interiorDocument(room,passages,exhibit,art&&{...art,src});
  }
  function interiorScopeKey(actor,selected){
    return JSON.stringify([spaces.passages(actor,selected).map(link=>link.slot),exhibits.forRoom(selected.id)?.revision??0]);
  }
  function visitScene(actor,id,cachedRevision){
    const selected=spaces.rooms.get(id);
    if(!selected)return null;
    const markup=renderInterior(selected,spaces.passages(actor,selected),exhibits.forRoom(id));
    const revision=createHash('sha256').update(actor.id+'\n'+markup).digest('hex');
    return {id,actor:actor.id,revision,...(cachedRevision===revision?{}:{markup})};
  }
  function liveSpace(actor,cachedRevision){
    const space=describeSpace(actor);
    return {...space,live:1,actorRef:actor.id,sharedConversation:!!(native?.contexts&&native?.conversationSurface),scene:visitScene(actor,space.id,cachedRevision)};
  }
  function describeSpace(actor){
    if(spaces.fenced)throw new RoomError('space-uncertain','Room placement needs recovery');
    const view=spaces.view(actor),exhibit=exhibits.scoped(actor,view.id),
      art=artForRoom(spaces.rooms.get(view.id),view.exits ?? []);
    const space={...view,...(view.id===OUTSIDE?{}:{objects:roomObjects(view)}),
      ...(art?.lightRig?{indoorLighting:true}:{}),
      ...(exhibit?{exhibitRevision:exhibit.revision}:{})};
    const cell=cellTransports.get(space.id);
    if(!cell)return space;
    const participants=[...cell.connections.values()]
      .filter(({actor:peer})=>inScope(peer,space.id))
      .map(({actor:peer})=>({actor:peer.id,kind:peer.kind,name:peer.name||'Explorador'}));
    return {...space,participants};
  }
  function roomObjects(view){
    const art=artForRoom(spaces.rooms.get(view.id),view.exits ?? []);
    const objects=art?.replacesShell?[]:view.objects;
    const stations=[art?.station,...(art?.controls??[])].filter(Boolean);
    return [...objects,...stations.map(station=>({id:station.id,kind:'workstation',title:station.title,
      position:station.position,revision:station.revision}))];
  }
  function conversationPlace(actor,id){
    const selected=spaces.rooms.get(id);
    if(!actor.rights?.includes('observe')||!selected||spaces.fenced||room.commitUncertain||!spaces.allows(actor,id))return null;
    const view=spaces.view(actor,id);
    const exhibit=exhibits.scoped(actor,id);
    return {id,title:selected.title,level:selected.level,house:selected.house,
      objects:view.id===id?roomObjects(view):[],
      ...(exhibit?{exhibitRevision:exhibit.revision}:{}),
      participants:[...(cellTransports.get(id)?.connections.values()??[])]
        .filter(({actor:peer})=>inScope(peer,id))
        .map(({actor:peer})=>({actor:peer.id,kind:peer.kind,name:peer.name||'Explorador'}))};
  }
  async function allowInteriorSource(actor,beingRef,id){
    const recipient={id:beingRef,ref:beingRef,kind:'daimon'};
    if(!nativeRoomAuthority||spaces.fenced||room.commitUncertain||
      !spaces.allows(actor,id)||!spaces.allows(recipient,id))return false;
    const rights=await nativeRoomAuthority({actor:recipient});
    return rights.includes('observe')&&!spaces.fenced&&!room.commitUncertain&&
      spaces.allows(actor,id)&&spaces.allows(recipient,id);
  }
  function captureConversationPlace(actor,request){
    const id=spaces.current(actor);
    if(spaces.fenced||room.commitUncertain||id!==(request.view?.spaceId??OUTSIDE))
      throw new RoomError('scope-changed','Tu lugar cambió. Volvé a intentar con el borrador que conservaste.');
    if(id===OUTSIDE)return null;
    const place=conversationPlace(actor,id);
    if(!place)throw new RoomError('forbidden','Tu acceso a esta sala cambió.');
    return {id:randomUUID(),run:room.run,edition:room.edition,sequence:room.sequence,capturedAt:Date.now(),place};
  }
  function moveSpace(actor,request){
    if(room.commitUncertain||!actor.rights?.includes('observe'))return null;
    const moved=spaces.move(actor,request);
    if(!moved)return null;
    closeOutOfScope(actor);
    return describeSpace(actor);
  }
  function putExhibit(actor,input){
    if(room.commitUncertain||spaces.fenced)return null;
    return exhibits.put(actor,input,room.nodes);
  }
  const selectedWorldPorts=validateWorldPorts({worldSocket,worldSocketBeingRef,worldPorts});
  if(selectedWorldPorts.length&&!native)throw Error('Native authority is required for world return ports');
  for(const selected of selectedWorldPorts)installedWorldPorts.push(await createWorldPort({socketPath:selected.socket,expectedBeingRef:selected.beingRef,room,native,describeSpace,moveSpace,conversationPlace,
    putExhibit,exhibitResult:(actor,id)=>exhibits.result(actor,id),resolveOwnNativeRights:ownNative&&nativeRoomAuthority?async verified=>{const rights=await nativeRoomAuthority(verified);return projectionHealthy?rights:rights.filter(right=>right==='observe');}:null,resolveRights:async verified=>{
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
      if(!record||record.scope!==OUTSIDE||socket.readyState!==1||record.session.actor.id!==s.actor.id)return new Error('Room identity does not match this connection');
      const actor=await currentActor({method:'GET',headers:{cookie:record.session.sourceCookie}},s);
      if(!inScope(actor,OUTSIDE))return new Error('Room access expired');
      if(s.connection!==null||sessionFor(token)!==s||socket.readyState!==1||!sockets.has(socket))return new Error('Room connection changed');
      s.connection=connection;
      room.atomic(()=>room.event(actor,'participant.joined',{name:actor.name||'Explorador'}));
      return {userId:actor.id,username:actor.name||`Explorador ${s.id}`,characterDescription:{meshFileUrl:route('assets/avatar-1-bodyA-skin01.glb')},colors:null};
    },
    onClientDisconnect(connection){for(const s of sessions.values())if(s.connection===connection){s.connection=null;if(!room.commitUncertain)room.atomic(()=>room.event(s.actor,'participant.left',{}));}},
    onClientUserIdentityUpdate(){return false;}
  };
  const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8').replace('<head>','<head><base href="'+basePath+'">');
  function cellFor(id){
    const existing=cellTransports.get(id);
    if(existing)return existing;
    const address=route('spaces/'+id+'/');
    const connections=new Map();
    const scopedNetwork=new Networked3dWebExperienceServer({networkPath:address+'network',userAuthenticator:{
      getClientIdForSessionToken:auth.getClientIdForSessionToken,
      async onClientConnect(connection,token,_identity,socket){
        const record=sockets.get(socket),session=sessionFor(token);
        if(!record||record.scope!==id||!session||record.session.actor.id!==session.actor.id)
          return new Error('Room identity does not match this connection');
        const actor=await currentActor({method:'GET',headers:{cookie:record.session.sourceCookie}},session);
        if(!inScope(actor,id)||socket.readyState!==1||sockets.get(socket)!==record||sessionFor(token)!==session||
            [...connections.values()].some(peer=>peer.actor.id===actor.id))
          return new Error('Room connection changed');
        connections.set(connection,{actor});
        return {userId:actor.id,username:actor.name||'Explorador',
          characterDescription:{meshFileUrl:route('assets/avatar-1-bodyA-skin01.glb')},colors:null};
      },
      onClientDisconnect(connection){connections.delete(connection);},
      onClientUserIdentityUpdate(){return false;}
    },worldConfig:{mmlDocuments:{interior:{url:'ws://'+address+'world'}},enableChat:false,enableTweakPane:false,
      environmentConfiguration:{groundPlane:false,sun:{intensity:.9},
        ambientLight:{intensity:artForRoom(spaces.rooms.get(id))?.ambient ?? 1.5}},
      avatarConfiguration:{allowCustomAvatars:false},allowCustomDisplayName:false,allowOrbitalCamera:true,
      spawnConfiguration:{spawnPosition:{x:0,y:1,z:4},spawnYRotation:180},hud:{respawnButton:false}}});
    const cell={connections,network:scopedNetwork};
    cellTransports.set(id,cell);
    return cell;
  }
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
  if(conversationOrigins.length)app.use((_req,res,next)=>{
    const selected='(self '+conversationOrigins.map(value=>'"'+value+'"').join(' ')+')';
    res.set('Permissions-Policy','microphone='+selected+', autoplay='+selected);next();
  });
  app.use(express.json({limit:'48kb',strict:true}));
  const packedClient=new URL('../runtime/client.js.br',import.meta.url);
  if(existsSync(packedClient))
    app.get(route('client/client.js'),packedClientHandler(readFileSync(packedClient)));
  network.registerExpressRoutes(app);
  if(basePath!=='/')app.get(basePath.slice(0,-1),(_req,res)=>res.redirect(308,basePath));
  app.get(route('health'),(_req,res)=>res.status(projectionHealthy&&!room.commitUncertain&&!spaces.fenced?200:503).json({ok:projectionHealthy&&!room.commitUncertain&&!spaces.fenced}));
  app.ws(activeNetworkPath,(ws)=>{
    const record=sockets.get(ws);
    if(!record){ws.close(1008);return;}
    if(record.scope===OUTSIDE){
      network.userNetworkingServer.connectClient(ws);
      return;
    }
    const selected=spaces.rooms.get(record.scope);
    const scopeKey=interiorScopeKey(record.session.actor,selected);
    record.projectionAllowed=()=>interiorScopeKey(record.session.actor,selected)===scopeKey;
    cellFor(record.scope).network.userNetworkingServer.connectClient(ws);
  });
  app.ws(route('world'),(ws,req)=>{
    currentActor(req,sessionFor(cookieToken(req))).then(actor=>{
      if(!inScope(actor,OUTSIDE)||ws.readyState!==1){ws.close(1008);return;}
      document.addWebSocket(ws);ws.on('close',()=>{if(document.hasWebSocket(ws))document.removeWebSocket(ws);});
    }).catch(()=>ws.close(1008));
  });
  for(const channel of ['network','world'])app.ws(route('spaces/:space/'+channel),(ws,req)=>{
    const record=sockets.get(ws),id=req.params.space;
    if(!record||id===OUTSIDE||!inScope(record.session.actor,id)){ws.close(1008);return;}
    if(channel==='network'){
      cellFor(id).network.userNetworkingServer.connectClient(ws);
      return;
    }
    const selectedRoom=spaces.rooms.get(id);
    const passages=()=>spaces.passages(record.session.actor,selectedRoom);
    const initial=passages();
    const currentExhibit=()=>exhibits.scoped(record.session.actor,id);
    const initialExhibit=currentExhibit();
    const signature=(links,exhibit)=>links.map(link=>link.slot).join(',')+':'+(exhibit?.revision??0);
    const scope=signature(initial,initialExhibit);
    record.projectionAllowed=()=>signature(passages(),currentExhibit())===scope;
    // A connection owns exactly one filtered document. Closing it releases
    // all DOM work while the room's shared avatar stream stays independent.
    const scopedDocument=new WorldDocument('http://localhost'+route('spaces/'+id+'/world'));
    ws.once('close',()=>scopedDocument.dispose());
    scopedDocument.load(renderInterior(selectedRoom,initial,initialExhibit)).then(()=>{
      if(ws.readyState!==1||!inScope(record.session.actor,id)||!record.projectionAllowed()){
        ws.close(1008);return;
      }
      scopedDocument.addWebSocket(ws);
    }).catch(()=>ws.close(1011));
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
    const spaceRoute=['/space','/space/content-visits','/space/scene'].includes(req.path)||req.path.startsWith('/space/art/')||
      req.path==='/conversation-surface'||/^\/conversation-contexts(?:\/[a-f0-9-]{36}(?:\/(?:release|retry|discard))?)?$/.test(req.path);
    if(spaceRoute&&!actor.rights?.includes('observe'))
      return res.status(403).json({message:'Tu acceso a este lugar cambió.'});
    if(!spaceRoute&&spaces.current(actor)!==OUTSIDE)
      return res.status(409).json({message:'Volvé al exterior para usar esta acción.'});
    req.actor=actor;req.holodeckSession=session;next();
  }));
  app.get(route('api/space/art/:revision'),(req,res)=>{
    const id=spaces.current(req.actor);
    const selected=spaces.rooms.get(id);
    if(!selected||!inScope(req.actor,id))return res.sendStatus(404);
    const art=artForRoom(selected,spaces.passages(req.actor,selected));
    if(!art||req.params.revision!==art.revision)return res.sendStatus(404);
    res.type('model/gltf-binary').send(art.bytes);
  });
  app.get(route('api/space/content-visits'),asyncRoute(async(req,res)=>{
    if(spaces.fenced||room.commitUncertain||exhibits.fenced)return res.status(503).json({message:'No pude recuperar la exposición.'});
    const active=spaces.current(req.actor);
    if(active===OUTSIDE)return res.status(404).json({message:'Entrá a la sala para visitar su contenido.'});
    if(active!==gallery?.room)return res.json({visits:exhibits.visit(req.actor,active)});
    const currentEntries=()=>{
      if(Date.now()-req.holodeckSession.created>=SESSION_MS||
         !inScope(req.holodeckSession.actor,active)||exhibits.fenced)return [];
      const placed=exhibits.visit(req.actor,active);
      return [...placed,...gallery.slots.filter(slot=>!placed.some(entry=>sameVisitPin(entry.pin,slot.pin)))];
    };
    const visits=await allowedGalleryVisits({entries:currentEntries(),currentEntries,
      authorize:pin=>authorizeGallery(req.headers.cookie,pin)});
    res.json({visits:visits.map(entry=>({...entry,galleryDisplay:
      entry.pin.kind==='artifact_review'&&entry.pin.adapter==='interactive_3d'}))});
  }));
  app.get(route('api/space'),(req,res)=>{
    if(spaces.fenced||room.commitUncertain)return res.status(503).json({message:'No pude confirmar tu ubicación.'});
    res.json(req.query.live==='1'?liveSpace(req.actor):describeSpace(req.actor));
  });
  app.get(route('api/space/scene'),(req,res)=>{
    const {room:destination}=req.query;
    const from=spaces.current(req.actor);
    if(room.commitUncertain||typeof destination!=='string'||destination===OUTSIDE||
       !spaces.canMove(req.actor,{from,to:destination}))return res.sendStatus(404);
    res.json(visitScene(req.actor,destination));
  });
  app.post(route('api/space'),(req,res)=>{
    const input=req.body;
    const live=input?.live===1;
    const {live:_live,cachedRevision,...move}=live?input:{};
    if(live&&cachedRevision!==undefined&&
       (typeof cachedRevision!=='string'||!/^[a-f0-9]{64}$/.test(cachedRevision)))return res.sendStatus(400);
    const moved=moveSpace(req.actor,live?move:input);
    if(!moved)return res.status(409).json({message:'No podés entrar por acá. Revisá las salidas de este lugar.'});
    res.json(live?liveSpace(req.actor,cachedRevision):moved);
  });
  app.get(route('api/state'),asyncRoute(async(req,res)=>{
    if(room.commitUncertain)return res.status(503).json({message:'El taller necesita recuperar su último cambio antes de continuar.'});
    res.json({run:room.run,edition:room.edition,sequence:room.sequence,actorRef:req.actor.id,entities:room.entities,focus:room.focusState(),nodes:room.nodeState(),
      native:native?{...await native.availability(req.actor),sharedConversation:!!native.contexts}:{available:false}});
  }));
  app.get(route('api/places'),(req,res)=>{
    if(room.commitUncertain)return res.status(503).json({message:'El taller necesita recuperar su último cambio.'});
    res.json({world:'island-workshop',houses:room.houses.directory()});
  });
  app.get(route('api/places/:id'),(req,res)=>{
    if(room.commitUncertain)return res.status(503).json({message:'El taller necesita recuperar su último cambio.'});
    const house=room.houses.directory().find(place=>place.id===req.params.id);
    if(!house)return res.status(404).json({message:'No encontré esa casa.'});
    res.json({world:'island-workshop',house});
  });
  app.get(route('api/activity'),(req,res)=>{
    try{res.json(readActivity(room,req.actor,req.query));}
    catch(error){if(!(error instanceof ActivityError))throw error;
      res.status(error.status).json({code:error.code,message:error.message,...(error.code==='stale-run'?{run:room.run}:{})});}
  });
  app.get(route('api/content-visits'),(req,res)=>res.json({nodes:selectedContentNodes,visits:[...visitsForActor(selectedContentVisits,req.actor),...nodeVisits(room.nodes,req.actor)]}));
  app.get(route('api/conversation-surface'),asyncRoute(async(req,res)=>{
    if(!native?.contexts||!native?.conversationSurface)return res.status(503).json({message:'La conversación compartida todavía no está disponible en este mundo.'});
    const value=await native.conversationSurface(req.actor);
    if(value?.schema!=='holodeck.conversation-surface/v1'||value.actorRef!==req.actor.ref
      ||!/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(value.beingRef)||!/^home:[a-f0-9]{32}$/.test(value.homeRef)
      ||!/^[a-f0-9]{64}$/.test(value.binding)||typeof value.url!=='string')throw Error('Invalid selected Conversation surface');
    const selected=new URL(value.url);
    if(selected.protocol!=='https:'||selected.username||selected.password||selected.hash||selected.search)throw Error('Select the registered HTTPS Conversation entry');
    if(selected.origin!==publicOrigin&&!conversationOrigins.includes(selected.origin))throw Error('The paired Conversation origin has no selected microphone delegation');
    res.json(value);
  }));
  const requireContext=(req,res)=>{
    if(native?.contexts)return true;
    res.status(503).json({scope:'machine-context',work_admitted:false,message:'Todavía no pude conectar el contexto de este lugar con la conversación.'});return false;
  };
  app.post(route('api/conversation-contexts'),asyncRoute(async(req,res)=>{
    if(requireContext(req,res))res.json(await native.contexts.prepare(req.actor,req.body,captureConversationPlace));
  }));
  app.get(route('api/conversation-contexts/:id'),asyncRoute(async(req,res)=>{
    if(requireContext(req,res))res.json(await native.contexts.recover(req.actor,req.params.id,req.query.binding));
  }));
  app.post(route('api/conversation-contexts/:id/retry'),asyncRoute(async(req,res)=>{
    if(requireContext(req,res))res.json(await native.contexts.retry(req.actor,req.params.id,req.body?.binding));
  }));
  app.post(route('api/conversation-contexts/:id/release'),asyncRoute(async(req,res)=>{
    if(requireContext(req,res))res.json(await native.contexts.release(req.actor,req.params.id));
  }));
  app.post(route('api/conversation-contexts/:id/discard'),asyncRoute(async(req,res)=>{
    if(requireContext(req,res))res.json(await native.contexts.discard(req.actor,req.params.id,req.body?.binding,req.body?.reason));
  }));
  app.post(route('api/observe'),(req,res)=>res.json(room.observe(req.actor,req.body)));
  app.post(route('api/commands'),(req,res)=>projectionHealthy?res.json(room.command(req.actor,req.body)):res.status(503).json({message:'La vista del taller necesita recuperarse antes de agregar cambios.'}));
  app.get(route('api/commands/:id'),(req,res)=>{
    const result=room.result(req.actor,req.params.id);
    if(!result)return res.status(404).json({code:'not-recorded',serverTime:Date.now(),run:room.run,retryWindowMs:LIMITS.retryMs,
      message:'Todavía no hay un resultado confirmado. No repetí la acción.'});res.json(result);
  });
  app.post(route('api/projection'),(req,res)=>projectionHealthy?res.json(room.project(req.actor,req.body)):res.status(503).json({message:'La vista del taller necesita recuperarse antes de agregar cambios.'}));
  app.post(route('api/interactions'),asyncRoute(async(req,res)=>{
    if(native?.contexts&&!native.hasRetainedIntent?.(req.body?.id))return res.status(409).json({scope:'canonical-conversation',message:'Usá la conversación compartida de este mundo. El envío anterior se conserva.'});
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
    if(room.commitUncertain||spaces.fenced)for(const socket of sockets.keys())socket.close(1011);
    if(error.contextOnly)return res.status(error.code==='not-found'?404:error.code==='input'?400:409).json({scope:'machine-context',work_admitted:false,
      message:'No pude confirmar el contexto de este lugar. Tu mensaje y el estado del mundo se conservan.'});
    if(error.code==='not-found'||error.code==='not-retained')return res.status(404).json({code:error.code==='not-retained'?'not-retained':'not-found',retained:error.retained??false,knownNotSubmitted:error.knownNotSubmitted===true,retryable:error.retryable===true,
      message:'No encontré un envío guardado para este turno. No lo reenvié.'});
    if(error.knownNotSubmitted)return res.status(error.code==='capacity'?409:400).json({code:error.code,knownNotSubmitted:true,
      retained:error.retained??false,retryable:error.retryable===true,
      message:error.code==='capacity'?'El taller necesita cerrar turnos anteriores antes de iniciar otro.':'Este mensaje no se envió. Revisalo antes de intentar de nuevo.'});
    const known=error instanceof RoomError;
    res.status(known?409:error.type==='entity.too.large'?413:503).json({message:known?'El mundo cambió o esa acción no está disponible. Revisá el lugar antes de intentarlo de nuevo.':'No pude completar esa acción. Conservé los cambios que ya estaban confirmados.'});
  });
  return {app,room,native,spaces,close(){if(authorizationTimer)clearInterval(authorizationTimer);for(const socket of sockets.keys())socket.close(1001);for(const port of installedWorldPorts)port.close();network.dispose();document.dispose();for(const cell of cellTransports.values()){cell.network.dispose();}}};
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
  const runtime=await createHolodeck({production,stateDir,basePath:receiving?.basePath||'/',publicOrigin:receiving?.origin,identityResolver:resolver,nativeFactory,worldSocket:receiving?.worldSocket,worldSocketBeingRef:receiving?.worldSocketBeingRef,worldPorts:receiving?.worldPorts,contentVisits:receiving?.contentVisits,contentNodes:receiving?.contentNodes,nativeRoomAuthority,conversationOrigins:receiving?.conversationOrigins||[],ownNative:receiving?.ownNative??false,interiorSpaces:receiving?.interiorSpaces??[],gallerySelection:receiving?.gallery,artProfile:receiving?.artProfile});
  const port=Number(process.env.PORT||18940);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Select a valid loopback port');
  if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('Use the existing loopback gateway');
  const listener=runtime.app.listen(port,'127.0.0.1',()=>console.log('Holodeck receiver listening on loopback port '+port));
  const close=()=>{listener.close();runtime.close();};
  process.once('SIGINT',()=>{close();process.exit(0);});process.once('SIGTERM',()=>{close();process.exit(0);});
  return {runtime,listener};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
