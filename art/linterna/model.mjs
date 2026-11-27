import * as T from 'three';

const material=(name,color,options={})=>new T.MeshStandardMaterial({
  name,color,roughness:.8,...options,
});
const m={
  cedar:material('Cedar',0x9c633b), cedarLight:material('Warm cedar',0xb77e50),
  cedarDark:material('Deep cedar',0x815034), oak:material('Oiled oak',0x92704d),
  roof:material('Dark patinated metal',0x325b4e,{roughness:.68,metalness:.21}),
  seam:material('Patinated standing seams',0x415f53,{roughness:.7,metalness:.14}),
  stone:material('Dressed stone',0x797568), mortar:material('Pale stone',0xa49a83),
  brass:material('Brass',0xb2945d,{roughness:.58,metalness:.43}),
  amber:material('Amber glass',0xf7c165,{emissive:0xff9b22,emissiveIntensity:.42}),
  dark:material('Forest green',0x274940), cloth:material('Green wool',0x537865),
  linen:material('Natural linen',0xc1a478), paper:material('Paper',0xe3cc9d),
  clay:material('Fired clay',0xb87253), mountain:material('Highland clay',0x92865c),
  map:material('Map contours',0x79997a), water:material('Deep blue ceramic',0x325d68),
  dusk:material('Distant contours',0x819478),
};
const grain=[m.cedar,m.cedarLight,m.cedarDark,m.cedar,m.cedarLight,m.cedar];
const Y=new T.Vector3(0,1,0);

function mesh(parent,name,geometry,finish,x=0,y=0,z=0){
  const item=new T.Mesh(geometry,finish);
  item.name=name;
  item.position.set(x,y,z);
  parent.add(item);
  return item;
}
function box(parent,name,finish,x,y,z,w,h,d){
  return mesh(parent,name,new T.BoxGeometry(w,h,d),finish,x,y,z);
}
function cylinder(parent,name,finish,x,y,z,r,h,radiusBottom=r,segments=24){
  return mesh(parent,name,new T.CylinderGeometry(r,radiusBottom,h,segments),finish,x,y,z);
}
function extrusion(parent,name,profile,finish,near,depth){
  return mesh(parent,name,new T.ExtrudeGeometry(profile,{depth,steps:1,curveSegments:12,bevelEnabled:false}),finish,0,0,near);
}
function rod(parent,name,finish,a,b,radius){
  const from=new T.Vector3(...a), to=new T.Vector3(...b);
  const center=from.clone().lerp(to,.5), direction=to.clone().sub(from);
  const stem=cylinder(parent,name,finish,...center.toArray(),radius,direction.length(),radius,8);
  stem.quaternion.setFromUnitVectors(Y,direction.normalize());
  return stem;
}
function doorProfile(width,height){
  const half=width/2, arch=.30;
  const shape=new T.Shape();
  shape.moveTo(-half,0);
  shape.lineTo(half,0);
  shape.lineTo(half,height-arch);
  shape.quadraticCurveTo(half,height,0,height);
  shape.quadraticCurveTo(-half,height,-half,height-arch);
  shape.closePath();
  return shape;
}

