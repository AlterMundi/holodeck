import {creationContains,nearestCreationPosition} from './world-layout.mjs';
import {validSignalGarden} from './playable-creations.mjs';
import {workshopColour} from './workshop.mjs';

const freshRecipe=()=>({schema:'signal-garden/v1',minContributors:2,targets:[]});
const tools=[['mint','Menta'],['amber','Ámbar'],['rose','Rosa'],['violet','Violeta']];

export class SignalGardenEditor{
  constructor({document,position,save,preview,allowed}){
    Object.assign(this,{document,position,save,preview,allowed});
    const at=id=>document.getElementById(id);
    this.form=at('signal-editor');this.list=at('signal-targets');this.notice=at('signal-notice');
    this.title=at('signal-title');this.minimum=at('signal-minimum');this.bridge=at('signal-bridge');
    this.add=at('signal-add');this.publish=at('signal-save');this.cancel=at('signal-cancel');
    this.add.onclick=()=>this.addHere();
    this.cancel.onclick=()=>this.close();
    this.form.oninput=()=>this.draw();
    this.form.onsubmit=event=>{event.preventDefault();void this.submit();};
  }

  get active(){return !!this.draft;}

  open(node=null){
    if(this.saving||!this.allowed(node))return;
    const avatar=this.position();
    const position=node?.position??(avatar&&nearestCreationPosition(avatar.x,avatar.z));
    if(!position)return;
    this.draft={node,position,target:node?.id??'node-'+crypto.randomUUID(),targets:structuredClone(node?.play.targets??[])};
    this.title.value=node?.title??'Jardín de señales';
    this.minimum.value=node?.play.minContributors??2;
    this.bridge.checked=node?.play.requiredBridgeRaised===true;
    this.notice.textContent='';
    this.form.hidden=false;this.render();this.title.focus();
  }

  recipe(){
    const play={...freshRecipe(),targets:this.draft.targets,minContributors:Number(this.minimum.value)};
    if(this.bridge.checked)play.requiredBridgeRaised=true;
    return play;
  }

  addHere(){
    const position=this.position();
    if(!position||!this.active||this.draft.targets.length>=4)return;
    const x=Math.round(position.x*100)/100,z=Math.round(position.z*100)/100,radius=.75;
    if(!creationContains(x,z,radius)){
      this.notice.textContent='Ubicate dentro de una zona de creación para agregar una señal.';
      return;
    }
    this.notice.textContent='';
    this.draft.targets.push({x,z,radius,color:tools[this.draft.targets.length][0]});
    this.render();
  }

  render(){
    this.list.replaceChildren(...this.draft.targets.map((target,index)=>{
      const row=this.document.createElement('li');
      const color=this.document.createElement('select');color.setAttribute('aria-label','Color de señal '+(index+1));
      for(const [value,label] of tools){
        const option=this.document.createElement('option');
        option.value=value;option.textContent=label;color.append(option);
        if(workshopColour(value)===workshopColour(target.color))color.value=value;
      }
      color.onchange=()=>{target.color=color.value;this.draw();};
      const remove=this.document.createElement('button');remove.type='button';remove.textContent='Quitar';
      remove.setAttribute('aria-label','Quitar señal '+(index+1));
      remove.onclick=()=>{this.draft.targets.splice(index,1);this.render();};
      const prompt=this.document.createElement('span');prompt.textContent='Señal '+(index+1);
      row.append(prompt,color,remove);return row;
    }));
    this.draw();
  }

  draw(){
    if(!this.active)return;
    const {targets}=this.draft;
    this.add.disabled=this.saving||targets.length>=4;
    this.publish.disabled=this.saving||!validSignalGarden(this.recipe())||!this.title.value.trim();
    this.preview(targets);
  }

  async submit(){
    if(!this.active||this.publish.disabled||this.saving)return;
    const {node,position,target}=this.draft;
    if(!this.allowed(node)){this.notice.textContent='Tu acceso o la edición cambió. Volvé a abrir el jardín.';return;}
    this.saving=true;
    for(const element of this.form.elements)element.disabled=true;
    const args={title:this.title.value.trim(),shape:node?.shape??'pedestal',position,
      links:(node?.links??[]).map(({id,revision})=>({id,revision})),play:this.recipe()};
    try{
      const result=await this.save(node,args,target);
      if(result?.status==='completed'){this.saving=false;this.close();}
      else if(result?.status==='rejected'||result?.status==='failed')
        this.notice.textContent='Volvé a abrir el jardín antes de guardar otros cambios.';
      else this.notice.textContent='Estoy comprobando si el cambio llegó. El jardín anterior sigue disponible.';
    }finally{
      this.saving=false;
      for(const element of this.form.elements)element.disabled=false;
      this.draw();
    }
  }

  close(){
    if(!this.active||this.saving)return;
    this.draft=null;this.form.hidden=true;this.preview(null);
    this.document.activeElement?.blur();
  }
}
