import {CanvasTexture,CircleGeometry,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace} from 'three';
import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const worldMapId='world-map',worldBearingId='world-bearing',terrainPeekId='terrain-peek';
const path=name=>({'@path':'/'+name});
const button=(id,label,fields={},context)=>({id,component:'HudButton',label,
  action:{event:{name:id,...(context?{context}:{})}},...fields});
const row=(id,children)=>({id,component:'HudRow',children});
const label=(id,value)=>({id,component:'HudText',label:value});
const scope=()=>({scope:path('scope')});
const components=[
  {id:'root',component:'HudPanel',label:'Mapa del lugar',width:1.16,gap:.025,
    children:['heading','map','format','navigation','pagination','exit']},
  row('heading',['title','close']),
  label('title','Mapa'),button('close','Cerrar',{},scope()),
  {id:'map',component:'HudMap',label:path('mapLabel'),marks:path('marks'),viewer:path('viewer'),
    selected:path('selected'),bounds:path('bounds')},
  button('format',path('formatLabel'),{visible:path('hasTerrain')},scope()),
  button('navigation',path('destinationLabel'),{
    visible:path('hasDestinations'),pressed:path('destinationSelected'),
  },{...scope(),destination:path('destination')}),
  {...row('pagination',['previous','count','next']),visible:path('hasPages')},
  button('previous','Atrás',{},scope()),label('count',path('page')),button('next','Otro',{},scope()),
  button('exit',path('exitLabel'),{visible:path('canExit'),disabled:path('busy')},scope()),
];

const landscapeComponents=[
  {...components[0],width:1.54,children:['body']},
  {...row('body',['map','controls']),gap:.04},
  {id:'controls',component:'HudColumn',weight:.82,gap:.018,
    children:['heading','format','navigation','pagination','exit']},
  ...components.slice(1).map(component=>component.id==='map'?{...component,weight:.68}:component),
];

const portraitComponents=[
  {...components[0],width:1,children:['heading','map','destinations','exit']},
  {...row('heading',['title','format','close']),gap:.025},
  {...label('title','Mapa'),visible:path('hasRoomMap')},
  {...row('destinations',['previous','navigation','next']),visible:path('hasDestinations'),gap:.018},
  ...components.filter(({id})=>!['root','heading','title','pagination','count'].includes(id)).map(component=>{
    if(component.id==='navigation')return {...component,weight:2.4};
    if(component.id==='previous'||component.id==='next')return {...component,visible:path('hasPages')};
    return component;
  }),
];
const shortPortraitComponents=portraitComponents.map(component=>component.id==='root'
  ?{...component,width:.74}:component);

const peekComponents=[
  {id:'root',component:'HudPanel',label:'Minimapa',width:.96,chrome:'none',children:['map']},
  {id:'map',component:'HudMap',label:'Relieve y rumbo actual',marks:[]},
];

const bearingComponents=[
  {id:'root',component:'HudPanel',label:'Salida marcada',width:2.06,children:['route']},
  row('route',['bearing','dismiss']),
  {id:'bearing',component:'HudBearing',label:path('label'),heading:path('heading'),distance:path('distance'),weight:3},
  button('dismiss','Quitar',{weight:1},{epoch:path('epoch'),destination:path('id')}),
];

export class WorldMapHud{
  constructor({send,panel,mapState,selectDestination,returnOutside,readBearing,dismissBearing,bearingAdapter,focusBearing,focusLauncher,invalidate}){
    Object.assign(this,{send,panel,mapState,selectDestination,returnOutside,readBearing,dismissBearing,bearingAdapter,focusBearing,focusLauncher,invalidate,scope:0,bearingEpoch:0,index:0,circular:false});
  }

  message(type,content){
    this.send(type,content,worldMapId);
  }

  get landscape(){return this.layout==='landscape';}
  get compact(){return Boolean(this.layout);}

  reset(){
    this.releaseTerrain('mesh');
    if(this.group)this.message('deleteSurface',{});
    this.group=null;
    this.mesh=null;
    this.signature=null;
    this.layout=null;
    this.index=0;
    this.scope++;
    delete this.panel.dataset.nativeMap;
  }

  update(visible,rasterUpdated,layout=null){
    if(rasterUpdated&&this.texture){
      this.texture.needsUpdate=true;
      this.invalidate();
    }
    if(!visible||this.panel.hidden||!this.panel.open){
      if(this.group)this.reset();
      return;
    }
    const {scope,busy,canExit,exitLabel,map}=this.mapState();
    if(this.mapScope!==scope){this.reset();this.mapScope=scope;}
    if(!this.group)this.message('createSurface',{catalogId:spatialHudCatalog.id});
    if(this.layout!==layout||!this.signature){
      this.layout=layout;
      const schema=layout==='portrait-short'?shortPortraitComponents:
        layout==='portrait'?portraitComponents:layout==='landscape'?landscapeComponents:components;
      this.message('updateComponents',{components:schema});
    }
    const destinations=map?.destinations??[];
    const count=destinations.length;
    this.index=Math.min(this.index,Math.max(0,count-1));
    const current=destinations[this.index];
    const canvas=this.panel.querySelector('#world-minimap');
    this.raster=!map&&!canvas.hidden;
    const mapLabel=(this.raster&&canvas.getAttribute('aria-label'))||'Mapa y posición actual';
    const value={scope:this.scope,mapLabel,hasTerrain:this.raster,hasRoomMap:!this.raster,
      formatLabel:this.circular?'Vista cuadrada':'Vista circular',marks:map?.marks??[],viewer:map?.viewer??null,selected:map?.selected??'',
      bounds:{minX:-6,maxX:6,minZ:-6,maxZ:6},destination:current?.id??'',
      destinationLabel:current?.title??'',destinationSelected:!!current&&map.selected===current.id,
      hasDestinations:count>0,hasPages:count>1,page:count?String(this.index+1)+' / '+count:'',
      canExit,exitLabel:exitLabel??'Volver al exterior',busy};
    const signature=JSON.stringify(value);
    if(signature!==this.signature){
      this.signature=signature;
      this.message('updateDataModel',{value});
    }
  }

