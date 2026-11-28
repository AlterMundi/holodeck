import {showRoomMap} from './room-map.mjs';

const base=()=>new URL('./',document.baseURI);
const DOOR_RANGE=1.65;
const STAIR_RANGE=.85;
const PORTAL_RANGE=.90;
let doorOfferRevision=0;

export function indoorDoorLabelAnchor(door,kind){
  if(!door)return null;
  const heading=(door.yaw??0)*Math.PI/180;
  const setback=kind==='door'?.58:0;
  return {
    x:door.x+Math.sin(heading)*setback,
    y:door.y+(kind==='door'?1.05:.62),
    z:door.z+Math.cos(heading)*setback,
  };
}

export async function readSpace(signal){
  const result=await fetch(new URL('api/space?live=1',base()),{credentials:'same-origin',signal});
  if(!result.ok)throw Error('No pude confirmar el lugar.');
  return result.json();
}

// MML's fourteen-value location format holds the avatar and camera transforms.
export function doorLocation({x,y,z,facing,yaw=facing*90,doorway=false}) {
  const rotation=yaw*Math.PI/180, s=Math.sin(rotation/2), c=Math.cos(rotation/2);
  const boom=doorway ? .52 : 2.7;
  return [x,y,z,0,s,0,c,x-Math.sin(rotation)*boom,y+1.7,z-Math.cos(rotation)*boom,0,s,0,c].join(',');
}

export function arrivalDoor(from,next){
  if(next.id===from.id)return null;
  if(next.topic&&next.exitDoor)return {x:0,y:.11,z:4,yaw:180};
  if(next.id==='outside')return from.exteriorDoor??null;
  if(from.id==='outside'){
    if(next.entryLanding)return next.entryLanding;
    const door=next.exitDoor;
    // Keep the landing inside the threshold, looking into the room.
    return door?{x:door.x,y:door.y,z:door.z-.9,yaw:180,doorway:true}:null;
  }
  const passage=next.exits.find(exit=>exit.to===from.id);
  if(passage?.landing)return {...passage.landing,doorway:true};
  const door=passage?.door;
  // The offer faces the doorway. Arrival uses the opposite heading so
  // walking continues into the destination instead of toward the return.
  return ['door','portal'].includes(passage?.kind)&&Number.isFinite(door?.yaw)?
    {...door,yaw:(door.yaw+180)%360,doorway:true}:door??null;
}

