import {createHash} from 'node:crypto';
import {loadOwnerRoomArt,readOwnerManifest} from './owner-room-art.mjs';

const labels={arrival:'Recorrido de la casa',hefesto:'Hefesto',atelier:'Atelier',printing:'Impresión',
  athena:'Templo de Atenea','research-gallery':'Galería de investigación'};

// A visual tour branches off an authored foyer. Its geometry defines the
// tour graph, while the foyer remains the authority for visitor access.
export async function loadOwnerRoomTours(selections,definitions,request){
  if(!Array.isArray(selections)||selections.length>4||
     new Set(selections.map(selection=>selection.house)).size!==selections.length)
    throw Error('Select distinct owner room tours');
  const tours=[],art=new Map();
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
    const rooms=Object.fromEntries(cells.map(cell=>[cell,`tour-${prefix}-${cell}`]));
    const links=new Map(cells.map(cell=>[cell,[]]));
    let entrance;
    for(const {sides} of manifest.passages){
      if(sides?.length!==2||sides[0].cell===sides[1].cell)throw Error('Invalid owner room tour passage');
      const outside=sides.find(side=>side.keepParcelOffer===true);
      if(outside){
        const inside=sides.find(side=>side!==outside);
        if(entrance||Object.hasOwn(rooms,outside.cell)||!Object.hasOwn(rooms,inside.cell))
          throw Error('Invalid owner room tour entrance');
        entrance=inside.cell;
        continue;
      }
      const [a,b]=sides.map(side=>side.cell);
      if(!links.has(a)||!links.has(b)||links.get(a).some(link=>link.to===rooms[b]))
        throw Error('Invalid owner room tour door pair');
      links.get(a).push({kind:'door',to:rooms[b]});
      links.get(b).push({kind:'door',to:rooms[a]});
    }
    if(!entrance)throw Error('Owner room tour requires one entrance');
    const tourRooms=cells.map(cell=>({id:rooms[cell],house:foyer.house,level:foyer.level,
      title:manifest.cells[cell].title??labels[cell]??cell,entry:cell===entrance,
      guests:manifest.cells[cell].guests,links:links.get(cell)}));
    const staged=await loadOwnerRoomArt([{...selection,rooms}],new Map(tourRooms.map(room=>[room.id,room])),request);
    const port=staged.get(rooms[entrance]);
    port.doors.set(foyer.id,port.exterior);
    port.exterior=null;
    for(const [id,room] of staged)art.set(id,room);
    tours.push({foyer:foyer.id,entrance:rooms[entrance],rooms:tourRooms});
  }
  return {art,project(definitions){
    const byId=new Map(definitions.map(room=>[room.id,room]));
    for(const tour of tours){
      const foyer=byId.get(tour.foyer);
      if(!foyer?.entry)throw Error('Owner room tour lost its authored foyer');
      byId.set(foyer.id,{...foyer,links:[...foyer.links,{kind:'portal',to:tour.entrance}]});
      for(const room of tour.rooms){
        if(byId.has(room.id))throw Error('Owner room tour conflicts with an existing room');
        // Cell audiences can narrow access within the published house.
        const guests=room.guests===undefined||room.guests?.[0]==='*'?[...foyer.guests]:
          room.guests.filter(guest=>foyer.guests[0]==='*'||foyer.guests.includes(guest));
        byId.set(room.id,{...room,entry:false,guests,
          links:room.entry?[...room.links,{kind:'portal',to:foyer.id}]:room.links});
      }
    }
    return [...byId.values()];
  }};
}
