import {Euler,Quaternion,Vector3} from 'three';
import {matterAvatarScale} from './matter-flight.mjs';
import {TabletopGlance} from './tabletop-attention.mjs';
import {bindHumanoidFlightRig} from './humanoid-flight-poses.mjs';
import {bindHumanoidCrouch} from './humanoid-crouch.mjs';
import {bindHumanoidStandingIdle} from './humanoid-standing-idle.mjs';
import {groundGaitSample} from './humanoid-ground-gait.mjs';
import {bindHumanoidGroundAccents} from './humanoid-ground-accents.mjs';
import {bindHumanoidMicrophoneMouth} from './humanoid-microphone-mouth.mjs';
import {HUMAN_BODY,avatarMedium,exteriorSample} from './avatar-medium.mjs';
import {Follower,clamp,ease,pulse,smooth} from './avatar-motion-curves.mjs';

const limbNames=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r'];
const pitchAxis=new Vector3(1,0,0);
const yawAxis=new Vector3(0,1,0),rollAxis=new Vector3(0,0,1);
const liftSeconds=.66,landSeconds=.46,hipHeight=1;
const absorbTiming=[.08,.07,.40],brakeTiming=[.08,.04,.34];
const bindings=new WeakMap();

export function bindFlightAvatarAnimation(manager,context,{clock}={}){
  if(bindings.has(manager))return bindings.get(manager);
  const update=manager.update;
  const actors=new Map();
  let previousTime;
  const angles=new Euler(),turn=new Quaternion(),pitch=new Quaternion();
  const displacement=new Vector3(),up=new Vector3(),right=new Vector3(),localAxis=new Vector3();
  const bodyFacing=new Quaternion(),boneFacing=new Quaternion(),bend=new Quaternion();
  const facing=new Vector3(),cross=new Vector3();
  const yaw=new Quaternion(),roll=new Quaternion();
  const pivot=new Vector3(),shift=new Vector3(),tilt=new Quaternion();
  const water={up:new Vector3(),point:new Vector3()};

  // Follow the real heading with a critically damped turn. The physical yaw
  // already answered the input. This eases only what the body shows.
  function followHeading(entry,rotation,step,rate){
    facing.copy(rollAxis).applyQuaternion(rotation);
    // Compare headings on the same radial tangent plane. A changing up
    // direction alone should not look like a steering input.
    entry.heading.addScaledVector(up,-entry.heading.dot(up));
    if(entry.heading.lengthSq()<.01){
      entry.heading.copy(facing);
      entry.turn.reset();
      return 0;
    }
    entry.heading.normalize();
    cross.crossVectors(entry.heading,facing);
    const residual=Math.atan2(up.dot(cross),entry.heading.dot(facing));
    entry.turn.value=0;
    const advance=entry.turn.update(residual,step,rate);
    entry.heading.applyAxisAngle(up,advance);
    return advance-residual;
  }
  function restore(entry){
    entry.glance?.restore();
    entry.mouth?.restore();
    entry.accents?.restore();
    entry.idleRig?.restore();
    for(const [bone,neutral] of entry.modified)bone.quaternion.copy(neutral);
    entry.modified.clear();
    entry.airRig?.restore();
    entry.crouchRig?.restore();
    if(entry.shifted){entry.mesh.position.sub(entry.shift);entry.shifted=false;}
    if(entry.rotation?.equals(entry.applied))entry.rotation.copy(entry.unpitched);
  }
  function resetMotion(entry){
    Object.assign(entry,{weight:0,hoverWeight:0,lowWeight:0,planarSpeed:0,airWeight:0,
      boost:0,boostRelease:0,lowerWeight:0,airTime:0,rise:0,flightAge:0,poseTime:0,observedFlight:false,
      mode:null,poseMode:null,idleDwell:0,idleTime:0,idleWeight:0,
      medium:null,loopTime:0,strokeTime:1.40,wadeWeight:0,phase:0,
      gaitPhase:null,unsupported:0,fall:0,absorbAge:Infinity,absorb:0,brakeAge:Infinity,brake:0,lastSpeed:0});
    for(const follower of [entry.turn,entry.pitch,entry.bank,entry.lift,entry.sink,
      entry.thrust,entry.lean,entry.sway,entry.lead])follower.reset();
    entry.heading.set(0,0,0);
    entry.airRig?.reset();
  }
  function animatedUpdate(state,dt){
    // Remove last frame's extra limb rotations before the base mixer runs.
    for(const entry of actors.values())restore(entry);
    const {outdoor,flying,boosting,grounded:localGrounded,table,crouch,gaze,peerGaze,peerPoses,glanceMotion=true,tabletopPlayers=[],microphoneLevel=null,wake=null}=context();
    const now=clock?.();
    const elapsed=now!==undefined&&previousTime!==undefined?(now-previousTime)/1000:dt;
    previousTime=now;
    const step=Math.min(.15,Math.max(0,elapsed));
    let renderedCharacters;
    for(const [id,actor] of state.characters){
      const entry=actors.get(id);
      if(!entry)continue;
      const isLocal=id===state.localCharacterId;
      const peerPose=isLocal?null:peerPoses?.get(id);
      const atTable=isLocal?table:tabletopPlayers.has?.(id)||tabletopPlayers.includes?.(id);
      const onGround=isLocal?localGrounded:actor.animationState>=0&&actor.animationState<=2||actor.animationState===5;
      const followTravel=glanceMotion&&onGround&&!atTable&&!entry.table&&
        !(isLocal?crouch||flying:peerPose==='crouch'||peerPose==='fly'||peerPose==='fly-fast')&&
        (!outdoor||entry.medium==='ground')&&elapsed<=.15;
      const character=this.loadedCharacters.get(id)?.character;
      if(character?.getMesh()!==entry.mesh||!actor.animationTimes||!actor.animationWeights){
        entry.gaitPhase=null;
        entry.jogClock=entry.runClock=undefined;
        continue;
      }
      const times=actor.animationTimes;
      // The controller can take multiple simulation steps before one render.
      // The model still advances by the renderer's single mixer delta.
      const simulationStep=Math.max(dt,times[1]-(entry.jogClock??times[1]),times[2]-(entry.runClock??times[2]));
      entry.jogClock=times[1];
      entry.runClock=times[2];
      let distance=null;
      if(followTravel){
        up.set(0,1,0).applyQuaternion(character.quaternion);
        displacement.subVectors(actor.position,entry.last);
        displacement.addScaledVector(up,-displacement.dot(up));
        distance=displacement.length();
      }
      const gait=groundGaitSample(entry.gaitPhase,times,actor.animationWeights,distance,dt,simulationStep);
      entry.gaitPhase=gait?.phase??null;
      if(gait){
        renderedCharacters??=new Map(state.characters);
        renderedCharacters.set(id,{...actor,animationTimes:gait.times});
      }
    }
    const result=update.call(this,renderedCharacters?{...state,characters:renderedCharacters}:state,dt);
    for(const [id,actor] of state.characters){
      const character=this.loadedCharacters.get(id)?.character;
      const mesh=character?.getMesh();
      if(!mesh)continue;
      let entry=actors.get(id);
      const position=actor.position;
      if(entry?.mesh!==mesh){
        entry={mesh,last:new Vector3().copy(position),modified:new Map(),
          airRig:bindHumanoidFlightRig(mesh),crouchRig:bindHumanoidCrouch(mesh),
          idleRig:bindHumanoidStandingIdle(mesh),accents:bindHumanoidGroundAccents(mesh),
          idlePhase:(id%10000)*2.3999632297,
          unpitched:new Quaternion(),applied:new Quaternion(),heading:new Vector3(),shift:new Vector3(),
          turn:new Follower(8.5),pitch:new Follower(7.5),bank:new Follower(10),lift:new Follower(9),sink:new Follower(4.5),
          thrust:new Follower(9),lean:new Follower(10),sway:new Follower(9),lead:new Follower(12),
          limbs:limbNames.map(name=>mesh.getObjectByName(name))};
        resetMotion(entry);
        actors.set(id,entry);
      }
      const isLocal=id===state.localCharacterId;
      const atTable=isLocal?table:tabletopPlayers.has?.(id)||tabletopPlayers.includes?.(id);
      if(isLocal&&glanceMotion&&microphoneLevel!==null){
        if(entry.mouth===undefined&&microphoneLevel>0)entry.mouth=bindHumanoidMicrophoneMouth(mesh);
        entry.mouth?.apply(microphoneLevel,step,atTable?1.25:1);
      }else entry.mouth?.reset();
      if(!glanceMotion)entry.glance?.reset();
      const glanceTarget=atTable&&glanceMotion?(isLocal?gaze:peerGaze?.get(id)):null;
      if(glanceTarget&&!entry.glance){
        entry.glance=new TabletopGlance();
        entry.head=mesh.getObjectByName('head');
      }
      const peerPose=isLocal?null:peerPoses?.get(id);
      const grounded=isLocal?localGrounded:actor.animationState>=0&&actor.animationState<=2||actor.animationState===5;
      const explicitFlight=Boolean(isLocal?outdoor&&flying:peerPose==='fly'||peerPose==='fly-fast');
      if(entry.table!==atTable){
        entry.last.copy(position);
        resetMotion(entry);
        entry.table=atTable;
      }
      const factor=atTable?matterAvatarScale:1;
      displacement.subVectors(position,entry.last);
      entry.last.copy(position);
      up.set(0,1,0).applyQuaternion(character.quaternion);
      const vertical=displacement.dot(up);
      const continuous=displacement.lengthSq()<(atTable?1:5)**2&&elapsed<=.35;
      displacement.addScaledVector(up,-vertical);
      const travel=displacement.length();
      const moved=travel<(atTable?.65:3);
      const speed=moved&&continuous?Math.min(atTable?9:18,travel/Math.max(elapsed*factor,.001)):0;
      const fade=ease(step,8);
      if(!continuous)resetMotion(entry);

      // Physics reported a place. Read the medium from it, for any actor.
      const sample=outdoor&&!atTable?exteriorSample(position):null;
      entry.medium=sample?avatarMedium(HUMAN_BODY,sample,{supported:grounded===true,previous:entry.medium}):null;
      const underwater=entry.medium==='surface'||entry.medium==='submerged';
      if(outdoor&&!atTable&&glanceMotion)wake?.observe(id,position,up,explicitFlight&&!underwater,elapsed);
      const draft=sample?sample.waterLevel-sample.feet:-Infinity;

      if(!outdoor||underwater)entry.observedFlight=false;
      const touchedDown=entry.observedFlight&&!explicitFlight&&grounded===true;
      if(explicitFlight){entry.observedFlight=true;entry.flightAge+=step;}
      else entry.flightAge=0;
      const recovering=entry.observedFlight&&!explicitFlight&&grounded===false;
      if(touchedDown)entry.observedFlight=false;
      const rising=clamp(continuous?vertical/Math.max(elapsed*factor,.001):0,-9,9);
      entry.rise+=(rising-entry.rise)*fade;
      let mode=underwater?'swim':recovering?'descend':atTable||explicitFlight?'hover':null;
      if(mode==='hover'&&!atTable&&(entry.mode==='lift'?entry.airTime<liftSeconds:entry.flightAge<.45&&entry.rise>.25))mode='lift';
      if(mode===null&&grounded&&(touchedDown||entry.mode==='land'&&entry.airTime<landSeconds))mode='land';
      if(mode!==entry.mode){entry.mode=mode;entry.airTime=0;}
      else entry.airTime+=step;
      const active=mode!==null;
      const floating=active&&mode!=='land';
      const boostInput=Boolean(glanceMotion&&explicitFlight&&mode==='hover'&&!atTable&&
        (isLocal?boosting:peerPose==='fly-fast'));
      // Reversing a partially completed gesture continues from the current
      // pose. Letting go has a longer release than the initial punch.
      entry.boost=mode==='hover'&&!atTable&&glanceMotion?
        clamp(entry.boost+step*(boostInput?1/.36:-1/.52)):0;
      const boost=entry.boost;
      entry.boostRelease+=(Number(!boostInput&&boost>0)-entry.boostRelease)*ease(step,15);
      const boostRelease=entry.boostRelease*Math.sin(Math.PI*boost);

      // Contact absorbs with the planted legs. Depth follows the fall speed.
      const standing=grounded===true&&!floating;
      if(grounded===false||floating){
        entry.unsupported+=step;
        entry.fall=Math.max(entry.fall*(1-ease(step,3)),-rising);
      }else{
        if(entry.unsupported>.16&&standing&&!underwater&&glanceMotion&&!atTable){
          entry.absorb=.28+.56*clamp((entry.fall-1)/6);
          entry.absorbAge=0;
        }
        entry.unsupported=0;entry.fall=0;
      }
      entry.absorbAge+=step;
      const previousSpeed=entry.planarSpeed;
      entry.planarSpeed+=(speed-entry.planarSpeed)*fade;
      const thrust=entry.thrust.update(clamp((entry.planarSpeed-previousSpeed)/Math.max(step,.004),-30,30),step);
      if(standing&&thrust<-8.5&&previousSpeed>2.1&&entry.brakeAge>.6&&glanceMotion){
        entry.brakeAge=0;
        entry.brake=.12+.26*clamp(previousSpeed/7);
      }
      entry.brakeAge+=step;
      const dip=glanceMotion&&standing?Math.max(entry.absorb*pulse(entry.absorbAge,...absorbTiming),
        entry.brake*pulse(entry.brakeAge,...brakeTiming)):0;

      const airborne=grounded!==true&&(atTable||outdoor&&(mode==='lift'||mode==='hover'||mode==='descend'));
      const running=outdoor&&!atTable&&standing&&!underwater;
      const swimming=underwater&&entry.planarSpeed>.2;
      let airYaw=0;
      // Follow from rest too. Outside, the physical yaw only moves with input,
      // so a still body has nothing to follow and its feet do not pivot.
      if(glanceMotion&&(airborne||underwater||running))
        airYaw=followHeading(entry,character.quaternion,step,airborne?(mode==='descend'?13:atTable?10:8.5):underwater?8:15);
      else{
        // Elsewhere the host already turns the body.
        entry.heading.set(0,0,0);
        entry.turn.reset();
      }
      const turnRate=glanceMotion?entry.turn.velocity:0;

      const low=!active&&(isLocal?crouch:peerPose==='crouch'&&grounded);
      const target=mode==='hover'||mode==='swim'?clamp((entry.planarSpeed-.14)/1.8):0;
      entry.weight+=(target-entry.weight)*ease(step,6);
      entry.hoverWeight+=(Number(Boolean(active))*(1-target)-entry.hoverWeight)*fade;
      entry.lowWeight+=(Number(Boolean(low))-entry.lowWeight)*fade;
      const w=entry.weight;
      const airWeight=entry.airRig&&active?(mode==='land'?1-smooth(entry.airTime/landSeconds):1):0;
      entry.airWeight+=(airWeight-entry.airWeight)*ease(step,mode==='lift'?20:active?9:13);
      const lowerTarget=mode==='land'||!active?0:airWeight;
      entry.lowerWeight+=(lowerTarget-entry.lowerWeight)*ease(step,lowerTarget?(mode==='lift'?20:9):24);
      const wadeTarget=glanceMotion&&entry.medium==='wade'?smooth((draft-.40)/.34):0;
      entry.wadeWeight+=(wadeTarget-entry.wadeWeight)*ease(step,6);

      // Flight and water tilt turn about the hips. Ground lean stays in the trunk.
      const climb=clamp(entry.rise/5,-1,1);
      const lean=underwater?entry.medium==='surface'?1.12*w:
          clamp(1.22*w-clamp(entry.rise/2.8,-1,1)*(.30+.30*w),-.2,1.72):
        mode==='hover'||mode==='lift'?(atTable?.56:.57+.13*clamp((entry.planarSpeed-4)/4))*w-.16*climb*w+clamp(.011*thrust,-.20,.14)+.38*smooth(boost)-.10*boostRelease:
          0;
      const pitchValue=glanceMotion?entry.pitch.update(lean+(entry.crouchRig?0:.13*entry.lowWeight),step,floating?7.5:20):
        entry.pitch.reset((underwater?1.12:.56)*w).value;
      const bankTarget=airborne?clamp(-turnRate*(.055+.085*w),-.52,.52)*(mode==='descend'?.35:atTable?.8:1):
        swimming?clamp(-turnRate*.12,-.34,.34):0;
      const bankValue=glanceMotion?entry.bank.update(bankTarget,step,airborne||swimming?10:18):entry.bank.reset().value;
      const lift=entry.lift.update(floating||Math.abs(pitchValue)>.02?1:0,step);
      // Float shoulder deep. Over a near bed the tucked legs set the limit.
      const sinkTarget=entry.medium==='surface'&&entry.airRig?Math.min(.36-.12*w,Math.max(0,sample.feet-sample.ground+.28)):0;
      const sink=glanceMotion?entry.sink.update(sinkTarget,step):entry.sink.reset(sinkTarget).value;
      const trunk=glanceMotion&&standing&&!underwater?1:0;
      const trunkPitch=entry.lean.update(trunk*(clamp(.009*thrust,-.13,.13)+.10*dip+.07*entry.wadeWeight),step);
      const trunkRoll=entry.sway.update(trunk*clamp(-turnRate*entry.planarSpeed*.010,-.17,.17),step);
      const trunkLead=entry.lead.update(trunk*clamp(-airYaw*.45,-.5,.5),step);

      const settled=w<.01&&entry.hoverWeight<.01&&entry.lowWeight<.01&&entry.airWeight<.01&&
        entry.lowerWeight<.01&&entry.wadeWeight<.01&&dip<.002&&sink<.002&&
        Math.abs(pitchValue)<.002&&Math.abs(bankValue)<.001&&Math.abs(airYaw)<.001&&
        Math.abs(trunkPitch)+Math.abs(trunkRoll)+Math.abs(trunkLead)<.003;
      const resting=entry.idleRig&&glanceMotion&&settled&&grounded===true&&!active&&!low&&
        actor.animationState===0&&(actor.animationWeights?.[0]??1)>.9&&speed<.14&&entry.planarSpeed<.14;
      entry.idleDwell=resting?entry.idleDwell+step:0;
      const idleTarget=entry.idleDwell>=.32?1:0;
      entry.idleWeight=glanceMotion?
        entry.idleWeight+(idleTarget-entry.idleWeight)*ease(step,idleTarget?4:24):0;
      entry.idleTime=resting||entry.idleWeight>.001?entry.idleTime+step:0;
      const idle=()=>{
        if(entry.idleWeight>.001)entry.idleRig.apply(character,entry.idleTime+entry.idlePhase,entry.idleWeight,
          Math.max(entry.idleDwell,0),entry.idlePhase);
      };
      if(settled){
        idle();
        entry.glance?.apply(character,entry.head,glanceTarget,dt);
        continue;
      }
      if(glanceMotion){
        entry.loopTime+=step*(1+.25*w);
        entry.strokeTime=underwater&&w>.03?entry.strokeTime+step*(.80+.28*clamp(entry.planarSpeed/3)):1.40;
        entry.phase=(entry.phase+step*(underwater?4.4:2.1))%(2*Math.PI);
      }
      const strokeSwing=Math.sin(entry.phase),counter=Math.cos(entry.phase);
      // Crouch depth is quadratic in its weight. Keep the absorb depth linear.
      const crouchWeight=Math.max(entry.lowWeight,Math.sqrt(dip))*(1-entry.lowerWeight);
      // Wait for the root tilt from flight to settle before committing the
      // ground pose. This avoids turning its planted feet with the air pose.
      const groundBlend=Math.max(0,1-Math.abs(pitchValue)/.08);
      entry.crouchRig?.apply(character,crouchWeight*groundBlend);
      pitch.setFromAxisAngle(pitchAxis,pitchValue);
      entry.rotation=character.quaternion;
      entry.unpitched.copy(entry.rotation);
      if(airYaw)entry.rotation.multiply(yaw.setFromAxisAngle(yawAxis,airYaw));
      if(entry.lowWeight>0||entry.hoverWeight>0||w>0){
        character.getWorldQuaternion(bodyFacing);
        right.copy(pitchAxis).applyQuaternion(bodyFacing);
      }
      tilt.copy(pitch);
      if(bankValue)tilt.multiply(roll.setFromAxisAngle(rollAxis,bankValue));
      entry.rotation.multiply(tilt);
      entry.applied.copy(entry.rotation);
      if(entry.airRig&&(lift>.002||sink>.002)){
        // Offset the model inside its character, so the hips hold their place
        // and the physical position, camera target and name stay untouched.
        tilt.invert();
        pivot.set(0,hipHeight*lift,0);
        shift.copy(pivot).applyQuaternion(tilt).sub(pivot);
        shift.add(cross.set(0,-sink,0).applyQuaternion(tilt));
        entry.shift.copy(shift);
        mesh.position.add(shift);
        entry.shifted=true;
      }
      const armWeight=Math.min(1,entry.airWeight+entry.wadeWeight);
      if(entry.airRig&&Math.max(armWeight,entry.lowerWeight)>.01){
        const wading=entry.airWeight<entry.wadeWeight;
        if(mode){
          entry.poseMode=mode;
          entry.poseTime=mode==='hover'||mode==='swim'?entry.loopTime:glanceMotion?entry.airTime:1;
        }else if(!floating&&entry.poseMode!=='land')entry.poseTime=entry.loopTime;
        const surface=entry.medium==='surface';
        if(surface){
          // The waterline, measured where this body is.
          water.up.copy(up);
          water.point.copy(position).addScaledVector(up,draft);
          character.parent?.localToWorld(water.point);
        }
        entry.airRig.apply(character,{mode:wading?'wade':entry.poseMode,time:wading?entry.loopTime:entry.poseTime,
          forward:w,weight:armWeight,lowerWeight:entry.lowerWeight,torsoWeight:entry.airWeight,step,
          bank:entry.airWeight*clamp(bankValue,-.5,.5),boost,boostRelease,
          // Reach overhead only once the body lies along the surface.
          stroke:mode==='swim'?smooth((pitchValue-.45)/.5):0,strokeTime:entry.strokeTime,
          water:surface&&!wading?water:null});
      }
      idle();
      entry.accents?.apply(character,trunkPitch,trunkLead,trunkRoll);
      entry.glance?.apply(character,entry.head,glanceTarget,dt,1-w*.8);
      const airSwing=entry.airRig?0:w,hoverSwing=entry.airRig?0:entry.hoverWeight;
      if(entry.airRig&&entry.crouchRig)continue;
      const strokeAmplitude=underwater?.58:.16;
      const kickAmplitude=underwater?.27:.075;
      for(let index=0;index<entry.limbs.length;index++){
        if(entry.airRig&&(index<4||crouchWeight<.001))continue;
        const bone=entry.limbs[index];
        if(!bone)continue;
        const polarity=index%2?-1:1;
        const swing=index<2?strokeSwing*strokeAmplitude:index<4?counter*.22:kickAmplitude*counter;
        const offset=index<2?(.34+strokeSwing*.10)*polarity:0;
        const neutral=entry.modified.get(bone)??new Quaternion();
        neutral.copy(bone.quaternion);
        entry.modified.set(bone,neutral);
        const hoverBend=index<2?.22:index<4?-.32:index<6?-.24:.44;
        const hoverSpread=index<2?polarity*.23:0;
        const motionBend=airSwing*swing*polarity+hoverSwing*hoverBend;
        if(index<4){
          angles.set(motionBend,0,airSwing*offset+hoverSwing*hoverSpread);
          bone.quaternion.multiply(turn.setFromEuler(angles));
        }else{
          // These rigs have mirrored leg bones along local X. Bend around
          // the character's lateral axis, not around each bone's length.
          const crouchBend=entry.crouchRig?0:(index<6?-.42:.64)*crouchWeight;
          bone.getWorldQuaternion(boneFacing);
          localAxis.copy(right).applyQuaternion(boneFacing.invert());
          bone.quaternion.multiply(bend.setFromAxisAngle(localAxis,motionBend+crouchBend));
        }
      }
    }
    for(const id of actors.keys())if(!state.characters.has(id))actors.delete(id);
    return result;
  }
  manager.update=animatedUpdate;
  const release=()=>{
    if(bindings.get(manager)!==release)return;
    bindings.delete(manager);
    if(manager.update===animatedUpdate)manager.update=update;
    for(const entry of actors.values())restore(entry);
    actors.clear();
  };
  bindings.set(manager,release);
  return release;
}
