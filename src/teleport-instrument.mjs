import {BoxGeometry, CanvasTexture, CatmullRomCurve3, CylinderGeometry, DoubleSide, EquirectangularReflectionMapping,
  ExtrudeGeometry, LatheGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, SphereGeometry,
  SRGBColorSpace, TorusGeometry, TubeGeometry, Vector2, Vector3} from 'three';

export function mesh(parent,geometry,material,x=0,y=0,z=0){
  const part=new Mesh(geometry,material);
  part.position.set(x,y,z);
  parent.add(part);
  return part;
}

export function studioReflection(document){
  if(!document)return;
  const canvas=document.createElement('canvas');
  canvas.width=128;canvas.height=64;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const studio=ctx.createLinearGradient(0,0,0,64);
  studio.addColorStop(0,'#b4c4c2');studio.addColorStop(.28,'#676c60');
  studio.addColorStop(.48,'#333b38');studio.addColorStop(.61,'#231b19');studio.addColorStop(1,'#453d32');
  ctx.fillStyle=studio;ctx.fillRect(0,0,128,64);
  for(const [x,y,w,h,color] of [[11,11,29,12,'#fff1cd'],[52,19,5,16,'#edb76d'],[87,12,19,19,'#b8efed'],[111,27,10,7,'#c88b61']]){
    ctx.fillStyle=color;ctx.fillRect(x,y,w,h);
  }
  const env=new CanvasTexture(canvas);
  env.colorSpace=SRGBColorSpace;env.mapping=EquirectangularReflectionMapping;
  return env;
}

export function instrumentMetals(finish,envMap){
  const standard=(color,details)=>new MeshStandardMaterial({color,envMap,envMapIntensity:1.55,...details});
  return {
    brass:standard(finish.brass,{metalness:.84,roughness:.23}),
    edge:standard(0xf1bf79,{metalness:.78,roughness:.19}),
    patina:standard(0x67472e,{metalness:.58,roughness:.38}),
    enamel:standard(0x224548,{metalness:.31,roughness:.27}),
    obscured:standard(0x172625,{metalness:.32,roughness:.45}),
    glass:standard(0x398688,{metalness:.21,roughness:.14,transparent:true,opacity:.21,depthWrite:false,side:DoubleSide}),
    light:new MeshBasicMaterial({color:0x77ead2}),
  };
}

const lathe=(profile,segments=80)=>new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y)),segments);
const washer=(parent,material,r,t,x,y,z)=>mesh(parent,new TorusGeometry(r,t,8,32),material,x,y,z);
const tube=(parent,points,r,material)=>mesh(parent,new TubeGeometry(new CatmullRomCurve3(points),points.length*2,r,7,false),material);
const block=(parent,material,w,h,d,x,y,z)=>mesh(parent,new BoxGeometry(w,h,d),material,x,y,z);
export const instrumentSlots=[[-.77,-.75,.15],[-.32,-.46,-.02],[.28,-.55,-.03],[.75,-.72,.15]];
export const instrumentAnchors={favorites:[-.66,-1.24,.525],terrain:[-.34,-1.27,.525],houses:[-.04,-1.27,.525],
  previous:[-.965,-1.202,.50],favorite:[.25,-1.27,.525],go:[.59,-1.25,.55],next:[.936,-1.202,.50],
  house:[.87,-.42,.17],close:[.99,-.07,.15]};

