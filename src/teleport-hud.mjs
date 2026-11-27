import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const teleportHudId='world-teleport';
export const teleportHudWidth=2.45;
const path=name=>({'@path':'/'+name});
const action=(name,fields={})=>({event:{name,context:{epoch:path('epoch'),...fields}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const choice=(id,label,fields={})=>({id,component:'HudChoice',label,options:path(id+'Options'),
  value:path(id),draft:path(id+'Draft'),action:action(id,{selected:path(id+'Draft')}),...fields});
const components=[
  {id:'root',component:'HudPanel',label:'Teletransporte',width:teleportHudWidth,gap:.022,
    children:['heading','category','house','destination','actions','message']},
  {id:'heading',component:'HudRow',children:['title','close']},
  text('title','Teletransporte',{style:'title',weight:3}),
  button('close','Cerrar'),
  choice('category','Zona',{disabled:path('loading')}),
  choice('house','Casa',{visible:path('inHouses')}),
  choice('destination','Destino',{visible:path('hasOptions')}),
  {id:'actions',component:'HudRow',visible:path('hasDestination'),children:['favorite','go']},
  button('favorite',path('favoriteLabel'),{pressed:path('isFavorite'),weight:1.9,
    action:action('favorite',{selected:path('destination')})}),
  button('go','Teletransportar',{disabled:path('isHere'),weight:1.6,
    action:action('go',{selected:path('destination')})}),
  text('message',path('message'),{style:'status',visible:path('hasMessage'),lines:2}),
];
const categories=[
  {id:'favorites',label:'⭐ Favoritos'},{id:'terrain',label:'🧭 Terreno público'},{id:'houses',label:'🏠 Casas'},
];
const byName=(a,b)=>a.localeCompare(b,'es');
const maxFavorites=128;
const icon=entry=>entry.id.startsWith('object:')?'🎛️':entry.id.startsWith('room:')?'🚪':
  entry.id.startsWith('house:')?'🏠':entry.id==='terrain:residence'?'🏛️':
  entry.id==='terrain:garden'?'🌿':entry.id==='terrain:overlook'?'⛰️':'📍';

export class TeleportHud {
  constructor({send,read,go,focus,onOpen,onClose,storage}){
    Object.assign(this,{send,read,go,focus,onOpen,onClose,storage,epoch:0});
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
    Object.assign(this,{category:'terrain',house:'',destination:'',entries:[],loading:true,error:''});
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
      id:entry.id,label:icon(entry)+' '+(this.category==='favorites'&&entry.houseTitle?entry.houseTitle+' · ':'')+
        (entry.room&&entry.title!==entry.room?entry.room+' / ':'')+entry.title+(entry.current?' (estás acá)':''),
    })).sort((a,b)=>byName(a.label,b.label));
    if(!destinations.some(option=>option.id===this.destination))this.destination=destinations[0]?.id??'';
    return {houses,destinations,current:available.find(entry=>entry.id===this.destination)};
  }

  update(){
    const {houses,destinations,current}=this.options();
    const isFavorite=this.favorites.has(this.destination);
    const message=this.error||(this.loading?'Cargando destinos…':destinations.length?'':this.category==='favorites'?
      'Marcá tus destinos habituales con Guardar favorito.':'No hay destinos disponibles en esta zona.');
    this.message('updateDataModel',{value:{
      epoch:this.epoch,category:this.category,categoryOptions:categories,house:this.house,houseOptions:houses,
      destination:this.destination,destinationOptions:destinations,hasOptions:destinations.length>0,
      inHouses:this.category==='houses'&&houses.length>0,loading:this.loading,hasDestination:Boolean(current),
      isFavorite,favoriteLabel:isFavorite?'Quitar favorito':'Guardar favorito',isHere:Boolean(current?.current),
      hasMessage:Boolean(message),message,
    }});
  }

  activate({name,context}){
    if(!this.group||context?.epoch!==this.epoch)return;
    if(name==='close'){this.close();return;}
    const {houses,destinations,current}=this.options();
    const selection=context.selected;
    if(name==='category'&&categories.some(item=>item.id===selection))this.category=selection;
    if(name==='house'&&houses.some(item=>item.id===selection))this.house=selection;
    if(name==='destination'&&destinations.some(item=>item.id===selection))this.destination=selection;
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
