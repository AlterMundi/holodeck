import {
  Color,DoubleSide,Mesh,MeshBasicMaterial,OrthographicCamera,PlaneGeometry,
  Scene,ShaderMaterial,Vector2,WebGLRenderTarget,
} from 'three';

const size=128;
const refreshInterval=50;
const receivers={
  worktable:{width:1.56,depth:1.28,offset:-.002,round:false},
  archive:{width:1.21,depth:1.21,offset:-.007,round:true},
};

// The two authored display surfaces receive a projected silhouette from an
// overhead fixture. Render only the live model and preserve its section plane.
export class CollectionContactShadow{
  constructor(renderer,scene,fixture){
    const {width,depth,offset,round}=receivers[fixture];
    this.renderer=renderer;
    this.offset=offset;
    this.camera=new OrthographicCamera(-width/2,width/2,depth/2,-depth/2,.08,4);
    this.camera.up.set(0,0,-1);
    this.maskScene=new Scene();
    this.maskScene.background=new Color(0);
    this.maskMaterial=new MeshBasicMaterial({color:0xffffff,toneMapped:false,side:DoubleSide});
    this.mask=new WebGLRenderTarget(size,size,{stencilBuffer:false});
    const pad=new Mesh(new PlaneGeometry(width,depth),new ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,
      polygonOffsetFactor:-1,polygonOffsetUnits:-1,
      uniforms:{silhouette:{value:this.mask.texture},stepUV:{value:new Vector2(1.8/size,1.8/size)},
        circular:{value:round},inspection:{value:0}},
      vertexShader:`
        varying vec2 contactUV;
        void main() {
          contactUV = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader:`
        uniform sampler2D silhouette;
        uniform vec2 stepUV;
        uniform bool circular;
        uniform float inspection;
        varying vec2 contactUV;
        void main() {
          vec2 uv = contactUV;
          float centre = texture2D(silhouette, uv).r;
          float coverage = 0.40 * centre;
          coverage += 0.15 * texture2D(silhouette, uv + vec2(stepUV.x, 0.0)).r;
          coverage += 0.15 * texture2D(silhouette, uv - vec2(stepUV.x, 0.0)).r;
          coverage += 0.15 * texture2D(silhouette, uv + vec2(0.0, stepUV.y)).r;
          coverage += 0.15 * texture2D(silhouette, uv - vec2(0.0, stepUV.y)).r;
          if (circular) coverage *= 1.0 - smoothstep(0.475, 0.5, length(uv - 0.5));
          vec2 bevel = abs(uv - 0.5);
          float border = circular ? length(bevel) : max(bevel.x, bevel.y);
          float inset = smoothstep(0.402, 0.467, border) * (1.0 - smoothstep(0.473, 0.497, border));
          float spill = coverage * (1.0 - centre);
          float glow = inspection * (0.36 * inset + 0.29 * spill);
          float shadow = 0.32 * coverage;
          vec3 shade = mix(vec3(0.018, 0.023, 0.032), vec3(0.055, 0.57, 0.73),
            glow / max(0.0001, shadow + glow));
          gl_FragColor = vec4(shade, shadow + glow);
          #include <colorspace_fragment>
        }
      `,
    }));
    pad.name='collection-contact-shadow-'+fixture;
    pad.rotation.x=-Math.PI/2;
    pad.raycast=()=>{};
    pad.visible=false;
    scene.add(pad);
    this.pad=pad;
    this.proxies=new Map();
    this.nextFrame=0;
  }

  update(model,anchor,revision,now,inspection=0){
    this.pad.material.uniforms.inspection.value=inspection;
    if(!model||!anchor){
      this.pad.visible=false;
      this.model=null;
      this.proxies.clear();
      return;
    }
    const changed=model!==this.model;
    if(!changed&&(revision===this.revision||now<this.nextFrame))return;
    if(changed)this.proxies.clear();
    model.updateWorldMatrix(true,true);
    this.maskMaterial.clippingPlanes=null;
    model.traverseVisible(object=>{
      if(!object.isMesh)return;
      if(!this.proxies.has(object)){
        const proxy=new Mesh(object.geometry,this.maskMaterial);
        proxy.matrixAutoUpdate=false;
        this.proxies.set(object,proxy);
      }
      const proxy=this.proxies.get(object);
      proxy.matrix.copy(object.matrixWorld);
      proxy.matrixWorldNeedsUpdate=true;
      this.maskMaterial.clippingPlanes??=object.material?.clippingPlanes??null;
      this.maskScene.add(proxy);
    });
    const {x,z}=anchor,y=anchor.y+this.offset;
    this.camera.position.set(x,y+3,z);
    this.camera.lookAt(x,y,z);
    this.pad.position.set(x,y,z);
    const renderer=this.renderer;
    const previous=renderer.getRenderTarget();
    try{
      renderer.setRenderTarget(this.mask);
      renderer.render(this.maskScene,this.camera);
    }finally{
      renderer.setRenderTarget(previous);
      this.maskScene.clear();
    }
    this.pad.visible=true;
    this.model=model;
    this.revision=revision;
    this.nextFrame=now+refreshInterval;
  }

  dispose(){
    this.pad.removeFromParent();
    this.pad.geometry.dispose();
    this.pad.material.dispose();
    this.maskMaterial.dispose();
    this.mask.dispose();
    this.proxies.clear();
  }
}
