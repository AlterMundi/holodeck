import {AnimationClip, AnimationMixer, Quaternion, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {AVATARS} from './avatar-registry.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {MatterHologram,matterAvatarScale} from './matter-flight.mjs';
import {TabletopGlance} from './tabletop-attention.mjs';
import {TabletopCompanionPerch} from './tabletop-companion-perch.mjs';

const appearance='compaii-navegante-white-v1';
const localUp=new Vector3(0,1,0);
const jawTravel=12/515;
const strideDistance=.396;
const followAcceleration=4.5;
const followDeceleration=6;
const maximumFollowSpeed=8.5;

async function loadFigure(url){
  const {scene:root,animations}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url.href);
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
      if(material.normalMap)textures.add(material.normalMap);
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
  const glance=new TabletopGlance();
  const head=root.getObjectByName('head');
  const idle=animations.find(clip=>clip.name==='calm');
  const walk=animations.find(clip=>clip.name==='walk');
  const hover=animations.find(clip=>clip.name==='hover');
  const glide=animations.find(clip=>clip.name==='glide');
  const lift=animations.find(clip=>clip.name==='lift');
  const landing=animations.find(clip=>clip.name==='landing');
  const hinge=root.getObjectByName('anchor-mouth');
  if(!idle||!hinge){
    dispose();
    throw Error('Invalid Navegante asset');
  }
  const driven=new Set([walk,hover,glide,lift,landing].flatMap(clip=>clip?.tracks.map(track=>track.name)??[]));
  const face=new AnimationClip('calm-overlay',idle.duration,idle.tracks.filter(track=>!driven.has(track.name)));
  const body=new AnimationClip('calm-base',idle.duration,idle.tracks.filter(track=>driven.has(track.name)));
  mixer.clipAction(face).play();
  const still=body.tracks.length?mixer.clipAction(body).play():null;
  const stride=walk?mixer.clipAction(walk).play():null;
  if(stride)stride.setEffectiveWeight(0).paused=true;
  const hovering=hover?mixer.clipAction(hover).setEffectiveWeight(0).play():null;
  const gliding=glide?mixer.clipAction(glide).setEffectiveWeight(0).play():null;
  const edges=new Map([[true,lift],[false,landing]].map(([key,clip])=>{
    const action=clip?mixer.clipAction(clip).setEffectiveWeight(0).play():null;
    if(action)action.paused=true;
    return [key,{action,time:Infinity,weight:0}];
  }));
  // The new armature keeps Blender's Z-up axes inside the Y-up GLB.
  // The prior object-joint asset used Y-up local axes.
  const vertical=hinge.isBone?'z':'y', hingeAxis=hinge.isBone?'x':'z';
  const jawHeight=hinge.position[vertical], jawAngle=hinge.rotation[hingeAxis];
  let walking=0,floating=0,cruising=0,phase=0,priorAir;
  return {root,dispose,resetGlance:()=>glance.reset(),pose(seconds,level,speed,motion,airborne,gaze,resetEdge,liftAllowed){
    glance.restore();
    const step=Math.min(.05,Math.max(0,seconds));
    const fade=motion?1-Math.exp(-step*10):1;
    const resetTransition=!motion||resetEdge||priorAir===undefined;
    if(!resetTransition&&priorAir!==airborne){
      edges.get(priorAir).time=Infinity;
      if(!airborne||liftAllowed)edges.get(airborne).time=0;
    }
    priorAir=airborne;
    let totalEdgeWeight=0;
    for(const edge of edges.values()){
      if(!edge.action)continue;
      if(resetTransition){
        edge.time=Infinity;
        edge.weight=0;
      }
      const duration=edge.action.getClip().duration;
      let targetWeight=0;
      if(edge.time<duration){
        targetWeight=Math.sin(Math.PI*edge.time/duration)**.75*.89;
        edge.action.time=edge.time;
        edge.time+=step;
      }
      edge.weight+=(targetWeight-edge.weight)*(1-Math.exp(-step*20));
      totalEdgeWeight+=edge.weight;
    }
    for(const edge of edges.values())edge.action?.setEffectiveWeight(edge.weight/Math.max(1,totalEdgeWeight));
    const idleWeight=1-Math.min(1,totalEdgeWeight);
    const airborneWeight=hovering&&airborne?1:0;
    const groundStride=Math.min(1,Math.max(0,(speed-.06)/.18));
    const forwardFlight=motion&&gliding?Math.min(1,Math.max(0,(speed-.12)/.8)):0;
    const cruisingGoal=airborneWeight*forwardFlight;
    const floatingGoal=airborneWeight*(1-forwardFlight);
    const walkGoal=motion&&!airborne?groundStride:0;
    walking+=(walkGoal-walking)*fade;
    floating+=(floatingGoal-floating)*fade;
    cruising+=(cruisingGoal-cruising)*fade;
    if(walking<.02&&!walkGoal)phase=0;
    else phase=(phase+Math.min(speed,1.45)*step/strideDistance)%1;
    hovering?.setEffectiveWeight(floating*idleWeight);
    gliding?.setEffectiveWeight(cruising*idleWeight);
    still?.setEffectiveWeight(Math.max(0,1-walking-floating-cruising)*idleWeight);
    if(stride){
      stride.setEffectiveWeight(walking*idleWeight);
      stride.time=phase*walk.duration;
    }
    if(motion)mixer.update(step);
    else mixer.setTime(0);
    if(motion)glance.apply(root,head,gaze,step,1-cruising*.7);
    else glance.reset();
    hinge.position[vertical]=jawHeight-jawTravel*level;
    hinge.rotation[hingeAxis]=jawAngle+(hinge.isBone?.10:-.035)*level;
  }};
}

