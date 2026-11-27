import {hudAppearanceKey,readHudAppearance} from './hud-appearance.mjs';
import {ConversationChrome} from './conversation-chrome.mjs';
import {Group,Mesh,MeshBasicMaterial,OrthographicCamera,Scene,Shape,ShapeGeometry} from 'three';

function roundedPlate(width,height,radius){
  const shape=new Shape(), w=width/2, h=height/2;
  const r=Math.min(radius,w,h);
  shape.moveTo(-w+r,-h);
  shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);
  shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);
  shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);
  shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
  return new ShapeGeometry(shape,10);
}

export class ConversationDisplay {
  constructor(webgl,panel,layer,readReferences){
    this.webgl=webgl;
    this.panel=panel;
    this.layer=layer;
    this.scene=new Scene();
    this.scene.name="Conversation display";
    this.layers=new Group();
    this.plates=new Group();
    this.plates.renderOrder=-1;
    this.layers.add(this.plates);
    this.scene.add(this.layers);
    this.camera=new OrthographicCamera(0,1,1,0,.1,12);
    this.camera.position.z=5;
    this.camera.updateMatrixWorld();
    this.chromeParent=new Group();
    this.layers.add(this.chromeParent);
    this.chrome=new ConversationChrome({panel,canvas:webgl.domElement,parent:this.chromeParent,camera:this.camera,
      invalidate:layer.invalidate,readReferences});
  }

  clear(){
    for(const layer of [...this.plates.children]){
      layer.removeFromParent();
      layer.geometry.dispose();
      layer.material.dispose();
    }
  }

  minimize(button){
    this.animate('minimize',button);
  }

  restore(button){
    this.animate('restore',button);
  }

  animate(kind,button){
    const window=this.panel.ownerDocument.defaultView;
    window.clearTimeout(this.motionTimer);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.motion=null;
    delete this.panel.dataset.displayMotion;
    this.layer.invalidate();
    if(reduced||!button?.width||!button.height||kind==='minimize'&&!this.plates.children.length)return;
    const rect=this.panel.getBoundingClientRect(),canvas=this.webgl.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    this.motion={kind,start:performance.now(),
      x:rect.left+rect.width/2-canvas.left,y:canvas.bottom-rect.top-rect.height/2,
      toX:button.left+button.width/2-canvas.left,toY:canvas.bottom-button.top-button.height/2};
    this.panel.dataset.displayMotion=kind;
    const motion=this.motion;
    this.motionTimer=window.setTimeout(()=>{
      if(this.motion!==motion)return;
      this.motion=null;
      this.layers.scale.set(1,1,1);
      this.layers.position.set(0,0,0);
      delete this.panel.dataset.displayMotion;
      this.layer.invalidate();
    },320);
  }

  applyMotion(){
    const motion=this.motion;
    if(!motion)return false;
    const t=Math.min(1,(performance.now()-motion.start)/220);
    this.layer.invalidate();
    if(t>=1){
      this.motion=null;
      delete this.panel.dataset.displayMotion;
      return false;
    }
    const fold=motion.kind==='minimize'?1-(1-t)**3:(1-t)**3;
    const scale=1-.88*fold, vertical=scale*(1-.50*fold);
    this.layers.scale.set(scale,vertical,1);
    this.layers.position.set(motion.x*(1-scale)+(motion.toX-motion.x)*fold,
      motion.y*(1-vertical)+(motion.toY-motion.y)*fold,0);
    return true;
  }

  draw(){
    const panel=this.panel;
    if(this.chrome.contextLost&&(!this.layer.renderer||this.layer.lost)){
      delete panel.dataset.worldDisplay;
      return null;
    }
    if(panel.hidden)return this.applyMotion()?this:null;
    this.layers.scale.set(1,1,1);
    this.layers.position.set(0,0,0);
    const canvas=this.webgl.domElement, viewport=canvas.getBoundingClientRect();
    const rect=panel.getBoundingClientRect();
    if(!viewport.width||!viewport.height||!rect.width||!rect.height)return null;
    if(this.camera.right!==viewport.width||this.camera.top!==viewport.height){
      this.camera.right=viewport.width;this.camera.top=viewport.height;
      this.camera.updateProjectionMatrix();
    }
    const appearance=hudAppearanceKey(panel.ownerDocument);
    if(this.appearance!==appearance){
      this.appearance=appearance;
      this.style=readHudAppearance(panel.ownerDocument);
    }
    const shared=panel.classList.contains('shared-conversation');
    this.chromeParent.visible=!shared;
    if(shared)delete panel.dataset.hudChrome;
    else this.chrome.update(rect,viewport,this.layer.pixelRatio,appearance,this.style);
    const display=panel.querySelector('iframe');
    const screen=display?.getBoundingClientRect();
    const hasScreen=Boolean(screen?.width&&screen.height);
    const key=[rect.width,rect.height,hasScreen?screen.width:0,hasScreen?screen.height:0,appearance].join(':');
    if(this.key!==key){
      this.key=key;
      this.layer.invalidate();
      this.clear();
      const edge=this.style.edge;
      const add=(width,height,radius,color,opacity)=>{
        const mesh=new Mesh(roundedPlate(width,height,radius),new MeshBasicMaterial({
          color,opacity,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,
        }));
        mesh.renderOrder=this.plates.children.length;
        this.plates.add(mesh);
        return mesh;
      };
      this.back=[
        add(rect.width+14,rect.height+14,26,0x081117,.15),
        add(rect.width+8,rect.height+8,24,0x081117,.30),
        add(rect.width+2,rect.height+2,20,edge,.64),
        add(rect.width,rect.height,19,this.style.frame,this.style.frameOpacity),
      ];
      this.rim=hasScreen?[
        add(screen.width+10,screen.height+10,16,edge,.16),
        add(screen.width+3,screen.height+3,13,edge,.58),
      ]:[];
    }
    const place=(mesh,bounds,dy=0)=>mesh.position.set(
      bounds.left-viewport.left+bounds.width/2,viewport.bottom-bounds.top-bounds.height/2-dy,0);
    this.back.forEach((mesh,i)=>place(mesh,rect,i<2?4:0));
    if(hasScreen)this.rim.forEach(mesh=>place(mesh,screen));
    const placement=[rect.left,rect.top,screen?.left,screen?.top,viewport.left,viewport.top].join(':');
    if(this.placement!==placement){this.placement=placement;this.layer.invalidate();}
    panel.dataset.worldDisplay='';
    this.applyMotion();
    return this;
  }

  dispose(){
    this.clear();
    this.panel.ownerDocument.defaultView.clearTimeout(this.motionTimer);
    this.chrome.dispose();
    delete this.panel.dataset.displayMotion;
    delete this.panel.dataset.worldDisplay;
  }
}
