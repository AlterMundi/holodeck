import * as T from 'three';

import { addPavilionColumns, addPavilionRoof } from '../precinct/model.mjs';
import { pavilionDoor } from '../precinct/plan.mjs';
import { gardenPlan } from './garden-plan.mjs';

const { width, roof } = gardenPlan.nix;
const rear = -4.29;
const front = pavilionDoor;
const doorX = .92;
const statue = [-1.85,0,-1.58];

export const foyerPlan = {
  width, front, rear, doorX, statue,
  entrances: {garden:1.72, observatory:1.80},
  anchors: {
    'nix.foyer.entry': {at:[0,0,front],facing:[0,0,-1],from:'garden'},
    'nix.foyer.return': {at:[0,0,front],facing:[0,0,1],to:'garden'},
    'nix.foyer.statue': {at:statue,represents:'Nix'},
    'nix.foyer.wanda-door': {at:[doorX,0,rear],facing:[0,0,-1],to:'nix.entry',site:'WANDA'},
  },
};

function material(color, roughness=.8, metalness=0) {
  return new T.MeshStandardMaterial({color,roughness,metalness});
}

export function textPanel(text, width, height, {foreground='#fff0d2', background='#292b39'}={}) {
  const canvas = document.createElement('canvas');
  canvas.width=512;
  canvas.height=Math.ceil(512*height/width);
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=background;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=foreground;
  ctx.font=`bold ${Math.floor(canvas.height*.54)}px Georgia`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width*.91);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  return new T.Mesh(new T.PlaneGeometry(width,height),
    new T.MeshBasicMaterial({map:texture,toneMapped:false}));
}

