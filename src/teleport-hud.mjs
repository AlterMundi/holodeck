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
    children:['heading','categories','house','models','space','caption','actions','message']},
  row('heading',['title','close']),
  text('title','Teletransporte',{style:'title',weight:4}),button('close','Cerrar'),
  row('categories',categories.map(({id})=>id)),
  ...categories.map(({id,label})=>button(id,label,{pressed:path(id+'Active'),disabled:path('loading')})),
  button('house',path('houseLabel'),{visible:path('inHouses'),gestureKey:path('house')}),
  row('models',slotNames),
  ...slotNames.map(id=>button(id,path(id+'Label'),{visible:path(id+'Visible'),pressed:path(id+'Active'),
    gestureKey:path(id+'Key'),action:action(id,{selected:path(id+'Key')})})),
  text('space','',{lines:6}),
  text('caption',path('caption'),{style:'body',lines:2,visible:path('hasDestination')}),
  row('actions',['previous','favorite','go','next']),
  button('previous','Destinos anteriores',{disabled:path('noPrevious')}),
  button('favorite',path('favoriteLabel'),{pressed:path('isFavorite'),disabled:path('noSelection'),gestureKey:path('destination'),
    action:action('favorite',{selected:path('destination')})}),
  button('go','Teletransportar',{disabled:path('noTravel'),gestureKey:path('destination'),
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
  constructor({send,read,go,focus,onOpen,onClose,onSelect,storage}){
    Object.assign(this,{send,read,go,focus,onOpen,onClose,onSelect,storage,epoch:0});
  }

  message(type,content){this.send(type,content,teleportHudId);}

  async open(space){
    if(this.group)return;
    const epoch=++this.epoch;
    this.key='holodeck:teleport:favorites:'+space.actorRef;
    this.favorites=new Set();
    try{
      const saved=JSON.parse(this.storage.getItem(this.key));
      if(Array.isArray(saved))for(const id of saved.slice(0,maxFavorites)){
        if(typeof id==='string'&&id.length<=160)this.favorites.add(id);
      }
    }catch{}
    Object.assign(this,{category:'terrain',house:'',destination:'',page:0,entries:[],loading:true,error:''});
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
    }catch{
      if(epoch===this.epoch)this.error='No pude cargar los destinos. Volvé a abrir el menú para reintentar.';
    }finally{
      if(epoch===this.epoch){this.loading=false;this.update();}
    }
  }

  close(){
    if(!this.group)return;
    this.epoch++;
    if(this.lastPublishedSelection){this.lastPublishedSelection='';this.onSelect?.(null);}
    this.message('deleteSurface',{});
    this.group=null;
    this.onClose();
  }

  options(){
    const groups=new Map(this.entries.filter(entry=>entry.house).map(entry=>[entry.house,entry.houseTitle]));
    const houses=[...groups].map(([id,label])=>({id,label})).sort((a,b)=>byName(a.label,b.label));
    if(!groups.has(this.house))this.house=houses[0]?.id??'';
    const available=this.entries.filter(entry=>this.category==='terrain'?!entry.house:
      this.category==='houses'?entry.house===this.house:this.favorites.has(entry.id));
    const destinations=available.map(entry=>({
      id:entry.id,label:(this.category==='favorites'&&entry.houseTitle?entry.houseTitle+' · ':'')+
        (entry.room&&entry.title!==entry.room?entry.room+' / ':'')+entry.title+(entry.current?' (estás acá)':''),
    })).sort((a,b)=>byName(a.label,b.label));
    this.page=Math.min(this.page,Math.max(0,Math.ceil(destinations.length/pageSize)-1));
    const slots=destinations.slice(this.page*pageSize,(this.page+1)*pageSize);
    if(!slots.some(option=>option.id===this.destination))this.destination=slots[0]?.id??'';
    return {houses,destinations,slots,current:available.find(entry=>entry.id===this.destination)};
  }

  update(){
    const {houses,destinations,slots,current}=this.options();
    this.slots=slots;
    if(this.lastPublishedSelection!==this.destination){
      this.lastPublishedSelection=this.destination;
      this.onSelect?.(current?.id??null);
    }
    const isFavorite=this.favorites.has(this.destination);
    const message=this.error||(this.loading?'Buscando destinos…':destinations.length?'':this.category==='favorites'?
      'Marcá tus destinos habituales con la estrella.':'No hay destinos disponibles en esta zona.');
    const value={
      epoch:this.epoch,house:this.house,houseOptions:houses,
      destination:this.destination,caption:(this.category==='houses'&&current?current.houseTitle+' · ':'')+(slots.find(slot=>slot.id===this.destination)?.label??''),
      noPrevious:!this.page,noNext:(this.page+1)*pageSize>=destinations.length,
      inHouses:this.category==='houses'&&houses.length>1,houseLabel:'Cambiar casa · '+(houses.find(entry=>entry.id===this.house)?.label??''),loading:this.loading,hasDestination:Boolean(current),
      isFavorite,favoriteLabel:isFavorite?'Quitar favorito':'Guardar favorito',
      noTravel:!current||Boolean(current.current),noSelection:!current,
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
  }

  selectDestination(id){
    if(!this.group||this.loading)return false;
    const entry=this.entries.find(candidate=>candidate.id===id);
    if(!entry)return false;
    this.category=entry.house?'houses':'terrain';
    this.house=entry.house??'';
    const {destinations}=this.options();
    this.page=Math.floor(destinations.findIndex(item=>item.id===id)/pageSize);
    this.destination=id;
    this.update();
    return true;
  }

  activate({name,context}){
    if(!this.group||context?.epoch!==this.epoch)return;
    if(name==='close'){this.close();return;}
    const {houses,slots,current}=this.options();
    const selection=context.selected;
    if(categories.some(item=>item.id===name)&&name!==this.category){this.category=name;this.page=0;}
    if(name==='house'&&houses.length>1){
      this.house=houses[(houses.findIndex(item=>item.id===this.house)+1)%houses.length].id;this.page=0;
    }
    if(name==='next')this.page++;
    if(name==='previous')this.page=Math.max(0,this.page-1);
    if(slots[slotNames.indexOf(name)]?.id===selection&&typeof selection==='string')this.destination=selection;
    if(current&&selection===current.id){
      if(name==='go'&&!current.current){
        this.close();
        this.go(current);
        return;
      }
      if(name==='favorite'){
        if(this.favorites.has(selection))this.favorites.delete(selection);
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
