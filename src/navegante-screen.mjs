import {installNaveganteFace} from './navegante-face.mjs';
import {AdditiveBlending,Color,MeshBasicMaterial,Vector2,Vector3,Vector4} from 'three';

// Navegante's visor is an LED screen. Every expression and the speaking
// mouth are drawn on it as lit pixels: eyes, brows and mouth, each with its
// own colour and a pattern that carries the mood (sparkles of joy, a falling
// tear, a focus scan line, a flicker of anger, dots of doubt, drifting Zs).
// The nine expressions follow CompAII's navigator expression sheet; the look
// follows the N-3X production sheet (cyan pixels on black glass).

// eye: [width, height, closed (0 ovals .. 1 arcs), arc (+ happy, - sad), slant (+ angry), asym (+ left bigger)]
// gaze: [x, y]; brow: [amount, left lift, right lift, tilt (+ worried, - cross)]
// mouth: [smile, open, width, round, wave]; fx: [sparkle, tear, scan, zz, dots, flicker]
export const EXPRESSIONS=Object.freeze({
  calm:     {colour:0x33f2ff,bright:1,  eye:[.20,.27,0,0,0,0],     gaze:[0,0],     brow:[0,0,0,0],       mouth:[.55,0,.30,0,0],  fx:[0,0,0,0,0,0]},
  curious:  {colour:0xffc23a,bright:1,  eye:[.21,.29,0,0,0,.35],   gaze:[.28,.10], brow:[1,.9,-.1,0],    mouth:[.15,.30,.16,.8,0],fx:[0,0,0,0,.7,0]},
  joy:      {colour:0x55ff8c,bright:1.1,eye:[.22,.27,1,1,0,0],     gaze:[0,0],     brow:[0,0,0,0],       mouth:[1,.95,.50,0,0],  fx:[1,0,0,0,0,0]},
  sad:      {colour:0x4c86ff,bright:.85,eye:[.20,.24,.65,-1,-.5,0],gaze:[0,-.12],  brow:[1,-.1,-.1,.9],  mouth:[-.65,0,.26,0,0], fx:[0,1,0,0,0,0]},
  anger:    {colour:0xff3020,bright:1.1,eye:[.22,.20,0,0,.95,0],   gaze:[0,0],     brow:[1,-.4,-.4,-1],  mouth:[-.35,.22,.38,0,0],fx:[0,0,0,0,0,1]},
  uncertain:{colour:0xb070ff,bright:.95,eye:[.19,.25,0,0,0,-.3],   gaze:[-.32,.05],brow:[1,.7,-.45,.2],  mouth:[-.1,.06,.30,0,1],fx:[0,0,0,0,1,0]},
  focus:    {colour:0x8cfff4,bright:1,  eye:[.24,.13,0,0,.3,0],    gaze:[0,0],     brow:[.8,-.25,-.25,-.25],mouth:[0,0,.20,0,0],fx:[0,0,1,0,0,0]},
  welcome:  {colour:0xffcc55,bright:1.05,eye:[.21,.27,1,1,0,0],  gaze:[0,.05],   brow:[.7,.5,.5,.2],   mouth:[1,.6,.46,0,0],   fx:[.55,0,0,0,0,0]},
  sleep:    {colour:0x5868f0,bright:.5, eye:[.21,.24,1,-.35,0,0],  gaze:[0,-.05],  brow:[0,0,0,0],       mouth:[.15,0,.18,0,0],  fx:[0,0,0,1,0,0]},
});
export const EXPRESSION_NAMES=Object.freeze(Object.keys(EXPRESSIONS));
const SIZE=29;
function flatten(e){
  const c=new Color(e.colour);
  return [c.r,c.g,c.b,e.bright,...e.eye,...e.gaze,...e.brow,...e.mouth,...e.fx];
}

