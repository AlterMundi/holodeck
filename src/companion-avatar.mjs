import {Quaternion, Ray, Vector3} from 'three';
import {AVATARS} from './avatar-registry.mjs';
import {toroidalRotation} from './toroidal-locomotion.mjs';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation,terrainFrame} from './toroidal-terrain.mjs';
import {MatterHologram,matterAvatarScale} from './matter-flight.mjs';
import {TabletopCompanionPerch} from './tabletop-companion-perch.mjs';
import {COMPANION_BODY,avatarMedium,exteriorSample,immersion} from './avatar-medium.mjs';
import {Follower,clamp,ease} from './avatar-motion-curves.mjs';
import {loadCompanionFigure} from './companion-figure.mjs';
import {CompanionRoomClearance} from './companion-room-clearance.mjs';
import {CompanionTransfer} from './companion-transfer.mjs';

const appearance='compaii-navegante-white-v1';
const localUp=new Vector3(0,1,0);
const localForward=new Vector3(0,0,1);
const floatDraft=.86;
const maximumFollowSpeed=9.2;
// A jump is over before the companion would finish its own launch.
const unsupportedPatience=.75;
const probeLift=.45,probeReach=1.05;

export function companionWaterPitch(water,speed,verticalSpeed){
  if(!water)return 0;
  const advance=Math.min(1,Math.max(0,speed/2));
  if(water==='surface')return .12+.29*advance;
  const vertical=Math.max(-1,Math.min(1,verticalSpeed/2.8));
  return .47+.43*advance-.34*vertical;
}

