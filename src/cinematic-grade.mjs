import {
  BufferGeometry, DepthTexture, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix4, Mesh,
  NoBlending, AdditiveBlending, OrthographicCamera, RGBAFormat, ShaderMaterial, SRGBColorSpace,
  UnsignedIntType, Vector2, WebGLRenderTarget,
} from 'three';

// Cinematic finish for the shared world view: the world scene renders into a
// linear HDR multisampled target, then one composite adds depth ambient
// occlusion, a soft physically-motivated bloom and a filmic grade before the
// renderer's own tone mapping and sRGB output. Everything else (HUD layers,
// post scene, transmission and shadow subrenders) keeps Three's normal path.
// The lightweight graphics choice never enters this module.

export const GRADE_DEFAULTS=Object.freeze({
  bloomStrength:.42,   // mix of the blurred highlights
  bloomThreshold:.85,  // linear radiance where highlights start to glow
  bloomKnee:.6,
  bloomBase:.035,      // faint full-image glow for a filmic softness
  aoRadius:.65,        // metres
  aoStrength:.85,
  aoDistance:60,       // metres where occlusion has faded out
  saturation:1.14,
  contrast:1.09,
  vignette:.24,
});

const MAX_PIXELS=2600000;
const BLOOM_LEVELS=5;

const fullscreenVertex=`
  varying vec2 vUv;
  void main(){
    vUv=position.xy*.5+.5;
    gl_Position=vec4(position,1.);
  }
`;

// Soft-knee threshold into the first half resolution level, with a 13 tap
// downsample that keeps tiny emissive points from flickering.
const prefilterShader=`
  uniform sampler2D source;
  uniform vec2 texel;
  uniform float threshold;
  uniform float knee;
  uniform float base;
  varying vec2 vUv;
  vec3 tap(vec2 offset){return texture2D(source,vUv+offset*texel).rgb;}
  vec3 bright(vec3 colour){
    colour=min(colour,vec3(64.0));
    float peak=max(colour.r,max(colour.g,colour.b));
    float soft=clamp(peak-threshold+knee,0.0,2.0*knee);
    soft=soft*soft/(4.0*knee+1e-4);
    float contribution=max(soft,peak-threshold)/max(peak,1e-4);
    return colour*(contribution+base);
  }
  void main(){
    vec3 a=tap(vec2(-1.,-1.)),b=tap(vec2(1.,-1.)),c=tap(vec2(-1.,1.)),d=tap(vec2(1.,1.));
    vec3 e=tap(vec2(-2.,0.)),f=tap(vec2(2.,0.)),g=tap(vec2(0.,-2.)),h=tap(vec2(0.,2.)),m=tap(vec2(0.));
    vec3 sum=(a+b+c+d)*.125+(e+f+g+h)*.0625+m*.25;
    // Karis-like luminance weight against single bright pixels.
    float luma=dot(sum,vec3(.2126,.7152,.0722));
    gl_FragColor=vec4(bright(sum)/(1.0+luma*.04),1.0);
  }
`;

const downShader=`
  uniform sampler2D source;
  uniform vec2 texel;
  varying vec2 vUv;
  vec3 tap(vec2 offset){return texture2D(source,vUv+offset*texel).rgb;}
  void main(){
    vec3 sum=tap(vec2(0.))*4.0+tap(vec2(-1.,-1.))+tap(vec2(1.,-1.))+tap(vec2(-1.,1.))+tap(vec2(1.,1.));
    gl_FragColor=vec4(sum/8.0,1.0);
  }
`;

const upShader=`
  uniform sampler2D source;
  uniform vec2 texel;
  uniform float weight;
  varying vec2 vUv;
  vec3 tap(vec2 offset){return texture2D(source,vUv+offset*texel).rgb;}
  void main(){
    vec3 sum=tap(vec2(-1.,-1.))+tap(vec2(1.,-1.))+tap(vec2(-1.,1.))+tap(vec2(1.,1.));
    sum+=2.0*(tap(vec2(-1.,0.))+tap(vec2(1.,0.))+tap(vec2(0.,-1.))+tap(vec2(0.,1.)));
    sum+=4.0*tap(vec2(0.));
    gl_FragColor=vec4(sum/16.0*weight,1.0);
  }
`;