// Mouth shapes for speech. The conversation surface sends only a playback
// level, so each rise of the voice is read as a syllable and given the next
// vowel shape of a varied, repeatable sequence; falls close toward m/b/p.
export const VISEMES=Object.freeze({
  a:{open:1,wide:.15,round:0},e:{open:.55,wide:.85,round:0},i:{open:.32,wide:1,round:0},
  o:{open:.8,wide:0,round:.85},u:{open:.45,wide:0,round:1},
});
const SEQUENCE='aeoaiuaeoeaioaue';
export class SpeechArticulator{
  constructor(){this.reset();}
  reset(){
    Object.assign(this,{envelope:0,peak:.2,floor:0,armed:true,syllable:0,shape:VISEMES.a,
      open:0,wide:0,round:0,talking:0});
  }
  // level 0..1 at frame rate; returns {open, wide, round, talking}.
  update(level,step){
    const dt=Math.min(.1,Math.max(0,step));
    this.envelope+=(level-this.envelope)*(1-Math.exp(-dt*(level>this.envelope?40:18)));
    this.peak=Math.max(this.envelope,this.peak-dt*.15,.08);
    this.floor=Math.min(this.envelope,this.floor+dt*.05);
    const span=Math.max(.04,this.peak-this.floor),norm=Math.min(1,Math.max(0,(this.envelope-this.floor)/span));
    if(this.armed&&norm>.55&&this.envelope>.03){
      this.armed=false;this.syllable++;
      this.shape=VISEMES[SEQUENCE[(this.syllable*7)%SEQUENCE.length]];
    }else if(norm<.3)this.armed=true;
    const voiced=this.envelope>.025?1:0;
    this.talking+=(voiced-this.talking)*(1-Math.exp(-dt*(voiced?12:3)));
    const amount=voiced*Math.pow(norm,.8);
    const follow=1-Math.exp(-dt*28);
    this.open+=(this.shape.open*amount-this.open)*follow;
    this.wide+=(this.shape.wide*(.4+.6*amount)*voiced-this.wide)*follow;
    this.round+=(this.shape.round*(.4+.6*amount)*voiced-this.round)*follow;
    return this;
  }
}

const SCREEN_GLSL=`
uniform vec4 sCol;     // rgb, brightness
uniform vec4 sEye0;    // width, height, closed, arc
uniform vec4 sEye1;    // slant, asym, gaze x, gaze y
uniform vec4 sBrow;    // amount, lift L, lift R, tilt
uniform vec4 sMouth;   // smile, open, width, round
uniform vec4 sMouth2;  // wave, speech open, speech wide, speech round
uniform vec4 sFx0;     // sparkle, tear, scan, zz
uniform vec4 sFx1;     // dots, flicker, time, blink
uniform float sTalk;
uniform vec2 sShape;  // visor aspect, eye height scale
varying vec2 vScreen;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float band(float d,float w){return smoothstep(w,w*.45,abs(d));}
float eyeLit(vec2 c,float side){
  float asym=1.+sEye1.y*side*-1.;
  float w=sEye0.x*asym,h=sEye0.y*asym*sShape.y;
  vec2 q=c-vec2(side*.52+sEye1.z*.16,.16+sEye1.w*.14);
  float x=q.x/w;
  float closed=clamp(sEye0.z+sFx1.w,0.,1.);
  // Open: a filled oval, cut by a slanted lid.
  float oval=smoothstep(1.06,.9,length(q/vec2(w,h)));
  float inner=-side*x;
  float lid=h*(1.05-sEye1.x*(.55+.65*inner));
  oval*=smoothstep(.02,-.04,q.y-lid);
  // Closed: an arc, up (^) when happy, down when sad.
  float arcY=sEye0.w*h*.55*(.55-x*x)-(sEye0.w<0.?.0:.08)*h;
  float arc=band(q.y-arcY,.075)*step(abs(x),1.05);
  return mix(oval,arc,closed);
}
float browLit(vec2 c,float side,float lift){
  vec2 q=c-vec2(side*.52+sEye1.z*.12,.16+sEye0.y+.2+lift*.1);
  float inner=-side*q.x/.22;
  float y=q.y-sBrow.w*.09*inner;
  return sBrow.x*band(y,.055)*step(abs(q.x),.24);
}
float mouthLit(vec2 c){
  float talk=sTalk;
  float open=max(sMouth.y*(1.-.85*talk),sMouth2.y*1.1);
  float round=mix(sMouth.w,sMouth2.w,talk),wide=sMouth2.z*talk;
  float w=sMouth.z*(1.+.45*wide)*(1.-.3*round)+.06*open;
  float smile=sMouth.x*(1.-.55*talk);
  vec2 m=c-vec2(0.,-.5);
  float x=m.x/w;
  if(abs(x)>1.08)return 0.;
  float yc=-smile*.16*(1.-x*x)+smile*.05+sMouth2.x*.05*sin(x*9.+sFx1.z*4.);
  float s=sqrt(max(0.,1.-x*x));
  float up=yc+open*(.05+.11*round)*s,down=yc-open*(.30-.08*round)*s*(1.-.35*wide);
  float outline=max(band(m.y-up,.06),band(m.y-down,.06))*step(abs(x),1.);
  float inside=step(down,m.y)*step(m.y,up)*step(abs(x),1.)*mix(.4,.12,round);
  float line=band(m.y-yc,.06)*step(abs(x),1.);
  return max(mix(line,outline,smoothstep(.04,.14,open)),inside);
}
float star(vec2 q,float r){q=abs(q);return smoothstep(r,0.,q.x+q.y*4.)+smoothstep(r,0.,q.y+q.x*4.);}
float zGlyph(vec2 q,float s){
  q/=s;if(abs(q.x)>.5||abs(q.y)>.5)return 0.;
  return max(max(band(q.y-.45,.14),band(q.y+.45,.14)),band(q.y-q.x,.16));
}
vec4 screen(bool mosaic){
  // glTF flips V; the screen is authored with +y up.
  vec2 p=vec2(vScreen.x*2.-1.,1.-vScreen.y*2.)*vec2(sShape.x,1.);
  float t=sFx1.z;
  float density=17.;
  vec2 cell=(floor(p*density)+.5)/density;
  vec2 f=fract(p*density)-.5;
  float dot=smoothstep(.46,.30,length(f));
  float lit=mouthLit(cell);
  lit=max(lit,max(eyeLit(cell,-1.),eyeLit(cell,1.))*(mosaic?.83:1.));
  lit=max(lit,max(browLit(cell,-1.,sBrow.y),browLit(cell,1.,sBrow.z)));
  // Sparkles around the eyes, twinkling.
  for(int i=0;i<4;i++){
    float fi=float(i);
    vec2 at=vec2((fi<2.?-1.:1.)*(.95+.12*mod(fi,2.)),.55-.3*mod(fi,2.));
    float tw=.5+.5*sin(t*5.+fi*1.9);
    lit=max(lit,sFx0.x*tw*star(cell-at,.16));
  }
  // A tear falling from the left eye.
  float fall=fract(t*.45);
  lit=max(lit,sFx0.y*(1.-fall)*smoothstep(.09,.03,length((cell-vec2(-.62,-.08-fall*.75))*vec2(1.,.7))));
  // A focus scan line sweeping down the visor.
  float sweep=.9-fract(t*.5)*1.9;
  lit=max(lit,sFx0.z*.45*band(cell.y-sweep,.06));
  // Drifting Zs of sleep.
  for(int i=0;i<2;i++){
    float k=fract(t*.18+float(i)*.5);
    lit=max(lit,sFx0.w*(1.-k)*zGlyph(cell-vec2(.35+k*.45,.05+k*.6),.16+.12*k));
  }
  // Dots of doubt, appearing one after another.
  for(int i=0;i<3;i++){
    float on=step(float(i),mod(t*2.5,4.));
    lit=max(lit,sFx1.x*on*smoothstep(.07,.03,length(cell-vec2(.78+float(i)*.17,.62))));
  }
  // Anger flickers row by row and runs hot toward the top.
  float row=floor(p.y*density);
  float flick=mix(1.,.6+.4*step(.35,hash(vec2(row,floor(t*14.)))),sFx1.y);
  vec3 colour=sCol.rgb;
  colour=mix(colour,vec3(1.,.75,.25),sFx1.y*smoothstep(-.2,.9,cell.y)*.5);
  float breathe=1.-.25*step(.5,sFx0.w)*(.5+.5*sin(t*1.3));
  float glow=lit*flick*sCol.a*breathe;
  // Unlit pixels show faintly, like a real panel.
  vec3 led=colour*(glow*1.7+(mosaic?0.:.014))*dot;
  return vec4(led,1.);
}`;

