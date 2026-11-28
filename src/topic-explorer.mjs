export function mountTopicExplorer(document, readRooms, enterRoom) {
  const get=id=>document.getElementById(id);
  const dialog=get('topic-explorer'),status=get('topic-explorer-status'),list=get('topic-explorer-list');
  const back=get('topics-back'),forward=get('topics-next'),details=get('topic-room-details');
  const roomBack=get('topic-room-back'),enter=get('topic-room-enter');
  let reading=false,next,pages=[undefined],generation=0,selected;
  const title=room=>room.general?'Nuestra conversación general':room.title;
  const clear=()=>{
    details.hidden=enter.hidden=true;
    selected=null;
    list.replaceChildren();
    back.hidden=forward.hidden=true;
  };

  async function load(room) {
    if(reading)return;
    reading=true;
    const selectedGeneration=generation;
    const current=()=>dialog.open&&generation===selectedGeneration;
    clear();
    status.textContent=room?'Abriendo el topic…':'Cargando tus topics…';
    const after=pages.at(-1);
    try {
      const value=await readRooms(room?{room}:{after});
      if(!current())return;
      if(room){
        selected=value.rooms[0];
        details.querySelector('h3').textContent=title(selected);
        details.querySelector('p').textContent=selected.direct_available
          ? 'Esta conversación está disponible.'
          : 'La conversación de este topic todavía no está disponible.';
        details.hidden=false;
        enter.hidden=!enterRoom;
        (enter.hidden?roomBack:enter).focus();
      }else{
        for(const entry of value.rooms){
          const row=document.createElement('li'),button=document.createElement('button');
          button.type='button';
          button.textContent=title(entry);
          button.onclick=()=>void load(entry.room);
          row.append(button);
          list.append(row);
        }
        next=value.next;
        back.hidden=pages.length===1;
        forward.hidden=!next;
      }
      status.textContent=value.rooms.length?'':'No hay topics para mostrar en esta página.';
    }catch{
      if(!current())return;
      status.textContent=room?'Ese topic ya no está disponible.':'No pude cargar tus topics.';
      details.hidden=false;
      details.querySelector('h3').textContent='';
      details.querySelector('p').textContent='';
      roomBack.focus();
    }finally{
      reading=false;
      if(dialog.open&&!current())void load();
    }
  }

  get('topics-open').onclick=()=>{
    dialog.showModal();
    ++generation;
    pages=[undefined];
    clear();
    void load();
  };
  back.onclick=()=>{pages.pop();void load();};
  forward.onclick=()=>{pages.push(next);void load();};
  roomBack.onclick=()=>void load();
  enter.onclick=async()=>{
    if(reading||!selected)return;
    reading=true;enter.disabled=roomBack.disabled=true;
    status.textContent='Entrando a la sala…';
    try{
      await enterRoom(selected.room);
      dialog.close();
    }catch(error){
      if(dialog.open)status.textContent=error.message||'No pude confirmar la entrada a la sala.';
    }finally{
      reading=false;enter.disabled=roomBack.disabled=false;
    }
  };
}
