import {CanvasTexture, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, SRGBColorSpace, Vector3} from 'three';
import {toroidalRotation} from './toroidal-locomotion.mjs';

const units=1/515;
const appearance='compaii-navegante-white-v1';
const torsoDepth=.105,headDepth=.088;
const authoredDepth={
  torso:[torsoDepth,.005],head:[headDepth,.005],
  'leg-left':[.054,.012],'leg-right':[.054,.012],
  'arm-left':[.047,.021],'arm-right':[.047,.021],
  'forearm-left':[.043,.025],'forearm-right':[.043,.025],
  'palm-left':[.031,.031],'palm-right':[.031,.031],
  'mouth-interior':[.005,.054],'lower-shell':[.036,.064],
};
const origin=[288,697];
const localUp=new Vector3(0,1,0);

function avatarAtlas(document,atlas){
  const canvas=document.createElement('canvas');
  canvas.width=atlas.width;canvas.height=atlas.height;
  const context=canvas.getContext('2d'),image=context.createImageData(atlas.width,atlas.height);
  const pixels=atob(atlas.pixels),palette=atlas.palette.map(color=>[1,3,5,7].map(i=>parseInt(color.slice(i,i+2),16)));
  for(let index=0;index<pixels.length;index++)image.data.set(palette[pixels.charCodeAt(index)],index*4);
  context.putImageData(image,0,0);
  const texture=new CanvasTexture(canvas);
  texture.colorSpace=SRGBColorSpace;
  return texture;
}

function localPoint(parent,x,y){return [(x-parent[0])*units,(parent[1]-y)*units];}

function nodeShape(node){
  const shape=new Shape();
  const point=(x,y)=>localPoint(node.pivot,x,y);
  let polygon=node.clip;
  if(!polygon&&node.type==='raster'){
    const [x,y,w,h]=node.bounds;
    polygon=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  }
  if(polygon?.length){
    polygon.forEach(([x,y],index)=>shape[index?'lineTo':'moveTo'](...point(x,y)));
    shape.closePath();
    return shape;
  }
  if(node.type==='ellipse'){
    const [x,y]=point(node.cx,node.cy);
    shape.absellipse(x,y,node.rx*units,node.ry*units,0,2*Math.PI,false,0);
    return shape;
  }
  return null;
}

function rasterUvs(geometry,node,atlas){
  const [x,y,w,h]=node.bounds;
  const [left,top,width,height]=node.rect;
  const position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let index=0;index<position.count;index++){
    const u=(position.getX(index)/units+node.pivot[0]-x)/w;
    const v=(node.pivot[1]-position.getY(index)/units-y)/h;
    uv.setXY(index,(left+width*u)/atlas.width,1-(top+height*v)/atlas.height);
  }
  uv.needsUpdate=true;
}

