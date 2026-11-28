import {attribute} from './workshop-projection.mjs';

const slots=[
  [-2,-5.7,0], [2,-5.7,0],
  [-5.7,-3,90], [5.7,-3,-90],
  [-5.7,0,90], [5.7,0,-90],
  [-5.7,3,90], [5.7,3,-90],
];

export class TopicProjectDoors{
  constructor(document,read){
    this.document=document;
    this.read=read;
    this.entries=new Map();
  }

  mount(scene,room){
    this.clear();
    if(!scene||!room)return;
    this.scene=scene;
    this.room=room;
    const request=new AbortController();
    this.request=request;
    this.read(room,request.signal).then(value=>{
      if(this.request===request&&value.room===room)this.project(room,value.repositories);
    }).catch(()=>{});
  }

  project(room,repositories){
    if(this.room!==room||!this.scene?.isConnected)return;
    this.request?.abort();
    this.request=undefined;
    const groups=new Map();
    for(const repository of repositories){
      if(!groups.has(repository.project))groups.set(repository.project,repository);
    }
    this.root?.remove();
    this.root=undefined;
    this.entries.clear();
    if(!groups.size)return;
    const template=this.document.createElement('template');
    const records=[...groups.values()].slice(0,slots.length);
    template.innerHTML='<m-group id="topic-project-doors">'+records.map((record,index)=>{
      const [x,z,ry]=slots[index];
      const label=attribute(Array.from(record.label).slice(0,24).join(''));
      return `<m-group id="topic-project-door-${index}" x="${x}" z="${z}" ry="${ry}">
        <m-cube y="1.16" width="1.62" height="2.33" depth=".17" color="#80634d" collide="false"></m-cube>
        <m-cube y="1.12" z=".104" width="1.40" height="2.14" depth=".10" color="#24656a" collide="false"></m-cube>
        <m-sphere x=".49" y="1.08" z=".22" radius=".052" color="#f3d69b" collide="false"></m-sphere>
        <m-label y="2.55" z=".19" width="1.8" height=".35" font-size="19" content="${label}"
          color="#183b40" font-color="#fff0cb" collide="false"></m-label>
      </m-group>`;
    }).join('')+'</m-group>';
    this.root=template.content.firstElementChild;
    this.scene.append(this.root);
    for(const [index,element] of Array.from(this.root.children).entries()){
      const {project,repository}=records[index];
      this.entries.set(element,{kind:'topic-project-door',room,project,repository});
    }
  }

  targets(){
    const targets=new Map();
    for(const [element,record] of this.entries){
      const container=element.isConnected&&element.getContainer?.();
      if(container)targets.set(container,record);
    }
    return targets;
  }

  clear(){
    this.request?.abort();
    this.request=undefined;
    this.root?.remove();
    this.root=this.scene=this.room=undefined;
    this.entries.clear();
  }
}
