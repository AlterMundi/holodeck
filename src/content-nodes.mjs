import {validSignalGarden,signalGardenProgress,signalGardenInstructions} from './playable-creations.mjs';
import {createHash} from 'node:crypto';
import {validVisitPin,visitVersion,validateContentVisits} from './content-visits.mjs';
export const MAX_CONTENT_NODES=8;
export const contentNodeId=value=>typeof value==='string'&&/^node-[a-z0-9-]{1,40}$/.test(value);
export const contentSelection=pin=>createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(pin).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys;
export function validNodeData(args){
 return (exact(args,'links,position,result,shape,title')||exact(args,'links,play,position,shape,title'))&&typeof args.title==='string'&&args.title.trim().length>0&&args.title.length<=40&&!/[\u0000-\u001f]/.test(args.title)
  &&['pedestal','portal'].includes(args.shape)&&exact(args.position,'x,z')&&[args.position.x,args.position.z].every(Number.isFinite)
  &&Math.abs(args.position.x)<=7&&args.position.z>=-6&&args.position.z<=6
  &&(Object.hasOwn(args,'play')?validSignalGarden(args.play):exact(args.result,'pin')&&validVisitPin(args.result.pin))
  &&Array.isArray(args.links)&&args.links.length<=4&&new Set(args.links.map(link=>link?.id)).size===args.links.length
  &&args.links.every(link=>exact(link,'id,revision')&&contentNodeId(link.id)&&Number.isSafeInteger(link.revision)&&link.revision>=1);
}
export function validStoredNode(node,id){
 return node&&node.id===id&&contentNodeId(id)&&Number.isSafeInteger(node.revision)&&node.revision>=1&&typeof node.owner==='string'&&node.owner.length<=200
  &&typeof node.deleted==='boolean'&&['deleted,id,links,owner,position,result,revision,shape,title','deleted,id,links,owner,play,position,revision,shape,title'].includes(Object.keys(node).sort().join(','))
  &&validNodeData({title:node.title,shape:node.shape,position:node.position,...(node.play?{play:node.play}:{result:node.result}),links:node.links});
}
export function nodeState(nodes,actor=null,context={}){
 return Object.fromEntries(Object.entries(nodes).map(([id,node])=>[id,{id,revision:node.revision,owner:node.owner,deleted:node.deleted,title:node.title,shape:node.shape,position:{...node.position},
  ...(node.play?(()=>{const progress={...signalGardenProgress(node.play,context),definitionRevision:node.revision};return {play:structuredClone(node.play),progress,...signalGardenInstructions(node.play,progress)};})():{
   ...(actor?.rights?.includes('observe')?{declaredResultPin:structuredClone(node.result.pin)}:{}),
   result:{selection:contentSelection(node.result.pin),kind:visitVersion(node.result.pin)===2?'artifact_review':'report',...(visitVersion(node.result.pin)===2?{adapter:node.result.pin.adapter}:{}),verification:'creator-declared'}}),
  links:node.links.map(link=>({...link,currentRevision:nodes[link.id]?.revision??null,status:!nodes[link.id]||nodes[link.id].deleted?'deleted':nodes[link.id].revision===link.revision?'current':'revised'}))}]));
}
// Fixed routes from Nexus's existing visit descriptor API. A pointer is not a
// source grant: the descriptor and viewer recheck the actual human's access.
export function nodeVisits(nodes,actor){
 if(actor?.kind!=='human'||!actor.rights?.includes('observe'))return [];
 return Object.values(nodes).filter(node=>!node.deleted&&!node.play).map(node=>{
  const pin=node.result.pin,artifact=visitVersion(pin)===2;
  const query=new URLSearchParams({table:pin.tableId,entry:'web',...(!artifact?{report_revision:pin.revision}:{})});
  const descriptor=`/nexus/api/tables/${encodeURIComponent(pin.tableId)}/${artifact?'artifact-review':'reports'}/${encodeURIComponent(artifact?pin.reviewId:pin.reportId)}/${encodeURIComponent(pin.revision)}/visit`;
  const [entry]=validateContentVisits([{id:node.id,node:'reading-room',entry:'/nexus/?'+query,descriptor,pin,discoverActors:[actor.id]}]);
  const {discoverActors,...selected}=entry;
  return {...selected,node:node.id,title:node.title,position:{...node.position,y:.1},nodeRevision:node.revision,resultVerification:'creator-declared'};
 });
}
