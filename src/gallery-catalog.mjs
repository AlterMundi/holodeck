import {createHash} from 'node:crypto';
import {sameVisitPin, validVisitPin, visitRoutes} from './content-visits.mjs';

const PLINTHS = Object.freeze({
  draft: {title:'Borrador',position:Object.freeze({x:3.3945,y:.1,z:-.34944})},
  archive: {title:'Archivo',position:Object.freeze({x:3.3945,y:.1,z:3.67744})},
});

export function gallerySlots(selection, rooms) {
  if(selection==null)return null;
  if(typeof selection!=='object'||Array.isArray(selection)||
     Object.keys(selection).sort().join(',')!=='archive,draft,room'||!rooms.has(selection.room))
    throw Error('Select an existing gallery room and exact draft and archive editions');
  const slots=Object.keys(PLINTHS).map(role=>{
    const pin=selection[role];
    if(!validVisitPin(pin)||pin.kind!=='artifact_review'||pin.adapter!=='interactive_3d')
      throw Error('Gallery plinths require exact existing 3D reviews');
    const id='house-exhibit-'+role;
    const revision=Number.parseInt(createHash('sha256')
      .update(JSON.stringify([pin.tableId,pin.reviewId,pin.revision,pin.adapter])).digest('hex').slice(0,12),16)+1;
    return Object.freeze({id,node:id,nodeRevision:revision,...PLINTHS[role],
      pin:Object.freeze({...pin}),...visitRoutes(pin)});
  });
  if(sameVisitPin(slots[0].pin,slots[1].pin))throw Error('Select distinct gallery editions');
  return Object.freeze({room:selection.room,slots:Object.freeze(slots)});
}

export async function allowedGalleryVisits({entries, authorize, currentEntries}) {
  const allowed=await Promise.all(entries.map(async entry=>{
    try{return await authorize(entry.pin);}catch{return false;}
  }));
  const current=currentEntries();
  return entries.flatMap((entry,index)=>{
    const authorization=allowed[index];
    if((authorization!==true&&typeof authorization?.editionTitle!=='string')||
      !current.some(value=>value.id===entry.id&&value.nodeRevision===entry.nodeRevision&&sameVisitPin(value.pin,entry.pin)))return [];
    return [authorization===true?entry:{...entry,editionTitle:authorization.editionTitle}];
  });
}
