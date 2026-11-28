import {BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace,
  SphereGeometry, TorusGeometry, TubeGeometry, Vector3, CatmullRomCurve3} from 'three';
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
const slots=[[-.87,-.60,.08],[-.36,-.47,-.12],[.29,-.52,-.24],[.87,-.71,.02]];
const controlLabels={favorites:'Favoritos',terrain:'Público',houses:'Casas',house:'Cambiar casa',
  favorite:'Guardar',go:'Viajar'};
const anchors={favorites:[-.62,-1.34,.14],terrain:[-.29,-1.38,.22],houses:[.04,-1.38,.22],
  house:[.78,-.29,.22],previous:[-.94,-1.34,.1],favorite:[.36,-1.38,.22],go:[.73,-1.36,.24],next:[1.04,-1.30,.10],close:[1.22,-.13,.22]};
const free=object=>{
  const geometry=new Set(),materials=new Set();
  object.traverse(child=>{
    if(child.geometry)geometry.add(child.geometry);
    if(child.material)materials.add(child.material);
  });
  for(const item of geometry)item.dispose();
  for(const item of materials){item.map?.dispose();item.dispose();}
};

function engrave(parent,document,label){
  if(!document||!label)return;
  const canvas=document.createElement('canvas');
  canvas.width=160;canvas.height=38;
  const pen=canvas.getContext('2d');
  if(!pen)return;
  pen.fillStyle='#172b2a';
  pen.fillRect(0,0,160,38);
  pen.strokeStyle='#b78f55';pen.lineWidth=2;pen.strokeRect(2,2,156,34);
  pen.fillStyle='#ffe2af';
  pen.textAlign='center';pen.textBaseline='middle';pen.font='600 21px sans-serif';
  pen.fillText(label,80,20,147);
  const map=new CanvasTexture(canvas);
  map.colorSpace=SRGBColorSpace;
  add(parent,new PlaneGeometry(.237,.057),new MeshBasicMaterial({map,toneMapped:false}),0,-.127,.035);
}

export function makeDestinationModel(kind,finish=color){
  const model=new Group(),stone=material(finish.stone),brass=material(finish.brass),roof=material(finish.roof),
    wood=material(finish.wood),glass=material(finish.glass,0x20766c);
  const plinth=cylinder(model,stone,.178,.055,0,-.017);
  const trim=torus(model,brass,.169,.013,0,-.043);trim.rotation.x=Math.PI/2;
  if(kind==='house'){
    box(model,stone,.20,.14,.16,0,.073,0);
    const cap=add(model,new CylinderGeometry(0,.173,.113,4),roof,0,.195,0);
    cap.rotation.y=Math.PI/4;
    box(model,wood,.045,.083,.016,0,.059,.087);
    box(model,glass,.035,.035,.012,.065,.09,.089);
    box(model,stone,.037,.079,.035,-.05,.22,-.022);
  }else if(kind==='table'){
    box(model,wood,.24,.045,.14,0,.104,0);
    for(const x of [-.088,.088])for(const z of [-.044,.044])box(model,brass,.022,.092,.022,x,.052,z);
    for(const x of [-.066,-.015,.038])cylinder(model,brass,.019,.028,x,.14,.025);
    const instrument=torus(model,glass,.038,.008,.06,.18,-.027);
    instrument.rotation.y=-.22;
  }else if(kind==='room'||kind==='residence'){
    const wide=kind==='residence';
    for(const x of [-.109,0,.109])cylinder(model,stone,.017,.13,x,.07,-.035);
    for(const x of [-.055,.055]){
      add(model,new TorusGeometry(.052,.014,7,18,Math.PI),brass,x,.13,-.032);
      box(model,glass,.04,.051,.017,x,.054,-.066);
    }
    box(model,stone,.24,.033,.134,0,.184,-.035);
    if(wide)add(model,new ConeGeometry(.104,.114,6),roof,0,.252,-.034);
  }else{
    cylinder(model,brass,.072,.024,0,.026);
    add(model,new CylinderGeometry(.018,.039,.156,5),stone,0,.112);
    add(model,new ConeGeometry(.02,.043,5),brass,0,.209);
    for(let i=0;i<5;i++){
      const a=i*1.256;
      cylinder(model,glass,.016,.045,Math.cos(a)*.116,.032,Math.sin(a)*.116);
    }
  }
  plinth.name='destination-pedestal';
  return model;
}

