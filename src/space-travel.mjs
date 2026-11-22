const base=new URL('./',document.baseURI);
const DOOR_RANGE=1.65;

export async function readSpace(){
  const result=await fetch(new URL('api/space',base),{credentials:'same-origin'});
  if(!result.ok)throw Error('No pude confirmar el lugar.');
  return result.json();
}

// MML's fourteen-value location format holds the avatar and camera transforms.
export function doorLocation({x,y,z,facing,yaw=facing*90}) {
  const rotation=yaw*Math.PI/180, s=Math.sin(rotation/2), c=Math.cos(rotation/2);
  return [x,y,z,0,s,0,c,x-Math.sin(rotation)*2.7,y+1.7,z-Math.cos(rotation)*2.7,0,s,0,c].join(',');
}

export function showSpaceLinks(space,{canLeave=()=>true,onError}){
  const travel=document.querySelector('#space-travel'),button=document.querySelector('#house-door');
  const inside=space.id!=='outside';
  const doors=inside
    ? [...space.exits.map(exit=>({...exit,title:(exit.kind==='portal'?'Cruzar portal · ':
        exit.kind==='stair'?(exit.rise<0?'Bajar · ':'Subir · '):'Ir a · ')+exit.title})),
        ...(space.exitDoor?[{to:'outside',title:'Salir al exterior',door:space.exitDoor}]:[])]
    : space.entrances.map(entrance=>({to:entrance.id,title:'Entrar · '+entrance.title,door:entrance.door}));
  const list=travel.querySelector('nav');
  let near=null,busy=false;
  async function move(destination) {
    if(busy||!canLeave())return;
    busy=true;button.disabled=true;
    for(const control of list.children)control.disabled=true;
    let next;
    try{
      const result=await fetch(new URL('api/space',base),{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({from:space.id,to:destination.to}),
      });
      if(result.ok)next=await result.json();
      else onError('Esta salida no está disponible. Podés volver a intentar.');
    }catch{
      try{next=await readSpace();}catch{}
      if(!next||next.id===space.id)onError('No pude confirmar el cambio de lugar.');
    }
    if(next&&next.id!==space.id){
      const target=new URL(location.href);
      const arrival=next.id==='outside'?space.exteriorDoor:next.exits.find(exit=>exit.to===space.id)?.door;
      target.hash=arrival?doorLocation(arrival):'';
      history.replaceState(history.state,'',target);
      location.reload();
      return;
    }
    busy=false;button.disabled=false;
    for(const control of list.children)control.disabled=false;
  }

  const links=[];
  if(space.emergencyExit)links.push({to:'outside',title:'Volver al exterior'});
  travel.hidden=!links.length;
  for(const destination of links){
    const control=document.createElement('button');
    control.type='button';control.textContent=destination.title;
    control.onclick=()=>move(destination);
    list.append(control);
  }
  button.onclick=()=>{if(near)move(near);};
  document.addEventListener('keydown',event=>{
    if(event.code!=='KeyE'||event.repeat||!near||!button.getClientRects().length||
       event.altKey||event.ctrlKey||event.metaKey||
       event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    event.preventDefault();
    move(near);
  });
  return position=>{
    let closest=null,distance=DOOR_RANGE;
    if(position)for(const destination of doors){
      if(!destination.door)continue;
      const stair=destination.kind==='stair';
      if(Math.abs(position.y-destination.door.y)>(stair ? .34 : .8))continue;
      const gap=Math.hypot(position.x-destination.door.x,position.z-destination.door.z);
      if(gap<distance&&(!stair||gap<.85)){closest=destination;distance=gap;}
    }
    if(closest===near)return;
    near=closest;button.hidden=!near;
    if(near)button.textContent=near.title;
  };
}
