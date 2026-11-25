import {Euler,Quaternion,Vector3} from 'three';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainWaterDepth} from './toroidal-terrain.mjs';
import {matterAvatarScale} from './matter-flight.mjs';
import {TabletopGlance} from './tabletop-attention.mjs';
import {bindHumanoidFlightRig} from './humanoid-flight-poses.mjs';
import {bindHumanoidCrouch} from './humanoid-crouch.mjs';
import {bindHumanoidStandingIdle} from './humanoid-standing-idle.mjs';

const limbNames=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r'];
const pitchAxis=new Vector3(1,0,0);
const yawAxis=new Vector3(0,1,0),rollAxis=new Vector3(0,0,1);
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

  function followAirHeading(entry,rotation,step,descending,bankScale){
    facing.copy(rollAxis).applyQuaternion(rotation);
    // Compare headings on the same radial tangent plane. A changing up
    // direction alone should not look like a steering input.
    entry.heading.addScaledVector(up,-entry.heading.dot(up));
    if(entry.heading.lengthSq()<.01){
      entry.heading.copy(facing);
      entry.bank=0;
      return 0;
    }
    entry.heading.normalize();
    cross.crossVectors(entry.heading,facing);
    const residual=Math.atan2(up.dot(cross),entry.heading.dot(facing));
    const advance=residual*(1-Math.exp(-step*(descending?22:11)));
    entry.heading.applyAxisAngle(up,advance);
    const steering=advance/Math.max(step,.001);
    const bank=-Math.max(-.18,Math.min(.18,steering*.042))*bankScale;
    entry.bank+=(bank-entry.bank)*(1-Math.exp(-step*13));
    return advance-residual;
  }
  function restore(entry){
    entry.glance?.restore();
    entry.idleRig?.restore();
    for(const [bone,neutral] of entry.modified)bone.quaternion.copy(neutral);
    entry.modified.clear();
    entry.airRig?.restore();
    entry.crouchRig?.restore();
    if(entry.rotation?.equals(entry.applied))entry.rotation.copy(entry.unpitched);
  }
  function resetMotion(entry){
    Object.assign(entry,{weight:0,hoverWeight:0,lowWeight:0,planarSpeed:0,airWeight:0,
      lowerWeight:0,airTime:0,rise:0,flightAge:0,pitch:0,phase:0,poseTime:0,observedFlight:false,
      mode:null,poseMode:null,idleDwell:0,idleTime:0,idleWeight:0});
    entry.heading.set(0,0,0);
    entry.bank=0;
    entry.airRig?.reset();
  }
  function animatedUpdate(state,dt){
    // Remove last frame's extra limb rotations before the base mixer runs.
    for(const entry of actors.values())restore(entry);
    const result=update.call(this,state,dt);
    const {outdoor,flying,grounded:localGrounded,table,crouch,gaze,peerPoses,glanceMotion=true,tabletopPlayers=[]}=context();
    const now=clock?.();
    const elapsed=now!==undefined&&previousTime!==undefined?(now-previousTime)/1000:dt;
    previousTime=now;
    const step=Math.min(.15,Math.max(0,elapsed));
    for(const [id,actor] of state.characters){
      const character=this.loadedCharacters.get(id)?.character;
      const mesh=character?.getMesh();
      if(!mesh)continue;
      let entry=actors.get(id);
      const position=actor.position;
      if(entry?.mesh!==mesh){
        entry={mesh,last:new Vector3().copy(position),modified:new Map(),
          airRig:bindHumanoidFlightRig(mesh),crouchRig:bindHumanoidCrouch(mesh),
          idleRig:bindHumanoidStandingIdle(mesh),idlePhase:(id%10000)*2.3999632297,
          unpitched:new Quaternion(),applied:new Quaternion(),heading:new Vector3(),
          limbs:limbNames.map(name=>mesh.getObjectByName(name))};
        resetMotion(entry);
        actors.set(id,entry);
      }
      const isLocal=id===state.localCharacterId;
      if(!glanceMotion)entry.glance?.reset();
      if(isLocal&&glanceMotion&&table&&gaze&&!entry.glance){
        entry.glance??=new TabletopGlance();
        entry.head??=mesh.getObjectByName('head');
      }
      const coordinate=outdoor?terrainCoordinates([position.x,position.y,position.z]):null;
      const waterLine=entry.mode==='swim'?.78:.92;
      const underwater=coordinate&&coordinate.height<TOROIDAL_TERRAIN.waterLevel-waterLine&&terrainWaterDepth(coordinate.u,coordinate.v)>.18;
      const atTable=isLocal?table:tabletopPlayers.has?.(id)||tabletopPlayers.includes?.(id);
      const peerPose=isLocal?null:peerPoses?.get(id);
      const grounded=isLocal?localGrounded:actor.animationState>=0&&actor.animationState<=2||actor.animationState===5;
      const explicitFlight=Boolean(isLocal?outdoor&&flying:peerPose==='fly');
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
      const fade=1-Math.exp(-step*8);
      if(!continuous)resetMotion(entry);
      if(!outdoor||underwater)entry.observedFlight=false;
      const touchedDown=entry.observedFlight&&!explicitFlight&&grounded===true;
      if(explicitFlight){entry.observedFlight=true;entry.flightAge+=step;}
      else entry.flightAge=0;
      const recovering=entry.observedFlight&&!explicitFlight&&grounded===false;
      if(touchedDown)entry.observedFlight=false;
      entry.rise+=(Math.max(-7,Math.min(7,continuous?vertical/Math.max(elapsed*factor,.001):0))-entry.rise)*fade;
      let mode=underwater?'swim':recovering?'descend':atTable||explicitFlight?'hover':null;
      if(mode==='hover'&&!atTable&&(entry.mode==='lift'?entry.airTime<.42:entry.flightAge<.45&&entry.rise>.25))mode='lift';
      if(mode===null&&grounded&&(touchedDown||entry.mode==='land'&&entry.airTime<.32))mode='land';
      if(mode!==entry.mode){entry.mode=mode;entry.airTime=0;}
      else entry.airTime+=step;
      const active=mode!==null;
      const steering=glanceMotion&&grounded!==true&&
        (atTable||outdoor&&(mode==='lift'||mode==='hover'||mode==='descend'));
      let airYaw=0;
      if(steering){
        const descending=mode==='descend';
        const bankScale=atTable ? .6 : (descending ? .35 : 1);
        airYaw=followAirHeading(entry,character.quaternion,step,descending,bankScale);
      }else{
        // Supported poses keep the mixer heading so the feet do not pivot.
        entry.heading.set(0,0,0);
        entry.bank=0;
      }
      const low=!active&&(isLocal?crouch:peerPose==='crouch'&&grounded);
      entry.planarSpeed+=(speed-entry.planarSpeed)*fade;
      const target=(mode==='hover'||mode==='swim')?Math.min(1,Math.max(0,(entry.planarSpeed-.14)/1.8)):0;
      entry.weight+=(target-entry.weight)*fade;
      entry.hoverWeight+=(Number(Boolean(active))*(1-target)-entry.hoverWeight)*fade;
      entry.lowWeight+=(Number(Boolean(low))-entry.lowWeight)*fade;
      const airWeight=entry.airRig&&active?(mode==='land'?Math.max(0,1-entry.airTime/.32):1):0;
      entry.airWeight+=(airWeight-entry.airWeight)*(1-Math.exp(-step*(active?9:13)));
      const lowerTarget=mode==='land'||!active?0:airWeight;
      entry.lowerWeight+=(lowerTarget-entry.lowerWeight)*(1-Math.exp(-step*(lowerTarget?9:24)));
      const settled=entry.weight<.01&&entry.hoverWeight<.01&&entry.lowWeight<.01&&entry.airWeight<.01&&
        entry.lowerWeight<.01&&Math.abs(entry.pitch)<.01&&Math.abs(entry.bank)<.001&&Math.abs(airYaw)<.001;
      const resting=entry.idleRig&&glanceMotion&&settled&&grounded===true&&!active&&!low&&
        actor.animationState===0&&(actor.animationWeights?.[0]??1)>.9&&speed<.14&&entry.planarSpeed<.14;
      entry.idleDwell=resting?entry.idleDwell+step:0;
      const idleTarget=entry.idleDwell>=.32?1:0;
      entry.idleWeight=glanceMotion?
        entry.idleWeight+(idleTarget-entry.idleWeight)*(1-Math.exp(-step*(idleTarget?4:24))):0;
      entry.idleTime=resting||entry.idleWeight>.001?entry.idleTime+step:0;
      if(settled){
        if(entry.idleWeight>.001)entry.idleRig.apply(character,entry.idleTime+entry.idlePhase,entry.idleWeight);
        entry.glance?.apply(character,entry.head,isLocal&&table&&glanceMotion?gaze:null,dt);
        continue;
      }
      entry.phase=(entry.phase+step*(underwater?4.4:2.1))%(2*Math.PI);
      const stroke=Math.sin(entry.phase),counter=Math.cos(entry.phase);
      const w=entry.weight;
      const crouchWeight=entry.lowWeight*(1-entry.lowerWeight);
      const lean=(underwater?1.04:atTable?.56:.57)*w+(entry.crouchRig?0:.13*entry.lowWeight);
      entry.pitch+=(lean-entry.pitch)*fade;
      // Wait for the root tilt from flight to settle before committing the
      // ground pose. This avoids turning its planted feet with the air pose.
      const groundBlend=Math.max(0,1-Math.abs(entry.pitch)/.025);
      entry.crouchRig?.apply(character,crouchWeight*groundBlend);
      pitch.setFromAxisAngle(pitchAxis,entry.pitch);
      entry.rotation=character.quaternion;
      entry.unpitched.copy(entry.rotation);
      if(airYaw)entry.rotation.multiply(yaw.setFromAxisAngle(yawAxis,airYaw));
      if(entry.lowWeight>0||entry.hoverWeight>0||w>0){
        character.getWorldQuaternion(bodyFacing);
        right.copy(pitchAxis).applyQuaternion(bodyFacing);
      }
      entry.rotation.multiply(pitch);
      if(entry.bank)entry.rotation.multiply(roll.setFromAxisAngle(rollAxis,entry.bank));
      entry.applied.copy(entry.rotation);
      if(entry.airRig&&Math.max(entry.airWeight,entry.lowerWeight)>.01){
        const time=mode==='lift'?entry.airTime/.44:mode==='descend'?entry.airTime/.38:mode==='land'?entry.airTime/.32:
          glanceMotion?entry.phase/(Math.PI*2):0;
        if(mode){entry.poseMode=mode;entry.poseTime=time;}
        entry.airRig.apply(character,{mode:entry.poseMode,time:entry.poseTime,
          forward:entry.weight,weight:entry.airWeight,lowerWeight:entry.lowerWeight,step});
      }
      if(entry.idleWeight>.001)entry.idleRig.apply(character,entry.idleTime+entry.idlePhase,entry.idleWeight);
      entry.glance?.apply(character,entry.head,isLocal&&table&&glanceMotion?gaze:null,dt,1-w*.8);
      const airSwing=entry.airRig?0:w,hoverSwing=entry.airRig?0:entry.hoverWeight;
      if(entry.airRig&&entry.crouchRig)continue;
      const strokeAmplitude=underwater?.58:.16;
      const kickAmplitude=underwater?.27:.075;
      for(let index=0;index<entry.limbs.length;index++){
        if(entry.airRig&&(index<4||crouchWeight<.001))continue;
        const bone=entry.limbs[index];
        if(!bone)continue;
        const polarity=index%2?-1:1;
        const sweep=index<2?stroke*strokeAmplitude:index<4?counter*.22:kickAmplitude*counter;
        const offset=index<2?(.34+stroke*.10)*polarity:0;
        const neutral=entry.modified.get(bone)??new Quaternion();
        neutral.copy(bone.quaternion);
        entry.modified.set(bone,neutral);
        const hoverBend=index<2?.22:index<4?-.32:index<6?-.24:.44;
        const hoverSpread=index<2?polarity*.23:0;
        const motionBend=airSwing*sweep*polarity+hoverSwing*hoverBend;
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