// The parcel renderer rotates +Z toward the aisle. All exterior dimensions are metres.
export function createFacade(dimensions){
  const {shell,facade}=dimensions;
  const halfW=shell.depth/2, halfD=shell.width/2;
  const roofW=halfW+facade.roofOverhang, roofD=halfD+facade.roofOverhang;
  const front=halfD, eaves=shell.height, apex=facade.totalHeight;
  const root=new T.Group();
  root.name='Casa Linterna exterior';
  box(root,'Grounded stone sill',m.stone,0,.045,0,shell.depth,.09,shell.width);
  box(root,'Cedar envelope',m.cedar,0,(eaves+.09)/2,0,shell.depth-.008,eaves-.09,shell.width-.008);
  for(let i=0;i<21;i++){
    const z=-halfD+(i+.5)*shell.width/21;
    for(const side of [-1,1])
      box(root,'Side cladding',grain[i%grain.length],side*(halfW-.012),(eaves+.09)/2,z,.024,eaves-.09,shell.width/21-.005);
  }
  for(let i=0;i<10;i++){
    const x=-halfW+(i+.5)*shell.depth/10;
    for(const end of [-1,1])
      box(root,'End cladding',grain[(i+2)%grain.length],x,(eaves+.09)/2,end*(front-.012),shell.depth/10-.004,eaves-.09,.024);
  }
  const vaultY=x=>apex-(apex-eaves)*(x/roofW)**2;
  const gable=new T.Shape();
  gable.moveTo(-halfW,eaves-.02);
  for(let i=0;i<=16;i++){
    const x=-halfW+i*2*halfW/16;
    gable.lineTo(x,vaultY(x)-.055);
  }
  gable.lineTo(halfW,eaves-.02);
  gable.closePath();
  extrusion(root,'Cedar vaulted upper wall',gable,m.cedar,front-.019,.019);
  extrusion(root,'Rear vaulted upper wall',gable,m.cedar,-front,.019);
  const roof=new T.Shape(), slopePoints=[];
  for(let i=0;i<=24;i++){
    const x=-roofW+i*2*roofW/24;
    slopePoints.push([x,vaultY(x)]);
  }
  roof.moveTo(...slopePoints[0]);
  slopePoints.slice(1).forEach(point=>roof.lineTo(...point));
  for(const [x,y] of [...slopePoints].reverse())roof.lineTo(x,y-.075);
  roof.closePath();
  extrusion(root,'Continuous vaulted roof',roof,m.roof,-roofD,2*roofD);
  for(let i=1;i<12;i++){
    const x=-roofW+i*2*roofW/12, y=vaultY(x)-.005;
    rod(root,'Standing roof seam',m.seam,[x,y,-roofD+.012],[x,y,roofD-.012],.005);
  }
  const door=facade.doorWidth;
  extrusion(root,'Oak architrave',doorProfile(door+.083,facade.doorHeight+.035),m.oak,front,.035);
  extrusion(root,'Green arched door',doorProfile(door,facade.doorHeight),m.dark,front+.034,.020);
  for(const x of [-.25,-.125,0,.125,.25]){
    box(root,'Door joinery',m.roof,x,.80,front+.055,.006,1.56,.003);
  }
  const radius=facade.oculusDiameter/2;
  const light=cylinder(root,'Oculus amber glass',m.amber,0,facade.oculusHeight,front+.028,radius-.015,.033);
  light.rotation.x=Math.PI/2;
  mesh(root,'Oculus brass rim',new T.TorusGeometry(radius-.008,.019,8,36),m.brass,0,facade.oculusHeight,front+.048);
  box(root,'Oculus horizontal division',m.brass,0,facade.oculusHeight,front+.049,.33,.015,.012);
  box(root,'Oculus vertical division',m.brass,0,facade.oculusHeight,front+.049,.015,.33,.012);
  cylinder(root,'Threshold door knob',m.brass,.30,.88,front+.077,.026,.043).rotation.x=Math.PI/2;
  box(root,'Stone threshold',m.mortar,0,.034,front+facade.thresholdReach/2,
    facade.thresholdWidth,.068,facade.thresholdReach);
  box(root,'Slit window frame',m.oak,halfW+.011,1.48,-.70,.042,.58,.22);
  box(root,'Slit window glass',m.amber,halfW+.034,1.48,-.70,.006,.49,.145);
  return root;
}

