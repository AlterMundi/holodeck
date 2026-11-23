import {creationContains,nearestCreationPosition} from './world-layout.mjs';
import {validSignalGarden} from './playable-creations.mjs';
import {workshopColour} from './workshop.mjs';

const freshRecipe=()=>({schema:'signal-garden/v1',minContributors:2,targets:[]});
const tools=[['mint','Menta'],['amber','Ámbar'],['rose','Rosa'],['violet','Violeta']];

export class SignalGardenEditor{
  constructor({document,position,save,remove,preview,allowed}){
    Object.assign(this,{document,position,save,remove,preview,allowed});
    const at=id=>document.getElementById(id);
    this.form=at('signal-editor');this.list=at('signal-targets');this.notice=at('signal-notice');
    this.title=at('signal-title');this.minimum=at('signal-minimum');this.bridge=at('signal-bridge');
    this.add=at('signal-add');this.publish=at('signal-save');this.cancel=at('signal-cancel');
    this.heading=at('signal-heading');this.fields=at('signal-fields');
    this.actions=at('signal-actions');this.retire=at('signal-remove');
    this.confirm=at('signal-remove-confirm');this.confirmTitle=at('signal-remove-title');
    this.back=at('signal-remove-back');this.retireAccept=at('signal-remove-accept');
    this.add.onclick=()=>this.addHere();
    this.cancel.onclick=()=>this.close();
    this.retire.onclick=()=>this.confirmRemoval();
    this.back.onclick=()=>{this.draft.confirming=false;this.draw();this.retire.focus();};
    this.retireAccept.onclick=()=>void this.submit(true);
    this.form.oninput=()=>this.draw();
    this.form.onsubmit=event=>{event.preventDefault();if(!this.draft?.confirming)void this.submit();};
  }

  get active(){return !!this.draft;}

  open(node=null){
    if(this.saving||this.active||!this.allowed(node))return;
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

  confirmRemoval(){
    const node=this.draft?.node;
    if(!node||this.saving||this.draft.pendingId||this.draft.stale)return;
    if(!this.allowed(node)){this.changed();return;}
    this.draft.confirming=true;
    this.confirmTitle.textContent='¿Retirar «'+node.title+'»?';
    this.draw();this.form.scrollTop=0;this.back.focus();
  }

  changed(){
    this.draft.stale=true;
    this.draft.confirming=false;
    this.notice.textContent='El jardín o tu acceso cambió. Cerrá esta vista y volvé a elegir el jardín.';
    this.draw();
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
    const {targets,node,pendingId,stale,confirming}=this.draft;
    const locked=this.saving||!!pendingId||!!stale;
    for(const element of this.form.elements)element.disabled=locked||!!confirming;
    this.add.disabled=locked||!!confirming||targets.length>=4;
    this.publish.disabled=locked||!!confirming||!validSignalGarden(this.recipe())||!this.title.value.trim();
    this.heading.textContent=confirming?'Retirar jardín':'Jardín de señales';
    this.fields.hidden=this.add.hidden=this.publish.hidden=!!confirming;
    this.retire.hidden=!node||!!confirming;
    this.actions.hidden=!!confirming&&!pendingId;
    this.confirm.hidden=!confirming||!!pendingId;
    this.back.disabled=locked;
    this.retireAccept.disabled=locked;
    this.cancel.disabled=this.saving;
    this.cancel.textContent=pendingId||stale?'Cerrar':'Cancelar';
    this.preview(targets);
  }

  async submit(removing=false){
    const draft=this.draft;
    if(!draft||(removing?this.retireAccept.disabled||!draft.confirming:this.publish.disabled)||this.saving)return;
    const {node,position,target}=draft;
    if(!this.allowed(node)){this.changed();return;}
    this.saving=true;this.notice.textContent='';this.draw();
    const track=id=>{
      draft.pendingId=id;
      this.notice.textContent='Confirmando el cambio…';
      this.draw();
    };
    try{
      if(removing)await this.remove(node,track);
      else await this.save(node,{title:this.title.value.trim(),shape:node?.shape??'pedestal',position,
        links:(node?.links??[]).map(({id,revision})=>({id,revision})),play:this.recipe()},target,track);
      if(this.draft!==draft||draft.stale)return;
      this.notice.textContent=draft.pendingId?
        'Todavía falta confirmar el cambio. Podés comprobarlo o cerrar esta vista.':
        'El cambio no se envió. Podés intentarlo de nuevo.';
    }finally{
      this.saving=false;
      this.draw();
    }
  }

  settle(command,status){
    if(!this.draft||this.draft.pendingId!==command)return;
    this.draft.pendingId=null;
    if(status==='completed')this.dismiss();
    else this.changed();
  }

  untrack(command){
    if(!this.draft||this.draft.pendingId!==command)return;
    this.draft.pendingId=null;
    this.changed();
  }

  close(){
    if(this.active&&!this.saving)this.dismiss();
  }

  dismiss(){
    this.draft=null;this.form.hidden=true;this.preview(null);
    this.document.activeElement?.blur();
  }
}
