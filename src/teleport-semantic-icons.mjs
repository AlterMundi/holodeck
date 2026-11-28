import {Color,Euler,Matrix4,Quaternion,SRGBColorSpace,Vector3} from 'three';

// Icons for destinations that are a function rather than a model: worktables,
// projects, topics and public places. The icon is composed from what the
// destination is for (its main A2UI widget or role) and what it is about (its
// title), in the same porcelain, gold and accent language as the station.
// A new title or widget gives a new descriptor and therefore a new icon.

// Display (sRGB) colours, converted to three's linear working space.
const srgb=(r,g,b)=>new Color().setRGB(r,g,b,SRGBColorSpace);
const PORCELAIN=srgb(.93,.9,.84),GOLD=srgb(.82,.6,.24),GRAPHITE=srgb(.2,.21,.23),
  GLOW=srgb(.3,.95,1),AMBER=srgb(1,.62,.25),LEAF=srgb(.27,.5,.2),TEAL=srgb(.06,.4,.42);

const fold=text=>String(text??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

// Role vocabulary: [role, words found in an id, widget or title].
const ROLES=[
  ['conversation',['conversa','chat','charla','mensaje','telegram','voz del','general']],
  ['voice',['voz','voces','audio','micro','transcrip','podcast','sonido']],
  ['music',['guitar','music','musica','harmonic','beacon','weaver','shaper','spatializer','sinte','acorde','chord','tdma','consonan']],
  ['print',['impresion','print','fabric','cnc','prusa','bambu']],
  ['archive',['archivo','archive','registro','record','bitacora','log','historial','history','memoria','dmk','memory']],
  ['research',['research','investig','paper','libro','book','estudio','study','wiki','lectura','idea','semilla']],
  ['viewer',['visor','viewer','3d','modelo','materia','matter','turntable','galeria de modelo','review']],
  ['code',['code','codigo','repo','git','matrix','telecodex','gateway','harness','sdk','api','codex']],
  ['video',['video','camara','camera','cine','film','visorx','proyeccion']],
  ['network',['vpn','red ','network','zerotier','cluster','sysops','infra','alerts','heartbeat','portab']],
  ['character',['character','personaje','avatar','char design','pose','studio','taller de personajes']],
  ['map',['orientation','orient','mapa','map','mirador','overlook','field','nexus','mundo','holodeck']],
  ['design',['diseno','design','ui','interfaz','ascii','dibujo','arte']],
  ['tools',['prototype','prototipo','workbench','taller','herramient','tool','workshop','mesa de trabajo','worktable']],
  ['output',['output','salida','resultado','publica','galeria','gallery','exhib']],
  ['home',['casa','home','house','hogar','residencia']],
  ['plaza',['plaza','arrival','llegada']],
];

export function semanticRole({role,widget,id,title}){
  if(role&&MOTIFS[role])return role;
  const text=' '+fold([widget,id,title].filter(Boolean).join(' '))+' ';
  for(const [name,words] of ROLES)if(words.some(word=>text.includes(word)))return name;
  return id?.startsWith('object:')?'tools':'topic';
}

const hash=text=>{
  let h=2166136261;
  for(const char of fold(text)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
};

export function semanticDescriptor(input){
  const title=String(input.title??'').trim().slice(0,120);
  return {role:semanticRole(input),title,...(input.widget?{widget:String(input.widget).slice(0,60)}:{})};
}

// ------------------------------------------------------------ mesh builder
class Builder{
  constructor(){this.positions=[];this.colors=[];this.indices=[];this.m=new Matrix4();}
  add(vertices,faces,colour,{p=[0,0,0],r=[0,0,0],s=[1,1,1]}={}){
    this.m.compose(new Vector3(...p),new Quaternion().setFromEuler(new Euler(...r)),new Vector3(...s));
    const base=this.positions.length/3,v=new Vector3();
    for(const vertex of vertices){
      v.fromArray(vertex).applyMatrix4(this.m);
      this.positions.push(v.x,v.y,v.z);this.colors.push(colour.r,colour.g,colour.b);
    }
    for(const f of faces)this.indices.push(base+f[0],base+f[1],base+f[2]);
    return this;
  }
  box(c,o){
    const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
    // duplicate per face so flat shading stays crisp
    const quads=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]],verts=[],faces=[];
    for(const q of quads){const b=verts.length;for(const i of q)verts.push(v[i]);faces.push([b,b+1,b+2],[b,b+2,b+3]);}
    return this.add(verts,faces,c,o);
  }
  cylinder(c,o,n=8,top=1){
    const verts=[],faces=[];
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2;verts.push([Math.cos(a)*.5,-.5,Math.sin(a)*.5],[Math.cos(a)*.5*top,.5,Math.sin(a)*.5*top]);}
    const bc=verts.length;verts.push([0,-.5,0],[0,.5,0]);
    for(let i=0;i<n;i++){const j=(i+1)%n,a=i*2,b=j*2;faces.push([a,b,b+1],[a,b+1,a+1],[bc,b,a],[bc+1,a+1,b+1]);}
    return this.add(verts,faces,c,o);
  }
  cone(c,o,n=8){return this.cylinder(c,o,n,0);}
  ball(c,o,n=8){
    const verts=[],faces=[],rings=Math.max(3,n>>1);
    for(let y=0;y<=rings;y++){const t=y/rings*Math.PI;for(let x=0;x<n;x++){const a=x/n*Math.PI*2;verts.push([Math.cos(a)*Math.sin(t)*.5,Math.cos(t)*.5,Math.sin(a)*Math.sin(t)*.5]);}}
    for(let y=0;y<rings;y++)for(let x=0;x<n;x++){const a=y*n+x,b=y*n+(x+1)%n,c2=a+n,d=b+n;faces.push([a,c2,b],[b,c2,d]);}
    return this.add(verts,faces,c,o);
  }
  ring(c,o,n=12,thickness=.12){
    const verts=[],faces=[];
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2;for(const [r,y] of [[.5,-thickness],[.5,thickness],[.5-thickness*2,thickness],[.5-thickness*2,-thickness]])verts.push([Math.cos(a)*r,y,Math.sin(a)*r]);}
    for(let i=0;i<n;i++){const j=(i+1)%n;for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c2=j*4+k,d=j*4+(k+1)%4;faces.push([a,c2,b],[b,c2,d]);}}
    return this.add(verts,faces,c,o);
  }
  mesh(){return {positions:new Float32Array(this.positions),colors:new Float32Array(this.colors),indices:this.indices};}
}

