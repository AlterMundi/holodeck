import {LAYOUT_VERSION,TERRACES,PROMENADES} from './world-layout.mjs';
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
export function worldDocument(room,{basePath='/',includeVisits=true,includeCues=true}={}){
  const prefix=basePath.endsWith('/')?basePath:basePath+'/';
  const projection=workshopProjection(room.entities),manifest=JSON.stringify(room.entities);
  if(manifest.length>16384)throw Error('Geometry manifest exceeds bound');
  let out=`<m-group id="workshop" data-run="${attribute(room.run)}" data-edition="${attribute(room.edition)}" data-semantic-sequence="${room.sequence}" data-layout-version="${LAYOUT_VERSION}" data-geometry-state="${attribute(manifest)}">`;
  out+=`<m-model id="island-scenery" src="${attribute(prefix)}assets/island-scenery.glb?layout=${LAYOUT_VERSION}" collide="false"></m-model>`;
  // Flat walking proxies keep y=.1, at most3cm above layered visual ground.
  // Invisible proxies must not cast shadows onto their visible dressing.
  for(const terrace of TERRACES)out+=cylinder(terrace.x,0,terrace.z,terrace.radius,.2,'#6b987e','opacity="0" cast-shadows="false"');
  for(const p of PROMENADES)out+=`<m-cube x="${(p.minX+p.maxX)/2}" y="0" z="${(p.minZ+p.maxZ)/2}" width="${p.maxX-p.minX}" height=".2" depth="${p.maxZ-p.minZ}" opacity="0" cast-shadows="false"></m-cube>`;
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
       <m-label y="${1.8+labelHeight/2}" content="${attribute(spatialTitle)}" font-size="18" width="2.5" height="${labelHeight}" color="#163b3f" font-color="#f6edda" collide="false"></m-label>
     </m-group>`;
     continue;
    }
    out+=`<m-group id="content-reading-room" x="${x}" y="${y}" z="${z}" data-content-node="reading-room">
      <m-cylinder radius="1.05" height=".15" y=".08" color="#536c70"></m-cylinder>
      <m-cylinder radius=".8" height=".06" y=".18" color="#eed19b"></m-cylinder>
      <m-cube x="-.66" y="1.05" width=".15" height="1.7" depth=".22" color="#bc8355"></m-cube>
      <m-cube x=".66" y="1.05" width=".15" height="1.7" depth=".22" color="#bc8355"></m-cube>
      <m-cube y="1.85" width="1.48" height=".15" depth=".22" color="#eed19b"></m-cube>
      <m-cube y="1.03" width="1.1" height="1.24" depth=".08" color="#8ce4c2" collide="false"></m-cube>
      <m-label y="2.2" content="Sala de presentaciones" font-size="18" width="2.5" height=".4" color="#163b3f" font-color="#f6edda" collide="false"></m-label>
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
        <m-label y="${representation?2.25:2.1}" content="${attribute(representation&&node.title.length>24?node.title.slice(0,23)+'…':node.title)}" font-size="20" width="2.5" height="${representation ? .7 : .35}" color="#163b3f" font-color="#f6edda" collide="false"></m-label></m-group>`;
      if(node.play){
        node.play.targets.forEach((target,index)=>{
          const filled=node.progress.targets[index].entity!==null;
          out+=`<m-group id="play-${attribute(node.id)}-target-${index}" data-play-target="${index}" data-play-filled="${filled}" x="${target.x}" y=".14" z="${target.z}">
            <m-cylinder radius="${target.radius}" height=".025" color="${workshopColour(target.color)}" opacity="${filled?'.65':'.22'}" collide="false"></m-cylinder>
            <m-label y=".18" content="${index+1} · ${attribute(signalColourName(target.color))}${filled?' · lista':''}" font-size="15" width="1.5" height=".25" color="#163b3f" font-color="#f6edda" collide="false"></m-label></m-group>`;
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
        <m-label y=".5" content="${attribute(label)}" font-size="18" width="1.8" height=".24" color="#163b3f" font-color="#f6edda" collide="false"></m-label></m-group>`;
    }
  }
  for(const p of room.projections.values()){
    const{x,y,z}=p.position;
    const id=`projection-${p.actor.replace(/[^\w-]/g,'')}`,appearance=p.form==='avatar'?avatarForActor({id:p.actor,kind:p.kind}):null;
    out+=`<m-group id="${id}" x="${x}" y="${y}" z="${z}"${appearance?` data-holodeck-avatar="${appearance}" data-avatar-being="${attribute(p.actor)}"`:''}><m-group id="${id}-fallback">${sphere(0,0,0,.28,'#9de6e5')}${p.form==='beacon'||appearance?cylinder(0,-.5,0,.07,.7,'#e9dcaf'):''}</m-group></m-group>`;
  }
  return out+'</m-group>';
}
