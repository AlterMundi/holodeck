import {HOUSE_GROUND,HOUSE_PLOTS} from './houses.mjs';
import {LAYOUT_VERSION,TERRACE_TOP,TERRACES,PROMENADES} from './world-layout.mjs';
import {signalColourName} from './playable-creations.mjs';
// One-way projection of Room semantics. Static original art is a merged GLB;
// only traversable surfaces and changing activity elements remain MML primitives.
import {focusAnchor} from './focus.mjs';
import {workshopColour} from './workshop.mjs';
import {CONTENT_NODE} from './content-visits.mjs';
import {nodeRepresentation} from './node-representations.mjs';
import {avatarForActor} from './avatar-registry.mjs';
import {workshopProjection,projectionNodeHTML,attribute} from './workshop-projection.mjs';
const sphere=(x,y,z,r,color)=>`<m-sphere x="${x}" y="${y}" z="${z}" radius="${r}" color="${color}" collide="false"></m-sphere>`;
const cylinder=(x,y,z,r,h,color,extra='')=>`<m-cylinder x="${x}" y="${y}" z="${z}" radius="${r}" height="${h}" color="${color}" ${extra}></m-cylinder>`;
// MML label planes cull their back face. Pair oppositely facing labels so
// each approach shows normal lettering. Offset the faces to avoid z-fighting.
function sign({y,text,size,width,height}) {
  return [[.006,0],[-.006,180]].map(([z,ry]) =>
    `<m-label y="${y}" z="${z}" ry="${ry}" content="${attribute(text)}" font-size="${size}" width="${width}" height="${height}" color="#163b3f" font-color="#f6edda" collide="false"></m-label>`
  ).join('');
}
const ASSET_FILE = /^[a-z0-9][a-z0-9._-]{0,79}\.glb$/;
const assetFile = value => typeof value === 'string' && ASSET_FILE.test(value);
const vector = value => Array.isArray(value) && value.length === 3 &&
  [value[0],value[1],value[2]].every(Number.isFinite);

function gardenModel(part, prefix) {
  if (!assetFile(part?.asset)) return '';
  const {asset,x,y,z,sx,sy,sz} = part;
  if (![x,y,z].every(Number.isFinite) ||
      ![sx,sy,sz].every(value => Number.isFinite(value) && value>0)) return '';
  const revision=/^[a-f0-9]{64}$/.test(part.revision)?'?v='+part.revision.slice(0,12):'';
  const model=`<m-model id="authored-garden" src="${attribute(prefix+'assets/'+asset+revision)}" x="${x}" y="${y}" z="${z}" sx="${sx}" sy="${sy}" sz="${sz}" collide="false"></m-model>`;
  return part.colliders?model+`<m-group id="authored-garden-colliders">${part.colliders}</m-group>`:model;
}

// Exported models are ground-registered in meters, with the entrance facing
// +Z. Rotate this placement toward the aisle and check the measured footprint.
function houseModel(part, plot, position, id, prefix) {
  if (!assetFile(part?.asset) ||
      !vector(part.bounds?.min) || !vector(part.bounds?.max) || !vector(position)) return '';
  const {min,max} = part.bounds;
  if (min.some((value,index) => value >= max[index])) return '';
  const [x,y,z] = position;
  const sides = [x-plot.side*min[2],x-plot.side*max[2]];
  const ends = [z+plot.side*min[0],z+plot.side*max[0]];
  if (sides.some(side => Math.abs(side)>plot.width/2) ||
      ends.some(end => Math.abs(end)>plot.depth/2)) return '';
  return `<m-model id="${id}" src="${attribute(prefix+'assets/'+part.asset)}" x="${x}" y="${y+.1}" z="${z}" ry="${-plot.side*90}" collide="false"></m-model>`;
}