export function buildInstrument(parent,{brass,edge,patina,enamel,obscured,glass,light}){
  const base=mesh(parent,lathe([[.01,-.15],[.66,-.15],[.76,-.128],[.85,-.10],[.925,-.06],
    [.965,-.012],[.966,.05],[.947,.07],[.852,.084],[.01,.084]]),enamel,0,-1.06,-.14);
  base.scale.z=.54;base.rotation.x=.13;
  for(const [r,y,t,m] of [[.777,-1.205,.014,patina],[.885,-1.163,.022,brass],[.967,-1.068,.019,edge],
    [.955,-1.012,.024,brass],[.868,-.975,.012,edge],[.812,-.968,.006,light]]){
    const ring=washer(parent,m,r,t,0,y,-.14);
    ring.rotation.x=Math.PI/2+.13;ring.scale.y=.55;
  }

  const fascia=new Shape();
  fascia.moveTo(-1.12,-1.17);fascia.quadraticCurveTo(-1.15,-1.105,-.94,-1.105);
  fascia.quadraticCurveTo(0,-1.17,.96,-1.105);fascia.quadraticCurveTo(1.13,-1.11,1.105,-1.19);
  fascia.lineTo(1.00,-1.34);fascia.quadraticCurveTo(.93,-1.40,.68,-1.405);
  fascia.quadraticCurveTo(.44,-1.40,.44,-1.456);
  fascia.quadraticCurveTo(.43,-1.52,.32,-1.53);fascia.lineTo(-.32,-1.53);
  fascia.quadraticCurveTo(-.44,-1.52,-.48,-1.45);fascia.quadraticCurveTo(-.58,-1.411,-.8,-1.41);fascia.quadraticCurveTo(-1.025,-1.391,-1.065,-1.32);
  fascia.closePath();
  mesh(parent,new ExtrudeGeometry(fascia,{depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.021,
    bevelSegments:3,curveSegments:16}),brass,0,0,.385);
  for(const x of [-1.04,1.025,-.84,.83]){
    const y=Math.abs(x)>.95?-1.155:-1.373;
    const screw=mesh(parent,new CylinderGeometry(.014,.017,.011,12),edge,x,y,.457);
    screw.rotation.x=Math.PI/2;
    block(parent,patina,.017,.003,.003,x,y,.467).rotation.z=.4+x;
  }
  for(const x of [-.81,.81]){
    const hinge=mesh(parent,new CylinderGeometry(.064,.066,.084,20),patina,x,-.955,-.13);
    hinge.rotation.z=Math.PI/2;
    washer(parent,edge,.051,.008,x,-.955,-.092);
  }

  const hood=[];
  for(let i=0;i<=34;i++){
    const a=Math.PI*i/34;
    hood.push(new Vector3(Math.cos(a)*.92,-.955+Math.sin(a)*1.04,-.285+Math.sin(a)*.085));
  }
  for(const [z,r,m] of [[-.05,.032,brass],[.015,.011,edge],[-.214,.022,patina]]){
    tube(parent,hood.map(p=>p.clone().add(new Vector3(0,0,z))),r,m);
  }
  const pane=new Shape();
  pane.moveTo(-.91,-.95);
  for(let i=34;i>=0;i--)pane.lineTo(hood[i].x,hood[i].y);
  pane.lineTo(.91,-.95);pane.quadraticCurveTo(0,-1.021,-.91,-.95);
  mesh(parent,new ExtrudeGeometry(pane,{depth:.009,bevelEnabled:false,curveSegments:12}),glass,0,0,-.41);
  for(const x of [-.68,.68]){
    const end=Math.sqrt(1-(x/.92)**2)*1.04-.955;
    const point=new Vector3(x,end,-.29);
    tube(parent,[new Vector3(x*1.23,-.945,-.34),new Vector3(x*1.09,(-.945+end)/2,-.33),point],.012,patina);
  }

  const railPoints=[[-.91,-.84,.16],[-.77,-.761,.15],[-.52,-.57,.02],[-.32,-.471,-.02],
    [.02,-.48,-.16],[.28,-.561,-.03],[.75,-.731,.15],[.9,-.818,.145],
    [.75,-.895,-.08],[.10,-.91,-.36],[-.46,-.88,-.32]];
  const rail=railPoints.map(point=>new Vector3(...point));
  tube(parent,rail,.026,brass);
  tube(parent,rail.map(point=>point.clone().add(new Vector3(0,.017,.014))),.009,light);
  for(const [x,y,z] of instrumentSlots){
    const height=y+.965;
    mesh(parent,new CylinderGeometry(.018,.023,height,16),brass,x,y-height/2-.021,z);
    mesh(parent,new CylinderGeometry(.037,.048,.024,18),patina,x,-.948,z);
  }

  const axle=mesh(parent,new CylinderGeometry(.02,.028,.42,20),brass,0,-.24,-.245);
  axle.name='orrery-axle';
  mesh(parent,new SphereGeometry(.052,20,12),light,0,-.14,-.245);
  for(const [tilt,angle,r] of [[.52,.4,.118],[1.24,-.5,.122],[1.76,.8,.124]]){
    washer(parent,edge,r,.008,0,-.14,-.245).rotation.set(tilt,angle,.3);
  }
  for(const x of [-.28,.28]){
    const foot=mesh(parent,lathe([[0,-.026],[.09,-.026],[.098,-.014],[.081,.016],[.051,.054],[0,.054]],32),
      obscured,x,-1.22,-.09);
    foot.scale.z=.74;
  }
}

export function addIris(parent,{edge,patina,obscured,glass,light}){
  mesh(parent,new CylinderGeometry(.118,.13,.046,40),patina,0,0,-.012).rotation.x=Math.PI/2;
  mesh(parent,new CylinderGeometry(.096,.096,.009,36),obscured,0,0,.05).rotation.x=Math.PI/2;
  washer(parent,edge,.108,.01,0,0,.056);
  washer(parent,light,.091,.0022,0,0,.066);
  const leaf=new Shape();
  leaf.moveTo(.018,.004);leaf.quadraticCurveTo(.043,-.013,.091,.021);
  leaf.quadraticCurveTo(.085,.053,.046,.076);
  leaf.quadraticCurveTo(.031,.049,.018,.004);
  for(let i=0;i<7;i++){
    mesh(parent,new ExtrudeGeometry(leaf,{depth:.004,bevelEnabled:false,curveSegments:8}),i%2===0?glass:edge,0,0,.062+i*.001)
      .rotation.z=i*Math.PI*2/7;
  }
  mesh(parent,new SphereGeometry(.018,14,9),light,0,0,.071).scale.z=.33;
}
