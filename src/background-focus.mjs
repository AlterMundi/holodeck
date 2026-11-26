import {
  BufferGeometry, DepthTexture, Float32BufferAttribute, HalfFloatType, Matrix4, Mesh,
  NoBlending, OrthographicCamera, RGBFormat, ShaderMaterial, SRGBColorSpace,
  UnsignedIntType, Vector2, Vector3, WebGLRenderTarget,
} from 'three';
import {terrainCoordinates,terrainFrame,TOROIDAL_TERRAIN} from './toroidal-terrain.mjs';

const START_METRES=36;
const MAX_PIXELS=1600000;

const fragmentShader=`
  #include <packing>
  uniform sampler2D sceneColor;
  uniform sampler2D sceneDepth;
  uniform vec2 pixel;
  uniform vec2 clipRange;
  uniform float nearRange;
  uniform float radius;
  uniform mat4 inverseProjection;
  uniform vec3 radialUp;
  uniform vec2 waterBounds;
  varying vec2 vUv;
  const vec2 offsets[4]=vec2[4](vec2(-.8,-.6),vec2(.6,-.8),vec2(.8,.6),vec2(-.6,.8));

  float viewDistance(vec2 uv) {
    return -perspectiveDepthToViewZ(texture2D(sceneDepth,uv).r,clipRange.x,clipRange.y);
  }

  float circleOfConfusion(float depth) {
    return clamp(1.0-nearRange/max(depth,nearRange),0.0,1.0);
  }

  float dryForeground() {
    // Bound the water level over the near segment. The torus tube distance
    // lies above its tangent minus the horizontal ring curvature error.
    vec4 point=inverseProjection*vec4(vUv*2.0-1.0,0.0,1.0);
    vec3 ray=point.xyz/(-point.z);
    float lengthNear=length(ray)*nearRange;
    float sag=lengthNear*lengthNear/(2.0*max(1.0,waterBounds.y-lengthNear));
    float minimum=waterBounds.x+min(0.0,dot(ray,radialUp)*nearRange)-sag;
    return smoothstep(.06,1.7,minimum);
  }

  void main() {
    vec4 center=texture2D(sceneColor,vUv);
    if(radius>0.0){
      float depth=viewDistance(vUv);
      float coc=circleOfConfusion(depth);
      float amount=coc;
      if(amount>0.0)amount*=dryForeground();
      if(amount>.01){
        vec3 sum=center.rgb;
        float weightSum=1.0;
        for(int i=0;i<4;i++){
          vec2 tap=(floor(vUv/pixel+offsets[i]*radius)+.5)*pixel;
          float tapCoc=circleOfConfusion(viewDistance(tap));
          // Reject near silhouettes from the far colour.
          float weight=smoothstep(coc-.12,coc-.04,tapCoc)*tapCoc;
          sum+=texture2D(sceneColor,tap).rgb*weight;
          weightSum+=weight;
        }
        center.rgb=mix(center.rgb,sum/weightSum,amount);
      }
    }
    gl_FragColor=center;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class BackgroundFocus {
  constructor(webgl,scene,{strength=1}={}){
    this.webgl=webgl;
    this.scene=scene;
    this.strength=strength;
    this.size=new Vector2();
    this.eye=new Vector3();
    this.up=new Vector3();
  }

  draw(drawWorld){
    const gl=this.webgl;
    const {x,y}=gl.getDrawingBufferSize(this.size);
    if(!x||!y||x*y>MAX_PIXELS||gl.xr.isPresenting||gl.getContext().isContextLost()||
       gl.capabilities.logarithmicDepthBuffer||gl.capabilities.reversedDepthBuffer||
       gl.outputColorSpace!==SRGBColorSpace||!gl.extensions.has('EXT_color_buffer_float')){
      this.dispose();
      drawWorld();
      return;
    }
    if(this.cannotCapture){drawWorld();return;}
    const render=gl.render;
    gl.render=(scene,camera)=>{
      if(scene!==this.scene||gl.getRenderTarget()!==null||!camera.isPerspectiveCamera){
        render.call(gl,scene,camera);
        return;
      }
      // Transmission and shadow subrenders keep Three's normal target selection.
      gl.render=render;
      try{
        this.renderWorld(render,scene,camera,x,y);
      }finally{
        gl.render=render;
      }
    };
    try{
      drawWorld();
    }finally{
      gl.render=render;
    }
  }

  renderWorld(render,scene,camera,width,height){
    const gl=this.webgl;
    if(!this.target){
      const context=gl.getContext();
      const samples=Math.min(4,gl.capabilities.maxSamples);
      const supports=format=>(context.getInternalformatParameter(
        context.RENDERBUFFER,format,context.SAMPLES)??[]).includes(samples);
      const packed=!this.rejectPacked&&supports(context.R11F_G11F_B10F);
      if(!samples||!supports(context.DEPTH_COMPONENT24)||(!packed&&!supports(context.RGBA16F))){
        this.cannotCapture=true;
        render.call(gl,scene,camera);
        return;
      }
      this.target=new WebGLRenderTarget(width,height,{
        type:HalfFloatType,
        ...(packed?{format:RGBFormat,internalFormat:'R11F_G11F_B10F'}:{}),
        samples,
        depthTexture:new DepthTexture(width,height,UnsignedIntType),
      });
      this.validateTarget=true;
      this.target.texture.name='Holodeck background focus';
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3));
      const material=new ShaderMaterial({
        uniforms:{
          sceneColor:{value:this.target.texture},sceneDepth:{value:this.target.depthTexture},
          pixel:{value:new Vector2()},clipRange:{value:new Vector2()},
          nearRange:{value:START_METRES},radius:{value:0},inverseProjection:{value:new Matrix4()},
          radialUp:{value:new Vector3()},waterBounds:{value:new Vector2()},
        },
        vertexShader:`
          varying vec2 vUv;
          void main(){
            vUv=position.xy*.5+.5;
            gl_Position=vec4(position,1.);
          }
        `,fragmentShader,depthTest:false,depthWrite:false,blending:NoBlending,
      });
      this.quad=new Mesh(geometry,material);
      this.quad.frustumCulled=false;
      this.camera=new OrthographicCamera();
    }
    this.validateTarget ||= this.target.width!==width||this.target.height!==height;
    this.target.setSize(width,height);
    const {uniforms}=this.quad.material;
    uniforms.pixel.value.set(1/width,1/height);
    uniforms.clipRange.value.set(camera.near,camera.far);
    camera.updateWorldMatrix(true,false);
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    const {u,v,height:radialHeight}=terrainCoordinates(this.eye.toArray());
    const waterHeight=radialHeight-TOROIDAL_TERRAIN.waterLevel;
    this.up.fromArray(terrainFrame(u,v).up).transformDirection(camera.matrixWorldInverse);
    uniforms.radialUp.value.copy(this.up);
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.waterBounds.value.set(waterHeight,Math.hypot(this.eye.x,this.eye.z));
    uniforms.radius.value=this.strength*Math.min(2.5,height*.0056);
    gl.setRenderTarget(this.target);
    try{
      if(this.validateTarget){
        this.validateTarget=false;
        const context=gl.getContext();
        if(context.checkFramebufferStatus(context.FRAMEBUFFER)!==context.FRAMEBUFFER_COMPLETE){
          this.cannotCapture=this.rejectPacked||this.target.texture.format!==RGBFormat;
          this.rejectPacked=true;
          gl.setRenderTarget(null);
          this.dispose();
          render.call(gl,scene,camera);
          return;
        }
      }
      // MML controls canvas clearing. A private target needs its own clear.
      gl.state.buffers.color.setMask(true);
      gl.state.buffers.depth.setMask(true);
      gl.clear(true,true,false);
      render.call(gl,scene,camera);
    }finally{
      gl.setRenderTarget(null);
    }
    render.call(gl,this.quad,this.camera);
  }

  dispose(){
    if(!this.target)return;
    this.target.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    this.target=this.quad=this.camera=null;
  }
}