function housingDocument(houses, prefix, houseVisual, site) {
  const {houseWalk:walk,parcelTerrain:terrain,parcelGarden}=site??{};
  const authoredWalk = assetFile(walk?.asset) && /^[a-f0-9]{64}$/.test(walk.revision);
  const walkSource = authoredWalk ? prefix + 'assets/' + walk.asset + '?v=' + walk.revision.slice(0,12) : '';
  const authoredTerrain = assetFile(terrain?.asset) && /^[a-f0-9]{64}$/.test(terrain.revision);
  const hiddenGround = authoredTerrain ? ' opacity="0" cast-shadows="false"' : '';
  let markup = HOUSE_GROUND.map(({id,minX,maxX,minZ,maxZ}) =>
    `<m-cube id="${id}" x="${(minX+maxX)/2}" y="0" z="${(minZ+maxZ)/2}" width="${maxX-minX}" height=".2" depth="${maxZ-minZ}" color="#6a8d7b"${hiddenGround}></m-cube>`
  ).join('');
  if(authoredTerrain){
    const terrainSource=prefix+'assets/'+terrain.asset+'?v='+terrain.revision.slice(0,12);
    markup+=`<m-model id="parcel-terrain" src="${attribute(terrainSource)}" collide="false" cast-shadows="false"></m-model>`;
    if(assetFile(parcelGarden?.asset)&&/^[a-f0-9]{64}$/.test(parcelGarden.revision)){
      const source=prefix+'assets/'+parcelGarden.asset+'?v='+parcelGarden.revision.slice(0,12);
      markup+=`<m-model id="parcel-garden" src="${attribute(source)}" collide="false"></m-model>
        <m-group id="parcel-garden-colliders">${parcelGarden.colliders}</m-group>`;
    }
  }
  // The visual centerline has no collider. The two solid ground pieces
  // overlap and meet the existing arrival island at the same walking height.
  markup += authoredWalk ?
    `<m-model id="house-walk" src="${attribute(walkSource)}" collide="false" cast-shadows="false"></m-model>` :
    '<m-cube x="0" y=".101" z="17.42" width="2.8" height=".006" depth="15.24" color="#c8b695" collide="false"></m-cube>';
  for (const plot of HOUSE_PLOTS) {
    const house = houses.find(entry => entry.parcel === plot.id);
    markup += `<m-group id="${plot.id}" x="${plot.x}" z="${plot.z}">
      ${authoredTerrain?'':`<m-cube y=".105" width="${plot.width}" height=".01" depth="${plot.depth}" color="${house?'#82735a':'#839c81'}" collide="false"></m-cube>`}`;
    if (house) {
      const {id,revision,facade} = house;
      const {title,width,depth,height,color} = facade;
      const doorHeight = Math.min(1.72,height-.16);
      const visual = houseVisual?.(house, plot);
      const authored = houseModel(visual?.facade,plot,[0,0,0],`facade-${id}`,prefix);
      const miniature = authored ? houseModel(visual?.miniature,plot,visual?.miniature?.at,`miniature-${id}`,prefix) : '';
      const proxy = authored ? ' opacity="0" cast-shadows="false"' : '';
      markup += `<m-group id="${id}" data-house-revision="${revision}">
        <m-cube y="${.1+height/2}" width="${width}" height="${height}" depth="${depth}" color="${attribute(color)}"${proxy}></m-cube>
        <m-cube y="${.16+height}" width="${width+.16}" height=".12" depth="${depth+.16}" color="#4f4a4b"${proxy}></m-cube>
        <m-group id="entrance-${id}" x="${-plot.side*(width/2+.025)}">
          ${authored ? '' : `<m-cube y="${.1+doorHeight/2}" width=".035" height="${doorHeight}" depth=".76" color="#333739" collide="false"></m-cube>
          <m-cube x="${-plot.side*.025}" y="${.1+doorHeight/2}" width=".022" height="${doorHeight-.08}" depth=".65" color="#e4cf99" collide="false"></m-cube>
          <m-cube x="${-plot.side*.049}" z=".23" y="${.1+doorHeight*.47}" width=".04" height=".055" depth=".04" color="#414842" collide="false"></m-cube>`}
        </m-group>${authored}${miniature}
        ${authored?'':`<m-group ry="90">${sign({y:height+.5,text:title,size:16,width:1.75,height:.42})}</m-group>`}
      </m-group>`;
    }
    markup += '</m-group>';
  }
  return markup;
}

