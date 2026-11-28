import {BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Shape, SRGBColorSpace,
  SphereGeometry, TorusGeometry} from 'three';
import {addIris,buildInstrument,instrumentAnchors,instrumentMetals,instrumentSlots,studioReflection} from './teleport-instrument.mjs';
import {teleportModelId} from './teleport-hud.mjs';

const color={brass:0xbd8b4c, dark:0x192e31, glass:0x38a99c, stone:0xf3dbb2, roof:0xb65d42, wood:0x744735};
const material=(value,emissive=0)=>new MeshStandardMaterial({color:value,metalness:value===color.brass?.57:.18,
  roughness:value===color.glass?.23:.48,emissive,emissiveIntensity:.65});
const add=(parent,geometry,fill,x=0,y=0,z=0)=>{
  const mesh=new Mesh(geometry,fill);
  mesh.position.set(x,y,z);parent.add(mesh);
  return mesh;
};
const box=(g,m,w,h,d,x,y,z)=>add(g,new BoxGeometry(w,h,d),m,x,y,z);
const cylinder=(g,m,r,h,x=0,y=0,z=0)=>add(g,new CylinderGeometry(r,r,h,24),m,x,y,z);
const torus=(g,m,r,t,x=0,y=0,z=0)=>add(g,new TorusGeometry(r,t,8,40),m,x,y,z);
const controlLabels={favorites:'Favoritos',terrain:'Público',houses:'Casas',house:'Cambiar casa',
  favorite:'Guardar',go:'Viajar'};
const free=(object,shared)=>{
  const geometry=new Set(),materials=new Set();
  object.traverse(child=>{
    if(child.geometry)geometry.add(child.geometry);
    if(child.material&&!shared?.has(child.material))materials.add(child.material);
  });
  for(const item of geometry)item.dispose();
  for(const item of materials){item.map?.dispose();item.dispose();}
};

function engrave(parent,document,label,{width=.219,height=.049,x=0,y=-.101,z=.003}={}){
  if(!document||!label)return;
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(384*width/.76);canvas.height=48;
  const pixels=canvas.width;
  const pen=canvas.getContext('2d');
  if(!pen)return;
  const map=new CanvasTexture(canvas);
  map.colorSpace=SRGBColorSpace;
  const plaque=add(parent,new PlaneGeometry(width,height),new MeshBasicMaterial({map,toneMapped:false}),x,y,z);
  const update=text=>{
    pen.fillStyle='#172b2a';pen.fillRect(0,0,pixels,48);
    pen.strokeStyle='#986740';pen.lineWidth=2;pen.strokeRect(2,2,pixels-4,44);
    pen.fillStyle='#ffe2af';pen.textAlign='center';pen.textBaseline='middle';pen.font='600 30px Georgia, serif';
    pen.fillText(text,pixels/2,25,pixels-16);
    map.needsUpdate=true;
  };
  update(label);
  return {plaque,update};
}

function arch(parent,fill,width,wallHeight,depth,x,y,z){
  const radius=width/2;
  const shape=new Shape();
  shape.moveTo(-radius,0);shape.lineTo(radius,0);shape.lineTo(radius,wallHeight);
  shape.absarc(0,wallHeight,radius,0,Math.PI,false);
  shape.closePath();
  return add(parent,new ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10}),fill,x,y,z);
}

function tree(parent,trunk,leaves,x,y,z,scale=1){
  cylinder(parent,trunk,.005*scale,.067*scale,x,y+.033*scale,z);
  for(const [dx,dy,dz,r] of [[-.011,.066,0,.021],[.011,.084,-.008,.018],[0,.097,.003,.015]]){
    add(parent,new SphereGeometry(r*scale,8,6),leaves,x+dx*scale,y+dy*scale,z+dz*scale);
  }
}

