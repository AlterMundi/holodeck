import {CanvasTexture,CircleGeometry,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace} from 'three';
import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const worldMapId='world-map',worldBearingId='world-bearing';
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
  button('exit','Volver al exterior',{visible:path('canExit'),disabled:path('busy')},scope()),
];

const landscapeComponents=[
  {...components[0],width:1.54,children:['body']},
  {...row('body',['map','controls']),gap:.04},
  {id:'controls',component:'HudColumn',weight:.82,gap:.018,
    children:['heading','format','navigation','pagination','exit']},
  ...components.slice(1).map(component=>component.id==='map'?{...component,weight:.68}:component),
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

  reset(){
    if(this.mesh){
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    if(this.group)this.message('deleteSurface',{});
    this.group=null;
    this.mesh=null;
    this.signature=null;
    this.landscape=null;
    this.index=0;
    this.scope++;
    delete this.panel.dataset.nativeMap;
  }

  update(visible,rasterUpdated,landscape=false){
    if(rasterUpdated&&this.texture){
      this.texture.needsUpdate=true;
      this.invalidate();
    }
    if(!visible||this.panel.hidden||!this.panel.open){
      if(this.group)this.reset();
      return;
    }
    const {scope,busy,canExit,map}=this.mapState();
    if(this.mapScope!==scope){this.reset();this.mapScope=scope;}
    if(!this.group)this.message('createSurface',{catalogId:spatialHudCatalog.id});
    if(this.landscape!==landscape){
      this.landscape=landscape;
      this.message('updateComponents',{components:landscape?landscapeComponents:components});
    }
    const destinations=map?.destinations??[];
    const count=destinations.length;
    this.index=Math.min(this.index,Math.max(0,count-1));
    const current=destinations[this.index];
    const canvas=this.panel.querySelector('#world-minimap');
    this.raster=!map&&!canvas.hidden;
    const mapLabel=(this.raster&&canvas.getAttribute('aria-label'))||'Mapa y posición actual';
    const value={scope:this.scope,mapLabel,hasTerrain:this.raster,
      formatLabel:this.circular?'Vista cuadrada':'Vista circular',marks:map?.marks??[],viewer:map?.viewer??null,selected:map?.selected??'',
      bounds:{minX:-6,maxX:6,minZ:-6,maxZ:6},destination:current?.id??'',
      destinationLabel:current?.title??'',destinationSelected:!!current&&map.selected===current.id,
      hasDestinations:count>0,hasPages:count>1,page:count?String(this.index+1)+' / '+count:'',
      canExit,busy};
    const signature=JSON.stringify(value);
    if(signature!==this.signature){
      this.signature=signature;
      this.message('updateDataModel',{value});
    }
  }

  decoration(){
    if(this.mesh&&this.mesh.visible!==this.raster){
      this.mesh.visible=this.raster;
      this.invalidate();
    }
    if(!this.group)return;
    const frame=this.group.getObjectByName('map');
    if(!frame)return;
    const background=frame.getObjectByName('hud-map-plot');
    if(background)background.visible=!this.raster||!this.circular;
    if(!this.raster)return;
    if(!this.texture){
      this.texture=new CanvasTexture(this.panel.querySelector('#world-minimap'));
      this.texture.colorSpace=SRGBColorSpace;
    }
    if(!this.mesh){
      this.mesh=new Mesh(this.terrainGeometry(),new MeshBasicMaterial({map:this.texture,toneMapped:false}));
      this.mesh.position.z=.07;
      this.circularMesh=this.circular;
      frame.add(this.mesh);
      this.invalidate();
    }else if(this.circularMesh!==this.circular){
      this.mesh.geometry.dispose();
      this.mesh.geometry=this.terrainGeometry();
      this.circularMesh=this.circular;
      this.invalidate();
    }
  }

  terrainGeometry(){
    return this.circular?new CircleGeometry(.385,48):new PlaneGeometry(.77,.77);
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
    this.reset();
    this.updateBearing(false);
    this.markBearingPresented(false);
    this.texture?.dispose();
  }
}