const compositeShader=`
  #include <packing>
  #define AO_SAMPLES 6
  uniform sampler2D sceneColor;
  uniform sampler2D sceneDepth;
  uniform sampler2D bloom;
  uniform vec2 clipRange;
  uniform vec2 texel;
  uniform mat4 inverseProjection;
  uniform mat4 projection;
  uniform float bloomStrength;
  uniform float aoRadius;
  uniform float aoStrength;
  uniform float aoDistance;
  uniform float saturation;
  uniform float contrast;
  uniform float vignette;
  uniform float frame;
  varying vec2 vUv;

  vec3 viewPosition(vec2 uv){
    float depth=texture2D(sceneDepth,uv).r;
    vec4 clip=vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
    vec4 view=inverseProjection*clip;
    return view.xyz/view.w;
  }

  float interleavedNoise(vec2 pixel){
    return fract(52.9829189*fract(dot(pixel+frame*5.588238,vec2(.06711056,.00583715))));
  }

  // Scalable ambient obscurance from the resolved depth only.
  float ambientOcclusion(vec3 position,float distanceToEye){
    if(aoStrength<=0.0||distanceToEye>aoDistance)return 1.0;
    // Screen-space derivatives give the facet normal without extra depth reads.
    vec3 normal=normalize(cross(dFdx(position),dFdy(position)));
    if(dot(normal,position)>0.0)normal=-normal;
    vec4 projected=projection*vec4(aoRadius,0.,position.z,1.);
    float screenRadius=clamp(abs(projected.x/projected.w)*.5,texel.x*2.0,.08);
    float angle=interleavedNoise(gl_FragCoord.xy)*6.2831853;
    float occlusion=0.0;
    for(int i=0;i<AO_SAMPLES;i++){
      float t=(float(i)+.5)/float(AO_SAMPLES);
      float a=angle+float(i)*2.3999632;
      vec2 offset=vec2(cos(a),sin(a))*screenRadius*sqrt(t)*vec2(1.0,texel.y/texel.x);
      vec3 delta=viewPosition(vUv+offset)-position;
      float lengthSq=dot(delta,delta);
      float falloff=max(0.0,1.0-lengthSq/(aoRadius*aoRadius*4.0));
      occlusion+=max(0.0,dot(normal,delta)/sqrt(lengthSq+1e-4)-.08)*falloff;
    }
    occlusion=occlusion/float(AO_SAMPLES);
    float fade=1.0-smoothstep(aoDistance*.55,aoDistance,distanceToEye);
    return clamp(1.0-occlusion*aoStrength*1.6*fade,0.0,1.0);
  }

  void main(){
    vec4 colour=texture2D(sceneColor,vUv);
    float depth=texture2D(sceneDepth,vUv).r;
    vec3 radiance=colour.rgb;
    if(depth<1.0){
      vec3 position=viewPosition(vUv);
      float ao=ambientOcclusion(position,-position.z);
      // Darken indirect-looking light more than direct highlights.
      float luma=dot(radiance,vec3(.2126,.7152,.0722));
      radiance*=mix(ao,1.0,smoothstep(1.2,4.0,luma)*.5);
    }
    radiance+=texture2D(bloom,vUv).rgb*bloomStrength;

    // Filmic grade in linear light, before the renderer's tone mapping.
    float luma=dot(radiance,vec3(.2126,.7152,.0722));
    vec3 shadowTint=vec3(.955,1.0,1.05);
    vec3 lightTint=vec3(1.045,1.0,.955);
    radiance*=mix(shadowTint,lightTint,smoothstep(.02,.9,luma));
    radiance=max(mix(vec3(luma),radiance,saturation),0.0);
    radiance=.18*pow(radiance/.18+1e-6,vec3(contrast));
    vec2 centred=vUv-.5;
    radiance*=1.0-vignette*smoothstep(.18,.95,dot(centred,centred)*2.2);

    gl_FragColor=vec4(radiance,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    // Triangular dither against banding in skies and fog.
    float noise=interleavedNoise(gl_FragCoord.xy+17.0)+interleavedNoise(gl_FragCoord.xy+59.0)-1.0;
    gl_FragColor.rgb+=noise/255.0;
  }
`;

