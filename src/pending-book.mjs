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

export class PendingSignals {
  observe(binding,items){
    const fresh=this.binding!==binding;
    if(fresh){this.binding=binding;this.seen=new Set();}
    let count=0;
    for(const {kind,id} of items){
      const key=kind+':'+id;
      if(this.seen.has(key))continue;
      this.seen.add(key);
      count++;
    }
    while(this.seen.size>1600)this.seen.delete(this.seen.values().next().value);
    return fresh?0:count;
  }
}

export function mountPendingBook({window,document,select,currentActor,onJump,onConversation=()=>{},onNew=()=>{},world}){
  const button=document.querySelector('#pending-book-tool'),badge=button.querySelector('[data-count]');
  const dialog=document.querySelector('#pending-book'),list=dialog.querySelector('[data-items]');
  const status=dialog.querySelector('[role=status]'),conversation=dialog.querySelector('[data-conversation]');
  const backButton=dialog.querySelector('[data-back]');
  let refreshing=false,selected,disposed=false,detailTurn=0,showingDetail=false,readiness,signalTimer,countLabel='';
  const signals=new PendingSignals();
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
      open.dataset.pendingId=item.id+':'+item.revision;
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
            backButton.hidden=false;
            conversation.hidden=false;
            const text=document.createElement('p');
            text.textContent=typeof detail.body==='string'?detail.body:item.preview??'';
            list.replaceChildren(text);
            for(const room of destinations){
              const visit=document.createElement('button');
              visit.type='button';visit.textContent='Ir a '+room;
              visit.onclick=()=>{dialog.close();void onJump(room);};
              list.append(visit);
            }
            status.textContent=destinations.length?'Elegí un destino.':'';
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
      button.hidden=false;
      const data=await readPendings(path=>read(path,surface),surface.binding);
      if(!disposed&&currentActor()===actor){
        const added=signals.observe(surface.binding,data.items);
        countLabel=data.items.length+(data.more?'+':'');
        if(added){
          button.setAttribute('data-new','');
          window.clearTimeout(signalTimer);
          signalTimer=window.setTimeout(()=>button.removeAttribute('data-new'),1500);
          onNew(added);
        }
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
  function back(){
    backButton.hidden=true;
    conversation.hidden=true;
    list.replaceChildren();
    readiness=undefined;
    showingDetail=false;
    detailTurn++;
    status.textContent='Buscando pendientes…';
    void refresh();
  }
  button.onclick=()=>{
    if(dialog.open)return;
    if(button.hasAttribute('data-native-pending')){
      dialog.setAttribute('data-native-pending','');
      dialog.show();
    }else dialog.showModal();
    back();
  };
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  backButton.onclick=back;
  conversation.onclick=()=>{dialog.close();onConversation();};
  const escape=event=>{
    if(event.key!=='Escape'||!dialog.open)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dialog.close();
  };
  document.addEventListener('keydown',escape,true);
  dialog.addEventListener('close',()=>{detailTurn++;button.focus({preventScroll:true});});
  const timer=window.setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);
  void refresh();
  return {refresh,back,button,dialog,list,status,
    get count(){return countLabel;},
    get fresh(){return button.hasAttribute('data-new');},
    open:()=>button.click(),close:()=>dialog.close(),conversation:()=>conversation.click(),
    dispose(){disposed=true;window.clearInterval(timer);window.clearTimeout(signalTimer);document.removeEventListener('visibilitychange',refresh);document.removeEventListener('keydown',escape,true);}};
}