// Small plinth shared by every semantic icon: porcelain disc with a gold band.
function plinth(b){
  b.cylinder(PORCELAIN,{p:[0,.04,0],s:[1,.08,1]},10).cylinder(GOLD,{p:[0,.085,0],s:[1.02,.015,1.02]},10);
  return .095;
}

const EMBLEMS=['star','ring','diamond','crescent','triangle','cross'];
function emblem(b,shape,c,y,size=.32){
  const p=[0,y,0];
  if(shape==='ring')b.ring(c,{p,r:[Math.PI/2,0,0],s:[size,size,size]},12,.1);
  else if(shape==='diamond')b.ball(c,{p,s:[size*.55,size*.9,size*.25]},4);
  else if(shape==='crescent'){b.ring(c,{p,r:[Math.PI/2,0,0],s:[size,size,size]},12,.14);b.ball(GRAPHITE,{p:[size*.18,y+size*.1,.01],s:[size*.62,size*.62,.12]},8);}
  else if(shape==='triangle')b.cone(c,{p,r:[Math.PI/2,0,0],s:[size*.8,.08,size*.8]},3);
  else if(shape==='cross'){b.box(c,{p,s:[size*.8,size*.22,.08]});b.box(c,{p,s:[size*.22,size*.8,.08]});}
  else for(let i=0;i<5;i++)b.cone(c,{p:[Math.sin(i*1.2566)*size*.22,y+Math.cos(i*1.2566)*size*.22,0],r:[0,0,-i*1.2566],s:[size*.22,size*.5,.08]},3);
}

