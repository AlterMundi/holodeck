import {SAND3D_TRAIL_REVISIONS} from './sand3d-trail-assets.mjs';
import {TOROIDAL_SPAWN, TOROIDAL_TERRAIN, toroidalParcelPoint} from './toroidal-terrain.mjs';
import {indoorGardenTemplates} from './indoor-garden-recipe.mjs';
import {COMPAII_HOUSE,interiorArt} from './interior-art.mjs';
import {ATELIER_EXPANSION_WRITES,ATELIER_PROFILE,ATELIER_ROOMS,atelierLabReturn,matchesAtelierLayout,packedExteriorArt,selectAtelier} from './compaii-atelier.mjs';
import {RoomExhibits,EXHIBIT_SAVE_BYTES} from './room-exhibits.mjs';
import {ATELIER_FOYER,CHARACTER_STUDIO,characterWorktable,houseReviewRooms} from './house-review-rooms.mjs';
import {createCharacterPoseReview,resolveReviewPose} from './character-pose-review.mjs';
import {InteriorSpaces, OUTSIDE, SPACE_SAVE_BYTES, interiorDocument} from './interior-spaces.mjs';
import {InteriorLayouts,LAYOUT_SAVE_BYTES} from './interior-layouts.mjs';
import {RoomDesigns,DESIGN_SAVE_BYTES} from './room-designs.mjs';
import {IndoorGardens,INDOOR_GARDEN_BYTES} from './indoor-gardens.mjs';
import {GardenEditors} from './garden-editors.mjs';
import {readOwnedRoomArt} from './owned-room-art.mjs';
import {Houses, HOUSE_SAVE_BYTES,houseId} from './houses.mjs';
import {readActivity,ActivityError} from './activity.mjs';
import {nodeVisits} from './content-nodes.mjs';
import express from 'express';
import { Networked3dWebExperienceServer } from '@mml-io/3d-web-experience-server';
import { NetworkedDOM } from '@mml-io/networked-dom-server';
import {avatarPoseBroadcast,avatarPoseModes,poseConnection,poseKeyMaterial,poseProofMessage} from './avatar-pose-presence.mjs';
import {tabletopPointBroadcast,tabletopPointDuration,tabletopPointProofMessage,validTabletopPoint} from './tabletop-pointing.mjs';
import {FROM_SERVER_BROADCAST_MESSAGE_TYPE,handleExperienceWebsocketSubprotocol,serializeServerBroadcastMessage} from '@mml-io/3d-web-experience-protocol';
import enableWs from 'express-ws';
import { existsSync, readFileSync } from 'node:fs';
import {ANIMATION_ASSET_REVISIONS,readPackedArt,sendPackedArt} from './packed-art.mjs';
import { packedClientHandler } from './packed-client.mjs';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { Room, RoomError, LIMITS } from './room.mjs';
import { RoomStore } from './room-store.mjs';
import { homeIdentityResolver } from './home-identity.mjs';
import { worldDocument } from './world.mjs';
import { VALLEY_ASSET_REVISIONS,VALLEY_LAYOUT } from './continuous-valley.mjs';
import { TERRACE_TOP } from './world-layout.mjs';
import { createWorldPort } from './world-port.mjs';
import {sameVisitPin,validateContentNodes,validateContentVisits,visitsForActor} from './content-visits.mjs';
import {allowedGalleryVisits,gallerySlots} from './gallery-catalog.mjs';
import {GALLERY_STAGES} from './gallery-display.mjs';
import {createGalleryAuthorization} from './gallery-authorization.mjs';
import {collectionSelection,createCollectionReader,createCollectionReferenceReader,selectMatterAppearance} from './collection-catalog.mjs';
import {readMatterWorkshopArt} from './matter-workshop-art.mjs';
import {readCollectionRepresentatives} from './collection-representatives.mjs';
import {createNativeRoomAuthority,createNativeReviewAuthority} from './native-authority.mjs';
import {WorldDocument} from './world-document.mjs';
import {SessionBindings,SESSION_MS,sessionKey} from './session-bindings.mjs';
import {HumanAvatarProfiles,humanWardrobeAssets} from './human-avatars.mjs';

