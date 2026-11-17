import express from 'express';
import { Networked3dWebExperienceServer } from '@mml-io/3d-web-experience-server';
import { EditableNetworkedDOM, LocalObservableDOMFactory, NetworkedDOM } from '@mml-io/networked-dom-server';
import { handleExperienceWebsocketSubprotocol } from '@mml-io/3d-web-experience-protocol';
import enableWs from 'express-ws';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Room, RoomError, LIMITS } from './room.mjs';
import { worldDocument } from './world.mjs';

const app = express();
enableWs(app,undefined,{wsOptions:{handleProtocols:(protocols,req)=>
  req.url?.split('?')[0]==='/world' ? NetworkedDOM.handleWebsocketSubprotocol(protocols) : handleExperienceWebsocketSubprotocol(protocols)}});
const room = new Room();
const document = new EditableNetworkedDOM('http://localhost/world', LocalObservableDOMFactory);
document.load(worldDocument(room));
let projectionHealthy=true;
room.on('change',()=>{
  try{document.load(worldDocument(room));projectionHealthy=true;}
  catch{projectionHealthy=false;}
});
// Explicit local harness: never use anonymous actors in a shared deployment.
const sessions = new Map();
let nextId=0;
const auth = {
async generateAuthorizedSessionToken() {
  for(const [token,s] of sessions) if(Date.now()-s.created > 1800000) sessions.delete(token);
  if(sessions.size>=LIMITS.sessions) {
    const inactive=[...sessions].find(([,session])=>session.connection===null);
    if(inactive)sessions.delete(inactive[0]);
    else return null;
  }
  const token=randomBytes(20).toString('hex'),id=++nextId;
  const actor = { id:`local-${id}`,kind:'human',rights:['observe','edit','project'] };
  sessions.set(token,{ id,actor,created:Date.now(),times:[],connection:null });
  return token;
},
getClientIdForSessionToken(token){const s=sessions.get(token);return s?{id:s.id}:null;},
onClientConnect(connection,token){
  const s=sessions.get(token);
  if(!s || s.connection!==null)return new Error('Local session unavailable');
  s.connection=connection;
  return {userId:s.actor.id,username:`Explorador ${s.id}`,characterDescription:{meshFileUrl:'/assets/avatar-1-bodyA-skin01.glb'},colors:null};
},
onClientDisconnect(connection){for(const s of sessions.values())if(s.connection===connection)s.connection=null;},
onClientUserIdentityUpdate(){return false;}
};
const server = new Networked3dWebExperienceServer({
  networkPath:'/network',userAuthenticator:auth,
  webClientServing:{indexUrl:'/',indexContent:readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),
    clientBuildDir:new URL('../build',import.meta.url).pathname,clientUrl:'/client/'},
  assetServing:{ assetsDir:new URL('../public/assets',import.meta.url).pathname,assetsUrl:'/assets/' },
  worldConfig:{ mmlDocuments:{workshop:{url:'ws:///world'}},enableChat:false,
    environmentConfiguration:{groundPlane:false,sun:{intensity:2.2},ambientLight:{intensity:1.5},
      fog:{fogNear:35,fogFar:100,fogColor:{r:.61,g:.73,b:.77}}},
    avatarConfiguration:{allowCustomAvatars:false},allowCustomDisplayName:false,
    allowOrbitalCamera:true,spawnConfiguration:{spawnPosition:{x:0,y:1,z:6}},hud:{respawnButton:true} }
});
app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.use(express.json({limit:'8kb',strict:true}));
server.registerExpressRoutes(app);
app.get('/health',(_req,res)=>res.status(projectionHealthy?200:503).json({ok:projectionHealthy}));
app.ws('/world',(ws,req)=>{
  // Same local token gate for the geometry stream; no independent writable DOM.
  const token=req.headers.cookie?.match(/(?:^|; )holodeck_dev=([a-f0-9]{40})(?:;|$)/)?.[1];
  if(!sessions.has(token)){ws.close(1008);return;}
  document.addWebSocket(ws);
  ws.on('close',()=>document.removeWebSocket(ws));
});
app.use('/api',(req,res,next)=>{
  const token=req.headers.authorization?.replace(/^Bearer /,'');
  const session=sessions.get(token);
  if(!session || Date.now()-session.created>1800000) return res.status(401).json({message:'Volvé a entrar al taller.'});
  if(req.method==='POST') {
    // Loopback CSRF defense; local tokens are never query parameters.
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return res.sendStatus(403);
    const now=Date.now();session.times=session.times.filter(time=>now-time<1000);
    if(session.times.length>=4)return res.status(429).json({message:'Esperá un momento antes de intentar otra acción.'});
    session.times.push(now);
  }
  req.actor=session.actor;next();
});
app.get('/api/state',(_req,res)=>res.json({run:room.run,edition:room.edition,sequence:room.sequence,entities:room.entities}));
app.post('/api/observe',(req,res)=>res.json(room.observe(req.actor,req.body)));
app.post('/api/commands',(req,res)=>{
  const result=room.command(req.actor,req.body);
  res.json(result);
});
app.get('/api/commands/:id',(req,res)=>{
  const result=room.result(req.actor,req.params.id);
  if(!result)return res.status(404).json({message:'Todavía no hay un resultado confirmado.'});
  res.json(result);
});
app.post('/api/projection',(req,res)=>{
  const result=room.project(req.actor,req.body);res.json(result);
});
app.use((error,_req,res,_next)=>{
  const known=error instanceof RoomError;
  res.status(known ? 409 : error.type==='entity.too.large' ? 413 : 400).json({message:known?error.message:'No pudimos interpretar esa acción.'});
});
// The prototype cannot be exposed by setting a host environment variable.
const listener=app.listen(18940,'127.0.0.1',()=>console.log('Holodeck local foundation: http://127.0.0.1:18940'));
function close(){listener.close();server.dispose();document.dispose();}
process.once('SIGINT',()=>{close();process.exit(0);});
process.once('SIGTERM',()=>{close();process.exit(0);});
