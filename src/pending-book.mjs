const ACTIVE=new Set(['pending','answering','unknown']);
const ID=/^[a-f0-9]{32}$/;
const REVISION=/^[a-f0-9]{64}$/;
const ROOM=/^[a-z][a-z0-9-]{0,47}$/;
const FEEDS=['requests','tasks','internal'];
const MAX_PAGES=20;

export function pendingRoom(link,world){
  try{
    const url=new URL(link?.url);
    const room=url.searchParams.get('sala');
    return url.origin===world.origin&&url.pathname===world.pathname&&!url.username&&!url.password&&
      !url.hash&&url.searchParams.size===1&&ROOM.test(room??'')&&room!=='outside'?room:null;
  }catch{return null;}
}

function itemFrom(row,feed,binding){
  if(row?.binding!==binding||!ID.test(row.id??'')||!REVISION.test(row.revision??'')||
     typeof row.title!=='string'||!row.title||row.title.length>400||!ACTIVE.has(row.state))return null;
  const kind=feed==='tasks'||row.kind==='task'?'tasks':'requests';
  return {id:row.id,revision:row.revision,title:row.title,kind,feed,label:row.label,preview:row.preview,
    detail:(feed==='internal'?'internal/':'')+kind+'/'+row.id,createdAt:row.created_at};
}

export async function readPendings(read,binding){
  const feeds=await Promise.all(FEEDS.map(async feed=>{
    const items=[];
    let cursor=0,more=true;
    for(let n=0;n<MAX_PAGES&&more;n++){
      const page=await read(feed+'?after='+cursor);
      if(page?.binding!==binding||!Array.isArray(page.items)||page.items.length>20||
         typeof page.more!=='boolean'||!Number.isSafeInteger(page.cursor)||page.cursor<cursor||
         page.more&&page.cursor===cursor)throw Error('Cambió la lista de pendientes.');
      items.push(...page.items.map(row=>itemFrom(row,feed,binding)).filter(Boolean));
      cursor=page.cursor;
      more=page.more;
    }
    return {items,more};
  }));
  const seen=new Map();
  for(const {items} of feeds)for(const item of items){
    const key=item.kind+':'+item.id;
    if(!seen.has(key))seen.set(key,item);
  }
  const items=[...seen.values()].sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));
  return {items,more:feeds.some(feed=>feed.more)};
}

export function mountPendingBook({window,document,select,currentActor,onJump,world}){
  const button=document.querySelector('#pending-book-tool'),badge=button.querySelector('[data-count]');
  const dialog=document.querySelector('#pending-book'),list=dialog.querySelector('[data-items]');
  const status=dialog.querySelector('[role=status]'),conversation=dialog.querySelector('a');
  let refreshing=false,selected,disposed=false,detailTurn=0,showingDetail=false,readiness;
  const read=async(path,surface)=>{
    const response=await window.fetch(new URL('api/interaction/'+path,surface.url),{
      credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(7500)});
    if(!response.ok)throw Error('No pude abrir los pendientes.');
    return response.json();
  };
  function paint({items,more},surface){
    badge.textContent=items.length+(more?'+':'');
    button.toggleAttribute('data-attention',items.length>0);
    button.setAttribute('aria-label',`Pendientes, ${items.length}${more?' o más':''}`);
    const rows=document.createElement('ul');
    list.replaceChildren(rows);
    status.textContent=items.length?'':'No tenés pendientes.';
    for(const item of items){
      const row=document.createElement('li'),open=document.createElement('button');
      open.type='button';
      open.textContent=item.title;
      row.append(open);
      if(typeof item.label==='string'){
        const source=document.createElement('small');
        source.textContent=item.label;
        row.append(source);
      }
      open.onclick=async()=>{
        showingDetail=true;
        const turn=++detailTurn;
        status.textContent='';
        try{
          const query=new URLSearchParams({offset:'0',revision:item.revision});
          const detail=await read(item.detail+'?'+query,surface);
          if(disposed||!dialog.open||turn!==detailTurn||selected?.binding!==surface.binding||currentActor()!==surface.actorRef)return;
          if(detail?.id!==item.id||detail?.binding!==surface.binding||detail?.revision!==item.revision||
             !ACTIVE.has(detail.state))throw Error('El pendiente cambió. Volvé a abrir el libro.');
          const destinations=[...new Set((Array.isArray(detail.links)?detail.links:[]).map(link=>pendingRoom(link,world)).filter(Boolean))];
          if(destinations.length===1){
            dialog.close();
            await onJump(destinations[0]);
          }else{
            const text=document.createElement('p');
            text.textContent=typeof detail.body==='string'?detail.body:item.preview??'';
            list.replaceChildren(text);
            for(const room of destinations){
              const visit=document.createElement('button');
              visit.type='button';visit.textContent='Ir a '+room;
              visit.onclick=()=>{dialog.close();void onJump(room);};
              list.append(visit);
            }
            status.textContent=destinations.length?'Elegí un destino.':'Este pendiente se atiende en Conversación.';
          }
        }catch(error){if(turn===detailTurn&&dialog.open){showingDetail=false;status.textContent=error.message;}}
      };
      rows.append(row);
    }
  }
  async function refresh(){
    if(disposed||refreshing||document.hidden||!currentActor())return;
    refreshing=true;
    const actor=currentActor();
    try{
      const surface=await select();
      if(disposed||currentActor()!==actor)return;
      const target=new URL(surface.url);
      if(target.origin!==window.location.origin||!target.pathname.endsWith('/')||surface.actorRef!==actor||
        target.search||target.hash||!REVISION.test(surface.binding??''))return;
      if(selected?.actorRef!==actor||selected?.binding!==surface.binding){
        detailTurn++;
        showingDetail=false;
      }
      selected=surface;
      const entry=new URL(target);
      entry.searchParams.set('view','conversation');
      entry.searchParams.set('client','standalone');
      conversation.href=entry.href;
      button.hidden=false;
      const data=await readPendings(path=>read(path,surface),surface.binding);
      if(!disposed&&currentActor()===actor){
        if(dialog.open&&!showingDetail&&readiness!==JSON.stringify(data))
          paint(data,surface);
        else{
          badge.textContent=data.items.length+(data.more?'+':'');
          button.toggleAttribute('data-attention',data.items.length>0);
          button.setAttribute('aria-label',`Pendientes, ${data.items.length}${data.more?' o más':''}`);
        }
        readiness=JSON.stringify(data);
      }
    }catch{
      if(dialog.open){
        list.replaceChildren();
        readiness=undefined;
        showingDetail=false;
        status.textContent='No pude actualizar los pendientes. Volvé a abrir el libro.';
      }
    }finally{refreshing=false;}
  }
  button.onclick=()=>{
    list.replaceChildren();
    readiness=undefined;
    showingDetail=false;
    status.textContent='Buscando pendientes…';
    dialog.showModal();
    void refresh();
  };
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{detailTurn++;button.focus({preventScroll:true});});
  const timer=window.setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);
  void refresh();
  return {refresh,dispose(){disposed=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);}};
}