function fullscreenTriangle(){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3));
  return geometry;
}

export class CinematicGrade {
  constructor(webgl,scene,settings={}){
    this.webgl=webgl;
    this.scene=scene;
    this.settings={...GRADE_DEFAULTS,...settings};
    this.size=new Vector2();
    this.frame=0;
  }

  get available(){
    const gl=this.webgl;
    return !(this.cannotCapture||gl.xr.isPresenting||gl.getContext().isContextLost()||
      gl.capabilities.logarithmicDepthBuffer||gl.capabilities.reversedDepthBuffer||
      gl.outputColorSpace!==SRGBColorSpace||!gl.extensions.has('EXT_color_buffer_float'));
  }

  draw(drawWorld){
    const gl=this.webgl;
    const {x,y}=gl.getDrawingBufferSize(this.size);
    if(!x||!y||x*y>MAX_PIXELS||!this.available){
      this.dispose();
      drawWorld();
      return;
    }
    const render=gl.render;
    gl.render=(scene,camera)=>{
      if(scene!==this.scene||gl.getRenderTarget()!==null||!camera.isPerspectiveCamera){
        render.call(gl,scene,camera);
        return;
      }
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

  allocate(render,scene,camera,width,height){
    const gl=this.webgl,context=gl.getContext();
    const samples=Math.min(width*height>1500000?2:4,gl.capabilities.maxSamples);
    const supports=format=>(context.getInternalformatParameter(
      context.RENDERBUFFER,format,context.SAMPLES)??[]).includes(samples);
    if(!samples||!supports(context.DEPTH_COMPONENT24)||!supports(context.RGBA16F)){
      this.cannotCapture=true;
      return false;
    }
    this.target=new WebGLRenderTarget(width,height,{
      type:HalfFloatType,format:RGBAFormat,samples,
      depthTexture:new DepthTexture(width,height,UnsignedIntType),
    });
    this.target.texture.name='Holodeck cinematic scene';
    this.validateTarget=true;
    const levelOptions={type:HalfFloatType,format:RGBAFormat,minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:false};
    this.levels=Array.from({length:BLOOM_LEVELS},()=>new WebGLRenderTarget(1,1,levelOptions));
    this.ups=Array.from({length:BLOOM_LEVELS-1},()=>new WebGLRenderTarget(1,1,levelOptions));
    const geometry=fullscreenTriangle();
    const pass=(fragmentShader,uniforms,blending=NoBlending)=>{
      const mesh=new Mesh(geometry,new ShaderMaterial({uniforms,vertexShader:fullscreenVertex,fragmentShader,
        depthTest:false,depthWrite:false,blending,toneMapped:false}));
      mesh.frustumCulled=false;
      return mesh;
    };
    const s=this.settings;
    this.prefilter=pass(prefilterShader,{source:{value:null},texel:{value:new Vector2()},
      threshold:{value:s.bloomThreshold},knee:{value:s.bloomKnee},base:{value:s.bloomBase}});
    this.down=pass(downShader,{source:{value:null},texel:{value:new Vector2()}});
    this.up=pass(upShader,{source:{value:null},texel:{value:new Vector2()},weight:{value:1}},AdditiveBlending);
    this.copyUp=pass(upShader,{source:{value:null},texel:{value:new Vector2()},weight:{value:1}});
    this.composite=pass(compositeShader,{
      sceneColor:{value:this.target.texture},sceneDepth:{value:this.target.depthTexture},bloom:{value:null},
      clipRange:{value:new Vector2()},texel:{value:new Vector2()},
      inverseProjection:{value:new Matrix4()},projection:{value:new Matrix4()},
      bloomStrength:{value:s.bloomStrength},aoRadius:{value:s.aoRadius},aoStrength:{value:s.aoStrength},
      aoDistance:{value:s.aoDistance},saturation:{value:s.saturation},contrast:{value:s.contrast},
      vignette:{value:s.vignette},frame:{value:0},
    });
    this.composite.material.toneMapped=true;
    this.geometry=geometry;
    this.camera=new OrthographicCamera();
    return true;
  }

  resize(width,height){
    this.validateTarget ||= this.target.width!==width||this.target.height!==height;
    this.target.setSize(width,height);
    let w=width,h=height;
    for(let i=0;i<BLOOM_LEVELS;i++){
      w=Math.max(1,w>>1);h=Math.max(1,h>>1);
      this.levels[i].setSize(w,h);
      if(i<BLOOM_LEVELS-1)this.ups[i].setSize(w,h);
    }
  }

  pass(render,mesh,target){
    this.webgl.setRenderTarget(target);
    render.call(this.webgl,mesh,this.camera);
  }

  renderWorld(render,scene,camera,width,height){
    const gl=this.webgl;
    if(!this.target&&!this.allocate(render,scene,camera,width,height)){
      render.call(gl,scene,camera);
      return;
    }
    this.resize(width,height);
    const autoClear=gl.autoClear;
    gl.setRenderTarget(this.target);
    try{
      if(this.validateTarget){
        this.validateTarget=false;
        const context=gl.getContext();
        if(context.checkFramebufferStatus(context.FRAMEBUFFER)!==context.FRAMEBUFFER_COMPLETE){
          this.cannotCapture=true;
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
      // Every pass below overwrites or deliberately accumulates its target.
      gl.autoClear=false;

      // Bloom: threshold, a downsample chain, then a tent upsample chain.
      const prefilter=this.prefilter.material.uniforms;
      prefilter.source.value=this.target.texture;
      prefilter.texel.value.set(1/width,1/height);
      this.pass(render,this.prefilter,this.levels[0]);
      const down=this.down.material.uniforms;
      for(let i=1;i<BLOOM_LEVELS;i++){
        down.source.value=this.levels[i-1].texture;
        down.texel.value.set(1/this.levels[i-1].width,1/this.levels[i-1].height);
        this.pass(render,this.down,this.levels[i]);
      }
      // ups[i] holds the accumulated bloom at level i.
      let source=this.levels[BLOOM_LEVELS-1];
      for(let i=BLOOM_LEVELS-2;i>=0;i--){
        const copy=this.copyUp.material.uniforms;
        // Start from this level's own blur, then add the coarser accumulation.
        copy.source.value=this.levels[i].texture;
        copy.texel.value.set(.5/this.levels[i].width,.5/this.levels[i].height);
        copy.weight.value=1;
        this.pass(render,this.copyUp,this.ups[i]);
        const up=this.up.material.uniforms;
        up.source.value=source.texture;
        up.texel.value.set(1/source.width,1/source.height);
        up.weight.value=.85;
        this.pass(render,this.up,this.ups[i]);
        source=this.ups[i];
      }
    }finally{
      gl.autoClear=autoClear;
      gl.setRenderTarget(null);
    }
    const uniforms=this.composite.material.uniforms;
    uniforms.bloom.value=this.ups[0].texture;
    uniforms.clipRange.value.set(camera.near,camera.far);
    uniforms.texel.value.set(1/width,1/height);
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.projection.value.copy(camera.projectionMatrix);
    uniforms.frame.value=this.frame=(this.frame+1)%64;
    // When the adaptive budget has lowered the drawing buffer, skip occlusion.
    uniforms.aoStrength.value=gl.getPixelRatio()<.9?0:this.settings.aoStrength;
    render.call(gl,this.composite,this.camera);
  }

  dispose(){
    if(!this.target)return;
    this.target.dispose();
    for(const level of [...this.levels,...this.ups])level.dispose();
    for(const mesh of [this.prefilter,this.down,this.up,this.copyUp,this.composite])mesh.material.dispose();
    this.geometry.dispose();
    this.target=this.levels=this.ups=this.prefilter=this.down=this.up=this.copyUp=this.composite=null;
  }
}
