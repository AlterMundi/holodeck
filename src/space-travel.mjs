const base=new URL('./',document.baseURI);

export async function readSpace(){
  const result=await fetch(new URL('api/space',base),{credentials:'same-origin'});
  if(!result.ok)throw Error('No pude confirmar el lugar.');
  return result.json();
}

export function showSpaceLinks(space,{canLeave=()=>true,onError}){
  const travel=document.querySelector('#space-travel');
  if(!travel)return;
  const inside=space.id!=='outside';
  const destinations=inside
    ? [...space.exits,{to:'outside',title:'Volver al exterior'}]
    : space.entrances.map(entrance=>({to:entrance.id,title:entrance.title}));
  travel.hidden=!destinations.length;
  const list=travel.querySelector('nav');
  list.replaceChildren();
  for(const destination of destinations){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=destination.title;
    button.onclick=async()=>{
      if(!canLeave())return;
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
        // A lost response is reconciled by reading the current room.
        try{next=await readSpace();}catch{}
        if(!next||next.id===space.id)onError('No pude confirmar el cambio de lugar.');
      }
      if(next&&next.id!==space.id){
        const key='holodeck.exterior-position',target=new URL(location.href);
        try{
          if(!inside)sessionStorage.setItem(key,target.hash);
          target.hash=next.id==='outside'?(sessionStorage.getItem(key)||''):'';
        }catch{target.hash='';}
        history.replaceState(history.state,'',target);
        location.reload();
        return;
      }
      for(const control of list.children)control.disabled=false;
    };
    list.append(button);
  }
}
