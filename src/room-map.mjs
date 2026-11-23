const coordinate=value=>Math.round(Math.min(97,Math.max(3,(value+6)*100/12)));

function place(element,{x,z}){
  element.style.left=coordinate(x)+'%';
  element.style.top=coordinate(z)+'%';
}

export function showRoomMap(travel,doors){
  const view=travel.querySelector('.room-map');
  if(!view)return null;
  const plot=view.querySelector('.room-map-plot');
  const destinations=view.querySelector('.room-map-destinations');
  const hint=view.querySelector('.room-map-hint');
  const element=tag=>travel.ownerDocument.createElement(tag);
  const pins=[];
  let selected=null,player,position;

  function select(pin){
    selected=pin;
    for(const entry of pins){
      const active=entry===pin;
      entry.button.setAttribute('aria-pressed',String(active));
      entry.marker.toggleAttribute('data-selected',active);
    }
  }

  function clear(){
    pins.length=0;selected=null;position=null;player=null;
    plot.replaceChildren();
    destinations.replaceChildren();
    view.hidden=true;
  }

  function update(next,rotation){
    if(!player||!travel.open)return;
    const known=Number.isFinite(next?.x)&&Number.isFinite(next?.z);
    if(player.hidden===known)player.hidden=!known;
    if(!known){position=null;return;}
    const x=coordinate(next.x),z=coordinate(next.z);
    let yaw=null;
    if(rotation){
      const {x,y,z,w}=rotation();
      yaw=Math.round(Math.atan2(-2*(x*z+w*y),1-2*(x*x+y*y))*180/Math.PI/5)*5;
    }
    const stamp=x+':'+z+':'+yaw;
    if(stamp===position)return;
    position=stamp;
    place(player,next);
    player.style.setProperty('--map-heading',yaw===null?'0deg':yaw+'deg');
    player.toggleAttribute('data-heading',yaw!==null);
  }

  function show(){
    clear();
    player=element('span');player.className='room-map-player';player.hidden=true;
    plot.append(player);
    for(const door of doors){
      if(!Number.isFinite(door.door?.x)||!Number.isFinite(door.door?.z))continue;
      const marker=element('span');
      marker.className='room-map-pin';
      marker.dataset.kind=door.to==='outside'?'outside':door.kind??'door';
      place(marker,door.door);
      plot.append(marker);
      const button=element('button');
      button.type='button';
      button.textContent=door.mapTitle;
      const type=marker.dataset.kind;
      const detail=type==='stair'?(door.rise<0?', escalera hacia abajo':', escalera hacia arriba'):
        type==='portal'?', portal':'';
      button.setAttribute('aria-label','Señalar '+door.mapTitle+detail);
      button.dataset.kind=marker.dataset.kind;
      button.setAttribute('aria-pressed','false');
      const pin={marker,button};
      button.onclick=()=>select(selected===pin?null:pin);
      pins.push(pin);destinations.append(button);
    }
    if(hint)hint.hidden=!pins.length;
    view.hidden=false;
  }

  show();
  return {update,clear};
}
