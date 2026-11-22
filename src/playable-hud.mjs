// A readable companion to spatial signs. The Room owns recipe/progress; this
// view only selects the nearest live activity and never computes a local score.
export class PlayableHUD {
 constructor(document){this.holder=document.querySelector('#play-near');this.title=document.querySelector('#play-title');this.status=document.querySelector('#play-progress');this.instruction=document.querySelector('#play-instruction');this.nodes={};this.selected=null;}
 sync(nodes){this.nodes=nodes??{};}
 update(position){
  if(!this.holder)return;
  const candidates=position?Object.values(this.nodes).filter(node=>!node.deleted&&node.play&&node.position).map(node=>({node,distance:Math.hypot(node.position.x-position.x,node.position.z-position.z)})).filter(v=>v.distance<=8).sort((a,b)=>a.distance-b.distance||a.node.id.localeCompare(b.node.id)):[];
  const node=candidates[0]?.node;this.holder.hidden=!node;if(!node){this.selected=null;return;}
  if(this.selected!==node.id){this.holder.open=false;this.selected=node.id;}
  const set=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value;};
  set(this.title,node.title);set(this.status,node.status);set(this.instruction,node.instruction);
 }
}