export function showSpaceLinks(space,{canLeave=()=>true,onError,onMoved,onArrival,onMoving,revision,onNear,onAccessLost,onDoorDenied,
  mapEnabled=true,manageShortcut=true,allowWithConversation=()=>false}){
  const travel=document.querySelector('#space-travel'),button=document.querySelector('#house-door');
  const inside=space.id!=='outside';
  const doors=inside
    ? [...space.exits.map(exit=>({...exit,mapTitle:exit.title,title:(exit.kind==='portal'?'Cruzar portal · ':
        exit.kind==='stair'?(exit.rise<0?'Bajar · ':'Subir · '):'Ir a · ')+exit.title})),
        ...(space.exitDoor?[space.topic
          ? {to:space.returnTo,mapTitle:'Volver al lugar anterior',title:'Volver al lugar anterior',door:space.exitDoor}
          : {to:'outside',mapTitle:'Salida al exterior',title:'Salir al exterior',door:space.exitDoor}]:[])]
    : space.entrances.map(entrance=>({to:entrance.id,title:'Entrar · '+entrance.title,door:entrance.door}));
  const list=travel.querySelector('nav');
  list.setAttribute('aria-label',space.topic?'Regreso al lugar anterior':'Regreso al exterior');
  const map=inside&&mapEnabled?showRoomMap(travel,doors):null;
  let near=null,busy=false,suspended=false,nearRevision=0;
  const doorCovered=()=>travel.open||document.querySelector(
    'dialog[open],.room-transition,.is-operating-matter,#world-entry:not([hidden]),'+
    '#creator:not([hidden]),#signal-editor:not([hidden]),#content-visit:not([hidden]):not(.is-walking)')||
    !allowWithConversation()&&document.querySelector('#conversation-panel:not([hidden])');
  async function move(destination,proximityRevision,jump=false) {
    if(busy||suspended)return;
    busy=true;
    try{if(!await canLeave()){busy=false;return;}}
    catch{busy=false;onError('No pude comprobar el estado de la visita.');return;}
    if(suspended||(proximityRevision!==undefined&&(near!==destination||nearRevision!==proximityRevision||doorCovered()))){
      busy=false;return;
    }
    button.disabled=true;onMoving?.(true);
    for(const control of list.children)control.disabled=true;
    let next,confirmed=false;
    try{
      const result=await fetch(new URL(jump?'api/space/jump':'api/space',base()),{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({from:space.id,to:destination.to,...(destination.node?{node:destination.node}:{}),...(onMoved||jump?{live:1,cachedRevision:revision?.(destination.to)}:{})}),
      });
      if(result.ok){next=await result.json();confirmed=true;}
      else{
        if(result.status===401||result.status===403)onAccessLost?.();
        else if(result.status===409&&!destination.node)onDoorDenied?.(destination.to);
        onError(destination.node?'Ese destino ya no está disponible.':'Esta salida no está disponible. Podés volver a intentar.');
      }
    }catch{
      try{next=await readSpace();}catch{}
      if(!next||next.id===space.id)onError('No pude confirmar el cambio de lugar.');
    }
    if(next&&(next.id!==space.id||(confirmed&&next.arrival))){
      const arrival=next.arrival??arrivalDoor(jump?{id:next.arrivalFrom??next.exits?.[0]?.to??'outside'}:space,next);
      if(destination.node&&!confirmed)onError('Cambiaste de lugar. No pude confirmar el punto de llegada.');
      if(next.id===space.id&&onArrival){
        busy=false;button.disabled=false;
        for(const control of list.children)control.disabled=false;
        onArrival(next,arrival);return;
      }
      if(onMoved&&next.live===1){onMoved(next,arrival);return;}
      const target=new URL(location.href);
      target.hash=arrival?doorLocation(arrival):'';
      history.replaceState(history.state,'',target);
      location.reload();
      return;
    }
    busy=false;button.disabled=false;onMoving?.(false);
    for(const control of list.children)control.disabled=false;
  }

  const links=[];
  if(space.topic)links.push({to:space.returnTo,title:'Volver al lugar anterior'});
  if(space.emergencyExit)links.push({to:'outside',title:'Volver al exterior'});
  const summary=travel.querySelector('summary');
  if(summary)summary.textContent=links.length?'Mapa y regreso':'Mapa';
  travel.hidden=!map&&!links.length&&typeof space.outdoorTerrain!=='string';
  const mapTool=document.querySelector('#map-tool');
  if(mapTool)mapTool.disabled=travel.hidden;
  for(const destination of links){
    const control=document.createElement('button');
    control.type='button';control.textContent=destination.title;
    control.onclick=()=>move(destination);
    list.append(control);
  }
  const doorOffer=()=>!suspended&&near&&!doorCovered()?
    {scope:space.id,revision:nearRevision,title:near.title,busy,
      anchor:inside?indoorDoorLabelAnchor(near.door,near.kind):null}:null;
  const followDoor=(scope,expectedRevision)=>{
    const offer=doorOffer();
    if(offer&&!offer.busy&&offer.scope===scope&&offer.revision===expectedRevision)return move(near,expectedRevision);
  };
  let pointerRevision,spaceRevision;
  const cancelPress=()=>{pointerRevision=spaceRevision=undefined;};
  const clickDoor=event=>{
    const revision=event.detail===0?(spaceRevision??nearRevision):pointerRevision;
    cancelPress();
    followDoor(space.id,revision);
  };
  button.onpointerdown=event=>{
    cancelPress();
    if(event.button===0)pointerRevision=doorOffer()?.revision;
  };
  button.onpointercancel=cancelPress;
  button.onblur=cancelPress;
  const buttonKey=event=>{
    if(event.repeat&&(event.key===' '||event.key==='Enter')){event.preventDefault();return;}
    if(event.key===' ')spaceRevision=doorOffer()?.revision;
    if(event.key==='Enter')spaceRevision=undefined;
  };
  button.onkeydown=buttonKey;
  button.onclick=clickDoor;
  const hotkey=event=>{
    if(event.code!=='KeyE'||event.repeat||event.isComposing||event.defaultPrevented||!doorOffer()||
       (!button.hasAttribute('data-native-door')&&!button.getClientRects().length)||
       event.altKey||event.ctrlKey||event.metaKey||
       event.composedPath().some(target=>target instanceof Element&&
         target.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])')))return;
    event.preventDefault();
    followDoor(space.id,nearRevision);
    return true;
  };
  if(manageShortcut)document.addEventListener('keydown',hotkey,true);
  const update=(position,rotation)=>{
    if(suspended)return;
    let closest=null,distance=DOOR_RANGE,nearby=null,prefetchDistance=3.75;
    if(position)for(const destination of doors){
      if(!destination.door)continue;
      const gap=Math.hypot(position.x-destination.door.x,position.z-destination.door.z);
      if(gap<prefetchDistance&&destination.to!=='outside'){nearby=destination;prefetchDistance=gap;}
      const stair=destination.kind==='stair';
      if(Math.abs(position.y-destination.door.y)>(stair ? .34 : .8))continue;
      // A portal is a deliberate approach to its floor marker. Keep its warm
      // scene prefetch, but do not offer travel from the adjacent stair aisle.
      const reach=stair?STAIR_RANGE:destination.kind==='portal'?PORTAL_RANGE:DOOR_RANGE;
      if(gap<distance&&gap<reach){closest=destination;distance=gap;}
    }
    map?.update(position,rotation,closest);
    if(nearby)onNear?.(nearby.to);
    if(closest===near)return;
    near=closest;nearRevision=++doorOfferRevision;button.hidden=!near;
    if(near)button.textContent=near.title;
  };
  update.navigation=()=>({scope:space.id,busy,canExit:!suspended&&links.length>0,map:suspended?null:map?.state()});
  update.doorOffer=doorOffer;
  update.followDoor=followDoor;
  update.jump=to=>to===space.id?false:move({to},undefined,true);
  update.teleport=({to,id})=>move({to,node:id},undefined,true);
  update.key=hotkey;
  update.buttonKey=buttonKey;
  update.bearing=()=>suspended||travel.open?null:map?.bearing();
  update.mapDismiss=id=>!suspended&&!travel.open&&map?.dismiss(id)===true;
  update.mapSelect=id=>{if(!suspended&&travel.open)map?.choose(id);};
  update.mapExit=()=>{if(!suspended&&travel.open&&links.length)void move(links[0]);};
  update.suspend=()=>{
    if(suspended)return;
    suspended=true;near=null;
    button.hidden=true;button.textContent='';travel.hidden=true;travel.open=false;
    map?.clear();
    list.replaceChildren();
  };
  update.dispose=()=>{
    update.suspend();
    if(manageShortcut)document.removeEventListener('keydown',hotkey,true);
    if(button.onclick===clickDoor){
      button.onclick=button.onpointerdown=button.onpointercancel=button.onkeydown=button.onblur=null;
    }
  };
  return update;
}