export function mountCompanionFigure(document,model){
  const root=new Group();
  root.name='CompAII · Navegante blanco';
  const atlas=avatarAtlas(document,model.atlas);
  const skin=new MeshStandardMaterial({map:atlas,alphaTest:.35,roughness:.72,side:DoubleSide});
  const shell=new MeshStandardMaterial({color:0x9b9c9e,roughness:.56,metalness:.12});
  const mouth=new MeshStandardMaterial({color:0x331608,roughness:.83});
  const rigs=new Map(model.nodes.map(node=>[node.id,new Group()]));
  for(const node of model.nodes){
    const group=rigs.get(node.id),parent=model.nodes.find(entry=>entry.id===node.parent);
    group.position.set(...localPoint(parent?.pivot??origin,...node.pivot),0);
    group.name=node.id;
    (rigs.get(node.parent)??root).add(group);
    const shape=nodeShape(node);
    if(!shape)continue;
    const [depth,front]=authoredDepth[node.id]??[.005,.07];
    const geometry=new ExtrudeGeometry(shape,{depth,steps:1,curveSegments:12,bevelEnabled:depth>.02,
      bevelSegments:2,bevelThickness:.008,bevelSize:.004});
    if(node.type==='raster')rasterUvs(geometry,node,model.atlas);
    const mesh=new Mesh(geometry,node.type==='raster'?[skin,shell]:[mouth,mouth]);
    mesh.position.z=front-depth/2;
    group.add(mesh);
  }
  const defaults=new Map([...rigs].map(([name,group])=>[name,group.position.clone()]));
  const pose=(frame,level)=>{
    for(const track of model.animations.calm){
      const group=rigs.get(track.node);
      const first=Math.floor(frame)%track.frames.length,second=(first+1)%track.frames.length;
      const value=track.frames[first]+(track.frames[second]-track.frames[first])*(frame%1);
      if(track.channel==='x')group.position.x=defaults.get(track.node).x+value*units;
      else if(track.channel==='y')group.position.y=defaults.get(track.node).y-value*units;
      else if(track.channel==='rotate')group.rotation.z=-value;
      else if(track.channel==='scaleX')group.scale.x=value;
      else if(track.channel==='scaleY')group.scale.y=value;
    }
    const hinge=rigs.get('anchor-mouth');
    hinge.position.y=defaults.get('anchor-mouth').y-12*units*level;
    hinge.rotation.z=-.035*level;
  };
  return {root,pose,dispose(){
    root.removeFromParent();
    root.traverse(object=>object.geometry?.dispose());
    atlas.dispose();skin.dispose();shell.dispose();mouth.dispose();
  }};
}

export class CompanionAvatar{
  constructor({scene,document,load}){
    Object.assign(this,{scene,document});
    this.relative=new Vector3();
    this.target=new Vector3();
    this.facing=new Vector3();
    this.motion=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    void load(appearance).then(({design})=>{
      if(this.disposed)return;
      this.figure=mountCompanionFigure(document,design.avatarModel);
      this.figure.root.visible=false;
      scene.add(this.figure.root);
    }).catch(()=>{});
  }
  setSpeechLevel(level){
    this.level=Number.isFinite(level)?Math.round(4*Math.max(0,Math.min(1,level)))/4:0;
    this.speechAt=performance.now();
  }
  get object(){return this.figure?.root.visible?this.figure.root:null;}
  update({position,yaw=0,outdoor,table,visible,seconds}){
    const root=this.figure?.root;
    if(!root)return;
    root.visible=Boolean(position&&visible);
    if(!root.visible){this.previous=null;return;}
    const now=performance.now();
    const small=Boolean(table?.active);
    const scale=small?.33:1;
    const angle=outdoor?toroidalRotation(position,yaw):root.quaternion.identity().setFromAxisAngle(localUp,yaw);
    const step=small?.3:1.12;
    this.target.copy(position).add(this.relative.set(step,.13*scale,.45*step).applyQuaternion(angle));
    if(small){
      table.bounds.clampPoint(this.target,this.target);
      if(Math.hypot(this.target.x-position.x,this.target.z-position.z)<.19){
        const towardCenter=(table.bounds.min.x+table.bounds.max.x)/2-position.x;
        this.target.x=position.x+(towardCenter>=0?.27:-.27);
        table.bounds.clampPoint(this.target,this.target);
      }
    }
    if(!this.previous||this.previous!==scale||root.position.distanceToSquared(this.target)>9)root.position.copy(this.target);
    else root.position.lerp(this.target,1-Math.exp(-Math.max(0,seconds)*7));
    root.scale.setScalar(scale);
    this.previous=scale;
    root.up.set(0,1,0);
    if(outdoor)root.up.applyQuaternion(angle);
    this.facing.copy(position).addScaledVector(root.up,.13*scale);
    if(root.position.distanceToSquared(this.facing)>.0004)root.lookAt(this.facing);
    const moving=!this.motion.matches&&!this.document.hidden;
    const level=moving&&now-(this.speechAt??-Infinity)<300?this.level:0;
    this.figure.pose(moving?now/155:0,level);
  }
  dispose(){this.disposed=true;this.figure?.dispose();}
}
