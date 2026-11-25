import {workshopColour} from './workshop.mjs';
const labels={'garden.place':'Una luz nueva','garden.update':'Una luz cambió','garden.remove':'Se retiró una luz','node.place':'Una creación nueva','node.update':'Cambió una creación','node.remove':'Se retiró una creación','focus.set':'Referencia compartida','focus.clear':'Se dejó de señalar','projection.changed':'Cambió una presencia','participant.joined':'Entrada al mundo','participant.left':'Salida del mundo'};
export function activityTitle(item){return item.type==='bridge.set'?(item.recorded?.raised?'Las islas se conectaron':'Las islas se separaron'):labels[item.type]||'Actividad registrada';}
export function activityAuthor(item){return item.author?.isSelf?'Vos':item.author?.name||(/^dm:being:v1:/.test(item.author?.ref||'')?'Un daimon':/^human:/.test(item.author?.ref||'')?'Otra persona':'Un participante');}
const number=value=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(value);
export const activityTime=value=>Number.isFinite(value)&&Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}):'Fecha no registrada';
const colours={mint:'menta',amber:'ámbar',rose:'rosa',violet:'violeta','#8ce4c2':'menta','#efc87a':'ámbar','#e8a2b9':'rosa','#a77bea':'violeta'};
export function activityStateLines(state){
 if(!state)return ['No se conserva el detalle de este estado.'];
 const lines=[];if(state.title)lines.push(state.title);
 if(state.kind==='bridge')lines.push(state.raised?'Islas conectadas':'Islas separadas');
 if(state.kind==='light')lines.push('Luz '+(colours[state.color]||'de color personalizado'));
 if(state.kind==='node'){
  lines.push(state.content==='game'?'Juego compartido':'Creación compartida');
  if(state.play){lines.push(`${state.play.targets.length} señales · al menos ${state.play.minContributors} colaboradores`);lines.push('Colores: '+state.play.targets.map(target=>colours[target.color]||'personalizado').join(', '));if(state.play.requiredBridgeRaised)lines.push('Necesita conectar las islas');}
 }
 if(state.kind==='projection')lines.push({orb:'Presencia esférica',beacon:'Baliza',avatar:'Avatar'}[state.form]||'Presencia visual');
 if(state.kind==='presence')lines.push(state.present?'En el mundo':'Fuera del mundo');
 if(state.kind==='focus')lines.push(state.active?'Referencia señalada explícitamente':'Se dejó de compartir la referencia');
 if(state.deleted)lines.push('Retirado del mundo');
 const at=state.position||state;if(Number.isFinite(at.x)&&Number.isFinite(at.z))lines.push(`Ubicación: ${number(at.x)} / ${number(at.z)} m`);
 return lines.length?lines:['No se conserva el detalle de este estado.'];
}
export class WorldHistory{
 constructor({document,window,load,getState,onPoint,onDiscuss,resumeWorld}){
  Object.assign(this,{document,window,load,getState,onPoint,onDiscuss,resumeWorld});this.$=id=>document.querySelector('#'+id);this.dialog=this.$('activity-dialog');this.launcher=this.$('activity-open');this.data=null;this.selected=null;this.cursors=[null];this.page=0;this.epoch=0;this.pointBusy=false;this.explicit=false;
  this.launcher.onclick=()=>this.open();this.$('activity-close').onclick=()=>this.close();
  this.cancel=e=>{e.preventDefault();this.close();};this.dialog.addEventListener('cancel',this.cancel);
  this.$('activity-refresh').onclick=()=>this.fetchPage({fresh:true});
  this.$('activity-older').onclick=()=>{if(this.data?.nextBefore!==null&&this.data?.nextBefore!==undefined)this.fetchPage({before:this.data.nextBefore,page:this.page+1});};
  this.$('activity-newer').onclick=()=>{if(this.page>0)this.fetchPage({before:this.cursors[this.page-1],page:this.page-1});};
  this.$('activity-point').onclick=()=>this.point();
  this.$('activity-discuss').onclick=()=>this.discuss();
 }
 element(tag,text,className){const el=this.document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
 message(text){this.status=text;this.$('activity-status').textContent=text;}
 observe(state){
  const old=this.binding;this.binding=state?{actor:state.actorRef,run:state.run}:null;this.launcher.disabled=!state;
  if(old&&(old.actor!==this.binding?.actor||old.run!==this.binding?.run)){
   this.epoch++;this.request?.abort();this.loading=false;this.data=null;this.selected=null;this.explicit=false;this.cursors=[null];this.page=0;this.$('activity-list').replaceChildren();this.$('activity-count').textContent='';this.$('activity-gap').hidden=true;this.renderDetail();this.controls();
   if(this.opened)this.message('El mundo o tu acceso cambió. Mostrá la actividad reciente para continuar.');
  }
  this.$('activity-updates').hidden=!this.data||!state||state.sequence<=this.data.currentThrough;
 }
 setNative(active){
  if(Boolean(this.native)===active)return;
  this.native=active;
  if(active){
   this.inertTargets=[...this.document.querySelectorAll('#conversation-panel,#creator,#content-visit,#world-tools,#dock,#space-travel,#hud')]
     .filter(element=>!element.inert);
   for(const element of this.inertTargets)element.inert=true;
  }else{
   for(const element of this.inertTargets??[])element.inert=false;
   this.inertTargets=null;
  }
 }
 async open({native=false}={}){
  if(!this.getState()||this.opened)return;
  this.opened=true;this.setNative(native);
  if(!native)this.dialog.showModal();
  if(!this.data)await this.fetchPage({fresh:true});
 }
 fallback(){
  if(!this.native||!this.opened)return;
  this.setNative(false);
  this.dialog.showModal();
 }
 close(){
  if(!this.opened)return;
  const native=this.native;
  this.opened=false;this.setNative(false);this.epoch++;this.request?.abort();this.request=null;
  if(this.loading)this.message('');
  this.loading=false;if(this.dialog.open)this.dialog.close();
  this.controls();this.resumeWorld(native);
 }
 select(sequence){
  const item=this.data?.items.find(record=>record.sequence===sequence);
  if(!item||this.loading||this.pointBusy||!this.opened)return;
  this.selected=item;this.explicit=false;
  for(const button of this.$('activity-list').querySelectorAll('button'))
    button.setAttribute('aria-pressed',String(button.dataset.sequence===String(sequence)));
  this.renderDetail();
 }
 discuss(){
  if(!this.reference()||this.loading||this.pointBusy)return;
  this.explicit=true;this.close();this.onDiscuss();
 }
 clearReference(){this.explicit=false;}
 conversationLabel(){return this.explicit&&this.selected?activityTitle(this.selected)+(this.selected.recorded?.title?': '+this.selected.recorded.title:''):null;}
 reference(){
  if(!this.data||!this.selected||(!this.opened&&!this.explicit))return null;
  const state=this.getState();if(!state||state.run!==this.data.run)return null;
  return{schema:'holodeck.history-reference/v1',run:this.data.run,edition:this.data.edition,sequence:this.selected.sequence,panelVisible:Boolean(this.opened),explicit:this.explicit};
 }
 async fetchPage({fresh=false,before=null,page=0}={}){
  if(!this.opened||this.pointBusy)return;
  const state=this.getState();if(!state)return;
  this.request?.abort();const request=new AbortController(),epoch=++this.epoch;this.request=request;this.loading=true;this.controls();this.message('Buscando la actividad…');
  const query={run:state.run,limit:20};if(!fresh&&this.data&&before!==null)Object.assign(query,{through:this.data.through,before});
  const timer=setTimeout(()=>request.abort(),5000);
  try{
   const value=await this.load(query,{signal:request.signal});
   if(epoch!==this.epoch||!this.opened||this.getState()?.actorRef!==state.actorRef||this.getState()?.run!==state.run)return;
   if(value?.schema!=='holodeck.activity/v1'||value.observer!==state.actorRef||value.run!==state.run||!Array.isArray(value.items)||value.items.length>20||new TextEncoder().encode(JSON.stringify(value)).length>32768)throw Error('No pude leer esta página de actividad.');
   const previous=this.selected?.sequence;this.data=value;
   if(fresh){this.cursors=[null];this.page=0;}else{this.page=page;this.cursors[page]=before;this.cursors=this.cursors.slice(0,page+1);if(this.cursors.length>257)throw Error('Volvé a los cambios recientes para continuar.');}
   this.selected=value.items.find(item=>item.sequence===previous)||value.items[0]||null;if(this.selected?.sequence!==previous)this.explicit=false;this.render();this.message('');
  }catch(error){
   if(epoch!==this.epoch||!this.opened)return;
   if([401,403].includes(error.httpStatus)){this.observe(null);return;}
   this.message(error.code==='stale-run'?'Esta actividad pertenece a otra etapa. Mostrá los cambios recientes.':error.httpStatus?error.message:'No pude recuperar la actividad. Podés volver a intentarlo.');
  }
  finally{clearTimeout(timer);if(epoch===this.epoch){this.loading=false;this.request=null;this.controls();}}
 }
 controls(){
  const busy=this.loading||this.pointBusy;this.$('activity-refresh').disabled=!!busy;
  this.$('activity-newer').disabled=!!busy||this.page===0;this.$('activity-older').disabled=!!busy||!this.data?.nextBefore;
  this.$('activity-point').disabled=!!busy;this.$('activity-discuss').disabled=!!busy;
  for(const button of this.$('activity-list').querySelectorAll('button'))button.disabled=!!this.pointBusy;
 }
 render(){
  const value=this.data,list=this.$('activity-list');list.replaceChildren();
  this.$('activity-count').textContent=`${value.items.length} ${value.items.length===1?'cambio':'cambios'} de ${value.retention.count} conservados`;
  this.$('activity-gap').hidden=!value.gaps.earlierUnavailable&&!value.gaps.cursorEvicted&&!value.gaps.missingSequences;
  this.$('activity-gap').textContent=value.gaps.cursorEvicted?'Esa parte del historial ya no está disponible. Podés volver a los cambios recientes.':'Los cambios anteriores o algunos detalles ya no están disponibles aquí.';
  if(!value.items.length)list.append(this.element('li','No hay cambios disponibles en esta parte del historial.','activity-empty'));
  for(const item of value.items){
   const li=this.element('li'),button=this.element('button',undefined,'activity-item');button.type='button';button.dataset.sequence=String(item.sequence);button.setAttribute('aria-pressed',String(item.sequence===this.selected?.sequence));
   button.append(this.element('strong',activityTitle(item)),this.element('span',`${activityAuthor(item)} · ${activityTime(item.time)}`,'activity-meta'));
   if(item.recorded?.title)button.append(this.element('span',item.recorded.title));
   button.onclick=()=>this.select(item.sequence);li.append(button);list.append(li);
  }
  this.renderDetail();this.observe(this.getState());this.controls();
 }
 renderDetail(){
  const detail=this.$('activity-detail');detail.replaceChildren();const item=this.selected;
  this.$('activity-point').hidden=!item?.current?.actionable||!item.target;this.$('activity-discuss').hidden=!item;
  if(!item){detail.append(this.element('p','Elegí un cambio para verlo.'));return;}
  detail.append(this.element('h3',activityTitle(item)),this.element('p',`${activityAuthor(item)} · ${activityTime(item.time)}`,'activity-meta'));
  const comparison=this.element('div',undefined,'activity-comparison');
  for(const[title,snapshot]of [['En ese cambio',item.recorded],['Ahora',item.current.state]]){
   const card=this.element('section',undefined,'activity-snapshot');card.append(this.element('h4',title));
   if(snapshot?.kind==='light'&&workshopColour(snapshot.color)){const swatch=this.element('span',undefined,'activity-swatch');swatch.style.backgroundColor=workshopColour(snapshot.color);swatch.setAttribute('aria-hidden','true');card.append(swatch);}
   for(const text of activityStateLines(snapshot))card.append(this.element('p',text));comparison.append(card);
  }
  detail.append(comparison);
  detail.append(this.element('p',`Estado actual consultado: ${activityTime(this.data.capturedAt)}.`,'activity-meta'));
  detail.append(this.element('p',({current:'El objeto conserva esa versión.',revised:'El objeto cambió después de ese momento.',deleted:'El objeto fue retirado; no se puede señalar como un objeto actual.',unavailable:'No hay un estado actual comparable para este registro.'})[item.current.status]||'','activity-meta'));
  detail.append(this.element('p','Se muestra el estado registrado después del cambio. El mundo sigue en el presente.','activity-meta'));
 }
 async point(){
  const item=this.selected,reference=this.reference();if(!item?.current?.actionable||!reference||this.pointBusy)return;
  this.pointBusy=true;this.controls();
  try{const result=await this.onPoint({target:item.target,run:reference.run,edition:reference.edition,actorRef:this.getState()?.actorRef});if(result?.status==='completed')this.close();}
  catch(error){if(this.opened)this.message(error.userMessage||(error.httpStatus?error.message:'No pude compartir la referencia. Podés volver a intentarlo.'));}
  finally{this.pointBusy=false;this.controls();}
 }
 dispose(){this.setNative(false);this.epoch++;this.request?.abort();this.dialog.removeEventListener('cancel',this.cancel);this.launcher.onclick=null;}
}
