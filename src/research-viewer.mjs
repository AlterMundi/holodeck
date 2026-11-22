import {readResearchResponse} from './research-content.mjs';
import {mountReview} from './review-component.js';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const stage={generated:'Geometría generada','geometrically-validated':'Geometría verificada',sliced:'Laminado registrado',printed:'Impresión reportada'};
const date=when=>when.precision==='unknown'?'Fecha sin documentar':when.value;
let downloadOrigin=null;
window.addEventListener('message',event=>{
 if(event.source!==parent||!/^https:\/\/[^/]+$/.test(event.origin)||event.data?.type!=='home-artifact:capabilities')return;
 downloadOrigin=event.data.downloads===true?event.origin:null;
 for(const button of document.querySelectorAll('[data-download-path]'))button.disabled=!downloadOrigin;
 for(const note of document.querySelectorAll('.download-help'))note.textContent=downloadOrigin?'Descargá los archivos desde estos botones.':'Los archivos están en la lista de esta publicación de Home, fuera del visor.';
});
function empty(title,detail){const box=node('div',undefined,'empty');box.append(node('h3',title),node('p',detail));return box;}
function sourceEntry(source){
 const item=node('li');item.id='source-'+source.id;item.append(node('h4',source.title),node('p',[source.author,date(source.publishedAt),source.revision].filter(Boolean).join(' · '),'byline'));
 const field=node('input');field.type='text';field.readOnly=true;field.value=source.url;field.setAttribute('aria-label','Enlace a '+source.title);
 const copy=node('button','Copiar enlace','button secondary'),status=node('p','','byline');
 copy.onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(source.url);status.textContent='Enlace copiado.';}catch{field.focus();field.select();status.textContent='Seleccioná el enlace para copiarlo.';}};
 item.append(field,copy,status);return item;
}
function timeline(rows,sources,heading,detail){
 const section=node('section');section.append(node('h3',heading));
 if(!rows.length){section.append(empty('Todavía no hay entradas',detail));return section;}
 const list=node('ol',undefined,'timeline');
 for(const row of rows){const item=node('li');item.append(node('span',date(row.when),'date'),node('h4',row.title),node('p',row.text));
  if(row.confidence==='tentative')item.append(node('p','Interpretación por verificar','qualification'));
  if(row.author)item.append(node('p','Autoría declarada: '+row.author,'byline'));
  const links=node('div',undefined,'evidence-links');for(const ref of row.evidence){const source=sources.find(s=>s.id===ref),button=node('button',source.title,'source-reference');button.onclick=()=>{choose($('tab-research'));$('source-'+ref)?.scrollIntoView({block:'nearest'});};links.append(button);}item.append(links);list.append(item);
 }section.append(list);return section;
}
function display(data){
 $('subject').textContent=data.subject.name;$('place').textContent=data.subject.place;
 document.title=data.subject.name+' · Holodeck';
 $('status').textContent=data.status==='awaiting-source'?'Investigación pendiente de incorporar':data.status==='draft'?'Investigación en desarrollo':'Edición con fuentes';
 $('edition').textContent='Edición '+data.revision;
 const history=$('history');history.replaceChildren(
  timeline(data.subjectHistory,data.sources,'La historia del tema','Acá aparecerán los hechos y sus fuentes, con las fechas que estén documentadas.'),
  timeline(data.researchHistory,data.sources,'Cómo fue creciendo la investigación','Acá aparecerán las preguntas, aportes y cambios de interpretación, sin mezclarlos con los hechos del tema.'));
 const research=$('research');research.replaceChildren();
 if(data.summary.trim())research.append(node('p',data.summary,'summary'));
 else research.append(empty('La investigación se incorpora acá','Estamos esperando el material compartido. Las fuentes, notas y conclusiones se incorporarán en esta misma ficha.'));
 const heading=node('h3','Fuentes');research.append(heading);
 if(!data.sources.length)research.append(node('p','Todavía no se cargaron fuentes de la investigación.','muted'));
 else{const list=node('ol',undefined,'sources');for(const source of data.sources)list.append(sourceEntry(source));research.append(list,node('p','Los enlaces conservan los permisos de sus fuentes originales.','byline'));}
 const designs=$('designs');designs.replaceChildren();
 if(!data.designs.length)designs.append(empty('Diseños por crear','Las versiones de la figura y sus archivos aparecerán acá.'));
 for(const design of data.designs){const article=node('article',undefined,'design');article.append(node('span',stage[design.stage],'tag'),node('h3',design.title),node('p',design.note));
  const {widthMm,heightMm,depthMm}=design.dimensions;article.append(node('p',`${heightMm} mm de alto · ${widthMm} × ${depthMm} mm de base`,'measure'));
  const actions=node('div',undefined,'downloads');for(const [key,label]of [['stl','Descargar STL'],['glb','Descargar GLB']]){const button=node('button',label,'button secondary');button.dataset.downloadPath=design.assets[key];button.disabled=!downloadOrigin;button.onclick=()=>{if(downloadOrigin&&/^media\/[a-f0-9]{64}\.(stl|glb)$/.test(design.assets[key]))parent.postMessage({type:'home-artifact:download',path:design.assets[key]},downloadOrigin);};actions.append(button);}article.append(actions,node('p',downloadOrigin?'Descargá los archivos desde estos botones.':'Los archivos están en la lista de esta publicación de Home, fuera del visor.','byline download-help'));
  const notes=node('details'),summary=node('summary','Estado de fabricación');notes.append(summary,node('p',design.evidence.watertight?'Malla cerrada; '+design.evidence.components+' cuerpo conectado.':'La malla todavía necesita revisión.'));
  notes.append(node('p',design.evidence.profile||'Sin perfil de laminado verificado. Todavía no se preparó un trabajo de impresión.'));
  if(design.evidence.physicalNote)notes.append(node('p',design.evidence.physicalNote));article.append(notes);designs.append(article);
 }
 const first=data.designs[0];if(first){$('model').hidden=false;$('model').setAttribute('aria-label','Modelo 3D de '+data.subject.name);$('model-state').textContent='Abriendo la figura…';
  modelReady.then(controller=>{controller.redraw();if(window.researchPreview)window.researchPreview.modelReady=true;$('model-state').textContent='Figura de trabajo · podés girarla y acercarte';},()=>{$('model-state').textContent='No pudimos abrir la figura. Recargá esta ficha para volver a intentar.';});}
 else{$('model').hidden=true;$('model-state').textContent='Todavía no hay una figura publicada.';}
 $('loading').hidden=true;$('workspace').hidden=false;
 window.researchPreview={id:data.id,revision:data.revision,status:data.status,sourceCount:data.sources.length,modelReady:false};
}
const tabs=[...document.querySelectorAll('[role=tab]')];
function choose(tab){for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;$(t.getAttribute('aria-controls')).hidden=!active;}}
for(const tab of tabs){tab.addEventListener('click',()=>choose(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;choose(tabs[next]);tabs[next].focus();});}
async function load(){try{$('retry').hidden=true;$('loading').textContent='Abriendo esta edición…';display(await readResearchResponse(await fetch('research.json',{cache:'no-store',credentials:'same-origin'})));}catch(error){$('workspace').hidden=true;$('loading').hidden=false;$('loading').textContent='No pudimos abrir esta edición. '+error.message;$('retry').hidden=false;}}
const modelReady=mountReview($('model'));modelReady.catch(()=>{});
$('retry').addEventListener('click',load);load();
