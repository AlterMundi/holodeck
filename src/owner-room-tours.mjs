import {createHash} from 'node:crypto';
import {loadOwnerRoomArt,readOwnerManifest} from './owner-room-art.mjs';

const labels={arrival:'Recorrido de la casa',hefesto:'Hefesto',atelier:'Atelier',printing:'Impresión',
  athena:'Templo de Atenea','research-gallery':'Galería de investigación'};

function existingRooms(cells,links,entrance,foyer,definitions){
  const current=definitions.filter(room=>room.house===foyer.house);
  if(current.length!==cells.length)return null;
  const binding=new Map([[entrance,foyer.id]]);
  const used=new Set([foyer.id]);
  for(const cell of cells){
    if(binding.has(cell))continue;
    const matches=current.filter(room=>!used.has(room.id)&&(room.id===cell||room.id.endsWith('-'+cell)));
    if(matches.length===1){binding.set(cell,matches[0].id);used.add(matches[0].id);}
  }
  if(cells.length>1&&binding.size===1)return null;
  for(let lastSize=0;lastSize<binding.size&&binding.size<cells.length;){
    lastSize=binding.size;
    for(const [cell,id] of binding){
      const remaining=links.get(cell).filter(to=>!binding.has(to));
      const available=current.find(room=>room.id===id).links.filter(link=>link.kind==='door'&&!used.has(link.to));
      if(remaining.length===1&&available.length===1){
        binding.set(remaining[0],available[0].to);
        used.add(available[0].to);
      }
    }
  }
  if(cells.some(cell=>{
    const room=current.find(value=>value.id===binding.get(cell));
    return !room||room.links.length!==links.get(cell).length||
      !room.links.every(link=>link.kind==='door'&&links.get(cell).some(to=>binding.get(to)===link.to));
  }))return null;
  return Object.fromEntries(binding);
}

// A visual tour branches off an authored foyer. Its geometry defines the
// tour graph, while the foyer remains the authority for visitor access.
export async function loadOwnerRoomTours(selections,definitions,request){
  if(!Array.isArray(selections)||selections.length>4||
     new Set(selections.map(selection=>selection.house)).size!==selections.length)
    throw Error('Select distinct owner room tours');
  const tours=[],art=new Map(),guestLimits=new Map();
  for(const selection of selections){
    const foyer=definitions.find(room=>room.house===selection.house&&room.entry);
    if(!foyer)throw Error('Owner room tour requires its authored foyer');
    const {manifest}=await readOwnerManifest(selection,request);
    const cells=Object.keys(manifest.cells??{});
    if(!cells.length||cells.length>12||cells.some(cell=>!/^[a-z][a-z0-9-]{0,31}$/.test(cell)))
      throw Error('Invalid owner room tour cells');
    for(const cell of cells){
      const guests=manifest.cells[cell].guests;
      if(guests!==undefined&&(!Array.isArray(guests)||guests.length>16||
          new Set(guests).size!==guests.length||
          !(guests.length===1&&guests[0]==='*'||guests.every(guest=>
            typeof guest==='string'&&/^(?:human:[A-Za-z0-9:_-]{1,130}|dm:being:v1:[A-Za-z0-9_-]{43})$/.test(guest)))))
        throw Error('Invalid owner room tour audience');
    }
    const prefix=createHash('sha256').update(foyer.house).digest('hex').slice(0,10);
    const links=new Map(cells.map(cell=>[cell,[]]));
    let entrance;
    for(const {sides} of manifest.passages){
      if(sides?.length!==2||sides[0].cell===sides[1].cell)throw Error('Invalid owner room tour passage');
      const outside=sides.find(side=>side.keepParcelOffer===true);
      if(outside){
        const inside=sides.find(side=>side!==outside);
        if(entrance||links.has(outside.cell)||!links.has(inside.cell))
          throw Error('Invalid owner room tour entrance');
        entrance=inside.cell;
        continue;
      }
      const [a,b]=sides.map(side=>side.cell);
      if(!links.has(a)||!links.has(b)||links.get(a).includes(b))
        throw Error('Invalid owner room tour door pair');
      links.get(a).push(b);
      links.get(b).push(a);
    }
    if(!entrance)throw Error('Owner room tour requires one entrance');
    const reused=existingRooms(cells,links,entrance,foyer,definitions);
    const rooms=reused??Object.fromEntries(cells.map(cell=>[cell,`tour-${prefix}-${cell}`]));
    const tourRooms=cells.map(cell=>({id:rooms[cell],house:foyer.house,level:foyer.level,
      title:manifest.cells[cell].title??labels[cell]??cell,entry:cell===entrance,
      guests:manifest.cells[cell].guests,links:links.get(cell).map(to=>({kind:'door',to:rooms[to]}))}));
    for(const room of tourRooms)
      if(room.guests&&room.guests[0]!=='*')guestLimits.set(room.id,new Set(room.guests));
    const topology=reused?definitions:tourRooms;
    const staged=await loadOwnerRoomArt([{...selection,rooms}],new Map(topology.map(room=>[room.id,room])),request);
    if(!reused){
      const port=staged.get(rooms[entrance]);
      port.doors.set(foyer.id,port.exterior);
      port.exterior=null;
    }
    for(const [id,room] of staged)art.set(id,room);
    tours.push({foyer:foyer.id,entrance:rooms[entrance],rooms:tourRooms,reused:Boolean(reused)});
  }
  return {art,guestLimits,project(definitions){
    const byId=new Map(definitions.map(room=>[room.id,room]));
    for(const tour of tours){
      const foyer=byId.get(tour.foyer);
      if(!foyer?.entry)throw Error('Owner room tour lost its authored foyer');
      if(!tour.reused)byId.set(foyer.id,{...foyer,links:[...foyer.links,{kind:'portal',to:tour.entrance}]});
      for(const room of tour.rooms){
        const existing=byId.get(room.id);
        if(Boolean(existing)!==tour.reused)throw Error('Owner room tour conflicts with an existing room');
        const audience=existing?.guests??foyer.guests;
        // Cell audiences can narrow access within the published house.
        const guests=room.guests===undefined||room.guests?.[0]==='*'?[...audience]:
          room.guests.filter(guest=>audience[0]==='*'||audience.includes(guest));
        byId.set(room.id,existing?{...existing,guests}:{...room,entry:false,guests,
          links:room.entry?[...room.links,{kind:'portal',to:foyer.id}]:room.links});
      }
    }
    return [...byId.values()];
  }};
}