export function makeDestinationModel(kind,finish=color,reflection){
  const model=new Group();
  const stone=material(finish.stone),brass=material(finish.brass),roof=material(finish.roof),
    wood=material(finish.wood),green=material(0x59663c),dark=material(0x3c3027);
  brass.envMap=reflection;brass.envMapIntensity=1.42;brass.metalness=.64;
  const amber=material(0xffbd60,0xc26920),glass=material(finish.glass,0x20766c);
  const plinth=cylinder(model,stone,.162,.055,0,-.022);
  plinth.name='destination-pedestal';
  const foot=add(model,new CylinderGeometry(.158,.139,.028,40),brass,0,-.057,0);
  foot.name='miniature-brass-foot';
  torus(model,brass,.156,.005,0,.006,0).rotation.x=Math.PI/2;
  if(kind==='house'){
    cylinder(model,green,.143,.014,0,.015);
    box(model,stone,.182,.106,.137,-.023,.074,-.026);
    const gable=new Shape();
    gable.moveTo(-.105,0);gable.lineTo(.105,0);gable.lineTo(0,.065);gable.closePath();
    add(model,new ExtrudeGeometry(gable,{depth:.167,bevelEnabled:false}),roof,-.023,.122,-.11);
    for(const sign of [-1,1]){
      const plane=box(model,roof,.131,.013,.177,-.023+sign*.052,.156,-.026);
      plane.rotation.z=sign*-.55;
      for(let i=0;i<6;i++){
        const seam=box(model,dark,.123,.002,.003,-.023+sign*.052,.163,-.100+i*.029);
        seam.rotation.z=sign*-.55;
      }
    }
    box(model,stone,.028,.084,.032,-.070,.178,-.065);
    box(model,dark,.034,.012,.038,-.070,.22,-.065);
    arch(model,wood,.039,.034,.008,-.031,.022,.044);
    arch(model,amber,.028,.029,.004,-.031,.024,.053);
    for(const x of [-.082,.038]){
      box(model,wood,.039,.034,.006,x,.089,.044);
      box(model,amber,.027,.024,.005,x,.089,.049);
    }
    tree(model,wood,green,.102,.022,.029,.93);
    for(let i=0;i<3;i++)box(model,stone,.050-i*.009,.006,.014,-.030+i*.007,.022,.064+i*.021);
  }else if(kind==='table'){
    cylinder(model,stone,.131,.010,0,.012);
    box(model,wood,.229,.036,.129,0,.091,-.012);
    box(model,brass,.237,.006,.138,0,.111,-.012);
    for(const x of [-.096,.096])for(const z of [-.054,.032]){
      box(model,wood,.023,.073,.025,x,.047,z);
      box(model,brass,.025,.012,.027,x,.018,z);
    }
    box(model,wood,.093,.036,.097,-.050,.062,-.014);
    box(model,brass,.034,.004,.007,-.050,.069,.036);
    for(const x of [-.048,-.012,.026])cylinder(model,brass,.012,.023,x,.125,.030);
    cylinder(model,wood,.033,.008,-.067,.119,-.030);
    torus(model,brass,.032,.006,-.067,.162,-.030).rotation.y=-.23;
    add(model,new SphereGeometry(.012,10,8),amber,-.067,.162,-.030);
    cylinder(model,glass,.013,.059,.068,.146,-.037);
    cylinder(model,brass,.019,.008,.068,.177,-.037);
    cylinder(model,brass,.019,.008,.068,.118,-.037);
  }else if(kind==='room'||kind==='residence'){
    const residence=kind==='residence';
    const masonry=material(0xa8967d);
    for(const [z,x] of [[-.082,-.100],[-.082,0],[-.082,.100],[.034,-.100],[.034,0],[.034,.100]]){
      cylinder(model,stone,.014,.118,x,.072,z);
      cylinder(model,masonry,.020,.012,x,.020,z);
      cylinder(model,masonry,.021,.016,x,.132,z);
    }
    const cutout=new Shape();
    cutout.moveTo(-.05,0);cutout.lineTo(.05,0);cutout.lineTo(.05,.050);
    cutout.absarc(0,.05,.05,0,Math.PI,false);
    const opening=new Shape();
    opening.moveTo(-.035,.001);opening.absarc(0,.050,.035,Math.PI,0,true);opening.lineTo(.035,.001);
    opening.closePath();cutout.holes.push(opening);cutout.closePath();
    for(const x of [-.050,.050]){
      add(model,new ExtrudeGeometry(cutout,{depth:.024,bevelEnabled:false,curveSegments:10}),masonry,x,.093,.028);
      arch(model,amber,.047,.052,.006,x,.021,-.076);
    }
    box(model,stone,.237,.023,.148,0,.192,-.020);
    if(residence){
      cylinder(model,stone,.080,.017,0,.210,-.021);
      add(model,new SphereGeometry(.078,20,12,0,Math.PI*2,0,Math.PI/2),roof,0,.221,-.021).scale.y=.77;
      cylinder(model,brass,.007,.021,0,.287,-.021);
    }else{
      box(model,roof,.202,.014,.125,0,.207,-.018);
    }
    for(let i=0;i<3;i++)box(model,masonry,.135+i*.014,.006,.018,0,.022-i*.004,.062+i*.016);
  }else{
    const path=material(0xbda37d);
    cylinder(model,green,.145,.011,0,.009);
    cylinder(model,path,.095,.013,0,.016,.018);
    cylinder(model,stone,.061,.013,0,.028,.018);
    cylinder(model,stone,.045,.015,0,.038,.018);
    add(model,new CylinderGeometry(.018,.032,.137,4),stone,0,.112,.018).rotation.y=Math.PI/4;
    add(model,new ConeGeometry(.025,.034,4),brass,0,.197,.018).rotation.y=Math.PI/4;
    for(let i=0;i<8;i++){
      const a=(i+1)*Math.PI*2/9;
      cylinder(model,stone,.007,.040,Math.cos(a)*.113,.033,Math.sin(a)*.106);
    }
    for(const [x,z,k] of [[-.105,-.049,.9],[.108,-.043,1.1],[.067,-.105,.73]])tree(model,wood,green,x,.014,z,k);
    for(let i=0;i<3;i++)box(model,path,.037,.007,.012,0,.017,.103+i*.014);
  }
  for(const candidate of [stone,brass,roof,wood,green,dark,amber,glass]){
    if(!model.children.some(part=>part.material===candidate))candidate.dispose();
  }
  return model;
}

