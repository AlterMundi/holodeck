import {AnimationClip, AnimationMixer, Quaternion, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AVATARS} from './avatar-registry.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';

const appearance='compaii-navegante-white-v1';
const localUp=new Vector3(0,1,0);
const jawTravel=12/515;
const strideSpeed=.424; // 198 mm of planted travel over half a 28-frame walk cycle.

async function loadFigure(url){
  const {scene:root,animations}=await new GLTFLoader().loadAsync(url.href);
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root.traverse(object=>{
    if(!object.isMesh)return;
    if(object.isSkinnedMesh){
      skeletons.add(object.skeleton);
      object.computeBoundingSphere();
      object.boundingSphere.radius+=.25;
    }
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
    for(const resources of [geometries,materials,textures,skeletons]){
      for(const resource of resources)resource.dispose();
    }
  };
  const idle=animations.find(clip=>clip.name==='calm');
  const walk=animations.find(clip=>clip.name==='walk');
  const hinge=root.getObjectByName('anchor-mouth');
  if(!idle||!hinge){
    dispose();
    throw Error('Invalid Navegante asset');
  }
  const driven=new Set(walk?.tracks.map(track=>track.name));
  const face=new AnimationClip('calm-overlay',idle.duration,idle.tracks.filter(track=>!driven.has(track.name)));
  const body=new AnimationClip('calm-base',idle.duration,idle.tracks.filter(track=>driven.has(track.name)));
  mixer.clipAction(face).play();
  const still=body.tracks.length?mixer.clipAction(body).play():null;
  const stride=walk?mixer.clipAction(walk).play():null;
  stride?.setEffectiveWeight(0);
  // The new armature keeps Blender's Z-up axes inside the Y-up GLB.
  // The prior object-joint asset used Y-up local axes.
  const vertical=hinge.isBone?'z':'y', hingeAxis=hinge.isBone?'x':'z';
  const jawHeight=hinge.position[vertical], jawAngle=hinge.rotation[hingeAxis];
  let walking=0;
  return {root,dispose,pose(seconds,level,speed,motion){
    const step=Math.min(.05,Math.max(0,seconds));
    const weight=motion?Math.min(1,Math.max(0,(speed-.12)/.7)):0;
    walking=motion?walking+(weight-walking)*(1-Math.exp(-step*12)):0;
    still?.setEffectiveWeight(1-walking);
    stride?.setEffectiveWeight(walking).setEffectiveTimeScale(Math.max(.7,Math.min(3.4,speed/strideSpeed)));
    if(motion)mixer.update(step);
    else mixer.setTime(0);
    hinge.position[vertical]=jawHeight-jawTravel*level;
    hinge.rotation[hingeAxis]=jawAngle+(hinge.isBone?.10:-.035)*level;
  }};
}

export class CompanionAvatar{
  constructor({scene,document,base}){
    Object.assign(this,{scene,document});
    this.relative=new Vector3();
    this.target=new Vector3();
    this.facing=new Vector3();
    this.direction=new Vector3();
    this.previousHeading=new Quaternion();
    this.localHeading=new Quaternion();
    this.motion=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    const asset=AVATARS[appearance];
    const model=new URL(asset.model,base);
    model.searchParams.set('v',asset.modelSha256);
    void loadFigure(model).then(figure=>{
      if(this.disposed){figure.dispose();return;}
      this.figure=figure;
      this.figure.root.visible=false;
      scene.add(this.figure.root);
    }).catch(error=>{console.warn('The companion avatar could not be loaded.',error);});
  }
  setSpeechLevel(level){
    this.level=Number.isFinite(level)?Math.round(4*Math.max(0,Math.min(1,level)))/4:0;
    this.speechAt=performance.now();
  }
  get object(){return this.figure?.root.visible?this.figure.root:null;}
  update({position,yaw=0,outdoor,table,visible,seconds,grounded=true}){
    const root=this.figure?.root;
    if(!root)return;
    root.visible=Boolean(position&&visible);
    if(!root.visible){this.previous=null;return;}
    const now=performance.now();
    const small=Boolean(table?.active);
    const canWalk=grounded&&!small;
    const scale=small?.33:1;
    const angle=outdoor?toroidalRotation(position,yaw):this.localHeading.setFromAxisAngle(localUp,yaw);
    const step=small?.3:1.12;
    const height=(canWalk?-.037:.13)*scale;
    this.target.copy(position).add(this.relative.set(step,height,.45*step).applyQuaternion(angle));
    if(small){
      table.bounds.clampPoint(this.target,this.target);
      if(Math.hypot(this.target.x-position.x,this.target.z-position.z)<.19){
        const towardCenter=(table.bounds.min.x+table.bounds.max.x)/2-position.x;
        this.target.x=position.x+(towardCenter>=0?.27:-.27);
        table.bounds.clampPoint(this.target,this.target);
      }
    }
    let speed=0;
    const moving=!this.motion.matches&&!this.document.hidden;
    const reset=!this.previous||this.previous!==scale||root.position.distanceToSquared(this.target)>9;
    root.up.copy(localUp);
    if(outdoor)root.up.applyQuaternion(angle);
    if(reset||!moving)root.position.copy(this.target);
    else if(seconds>0){
      const blend=1-Math.exp(-seconds*7);
      this.direction.subVectors(this.target,root.position);
      this.direction.addScaledVector(root.up,-this.direction.dot(root.up));
      if(canWalk)speed=this.direction.length()*blend/(seconds*scale);
      root.position.lerp(this.target,blend);
    }
    root.scale.setScalar(scale);
    this.previous=scale;
    this.facing.copy(position).addScaledVector(root.up,height);
    if(speed>.18)this.facing.copy(root.position).add(this.direction);
    if(root.position.distanceToSquared(this.facing)>.0004){
      this.previousHeading.copy(root.quaternion);
      root.lookAt(this.facing);
      if(!reset&&moving)root.quaternion.slerp(this.previousHeading,Math.exp(-Math.max(0,seconds)*10));
    }
    const level=moving&&now-(this.speechAt??-Infinity)<300?this.level:0;
    this.figure.pose(seconds,level,speed,moving);
  }
  dispose(){this.disposed=true;this.figure?.dispose();}
}