export function installNaveganteDisplay(root){
  const head=root.getObjectByName('Nav4_Head');
  const eyeMats=['Nav4_EyeL','Nav4_EyeR'].map(name=>root.getObjectByName(name)?.material);
  if(head?.material?.name==='Nav4_CeramicMosaic'&&eyeMats.every(material=>material?.name==='Nav4_CyanEyes'))
    return installMosaicDisplay(head,[...new Set(eyeMats)]);
  let display=null;
  root.traverse(object=>{
    if(object.isMesh&&!display)display=installNaveganteScreen(object)??installNaveganteFace(object);
  });
  return display;
}

function displayUniforms(){
  return {sCol:{value:new Vector4()},sEye0:{value:new Vector4()},sEye1:{value:new Vector4()},
    sBrow:{value:new Vector4()},sMouth:{value:new Vector4()},sMouth2:{value:new Vector4()},
    sFx0:{value:new Vector4()},sFx1:{value:new Vector4()},sTalk:{value:0},sShape:{value:new Vector2(1.485,1)}};
}

function installMosaicDisplay(head,eyes){
  const material=head.material.clone(),uniforms=displayUniforms();
  // The glTF's +Z face, physical eye centers at x=±.08 and y=1 m.
  // Keep the authored ceramic and slit eyes visible and add light only to
  // the front of the mosaic. The eyes themselves carry the mood colour.
  uniforms.sShape.value.set(1.485,1);
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 vScreen; varying float faceDepth;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvScreen=vec2(.5+position.x/.457,.5-(position.y-.983)/.212); faceDepth=position.z;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float faceDepth;\n'+SCREEN_GLSL)
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=screen(true).rgb*smoothstep(.035,.09,faceDepth);');
  };
  material.customProgramCacheKey=()=> 'navegante-mosaic-screen-v1';
  material.userData.keepShaderInHologram=true;
  head.material=material;
  const display=new NaveganteScreen(uniforms,material,{calm:eyes[0].emissive.getHex()});
  const update=display.update.bind(display),brightness=eyes.map(eye=>eye.emissiveIntensity);
  display.mosaic=true;
  display.update=(seconds,options)=>{
    update(seconds,options);
    const [r,g,b,bright]=display.current;
    eyes.forEach((eye,i)=>{
      eye.emissive.setRGB(r,g,b);
      eye.emissiveIntensity=brightness[i]*bright*(1-.88*display.blink)*(1-.85*display.current[6]);
    });
  };
  return display;
}

