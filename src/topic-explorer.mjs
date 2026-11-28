export function mountTopicExplorer(document, readRooms) {
  const get=id=>document.getElementById(id);
  const dialog=get('topic-explorer'),status=get('topic-explorer-status'),list=get('topic-explorer-list');
  const back=get('topics-back'),forward=get('topics-next'),details=get('topic-room-details');
  let reading=false,next,pages=[undefined],generation=0;
  const title=room=>room.general?'Nuestra conversación general':room.title;
  const clear=()=>{
    details.hidden=true;
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
        const selected=value.rooms[0];
        details.querySelector('h3').textContent=title(selected);
        details.querySelector('p').textContent=selected.direct_available
          ? 'Esta conversación está disponible.'
          : 'La conversación de este topic todavía no está disponible.';
        details.hidden=false;
        details.querySelector('button').focus();
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
      details.querySelector('button').focus();
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
  details.querySelector('button').onclick=()=>void load();
}
