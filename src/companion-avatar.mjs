import {AnimationMixer, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AVATARS} from './avatar-registry.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';

const appearance='compaii-navegante-white-v1';
const localUp=new Vector3(0,1,0);
const jawTravel=12/515;

async function loadFigure(url){
  const {scene:root,animations}=await new GLTFLoader().loadAsync(url.href);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(object=>{
    if(!object.isMesh)return;
    geometries.add(object.geometry);
    for(const material of [object.material].flat()){
      materials.add(material);
      if(material.map){
        textures.add(material.map);
        material.transparent=false;
        material.depthWrite=true;
        material.alphaTest=.35;
      }
    }
  });
  const mixer=new AnimationMixer(root);
  const dispose=()=>{
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    root.removeFromParent();
    for(const resources of [geometries,materials,textures]){
      for(const resource of resources)resource.dispose();
    }
  };
  const idle=animations.find(clip=>clip.name==='calm');
  const hinge=root.getObjectByName('anchor-mouth');
  if(!idle||!hinge){
    dispose();
    throw Error('Invalid Navegante asset');
  }
  mixer.clipAction(idle).play();
  const jawHeight=hinge.position.y;
  return {root,dispose,pose(seconds,level){
    mixer.setTime(seconds % idle.duration);
    hinge.position.y=jawHeight-jawTravel*level;
    hinge.rotation.z=-.035*level;
  }};
}

export class CompanionAvatar{
  constructor({scene,document,base}){
    Object.assign(this,{scene,document});
    this.relative=new Vector3();
    this.target=new Vector3();
    this.facing=new Vector3();
    this.motion=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    void loadFigure(new URL(AVATARS[appearance].model,base)).then(figure=>{
      if(this.disposed){figure.dispose();return;}
      this.figure=figure;
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
    this.figure.pose(moving?now/1000:0,level);
  }
  dispose(){this.disposed=true;this.figure?.dispose();}
}