export function installNaveganteScreen(mesh){
  const material=[mesh.material].flat()[0];
  if(!material||!/^Visor LED screen/.test(material.name))return null;
  const uniforms=displayUniforms();
  // The visor's own proportion; a "slits" screen (the bronze navigator) rests
  // with narrow blue eyes.
  const slits=/slits/.test(material.name);
  if(slits){
    mesh.geometry.computeBoundingBox();
    const size=mesh.geometry.boundingBox.getSize(new Vector3());
    const height=Math.max(size.y,size.z);
    if(size.x>0&&height>0)uniforms.sShape.value.x=size.x/height;
    uniforms.sShape.value.y=.38;
  }
  const screen=new MeshBasicMaterial({name:material.name,transparent:true,depthWrite:false,blending:AdditiveBlending,toneMapped:false});
  screen.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 vScreen;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvScreen=uv;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\n'+SCREEN_GLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = screen(false);');
  };
  screen.customProgramCacheKey=()=> 'navegante-led-screen-v1';
  screen.userData.keepInHologram=true;
  mesh.material=screen;
  mesh.renderOrder=2;
  material.dispose();
  return new NaveganteScreen(uniforms,screen,{calm:slits?0x3d7bff:null});
}

const lerp=(a,b,t)=>a+(b-a)*t;
export class NaveganteScreen{
  constructor(uniforms,material,{calm=null}={}){
    Object.assign(this,{uniforms,material});
    this.name='calm';
    this.calmColour=calm;
    this.current=this.expression('calm');
    this.target=this.current.slice();
    this.speech=new SpeechArticulator();
    this.clock=0;this.blink=0;this.nextBlink=2.4;
    this.write();
  }
  set(name){
    if(!EXPRESSIONS[name]||name===this.name)return;
    this.name=name;this.target=this.expression(name);
  }
  expression(name){
    const e=EXPRESSIONS[name];
    return flatten(name==='calm'&&this.calmColour!=null?{...e,colour:this.calmColour}:e);
  }
  update(seconds,{speech=0,motion=true}={}){
    const step=Math.min(.1,Math.max(0,seconds));
    const t=motion?1-Math.exp(-step*8):1;
    for(let i=0;i<SIZE;i++)this.current[i]=lerp(this.current[i],this.target[i],t);
    if(motion)this.speech.update(speech,step);else this.speech.reset();
    this.clock+=motion?step:0;
    if(motion&&this.clock>this.nextBlink){
      const age=this.clock-this.nextBlink;
      this.blink=age<.06?age/.06:age<.15?1-(age-.06)/.09:0;
      if(age>=.15){const r=Math.sin(this.clock*12.9898)*43758.5453;this.nextBlink=this.clock+2.4+3.2*(r-Math.floor(r));}
    }else if(!motion)this.blink=0;
    this.write();
  }
  write(){
    const c=this.current,u=this.uniforms,s=this.speech;
    u.sCol.value.set(c[0],c[1],c[2],c[3]);
    u.sEye0.value.set(c[4],c[5],c[6],c[7]);
    u.sEye1.value.set(c[8],c[9],c[10],c[11]);
    u.sBrow.value.set(c[12],c[13],c[14],c[15]);
    u.sMouth.value.set(c[16],c[17],c[18],c[19]);
    u.sMouth2.value.set(c[20],s.open,s.wide,s.round);
    u.sFx0.value.set(c[21],c[22],c[23],c[24]);
    u.sFx1.value.set(c[25],c[26],this.clock,this.blink);
    u.sTalk.value=s.talking;
  }
}