const MOTIFS={
  plaza(b,y){b.cylinder(srgb(.72,.66,.55),{p:[0,y+.01,0],s:[.95,.02,.95]},10);
    b.cylinder(PORCELAIN,{p:[0,y+.2,0],s:[.12,.36,.12]},4,.5).cone(GOLD,{p:[0,y+.41,0],s:[.07,.06,.07]},4);
    for(const x of [-.3,.3])b.cylinder(GRAPHITE,{p:[x,y+.07,.12],s:[.03,.12,.03]},5).ball(LEAF,{p:[x,y+.18,.12],s:[.2,.2,.2]},6);},
  home(b,y,a){b.box(a,{p:[0,y+.15,0],s:[.55,.3,.4]}).cone(TEAL,{p:[0,y+.38,0],r:[0,Math.PI/4,0],s:[.62,.18,.62]},4).box(AMBER,{p:[0,y+.1,.205],s:[.12,.2,.01]});},
  conversation(b,y,a){b.box(a,{p:[-.08,y+.3,0],s:[.5,.28,.12]}).cone(a,{p:[-.22,y+.13,0],r:[0,0,Math.PI],s:[.1,.1,.1]},3)
    .box(PORCELAIN,{p:[.14,y+.5,-.05],s:[.42,.22,.1]}).cone(PORCELAIN,{p:[.26,y+.36,-.05],r:[0,0,Math.PI],s:[.08,.08,.08]},3);
    for(const x of [-.2,-.08,.04])b.ball(GLOW,{p:[x,y+.3,.07],s:[.05,.05,.03]},6);},
  voice(b,y,a){b.cylinder(GRAPHITE,{p:[0,y+.12,0],s:[.05,.24,.05]},6).ball(a,{p:[0,y+.36,0],s:[.22,.3,.22]},8).ring(GOLD,{p:[0,y+.32,0],s:[.3,.3,.3]},10,.08);},
  music(b,y,a){b.ball(a,{p:[0,y+.17,0],s:[.38,.32,.12]},8).ball(a,{p:[0,y+.36,0],s:[.28,.24,.12]},8)
    .box(GRAPHITE,{p:[0,y+.58,0],s:[.06,.36,.05]}).box(GOLD,{p:[0,y+.78,0],s:[.1,.08,.06]}).cylinder(GRAPHITE,{p:[0,y+.26,.06],r:[Math.PI/2,0,0],s:[.1,.02,.1]},8);},
  viewer(b,y,a){b.cylinder(GOLD,{p:[0,y+.03,0],s:[.7,.05,.7]},10).box(a,{p:[0,y+.25,0],r:[.5,.6,.2],s:[.26,.26,.26]})
    .ring(GLOW,{p:[0,y+.25,0],r:[.3,0,.2],s:[.55,.55,.55]},12,.05);},
  print(b,y,a){for(const [x,z] of [[-.25,-.2],[.25,-.2],[-.25,.2],[.25,.2]])b.box(GRAPHITE,{p:[x,y+.27,z],s:[.04,.54,.04]});
    b.box(GRAPHITE,{p:[0,y+.53,0],s:[.56,.04,.44]}).box(a,{p:[0,y+.1,0],s:[.18,.18,.18]}).cone(GOLD,{p:[0,y+.42,0],r:[Math.PI,0,0],s:[.08,.1,.08]},6);},
  archive(b,y,a){for(let i=0;i<3;i++)b.box(i%2?PORCELAIN:a,{p:[0,y+.1+i*.19,0],s:[.5,.17,.38]}).box(GOLD,{p:[0,y+.1+i*.19,.195],s:[.14,.03,.01]});},
  research(b,y,a){b.box(a,{p:[-.13,y+.06,0],r:[0,0,.18],s:[.28,.04,.4]}).box(a,{p:[.13,y+.06,0],r:[0,0,-.18],s:[.28,.04,.4]})
    .box(PORCELAIN,{p:[-.12,y+.09,0],r:[0,0,.18],s:[.25,.02,.36]}).box(PORCELAIN,{p:[.12,y+.09,0],r:[0,0,-.18],s:[.25,.02,.36]})
    .ball(GLOW,{p:[0,y+.35,0],s:[.14,.14,.14]},8);},
  code(b,y,a){for(const s of [-1,1]){b.box(a,{p:[s*.2,y+.36,0],r:[0,0,s*.6],s:[.06,.26,.06]}).box(a,{p:[s*.2,y+.17,0],r:[0,0,-s*.6],s:[.06,.26,.06]});}
    b.box(GOLD,{p:[0,y+.27,0],r:[0,0,-.35],s:[.05,.42,.05]});},
  video(b,y,a){b.box(a,{p:[-.04,y+.24,0],s:[.42,.28,.28]}).cylinder(GRAPHITE,{p:[.24,y+.24,0],r:[0,0,Math.PI/2],s:[.18,.16,.18]},8)
    .ring(GOLD,{p:[.33,y+.24,0],r:[0,0,Math.PI/2],s:[.2,.2,.2]},10,.06).cylinder(a,{p:[-.12,y+.46,0],r:[Math.PI/2,0,0],s:[.16,.1,.16]},8);},
  network(b,y,a){b.cylinder(GRAPHITE,{p:[0,y+.3,0],s:[.05,.6,.05]},5,.4).ball(GLOW,{p:[0,y+.63,0],s:[.08,.08,.08]},6);
    for(const [r,h] of [[.3,.5],[.5,.38],[.7,.26]])b.ring(a,{p:[0,y+h,0],s:[r,r,r]},12,.04);},
  character(b,y,a){b.cone(a,{p:[0,y+.18,0],s:[.42,.36,.3]},8).ball(PORCELAIN,{p:[0,y+.48,0],s:[.26,.28,.26]},8)
    .box(GRAPHITE,{p:[0,y+.49,.11],s:[.2,.1,.04]}).ball(GLOW,{p:[-.05,y+.5,.135],s:[.03,.03,.02]},4).ball(GLOW,{p:[.05,y+.5,.135],s:[.03,.03,.02]},4);},
  map(b,y,a){b.ball(a,{p:[0,y+.32,0],s:[.42,.42,.42]},8).ring(GOLD,{p:[0,y+.32,0],r:[.4,0,.25],s:[.58,.58,.58]},12,.04).cylinder(GOLD,{p:[0,y+.07,0],s:[.06,.14,.06]},5);},
  design(b,y,a){b.box(PORCELAIN,{p:[0,y+.28,-.04],r:[-.25,0,0],s:[.5,.4,.03]}).cylinder(a,{p:[.1,y+.3,.12],r:[0,0,.7],s:[.05,.42,.05]},6)
    .cone(GOLD,{p:[-.06,y+.15,.12],r:[0,0,.7+Math.PI],s:[.05,.08,.05]},6);},
  tools(b,y,a){b.box(a,{p:[0,y+.12,0],s:[.5,.12,.3]}).box(a,{p:[0,y+.22,0],s:[.32,.1,.22]}).box(GRAPHITE,{p:[.08,y+.42,0],r:[0,0,.5],s:[.05,.34,.05]})
    .box(GOLD,{p:[.15,y+.55,0],r:[0,0,.5],s:[.2,.08,.08]});},
  output(b,y,a){b.box(GOLD,{p:[0,y+.32,0],s:[.5,.44,.05]}).box(a,{p:[0,y+.32,.02],s:[.4,.34,.03]})
    .box(PORCELAIN,{p:[0,y+.12,-.06],r:[-.4,0,0],s:[.06,.25,.04]});},
  project(b,y,a){for(let i=0;i<3;i++)b.box(i===2?a:PORCELAIN,{p:[i*.03-.03,y+.05+i*.09,i*.02],r:[0,i*.12,0],s:[.48,.06,.36]})
    .box(i===2?a:PORCELAIN,{p:[i*.03-.18,y+.09+i*.09,i*.02],s:[.14,.03,.05]});},
  topic(b,y,a,title){b.cylinder(PORCELAIN,{p:[0,y+.2,0],s:[.18,.4,.18]},6,.7).cylinder(GOLD,{p:[0,y+.41,0],s:[.14,.02,.14]},6);
    emblem(b,EMBLEMS[hash(title)%EMBLEMS.length],a,y+.62,.36);},
};

// Accent colour derived from the title, kept in the venue's saturated range.
export function accentFor(title){
  const h=hash(title);
  return new Color().setHSL((h%360)/360,.62,.46,SRGBColorSpace);
}

export function semanticIcon(descriptor){
  const role=MOTIFS[descriptor.role]?descriptor.role:'topic';
  const b=new Builder(),y=plinth(b),accent=accentFor(descriptor.title||role);
  MOTIFS[role](b,y,accent,descriptor.title||role);
  return b.mesh();
}
