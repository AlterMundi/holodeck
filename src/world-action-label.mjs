import {BufferAttribute,BufferGeometry,CanvasTexture,DynamicDrawUsage,Line,LineBasicMaterial,LinearFilter,Quaternion,Ray,Sprite,SpriteMaterial,SRGBColorSpace,Vector3} from 'three';

const labelHeight=104;
const labelFont='600 33px system-ui';

// Presentation only. The nearby action retains its own admission, input and accessibility.
export class WorldActionLabel{
  constructor({scene,document,colliders}){
    this.colliders=colliders;
    this.canvas=document.createElement('canvas');
    this.canvas.height=labelHeight;
    this.context=this.canvas.getContext('2d');
    if(!this.context)return;
    this.sprite=new Sprite(new SpriteMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
    this.sprite.name='World action label';
    this.sprite.center.set(.5,.15);
    this.sprite.renderOrder=42;
    this.sprite.raycast=()=>{};
    this.sprite.visible=false;
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(6),3).setUsage(DynamicDrawUsage));
    const material=new LineBasicMaterial({color:0xdab77e,opacity:.9,transparent:true,depthWrite:false,toneMapped:false});
    this.leader=new Line(geometry,material);
    this.leader.name='World action leader';
    this.leader.renderOrder=41;
    this.leader.frustumCulled=false;
    this.leader.visible=false;
    this.leader.raycast=()=>{};
    this.target=new Vector3();
    this.view=new Vector3();
    this.body=new Vector3();
    this.base=new Vector3();
    this.ray=new Ray();
    this.rotation=new Quaternion();
    this.inverse=new Quaternion();
    scene.add(this.leader,this.sprite);
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

  hide(){
    if(this.sprite)this.sprite.visible=this.leader.visible=false;
  }

  update(offer,camera,height,{light=false,feet}={}){
    if(!this.sprite)return;
    if(!offer||!camera||!height){this.hide();return;}
    const {anchor,label,key=''}=offer;
    const {position,rotation,fov,aspect}=camera;
    this.target.set(anchor.x,anchor.y,anchor.z);
    this.rotation.set(rotation.x,rotation.y,rotation.z,rotation.w);
    this.inverse.copy(this.rotation).invert();
    const toView=point=>point.sub(position).applyQuaternion(this.inverse);
    const view=toView(this.view.copy(this.target));
    const tangent=Math.tan(fov*Math.PI/360);
    const halfHeight=-view.z*tangent;
    if(view.z>-.24||!Number.isFinite(halfHeight)||Math.abs(view.x)>halfHeight*aspect*.97||
      view.y<-.92*halfHeight||view.y>.92*halfHeight){this.hide();return;}

    // The screen-facing label may overlay an avatar. Do not announce an
    // object through a distant wall. The final half metre allows the ray to
    // stop at the front surface of the furniture it identifies.
    this.ray.origin.copy(position);
    this.ray.direction.copy(this.target).sub(position);
    const distance=this.ray.direction.length();
    this.ray.direction.divideScalar(distance);
    if(distance>.62&&this.colliders?.raycastFirst(this.ray,distance-.62)){
      this.hide();
      return;
    }

    const signature=JSON.stringify([label,key,light]);
    if(signature!==this.signature){
      this.paint(label,key,light);
      this.signature=signature;
    }
    const base=this.base.copy(this.target);
    if(feet)base.y=feet.y+1.38;
    toView(base);
    base.z=view.z;
    const size=Math.min(.48,2*halfHeight*50/height);
    const width=size*this.canvas.width/labelHeight;
    const side=halfHeight*aspect*.93-width*.5;
    if(side<=0){this.hide();return;}
    if(feet){
      const body=toView(this.body.set(feet.x,feet.y+1.05,feet.z));
      if(body.z<-.28){
        const center=body.x*view.z/body.z;
        const gap=width*.5+Math.min(.38*view.z/body.z,.46*halfHeight)+.05;
        if(Math.abs(base.x-center)<gap){
          const preferred=base.x<center?-1:1;
          const chosen=center+gap*preferred;
          base.x=Math.abs(chosen)<side?chosen:center-gap*preferred;
        }
      }
    }
    base.x=Math.min(side,Math.max(-side,base.x));
    base.y=Math.min(halfHeight*.58,Math.max(-halfHeight*.55,base.y));
    base.applyQuaternion(this.rotation).add(position);
    this.sprite.position.copy(base);
    this.sprite.scale.set(width,size,1);
    const ends=this.leader.geometry.attributes.position;
    ends.setXYZ(0,base.x,base.y,base.z);
    ends.setXYZ(1,this.target.x,this.target.y,this.target.z);
    ends.needsUpdate=true;
    this.sprite.visible=this.leader.visible=true;
  }

  dispose(){
    this.sprite?.removeFromParent();
    this.sprite?.material.dispose();
    this.leader?.removeFromParent();
    this.leader?.geometry.dispose();
    this.leader?.material.dispose();
    this.texture?.dispose();
  }
}
