import {CanvasTexture,LinearFilter,Quaternion,Sprite,SpriteMaterial,SRGBColorSpace,Vector3} from 'three';

const labelHeight=104;
const labelFont='600 33px system-ui';

// Presentation only. The nearby action retains its own admission, input and accessibility.
export class WorldActionLabel{
  constructor({scene,document}){
    this.canvas=document.createElement('canvas');
    this.canvas.height=labelHeight;
    this.context=this.canvas.getContext('2d');
    if(!this.context)return;
    this.sprite=new Sprite(new SpriteMaterial({transparent:true,depthWrite:false,toneMapped:false}));
    this.sprite.name='World action label';
    this.sprite.center.set(.5,.06);
    this.sprite.visible=false;
    this.eye=new Vector3();
    this.cameraRotation=new Quaternion();
    scene.add(this.sprite);
  }

  paint(label,key,light){
    const context=this.context;
    context.font=labelFont;
    const source=Array.from(label.slice(0,128));
    let caption=source.join('');
    while(source.length&&context.measureText(caption).width>612){
      source.pop();
      caption=source.join('')+'…';
    }
    this.canvas.width=Math.ceil(context.measureText(caption).width+(key?136:52));
    const width=this.canvas.width;
    const panel=context.createLinearGradient(0,4,0,88);
    panel.addColorStop(0,light?'#eef8f4f5':'#213943f5');
    panel.addColorStop(1,light?'#c5d9d7f5':'#112229fc');
    const rect=(x,y,w,h,r)=>{
      context.beginPath();
      if(context.roundRect)context.roundRect(x,y,w,h,r);
      else context.rect(x,y,w,h);
    };
    rect(4,4,width-8,84,22);
    context.fillStyle=panel;
    context.fill();
    context.lineWidth=2;
    context.strokeStyle=light?'#66502f':'#dab77e';
    context.stroke();
    context.beginPath();
    context.moveTo(width/2-8,89);
    context.lineTo(width/2,99);
    context.lineTo(width/2+8,89);
    context.stroke();
    context.textBaseline='middle';
    if(key){
      rect(18,19,56,54,12);
      context.fillStyle=light?'#69502c':'#e4bb7d';
      context.fill();
      context.fillStyle=light?'#fff9e8':'#17262c';
      context.font='700 30px system-ui';
      context.textAlign='center';
      context.fillText(key,46,47);
    }
    context.textAlign='left';
    context.font=labelFont;
    context.fillStyle=light?'#13282c':'#fff5e3';
    context.fillText(caption,key?92:26,48);
    this.texture?.dispose();
    this.texture=new CanvasTexture(this.canvas);
    this.texture.colorSpace=SRGBColorSpace;
    this.texture.minFilter=LinearFilter;
    this.texture.generateMipmaps=false;
    this.sprite.material.map=this.texture;
    this.sprite.material.needsUpdate=true;
  }

  update(offer,camera,height,{light=false}={}){
    if(!this.sprite)return;
    if(!offer||!camera||!height){this.sprite.visible=false;return;}
    const {anchor,label,key=''}=offer;
    const {position,rotation,fov,aspect}=camera;
    this.sprite.position.set(anchor.x,anchor.y,anchor.z);
    this.cameraRotation.set(rotation.x,rotation.y,rotation.z,rotation.w).invert();
    const view=this.eye.copy(this.sprite.position).sub(position).applyQuaternion(this.cameraRotation);
    const halfHeight=-view.z*Math.tan(fov*Math.PI/360);
    if(view.z>-.24||!Number.isFinite(halfHeight)||Math.abs(view.x)>halfHeight*aspect*.9||
      view.y<-.70*halfHeight||view.y>.90*halfHeight){
      this.sprite.visible=false;
      return;
    }
    const signature=JSON.stringify([label,key,light]);
    if(signature!==this.signature){
      this.paint(label,key,light);
      this.signature=signature;
    }
    const size=Math.min(.48,2*halfHeight*46/height);
    this.sprite.scale.set(size*this.canvas.width/labelHeight,size,1);
    this.sprite.visible=true;
  }

  dispose(){
    this.sprite?.removeFromParent();
    this.sprite?.material.dispose();
    this.texture?.dispose();
  }
}