function table(root,object,finish,height=.91){
  const {x,z,w,d}=object;
  box(root,'Worktop',finish,x,height-.048,z,w,.096,d);
  for(const dx of [-1,1])for(const dz of [-1,1])
    box(root,'Leg',m.oak,x+dx*(w/2-.14),(height-.09)/2,z+dz*(d/2-.12),.13,height-.09,.13);
  box(root,'Stretcher',m.oak,x,.24,z,w-.22,.11,.14);
}
function bench(root,{x,z,w,d}){
  const finish=m.oak, height=.46;
  box(root,'Bench seat',finish,x,height,z,w,.12,d);
  for(const side of [-1,1]){
    const alongZ=d>w;
    box(root,'Bench foot',finish,x+(alongZ?0:side*(w/2-.22)),.21,z+(alongZ?side*(d/2-.22):0),alongZ?w*.75:.16,.42,alongZ?.16:d*.74);
  }
}
function chair(root,x,z,w,d,finish,turn=0){
  const group=new T.Group();
  group.position.set(x,0,z);
  group.rotation.y=turn;
  root.add(group);
  box(group,'Wool seat',finish,0,.46,0,w*.85,.22,d*.84);
  box(group,'Backrest',finish,0,.78,d*.36,w*.85,.68,d*.23);
  for(const side of [-1,1]){
    box(group,'Oak arm',m.oak,side*w*.45,.66,0,w*.10,.085,d*.9);
    box(group,'Chair frame',m.oak,side*w*.39,.28,0,w*.11,.56,d*.77);
  }
}
function shelf(root,{x,z,w,d}){
  const height=1.86;
  for(const side of [-1,1])box(root,'Bookcase end',m.cedar,x,height/2,z+side*(d/2-.045),w,height,.09);
  for(let row=0;row<4;row++){
    const y=.19+row*.51;
    box(root,'Shelf board',m.oak,x,y,z,w,.068,d);
    for(let i=0;i<5;i++){
      const t=(i+.8)/5.7, tone=[m.paper,m.clay,m.cloth,m.water,m.linen][(i+row)%5];
      box(root,'Archive sample',tone,x+.06,y+.12,z+(t-.5)*d,.27+.04*(i%3),.20,.075+.025*(i%2));
    }
  }
}
function atlas(root,{x,z,r}){
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5;
    const a=[x+Math.cos(angle)*.86,.06,z+Math.sin(angle)*.86];
    const b=[x+Math.cos(angle)*.54,.77,z+Math.sin(angle)*.54];
    rod(root,'Atlas radial timber brace',m.oak,a,b,.11);
  }
  cylinder(root,'Round atlas timber rim',m.oak,x,.87,z,r,.17,r-.055,48);
  cylinder(root,'Blue ceramic map bed',m.water,x,.961,z,r-.071,.024,r-.071,48);
  const curve=(base,lift)=>{
    const points=[];
    for(let i=0;i<48;i++){
      const t=i*Math.PI/24, wave=.035*Math.cos(7*t)+.028*Math.sin(3*t);
      points.push(new T.Vector3(x+(base+wave)*Math.cos(t),.99+lift+.021*Math.cos(4*t),z+(base+wave)*Math.sin(t)));
    }
    return new T.CatmullRomCurve3(points,true,'centripetal');
  };
  mesh(root,'Raised ring terrain',new T.TubeGeometry(curve(.88,.04),48,.21,8,true),m.map);
  mesh(root,'Raised ridgeline',new T.TubeGeometry(curve(.95,.17),48,.064,6,true),m.mountain);
  for(const [dx,dz] of [[-.61,-.58],[.84,.17],[.20,.84]]){
    cylinder(root,'Survey marker',m.brass,x+dx,1.27,z+dz,.028,.17,.028,10);
    mesh(root,'Survey bead',new T.IcosahedronGeometry(.07,1),m.amber,x+dx,1.37,z+dz);
  }
  rod(root,'Pendant stem',m.brass,[x,3.24,z],[x,2.47,z],.015);
  cylinder(root,'Atlas lamp shade',m.roof,x,2.475,z,.28,.16,.47);
  cylinder(root,'Atlas lamp glow',m.amber,x,2.386,z,.40,.024);
}
function horizon(root){
  box(root,'Horizon mural panel',m.water,0,1.85,-5.76,3.65,1.96,.045);
  const layers=[
    [[-1.72,1.37],[-1.23,1.51],[-.71,2.00],[-.31,1.69],[.16,1.76],[.69,2.34],[1.22,2.14],[1.72,1.80]],
    [[-1.72,1.37],[-1.10,1.69],[-.48,1.51],[.03,1.45],[.66,1.58],[1.23,1.72],[1.72,1.42]],
  ];
  layers.forEach((points,index)=>{
    const shape=new T.Shape();
    shape.moveTo(-1.72,.92);
    points.forEach(point=>shape.lineTo(...point));
    shape.lineTo(1.72,.92);
    shape.closePath();
    extrusion(root,'Painted ridge',shape,index?m.dark:m.dusk,-5.729+index*.012,.006);
  });
}

export function createRoom(type,dimensions){
  const plan=dimensions.rooms[type];
  if(!plan)throw Error('Unknown Casa Linterna room');
  const result=new T.Group();
  result.name='Casa Linterna '+type;
  for(const item of plan.objects){
    const {x,z,w,d}=item;
    switch(item.style){
      case 'atlas':
        atlas(result,item);
        break;
      case 'bench':
        if(type==='workshop')table(result,item,m.oak);
        else bench(result,item);
        break;
      case 'seats':
        chair(result,x,z-.82,w*.9,1.15,m.cloth,-Math.PI/2);
        chair(result,x,z+.82,w*.9,1.15,m.linen,-Math.PI/2);
        break;
      case 'hooks':
        bench(result,item);
        for(let i=-1;i<=1;i++)rod(result,'Brass hook',m.brass,[x+i*.29,.55,z],[x+i*.29,1.57,z],.019);
        break;
      case 'shelf':
        shelf(result,item);
        break;
      case 'specimens':
        table(result,item,m.oak);
        box(result,'Specimen tray',m.linen,x-.55,.948,z-.08,.68,.064,.48);
        mesh(result,'Stone specimen',new T.IcosahedronGeometry(.135,1),m.stone,x-.52,1.05,z-.08);
        box(result,'Field notebook',m.paper,x+.49,.95,z+.08,.28,.073,.37);
        break;
      case 'seat':
        chair(result,x,z,item.r*1.24,item.r*1.24,m.linen,Math.PI);
        break;
      case 'worktable':
        table(result,item,m.oak,.97);
        box(result,'Atelier work mat',m.cloth,x,.978,z,1.49,.016,.82);
        cylinder(result,'Working stand',m.stone,x,1.015,z,.32,.062,.32,20);
        break;
      default:
        throw Error('Unknown fixture style '+item.style);
    }
  }
  if(type==='atlas'){
    const mural = new T.Group();
    mural.name = 'Atlas horizon mural';
    horizon(mural);
    result.add(mural);
  }
  return result;
}