export function worldDocument(room,{basePath='/',includeVisits=true,includeCues=true,houseVisual,gardenVisual,sceneryAsset='island-scenery.glb',sceneryRevision,commonsVisual,coastalRidges}={}){
  if(!assetFile(sceneryAsset))throw Error('Select a packaged scenery asset');
  const prefix=basePath.endsWith('/')?basePath:basePath+'/';
  const projection=workshopProjection(room.entities),manifest=JSON.stringify(room.entities);
  if(manifest.length>16384)throw Error('Geometry manifest exceeds bound');
  let out=`<m-group id="workshop" data-run="${attribute(room.run)}" data-edition="${attribute(room.edition)}" data-semantic-sequence="${room.sequence}" data-layout-version="${LAYOUT_VERSION}" data-geometry-state="${attribute(manifest)}">`;
  const sceneryQuery='?layout='+LAYOUT_VERSION+(/^[a-f0-9]{64}$/.test(sceneryRevision)?'&v='+sceneryRevision.slice(0,12):'');
  out+=`<m-model id="island-scenery" src="${attribute(prefix+'assets/'+sceneryAsset+sceneryQuery)}" collide="false"></m-model>`;
  if(assetFile(coastalRidges?.asset)&&/^[a-f0-9]{64}$/.test(coastalRidges.revision)){
    const source=prefix+'assets/'+coastalRidges.asset+'?v='+coastalRidges.revision.slice(0,12);
    out+=`<m-model id="coastal-ridges" src="${attribute(source)}" collide="false" cast-shadows="false"></m-model>`;
  }
  if(assetFile(commonsVisual?.asset)){
    const revision=/^[a-f0-9]{64}$/.test(commonsVisual.revision)?'?v='+commonsVisual.revision.slice(0,12):'';
    out+=`<m-model id="authored-commons" src="${attribute(prefix+'assets/'+commonsVisual.asset+revision)}" collide="false"></m-model>`+
      commonsVisual.colliders;
    const sign=commonsVisual.wayfinding;
    if(assetFile(sign?.asset)&&/^[a-f0-9]{64}$/.test(sign.revision)){
      const source=prefix+'assets/'+sign.asset+'?v='+sign.revision.slice(0,12);
      out+=`<m-model id="commons-wayfinding" src="${attribute(source)}" collide="false" cast-shadows="false"></m-model>`;
    }
    const mirador=commonsVisual.mirador;
    if(assetFile(mirador?.asset)&&/^[a-f0-9]{64}$/.test(mirador.revision)){
      const source=prefix+'assets/'+mirador.asset+'?v='+mirador.revision.slice(0,12);
      out+=`<m-model id="mirador" src="${attribute(source)}" collide="false"></m-model>
        <m-group id="mirador-colliders">${mirador.colliders}</m-group>`;
    }
  }
  out+=gardenModel(gardenVisual,prefix);
  // Flat walking proxies keep y=.1, at most3cm above layered visual ground.
  // Invisible proxies must not cast shadows onto their visible dressing.
  for(const terrace of TERRACES)out+=cylinder(terrace.x,0,terrace.z,terrace.radius,2*TERRACE_TOP,'#6b987e','opacity="0" cast-shadows="false"');
  for(const p of PROMENADES)out+=`<m-cube x="${(p.minX+p.maxX)/2}" y="0" z="${(p.minZ+p.maxZ)/2}" width="${p.maxX-p.minX}" height="${2*TERRACE_TOP}" depth="${p.maxZ-p.minZ}" opacity="0" cast-shadows="false"></m-cube>`;
  out+=housingDocument(room.houses?.directory() ?? [],prefix,houseVisual,commonsVisual);
  for(const entity of projection){
    if(entity.deleted)continue;
    out+=`<m-group id="${attribute(entity.id)}" data-entity-revision="${entity.revision}">${entity.nodes.map(projectionNodeHTML).join('')}</m-group>`;
    if(entity.controls)out+=`<m-group id="bridge-control">${entity.controls.map(projectionNodeHTML).join('')}</m-group>`;
  }
  if(includeVisits){
   for(const node of room.contentNodes||[CONTENT_NODE]){
    const {x,y,z}=node.position;
    if(node.id!==CONTENT_NODE.id){
     const spatialTitle=node.title.length>24?node.title.slice(0,23)+'…':node.title,labelHeight=.35;
     out+=`<m-group id="content-${attribute(node.id)}" x="${x}" y="${y}" z="${z}" data-content-node="${attribute(node.id)}">
       <m-cylinder radius=".75" height=".16" y=".08" color="#536c70" collide="false"></m-cylinder>
       ${node.model?`<m-model src="${attribute(prefix)}assets/${attribute(node.model)}" collide="false"></m-model>`:
        '<m-sphere y="1" radius=".45" color="#8ce4c2" collide="false"></m-sphere>'}
       ${sign({y:1.8+labelHeight/2,text:spatialTitle,size:18,width:2.5,height:labelHeight})}
     </m-group>`;
     continue;
    }
    const island=commonsVisual?.galleryIsland;
    const authored=assetFile(island?.asset)&&/^[a-f0-9]{64}$/.test(island.revision);
    if(authored){
      const source=prefix+'assets/'+island.asset+'?v='+island.revision.slice(0,12);
      out+=`<m-model id="gallery-island" src="${attribute(source)}" collide="false"></m-model>`;
    }
    const shell=authored?' opacity="0" cast-shadows="false"':'';
    out+=`<m-group id="content-reading-room" x="${x}" y="${y}" z="${z}" data-content-node="reading-room">
      <m-cylinder radius="1.05" height=".15" y=".08" color="#536c70"${shell}></m-cylinder>
      <m-cylinder radius=".8" height=".06" y=".18" color="#eed19b"${shell}></m-cylinder>
      <m-cube x="-.66" y="1.05" width=".15" height="1.7" depth=".22" color="#bc8355"${shell}></m-cube>
      <m-cube x=".66" y="1.05" width=".15" height="1.7" depth=".22" color="#bc8355"${shell}></m-cube>
      <m-cube y="1.85" width="1.48" height=".15" depth=".22" color="#eed19b"${shell}></m-cube>
      ${authored?'':`<m-cube y="1.03" width="1.1" height="1.24" depth=".08" color="#8ce4c2" collide="false"></m-cube>
      ${sign({y:2.2,text:"Sala de presentaciones",size:18,width:2.5,height:.4})}`}
    </m-group>`;
   }
  }
  if(includeVisits&&room.nodeState){
    for(const node of Object.values(room.nodeState()))if(!node.deleted){
      const{x,z}=node.position,representation=nodeRepresentation(node.representation);
      out+=`<m-group id="${attribute(node.id)}" data-entity-revision="${node.revision}" x="${x}" y=".1" z="${z}" data-content-node="${attribute(node.id)}" data-content-revision="${node.revision}" ${node.play?`data-play-schema="signal-garden/v1" data-play-complete="${node.progress.complete}"`:`data-result-selection="${node.result.selection}"`}>
        ${representation?`<m-model src="${attribute(prefix)}assets/${attribute(representation.asset)}" data-node-representation="${attribute(node.representation)}" collide="false"></m-model>`:`<m-cylinder radius=".7" height=".2" y=".1" color="#536c70"></m-cylinder>
        <m-cylinder radius=".53" height=".08" y=".24" color="#eed19b" collide="false"></m-cylinder>
        ${node.shape==='portal'?'<m-cube x="-.5" y="1" width=".12" height="1.5" depth=".14" color="#bc8355"></m-cube><m-cube x=".5" y="1" width=".12" height="1.5" depth=".14" color="#bc8355"></m-cube><m-cube y="1.75" width="1.12" height=".12" depth=".14" color="#eed19b"></m-cube>':'<m-cylinder radius=".18" height=".7" y=".6" color="#bc8355"></m-cylinder>'}
        <m-sphere y="1.1" radius=".24" color="${node.play?(node.progress.complete?'#efc87a':'#a77bea'):'#8ce4c2'}" collide="false"></m-sphere>`}
        ${sign({y:representation?2.25:2.1,text:representation&&node.title.length>24?node.title.slice(0,23)+'…':node.title,size:20,width:2.5,height:representation ? .7 : .35})}</m-group>`;
      if(node.play){
        node.play.targets.forEach((target,index)=>{
          const filled=node.progress.targets[index].entity!==null;
          out+=`<m-group id="play-${attribute(node.id)}-target-${index}" data-play-target="${index}" data-play-filled="${filled}" x="${target.x}" y=".14" z="${target.z}">
            <m-cylinder radius="${target.radius}" height=".025" color="${workshopColour(target.color)}" opacity="${filled?'.65':'.22'}" collide="false"></m-cylinder>
            ${sign({y:.18,text:`${index+1} · ${signalColourName(target.color)}${filled?' · lista':''}`,size:15,width:1.5,height:.25})}</m-group>`;
        });
      }
      for(const link of node.links)if(link.status==='current'){
        const target=room.nodes[link.id],dx=target.position.x-x,dz=target.position.z-z,length=Math.hypot(dx,dz);
        if(length>.01)out+=`<m-cube data-content-link="${attribute(node.id)}:${attribute(link.id)}" x="${(x+target.position.x)/2}" y=".13" z="${(z+target.position.z)/2}" width=".045" height=".035" depth="${length}" ry="${Math.atan2(dx,dz)*180/Math.PI}" color="#eed19b" collide="false"></m-cube>`;
      }
    }
  }
  if(includeCues&&room.focusState){
    const groups=new Map();
    for(const signal of room.focusState())if(signal.status==='current'){
      const list=groups.get(signal.target)||[];list.push(signal);groups.set(signal.target,list);
    }
    for(const[target,signals]of groups){
      const {x,y,z}=focusAnchor(target,room.entities[target]||room.nodes[target]);
      const rawName=signals[0].name,name=rawName?.length>18?rawName.slice(0,17)+'…':rawName;
      const label=signals.length>1?`${signals.length} indicaciones`:`${name||(signals[0].kind==='daimon'?'Un daimon':'Una persona')} señaló`;
      out+=`<m-group id="indication-${attribute(target)}" data-focus-target="${attribute(target)}" data-focus-revision="${signals[0].revision}" x="${x}" y="${y}" z="${z}">
        <m-cylinder radius=".48" height=".035" color="#ffe0a0" opacity=".8" collide="false"></m-cylinder>
        <m-sphere y=".15" radius=".09" color="#fff2c9" collide="false"></m-sphere>
        ${sign({y:.5,text:label,size:18,width:1.8,height:.24})}</m-group>`;
    }
  }
  for(const p of room.projections.values()){
    const{x,y,z}=p.position;
    const id=`projection-${p.actor.replace(/[^\w-]/g,'')}`,appearance=p.form==='avatar'?avatarForActor({id:p.actor,kind:p.kind}):null;
    out+=`<m-group id="${id}" x="${x}" y="${y}" z="${z}"${appearance?` data-holodeck-avatar="${appearance}" data-avatar-being="${attribute(p.actor)}"`:''}><m-group id="${id}-fallback">${sphere(0,0,0,.28,'#9de6e5')}${p.form==='beacon'||appearance?cylinder(0,-.5,0,.07,.7,'#e9dcaf'):''}</m-group></m-group>`;
  }
  return out+'</m-group>';
}
