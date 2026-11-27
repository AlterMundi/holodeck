import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const pendingToolId='pending-tool',pendingBookId='pending-book';
const pageSize=4;
const path=key=>({'@path':'/'+key});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:{event:{name:id,context:{scope:path('scope')}}},...fields});
const panel=(width,label,children)=>({id:'root',component:'HudPanel',label,width,children});
const tool=[
  panel(.54,'Pendientes',['open']),
  button('open',path('label'),{pressed:path('fresh')}),
];
const rows=Array.from({length:pageSize},(_,i)=>button('entry'+i,path('entry'+i),{visible:path('has'+i)}));
const paragraph=Array.from({length:7},(_,i)=>text('line'+i,path('line'+i),{visible:path('showLine'+i),style:'body'}));
const book=[
  panel(2.55,'Libro de pendientes',['heading','status',...paragraph.map(item=>item.id),...rows.map(item=>item.id),'pages','actions']),
  {id:'heading',component:'HudRow',children:['title','close']},
  text('title','Pendientes',{style:'title',weight:3}),button('close','Cerrar'),
  text('status',path('status'),{visible:path('hasStatus'),style:'status'}),
  ...paragraph,...rows,
  {id:'pages',component:'HudRow',visible:path('hasPages'),children:['previous','page','next']},
  button('previous','‹',{disabled:path('first')}),text('page',path('page')),button('next','›',{disabled:path('last')}),
  {id:'actions',component:'HudRow',children:['back','conversation']},
  button('back','Volver',{visible:path('canBack')}),button('conversation','Conversar acá',{visible:path('canChat')}),
];
const fits=text=>text.length>65?text.slice(0,62)+'…':text;

function linesOf(value){
  const lines=[];
  let line='';
  for(const word of value.split(/\s+/).filter(Boolean)){
    if((line+' '+word).length>42&&line){lines.push(line);line='';}
    line+=(line?' ':'')+word;
    if(lines.length===7)break;
  }
  if(line&&lines.length<7)lines.push(line);
  if(lines.join(' ').length<value.trim().length&&lines.length)lines[lines.length-1]=lines.at(-1).slice(0,40)+'…';
  return lines;
}

export class PendingBookHud{
  constructor(send){this.send=send;this.states=new Map();this.page=0;this.scope=0;}
  surface(id,components,value){
    const current=this.states.get(id);
    if(!value){
      if(current){this.send('deleteSurface',{},id);this.states.delete(id);}
      return;
    }
    const signature=JSON.stringify(value);
    if(!current){
      this.send('createSurface',{catalogId:spatialHudCatalog.id},id);
      this.send('updateComponents',{components},id);
    }
    if(signature!==current){
      this.send('updateDataModel',{value},id);
      this.states.set(id,signature);
    }
  }
  update(owner,visible){
    this.owner=owner;
    const show=owner&&!owner.button.hidden&&visible;
    const opened=Boolean(show&&owner.dialog.open);
    if(!opened)this.page=0;
    this.surface(pendingToolId,tool,show?{scope:0,label:'? '+(owner.count||'…'),fresh:owner.fresh}:null);
    const entries=opened?[...owner.list.querySelectorAll('button')]:[];
    const text=opened?owner.list.querySelector('p')?.textContent:'';
    const revision=entries.map(node=>[node.dataset.pendingId,node.textContent]).map(x=>x.join(':')).join('|');
    if(this.revision!==revision){this.revision=revision;this.scope++;this.page=0;}
    const pages=Math.max(1,Math.ceil(entries.length/pageSize));
    this.page=Math.min(this.page,pages-1);
    this.entries=entries.slice(this.page*pageSize,this.page*pageSize+pageSize);
    const lines=linesOf(text??'');
    this.lineCount=lines.length;
    const status=opened?(owner.status.textContent||(!entries.length&&!text?'No tenés pendientes.':'')):'';
    this.surface(pendingBookId,book,opened?{
      scope:this.scope,status:fits(status),hasStatus:Boolean(status),hasPages:pages>1,page:`${this.page+1} de ${pages}`,
      first:this.page===0,last:this.page===pages-1,canBack:Boolean(text),canChat:Boolean(text),
      ...Object.fromEntries(rows.flatMap((_,i)=>[[`entry${i}`,fits(this.entries[i]?.textContent||'')],[`has${i}`,Boolean(this.entries[i])]])),
      ...Object.fromEntries(paragraph.flatMap((_,i)=>[[`line${i}`,lines[i]??''],[`showLine${i}`,Boolean(lines[i])]])),
    }:null);
  }
  activate({surfaceId,name,context}){
    const owner=this.owner;
    if(!owner)return;
    if(surfaceId===pendingToolId&&name==='open'){
      if(owner.dialog.open)owner.close();else owner.open();
      return;
    }
    if(!owner.dialog.open||context?.scope!==this.scope)return;
    if(name==='close')owner.close();
    else if(name==='back')owner.back();
    else if(name==='conversation')owner.conversation();
    else if(name==='previous'||name==='next'){
      this.page=Math.max(0,this.page+(name==='next'?1:-1));
      this.scope++;
    }
    else if(/^entry[0-3]$/.test(name))this.entries[Number(name.at(-1))]?.click();
  }
  present(tool,book){
    this.owner?.button.toggleAttribute('data-native-pending',tool);
    this.owner?.dialog.toggleAttribute('data-native-pending',book);
  }
}
