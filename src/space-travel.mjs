import {showRoomMap} from './room-map.mjs';

const base=()=>new URL('./',document.baseURI);
const DOOR_RANGE=1.65;
const STAIR_RANGE=.85;
const PORTAL_RANGE=.90;

export async function readSpace(signal){
  const result=await fetch(new URL('api/space?live=1',base()),{credentials:'same-origin',signal});
  if(!result.ok)throw Error('No pude confirmar el lugar.');
  return result.json();
}

// MML's fourteen-value location format holds the avatar and camera transforms.
export function doorLocation({x,y,z,facing,yaw=facing*90}) {
  const rotation=yaw*Math.PI/180, s=Math.sin(rotation/2), c=Math.cos(rotation/2);
  return [x,y,z,0,s,0,c,x-Math.sin(rotation)*2.7,y+1.7,z-Math.cos(rotation)*2.7,0,s,0,c].join(',');
}

export function arrivalDoor(from,next){
  if(next.id===from.id)return null;
  if(next.id==='outside')return from.exteriorDoor??null;
  if(from.id==='outside'){
    const door=next.exitDoor;
    // Keep the landing inside the threshold, looking into the room.
    return door?{x:door.x,y:door.y,z:door.z-.9,yaw:180}:null;
  }
  return next.exits.find(exit=>exit.to===from.id)?.door??null;
}

export function showSpaceLinks(space,{canLeave=()=>true,onError,onMoved,onMoving,revision,onNear,onAccessLost,onDoorDenied,
  mapEnabled=true}){
  const travel=document.querySelector('#space-travel'),button=document.querySelector('#house-door');
  const inside=space.id!=='outside';
  const doors=inside
    ? [...space.exits.map(exit=>({...exit,mapTitle:exit.title,title:(exit.kind==='portal'?'Cruzar portal · ':
        exit.kind==='stair'?(exit.rise<0?'Bajar · ':'Subir · '):'Ir a · ')+exit.title})),
        ...(space.exitDoor?[{to:'outside',mapTitle:'Salida al exterior',title:'Salir al exterior',door:space.exitDoor}]:[])]
    : space.entrances.map(entrance=>({to:entrance.id,title:'Entrar · '+entrance.title,door:entrance.door}));
  const list=travel.querySelector('nav');
  const map=inside&&mapEnabled?showRoomMap(travel,doors):null;
  let near=null,busy=false,suspended=false;
  async function move(destination) {
    if(busy)return;
    busy=true;
    try{if(!await canLeave()){busy=false;return;}}
    catch{busy=false;onError('No pude comprobar el estado de la visita.');return;}
    button.disabled=true;onMoving?.(true);
    for(const control of list.children)control.disabled=true;
    let next;
    try{
      const result=await fetch(new URL('api/space',base()),{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({from:space.id,to:destination.to,...(onMoved?{live:1,cachedRevision:revision(destination.to)}:{})}),
      });
      if(result.ok)next=await result.json();
      else{
        if(result.status===401||result.status===403)onAccessLost?.();
        else if(result.status===409)onDoorDenied?.(destination.to);
        onError('Esta salida no está disponible. Podés volver a intentar.');
      }
    }catch{
      try{next=await readSpace();}catch{}
      if(!next||next.id===space.id)onError('No pude confirmar el cambio de lugar.');
    }
    if(next&&next.id!==space.id){
      const arrival=arrivalDoor(space,next);
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
  if(space.emergencyExit)links.push({to:'outside',title:'Volver al exterior'});
  const summary=travel.querySelector('summary');
  if(summary)summary.textContent=links.length?'Mapa y regreso':'Mapa';
  travel.hidden=!map&&!links.length;
  for(const destination of links){
    const control=document.createElement('button');
    control.type='button';control.textContent=destination.title;
    control.onclick=()=>move(destination);
    list.append(control);
  }
  button.onclick=()=>{if(near)move(near);};
  const hotkey=event=>{
    if(event.code!=='KeyE'||event.repeat||!near||!button.getClientRects().length||
       event.altKey||event.ctrlKey||event.metaKey||
       event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    event.preventDefault();
    move(near);
  };
  document.addEventListener('keydown',hotkey);
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
    near=closest;button.hidden=!near;
    if(near)button.textContent=near.title;
  };
  update.suspend=()=>{
    if(suspended)return;
    suspended=true;near=null;
    button.hidden=true;button.textContent='';travel.hidden=true;travel.open=false;
    map?.clear();
    list.replaceChildren();
  };
  update.dispose=()=>{
    update.suspend();
    document.removeEventListener('keydown',hotkey);
  };
  return update;
}
