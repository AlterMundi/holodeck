// Geometry recipe for this selected workshop, not a universal scene language.
// Server serialization and client application checks share the same authored
// mapping, while the client verifies the actual MML/Three objects independently.
import { WORKSHOP, workshopColour } from './workshop.mjs';
const node=(id,kind,position,size,color)=>({id,kind,position,size,color});
export function workshopProjection(entities){
  const bridge=entities?.bridge;
  if(!bridge||!Number.isSafeInteger(bridge.revision)||bridge.revision<0||typeof bridge.raised!=='boolean')throw Error('Invalid bridge state');
  const anchor=WORKSHOP.anchors.bridge,control=WORKSHOP.anchors['bridge-control'];
  const bridgeNodes=[];
  for(let i=0;i<8;i++){
    const z=anchor.z+1.9-i*.55,y=bridge.raised?anchor.y-.01:anchor.y-2.4;
    bridgeNodes.push(node(`bridge-deck-${i}`,'cube',[0,y,z],[2.45,.2,.49],i%2?'#be9871':'#d3b18a'));
    if(bridge.raised&&i%2===0)for(const side of [-1,1])bridgeNodes.push(node(`bridge-post-${i}-${side<0?'left':'right'}`,'cylinder',[side*1.12,.64,z],[.045,.8],'#bc8355'));
  }
  if(bridge.raised)for(const side of [-1,1])bridgeNodes.push(node(`bridge-rail-${side<0?'left':'right'}`,'cube',[side*1.12,anchor.y+.84,anchor.z],[.065,.07,4.25],'#bc8355'));
  const controlNodes=[node('bridge-control-base','cylinder',[control.x,control.y-.76,control.z],[.72,.56],'#536c70'),
    node('bridge-control-ring','cylinder',[control.x,control.y-.43,control.z],[.53,.12],'#bc8355'),
    node('bridge-control-orb','sphere',[control.x,control.y,control.z],[.35],bridge.raised?'#efc776':'#95d7ca')];
  const result=[{id:'bridge',revision:bridge.revision,deleted:false,nodes:bridgeNodes,controls:controlNodes}];
  for(const[id,e]of Object.entries(entities)){
    if(id==='bridge')continue;
    if(!/^garden-[a-z0-9-]{1,40}$/.test(id)||!Number.isSafeInteger(e.revision)||e.revision<1)throw Error('Unsupported workshop entity');
    if(e.deleted===true){result.push({id,revision:e.revision,deleted:true,nodes:[]});continue;}
    const color=workshopColour(e.color);
    if(!color||!Number.isFinite(e.x)||!Number.isFinite(e.z))throw Error('Invalid garden state');
    result.push({id,revision:e.revision,deleted:false,nodes:[node(`${id}-base`,'cylinder',[e.x,.24,e.z],[.32,.28],'#d3c19b'),
      node(`${id}-stem`,'cylinder',[e.x,.51,e.z],[.065,.3],'#bc8355'),node(`${id}-light`,'sphere',[e.x,.9,e.z],[.34],color)]});
  }
  if(result.length>32)throw Error('Workshop entity bound exceeded');
  return result;
}
export const attribute=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function projectionNodeHTML(n){
  const[x,y,z]=n.position;
  const dimensions=n.kind==='cube'?`width="${n.size[0]}" height="${n.size[1]}" depth="${n.size[2]}"`:n.kind==='cylinder'?`radius="${n.size[0]}" height="${n.size[1]}"`:`radius="${n.size[0]}" collide="false"`;
  return `<m-${n.kind} id="${attribute(n.id)}" x="${x}" y="${y}" z="${z}" ${dimensions} color="${n.color}"></m-${n.kind}>`;
}
