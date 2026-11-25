import {WebGLRenderer} from 'three';

// CSS coordinates, hit tests and the scene renderer remain independent of the
// HUD framebuffer. Retain the Three.js presentation if a second context fails.
export class HudRenderLayer {
  constructor(world) {
    this.world=world;
    this.canvas=world.domElement;
    this.window=this.canvas.ownerDocument.defaultView;
    this.dirty=true;
    this.invalidate=()=>{this.dirty=true;};
  }

  start() {
    if(this.attempted)return;
    this.attempted=true;
    const document=this.canvas.ownerDocument;
    const canvas=document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    Object.assign(canvas.style,{position:'fixed',zIndex:'10',pointerEvents:'none'});
    try{
      this.renderer=new WebGLRenderer({canvas,alpha:true,antialias:false});
    }catch{
      return;
    }
    this.overlay=canvas;
    this.renderer.setClearColor(0,0);
    this.onLost=event=>{event.preventDefault();this.lost=true;this.hide();};
    this.onRestored=()=>{this.lost=false;this.invalidate();};
    canvas.addEventListener('webglcontextlost',this.onLost);
    canvas.addEventListener('webglcontextrestored',this.onRestored);
    document.body.append(canvas);
  }

  draw(scene,camera) {
    this.start();
    const {renderer,overlay}=this;
    if(!renderer||this.lost){
      const autoClear=this.world.autoClear;
      this.world.autoClear=false;
      try{this.world.clearDepth();this.world.render(scene,camera);}
      finally{this.world.autoClear=autoClear;}
      return;
    }

    const {width,height,left,top}=this.canvas.getBoundingClientRect();
    if(!width||!height){this.hide();return;}
    const ratio=Math.min(2,Math.max(1,this.window.devicePixelRatio||1));
    const columns=Math.round((left+width)*ratio)-Math.round(left*ratio);
    const rows=Math.round((top+height)*ratio)-Math.round(top*ratio);
    const placement=[left,top,width,height,columns,rows].join(':');
    if(this.placement!==placement){
      this.placement=placement;
      Object.assign(overlay.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
      renderer.setSize(columns,rows,false);
      this.invalidate();
    }
    if(overlay.hidden){overlay.hidden=false;this.invalidate();}
    if(!this.dirty)return;
    renderer.render(scene,camera);
    this.dirty=false;
  }

  hide() {
    if(this.overlay)this.overlay.hidden=true;
  }

  dispose() {
    if(!this.renderer)return;
    this.overlay.removeEventListener('webglcontextlost',this.onLost);
    this.overlay.removeEventListener('webglcontextrestored',this.onRestored);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.overlay.remove();
  }
}
