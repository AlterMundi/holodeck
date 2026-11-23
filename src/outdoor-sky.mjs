import {EquirectangularReflectionMapping,SRGBColorSpace,TextureLoader} from 'three';

// A baked panorama backs the exterior and selected authored room apertures.
// Keep the decoded texture across room changes and release it with the renderer.
export class OutdoorSky {
  constructor(scene,base){
    this.scene=scene?.isScene?scene:null;
    this.gradient=this.scene?.children.find(child=>child.isSky===true);
    this.gradientVisible=this.gradient?.visible;
    this.base=base;
    this.fallback=null;
    this.texture=null;
    this.path=null;
    this.disposed=false;
  }

  update(selection){
    if(!this.scene||this.disposed)return;
    if(!selection){
      this.restore();
      return;
    }
    if(!this.path){
      if(selection.asset!=='coastal-sky.jpg'||!/^[a-f0-9]{64}$/.test(selection.revision))return;
      this.path=new URL('assets/'+selection.asset+'?v='+selection.revision.slice(0,12),this.base).href;
      new TextureLoader().load(this.path,texture=>{
        const {width,height}=texture.image;
        if(this.disposed||width!==height*2||width>2048){texture.dispose();return;}
        texture.mapping=EquirectangularReflectionMapping;
        texture.colorSpace=SRGBColorSpace;
        this.texture=texture;
      },undefined,()=>{});
    }
    if(this.texture&&this.scene.background!==this.texture){
      this.fallback=this.scene.background;
      this.scene.background=this.texture;
      if(this.gradient)this.gradient.visible=false;
    }
  }

  restore(){
    if(this.texture&&this.scene?.background===this.texture){
      this.scene.background=this.fallback;
      if(this.gradient)this.gradient.visible=this.gradientVisible;
    }
  }

  dispose(){
    this.disposed=true;
    this.restore();
    this.texture?.dispose();
  }
}