export class TeleportModels {
  constructor(teleport,{document,finish=color,reduced,now=()=>performance.now()}={}){
    this.teleport=teleport;this.document=document;this.finish=finish;this.reduced=reduced;this.now=now;
    this.models=new Set();
    this.instrument=new Group();
    this.instrument.rotation.x=.16;
    const brass=material(finish.brass),dark=material(finish.dark),glass=material(finish.glass,0x2c9787);
    const base=cylinder(this.instrument,dark,.99,.13,0,-1.09,-.16);base.scale.z=.60;
    const rim=torus(this.instrument,brass,.985,.028,0,-1.021,-.16);rim.rotation.x=Math.PI/2;rim.scale.y=.60;
    const collar=torus(this.instrument,brass,.975,.009,0,-1.148,-.16);
    collar.rotation.x=Math.PI/2;collar.scale.y=.60;
    const railPoints=Array.from({length:45},(_,i)=>{
      const t=i/44,a=t*Math.PI*2.11;
      return new Vector3(Math.cos(a)*(.72+t*.25),-.98+t*.65,-.19+Math.sin(a)*.36);
    });
    const curve=new CatmullRomCurve3(railPoints);
    add(this.instrument,new TubeGeometry(curve,44,.021,7,false),glass);
    const axle=cylinder(this.instrument,brass,.024,.80,0,-.60,-.46);
    axle.name='orrery-axle';
    add(this.instrument,new SphereGeometry(.075,14,10),glass,0,-.175,-.46);
    for(const a of [.7,1.6]){
      const orbit=torus(this.instrument,brass,.145,.009,0,-.175,-.46);
      orbit.rotation.set(a,a,.25);
    }
  }

  attach(group){
    if(!group)return;
    group.add(this.instrument);
  }

  create({componentId:id}){
    const slot=id.startsWith('slot')?Number(id.slice(4)):null;
    const anchor=slot===null?anchors[id]:slots[slot];
    if(!anchor)return;
    const object=new Group(), targets=[];
    // A stable rounded pedestal covers the miniature's selectable volume.
    const hit=new Mesh(slot===null?new SphereGeometry(.105,14,10):
      new BoxGeometry(.41,.35,.29),new MeshStandardMaterial({colorWrite:false,depthWrite:false}));
    hit.position.y=slot===null?0:.08;
    object.add(hit);targets.push(hit);
    const lensMaterial=material(this.finish.glass,0x147b69);
    const lens=slot===null?cylinder(object,lensMaterial,id==='go'?.105:.070,.056):
      torus(object,lensMaterial,.18,.012,0,-.042);
    lens.rotation.x=Math.PI/2;
    let figure;
    if(slot===null){
      const rim=torus(object,material(this.finish.brass),id==='go'?.106:.076,.017,0,0,.028);
      const inset=new Group();inset.position.z=.046;
      object.add(inset);
      const gold=material(this.finish.stone);
      if(id==='go'){
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3;
          const feather=box(inset,gold,.055,.014,.012,Math.cos(a)*.042,Math.sin(a)*.042,0);
          feather.rotation.z=a+.51;
        }
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
      const t=this.reduced?.()?1:Math.min(1,(this.now()-state.start)/520);
      const ease=1-(1-t)**3,phase=t*Math.PI*1.65;
      object.position.set(anchor[0]*ease+.18*(1-ease)*Math.sin(phase),
        anchor[1]+.26*(1-ease)+(state.selected&&slot!==null?.071:0),anchor[2]+(state.selected&&slot!==null?.14:0));
      object.rotation.y=slot===null?0:(slot-1.5)*.25+(1-t)*1.3;
      object.scale.setScalar(.67+.33*ease);
      lensMaterial.emissive.setHex(state.selected||state.focused?0xff9f37:state.disabled?0x142322:0x138f78);
      lensMaterial.color.setHex(state.disabled?this.finish.dark:this.finish.glass);
      return t<1;
    }};
    this.models.add(state);
    return {object,targets,update:({pressed,disabled})=>{
      state.selected=pressed===true;state.disabled=disabled;
      if(slot!==null){
        const key=this.teleport.slots?.[slot]?.id;
        const kind=key&&teleportModelId(key);
        if(kind&&figure?.name!==kind){
          if(figure){free(figure);figure.removeFromParent();}
          figure=makeDestinationModel(kind,this.finish);figure.name=kind;object.add(figure);
        }
      }
      state.update();
    },focus:active=>{state.focused=active;state.update();},dispose:()=>{
      this.models.delete(state);free(object);
    }};
  }

  animate(){
    let moving=false;
    for(const model of this.models)moving=model.update()||moving;
    return moving;
  }

  dispose(){free(this.instrument);this.instrument.removeFromParent();}
}
