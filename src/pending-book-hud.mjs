import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const pendingToolId='pending-tool',pendingBookId='pending-book';
const pageSize=4, detailPageSize=8;
export const pendingBookWidth=2.55;
const path=key=>({'@path':'/'+key});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:{event:{name:id,context:{scope:path('scope')}}},...fields});
const panel=(width,label,children)=>({id:'root',component:'HudPanel',label,width,children});
const tool=[
  panel(.54,'Pendientes',['open']),
  button('open',path('label'),{pressed:path('fresh')}),
];
const rows=Array.from({length:pageSize},(_,i)=>button('entry'+i,path('entry'+i),{visible:path('has'+i)}));
const paragraph=Array.from({length:detailPageSize},(_,i)=>text('detail'+(i+1),path('detail'),{
  visible:path('detailLines'+(i+1)),style:'body',lines:i+1,
}));
const book=[
  {...panel(pendingBookWidth,'Libro de pendientes',['heading','status',...paragraph.map(item=>item.id),...rows.map(item=>item.id),'pages','actions']),gap:.022},
  {id:'heading',component:'HudRow',children:['title','close']},
  text('title','Pendientes',{style:'title',weight:4}),button('close','Cerrar'),
  text('status',path('status'),{visible:path('hasStatus'),style:'status',lines:2}),
  ...paragraph,...rows,
  {id:'pages',component:'HudRow',visible:path('hasPages'),children:['previous','page','next']},
  button('previous','Anterior',{disabled:path('first')}),text('page',path('page')),button('next','Siguiente',{disabled:path('last')}),
  {id:'actions',component:'HudRow',children:['back','conversation']},
  button('back','Volver',{visible:path('canBack')}),button('conversation','Conversar acá',{visible:path('canChat')}),
];

function linesOf(value,context){
  context.font='400 18px system-ui';
  const limit=520;
  const lines=[];
  let line='';
  for(const word of value.match(/\r?\n|[^\s]+/gu)??[]){
    if(word.endsWith('\n')){lines.push(line);line='';continue;}
    const next=line?line+' '+word:word;
    if(context.measureText(next).width<=limit){line=next;continue;}
    if(line)lines.push(line);
    line='';
    for(const glyph of word){
      if(line&&context.measureText(line+glyph).width>limit){lines.push(line);line='';}
      line+=glyph;
    }
  }
  if(line)lines.push(line);
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
  update(owner,visible,spatialBook=true){
    this.owner=owner;
    const show=owner&&!owner.button.hidden&&visible;
    const opened=Boolean(show&&owner.dialog.open&&spatialBook);
    if(!opened)this.page=0;
    this.surface(pendingToolId,tool,show?{scope:0,label:'? '+(owner.count||'…'),fresh:owner.fresh}:null);
    const entries=opened?[...owner.list.querySelectorAll('button')]:[];
    const text=opened?owner.list.querySelector('p')?.textContent:'';
    const revision=JSON.stringify([text,entries.map(node=>[node.dataset.pendingId,node.textContent])]);
    if(this.revision!==revision){
      this.revision=revision;this.scope++;this.page=0;
      if(text)this.lineContext??=owner.dialog.ownerDocument.createElement('canvas').getContext('2d');
      this.detailLines=text?linesOf(text,this.lineContext):[];
    }
    const bodyPages=Math.max(1,Math.ceil((this.detailLines?.length??0)/detailPageSize));
    const entryPages=Math.max(1,Math.ceil(entries.length/pageSize));
    const pages=Math.max(bodyPages,entryPages);
    this.page=Math.min(this.page,pages-1);
    this.entries=entries.slice(this.page*pageSize,this.page*pageSize+pageSize);
    const lines=(this.detailLines??[]).slice(this.page*detailPageSize,(this.page+1)*detailPageSize);
    const status=opened?(owner.status.textContent||(!entries.length&&!text?'No tenés pendientes.':'')):'';
    this.surface(pendingBookId,book,opened?{
      scope:this.scope,status,hasStatus:Boolean(status),hasPages:pages>1,page:`${this.page+1} de ${pages}`,
      first:this.page===0,last:this.page===pages-1,canBack:Boolean(text),canChat:Boolean(text),
      detail:lines.join('\n'),
      ...Object.fromEntries(rows.flatMap((_,i)=>[[`entry${i}`,this.entries[i]?.textContent||''],[`has${i}`,Boolean(this.entries[i])]])),
      ...Object.fromEntries(paragraph.map((_,i)=>[`detailLines${i+1}`,lines.length===i+1])),
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
