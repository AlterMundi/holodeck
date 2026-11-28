import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const wandaHudId='wanda-observatory';
export const wandaHudWidth=2.17;
const path=key=>({'@path':'/'+key});
const context={nodeId:path('nodeId'),captureId:path('captureId'),revision:path('revision')};
const actions=new Map([
  ['inspect_eyepiece','Abrir ocular'],
  ['inspect_poster','Ver póster completo'],
]);
const phaseLabels={latest:'Última captura',live:'Vista en vivo',exposing:'Exposición en curso',offline:'Nodo desconectado'};
const components=[
  {id:'root',component:'HudPanel',label:'Observatorio de Nix',width:wandaHudWidth,children:['status','details',...actions.keys()]},
  {id:'status',component:'HudText',label:path('status'),style:'status',lines:2},
  {id:'details',component:'HudText',label:path('details'),style:'status',lines:2},
  ...Array.from(actions,([id,label])=>({id,component:'HudButton',label,disabled:path('unavailable'),
    action:{event:{name:id,context}}})),
];

export function wandaHudData(view){
  const {nodeId,captureId,revision,phase,simulated,capturedAt,exposureUs,analogueGain}=view;
  const source=simulated?' · Simulación':'';
  const archived=captureId&&phase!=='latest'?' · Captura archivada':'';
  const details=captureId?`${capturedAt.slice(0,10)} ${capturedAt.slice(11,19)} UTC · ${exposureUs/1000} ms · ${analogueGain}×`:'Sin captura disponible';
  return {nodeId,captureId,revision,status:(phaseLabels[phase]??phaseLabels.offline)+source+archived,
    details,unavailable:!captureId};
}

export class WandaHud {
  constructor({document,send,request,onOpen,onError}){
    Object.assign(this,{document,send,request,onOpen,onError});
  }

  update(view,visible){
    if(this.view?.revision!==view?.revision)this.cancel();
    this.view=view;
    const model=visible&&view?wandaHudData(view):null;
    if(!model){
      if(this.signature)this.send('deleteSurface',{},wandaHudId);
      this.signature=this.group=null;
      return;
    }
    if(!this.signature){
      this.send('createSurface',{catalogId:spatialHudCatalog.id},wandaHudId);
      this.send('updateComponents',{components},wandaHudId);
    }
    const signature=JSON.stringify(model);
    if(signature!==this.signature)this.send('updateDataModel',{value:model},wandaHudId);
    this.signature=signature;
  }

  async activate(action){
    const {view}=this,ctx=action.context;
    if(!this.signature||!view?.captureId||!actions.has(action.name)||this.pending||
       ctx?.revision!==view.revision||ctx.nodeId!==view.nodeId||ctx.captureId!==view.captureId)return;
    const controller=new AbortController();
    this.pending=controller;
    try{
      const result=await this.request(action,controller.signal);
      if(controller.signal.aborted)return;
      if(result?.revision!==view.revision||result.nodeId!==view.nodeId||result.captureId!==view.captureId||
         result.sha256!==view.sha256||result.media!==view.eyepiece||result.target!==action.name)
        throw Error('Capture changed');
      this.open(result);
    }catch{
      if(!controller.signal.aborted)this.onError('La captura de WANDA ya no está disponible en esta sala.');
    }finally{
      if(this.pending===controller)this.pending=null;
    }
  }

  open(capture){
    this.onOpen();
    const {document}=this;
    const dialog=document.createElement('dialog');
    dialog.className='wanda-inspection';
    const title=document.createElement('h2');
    title.id='wanda-inspection-title';
    title.textContent=capture.target==='inspect_eyepiece'?'Ocular WANDA':'Observación fijada';
    dialog.setAttribute('aria-labelledby',title.id);
    const header=document.createElement('header');
    const close=document.createElement('button');
    close.type='button';
    close.textContent='Volver a la sala';
    close.onclick=()=>dialog.close();
    header.append(title,close);
    const image=document.createElement('img');
    image.alt='Campo completo de la observación WANDA';
    image.width=capture.width;
    image.height=capture.height;
    const caption=document.createElement('p');
    caption.textContent=`${capture.captureId} · ${capture.width} × ${capture.height} · ${wandaHudData(capture).status} · ${wandaHudData(capture).details}`;
    image.onerror=()=>{image.hidden=true;caption.textContent='El fotograma ya no está disponible en esta sala.';};
    dialog.append(header,image,caption);
    document.body.append(dialog);
    this.dialog=dialog;
    dialog.addEventListener('close',()=>{
      if(this.dialog===dialog)this.dialog=null;
      image.removeAttribute('src');
      dialog.remove();
    },{once:true});
    image.src=capture.media;
    dialog.showModal();
  }

  cancel(){
    this.pending?.abort();
    this.pending=null;
    if(this.dialog?.open)this.dialog.close();
  }
}
