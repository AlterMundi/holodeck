import {Color,Vector2,Vector3,Vector4} from 'three';

// Navegante's face of light. The face plate in the model is plain ceramic; its
// features are drawn here, live, so every expression can animate: lit brows
// whose colour carries the mood, eyes that are glowing slits or closed arcs,
// and a mouth that is a seam, a smile or an open, glowing laugh. The nine
// expressions follow CompAII's navigator gallery (v6).

// Per side values are [viewer's left, viewer's right].
// brow: lift (-1 low .. 1 high), tilt (+ inner end up = worried, - = cross),
// eye: open (0 closed .. 1 wide), curve (+ closed happy arc, - sad arc),
// slant (+ lids angled down toward the nose), mouth: open, smile, skew.
export const EXPRESSIONS=Object.freeze({
  calm:     {brow:[0x5ce8ff],lift:[.05,.05],tilt:[0,0],open:[.0,.0],curve:[1,1],slant:[0,0],mouth:{open:0,smile:.35,skew:0}},
  curious:  {brow:[0xffc93a],lift:[.55,.1],tilt:[.1,-.1],open:[.0,.0],curve:[.9,.9],slant:[0,0],mouth:{open:.25,smile:.55,skew:.35}},
  joy:      {brow:[0x5cff8a],lift:[.6,.6],tilt:[.1,.1],open:[.0,.0],curve:[1.2,1.2],slant:[0,0],mouth:{open:1,smile:1,skew:0}},
  sad:      {brow:[0x4a8cff],lift:[-.1,-.1],tilt:[.9,.9],open:[.0,.0],curve:[-.8,-.8],slant:[0,0],mouth:{open:0,smile:-.35,skew:0}},
  anger:    {brow:[0xff3b30],lift:[-.35,-.35],tilt:[-1,-1],open:[.42,.42],curve:[0,0],slant:[.8,.8],mouth:{open:.05,smile:-.25,skew:0}},
  uncertain:{brow:[0xb06cff],lift:[.45,-.25],tilt:[.3,-.4],open:[.0,.35],curve:[.7,0],slant:[0,.3],mouth:{open:.15,smile:-.1,skew:-.7}},
  focus:    {brow:[0x5ce8ff],lift:[-.15,-.15],tilt:[-.2,-.2],open:[.5,.5],curve:[0,0],slant:[.15,.15],mouth:{open:0,smile:0,skew:0}},
  welcome:  {brow:[0x5ce8ff],lift:[.5,.5],tilt:[.15,.15],open:[.0,.0],curve:[1.1,1.1],slant:[0,0],mouth:{open:.75,smile:.9,skew:0}},
  sleep:    {brow:[0xffb23a],lift:[-.2,-.2],tilt:[.25,.25],open:[.0,.0],curve:[-.25,-.25],slant:[0,0],mouth:{open:0,smile:.1,skew:0}},
});
export const EXPRESSION_NAMES=Object.freeze(Object.keys(EXPRESSIONS));