export class CompanionAvatar{
  constructor({scene,document,base}){
    Object.assign(this,{scene,document});
    this.relative=new Vector3();
    this.followAngle=new Quaternion();
    this.followVelocity=new Vector3();
    this.wantedVelocity=new Vector3();
    this.velocityChange=new Vector3();
    this.facingDirection=new Vector3();
    this.attentionPoint=new Vector3();
    this.perch=new TabletopCompanionPerch();
    this.target=new Vector3();
    this.facing=new Vector3();
    this.direction=new Vector3();
    this.previousHeading=new Quaternion();
    this.localHeading=new Quaternion();
    this.motion=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    this.visibilityChanged=()=>{if(document.hidden)this.previous=null;};
    document.addEventListener('visibilitychange',this.visibilityChanged);
    const asset=AVATARS[appearance];
    const model=new URL(asset.model,base);
    model.searchParams.set('v',asset.modelSha256);
    void loadFigure(model).then(figure=>{
      if(this.disposed){figure.dispose();return;}
      this.figure=figure;
      this.hologram=new MatterHologram(figure.root,{depthWrite:true});
      this.figure.root.visible=false;
      scene.add(this.figure.root);
    }).catch(error=>{console.warn('The companion avatar could not be loaded.',error);});
  }
  attend(resolve,mesh){
    this.attention={resolve,mesh,until:performance.now()+4500};
  }

