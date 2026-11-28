import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const teleportHudId='world-teleport';
export const teleportHudWidth=2.72;
const pageSize=4;
const path=name=>({'@path':'/'+name});
const action=(name,fields={})=>({event:{name,context:{epoch:path('epoch'),...fields}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const categories=[
  {id:'favorites',label:'Favoritos'},{id:'terrain',label:'Terreno público'},{id:'houses',label:'Casas'},
];
const slotNames=Array.from({length:pageSize},(_,i)=>'slot'+i);
const row=(id,children)=>({id,component:'HudRow',children});
const components=[
  {id:'root',component:'HudPanel',chrome:'none',label:'Teletransporte',width:teleportHudWidth,gap:.018,
    children:['heading','categories','back','models','space','travel','actions','message']},
  {...row('heading',['close']),visible:path('cameraMounted')},
  button('close','Cerrar'),
  {...row('categories',categories.map(({id})=>id)),visible:path('cameraMounted')},
  ...categories.map(({id,label})=>button(id,label,{pressed:path(id+'Active'),disabled:path('loading')})),
  button('back',path('backLabel'),{visible:path('physicalBack'),gestureKey:path('level'),
    action:action('back',{level:path('level')})}),
  row('models',slotNames),
  ...slotNames.map(id=>button(id,path(id+'Label'),{visible:path(id+'Visible'),pressed:path(id+'Active'),
    gestureKey:path(id+'Key'),action:action(id,{selected:path(id+'Key'),level:path('level')})})),
  text('space','',{lines:6}),
  row('travel',['go']),
  {...row('actions',['previous','favorite','next']),visible:path('cameraMounted')},
  button('previous','Destinos anteriores',{disabled:path('noPrevious')}),
  button('favorite',path('favoriteLabel'),{pressed:path('isFavorite'),disabled:path('noSelection'),gestureKey:path('destination'),
    action:action('favorite',{selected:path('destination')})}),
  button('go','Viajar',{disabled:path('noTravel'),gestureKey:path('destination'),
    action:action('go',{selected:path('destination')})}),
  button('next','Más destinos',{disabled:path('noNext')}),
  text('message',path('message'),{style:'status',visible:path('hasMessage'),lines:2}),
];
const byName=(a,b)=>a.localeCompare(b,'es');
const maxFavorites=128;

// A map projection can use the same stable node IDs and miniature families.
export function teleportModelId(id){
  if(id.startsWith('object:'))return 'table';
  if(id.startsWith('room:'))return 'room';
  if(id.startsWith('house:'))return 'house';
  return id==='terrain:residence'?'residence':'plaza';
}

export class TeleportHud {
  constructor({send,read,go,focus,onOpen,onClose,onSelect,onViewData,prepare,travelMotion,storage}){
    Object.assign(this,{send,read,go,focus,onOpen,onClose,onSelect,onViewData,prepare,travelMotion,storage,epoch:0});
  }

  message(type,content){this.send(type,content,teleportHudId);}

  async open(space){
    if(this.group||this.preparing)return;
    const epoch=++this.epoch;
    if(this.prepare){
      this.preparing=true;
      this.physical=await this.prepare();
      this.preparing=false;
      if(epoch!==this.epoch)return;
    }
    this.key='holodeck:teleport:favorites:'+space.actorRef;
    this.favorites=new Set();
    try{
      const saved=JSON.parse(this.storage.getItem(this.key));
      if(Array.isArray(saved))for(const id of saved.slice(0,maxFavorites)){
        if(typeof id==='string'&&id.length<=160)this.favorites.add(id);
      }
    }catch{}
    Object.assign(this,{category:'terrain',branch:'',branchTrail:[],destination:'',page:0,level:0,entries:[],children:new Map(),loading:true,error:''});
    this.message('createSurface',{catalogId:spatialHudCatalog.id});
    this.message('updateComponents',{components});
    this.onOpen();
    this.update();
    this.focus('close');
    try{
      const result=await this.read();
      if(epoch!==this.epoch)return;
      if(result.space!==space.id)throw Error('Location changed');
      this.entries=result.destinations;
      const byId=new Map(this.entries.map(entry=>[entry.id,entry]));
      for(const entry of this.entries){
        const parent=this.parentOf(entry);
        if(parent&&byId.has(parent)){
          if(!this.children.has(parent))this.children.set(parent,[]);
          this.children.get(parent).push(entry);
        }
        const linked=(entry.links??[]).map(id=>byId.get(id)).filter(Boolean);
        if(linked.length)this.children.set(entry.id,linked);
      }
    }catch{
      if(epoch===this.epoch)this.error='No pude cargar los destinos. Volvé a abrir el menú para reintentar.';
    }finally{
      if(epoch===this.epoch){this.loading=false;this.update();}
    }
  }

  close(){
    if(this.preparing){this.epoch++;return;}
    if(!this.group)return;
    clearTimeout(this.travelTimer);
    this.travelling=false;
    this.epoch++;
    if(this.lastPublishedSelection){this.lastPublishedSelection='';this.onSelect?.(null);}
    this.message('deleteSurface',{});
    this.group=null;
    this.onClose();
  }

  parentOf(entry){
    if(entry.id.startsWith('object:'))return 'room:'+entry.to;
    if(entry.id.startsWith('room:'))return 'house:'+entry.house;
    return '';
  }

  title(entry){
    return entry.id.startsWith('house:')?entry.houseTitle:entry.title;
  }

  options(){
    const parent=this.entries.find(entry=>entry.id===this.branch);
    const available=parent?this.children.get(parent.id)??[]:this.entries.filter(entry=>{
      if(this.category==='favorites')return this.favorites.has(entry.id);
      if(this.category==='houses')return entry.id.startsWith('house:');
      return !entry.house;
    });
    const destinations=available.map(entry=>({
      id:entry.id,icon:entry.icon,
      label:(this.category==='favorites'&&!parent&&entry.houseTitle&&!entry.id.startsWith('house:')?entry.houseTitle+' · ':'')+
        this.title(entry)+(entry.current?' (estás acá)':''),
    })).sort((a,b)=>byName(a.label,b.label));
    this.page=Math.min(this.page,Math.max(0,Math.ceil(destinations.length/pageSize)-1));
    const slots=destinations.slice(this.page*pageSize,(this.page+1)*pageSize);
    const current=parent?.id===this.destination?parent:available.find(entry=>entry.id===this.destination);
    return {parent,destinations,slots,current};
  }

  showSelection(id){
    const index=this.options().destinations.findIndex(item=>item.id===id);
    this.page=index<0?0:Math.floor(index/pageSize);
    this.destination=id;
  }

  changeLevel(branch,selection){
    this.branch=branch;
    this.level++;
    this.showSelection(selection);
  }

  update(){
    const {parent,destinations,slots,current}=this.options();
    this.slots=slots;
    if(!current&&this.category==='terrain'&&slots.length){
      this.destination=slots[0].id;
      return this.update();
    }
    if(this.lastPublishedSelection!==this.destination){
      this.lastPublishedSelection=this.destination;
      this.onSelect?.(current?.id??null);
    }
    const isFavorite=this.favorites.has(this.destination);
    const message=this.error||(this.loading?'Buscando destinos…':destinations.length?'':this.category==='favorites'?
      'Marcá tus destinos habituales con la estrella.':'No hay destinos disponibles en esta zona.');
    this.caption=current?this.title(current)+(current.current?' (estás acá)':''):'';
    const value={
      epoch:this.epoch,level:this.level,hasParent:Boolean(parent),physicalBack:Boolean(parent),
      backLabel:parent?'Volver desde '+this.title(parent):'',
      destination:this.destination,
      noPrevious:!this.page,noNext:(this.page+1)*pageSize>=destinations.length,
      cameraMounted:!this.physical,loading:this.loading,
      isFavorite,favoriteLabel:isFavorite?'Quitar favorito':'Guardar favorito',
      noTravel:!current||Boolean(current.current)||this.travelling===true,noSelection:!current,
      hasMessage:Boolean(message),message,
    };
    for(const {id} of categories)value[id+'Active']=this.category===id;
    for(const [index,id] of slotNames.entries()){
      const slot=slots[index];
      value[id+'Label']=slot?.label??'';
      value[id+'Key']=slot?.id??'';
      value[id+'Visible']=Boolean(slot);
      value[id+'Active']=Boolean(slot&&slot.id===this.destination);
    }
    this.message('updateDataModel',{value});
    this.onViewData?.({...value,caption:this.caption});
  }

  selectDestination(id){
    if(!this.group||this.loading)return false;
    const entry=this.entries.find(candidate=>candidate.id===id);
    if(!entry)return false;
    this.category=entry.house?'houses':'terrain';
    const parents=[];
    for(let parent=this.parentOf(entry);parent;){
      const ancestor=this.entries.find(candidate=>candidate.id===parent);
      if(!ancestor)break;
      parents.unshift(ancestor.id);
      parent=this.parentOf(ancestor);
    }
    this.branchTrail=parents;
    this.changeLevel(parents.at(-1)??'',id);
    this.update();
    return true;
  }

  activate({name,context}){
    if(!this.group||context?.epoch!==this.epoch)return;
    if(name==='close'){this.close();return;}
    if(this.travelling)return;
    const {slots,current}=this.options();
    const selection=context.selected;
    if(categories.some(item=>item.id===name)&&(name!==this.category||this.branch)){
      this.category=name;
      this.branchTrail=[];
      this.changeLevel('','');
    }
    if(name==='next'||name==='previous'){
      this.page=Math.max(0,this.page+(name==='next'?1:-1));
      this.destination=this.branch;
    }
    if(name==='back'&&context.level===this.level&&this.branch){
      const previous=this.branchTrail.pop();
      this.changeLevel(this.branchTrail.at(-1)??'',previous);
      this.update();
      const slot=this.slots.findIndex(item=>item.id===previous);
      if(slot>=0)this.focus(slotNames[slot]);
      return;
    }
    if(context.level===this.level&&typeof selection==='string'&&slots[slotNames.indexOf(name)]?.id===selection){
      if(this.children.has(selection)){
        this.branchTrail.push(selection);
        this.changeLevel(selection,selection);
        this.update();
        this.focus('back');
        return;
      }
      this.destination=selection;
    }
    if(current&&selection===current.id){
      if(name==='go'&&!current.current){
        const delay=this.travelMotion?.();
        if(delay){
          this.travelling=true;
          this.update();
          this.travelTimer=setTimeout(()=>{
            this.close();
            this.go(current);
          },delay);
        }else{
          this.close();
          this.go(current);
        }
        return;
      }
      if(name==='favorite'){
        if(this.favorites.has(selection)){
          this.favorites.delete(selection);
          if(this.category==='favorites'&&!this.branch)this.destination='';
        }
        else{
          if(this.favorites.size>=maxFavorites)this.favorites.delete(this.favorites.values().next().value);
          this.favorites.add(selection);
        }
        try{this.storage.setItem(this.key,JSON.stringify([...this.favorites]));}catch{}
      }
    }
    this.update();
  }
}