export class CompanionAvatar{
  constructor({scene,document,base}){
    Object.assign(this,{scene,document});
    this.relative=new Vector3();
    this.followAngle=new Quaternion();
    this.followVelocity=new Vector3();
    this.lastVelocity=new Vector3();
    this.wantedVelocity=new Vector3();
    this.leaderVelocity=new Vector3();
    this.lastLeader=new Vector3();
    this.velocityChange=new Vector3();
    this.facingDirection=new Vector3();
    this.attentionPoint=new Vector3();
    this.perch=new TabletopCompanionPerch();
    this.roomClearance=new CompanionRoomClearance();
    this.transfer=new CompanionTransfer(scene);
    this.target=new Vector3();
    this.direction=new Vector3();
    this.heading=new Vector3();
    this.side=new Vector3();
    this.groundRay=new Ray();
    this.localHeading=new Quaternion();
    this.turning=new Follower(8.5);
    this.accelerating=new Follower(7);
    this.motion=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    this.visibilityChanged=()=>{if(document.hidden)this.previous=null;};
    document.addEventListener('visibilitychange',this.visibilityChanged);
    this.place=(point,up)=>this.settle(point,up);
    const asset=AVATARS[appearance];
    const model=new URL(asset.model,base);
    model.searchParams.set('v',asset.modelSha256);
    void loadCompanionFigure(model).then(figure=>{
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
    this.level=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
    this.speechAt=performance.now();
  }
  get object(){return this.figure?.root.visible?this.figure.root:null;}

  // Height from a point to the support under it. Authored surfaces are
  // preferred when they are in reach. Elsewhere outside, use the terrain.
  support(point,up){
    this.groundRay.origin.copy(point).addScaledVector(up,probeLift);
    this.groundRay.direction.copy(up).negate();
    const hit=this.colliders?.raycastFirst(this.groundRay,probeReach);
    if(hit&&up.dot(hit[1])>.55)return probeLift-hit[0];
    if(!this.outdoor)return null;
    const {u,v,height}=terrainCoordinates([point.x,point.y,point.z]);
    return terrainElevation(u,v)-height;
  }
  settle(point,up){
    const offset=this.support(point,up);
    if(offset!==null&&Math.abs(offset)<.5)point.addScaledVector(up,offset);
  }

  update({position,yaw=0,outdoor,table,gaze,gazeMesh,eye,visible,seconds,water=null,grounded=true,explicitFlight=false,crouch=false,colliders}){
    const root=this.figure?.root;
    if(!root)return;
    root.visible=Boolean(position&&visible);
    if(!root.visible){
      this.transfer.cancel();this.roomClearance.reset();this.previous=null;
      this.attention=null;this.perch.clear();this.figure.resetGlance();return;
    }
    const now=performance.now();
    const small=Boolean(table?.active);
    this.colliders=colliders;
    this.outdoor=outdoor;
    if(!outdoor||small)water=null;
    const dt=Math.min(.1,Math.max(0,seconds));
    this.unsupported=grounded||water?0:(this.unsupported??0)+dt;
    // Stay airborne with a descending player until they touch ground.
    const flying=small||outdoor&&(explicitFlight||this.unsupported>(this.aloft?0:unsupportedPatience));
    this.aloft=flying&&!small;
    const diving=water==='submerged';
    const avoidFurniture=!small&&!outdoor&&colliders?.raycastFirst;
    const scale=small?matterAvatarScale:1;
    if(this.previousTable!==small){
      this.transfer.cancel();
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
    const samePlace=this.previous===scale&&this.previousOutdoor===outdoor;
    if(!samePlace){this.followYaw=yaw;this.roomClearance.reset();}
    const angle=this.followAngle.setFromAxisAngle(localUp,this.followYaw??yaw).premultiply(frame);
    const step=(small?1.36:1.35)*scale;
    const moving=!this.motion.matches&&!this.document.hidden;
    const height=(diving?.25:flying?.16:water?0:-.037)*scale;
    this.target.copy(position).add(this.relative.set(step,height,.45*step).applyQuaternion(angle));
    if(avoidFurniture&&!this.roomClearance.chooseTarget(position,this.target,colliders,grounded||!samePlace)){
      root.visible=false;
      this.transfer.cancel();
      return;
    }
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
    const separated=root.position.distanceToSquared(this.target)>(explicitFlight?33:flying?16:13)**2;
    if(!samePlace||!moving||small)this.transfer.cancel();
    else if(!this.transfer.active&&(separated||
        avoidFurniture&&grounded&&this.roomClearance.needsTransfer(root.position,this.target,dt)))this.transfer.begin();
    const relocated=this.transfer.advance(dt);
    if(relocated)this.roomClearance.reset();
    const reset=!samePlace||relocated||separated&&(small||!moving);
    root.up.copy(localUp).applyQuaternion(frame);
    this.lastVelocity.copy(this.followVelocity);
    // Anticipate part of the player's pace. Matching all of it would run past
    // them at every stop.
    this.direction.subVectors(position,this.lastLeader);
    this.lastLeader.copy(position);
    if(reset||!moving||small||dt<=0||this.direction.length()>Math.max(1.5,(explicitFlight?42:14)*dt))this.leaderVelocity.set(0,0,0);
    else{
      this.direction.addScaledVector(root.up,-this.direction.dot(root.up)).divideScalar(dt);
      this.leaderVelocity.lerp(this.direction,ease(dt,6));
    }
    const gliding=this.medium==='air',swimming=this.medium==='surface'||this.medium==='submerged';
    if(reset||!moving){
      root.position.copy(this.target);
      this.followVelocity.set(0,0,0);
      this.followResting=true;
    }else if(this.transfer.active){
      this.followVelocity.set(0,0,0);
    }else if(dt>0){
      this.direction.subVectors(this.target,root.position);
      const vertical=this.direction.dot(root.up);
      this.direction.addScaledVector(root.up,-vertical);
      const distance=this.direction.length();
      const deadZone=(small?.22:.25)*scale;
      const pace=this.leaderVelocity.length();
      const groundFollow=!small&&!flying&&!water&&!swimming;
      const speedLimit=small?5.2*scale:swimming?5.4:
        explicitFlight?clamp(pace+4,maximumFollowSpeed,29):outdoor?maximumFollowSpeed:clamp(pace+1.4,6.4,maximumFollowSpeed);
      const braking=small?6*scale*1.4:groundFollow?14:explicitFlight?24:gliding?9.5:10;
      const curve=groundFollow?12:small?braking*.85:braking;
      this.followVelocity.addScaledVector(root.up,-this.followVelocity.dot(root.up));
      if(groundFollow){
        if(distance>.55||pace>.35)this.followResting=false;
        else if(distance<=deadZone&&this.followVelocity.lengthSq()<.15**2)this.followResting=true;
      }else this.followResting=false;
      const gap=this.followResting?0:Math.max(0,distance-deadZone);
      // Leave enough room to brake over the next realised step.
      const reserve=groundFollow||small?curve*dt:0;
      const approach=Math.min(speedLimit,Math.sqrt(2*curve*gap+reserve*reserve)-reserve);
      this.wantedVelocity.copy(this.direction).setLength(approach);
      if(!groundFollow&&pace>.2)this.wantedVelocity.addScaledVector(this.leaderVelocity,explicitFlight?.85:.25).clampLength(0,speedLimit);
      const accelerating=this.followVelocity.dot(this.wantedVelocity)>=this.followVelocity.lengthSq();
      const acceleration=small?4.5*scale*1.4:explicitFlight?39:7.5;
      this.velocityChange.subVectors(this.wantedVelocity,this.followVelocity)
        .clampLength(0,dt*(accelerating?acceleration:braking));
      this.followVelocity.add(this.velocityChange);
      let travel=this.followVelocity.length()*dt;
      if(!groundFollow&&(distance<1e-6||travel>distance&&this.followVelocity.dot(this.direction)>0))
        travel=Math.min(travel,distance);
      if(travel>0){
        this.relative.copy(root.position).addScaledVector(this.followVelocity,travel/this.followVelocity.length());
        if(small&&this.perch.blocked(root.position,this.relative)||
            avoidFurniture&&!this.roomClearance.step(root.position,this.relative,colliders)){
          this.followVelocity.set(0,0,0);
          travel=0;
        }else{
          // Clipping and detours must update the velocity used on the next frame.
          this.followVelocity.subVectors(this.relative,root.position).divideScalar(dt);
          travel=this.followVelocity.length()*dt;
          root.position.copy(this.relative);
        }
      }else this.followVelocity.set(0,0,0);
      if(flying||diving)rise=vertical*ease(dt,vertical<-1?9:5);
      root.position.addScaledVector(root.up,rise);
      if(small)table.bounds.clampPoint(root.position,root.position);
      speed=travel/(dt*scale);
      if(!small){
        // Leave the player room when a turn brings the two paths together.
        this.direction.subVectors(root.position,position);
        this.direction.addScaledVector(root.up,-this.direction.dot(root.up));
        const room=this.direction.length();
        if(room<.8&&room>1e-4){
          this.relative.copy(root.position).addScaledVector(this.direction,(.8-room)/room*ease(dt,9));
          if(!avoidFurniture||this.roomClearance.clear(root.position,this.relative,colliders))root.position.copy(this.relative);
        }
      }
    }
    let contact=false,sample=null;
    if(!small){
      if(outdoor){
        const {u,v}=terrainCoordinates(root.position.toArray());
        root.up.fromArray(terrainFrame(u,v).up);
        sample=exteriorSample(root.position);
        if(diving){
          // Keep between the bed and the floating line at the robot's own place.
          const low=sample.ground+.04,high=TOROIDAL_TERRAIN.waterLevel-floatDraft;
          root.position.addScaledVector(root.up,clamp(sample.feet,low,Math.max(low,high))-sample.feet);
        }
      }
      if(!flying&&!diving){
        let offset=this.support(root.position,root.up);
        const float=sample?TOROIDAL_TERRAIN.waterLevel-floatDraft-sample.feet:-Infinity;
        if(offset===null)offset=this.direction.subVectors(this.target,root.position).dot(root.up);
        offset=Math.max(offset,float);
        // Steps and shallow slopes settle in a few frames. A real drop or a
        // surfacing is followed as travel and shows as air or water.
        const settled=reset||!moving||Math.abs(offset)<.02;
        const limit=Math.max(Math.abs(offset)*ease(dt,18),speed*dt*1.2);
        const correction=settled?offset:clamp(offset,-Math.max(limit,4.2*dt*Number(offset<-.5)),limit);
        root.position.addScaledVector(root.up,correction);
        contact=Math.abs(offset-correction)<.5;
        if(Math.abs(offset)>.5)rise=correction;
      }
      if(sample)sample=exteriorSample(root.position);
    }
    const supported=contact&&!flying&&!diving;
    const measured=sample??{feet:0,ground:0,waterLevel:-Infinity};
    const candidate=avatarMedium(COMPANION_BODY,measured,{supported,previous:this.medium});
    if(reset||!moving||!this.medium)Object.assign(this,{medium:candidate,mediumDwell:0});
    else if(candidate===this.medium)this.mediumDwell=0;
    else if((this.mediumDwell+=dt)>=.08)Object.assign(this,{medium:candidate,mediumDwell:0});

    root.scale.setScalar(scale);
    this.previous=scale;
    this.previousOutdoor=outdoor;
    this.face({root,position,point,small,speed,reset,moving,dt});
    this.forward=this.facingDirection.copy(localForward).applyQuaternion(root.quaternion);
    const acceleration=dt>0&&!reset&&moving?
      (this.followVelocity.dot(this.forward)-this.lastVelocity.dot(this.forward))/(dt*scale):0;
    const thrust=this.accelerating.update(acceleration,reset||!moving?10:dt);
    const turnRate=moving&&!reset?this.turning.velocity:0;
    const airborne=this.medium==='air',wet=this.medium==='surface'||this.medium==='submerged';
    const pitch=wet?companionWaterPitch(this.medium,moving?speed:0,moving&&dt>0?rise/dt:0):
      airborne?clamp(.44*clamp(speed/6.5)+.030*thrust-(dt>0?.035*rise/(dt*scale):0)*clamp(speed/2),-.30,.72):
        clamp(.014*thrust,-.12,.10);
    const bank=small&&speed<.2?0:airborne?clamp(-turnRate*(.07+.055*speed),-.52,.52):
      wet?clamp(-turnRate*.10,-.30,.30):clamp(-turnRate*speed*.022,-.17,.17);
    const level=moving&&now-(this.speechAt??-Infinity)<300?this.level:0;
    const strolling=small?gaze:point||null;
    if(reset&&!small&&moving&&!relocated)this.figure.greet();
    this.figure.pose({seconds:dt,level,speed,velocity:this.followVelocity,motion:moving,medium:small?'air':this.medium,
      wading:sample?immersion(COMPANION_BODY,measured):0,gaze:strolling,attending:Boolean(point||small&&gaze),reset,
      liftAllowed:flying,place:this.place,pitch,bank,crouch:crouch&&supported?1:0,braking:Math.max(0,-thrust),miniature:small});
    this.transfer.paint(root,relocated);
  }

  // A glance leads, the body follows when the subject is well to one side.
  face({root,position,point,small,speed,reset,moving,dt}){
    const {up}=root;
    const look=point||(small&&this.perch.ready?this.perch.center:null);
    if(reset||!moving||speed>=.55){
      this.travelHeading=speed>=.55;
      this.headingStill=0;
    }else if(speed<=.35){
      this.headingStill+=dt;
      if(this.headingStill>=.18)this.travelHeading=false;
    }else this.headingStill=0;
    const travelling=this.travelHeading&&speed>.35&&this.followVelocity.lengthSq()>1e-6;
    const waitingToFace=moving&&!reset&&!travelling&&this.headingStill<.35;
    this.facingDirection.copy(look&&!(travelling&&!small)?this.direction.subVectors(look,root.position):
      travelling?this.followVelocity:waitingToFace?this.heading:this.direction.subVectors(position,root.position));
    this.facingDirection.addScaledVector(up,-this.facingDirection.dot(up));
    this.heading.addScaledVector(up,-this.heading.dot(up));
    if(this.facingDirection.lengthSq()<4e-4)this.facingDirection.copy(this.heading);
    else this.facingDirection.normalize();
    if(this.heading.lengthSq()<.01||reset||!moving){
      if(this.facingDirection.lengthSq()>.01)this.heading.copy(this.facingDirection);
      else this.heading.set(0,0,1).addScaledVector(up,-up.z);
      this.turning.reset();
      this.turnEngaged=false;
    }else{
      this.heading.normalize();
      const residual=Math.atan2(up.dot(this.side.crossVectors(this.heading,this.facingDirection)),
        this.heading.dot(this.facingDirection));
      if(travelling||small)this.turnEngaged=true;
      else if(Math.abs(residual)>.55)this.turnEngaged=true;
      else if(Math.abs(residual)<.05&&Math.abs(this.turning.velocity)<.1)this.turnEngaged=false;
      this.turning.value=0;
      const advance=this.turning.update(this.turnEngaged?residual:0,dt,travelling?8.5:6);
      const turnLimit=(travelling?300:200)*Math.PI/180;
      this.turning.velocity=clamp(this.turning.velocity,-turnLimit,turnLimit);
      this.heading.applyAxisAngle(up,clamp(advance,-turnLimit*dt,turnLimit*dt));
    }
    this.heading.normalize();
    // lookAt uses the current up, which follows the ring at this place.
    root.lookAt(this.direction.copy(root.position).add(this.heading));
  }
  dispose(){
    this.disposed=true;
    this.document.removeEventListener('visibilitychange',this.visibilityChanged);
    this.hologram?.restore();
    this.transfer.dispose();
    this.figure?.dispose();
  }
}