  setSpeechLevel(level){
    this.level=Number.isFinite(level)?Math.round(4*Math.max(0,Math.min(1,level)))/4:0;
    this.speechAt=performance.now();
  }
  get object(){return this.figure?.root.visible?this.figure.root:null;}
  update({position,yaw=0,outdoor,table,gaze,gazeMesh,eye,visible,seconds,grounded=true,explicitFlight=false}){
    const root=this.figure?.root;
    if(!root)return;
    root.visible=Boolean(position&&visible);
    if(!root.visible){this.previous=null;this.attention=null;this.perch.clear();this.figure.resetGlance();return;}
    const now=performance.now();
    const small=Boolean(table?.active);
    const wantsGround=grounded&&!small;
    const scale=small?matterAvatarScale:1;
    if(this.previousTable!==small){
      if(small)this.hologram.sync();
      else this.hologram.restore();
      this.previousTable=small;
      this.perch.clear();
    }
    const resolve=this.attention?.resolve;
    const point=resolve&&this.attention.until>now&&resolve(this.attentionPoint);
    if(!point)this.attention=null;
    // Choose the side on arrival and carry it with the local terrain frame.
    // Looking around with a stationary player must not move the companion.
    const frame=outdoor?toroidalRotation(position,0,this.localHeading):this.localHeading.identity();
    if(this.previous!==scale||this.previousOutdoor!==outdoor)this.followYaw=yaw;
    const angle=this.followAngle.setFromAxisAngle(localUp,this.followYaw??yaw).premultiply(frame);
    const step=(small?1.36:1.35)*scale;
    const moving=!this.motion.matches&&!this.document.hidden;
    const samePlace=this.previous===scale&&this.previousOutdoor===outdoor;
    this.catchup=Boolean(wantsGround&&samePlace&&moving&&
      this.followVelocity.length()>(this.catchup?1.05:1.6));
    const height=(wantsGround&&!this.catchup?-.037:.13)*scale;
    this.target.copy(position).add(this.relative.set(step,height,.45*step).applyQuaternion(angle));
    if(small){
      table.bounds.clampPoint(this.target,this.target);
      if(Math.hypot(this.target.x-position.x,this.target.z-position.z)<scale*.8){
        const towardCenter=(table.bounds.min.x+table.bounds.max.x)/2-position.x;
        this.target.x=position.x+(towardCenter>=0?1.16:-1.16)*scale;
        table.bounds.clampPoint(this.target,this.target);
      }
      const focusMesh=(point&&this.attention?.mesh)||gazeMesh;
      if(moving&&focusMesh&&samePlace)this.perch.apply(this.target,root.position,position,eye,focusMesh,table.bounds,this.scene);
      else this.perch.clear();
    }
    let speed=0,rise=0;
    const reset=!this.previous||this.previous!==scale||this.previousOutdoor!==outdoor||root.position.distanceToSquared(this.target)>121;
    const dt=Math.min(.05,Math.max(0,seconds));
    root.up.copy(localUp).applyQuaternion(frame);
    if(reset||!moving){
      root.position.copy(this.target);
      this.followVelocity.set(0,0,0);
    }else if(dt>0){
      this.direction.subVectors(this.target,root.position);
      const vertical=this.direction.dot(root.up);
      this.direction.addScaledVector(root.up,-vertical);
      const distance=this.direction.length();
      const deadZone=(small?.22:.25)*scale;
      const speedLimit=small?5.2*scale:outdoor?maximumFollowSpeed:4;
      const approach=Math.min(speedLimit,Math.sqrt(2*followDeceleration*Math.max(0,distance-deadZone)));
      this.wantedVelocity.copy(this.direction).setLength(approach);
      this.followVelocity.addScaledVector(root.up,-this.followVelocity.dot(root.up));
      const accelerating=this.followVelocity.dot(this.wantedVelocity)>=this.followVelocity.lengthSq();
      this.velocityChange.subVectors(this.wantedVelocity,this.followVelocity)
        .clampLength(0,dt*(small?scale*1.4:1)*(accelerating?followAcceleration:followDeceleration));
      this.followVelocity.add(this.velocityChange);
      let travel=Math.min(distance,this.followVelocity.length()*dt);
      if(travel>0){
        this.relative.copy(root.position).addScaledVector(this.followVelocity,travel/this.followVelocity.length());
        if(small&&this.perch.blocked(root.position,this.relative)){
          this.followVelocity.set(0,0,0);
          travel=0;
        }else root.position.copy(this.relative);
      }
      rise=vertical*(1-Math.exp(-dt*5));
      root.position.addScaledVector(root.up,rise);
      if(small)table.bounds.clampPoint(root.position,root.position);
      speed=Math.hypot(travel,rise*.65)/(dt*scale);
    }
    const elevation=this.direction.subVectors(root.position,position).dot(root.up)/scale;
    const airCandidate=!wantsGround||this.catchup||elevation>(this.visualAirborne?.045:.11);
    if(reset||!moving){
      this.visualAirborne=airCandidate;
      this.airDwell=0;
    }else if(this.visualAirborne===airCandidate)this.airDwell=0;
    else{
      this.airDwell+=dt;
      if(this.airDwell>=.10){
        this.visualAirborne=airCandidate;
        this.airDwell=0;
      }
    }
    root.scale.setScalar(scale);
    this.previous=scale;
    this.previousOutdoor=outdoor;
    this.facing.copy(position).addScaledVector(root.up,height);
    this.facingDirection.copy(this.followVelocity).addScaledVector(root.up,-this.followVelocity.dot(root.up));
    const look=point||(small&&this.perch.ready?this.perch.center:null);
    if(look){
      this.facingDirection.subVectors(look,root.position);
      this.facingDirection.addScaledVector(root.up,-this.facingDirection.dot(root.up));
      this.facing.copy(root.position).add(this.facingDirection);
    }
    else if(speed>.25&&this.facingDirection.lengthSq()>1e-4)this.facing.copy(root.position).add(this.facingDirection);
    if(root.position.distanceToSquared(this.facing)>.0004){
      this.previousHeading.copy(root.quaternion);
      root.lookAt(this.facing);
      if(!reset&&moving)root.quaternion.slerp(this.previousHeading,Math.exp(-Math.max(0,seconds)*5));
    }
    const level=moving&&now-(this.speechAt??-Infinity)<300?this.level:0;
    const liftAllowed=explicitFlight||this.catchup||small||rise>.12*dt*scale;
    this.figure.pose(seconds,level,speed,moving,this.visualAirborne,small?gaze:null,reset,liftAllowed);
  }
  dispose(){
    this.disposed=true;
    this.document.removeEventListener('visibilitychange',this.visibilityChanged);
    this.hologram?.restore();
    this.figure?.dispose();
  }
}
