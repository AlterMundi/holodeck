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
  constructor(webgl,panel){
    this.webgl=webgl;
    this.panel=panel;
    this.scene=new Scene();
    this.scene.name="Conversation display";
    this.layers=new Group();
    this.scene.add(this.layers);
    this.camera=new OrthographicCamera(0,1,1,0,.1,12);
    this.camera.position.z=5;
  }

  clear(){
    for(const layer of [...this.layers.children]){
      layer.removeFromParent();
      layer.geometry.dispose();
      layer.material.dispose();
    }
  }

  minimize(button){
    const window=this.panel.ownerDocument.defaultView;
    if(!this.layers.children.length||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const rect=this.panel.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const canvas=this.webgl.domElement.getBoundingClientRect();
    this.motion={
      elapsed:0,lastFrame:null,
      x:rect.left+rect.width/2-canvas.left,y:canvas.bottom-rect.top-rect.height/2,
      toX:button.left+button.width/2-canvas.left,toY:canvas.bottom-button.top-button.height/2,
    };
  }

  draw(){
    const panel=this.panel;
    if(panel.hidden){
      const motion=this.motion;
      if(!motion)return;
      const now=performance.now();
      if(motion.lastFrame!==null)motion.elapsed+=Math.min(now-motion.lastFrame,50);
      motion.lastFrame=now;
      const t=motion.elapsed/240;
      if(t>=1){this.motion=null;return;}
      const ease=1-(1-t)**3, scale=1-.94*ease;
      this.layers.scale.set(scale,scale*(1-.72*ease),1);
      this.layers.position.set(motion.x*(1-scale)+(motion.toX-motion.x)*ease,
        motion.y*(1-this.layers.scale.y)+(motion.toY-motion.y)*ease,0);
      this.render();
      return;
    }
    this.motion=null;
    this.layers.scale.set(1,1,1);
    this.layers.position.set(0,0,0);
    const canvas=this.webgl.domElement, viewport=canvas.getBoundingClientRect();
    const rect=panel.getBoundingClientRect();
    if(!viewport.width||!viewport.height||!rect.width||!rect.height)return;
    const display=panel.querySelector('iframe');
    const screen=display?.getBoundingClientRect();
    const hasScreen=Boolean(screen?.width&&screen.height);
    const look=panel.ownerDocument.body.dataset.roomLook;
    const key=[rect.width,rect.height,hasScreen?screen.width:0,hasScreen?screen.height:0,look].join(':');
    if(this.key!==key){
      this.key=key;
      this.clear();
      const css=panel.ownerDocument.defaultView.getComputedStyle(panel);
      const edge=css.getPropertyValue('--gold').trim()||'#eed19b';
      const add=(width,height,radius,color,opacity)=>{
        const mesh=new Mesh(roundedPlate(width,height,radius),new MeshBasicMaterial({
          color,opacity,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
        }));
        mesh.renderOrder=this.layers.children.length;
        this.layers.add(mesh);
        return mesh;
      };
      this.back=[
        add(rect.width+14,rect.height+14,26,0x081117,.15),
        add(rect.width+8,rect.height+8,24,0x081117,.30),
        add(rect.width+2,rect.height+2,20,edge,.64),
        add(rect.width,rect.height,19,look==='amber'?0x342322:0x12262d,1),
      ];
      this.rim=hasScreen?[
        add(screen.width+10,screen.height+10,16,edge,.16),
        add(screen.width+3,screen.height+3,13,edge,.58),
      ]:[];
    }
    if(this.camera.right!==viewport.width||this.camera.top!==viewport.height){
      this.camera.right=viewport.width;this.camera.top=viewport.height;
      this.camera.updateProjectionMatrix();
    }
    const place=(mesh,bounds,dy=0)=>mesh.position.set(
      bounds.left-viewport.left+bounds.width/2,viewport.bottom-bounds.top-bounds.height/2-dy,0);
    this.back.forEach((mesh,i)=>place(mesh,rect,i<2?4:0));
    if(hasScreen)this.rim.forEach(mesh=>place(mesh,screen));
    this.render();
    panel.dataset.worldDisplay='';
  }

  render(){
    const auto=this.webgl.autoClear;
    this.webgl.autoClear=false;
    try{this.webgl.clearDepth();this.webgl.render(this.scene,this.camera);}
    finally{this.webgl.autoClear=auto;}
  }

  dispose(){
    this.clear();
    delete this.panel.dataset.worldDisplay;
  }
}
