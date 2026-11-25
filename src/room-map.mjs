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
  const guide=travel.ownerDocument.querySelector('#door-guidance');
  const guideTitle=guide.querySelector('.door-guide-title');
  const guideDistance=guide.querySelector('.door-guide-distance');
  const dismiss=guide.querySelector('button');
  const element=tag=>travel.ownerDocument.createElement(tag);
  const pins=[];
  let selected=null,player,position,viewer;

  function select(pin){
    selected=pin;
    guide.hidden=true;
    guideTitle.textContent=pin?.door.mapTitle??'';
    guideDistance.textContent='';
    guide.style.removeProperty('--door-direction');
    for(const entry of pins){
      const active=entry===pin;
      entry.button.setAttribute('aria-pressed',String(active));
      entry.marker.toggleAttribute('data-selected',active);
    }
  }

  function clear(){
    pins.length=0;select(null);position=null;player=null;viewer=null;
    dismiss.onclick=null;
    plot.replaceChildren();
    destinations.replaceChildren();
    view.hidden=true;
  }

  function update(next,rotation,nearest){
    if(!player)return;
    if(!travel.open){position=null;viewer=null;if(!selected)return;}
    const known=Number.isFinite(next?.x)&&Number.isFinite(next?.z);
    const facing=known&&rotation?.();
    const yaw=facing?Math.atan2(-2*(facing.x*facing.z+facing.w*facing.y),
      1-2*(facing.x*facing.x+facing.y*facing.y)):NaN;
    if(selected){
      const target=selected.door.door;
      const dx=target.x-next?.x,dz=target.z-next?.z;
      const bearing=Math.atan2(dx,-dz)-yaw;
      const hidden=travel.open||nearest?.to===selected.door.to||!known||!Number.isFinite(bearing);
      if(guide.hidden!==hidden)guide.hidden=hidden;
      if(!hidden){
        const angle=Math.round(bearing*180/Math.PI/5)*5+'deg';
        if(guide.style.getPropertyValue('--door-direction')!==angle)guide.style.setProperty('--door-direction',angle);
        const distance=Math.max(1,Math.round(Math.hypot(dx,dz)))+' m';
        if(guideDistance.textContent!==distance)guideDistance.textContent=distance;
      }
    }
    if(!travel.open)return;
    if(player.hidden===known)player.hidden=!known;
    if(!known){position=null;viewer=null;return;}
    const x=coordinate(next.x),z=coordinate(next.z);
    const heading=Number.isFinite(yaw)?Math.round(yaw*180/Math.PI/5)*5:null;
    const stamp=x+':'+z+':'+heading;
    if(stamp===position)return;
    position=stamp;
    viewer=heading===null?null:{x:Math.round(next.x*10)/10,z:Math.round(next.z*10)/10,heading:heading*Math.PI/180};
    place(player,next);
    player.style.setProperty('--map-heading',heading===null?'0deg':heading+'deg');
    player.toggleAttribute('data-heading',heading!==null);
  }

  function show(){
    clear();
    dismiss.onclick=()=>select(null);
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
      const {x,y,z}=door.door;
      const pin={marker,button,door,id:JSON.stringify([door.to,type,x,y,z])};
      button.onclick=()=>select(selected===pin?null:pin);
      pins.push(pin);destinations.append(button);
    }
    if(hint)hint.hidden=!pins.length;
    view.hidden=false;
  }

  show();
  return {update,clear,
    state:()=>({viewer,selected:selected?.id??'',destinations:pins.map(pin=>({id:pin.id,title:pin.door.mapTitle})),
      marks:pins.map(pin=>({id:pin.id,kind:pin.marker.dataset.kind,x:pin.door.door.x,z:pin.door.door.z}))}),
    choose(id){
      const pin=pins.find(item=>item.id===id);
      if(pin)select(selected===pin?null:pin);
    },
  };
}
