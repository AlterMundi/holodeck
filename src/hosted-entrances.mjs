export function hostedHomeUrl(value) {
  if(typeof value!=='string'||value.length>240||/\s|\\/.test(value))return null;
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&/^[a-z0-9-]+\.dmn\.homes$/.test(url.hostname)&&
      !url.port&&!url.username&&!url.password&&url.pathname!=='/'&&!url.hash?url.href:null;
  }catch{return null;}
}

export function selectHostedEntrances(entries,rooms) {
  if(!Array.isArray(entries)||entries.length>8)throw Error('Select bounded hosted house entrances');
  const selected=new Map();
  for(const entry of entries){
    const home=hostedHomeUrl(entry?.home);
    const room=rooms.get(entry?.room);
    if(!home||!room?.entry||selected.has(room.id)||Object.keys(entry).sort().join(',')!=='home,room')
      throw Error('Select a distinct existing house entry and a trusted Home URL');
    selected.set(room.id,home);
  }
  return selected;
}