export class TeleportModels {
  constructor(teleport,{document,finish=color,reduced,now=()=>performance.now()}={}){
    this.teleport=teleport;this.document=document;this.finish=finish;this.reduced=reduced;this.now=now;
    this.models=new Set();
    this.instrument=new Group();
    this.reflection=studioReflection(document);
    this.metals=instrumentMetals(finish,this.reflection);
    this.sharedMaterials=new Set(Object.values(this.metals));
    buildInstrument(this.instrument,this.metals);
    engrave(this.instrument,document,'TELETRANSPORTE',{width:.57,height:.061,y:.013,z:.124});
    this.caption=engrave(this.instrument,document,'',{width:.79,height:.060,y:-1.466,z:.50});
    if(this.caption)this.caption.plaque.visible=false;
  }

  attach(group){
    if(!group)return;
    group.add(this.instrument);
  }

  create({componentId:id}){
    const slot=id.startsWith('slot')?Number(id.slice(4)):null;
    const anchor=slot===null?instrumentAnchors[id]:instrumentSlots[slot];
    if(!anchor)return;
    const object=new Group(), targets=[];
    // A stable rounded pedestal covers the miniature's selectable volume.
    const hit=new Mesh(slot===null?new SphereGeometry(id==='go'?.116:.093,14,10):
      new BoxGeometry(.37,.37,.30),new MeshStandardMaterial({colorWrite:false,depthWrite:false}));
    hit.position.y=slot===null?0:.08;
    object.add(hit);targets.push(hit);
    const lensMaterial=material(this.finish.glass,0x147b69);
    lensMaterial.envMap=this.reflection;
    lensMaterial.roughness=.22;
    const lens=slot===null?cylinder(object,lensMaterial,id==='go'?.084:.065,.028):
      torus(object,lensMaterial,.18,.012,0,-.042);
    lens.rotation.x=Math.PI/2;
    let figure;
    if(slot===null){
      const rim=torus(object,this.metals.edge,id==='go'?.104:.073,.011,0,0,.022);
      torus(object,this.metals.patina,id==='go'?.112:.082,.012,0,0,.006);
      const inset=new Group();inset.position.z=.046;
      object.add(inset);
      const gold=this.metals.edge;
      if(id==='go'){
        addIris(object,this.metals);
      }else if(id==='favorite'||id==='favorites'){
        for(let i=0;i<5;i++){
          const a=i*Math.PI*2/5;
          const ray=add(inset,new ConeGeometry(.015,.048,3),gold,-Math.sin(a)*.019,Math.cos(a)*.019);
          ray.rotation.z=a;
        }
      }else if(id==='terrain'||id==='houses'){
        const symbol=add(inset,new ConeGeometry(.039,.058,id==='houses'?4:3),gold,0,.012);
        symbol.rotation.y=.7;
        box(inset,gold,.047,.036,.016,0,-.023,0);
      }else{
        const part=box(inset,gold,.052,.009,.013,0,0,0);
        part.rotation.z=id==='close'?Math.PI/4:0;
        const mark=box(inset,gold,.039,.009,.013,id==='next'?.016:id==='previous'?-.016:0,.012,.003);
        mark.rotation.z=id==='close'?-Math.PI/4:id==='previous'?Math.PI/3:-Math.PI/3;
      }
      rim.name='control-bezel';
      engrave(object,this.document,controlLabels[id]);
    }
    const state={selected:false,disabled:false,focused:false,start:this.now(),update:()=>{
      const t=this.reduced?.()?1:Math.min(1,Math.max(0,(this.now()-state.start)/590));
      const ease=1-(1-t)**3,phase=t*Math.PI*1.65;
      const count=this.teleport.slots?.length??0;
      const activeAnchor=slot!==null&&count===2?instrumentSlots[slot+1]:anchor;
      const signature=[t,count,state.selected,state.focused,state.disabled].join(':');
      if(signature===state.paint)return false;
      state.paint=signature;
      const raise=state.selected&&slot!==null;
      object.position.set(activeAnchor[0]*ease+.18*(1-ease)*Math.sin(phase),
        activeAnchor[1]-.23*(1-ease)+(raise?.040:0),activeAnchor[2]+(raise?.061:0));
      object.rotation.y=slot===null?0:(slot-1.5)*.25+(1-t)*1.2;
      object.rotation.x=slot===null?0:.12;
      lensMaterial.emissiveIntensity=state.disabled?.16:.54;

      object.scale.setScalar((.72+.28*ease)*(slot===null?1:1.1));
      lensMaterial.emissive.setHex(state.selected||state.focused?0xff9f37:state.disabled?0x142322:0x138f78);
      lensMaterial.color.setHex(state.disabled?this.finish.dark:this.finish.glass);
      return true;
    }};
    this.models.add(state);
    return {object,targets,update:({pressed,disabled})=>{
      state.selected=pressed===true;state.disabled=disabled;
      if(slot!==null){
        const key=this.teleport.slots?.[slot]?.id;
        const kind=key&&teleportModelId(key);
        if(kind&&figure?.name!==kind){
          if(figure){free(figure);figure.removeFromParent();}
          figure=makeDestinationModel(kind,this.finish,this.reflection);figure.name=kind;object.add(figure);
        }
      }
    },focus:active=>{state.focused=active;},dispose:()=>{
      this.models.delete(state);free(object,this.sharedMaterials);
    }};
  }

  animate(){
    let moving=false;
    const caption=this.teleport.caption??'';
    if(this.caption&&caption!==this.lastCaption){
      this.lastCaption=caption;
      this.caption.plaque.visible=Boolean(caption);
      if(caption)this.caption.update(caption);
      moving=true;
    }
    for(const model of this.models)moving=model.update()||moving;
    return moving;
  }

  dispose(){
    free(this.instrument,this.sharedMaterials);this.instrument.removeFromParent();
    for(const mat of this.sharedMaterials)mat.dispose();
    this.reflection?.dispose();
  }
}