const cookieToken=req=>req.headers.cookie?.match(/(?:^|; )holodeck_session=([a-f0-9]{40})(?:;|$)/)?.[1];
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export async function createHolodeck({basePath='/',production=false,identityResolver=null,publicOrigin=null,stateDir=null,nativeFactory=null,worldSocket=null,worldSocketBeingRef=null,worldPorts=[],contentVisits=[],contentNodes,nativeRoomAuthority=null,conversationOrigins=[],ownNative=false,interiorSpaces=[],interiorGuestAccess,interiorArtwork=interiorArt,houseVisual,gardenVisual,gallerySelection,galleryAuthorization,matterCollection,collectionSourceRequest,nativeReviewAuthority=null,artProfile,worldTerrain,atelierLayoutWrites=ATELIER_EXPANSION_WRITES,lightExercise=false}={}){
  if(!/^\/(?:[a-z0-9-]+\/)*$/.test(basePath))throw Error('Select a bounded absolute base path');
  lightExercise=lightExercise===true;
  if(production&&(!identityResolver||!publicOrigin||!stateDir))throw Error('Shared identity, audience and state are required in production');
  if(typeof interiorArtwork!=='function'||production&&(interiorArtwork!==interiorArt||houseVisual||gardenVisual))
    throw Error('Select checked-in art for production');
  if(galleryAuthorization!==undefined&&(production||typeof galleryAuthorization!=='function'))
    throw Error('Use the configured Nexus authority for gallery visits');
  if(collectionSourceRequest!==undefined&&(production||typeof collectionSourceRequest!=='function'))
    throw Error('Use the configured Home authority for the Collection');
  const selectedContentNodes=validateContentNodes(contentNodes);
  const selectedContentVisits=validateContentVisits(contentVisits,selectedContentNodes);
  if(!Array.isArray(conversationOrigins)||conversationOrigins.length>8||new Set(conversationOrigins).size!==conversationOrigins.length)
    throw Error('Select bounded Conversation origins');
  for(const value of conversationOrigins){const selected=new URL(value);if(selected.protocol!=='https:'||selected.origin!==value)throw Error('Select exact HTTPS Conversation origins');}
  if(nativeRoomAuthority!==null&&typeof nativeRoomAuthority!=='function')throw Error('Select the installed native service authority reader');
  if(nativeReviewAuthority!==null&&typeof nativeReviewAuthority!=='function')throw Error('Select the installed Nexus ownership reader');
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
  enableWs(app,undefined,{wsOptions:{verifyClient:authorizeSocket,handleProtocols:(protocols,req)=>isWorldSocket(req.url?.split('?')[0] ?? '')
    ?NetworkedDOM.handleWebsocketSubprotocol(protocols):handleExperienceWebsocketSubprotocol(protocols)}});
  const sessions=new Map();const sockets=new Map();const socketSessions=new WeakMap();let nextId=0,authorizationTimer=null,pendingSockets=0;
  const sessionBindings=production?new SessionBindings(stateDir,LIMITS.sessions):null;
  for(const binding of sessionBindings?.load()||[])sessions.set(binding.key,{id:++nextId,
    actor:{id:binding.actorRef,kind:'human'},created:binding.created,times:[],connection:null,sourceCookie:undefined});
  let avatarAssignments=null,saveAvatarAssignments=null,avatarChoices=null,saveAvatarChoices=null;
  let avatarChoicesUnavailable=false;
  if(stateDir){
    try{
      const avatarStore=new RoomStore(join(stateDir,'human-avatars'),{maxBytes:2048});
      avatarAssignments=avatarStore.load();
      let failed=false;
      saveAvatarAssignments=state=>{
        try{avatarStore.save(state);failed=false;}
        catch{if(!failed)console.error('Holodeck avatar assignments could not be saved');failed=true;}
      };
    }catch{console.error('Holodeck avatar assignments could not be restored');}
    try{
      const choiceStore=new RoomStore(join(stateDir,'human-avatar-choices'),{maxBytes:8192});
      avatarChoices=choiceStore.load();
      saveAvatarChoices=state=>choiceStore.save(state);
      // Refuse writes over unreadable selections while the ordinary world remains available.
      new HumanAvatarProfiles(null,null,avatarChoices);
    }catch{avatarChoices=null;avatarChoicesUnavailable=true;console.error('Holodeck avatar choices could not be restored');}
  }
  let avatars;
  try{avatars=new HumanAvatarProfiles(avatarAssignments,saveAvatarAssignments,avatarChoices,saveAvatarChoices);}
  catch{avatars=new HumanAvatarProfiles(null,null,avatarChoices,saveAvatarChoices);console.error('Holodeck avatar assignments could not be restored');}
  avatars.retain(sessions.values());
  const avatarProfile=actor=>({meshFileUrl:route('assets/'+avatars.model(actor))});
  const wardrobeAssets=humanWardrobeAssets();
  const sessionFor=token=>sessions.get(sessionKey(token));
  const localBoot=randomBytes(4).toString('hex');
  const store=stateDir?new RoomStore(stateDir):null;
  const houseStore=stateDir ? new RoomStore(join(stateDir,'houses'),{maxBytes:HOUSE_SAVE_BYTES}) : null;
  const houses=new Houses({state:houseStore?.load(),persist:houseStore ? state => houseStore.save(state) : null});
  const spaceStore=stateDir ? new RoomStore(join(stateDir,'spaces'),{maxBytes:SPACE_SAVE_BYTES}) : null;
  const layoutStore=stateDir?new RoomStore(join(stateDir,'layouts'),{maxBytes:LAYOUT_SAVE_BYTES}):null;
  // Keep the receiving graph as the fallback for releases predating adoption.
  // The separate checkpoint contains only the explicitly adopted Atelier plan.
  const atelierLayoutStore=stateDir&&artProfile===ATELIER_PROFILE ?
    new RoomStore(join(stateDir,'atelier-layout'),{maxBytes:LAYOUT_SAVE_BYTES}) : null;
  const atelierBaseline=interiorSpaces.filter(room=>room.house===COMPAII_HOUSE);
  const baselineIds=new Set(atelierBaseline.map(room=>room.id));
  function overlayRooms(ordinary,adopted){
    const originals=new Map(adopted.filter(room=>baselineIds.has(room.id)).map(room=>[room.id,room]));
    return [...ordinary.map(room=>room.house===COMPAII_HOUSE?originals.get(room.id)??room:room),
      ...adopted.filter(room=>!baselineIds.has(room.id))];
  }
  let layouts;
  const atelierLayouts=atelierLayoutStore&&new InteriorLayouts({
    state:atelierLayoutStore.load(),houses,draftBaseline:atelierBaseline,
    allowBaselineExtension:atelierLayoutWrites,
    persist:value=>atelierLayoutStore.save(value),
    validate:definitions=>!definitions.length ||
      (definitions.every(room=>room.house===COMPAII_HOUSE) &&
        matchesAtelierLayout(definitions,atelierBaseline) &&
        new InteriorSpaces({definitions:overlayRooms(layouts?.definitions()??interiorSpaces,definitions),houses})),
  });
  layouts=new InteriorLayouts({state:layoutStore?.load(),houses,baseDefinitions:interiorSpaces,
    persist:layoutStore?value=>layoutStore.save(value):null,
    validate:definitions=>new InteriorSpaces({definitions:overlayRooms(definitions,atelierLayouts?.definitions()??[]),houses})});
  const layoutAuthority=actor=>atelierLayouts&&houseId(actor.id)===COMPAII_HOUSE?atelierLayouts:layouts;
  if(worldTerrain!==undefined&&worldTerrain!==TOROIDAL_TERRAIN.id)throw Error('Unknown world terrain edition');
  const toroidal=worldTerrain===TOROIDAL_TERRAIN.id;
  const authoredLayout=()=>overlayRooms(layouts.definitions(),atelierLayouts?.definitions()??[]);
  const layoutDefinitions=()=>{
    const combined=authoredLayout();
    if(!toroidal)return combined;
    return houseReviewRooms(combined,COMPAII_HOUSE,matterCollection?.room,ATELIER_ROOMS.lab);
  };
  const spaces=new InteriorSpaces({definitions:layoutDefinitions(),houses,state:spaceStore?.load(),
    upperLanding:toroidal&&artProfile===ATELIER_PROFILE?atelierLabReturn:undefined,
    persist:spaceStore ? state=>spaceStore.save(state) : null,guestAccess:interiorGuestAccess});
  const exteriorArt=packedExteriorArt();
  // A selected terrain can hide rooms while their authored checkpoints remain
  // valid for the normal edition. Access and writes still use spaces.rooms.
  const authoredRooms=()=>toroidal?new Map(authoredLayout().map(room=>[room.id,room])):spaces.rooms;
  const atelier=selectAtelier(artProfile,authoredRooms(),houses.directory(),exteriorArt);
  const valley=Boolean(atelier)&&!toroidal;
  const singleHouse=valley||toroidal;
  const outdoorHouse=house=>!singleHouse||house.id===COMPAII_HOUSE;
  const exteriorEntrances=actor=>spaces.view(actor,OUTSIDE).entrances.filter(
    entrance=>!singleHouse||spaces.rooms.get(entrance.id)?.house===COMPAII_HOUSE).map(
    entrance=>toroidal?{...entrance,door:toroidalParcelPoint(entrance.door)}:entrance);
  const publicWorld=toroidal?TOROIDAL_TERRAIN.id:valley?VALLEY_LAYOUT:'island-workshop';
  for(const [path,revision] of Object.entries({...ANIMATION_ASSET_REVISIONS,...(valley?VALLEY_ASSET_REVISIONS:{}),...SAND3D_TRAIL_REVISIONS})){
    const asset=readPackedArt(path,revision);
    if(asset)exteriorArt.set(path,asset);
  }
  const selectedRooms=new Set(interiorSpaces.map(item=>item.id));
  const gardenStore=stateDir?new RoomStore(join(stateDir,'indoor-gardens'),{maxBytes:INDOOR_GARDEN_BYTES}):null;
  const indoorGardens=new IndoorGardens({state:gardenStore?.load(),spaces,houses,legacyRooms:selectedRooms,authoredRooms,lightExercise,
    persist:gardenStore?value=>gardenStore.save(value):null});
  const editorStore=stateDir?new RoomStore(join(stateDir,'garden-editors'),{maxBytes:16*1024}):null;
  const gardenEditors=new GardenEditors({state:editorStore?.load(),owner:id=>indoorGardens.owner(id),
    authoredOwner:id=>indoorGardens.owner(id,authoredRooms()),
    allows:(actor,id)=>spaces.allows(actor,id),persist:editorStore?value=>editorStore.save(value):null});
  const kits=readOwnedRoomArt();
  const designStore=stateDir?new RoomStore(join(stateDir,'room-designs'),{maxBytes:DESIGN_SAVE_BYTES}):null;
  const designs=new RoomDesigns({state:designStore?.load(),spaces,houses,legacyRooms:selectedRooms,kits,authoredRooms,
    persist:designStore?value=>designStore.save(value):null});
  const collection=collectionSelection(matterCollection,spaces.rooms);
  if(collection&&!publicOrigin)throw Error('Collection requires the existing Home origin');
  const matterArt=collection?.art&&readMatterWorkshopArt(collection.art);
  const readCollection=collection&&createCollectionReader(publicOrigin,{request:collectionSourceRequest});
  const readTableReference=collection?.art&&createCollectionReferenceReader(publicOrigin,readCollection,{request:collectionSourceRequest});
  const representatives=readCollectionRepresentatives(stateDir,collection);
  const tableStore=collection?.art&&stateDir?new RoomStore(join(stateDir,'collection-worktable'),{maxBytes:1024}):null;
  const tableResources=new Set(collection?.projects.flatMap(project=>project.resources));
  let table=tableStore?.load()??{room:collection?.room,revision:0,resource:null};
  let tableUnavailable=false;
  const archiveStore=collection?.archive?.length&&stateDir?
    new RoomStore(join(stateDir,'collection-placement'),{maxBytes:2048}):null;
  const heldArchive=archiveStore?.load();
  const pinKey=entry=>entry.resource+':'+entry.version;
  const collectionStreams=new Map();
  const lookStore=collection?.art&&stateDir?new RoomStore(join(stateDir,'matter-room-looks'),{maxBytes:16*1024}):null;
  let roomLookPreferences=new Map(lookStore?.load()??[]);
  let lookPreferencesUnavailable=false;
  const lookReaderKey=actor=>createHash('sha256').update(actor.id).digest('hex');
  function invalidateCollection(){
    for(const [res,session] of collectionStreams){
      if(inScope(session.actor,collection.room)&&Date.now()-session.created<SESSION_MS)
        res.write('event: refresh\ndata: {}\n\n');
      else res.end();
    }
  }
  function tabletopSnapshot(){
    const connections=cellTransports.get(collection?.room)?.connections;
    return JSON.stringify([...connections??[]].filter(([,peer])=>peer.tabletop&&inScope(peer.session.actor,collection.room))
      .map(([connection])=>connection));
  }
  function broadcastTabletop(){
    const event='event: tabletop\ndata: '+tabletopSnapshot()+'\n\n';
    for(const [res,session] of collectionStreams){
      if(inScope(session.actor,collection.room)&&Date.now()-session.created<SESSION_MS)res.write(event);
      else res.end();
    }
  }
  const archiveKeys=new Set(collection?.archive?.map(pinKey));
  const shelfCount=matterArt?.shelves.length??0;
  const baseShelves=collection?.projects.length??0;
  const placed=heldArchive&&heldArchive.room===collection?.room ? heldArchive.placed : [];
  let archiveUnavailable=false;
  if(!Array.isArray(placed)||placed.length>6||placed.some(key=>typeof key!=='string'||
    !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(key))||new Set(placed).size!==placed.length)
    throw Error('Invalid Collection placement checkpoint');
  const savedSlots=heldArchive?.room===collection?.room?heldArchive?.shelfSlots:undefined;
  const slots=savedSlots??placed.map((key,index)=>index);
  if(!Array.isArray(slots)||slots.length!==placed.length||new Set(slots).size!==slots.length||
     slots.some(slot=>!Number.isSafeInteger(slot)||slot<0||slot>=6))
    throw Error('Invalid Collection shelf slots');
  let shelfSlots=new Map(placed.map((key,index)=>[key,slots[index]]).filter(([key])=>archiveKeys.has(key)));
  const availableSlot=()=>Array.from({length:Math.max(0,shelfCount-baseShelves)},(_,index)=>index)
    .find(slot=>![...shelfSlots.values()].includes(slot));
  function restoredPin(entry){
    const slot=shelfSlots.get(pinKey(entry));
    if(slot===undefined||slot+baseShelves>=shelfCount)return null;
    return collection.archive.find(pin=>pin.resource===entry.resource&&pin.version===entry.version)??null;
  }
  if(!Number.isSafeInteger(table.revision)||table.revision<0||
     (table.resource!==null&&!/^[a-f0-9]{32}$/.test(table.resource))||
     (table.edition&&(table.resource!==null||!Object.hasOwn(table.edition,'resource')||
      !Object.hasOwn(table.edition,'version')||!/^([a-f0-9]{32}):([a-f0-9]{64})$/.test(pinKey(table.edition)))))
    throw Error('Invalid worktable checkpoint');
  if(table.room!==collection?.room)table={room:collection?.room,revision:0,resource:null};
  function artForRoom(room,passages){
    if(matterArt&&room?.id===collection.room&&!room.links.some(link=>link.kind==='stair'))return matterArt;
    if(selectedRooms.has(room?.id))return (atelier?.interiorArtwork??interiorArtwork)(room,passages);
    const design=designs.forRoom(room?.id);
    return design?{...kits.get(design.kit),designRevision:design.revision}:null;
  }
  const authoredGallery=gallerySlots(gallerySelection,authoredRooms());
  const gallery=spaces.rooms.has(authoredGallery?.room)?authoredGallery:null;
  const authorizeRoomVisit=galleryAuthorization??(publicOrigin?createGalleryAuthorization(publicOrigin):null);
  const exhibitStore=stateDir?new RoomStore(join(stateDir,'exhibits'),{maxBytes:EXHIBIT_SAVE_BYTES}):null;
  const exhibits=new RoomExhibits({state:exhibitStore?.load(),spaces,houses,artForRoom,
    persist:exhibitStore?state=>exhibitStore.save(state):null});
  function interiorVisits(actor,id){
    const placed=exhibits.visit(actor,id);
    return id===gallery?.room?
      [...placed,...gallery.slots.filter(slot=>!placed.some(entry=>sameVisitPin(entry.pin,slot.pin)))]:placed;
  }
  const room=new Room({houses,state:store?.load(),persist:store?s=>store.save(s):null,contentNodes:selectedContentNodes,lightExercise,
    presence:()=>[...sessions.values()].filter(s=>s.connection!==null&&Date.now()-s.created<SESSION_MS&&spaces.current(s.actor)===OUTSIDE)
      .map(s=>({actor:s.actor.id,kind:'human',name:s.actor.name||'Explorador',scope:'authenticated-room-presence',position:null}))});
  const exteriorAddress='http://localhost'+route('world');
  const document=new WorldDocument(exteriorAddress);
  // Keep the ordinary snapshot for browsers already running an earlier client.
  const arrivalDocument=atelier&&new WorldDocument(exteriorAddress);
  let projectionHealthy=true,projectionQueued=false,projectionRunning=false;
  const project=async()=>{
    projectionQueued=true;if(projectionRunning)return;projectionRunning=true;
    try{while(projectionQueued){projectionQueued=false;
      await Promise.all([...sockets].map(([socket,record])=>checkSocket(socket,record)));
      if(room.commitUncertain){projectionHealthy=false;return;}
      const art={basePath,houseVisual:atelier?.houseVisual??houseVisual,
        gardenVisual:atelier?.gardenVisual??gardenVisual,sceneryAsset:atelier?.sceneryAsset,sceneryRevision:atelier?.sceneryRevision,
        commonsVisual:atelier?.commonsVisual,coastalRidges:atelier?.coastalRidges,
        valleyHouse:valley?COMPAII_HOUSE:undefined,toroidalHouse:toroidal?COMPAII_HOUSE:undefined};
      const loads=[document.load(worldDocument(room,art))];
      if(arrivalDocument)loads.push(arrivalDocument.load(worldDocument(room,{...art,deferDressing:true})));
      await Promise.all(loads);
      projectionHealthy=true;
    }}catch{projectionHealthy=false;}finally{projectionRunning=false;}
  };
  await project();if(!projectionHealthy){document.dispose();arrivalDocument?.dispose();throw Error('The initial world representation could not load');}room.on('change',project);
  const native=nativeFactory?await nativeFactory({room,stateDir,allowInteriorSource}):null;
  const installedWorldPorts=[];
  let poseReview,poseCatalog;
  if(stateDir&&spaces.rooms.has(CHARACTER_STUDIO)){
    try{
      const catalog=JSON.parse(readFileSync(new URL('../build/character-pose-catalog.json',import.meta.url),'utf8'));
      poseReview=createCharacterPoseReview(new RoomStore(join(stateDir,'character-pose-review'),{maxBytes:256*1024}),catalog);
      poseCatalog=catalog;
    }catch{console.error('Holodeck character pose review is unavailable');}
  }
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
    for(const [res,session] of collectionStreams)
      if(session.actor.id===actor.id&&!inScope(actor,collection.room))res.end();
  }
  async function checkSocket(socket,record){
    if(record.checking)return record.checking;
    record.checking=(async()=>{
      try{
        const actor=await currentActor({method:'GET',headers:{cookie:record.session.sourceCookie}},record.session);
        if(actor?.rights?.includes('observe'))spaces.releaseDeniedPosition(actor);
        if(!inScope(actor,record.scope)||record.projectionAllowed?.()===false)socket.close(1008);
      }catch{socket.close(1008);}
    })();
    try{await record.checking;}finally{record.checking=null;}
  }
  // Complete Home authorization before the WebSocket upgrade so the
  // transport has its listener installed when the browser sends its handshake.
  function authorizeSocket({req},accept){
    if(sockets.size+pendingSockets>=LIMITS.sessions*2){accept(false,503);return;}
    const expected=publicOrigin||`http://${req.headers.host}`;
    if((production||req.headers.origin)&&req.headers.origin!==expected){accept(true);return;}
    const session=sessionFor(cookieToken(req));
    if(!session){accept(true);return;}
    pendingSockets++;
    currentActor(req,session).then(actor=>{
      if(actor)socketSessions.set(req,session);
    }).catch(()=>{}).finally(()=>{
      pendingSockets--;
      accept(true);
    });
  }
  // Existing HTTP forward-auth does not reauthorize an established WebSocket.
  // Keep one bounded timer only while this room has connections, with no model
  // attention; semantic updates additionally recheck before publishing geometry.
  const registerSocket=app.ws.bind(app);
  app.ws=(path,handler)=>registerSocket(path,(socket,req)=>{
    const session=socketSessions.get(req),actor=session?.actor;
    if(!session||sessionFor(cookieToken(req))!==session){socket.close(1008);return;}
    if(path===activeNetworkPath&&actor?.rights?.includes('observe'))spaces.releaseDeniedPosition(actor);
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
  });
  const cellTransports=new Map();
  const outsidePosePeers=new Map();
  const posePeers=scope=>scope===OUTSIDE?outsidePosePeers:cellTransports.get(scope)?.connections;
  const poseNetwork=scope=>scope===OUTSIDE?network:cellTransports.get(scope)?.network;
  const canReadPose=(peer,scope)=>Date.now()-peer.session.created<SESSION_MS&&inScope(peer.session.actor,scope);
  function sendPose(scope,connection,payload,peers=posePeers(scope),transport=poseNetwork(scope)){
    const peer=peers?.get(connection);
    if(!peer||!canReadPose(peer,scope))return;
    try{
      transport?.userNetworkingServer.sendCustomMessageToClient(connection,FROM_SERVER_BROADCAST_MESSAGE_TYPE,
        serializeServerBroadcastMessage({broadcastType:avatarPoseBroadcast,payload:{space:scope,...payload}}));
    }catch{
      // Presence sockets already handle closure. Pose hints never impede it.
    }
  }
  function fanOutPose(scope,connection,pose,peers=posePeers(scope),transport=poseNetwork(scope)){
    for(const id of peers?.keys()??[])
      if(id!==connection)sendPose(scope,id,{connection,pose},peers,transport);
  }
  function dropPose(scope,connection,peers,transport){
    const peer=peers.get(connection);
    peers.delete(connection);
    if(peer?.pose&&peer.pose!=='ground')fanOutPose(scope,connection,'ground',peers,transport);
  }

  function renderInterior(room,passages,exhibit){
    const art=artForRoom(room,passages),src=art?route('api/space/art/'+art.revision):null;
    const gallerySigns=room.id===gallery?.room&&exhibit?.pin.kind==='artifact_review'&&exhibit.pin.adapter==='interactive_3d';
    const passageAsset=passage=>{
      const fitting=atelier?.passageFitting(room,passage,art);
      return fitting?{src:route('api/space/art/'+fitting.revision),door:fitting.door,onLanding:fitting.onLanding}:null;
    };
    const houseDoor=spaces.rooms.has(CHARACTER_STUDIO)&&
      (room.id===ATELIER_FOYER||passages.some(p=>p.to===ATELIER_FOYER));
    return interiorDocument(room,passages,exhibit,art&&{...art,src,gallerySigns},passageAsset,houseDoor);
  }
  function interiorScopeKey(actor,selected){
    return JSON.stringify([spaces.passages(actor,selected).map(link=>link.slot),
      !selected.entry&&!spaces.canReachEntrance(actor,selected.id),exhibits.forRoom(selected.id)?.revision??0,
      designs.forRoom(selected.id)?.revision??0,gardenEditors.grant(actor,selected.id)?.revision??0]);
  }
  function visitScene(actor,id,cachedRevision){
    const selected=spaces.rooms.get(id);
    if(!selected)return null;
    const markup=renderInterior(selected,spaces.passages(actor,selected),exhibits.forRoom(id));
    const revision=createHash('sha256').update(actor.id+'\n'+markup).digest('hex');
    return {id,actor:actor.id,revision,...(cachedRevision===revision?{}:{markup})};
  }
  function liveSpace(actor,cachedRevision){
    const space=describeSpace(actor,true);
    const roomLooks=space.collectionShelves&&matterArt?.roomLooks;
    const splat=space.collectionShelves&&matterArt?.floorSplat;
    return {...space,live:1,avatarPosePresence:true,actorRef:actor.id,
      ...(roomLooks?{matterStyles:{...roomLooks.describe(revision=>route('api/space/art/'+revision)),
        ...(roomLookPreferences.has(lookReaderKey(actor))?{preferred:roomLookPreferences.get(lookReaderKey(actor))}:{})}}:{}),
      ...(splat?{matterFloorSplat:{src:route('api/space/art/'+splat.revision),target:splat.target,radius:splat.radius}}:{}),
      sharedConversation:!!(native?.contexts&&native?.conversationSurface),scene:visitScene(actor,space.id,cachedRevision)};
  }
  function roomParticipants(id){
    const seen=new Map();
    for(const {actor} of cellTransports.get(id)?.connections.values()??[]){
      if(inScope(actor,id))seen.set(actor.id,{actor:actor.id,kind:actor.kind,name:actor.name||'Explorador'});
    }
    return [...seen.values()];
  }
  function describeSpace(actor,includeSky=false){
    if(spaces.fenced)throw new RoomError('space-uncertain','Room placement needs recovery');
    const view=spaces.view(actor),exhibit=exhibits.scoped(actor,view.id),
      art=artForRoom(spaces.rooms.get(view.id),view.exits ?? []);
    const gardenRoom=Boolean(indoorGardens.owner(view.id));
    const activity=lightExercise&&gardenRoom?indoorGardens.view(actor,view.id):null;
    const outdoorSky=includeSky?(view.id===OUTSIDE?atelier?.outdoorSky:art?.outdoorSky):null;
    const space={...view,...(view.id===OUTSIDE?{entrances:exteriorEntrances(actor),...(toroidal?{title:'Holodeck',outdoorTerrain:TOROIDAL_TERRAIN.id,terrainRun:room.run}:
        valley?{title:'Valle de llegada',outdoorTerrain:true}:{})}:{objects:roomObjects(view),
        ...(toroidal&&view.exteriorDoor?{exteriorDoor:toroidalParcelPoint(view.exteriorDoor)}:{})}),
      ...(gardenRoom?(lightExercise?{playableInterior:true}:{gardenReceiptRecovery:true}):{}),
      ...(lightExercise&&gardenEditors.grant(actor,view.id)?{canDesignGarden:true}:{}),
      ...(activity?{activity}:{}),
      ...(art?.lightRig?{indoorLighting:true}:{}),
      ...(outdoorSky?{outdoorSky}:{}),
      ...(art?.keyLight?{keyLight:art.keyLight}:{}),
      ...(collection?.room===view.id&&art?.shelves?{collectionShelves:true}:{}),
      ...(exhibit?{exhibitRevision:exhibit.revision}:{})};
    const cell=cellTransports.get(space.id);
    if(!cell)return space;
    return {...space,participants:roomParticipants(space.id)};
  }
  function roomObjects(view){
    const art=artForRoom(spaces.rooms.get(view.id),view.exits ?? []);
    const objects=view.id===CHARACTER_STUDIO?[characterWorktable]:art?.replacesShell||art?.hideMarker?[]:view.objects;
    const stations=[art?.station,...(art?.controls??[])].filter(Boolean);
    const fixtures=(art?.fixtures??[]).map(fixture=>({...fixture,revision:art.designRevision??fixture.revision}));
    return [...objects,...fixtures,...stations.map(station=>({id:station.id,kind:'workstation',title:station.title,
      position:station.position,revision:station.revision}))];
  }
  function conversationPlace(actor,id){
    const selected=spaces.rooms.get(id);
    if(!actor.rights?.includes('observe')||!selected||spaces.fenced||room.commitUncertain||!spaces.allows(actor,id))return null;
    const view=spaces.view(actor,id);
    const exhibit=exhibits.scoped(actor,id),activity=lightExercise?indoorGardens.observe(actor,id):null;
    return {id,title:selected.title,level:selected.level,house:selected.house,
      objects:view.id===id?roomObjects(view):[],
      ...(activity?{activity}:{}),
      ...(exhibit?{exhibitRevision:exhibit.revision}:{}),
      participants:roomParticipants(id)};
  }
  async function allowInteriorSource(actor,beingRef,id){
    const recipient={id:beingRef,ref:beingRef,kind:'daimon'};
    if(!nativeRoomAuthority||spaces.fenced||room.commitUncertain||
      !spaces.allows(actor,id)||!spaces.allows(recipient,id))return false;
    const rights=await nativeRoomAuthority({actor:recipient});
    return rights.includes('observe')&&!spaces.fenced&&!room.commitUncertain&&
      spaces.allows(actor,id)&&spaces.allows(recipient,id);
  }
  function captureConversationPlace(actor,request,cookie,reauthorize){
    const id=spaces.current(actor);
    if(spaces.fenced||room.commitUncertain||id!==(request.view?.spaceId??OUTSIDE))
      throw new RoomError('scope-changed','Tu lugar cambió. Volvé a intentar con el borrador que conservaste.');
    const pose=request.view?.characterPose;
    if(pose!==undefined&&(id!==CHARACTER_STUDIO||!poseCatalog||resolveReviewPose(pose,poseCatalog).status!==200))
      throw new RoomError('scope-changed','Volvé a seleccionar la pose en el Taller de personajes. El borrador sigue en la conversación.');
    if(id===OUTSIDE)return null;
    const place=conversationPlace(actor,id);
    if(!place)throw new RoomError('forbidden','Tu acceso a esta sala cambió.');
    const snapshot={id:randomUUID(),run:room.run,edition:room.edition,sequence:room.sequence,capturedAt:Date.now(),place};
    if(pose)snapshot.characterPose=structuredClone(pose);
    const selected=request.view?.roomVisit;
    const entry=selected&&interiorVisits(actor,id).find(visit=>visit.node===selected.id&&visit.nodeRevision===selected.revision);
    if(entry&&authorizeRoomVisit){
      // The paired daimon's room grant does not imply access to the speaker's
      // source edition. Verify the speaker and retain only the room address.
      const reference={id:entry.node,revision:entry.nodeRevision};
      snapshot.roomVisit=Promise.resolve().then(()=>authorizeRoomVisit(cookie,entry.pin))
        .then(allowed=>allowed===true?reference:null,()=>null);
    }
    if(request.view?.worktable!==undefined){
      const reference=structuredClone(request.view.worktable);
      if(!readTableReference||collection.room!==id||!place.objects.some(object=>object.id==='worktable')||
        !(tableResources.has(reference?.resource)||reference&&restoredPin(reference)))
        throw new RoomError('scope-changed','Volvé a seleccionar el modelo en la mesa de trabajo.');
      snapshot.resolveWorktable=async()=>{
        const confirmed=await readTableReference(cookie,reference);
        if(!confirmed||!spaces.allows(await reauthorize()??{},id))
          throw new RoomError('scope-changed','No pude confirmar esa edición o pieza. El borrador sigue en la conversación.');
        const target=new URL('/view/'+confirmed.resource,publicOrigin);
        target.searchParams.set('version',confirmed.version);
        target.searchParams.set('display','work');
        return {...confirmed,viewer:target.href};
      };
    }
    return snapshot;
  }
  function moveSpace(actor,request){
    if(room.commitUncertain||!actor.rights?.includes('observe'))return null;
    if(singleHouse&&request.from===OUTSIDE&&spaces.rooms.get(request.to)?.house!==COMPAII_HOUSE)return null;
    const moved=spaces.move(actor,request);
    if(!moved)return null;
    closeOutOfScope(actor);
    return describeSpace(actor);
  }
  function putExhibit(actor,input){
    const canWrite=()=>!room.commitUncertain&&!spaces.fenced;
    if(!canWrite())return null;
    if(input.type==='exhibit.current')return exhibits.inspect(actor,input.room);
    const preview=input.type==='exhibit.preview';
    const authorizeReview=nativeReviewAuthority&&(async(author,pin)=>{
      if(await nativeReviewAuthority(author,pin)!==true)return false;
      const rights=await nativeRoomAuthority({actor:author});
      return projectionHealthy&&rights.includes('observe')&&rights.includes('edit');
    });
    return exhibits.put(actor,preview?{...input,type:'exhibit.put'}:input,room.nodes,{preview,authorizeReview,canWrite});
  }
  function publishLayout(actor,input){
    if(room.commitUncertain||spaces.fenced||!layoutStore)return null;
    const authority=layoutAuthority(actor);
    try{
      const layout=authority.publish(actor,input,rooms=>{
        spaces.clearRestoredGuestPositions(rooms,actor.id);
      });
      if(layout){
        spaces.rooms=new Map(layoutDefinitions().map(definition=>[definition.id,definition]));
        for(const [socket,record] of sockets){
          if(!inScope(record.session.actor,record.scope)||record.projectionAllowed?.()===false)
            socket.close(1008);
        }
      }
      return layout;
    }catch(error){
      if(authority.fenced)spaces.fenced=true;
      throw error;
    }
  }
  function roomDesign(actor,input){
    if(room.commitUncertain||spaces.fenced||!designStore)return null;
    if(input.type==='design.current')return designs.inspect(actor,input.room);
    if(input.type==='design.result')return designs.result(actor,input.id);
    if(input.type==='design.preview')return designs.put(actor,{...input,type:'design.put'},true);
    // The first furniture mount introduces colliders. Do it only when
    // nobody is connected in the cell. Subsequent kit changes keep them fixed.
    if(!designs.forRoom(input.room)&&
       [...sockets.values()].some(connection=>connection.scope===input.room))return null;
    try{
      return designs.put(actor,input);
    }catch(error){
      if(designs.fenced)spaces.fenced=true;
      throw error;
    }
  }
  function indoorGarden(actor,input,delegated=false){
    if(room.commitUncertain||spaces.fenced||!gardenStore)return null;
    if(input.type==='garden.editor.current'||input.type==='garden.editor.set'){
      if(!lightExercise&&input.type==='garden.editor.set'&&input.human!==null)return null;
      const selected=gardenEditors.act(actor,input);
      if(selected&&input.type==='garden.editor.set'){
        for(const [socket,record] of sockets)
          if(record.scope===input.room&&record.projectionAllowed?.()===false)socket.close(1008);
      }
      return selected;
    }
    if(input.type==='garden.templates'||input.type==='garden.draft')return lightExercise?indoorGardens.draft(actor,input):null;
    if(input.type==='garden.result')return indoorGardens.result(actor,input.id);
    if(input.type==='garden.preview')return indoorGardens.act(actor,{...input,type:'garden.put'},{preview:true});
    try{return indoorGardens.act(actor,input,{delegated});}
    catch(error){if(indoorGardens.fenced)spaces.fenced=true;throw error;}
  }
  const selectedWorldPorts=validateWorldPorts({worldSocket,worldSocketBeingRef,worldPorts});
  if(selectedWorldPorts.length&&!native)throw Error('Native authority is required for world return ports');
  for(const selected of selectedWorldPorts)installedWorldPorts.push(await createWorldPort({socketPath:selected.socket,expectedBeingRef:selected.beingRef,room,native,describeSpace,moveSpace,conversationPlace,
    approachSpace:(actor,destination)=>room.commitUncertain?null:spaces.approach(actor,destination),
    putExhibit,exhibitResult:(actor,id)=>exhibits.result(actor,id),
    currentLayout:actor=>layoutAuthority(actor).current(actor),
    draftLayout:(actor,input)=>room.commitUncertain||spaces.fenced||!layoutStore?null:layoutAuthority(actor).draft(actor,input),
    previewLayout:(actor,input)=>layoutAuthority(actor).preview(actor,input),
    publishLayout,layoutResult:(actor,id)=>layoutAuthority(actor).result(actor,id),roomDesign,indoorGarden,
    reviewCharacter:(actor,type,input)=>{
      const result=reviewCharacter(actor,type,input);
      return type==='character-review.current'&&result.status===200?
        {...result,room:CHARACTER_STUDIO,catalog:poseCatalog}:result;
    },
    resolveOwnNativeRights:ownNative&&nativeRoomAuthority?async verified=>{const rights=await nativeRoomAuthority(verified);return projectionHealthy?rights:rights.filter(right=>right==='observe');}:null,resolveRights:async verified=>{
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
      const connected=new Set([...sockets.values()].flatMap(record=>[record.session,record.presenceSession]));
      const inactive=s=>s.connection===null&&!connected.has(s);
      for(const [key,s]of next)if(Date.now()-s.created>=SESSION_MS&&inactive(s))next.delete(key);
      if(next.size>=LIMITS.sessions){const idle=[...next].find(([,s])=>inactive(s));if(idle)next.delete(idle[0]);else return null;}
      const token=randomBytes(20).toString('hex'),id=++nextId;
      next.set(sessionKey(token),{id,actor,created:Date.now(),times:[],connection:null,sourceCookie:req.headers.cookie});
      sessionBindings?.save(next);
      avatars.retain(next.values());
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
      outsidePosePeers.set(connection,{session:s,poseKey:createHash('sha256').update(poseKeyMaterial(token)).digest()});
      return {userId:actor.id,connectionKey:`session:${s.id}`,username:actor.name||`Explorador ${s.id}`,characterDescription:avatarProfile(actor),colors:null};
    },
    onClientDisconnect(connection){dropPose(OUTSIDE,connection,outsidePosePeers,network);for(const s of sessions.values())if(s.connection===connection){s.connection=null;if(!room.commitUncertain)room.atomic(()=>room.event(s.actor,'participant.left',{}));}},
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
            [...connections.values()].some(peer=>peer.session===session))
          return new Error('Room connection changed');
        record.presenceSession=session;
        connections.set(connection,{actor,session,accessSession:record.session,poseKey:createHash('sha256').update(poseKeyMaterial(token)).digest()});
        return {userId:actor.id,connectionKey:`session:${session.id}`,username:actor.name||'Explorador',
          characterDescription:avatarProfile(actor),colors:null};
      },
      onClientDisconnect(connection){
        const peer=connections.get(connection);
        dropPose(id,connection,connections,scopedNetwork);
        if(peer?.tabletop)broadcastTabletop();
      },
      onClientUserIdentityUpdate(){return false;}
    },worldConfig:{mmlDocuments:{interior:{url:'ws://'+address+'world'}},enableChat:false,enableTweakPane:false,
      environmentConfiguration:{groundPlane:false,sun:{intensity:.9},fog:{fogFar:0},
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
      environmentConfiguration:{groundPlane:false,sun:{intensity:1.4},ambientLight:{intensity:toroidal?.85:1.2},
        fog:toroidal?{fogNear:500,fogFar:5100,fogColor:{r:.67,g:.78,b:.79}}:valley?{fogNear:36,fogFar:106,fogColor:{r:.716,g:.776,b:.784}}:
          {fogNear:45,fogFar:140,fogColor:{r:.67,g:.78,b:.79}}},
      avatarConfiguration:{allowCustomAvatars:false},allowCustomDisplayName:false,allowOrbitalCamera:true,
      spawnConfiguration:{spawnPosition:toroidal?TOROIDAL_SPAWN:
        {x:0,y:TERRACE_TOP+.001,z:6},spawnYRotation:180,
        ...(toroidal?{respawnTrigger:{minY:-2500}}:{})},hud:{respawnButton:false}}
  });
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  for(const [name,bytes] of wardrobeAssets)
    app.get(route('assets/'+name),(_req,res)=>res.type('model/gltf-binary').send(bytes));
  if(conversationOrigins.length)app.use((_req,res,next)=>{
    const selected='(self '+conversationOrigins.map(value=>'"'+value+'"').join(' ')+')';
    res.set('Permissions-Policy','microphone='+selected+', autoplay='+selected);next();
  });
  app.use(route('api/space/avatar-pose'),express.json({limit:'256b',strict:true}));
  app.use(route('api/space/collection/pointing'),express.json({limit:'2kb',strict:true}));
  app.use(express.json({limit:'48kb',strict:true}));
  const packedClient=new URL('../runtime/client.js.br',import.meta.url);
  if(existsSync(packedClient))
    app.get(route('client/client.js'),packedClientHandler(readFileSync(packedClient)));
  for(const [path,art] of exteriorArt)
    app.get(route(path),(req,res)=>sendPackedArt(req,res,art,true));
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
    const scopeKey=interiorScopeKey(record.session.actor,spaces.rooms.get(record.scope));
    record.projectionAllowed=()=>interiorScopeKey(record.session.actor,spaces.rooms.get(record.scope))===scopeKey;
    cellFor(record.scope).network.userNetworkingServer.connectClient(ws);
  });
  app.ws(route('world'),(ws,req)=>{
    const projection=req.query.dressing==='arrival'&&arrivalDocument||document;
    projection.addWebSocket(ws);ws.on('close',()=>{if(projection.hasWebSocket(ws))projection.removeWebSocket(ws);});
  });
  for(const channel of ['network','world'])app.ws(route('spaces/:space/'+channel),(ws,req)=>{
    const record=sockets.get(ws),id=req.params.space;
    if(!record||id===OUTSIDE||!inScope(record.session.actor,id)){ws.close(1008);return;}
    if(channel==='network'){
      cellFor(id).network.userNetworkingServer.connectClient(ws);
      return;
    }
    const selectedRoom=spaces.rooms.get(id);
    const passages=()=>spaces.passages(record.session.actor,spaces.rooms.get(id));
    const initial=passages();
    const currentExhibit=()=>exhibits.scoped(record.session.actor,id);
    const initialExhibit=currentExhibit();
    const scope=interiorScopeKey(record.session.actor,selectedRoom);
    record.projectionAllowed=()=>interiorScopeKey(record.session.actor,spaces.rooms.get(id))===scope;
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
      const pointing=req.path==='/space/collection/pointing';
      const budget=pointing?'pointTimes':req.path==='/space/avatar-pose'?'poseTimes':'times';
      const now=Date.now();session[budget]=(session[budget]??[]).filter(time=>now-time<1000);
      if(session[budget].length>=(pointing?1:4))return res.status(429).json({message:'Esperá un momento antes de intentar otra acción.'});
      session[budget].push(now);
    }
    const spaceRoute=['/space','/space/character-pose-review','/space/character-presentation','/space/content-visits','/space/collection','/space/collection/archive','/space/collection/events','/space/avatar-pose','/space/collection/tabletop-presence','/space/collection/pointing','/space/matter-look','/space/scene','/space/garden','/space/garden-editor'].includes(req.path)||req.path.startsWith('/space/art/')||req.path.startsWith('/space/collection-model/')||
      req.path==='/appearance'||req.path==='/conversation-surface'||/^\/conversation-contexts(?:\/[a-f0-9-]{36}(?:\/(?:release|retry|discard))?)?$/.test(req.path);
    if(spaceRoute&&!actor.rights?.includes('observe'))
      return res.status(403).json({message:'Tu acceso a este lugar cambió.'});
    if(!spaceRoute&&spaces.current(actor)!==OUTSIDE)
      return res.status(409).json({message:'Volvé al exterior para usar esta acción.'});
    req.actor=actor;req.holodeckSession=session;next();
  }));
  function reviewCharacter(actor,type,input){
    if(!inScope(actor,CHARACTER_STUDIO))return {status:403};
    if(!poseReview)return {status:503};
    if(type==='character-review.current'&&Object.keys(input).length===0)return poseReview.presented();
    if(type==='character-review.focus')return poseReview.present(actor,input);
    if(type==='character-review.notes'&&Object.keys(input).join(',')==='pose')return poseReview.forPose(input.pose);
    if(type==='character-review.add-note')return poseReview.add(actor,input);
    return {status:400};
  }
  function reviewResponse(req,res,type,input){
    const {status,...result}=reviewCharacter(req.actor,type,input);
    if(status!==200)return res.sendStatus(status);
    return res.json(result);
  }
  app.get(route('api/space/character-pose-review'),(req,res)=>reviewResponse(req,res,'character-review.notes',{pose:{
    rig:req.query.rig,clip:req.query.clip,edition:req.query.edition,
    frame:/^(0|[1-9][0-9]{0,5})$/.test(req.query.frame??'')?Number(req.query.frame):-1,
  }}));
  app.post(route('api/space/character-pose-review'),(req,res)=>reviewResponse(req,res,'character-review.add-note',req.body));
  app.get(route('api/space/character-presentation'),(req,res)=>reviewResponse(req,res,'character-review.current',{}));
  app.post(route('api/space/character-presentation'),(req,res)=>reviewResponse(req,res,'character-review.focus',req.body));
  app.post(route('api/space/matter-look'),(req,res)=>{
    const actor=req.actor;
    if(!collection?.art||!inScope(actor,collection.room))return res.sendStatus(404);
    const input=req.body;
    if(!input||Object.keys(input).join(',')!=='style'||!matterArt?.roomLooks?.hasLook(input.style))
      return res.sendStatus(400);
    if(lookPreferencesUnavailable)return res.sendStatus(503);
    const key=lookReaderKey(actor);
    if(roomLookPreferences.get(key)===input.style)return res.status(204).end();
    const next=new Map(roomLookPreferences).set(key,input.style);
    try{lookStore?.save([...next]);}
    catch(error){
      if(error.commitUncertain)lookPreferencesUnavailable=true;
      return res.sendStatus(503);
    }
    roomLookPreferences=next;
    res.status(204).end();
  });
  app.get(route('api/appearance'),(req,res)=>{
    if(req.actor.kind!=='human')return res.sendStatus(403);
    res.json({choice:avatars.preference(req.actor)});
  });
  app.post(route('api/appearance'),(req,res)=>{
    const actor=req.actor;
    if(actor.kind!=='human')return res.sendStatus(403);
    if(avatarChoicesUnavailable)return res.status(503).json({message:'La apariencia no se puede guardar en este momento.'});
    const input=req.body;
    try{
      if(!input||Object.keys(input).length!==1||!Object.hasOwn(input,'choice')||!avatars.choose(actor,input.choice))
        return res.status(400).json({message:'Elegí una apariencia del catálogo.'});
    }catch(error){
      if(error.commitUncertain)avatarChoicesUnavailable=true;
      return res.status(503).json({message:'La apariencia no se pudo confirmar. Volvé a abrir el selector para comprobarla.'});
    }
    const profile=avatarProfile(actor);
    for(const session of sessions.values()){
      if(session.actor.id===actor.id&&session.connection!==null)
        network.userNetworkingServer.updateUserCharacterDescription(session.connection,profile);
    }
    for(const cell of cellTransports.values()){
      for(const [connection,peer] of cell.connections){
        if(peer.actor.id===actor.id)cell.network.userNetworkingServer.updateUserCharacterDescription(connection,profile);
      }
    }
    res.json({choice:avatars.preference(actor)});
  });
  app.get(route('api/space/art/:revision'),(req,res)=>{
    const id=spaces.current(req.actor);
    const selected=spaces.rooms.get(id);
    if(!selected||!inScope(req.actor,id))return res.sendStatus(404);
    const passages=spaces.passages(req.actor,selected);
    const main=artForRoom(selected,passages);
    if(main?.floorSplat?.revision===req.params.revision)
      return res.type('application/octet-stream').send(main.floorSplat.bytes);
    const map=main?.roomLooks?.files.get(req.params.revision);
    if(map)return res.type(map.type).send(map.bytes);
    const art=main?.revision===req.params.revision ? main :
      passages.map(passage=>atelier?.passageFitting(selected,passage,main))
        .find(fitting=>fitting?.revision===req.params.revision);
    if(!art)return res.sendStatus(404);
    if(art.packed)return sendPackedArt(req,res,art);
    res.type('model/gltf-binary').send(art.bytes);
  });
  app.get(route('api/space/garden'),(req,res)=>{
    if(spaces.fenced||room.commitUncertain)return res.sendStatus(503);
    const {room:id,result:command}=req.query;
    if(typeof id!=='string'||id===OUTSIDE||!inScope(req.actor,id))return res.sendStatus(404);
    const value=command===undefined?(lightExercise?indoorGardens.view(req.actor,id):null):indoorGardens.result(req.actor,command);
    if(command!==undefined&&value?.room!==id)return res.sendStatus(404);
    res.json(value);
  });
  async function gardenEditor(req,id){
    const actor=req.actor;
    if(!projectionHealthy||typeof id!=='string'||actor.kind!=='human'||!inScope(actor,id)||!native?.conversationSurface)return null;
    const grant=gardenEditors.grant(actor,id);
    if(!grant)return null;
    const pair=await native.conversationSurface(actor).catch(()=>null);
    if(pair?.schema!=='holodeck.conversation-surface/v1'||pair.actorRef!==actor.ref||
       pair.beingRef!==indoorGardens.owner(id))return null;
    const current=await currentActor(req,req.holodeckSession);
    return projectionHealthy&&inScope(current,id)&&gardenEditors.grant(current,id)===grant?current:null;
  }
  app.get(route('api/space/garden-editor'),asyncRoute(async(req,res)=>{
    const id=req.query.room;
    if(!lightExercise||!await gardenEditor(req,id))return res.sendStatus(403);
    const current=indoorGardens.current(id);
    res.json({room:id,garden:current?{room:id,title:current.title,revision:current.revision,play:current.play}:null,
      templates:indoorGardenTemplates()});
  }));
  app.post(route('api/space/garden'),asyncRoute(async(req,res)=>{
    if(spaces.fenced||room.commitUncertain)return res.sendStatus(503);
    const input=req.body;
    const editor=input?.type==='garden.put'?await gardenEditor(req,input.room):null;
    if(input?.type==='garden.put'&&!editor)return res.sendStatus(403);
    const result=editor?indoorGarden(editor,input,true):
      input?.type==='garden.signal'?indoorGarden(req.actor,input):null;
    if(!result)return res.status(409).json({message:'La señal no se pudo colocar. Revisá el jardín actual.'});
    res.json(result);
  }));
  function withRepresentative(edition){
    const model=representatives.get(edition.resource+':'+edition.version);
    return model?{...edition,representative:{sha256:model.sha256,scene:model.scene}}:edition;
  }
  async function canRestoreCollection(actor){
    if(!actor.rights?.includes('edit')||!archiveStore||archiveUnavailable)
      return false;
    const owner=houses.directory().find(house=>house.id===spaces.rooms.get(collection.room)?.house)?.owner;
    if(!owner)return false;
    if(actor.kind==='daimon')return owner===actor.id;
    if(actor.kind!=='human'||!native?.conversationSurface)return false;
    const pair=await native.conversationSurface(actor).catch(()=>null);
    return pair?.schema==='holodeck.conversation-surface/v1'&&pair.actorRef===actor.ref&&pair.beingRef===owner;
  }
  app.get(route('api/space/collection'),asyncRoute(async(req,res)=>{
    if(!collection||!inScope(req.actor,collection.room))return res.sendStatus(404);
    const session=req.holodeckSession;
    const projection=await readCollection(req.headers.cookie,collection);
    const mayCurate=projection?.archive.length&&await canRestoreCollection(req.actor);
    const actor=await currentActor(req,session);
    if(!inScope(actor,collection.room))return res.sendStatus(404);
    if(projection===null)return res.status(503).json({message:'La colección no está disponible en este momento.'});
    const art=artForRoom(spaces.rooms.get(collection.room));
    const projects=projection.projects.map(project=>({...project,editions:project.editions.map(withRepresentative),
      ...(art?.shelves?{anchor:art.shelves[project.shelf]}:{})}));
    const current=new Set(projects.flatMap(project=>project.editions.map(edition=>edition.resource+':'+edition.version)));
    const visibleArchive=projection.archive.map(withRepresentative);
    const archive=visibleArchive.filter(edition=>!current.has(pinKey(edition))&&!shelfSlots.has(pinKey(edition)));
    const restored=visibleArchive.flatMap(edition=>{
      const slot=shelfSlots.get(pinKey(edition));
      const shelf=slot+baseShelves,anchor=art?.shelves?.[shelf];
      if(!anchor||current.has(pinKey(edition)))return [];
      const canArchive=mayCurate&&actor.rights.includes('edit')&&!archiveUnavailable;
      return [{id:'restored:'+slot,shelf,anchor,restored:true,...(canArchive?{canArchive}:{}),
        editions:[{...edition,title:edition.label}]}];
    });
    const selectedEdition=table.edition&&restored.some(project=>pinKey(project.editions[0])===pinKey(table.edition));
    const currentResource=projects.some(project=>project.editions.some(edition=>edition.resource===table.resource));
    const worktable=collection.art?{
      revision:table.revision,resource:currentResource?table.resource:null,
      ...(selectedEdition?table.edition:{}),canShare:!tableUnavailable&&actor.rights.includes('edit'),
    }:null;
    const canRestore=!!(archive.length&&mayCurate&&actor.rights.includes('edit')&&!archiveUnavailable&&availableSlot()!==undefined);
    res.json({room:collection.room,projects:[...projects,...restored],...(worktable?{worktable}:{}),
      ...(collection.archive&&art?.archive?{archive:{anchor:art.archive,editions:archive,...(canRestore?{canRestore}:{})}}:{})});
  }));
  app.post(route('api/space/avatar-pose'),(req,res)=>{
    const input=req.body;
    if(!input||Object.keys(input).sort().join(',')!=='connection,pose,revision,space'||
       !poseConnection(input.connection)||!avatarPoseModes.has(input.pose)||
       !Number.isSafeInteger(input.revision)||input.revision<1||
       typeof input.space!=='string'||input.space.length>96)return res.sendStatus(400);
    const scope=spaces.current(req.actor);
    if(input.space!==scope||!inScope(req.actor,scope))return res.sendStatus(409);
    if(input.pose==='fly'&&scope!==OUTSIDE||input.pose==='table'&&scope!==CHARACTER_STUDIO)return res.sendStatus(400);
    const proof=req.get('X-Holodeck-Pose-Proof');
    const peer=posePeers(scope)?.get(input.connection);
    // The HTTP cookie proves the actor. The signed fields prove the exact
    // authenticated MML tab without placing its session token on this route.
    if(!peer||peer.session.actor.id!==req.actor.id||!canReadPose(peer,scope)||
       !/^[a-f0-9]{64}$/.test(proof??''))return res.sendStatus(409);
    const expected=createHmac('sha256',peer.poseKey).update(poseProofMessage(input)).digest();
    if(!timingSafeEqual(expected,Buffer.from(proof,'hex')))return res.sendStatus(409);
    if(input.revision>(peer.poseRevision??0)){
      const previous=peer.pose??'ground';
      peer.poseRevision=input.revision;
      peer.pose=input.pose;
      if(previous!==input.pose)fanOutPose(scope,input.connection,input.pose);
      const poses=[...posePeers(scope)].filter(([,entry])=>entry.pose&&entry.pose!=='ground'&&canReadPose(entry,scope))
        .map(([id,entry])=>[id,entry.pose]);
      sendPose(scope,input.connection,{poses});
    }
    return res.status(204).end();
  });
  // This stream carries only a refresh hint. Catalog and geometry are separately authorized.
  app.get(route('api/space/collection/events'),(req,res)=>{
    if(!collection?.art||!inScope(req.actor,collection.room))return res.sendStatus(404);
    if(collectionStreams.size>=LIMITS.sessions)return res.sendStatus(503);
    res.set({'Content-Type':'text/event-stream','X-Accel-Buffering':'no'});
    res.flushHeaders();
    res.write(': ready\n\nevent: tabletop\ndata: '+tabletopSnapshot()+'\n\n');
    const timer=setTimeout(()=>res.end(),25000);
    collectionStreams.set(res,req.holodeckSession);
    res.on('close',()=>{clearTimeout(timer);collectionStreams.delete(res);});
  });
  app.post(route('api/space/collection/tabletop-presence'),(req,res)=>{
    if(!collection?.art||!inScope(req.actor,collection.room))return res.sendStatus(404);
    const input=req.body;
    if(!input||Object.keys(input).sort().join(',')!=='active,connection,revision'||
       typeof input.active!=='boolean'||!Number.isSafeInteger(input.connection)||input.connection<0||
       !Number.isSafeInteger(input.revision)||input.revision<1)return res.sendStatus(400);
    const peer=cellTransports.get(collection.room)?.connections.get(input.connection);
    // Each tab owns a socket, but all tabs of one actor share the HTTP cookie.
    if(peer?.session.actor.id!==req.actor.id)return res.sendStatus(409);
    if(input.revision>(peer.tabletopRevision??0)){
      peer.tabletopRevision=input.revision;
      if(Boolean(peer.tabletop)!==input.active){
        peer.tabletop=input.active;
        broadcastTabletop();
      }
    }
    res.status(204).end();
  });
  app.post(route('api/space/collection/pointing'),asyncRoute(async(req,res)=>{
    const scope=collection?.room;
    if(!collection?.art||!inScope(req.actor,scope))return res.sendStatus(404);
    const input=req.body;
    if(!input||Object.keys(input).sort().join(',')!=='connection,reference,revision,sequence'||
       !validTabletopPoint(input))return res.sendStatus(400);
    const {connection,reference,revision,sequence}=input;
    const peers=posePeers(scope),peer=peers?.get(connection),proof=req.get('X-Holodeck-Pose-Proof');
    const currentTable=table;
    const matches=()=>!tableUnavailable&&table===currentTable&&revision===table.revision&&
      (table.edition?pinKey(table.edition)===pinKey(reference)&&!!restoredPin(reference):
        table.resource===reference.resource&&tableResources.has(reference.resource));
    const senderCurrent=()=>peers?.get(connection)===peer&&peer?.tabletop&&
      peer.session.actor.id===req.actor.id&&canReadPose(peer,scope);
    if(!senderCurrent()||!matches()||!proof||!/^[a-f0-9]{64}$/.test(proof))return res.sendStatus(409);
    const expected=createHmac('sha256',peer.poseKey).update(tabletopPointProofMessage(scope,input)).digest();
    if(!timingSafeEqual(expected,Buffer.from(proof,'hex')))return res.sendStatus(409);
    if(sequence<=(peer.pointSequence??0))return res.sendStatus(409);
    // Home reads are bounded to one in-flight indication per connection.
    if(peer.pointPending)return res.sendStatus(429);
    peer.pointPending=true;
    try{
      peer.pointSequence=sequence;
      const senderStillCurrent=()=>senderCurrent()&&matches()&&peer.pointSequence===sequence;
      const selection=table.edition?{projects:[],archive:[table.edition]}:
        {projects:[{id:'worktable',resources:[reference.resource]}]};
      async function hasEdition(cookie){
        const visible=await readCollection(cookie,selection);
        const edition=currentTable.edition?visible?.archive[0]:visible?.projects[0]?.editions[0];
        return edition?.resource===reference.resource&&edition.version===reference.version;
      }
      const confirmed=await readTableReference(req.headers.cookie,reference,{current:!currentTable.edition});
      if(!confirmed)return res.sendStatus(404);
      const actor=await currentActor(req,req.holodeckSession);
      if(res.destroyed||!inScope(actor,scope)||!senderStillCurrent())return res.sendStatus(409);
      const deadline=Date.now()+tabletopPointDuration;
      // Table admission alone never grants a reader access to an artifact.
      const payload={connection,reference,revision,sequence,space:scope};
      const message=serializeServerBroadcastMessage({broadcastType:tabletopPointBroadcast,payload});
      const transport=poseNetwork(scope)?.userNetworkingServer;
      let delivered=false;
      await Promise.all([...peers].map(async ([id,recipient])=>{
        const session=recipient.accessSession;
        const eligible=()=>recipient.tabletop&&peers.get(id)===recipient&&
          Date.now()-recipient.session.created<SESSION_MS&&canReadPose({session},scope);
        if(id===connection||!eligible())return;
        const reader=await currentActor({method:'GET',headers:{cookie:session.sourceCookie}},session).catch(()=>null);
        if(!inScope(reader,scope)||!eligible()||!await hasEdition(session.sourceCookie))return;
        if(res.destroyed||Date.now()>=deadline||!senderStillCurrent()||!eligible())return;
        try{
          transport?.sendCustomMessageToClient(id,FROM_SERVER_BROADCAST_MESSAGE_TYPE,message);
          delivered=true;
        }catch{/* The presence socket may have closed during delivery. */}
      }));
      if(!delivered&&!senderStillCurrent())return res.sendStatus(409);
      res.status(204).end();
    }finally{peer.pointPending=false;}
  }));
  app.post(route('api/space/collection'),asyncRoute(async(req,res)=>{
    if(!collection?.art||!inScope(req.actor,collection.room))return res.sendStatus(404);
    if(!req.actor.rights.includes('edit'))return res.sendStatus(403);
    if(tableUnavailable)return res.sendStatus(503);
    const input=req.body;
    const fields=input&&Object.keys(input).sort().join(',');
    if(!['resource,revision','resource,revision,version'].includes(fields)||
       !Number.isSafeInteger(input.revision)||input.revision<0)return res.sendStatus(400);
    const {resource,version}=input;
    const exact=fields==='resource,revision,version';
    if(exact&&(typeof resource!=='string'||!/^[a-f0-9]{32}$/.test(resource)||typeof version!=='string'||!/^[a-f0-9]{64}$/.test(version))||
       !exact&&resource!==null&&!tableResources.has(resource))return res.sendStatus(400);
    const pin=exact?restoredPin(input):null;
    if(exact&&!pin)return res.sendStatus(404);
    if(resource!==null){
      const selection=pin?{projects:[],archive:[pin]}:{projects:[{id:'worktable',resources:[resource]}]};
      const source=await readCollection(req.headers.cookie,selection);
      if(!(pin?source?.archive.length:source?.projects.length))return res.sendStatus(404);
    }
    const actor=await currentActor(req,req.holodeckSession);
    if(!inScope(actor,collection.room))return res.sendStatus(404);
    if(!actor.rights.includes('edit'))return res.sendStatus(403);
    if(tableUnavailable)return res.sendStatus(503);
    if(input.revision!==table.revision)return res.sendStatus(409);
    if(pin&&!restoredPin(pin))return res.sendStatus(404);
    const unchanged=pin?table.edition&&pinKey(table.edition)===pinKey(pin):!table.edition&&resource===table.resource;
    if(!unchanged){
      // Older readers see an empty table for a pinned edition and retain its
      // checkpoint. They never silently follow the latest edition of that model.
      const next={room:collection.room,revision:table.revision+1,resource:pin?null:resource,
        ...(pin?{edition:{resource,version}}:{})};
      try{tableStore?.save(next);}
      catch(error){
        if(error.commitUncertain)tableUnavailable=true;
        return res.sendStatus(503);
      }
      table=next;
      invalidateCollection();
    }
    res.sendStatus(204);
  }));
  app.post(route('api/space/collection/archive'),asyncRoute(async(req,res)=>{
    if(!collection?.art||!inScope(req.actor,collection.room))return res.sendStatus(404);
    const input=req.body;
    const fields=input&&Object.keys(input).sort().join(',');
    const rearchive=fields==='action,resource,version'&&input.action==='rearchive';
    if((fields!=='resource,version'&&!rearchive)||
       typeof input.resource!=='string'||typeof input.version!=='string')return res.sendStatus(400);
    const pin=collection.archive?.find(item=>item.resource===input.resource&&item.version===input.version);
    if(!pin)return res.sendStatus(404);
    const key=pinKey(pin);
    if(!req.actor.rights.includes('edit')||!archiveStore)return res.sendStatus(403);
    const scope=collection.projects.filter(project=>project.resources.includes(pin.resource));
    const projection=await readCollection(req.headers.cookie,{projects:scope,archive:[pin]});
    if(!await canRestoreCollection(req.actor))return res.sendStatus(403);
    const actor=await currentActor(req,req.holodeckSession);
    if(!inScope(actor,collection.room))return res.sendStatus(404);
    if(!actor.rights.includes('edit'))return res.sendStatus(403);
    if(!projection?.archive.length)return res.sendStatus(404);
    if(archiveUnavailable)return res.sendStatus(503);
    const next=new Map(shelfSlots);
    if(rearchive){
      if(!next.has(key))return res.sendStatus(204);
      if(tableUnavailable)return res.sendStatus(503);
      if(table.edition&&pinKey(table.edition)===key)return res.status(409).json({reason:'shared-worktable'});
      next.delete(key);
    }else{
      if(projection.projects.some(project=>project.editions.some(edition=>pinKey(edition)===key)))return res.sendStatus(409);
      if(next.has(key))return res.sendStatus(204);
      const free=availableSlot();
      if(free===undefined)return res.sendStatus(409);
      next.set(key,free);
    }
    const nextSlots=[...next.values()];
    const dense=nextSlots.every((slot,index)=>slot===index);
    try{archiveStore.save({room:collection.room,placed:[...next.keys()],...(dense?{}:{shelfSlots:nextSlots})});}
    catch(error){
      if(error.commitUncertain)archiveUnavailable=true;
      return res.sendStatus(503);
    }
    shelfSlots=next;
    invalidateCollection();
    res.sendStatus(204);
  }));
  app.get(route('api/space/collection-model/:resource/:version'),asyncRoute(async(req,res)=>{
    if(!collection||!inScope(req.actor,collection.room))return res.sendStatus(404);
    const {resource,version}=req.params;
    const model=representatives.get(resource+':'+version);
    if(!model)return res.sendStatus(404);
    const pin=collection.archive?.find(item=>item.resource===resource&&item.version===version);
    const onShelf=collection.projects.some(project=>project.resources.includes(resource));
    const projection=await readCollection(req.headers.cookie,{
      projects:onShelf?[{id:'model',resources:[resource]}]:[],archive:pin?[pin]:[],
    });
    const current=projection?.projects[0]?.editions[0]?.version===version;
    if(!(current||projection?.archive.length)||!inScope(await currentActor(req,req.holodeckSession),collection.room))
      return res.sendStatus(404);
    res.type('model/gltf-binary').send(model.bytes);
  }));
  app.get(route('api/space/content-visits'),asyncRoute(async(req,res)=>{
    if(spaces.fenced||room.commitUncertain||exhibits.fenced)return res.status(503).json({message:'No pude recuperar la exposición.'});
    const active=spaces.current(req.actor);
    if(active===OUTSIDE)return res.status(404).json({message:'Entrá a la sala para visitar su contenido.'});
    const isGallery=active===gallery?.room;
    const currentEntries=()=>{
      if(Date.now()-req.holodeckSession.created>=SESSION_MS||
         !inScope(req.holodeckSession.actor,active)||spaces.fenced||room.commitUncertain||exhibits.fenced)return [];
      return interiorVisits(req.actor,active);
    };
    const visits=await allowedGalleryVisits({entries:currentEntries(),currentEntries,
      authorize:pin=>authorizeRoomVisit?.(req.headers.cookie,pin,{details:true})});
    if(!isGallery)return res.json({revalidate:true,visits});
    res.json({gallery:inScope(req.actor,active),visits:visits.map(entry=>{
      const display=Object.hasOwn(GALLERY_STAGES,entry.id)&&entry.pin.kind==='artifact_review'&&entry.pin.adapter==='interactive_3d';
      return display?{...entry,title:GALLERY_STAGES[entry.id].title,galleryDisplay:true}:entry;
    })});
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
    if(room.commitUncertain||spaces.fenced)return res.status(503).json({message:'Holodeck necesita recuperar su último cambio antes de continuar.'});
    const canEdit=projectionHealthy&&['observe','edit'].every(right=>req.actor.rights?.includes(right));
    res.json({run:room.run,edition:room.edition,sequence:room.sequence,actorRef:req.actor.id,canEdit:!singleHouse&&canEdit,lightExercise:lightExercise&&!singleHouse,layout:publicWorld,entities:singleHouse?{}:room.entities,
      focus:singleHouse?[]:room.focusState(),nodes:singleHouse?{}:room.nodeState(),entrances:exteriorEntrances(req.actor),
      native:native?{...await native.availability(req.actor),sharedConversation:!!native.contexts}:{available:false}});
  }));
  app.get(route('api/places'),(req,res)=>{
    if(room.commitUncertain)return res.status(503).json({message:'El taller necesita recuperar su último cambio.'});
    res.json({world:publicWorld,houses:room.houses.directory().filter(outdoorHouse)});
  });
  app.get(route('api/places/:id'),(req,res)=>{
    if(room.commitUncertain)return res.status(503).json({message:'El taller necesita recuperar su último cambio.'});
    const house=room.houses.directory().find(place=>place.id===req.params.id&&outdoorHouse(place));
    if(!house)return res.status(404).json({message:'No encontré esa casa.'});
    res.json({world:publicWorld,house});
  });
  app.get(route('api/activity'),(req,res)=>{
    try{res.json(readActivity(room,req.actor,req.query));}
    catch(error){if(!(error instanceof ActivityError))throw error;
      res.status(error.status).json({code:error.code,message:error.message,...(error.code==='stale-run'?{run:room.run}:{})});}
  });
  app.get(route('api/content-visits'),(req,res)=>res.json(singleHouse?{nodes:[],visits:[]}:{nodes:selectedContentNodes,visits:[...visitsForActor(selectedContentVisits,req.actor),...nodeVisits(room.nodes,req.actor)]}));
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
    if(requireContext(req,res))res.json(await native.contexts.prepare(req.actor,req.body,
      (actor,request)=>captureConversationPlace(actor,request,req.headers.cookie,
        ()=>currentActor(req,req.holodeckSession))));
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
  return {app,room,native,spaces,close(){for(const res of collectionStreams.keys())res.end();if(authorizationTimer)clearInterval(authorizationTimer);for(const socket of sockets.keys())socket.close(1001);for(const port of installedWorldPorts)port.close();network.dispose();document.dispose();arrivalDocument?.dispose();for(const cell of cellTransports.values()){cell.network.dispose();}}};
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
  const nativeReviewAuthority=nativeRoomAuthority?createNativeReviewAuthority(receiving.authoritySocket):null;
  const runtime=await createHolodeck({production,stateDir,basePath:receiving?.basePath||'/',publicOrigin:receiving?.origin,identityResolver:resolver,nativeFactory,worldSocket:receiving?.worldSocket,worldSocketBeingRef:receiving?.worldSocketBeingRef,worldPorts:receiving?.worldPorts,nativeReviewAuthority,contentVisits:receiving?.contentVisits,contentNodes:receiving?.contentNodes,nativeRoomAuthority,conversationOrigins:receiving?.conversationOrigins||[],ownNative:receiving?.ownNative??false,interiorSpaces:receiving?.interiorSpaces??[],gallerySelection:receiving?.gallery,matterCollection:selectMatterAppearance(receiving),artProfile:receiving?.artProfile,worldTerrain:receiving?.worldTerrain});
  const port=Number(process.env.PORT||18940);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Select a valid loopback port');
  if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('Use the existing loopback gateway');
  const listener=runtime.app.listen(port,'127.0.0.1',()=>console.log('Holodeck receiver listening on loopback port '+port));
  const close=()=>{listener.close();runtime.close();};
  process.once('SIGINT',()=>{close();process.exit(0);});process.once('SIGTERM',()=>{close();process.exit(0);});
  return {runtime,listener};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
