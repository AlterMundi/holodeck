import {hudAppearanceKey,readHudAppearance} from './hud-appearance.mjs';
import {OrthographicCamera,Raycaster,Scene,Vector2} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';

const panelWidth=1.48;
const passive={id:'status',component:'HudText',label:{'@path':'/message'},style:'body',lines:2};
const retryControl={id:'retry',component:'HudButton',label:'Reintentar',visible:{'@path':'/retry'},
  action:{event:{name:'retry'}}};
const components=[{id:'root',component:'HudPanel',label:'Paso entre lugares',width:panelWidth,gap:.02,
  children:['status','retry']},passive,retryControl];

export class PassageHud {
  constructor({document,layer,onError}) {
    this.layer=layer;
    this.onError=onError;
    this.generation=0;
    this.host=document.getElementById('room-passage');
    this.message=document.getElementById('room-passage-message');
    this.retry=document.getElementById('room-passage-retry');
    this.window=document.defaultView;
    this.mirror=document.createElement('div');
    this.mirror.inert=true;
    this.mirror.hidden=true;
    this.mirror.style.position='absolute';
    this.host.append(this.mirror);
    this.scene=new Scene();
    this.camera=new OrthographicCamera(-1,1,1,-1,.1,12);
    this.camera.position.z=4;
    this.camera.updateMatrixWorld();
    this.ray=new Raycaster();
    this.pointer=new Vector2();
    this.hud=createSpatialHud({
      document,parent:this.scene,accessibilityRoot:this.mirror,controlStyle:'optical',
      placeSurface:(group,id)=>{if(id===this.surface)this.group=group;},
      send:({action})=>{
        if(this.presented&&this.canRetry()&&this.active&&action?.surfaceId===this.surface&&action.name==='retry')
          this.retry.click();
      },
      onTransportError:onError,
    });
    this.bind=()=>bindSpatialHudPointer({element:this.host,hud:this.hud,rayForPointer:event=>{
      if(!this.active||!this.presented||!this.canRetry())return;
      const rect=layer.canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      this.pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
      this.ray.setFromCamera(this.pointer,this.camera);
      return {ray:this.ray.ray};
    }});
    this.host.addEventListener('keydown',this.keepFocus);
  }

  canRetry(){return !this.retry.hidden&&!this.retry.disabled;}

  keepFocus=event=>{
    if(!this.active||event.key!=='Tab')return;
    event.preventDefault();
    if(!this.canRetry())this.host.focus({preventScroll:true});
    else if(this.presented)this.hud.focusAccessibleControl(this.surface,'retry');
    else this.retry.focus({preventScroll:true});
  };

  receive(type,value){
    this.hud.receive({version:'1.0',[type]:{surfaceId:this.surface,...value}});
    this.layer.invalidate();
  }

  begin(){
    if(this.active)return;
    this.active=true;
    this.surface='room-passage-'+(++this.generation);
    this.latchedFallback=false;
    this.unbind=this.bind();
    this.host.focus({preventScroll:true});
  }

  draw(){
    if(!this.active||this.latchedFallback)return;
    const retry=this.canRetry();
    if(!retry){this.layer.hide();return;}
    try{this.paint(retry);}
    catch(error){
      this.fallback(true);
      this.onError?.(error);
    }
  }

  paint(retry){
    const {layer}=this;
    layer.start();
    if(!layer.overlay||layer.lost||layer.world.getContext().isContextLost()){this.fallback(true);return;}
    const {width,height}=layer.canvas.getBoundingClientRect();
    if(width<235||height<440){this.fallback(true);return;}
    const document=this.host.ownerDocument;
    const appearance=hudAppearanceKey(document);
    if(this.appearance!==appearance){
      this.appearance=appearance;
      this.hud.setPalette(readHudAppearance(document).palette);
      layer.invalidate();
    }
    if(!this.surfaceCreated){
      this.receive('createSurface',{catalogId:spatialHudCatalog.id});
      this.surfaceCreated=true;
      this.receive('updateComponents',{components});
    }
    const message=this.message.textContent;
    const key=JSON.stringify([message,retry]);
    if(key!==this.key){
      this.receive('updateDataModel',{value:{message,retry}});
      this.key=key;
    }
    const scale=Math.min(288,(width-30)/(panelWidth+.12));
    const top=Math.min(height-116,height*.72);
    const placement=JSON.stringify([width,height,scale,top,layer.pixelRatio]);
    if(!this.group){this.fallback(true);return;}
    if(placement!==this.placement){
      this.placement=placement;
      placeHudInViewport(this.group,this.camera,{width,height,x:width/2,y:top,pixelsPerUnit:scale,depth:1});
      this.hud.setTextDensity(this.surface,{cssPixelsPerUnit:scale,pixelRatio:layer.pixelRatio,fontSize:15});
      layer.invalidate();
    }
    this.hud.update();
    if(!this.hud.getSurfaceBounds(this.surface)||!layer.draw(this.scene,this.camera)){this.fallback(true);return;}
    this.previousZ??=layer.overlay.style.zIndex;
    layer.overlay.style.zIndex='41';
    this.lastPaint=this.window.performance.now();
    const {activeElement}=this.host.ownerDocument;
    this.presented=true;
    this.mirror.inert=false;
    this.mirror.hidden=false;
    this.host.setAttribute('data-native-passage','');
    if(retry&&!this.retryPresented&&(activeElement===this.host||activeElement===this.retry))
      this.hud.focusAccessibleControl(this.surface,'retry');
    this.retryPresented=retry;
    this.watchdog??=this.window.setTimeout(this.checkPaint,1000);
  }

  checkPaint=()=>{
    this.watchdog=null;
    if(!this.presented)return;
    const elapsed=this.window.performance.now()-this.lastPaint;
    if(elapsed>=1000)this.fallback(true);
    else this.watchdog=this.window.setTimeout(this.checkPaint,Math.max(20,1000-elapsed));
  };

  fallback(latch=false){
    this.window.clearTimeout(this.watchdog);
    this.watchdog=null;
    if(!this.surface&&!this.presented)return;
    if(latch)this.latchedFallback=true;
    const focused=this.hud.ownsAccessibleInput(this.host.ownerDocument.activeElement);
    this.presented=false;
    this.retryPresented=false;
    this.mirror.inert=true;
    this.mirror.hidden=true;
    this.unbind?.();this.unbind=null;
    this.host.removeAttribute('data-native-passage');
    if(this.layer.overlay&&this.previousZ!==undefined)this.layer.overlay.style.zIndex=this.previousZ;
    this.previousZ=undefined;
    this.layer.hide();
    this.layer.invalidate();
    if(this.active&&focused&&this.canRetry())this.retry.focus({preventScroll:true});
  }

  end(){
    if(!this.active)return;
    const focused=this.host.contains(this.host.ownerDocument.activeElement);
    this.active=false;
    this.fallback();
    if(this.surfaceCreated)this.receive('deleteSurface',{});
    this.surfaceCreated=false;
    this.surface=null;
    this.group=null;
    this.key=null;
    this.placement=null;
    if(focused){
      this.layer.canvas.tabIndex=-1;
      this.layer.canvas.focus({preventScroll:true});
    }
  }

  dispose(){
    this.end();
    this.host.removeEventListener('keydown',this.keepFocus);
    this.hud.dispose();
    this.mirror.remove();
  }
}