const FACE_GLSL=`
uniform vec4 faceBrow;      // rgb, intensity
uniform vec4 faceLift;      // lift L, lift R, tilt L, tilt R
uniform vec4 faceEyes;      // open L, open R, curve L, curve R
uniform vec4 faceSlant;     // slant L, slant R, glow, blink
uniform vec4 faceMouth;     // open, smile, skew, speech
varying vec2 vFace;
float aa(float d){return clamp(.5-d/max(fwidth(d),1e-4),0.,1.);}
float capsule(vec2 p,vec2 a,vec2 b,float r){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
// Brow: a slightly arched bar from the inner to the outer end.
float browDist(vec2 p,float side,float lift,float tilt,out float along){
  vec2 c=vec2(side*.36,.47+lift*.11);
  float halfLength=.2;
  vec2 dir=normalize(vec2(side,-tilt*.42));
  vec2 inner=c-dir*halfLength,outer=c+dir*halfLength;
  vec2 q=p;q.y-=.035*(1.-pow((p.x-c.x)/halfLength,2.));
  vec2 pa=q-inner,ba=outer-inner;along=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
  return capsule(q,inner,outer,.05);
}
// Eye: a glowing slit under a lid, or a closed arc when open is ~0.
void eye(vec2 p,float side,float open,float curve,float slant,inout vec3 colour,inout vec3 glow){
  vec2 c=vec2(side*.37,.11);
  float w=.205;
  float x=(p.x-c.x)/w;
  float lid=c.y+.03-slant*.09*(x*side+1.)*.5*2.-.0;
  float bottom=lid-open*.3*sqrt(max(0.,1.-x*x));
  float inside=max(max(abs(x)-1.,p.y-lid),bottom-p.y);
  float slit=aa(inside*w*.9);
  // Closed: an arc (curve>0 happy ∩, curve<0 sad ∪).
  float arcY=c.y-.01+curve*.07*(1.-x*x)-.035*curve;
  float thick=.05*(1.-.55*x*x);
  float arc=aa(max(abs(p.y-arcY)-thick,abs(x)-1.)*w*.9);
  // The lit inner edge of a closed eye: under a happy arc, over a sad one.
  float arcGlow=arc*smoothstep(.2,1.,(arcY-p.y)*sign(curve+.001)/max(thick,.01));
  float shut=1.-smoothstep(.06,.2,open);
  float lit=mix(slit,arc,shut);
  // A dark recess with amber heat rising from the bottom of the slit.
  float heat=clamp((p.y-bottom)/max(lid-bottom,.01),0.,1.);
  vec3 ember=mix(vec3(1.,.55,.12),vec3(.35,.08,.02),mix(heat,.35,shut));
  colour=mix(colour,vec3(.05,.02,.01),lit);
  glow+=mix(ember*slit*1.8,vec3(1.,.5,.1)*arcGlow*1.5,shut);
}
void face(inout vec3 colour,inout vec3 glow){
  vec2 p=vFace;
  // Hood: the dark crimson glass shows above the brows and in a peak
  // that runs down between the eyes to the nose.
  float hoodLine=.44-.46*exp(-pow(p.x/.17,2.));
  float hood=smoothstep(-.015,.015,p.y-hoodLine);
  vec2 scale=vec2(p.x*9.,p.y*9.);vec2 cell=fract(scale)-.5;
  float scales=smoothstep(.42,.5,length(cell+vec2(0.,.25)));
  colour=mix(colour,vec3(.085,.02,.014)*(.85+.22*scales),hood);
  // Eyes.
  eye(p,-1.,faceEyes.x*(1.-faceSlant.w),faceEyes.z,faceSlant.x,colour,glow);
  eye(p,1.,faceEyes.y*(1.-faceSlant.w),faceEyes.w,faceSlant.y,colour,glow);
  // Brows: lit bar, LED segments, brass end caps.
  for(int i=0;i<2;i++){
    float side=i==0?-1.:1.;
    float along;
    float d=browDist(p,side,i==0?faceLift.x:faceLift.y,i==0?faceLift.z:faceLift.w,along);
    float body=aa(d);
    float rim=aa(d+.012);
    float segments=step(.25,fract(along*7.+.5));
    vec3 lit=faceBrow.rgb*(.55+.75*segments);
    colour=mix(colour,vec3(.55,.36,.12),body);
    colour=mix(colour,lit*.6,rim*smoothstep(.06,.12,along)*smoothstep(.06,.12,1.-along));
    glow+=lit*faceBrow.a*rim*smoothstep(.06,.12,along)*smoothstep(.06,.12,1.-along);
  }
  // Mouth: the seam of the jaw, smiling, or opening into a glowing laugh.
  float open=clamp(faceMouth.x+faceMouth.w,0.,1.2);
  float w=.42+.04*open;
  vec2 m=p-vec2(faceMouth.z*.05,-.46);
  m.y-=faceMouth.z*.09*m.x/w;
  float x=m.x/w;
  float bow=-faceMouth.y*.075*(1.-x*x)+faceMouth.y*.02;
  float upper=bow+.012;
  float lower=bow-open*.26*pow(max(0.,1.-x*x),.7)-.012;
  float inside=max(max(abs(x)-1.,m.y-upper),lower-m.y);
  float mouth=aa(inside*w*.8);
  float depth=clamp((upper-m.y)/max(upper-lower,.02),0.,1.);
  vec3 throat=mix(vec3(1.,.5,.12),vec3(.45,.1,.02),depth);
  colour=mix(colour,mix(vec3(.08,.03,.02),throat*.4,smoothstep(.02,.08,open)),mouth);
  glow+=throat*mouth*smoothstep(.03,.2,open)*1.3;
}
`;