export function makeFoyer() {
  const group=new T.Group(), obstacles=[];
  group.name='Templo de Nix / Vestíbulo';
  group.userData={units:'metres',up:'+Y',review:'design-only'};
  const stone=material('#b9a98e');
  const plaster=material('#d2c4ad');
  const mural=material('#343950');
  const linen=material('#4e506e',.89);
  const robe=material('#29334c',.83);
  const marble=material('#b3a297',.65);
  const chair=material('#5c533f');
  const brass=material('#b28a53',.4,.45);
  const cedar=material('#644938');
  const sage=material('#465d53');
  const frost=new T.MeshBasicMaterial({color:'#ddc595',toneMapped:false});
  const glow=new T.MeshBasicMaterial({color:'#ffd89e',toneMapped:false});
  const add=(name,geometry,surface,at,parent=group)=>{
    const part=new T.Mesh(geometry,surface);
    part.name=name;
    part.position.set(...at);
    if(!surface.isMeshBasicMaterial) {
      part.castShadow=true;
      part.receiveShadow=true;
    }
    parent.add(part);
    return part;
  };
  const box=(name,size,at,m,parent)=>add(name,new T.BoxGeometry(...size),m,at,parent);
  const cylinder=(label,top,bottom,h,at,m,parent)=>add(label,new T.CylinderGeometry(top,bottom,h,24),m,at,parent);
  const sphere=(name,radius,scale,at,m,parent)=>{
    const mesh=add(name,new T.SphereGeometry(radius,24,16),m,at,parent);
    mesh.scale.set(...scale);
    return mesh;
  };
  const plaque=(label,width,height,position)=>{
    box(label+' bronze border',[width+.085,height+.08,.061],[position[0],position[1],position[2]-.038],brass);
    const face=textPanel(label,width,height);
    face.name=label;
    face.position.set(...position);
    group.add(face);
    return face;
  };
  const half=width/2, depth=front-rear;
  const floorFront=4.82, floorRear=rear-.16;
  const floorDepth=floorFront-floorRear, wallZ=(front+rear)/2;
  box('Dressed limestone floor',[width,.12,floorDepth],[0,-.062,(floorFront+floorRear)/2],stone);
  const count=Math.round(width);
  for(let row=0;row<9;row++) for(let col=0;col<count;col++){
    box('Vestibule limestone tile',[width/count-.017,.027,floorDepth/9-.017],
      [(col+.5)*width/count-half,-.013,floorRear+(row+.5)*floorDepth/9],(row+col)%2?stone:plaster);
  }
  for(const side of [-1,1]){
    const x=side*half;
    box('Limewash side wall',[.22,3.15,depth],[x,1.575,wallZ],plaster);
    box('Sage dado',[.038,.52,depth-.24],[side*(half-.127),.26,wallZ],sage);
    box('Walnut cap',[.055,.09,depth-.24],[side*(half-.144),.56,wallZ],cedar);
    for(const z of [-2.65,-.32,2.15])
      box('Engaged stone pilaster',[.055,2.99,.21],[side*(half-.16),1.5,z],stone);
    addPavilionColumns(group,obstacles,width,side);
  }
  function wallWithDoor(z,cx,opening,finish){
    for(const [a,b] of [[-half,cx-opening/2],[cx+opening/2,half]]){
      box('Door wall pier',[b-a,3.15,.19],[(a+b)/2,1.575,z],finish);
    }
    box('Door lintel infill',[opening,.73,.19],[cx,2.785,z],finish);
    for(const side of [-1,1])
      box('Dressed door jamb',[.15,2.46,.29],[cx+side*(opening/2+.079),1.23,z],stone);
    box('Dressed lintel',[opening+.32,.16,.31],[cx,2.49,z],stone);
    box('Flush brass threshold',[opening,.018,.34],[cx,.005,z],brass);
  }
  wallWithDoor(front,0,foyerPlan.entrances.garden,plaster);
  wallWithDoor(rear,doorX,foyerPlan.entrances.observatory,mural);
  box('Recess behind WANDA door',[1.79,2.41,.10],[doorX,1.215,rear-.10],chair);
  const doorFace=box('WANDA door leaf',[1.68,2.31,.06],[doorX,1.18,rear-.04],cedar);
  box('WANDA door recessed slate panel',[1.25,1.95,.045],[doorX,1.19,rear+.009],mural);
  box('WANDA door pull',[.032,.24,.09],[doorX+.58,1.09,rear+.06],brass);
  plaque('WANDA · OBSERVATORIO',1.78,.235,[doorX,2.75,rear+.166]);

  box('Cedar coffer',[width-.15,.151,depth+.12],[0,3.17,wallZ],cedar);
  for(let z=rear+.45;z<front;z+=.89)
    box('Coffer beam',[width-.27,.155,.111],[0,3.011,z],sage);
  for(let x=-half+.58;x<half-.20;x+=.96)
    box('Coffer rib',[.115,.13,depth-.13],[x,3.025,wallZ],cedar);
  addPavilionRoof(group,width,roof);

  const frontLights=[];
  for(const side of [-1,1]){
    const lightX=side*1.13;
    box('Amber facade lantern',[.14,.18,.115],[lightX,1.94,front+.165],glow);
    box('Facade lantern bronze cap',[.18,.034,.153],[lightX,2.052,front+.18],brass);
    frontLights.push({at:[lightX,1.85,front+.50],color:'#ffce8d',intensity:5.5,range:4.0});
  }
  plaque('TEMPLO DE NIX',1.50,.229,[0,3.21,4.948]);
  plaque('NIX · LA NOCHE',1.55,.23,[statue[0],1.68,rear+.13]);
  const star=new T.Shape();
  for(let i=0;i<16;i++){
    const angle=Math.PI/2+i*Math.PI/8, radius=i%2?.085:.241;
    star[i?'lineTo':'moveTo'](radius*Math.cos(angle),radius*Math.sin(angle));
  }
  star.closePath();
  add('Eight-point night medallion',new T.ShapeGeometry(star),frost,[0,3.895,4.905]).scale.setScalar(1.22);
  for(const [x,y,scale] of [[-3.12,2.24,.16],[-2.48,2.49,.22],[-1.79,2.33,.28],[-1.04,2.51,.16],[-.49,2.21,.20]]){
    add('Gilt night frieze star',new T.ShapeGeometry(star),brass,[x,y,rear+.105]).scale.setScalar(scale);
  }

  const figure=new T.Group();
  figure.name='Statue of Nix';
  figure.position.set(...foyerPlan.statue);
  group.add(figure);
  box('Limestone plinth base',[.90,.13,.79],[0,.065,0],stone,figure);
  box('Limestone plinth shaft',[.77,.49,.69],[0,.37,0],stone,figure);
  box('Limestone plinth cap',[.93,.105,.82],[0,.657,0],plaster,figure);
  const drape=[[.305,.708],[.285,.80],[.234,.966],[.19,1.16],[.149,1.33],
    [.157,1.48],[.176,1.62],[.138,1.71],[.088,1.77]];
  add('Midnight carved drapery',new T.LatheGeometry(drape.map(([r,y])=>new T.Vector2(r,y)),40),
    robe,[0,0,0],figure).scale.z=.75;
  for(let i=0;i<9;i++){
    const angle=-1.39+i*.345;
    const folds=drape.slice(0,7).map(([r,y],j)=>new T.Vector3(
      Math.sin(angle+j*.055)*(r+.003),y,Math.cos(angle+j*.055)*(r+.005)*.75));
    add('Carved mantle fold',new T.TubeGeometry(new T.CatmullRomCurve3(folds),14,.024,7,false),
      i%3?linen:robe,[0,0,0],figure);
  }
  cylinder('Marble neck',.055,.065,.11,[0,1.765,.016],marble,figure);
  sphere('Marble forehead and jaw',.119,[.79,1.20,.78],[0,1.902,.046],marble,figure);
  sphere('Carved veiled hair',.117,[1.03,1.08,.79],[0,1.937,-.027],robe,figure);
  sphere('Veil over shoulders',.118,[.77,1.74,.49],[-.129,1.83,-.023],linen,figure);
  sphere('Veil over shoulders',.118,[.75,1.69,.45],[.125,1.84,-.025],linen,figure);
  const arm=new T.CatmullRomCurve3([new T.Vector3(.139,1.60,.022),
    new T.Vector3(.23,1.425,.107),new T.Vector3(.323,1.47,.224)]);
  add('Curved raised sleeve',new T.TubeGeometry(arm,20,.058,9,false),robe,[0,0,0],figure);
  sphere('Raised marble hand',.051,[1,.55,.7],[.326,1.454,.226],marble,figure);
  sphere('Bronze night globe',.080,[1,1,1],[.322,1.552,.229],brass,figure);
  const halo=add('Star disc behind Nix',new T.TorusGeometry(.168,.009,8,40),brass,[0,1.913,-.11],figure);
  add('Small night star',new T.ShapeGeometry(star),frost,[0,2.116,-.101],figure).scale.setScalar(.19);
  halo.name='Engraved bronze halo';
  const name=textPanel('NIX',.42,.14);
  name.position.set(0,.348,.354);
  figure.add(name);
  const rim=new T.PointLight('#ffd4a1',9,3.5,2);
  rim.position.set(statue[0]-.25,2.67,statue[2]+1.12);
  group.add(rim);
  const house=new T.PointLight('#a8bffe',5.5,3.5,2);
  house.position.set(doorX+.22,2.84,rear+.57);
  group.add(house);
  for(const [id,data] of Object.entries(foyerPlan.anchors)){
    const marker=new T.Group();
    marker.name=id;
    marker.position.set(...data.at);
    marker.userData={anchorId:id,...data};
    group.add(marker);
  }
  return {group,figure,obstacles,doorFace,doorHits:group.children.filter(obj=>
    ['WANDA door leaf','WANDA door recessed slate panel','WANDA door pull'].includes(obj.name)),
    frontLights};
}