  updatePeek(visible){
    if(visible===Boolean(this.peeking))return;
    this.peeking=visible;
    if(visible){
      this.send('createSurface',{catalogId:spatialHudCatalog.id},terrainPeekId);
      this.send('updateComponents',{components:peekComponents},terrainPeekId);
    }else{
      this.send('deleteSurface',{},terrainPeekId);
      this.releaseTerrain('peekMesh');
      this.peekGroup=null;
    }
  }

  releaseTerrain(key){
    const mesh=this[key];
    if(!mesh)return;
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
    this[key]=null;
  }

  decoration(){
    if(this.mesh&&this.mesh.visible!==this.raster){
      this.mesh.visible=this.raster;
      this.invalidate();
    }
    if(this.group)this.drawTerrain(this.group,'mesh',this.circular,this.raster);
    if(this.peekGroup)this.drawTerrain(this.peekGroup,'peekMesh',true,true);
  }

  drawTerrain(group,key,circular,visible){
    const frame=group.getObjectByName('map');
    if(!frame)return;
    const background=frame.getObjectByName('hud-map-plot');
    if(background)background.visible=!visible||!circular;
    if(!visible)return;
    if(!this.texture){
      this.texture=new CanvasTexture(this.panel.querySelector('#world-minimap'));
      this.texture.colorSpace=SRGBColorSpace;
    }
    let mesh=this[key];
    if(!mesh){
      mesh=new Mesh(this.terrainGeometry(circular),new MeshBasicMaterial({map:this.texture,toneMapped:false}));
      this[key]=mesh;
      mesh.position.z=.07;
      frame.add(mesh);
    }else if(mesh.userData.circular!==circular){
      mesh.geometry.dispose();
      mesh.geometry=this.terrainGeometry(circular);
    }else return;
    mesh.userData.circular=circular;
    this.invalidate();
  }

  terrainGeometry(circular){
    return circular?new CircleGeometry(.385,48):new PlaneGeometry(.77,.77);
  }

  activate({name,context}){
    if(!this.group||!this.panel.open||this.panel.hidden||context?.scope!==this.scope)return;
    const state=this.mapState();
    if(state.scope!==this.mapScope)return;
    const destinations=state.map?.destinations??[];
    const count=destinations.length;
    if(name==='close')this.close();
    if(name==='format'&&this.raster){
      this.circular=!this.circular;
      this.panel.dataset.terrainFormat=this.circular?'circle':'square';
      this.invalidate();
    }
    if(name==='exit'&&state.canExit&&!state.busy)this.returnOutside();
    if(name==='navigation'&&!state.busy&&destinations[this.index]?.id===context.destination)this.selectDestination(context.destination);
    if(count>1&&(name==='previous'||name==='next'))this.index=(this.index+(name==='next'?1:-1)+count)%count;
  }

  updateBearing(visible){
    const target=visible&&!this.panel.open?this.readBearing():null;
    const scope=target?this.mapState().scope:null;
    if(this.bearingGroup&&(!target||scope!==this.bearingSpace)){
      this.send('deleteSurface',{},worldBearingId);
      this.bearingGroup=null;
      this.bearingSignature=null;
      this.bearingEpoch++;
      this.markBearingPresented(false);
    }
    if(!target)return;
    this.bearingSpace=scope;
    if(this.bearingTarget!==target.id){
      this.bearingTarget=target.id;
      this.bearingEpoch++;
    }
    if(!this.bearingGroup){
      this.send('createSurface',{catalogId:spatialHudCatalog.id},worldBearingId);
      this.send('updateComponents',{components:bearingComponents},worldBearingId);
    }
    const value={...target,epoch:this.bearingEpoch};
    const signature=JSON.stringify(value);
    if(signature===this.bearingSignature)return;
    this.bearingSignature=signature;
    this.send('updateDataModel',{value},worldBearingId);
  }

  markBearingPresented(visible){
    const adapter=this.bearingAdapter;
    if(!adapter||adapter.hasAttribute('data-native-bearing')===visible)return;
    const hadFocus=visible&&adapter.contains(adapter.ownerDocument.activeElement);
    adapter.toggleAttribute('data-native-bearing',visible);
    if(hadFocus)this.focusBearing();

  }

  activateBearing({name,context}){
    if(!this.bearingGroup||this.panel.open||name!=='dismiss'||context?.epoch!==this.bearingEpoch||
      this.mapState().scope!==this.bearingSpace||this.readBearing()?.id!==context.destination)return;
    if(this.dismissBearing(context.destination)){
      this.updateBearing(false);
      this.focusLauncher();
    }
  }

  close(){
    this.panel.open=false;
    this.reset();
    this.focusLauncher();
  }

  dispose(){
    this.updatePeek(false);
    this.reset();
    this.updateBearing(false);
    this.markBearingPresented(false);
    this.texture?.dispose();
  }
}