export function installNaveganteFace(mesh){
  const material=[mesh.material].flat()[0];
  if(!material||!/^Navegante face/.test(material.name))return null;
  mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox,size=box.getSize(new Vector3()),mid=box.getCenter(new Vector3());
  // The plate is a shallow dome: its thinnest extent is its depth. The other
  // vertical axis is whichever of y/z remains (exporters may keep Z up).
  const depthAxis=size.x<size.y&&size.x<size.z?0:size.y<size.z?1:2;
  const vertical=depthAxis===1?new Vector3(0,0,1):new Vector3(0,1,0);
  const radius=Math.max(size.x,depthAxis===1?size.z:size.y)/2;
  const uniforms={
    faceCentre:{value:new Vector2(mid.x,mid.dot(vertical))},faceRadius:{value:radius},faceVertical:{value:vertical},
    faceBrow:{value:new Vector4()},faceLift:{value:new Vector4()},faceEyes:{value:new Vector4()},
    faceSlant:{value:new Vector4()},faceMouth:{value:new Vector4()},
  };
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform vec2 faceCentre;\nuniform float faceRadius;\nuniform vec3 faceVertical;\nvarying vec2 vFace;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvFace=(vec2(position.x,dot(position,faceVertical))-faceCentre)/faceRadius;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\n'+FACE_GLSL)
      .replace('#include <map_fragment>','#include <map_fragment>\nvec3 faceGlow=vec3(0.);face(diffuseColor.rgb,faceGlow);')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=faceGlow*faceSlant.z;');
  };
  material.customProgramCacheKey=()=> 'navegante-face-v1';
  material.needsUpdate=true;
  return new NaveganteFace(uniforms);
}

const lerp=(a,b,t)=>a+(b-a)*t;

export class NaveganteFace{
  constructor(uniforms){
    this.uniforms=uniforms;
    this.name='calm';
    this.current=flatten(EXPRESSIONS.calm);
    this.target=this.current.slice();
    this.blink=0;this.nextBlink=2;this.clock=0;this.speech=0;
    this.colour=new Color();
    this.write();
  }
  set(name){
    if(!EXPRESSIONS[name]||name===this.name)return;
    this.name=name;
    this.target=flatten(EXPRESSIONS[name]);
  }
  // seconds: frame step; speech: 0..1 voice level; motion=false snaps.
  update(seconds,{speech=0,motion=true}={}){
    const step=Math.min(.1,Math.max(0,seconds));
    const t=motion?1-Math.exp(-step*9):1;
    for(let i=0;i<this.current.length;i++)this.current[i]=lerp(this.current[i],this.target[i],t);
    this.speech=lerp(this.speech,speech,motion?1-Math.exp(-step*(speech>this.speech?30:14)):1);
    this.clock+=step;
    // Blinks only matter when the eyes are open slits.
    if(motion&&this.clock>this.nextBlink){
      const age=this.clock-this.nextBlink;
      this.blink=age<.07?age/.07:age<.16?1-(age-.07)/.09:0;
      if(age>=.16)this.nextBlink=this.clock+2.2+3.4*((Math.sin(this.clock*12.9898)*43758.5453)%1+1)%1;
    }else if(!motion)this.blink=0;
    this.write();
  }
  write(){
    const c=this.current,u=this.uniforms;
    this.colour.setRGB(c[0],c[1],c[2]);
    u.faceBrow.value.set(c[0],c[1],c[2],1.5);
    u.faceLift.value.set(c[3],c[4],c[5],c[6]);
    u.faceEyes.value.set(c[7],c[8],c[9],c[10]);
    u.faceSlant.value.set(c[11],c[12],1,this.blink);
    u.faceMouth.value.set(c[13],c[14],c[15],this.speech*.8);
  }
}

function flatten(e){
  const c=new Color(e.brow[0]);
  return [c.r,c.g,c.b,...e.lift,...e.tilt,...e.open,...e.curve,...e.slant,e.mouth.open,e.mouth.smile,e.mouth.skew];
}
