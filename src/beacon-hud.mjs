import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const beaconStationId='beacon-station-tools',beaconViewerId='beacon-viewer-tools';
export const beaconStationWidth=2.24,beaconViewerWidth=2.66;
const path=key=>({'@path':'/'+key});
const action=name=>({event:{name,context:{station:path('station'),revision:path('revision'),generation:path('generation')}}});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});

const stationComponents=[
  {id:'root',component:'HudPanel',label:'Controles del laboratorio',width:beaconStationWidth,children:['title','stationActions','status']},
  text('title',path('title'),{style:'title'}),
  {id:'stationActions',component:'HudRow',children:['check','open']},
  button('check','Consultar estado',{disabled:path('checking')}),
  button('open','Abrir laboratorio'),
  text('status',path('status'),{style:'body',lines:2,visible:path('hasStatus')}),
];
const viewerComponents=[
  {id:'root',component:'HudPanel',label:'Ventana del laboratorio',width:beaconViewerWidth,children:['title','viewerActions']},
  text('title',path('title'),{style:'title'}),
  {id:'viewerActions',component:'HudRow',children:['external','close']},
  button('external','Abrir aparte'),
  button('close','Volver al mundo'),
];

export class BeaconHud{
  constructor({owner,send,focus,isFocused,focusWorld,canOpenNative,onOpen}){
    Object.assign(this,{owner,send,focus,isFocused,focusWorld,canOpenNative,onOpen,generation:0,modelKeys:new Map()});
    owner.beforeFrame.onfocus=()=>{if(owner.native)this.focus(beaconViewerId,'close');};
    owner.afterFrame.onfocus=()=>{if(owner.native)this.focus(beaconViewerId,'external');};
  }

  syncSurface(id,group,components,model){
    if(!model){
      if(this[group])this.send('deleteSurface',{},id);
      this[group]=null;
      this.modelKeys.delete(id);
      return;
    }
    if(!this[group]){
      this.send('createSurface',{catalogId:spatialHudCatalog.id},id);
      this.send('updateComponents',{components},id);
      this.modelKeys.delete(id);
    }
    const key=JSON.stringify(model);
    if(this.modelKeys.get(id)!==key){
      this.modelKeys.set(id,key);
      this.send('updateDataModel',{value:model},id);
    }
  }

  update(visible){
    const {current,opened,native}=this.owner;
    if(this.current!==current||this.opened!==opened||this.native!==native){
      if(this.current!==current)this.restoreStation=false;
      else if(this.stationGroup&&this.isFocused(beaconStationId))this.restoreStation=true;
      this.generation++;
    }
    this.current=current;
    this.opened=opened;
    this.native=native;
    const identity=current?{station:current.id,revision:current.revision,generation:this.generation,title:current.title}:null;
    const status=this.owner.statusText.textContent;
    this.syncSurface(beaconStationId,'stationGroup',stationComponents,identity&&visible&&!opened?{
      ...identity,status,hasStatus:Boolean(status),checking:this.owner.statusButton.disabled,
    }:null);
    this.syncSurface(beaconViewerId,'viewerGroup',viewerComponents,identity&&opened&&native?identity:null);
  }

  openNearby(){
    this.restoreStation=true;
    this.onOpen();
    this.owner.open({native:this.canOpenNative()});
  }

  activate({surfaceId,name,context}){
    const {current,native,opened}=this.owner;
    if(!current||context?.station!==current.id||context?.revision!==current.revision||
        context?.generation!==this.generation||this.current!==current)return;
    if(surfaceId===beaconStationId&&this.stationPresented&&!opened){
      if(name==='check'&&!this.owner.statusButton.disabled)void this.owner.checkStatus();
      else if(name==='open')this.openNearby();
    }else if(surfaceId===beaconViewerId&&this.viewerPresented&&opened&&native){
      if(name==='close')this.owner.close();
      else if(name==='external')this.owner.external.click();
    }
  }

  present(station,viewer){
    const wasStation=this.stationPresented,wasViewer=this.viewerPresented;
    this.stationPresented=station;
    this.viewerPresented=viewer;
    const {link,panel,opened,native}=this.owner;
    const stationAdapter=link.closest('#beacon-station');
    stationAdapter.toggleAttribute('data-beacon-station-hud',station);
    panel.toggleAttribute('data-beacon-hud',viewer);
    if(opened&&native&&!viewer){
      this.owner.fallback();
      this.syncSurface(beaconViewerId,'viewerGroup',viewerComponents,null);
      return;
    }
    if(viewer&&!wasViewer)this.focus(beaconViewerId,'close');
    if(station&&(!wasStation&&this.restoreStation||wasViewer)){
      this.restoreStation=false;
      this.focus(beaconStationId,'open');
    }else if(!station&&!viewer){
      if(wasStation&&this.isFocused(beaconStationId)||wasViewer&&!opened){
        if(this.owner.current&&!opened)link.focus({preventScroll:true});
        else if(!opened)this.focusWorld();
      }
    }
  }

  key(event,hud){
    if(!this.viewerPresented)return false;
    if(event.key==='Escape'){this.owner.close();return true;}
    if(event.key==='Tab'){
      const focus=hud.currentFocus();
      const inChrome=focus?.surfaceId===beaconViewerId&&hud.ownsAccessibleInput(event.target);
      if(inChrome&&((event.shiftKey&&focus.instanceId==='external')||(!event.shiftKey&&focus.instanceId==='close'))){
        this.owner.frame?.focus();
      }else this.focus(beaconViewerId,inChrome&&!event.shiftKey?'close':'external');
      return true;
    }
    return hud.handleKey(event,{surfaceId:beaconViewerId});
  }

  dispose(){
    const {link,panel}=this.owner;
    link.closest('#beacon-station').removeAttribute('data-beacon-station-hud');
    panel.removeAttribute('data-beacon-hud');
    this.owner.fallback();
  }
}
