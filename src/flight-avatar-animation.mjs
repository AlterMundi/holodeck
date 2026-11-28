import {Euler,Quaternion,Vector3} from 'three';
import {matterAvatarScale} from './matter-flight.mjs';
import {TabletopGlance} from './tabletop-attention.mjs';
import {FLIGHT_STYLES,HOVER_STYLES,TREAD_STYLES,bindHumanoidFlightRig} from './humanoid-flight-poses.mjs';
import {bindPersonalAvatarLanding,landingBlendWeight} from './personal-avatar-landing.mjs';
import {bindHumanoidCrouch} from './humanoid-crouch.mjs';
import {bindHumanoidStandingIdle} from './humanoid-standing-idle.mjs';
import {bindHumanoidIdleRepertoire} from './humanoid-idle-repertoire.mjs';
import {groundGaitSample} from './humanoid-ground-gait.mjs';
import {bindHumanoidDirectionalGait,gaitDirection,travelAngle} from './humanoid-directional-gait.mjs';
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
// Double-jump tricks. Each names its spins (turns about the body's lateral,
// long and forward axes) and the body it holds. A body deals them in its own
// shuffled order, so the same trick does not come twice running.
export const TRICK_SECONDS=.78;
export const TRICKS=Object.freeze([
  {name:'front-tuck',flip:1,twist:0,roll:0,body:'trickTuck'},
  {name:'back-layout',flip:-1,twist:0,roll:0,body:'trickLayout'},
  {name:'double-pirouette',flip:0,twist:2,roll:0,body:'trickTwist'},
  {name:'corkscrew',flip:-1,twist:1,roll:0,body:'trickTwist'},
  {name:'side-aerial',flip:0,twist:0,roll:1,body:'trickLayout'},
  {name:'front-full',flip:1,twist:1,roll:0,body:'trickTwist'},
]);
const STYLE_NAMES=Object.keys(FLIGHT_STYLES),HOVER_NAMES=Object.keys(HOVER_STYLES),TREAD_NAMES=Object.keys(TREAD_STYLES);
const scatter=index=>{const x=Math.sin(index*57.31+.77)*43758.5453;return x-Math.floor(x);};
// Next entry from a per-body shuffled deck, never repeating the last one.
function dealt(entry,key,list){
  const deck=entry[key]??=[];
  if(!deck.length){
    const round=(entry[key+'Round']=(entry[key+'Round']??0)+1);
    const order=list.map((item,index)=>({item,key:scatter(entry.idlePhase*3.1+index*7.7+round*1.3)}))
      .sort((a,b)=>a.key-b.key).map(({item})=>item);
    if(order[0]===entry[key+'Last']&&order.length>1)order.push(order.shift());
    deck.push(...order);
  }
  return entry[key+'Last']=deck.shift();
}

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
    entry.landing?.restore();
    entry.mouth?.restore();
    entry.accents?.restore();
    entry.repertoire?.restore();
    entry.idleRig?.restore();
    for(const [bone,neutral] of entry.modified)bone.quaternion.copy(neutral);
    entry.modified.clear();
    entry.airRig?.restore();
    entry.crouchRig?.restore();
    entry.directional?.restore();
    if(entry.shifted){entry.mesh.position.sub(entry.shift);entry.shifted=false;}
    if(entry.rotation?.equals(entry.applied))entry.rotation.copy(entry.unpitched);
  }
  function resetMotion(entry){
    Object.assign(entry,{weight:0,hoverWeight:0,lowWeight:0,planarSpeed:0,flightSpeed:0,airWeight:0,
      boost:0,boostRelease:0,lowerWeight:0,airTime:0,rise:0,flightAge:0,poseTime:0,observedFlight:false,
      mode:null,poseMode:null,idleDwell:0,idleTime:0,idleWeight:0,
      medium:null,loopTime:0,strokeTime:1.40,wadeWeight:0,phase:0,
      gaitPhase:null,gaitBackward:false,flightBackward:false,travelRight:0,travelForward:1,unsupported:0,fall:0,landingAge:Infinity,absorbAge:Infinity,absorb:0,brakeAge:Infinity,brake:0,lastSpeed:0});
    for(const follower of [entry.turn,entry.pitch,entry.bank,entry.lift,entry.sink,
      entry.thrust,entry.lean,entry.sway,entry.lead,entry.aim,entry.hips,entry.headFirst,entry.ahead,entry.sideLean,entry.outstretched,entry.restAmount])follower.reset();
    entry.heading.set(0,0,0);
    entry.airRig?.reset();
  }
  function animatedUpdate(state,dt){
    // Remove last frame's extra limb rotations before the base mixer runs.
    for(const entry of actors.values())restore(entry);
    const {outdoor,flying,boosting,grounded:localGrounded,table,crouch,gaze,peerGaze,peerPoses,glanceMotion=true,tabletopPlayers=[],microphoneLevel=null,wake=null,splash=null,waterWake=null,trample=null,aimPitch=null,loopPitch=null,trickAge=Infinity}=context();
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
      const gait=groundGaitSample(entry.gaitPhase,times,actor.animationWeights,distance,dt,simulationStep,entry.gaitBackward);
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
          idleRig:mesh.animations?.some(clip=>clip.name==='hero_idle')?null:bindHumanoidStandingIdle(mesh),
          repertoire:bindHumanoidIdleRepertoire(mesh),
          landing:bindPersonalAvatarLanding(mesh),accents:bindHumanoidGroundAccents(mesh),
          idlePhase:(id%10000)*2.3999632297,
          unpitched:new Quaternion(),applied:new Quaternion(),heading:new Vector3(),shift:new Vector3(),
          turn:new Follower(8.5),pitch:new Follower(7.5),bank:new Follower(10),lift:new Follower(9),sink:new Follower(4.5),
          thrust:new Follower(9),lean:new Follower(10),sway:new Follower(9),lead:new Follower(12),aim:new Follower(16),
          hips:new Follower(11),headFirst:new Follower(5),ahead:new Follower(5),sideLean:new Follower(5),outstretched:new Follower(5),restAmount:new Follower(3.5),directional:bindHumanoidDirectionalGait(mesh),
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
      // A local pilot travels in the pitched flight frame even at a pole.
      const piloting=isLocal&&explicitFlight&&outdoor&&!atTable&&Number.isFinite(loopPitch);
      // Local physics caps its catch-up steps. A delayed render with only a
      // small advance is still the same maneuver, not a new airborne pose.
      const continuous=displacement.lengthSq()<(atTable?1:5)**2&&(piloting||elapsed<=.35);
      const travel3=displacement.length();
      displacement.addScaledVector(up,-vertical);
      const travel=displacement.length();
      // Where the body travels relative to where it faces, smoothed so a
      // single uneven packet does not swing the legs.
      if(continuous&&(piloting?travel3:travel)>(atTable?.002:.004)){
        facing.copy(rollAxis).applyQuaternion(character.quaternion);
        right.copy(pitchAxis).applyQuaternion(character.quaternion);
        let along,across;
        if(piloting){
          // Flight direction: the facing pitched by the camera toward up.
          const c=Math.cos(loopPitch),s=Math.sin(loopPitch);
          const ahead3=(displacement.dot(facing)*c+vertical*s)/travel3;
          across=displacement.dot(right)/travel3;
          along=ahead3;
        }else{
          along=displacement.dot(facing)/travel;
          across=displacement.dot(right)/travel;
        }
        const follow=ease(step,9);
        entry.travelRight+=(across-entry.travelRight)*follow;
        entry.travelForward+=(along-entry.travelForward)*follow;
      }
      const heading=travelAngle(entry.travelRight,entry.travelForward);
      const moved=travel<(atTable?.65:3);
      const speed=moved&&continuous?Math.min(atTable?9:18,travel/Math.max(elapsed*factor,.001)):0;
      // Full flight speed, vertical included, for a pilot's posture.
      entry.flightSpeed+=((continuous&&piloting?Math.min(30,travel3/Math.max(Math.min(elapsed,.1),.001)):0)-entry.flightSpeed)*ease(step,8);
      const fade=ease(step,8);
      if(!continuous)resetMotion(entry);

      // Physics reported a place. Read the medium from it, for any actor.
      const sample=outdoor&&!atTable?exteriorSample(position):null;
      entry.medium=sample?avatarMedium(HUMAN_BODY,sample,{supported:grounded===true,previous:entry.medium}):null;
      if(sample){
        splash?.observe(id,sample,elapsed,continuous?travel/Math.max(elapsed,.001):0,continuous,glanceMotion);
        waterWake?.observe(id,position,up,sample,{flying:explicitFlight,seconds:elapsed,continuous,emit:glanceMotion});
      }
      const wet=entry.medium==='surface'||entry.medium==='submerged';
      const underwater=wet&&!explicitFlight;
      if(outdoor&&!atTable&&glanceMotion)wake?.observe(id,position,up,explicitFlight&&!wet,elapsed);
      // Peers part the meadow too; the explorer's own steps are read by the grass.
      if(outdoor&&!atTable&&!isLocal&&continuous)trample?.observe(id,position);
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
      // A fresh style for every boost and now and then on a long cruise.
      const cruisingStyle=mode==='hover'&&!atTable&&entry.planarSpeed>2;
      entry.styleAge=cruisingStyle?(entry.styleAge??0)+step:0;
      if(boostInput&&!entry.boostHeld||cruisingStyle&&(!entry.style||entry.styleAge>8+5*scatter(entry.flightAge))){
        entry.style=FLIGHT_STYLES[dealt(entry,'styles',STYLE_NAMES)];
        entry.styleAge=0;
        // Breaking away: a ring of light where the boost begins.
        if(boostInput&&!entry.boostHeld&&outdoor&&glanceMotion){
          facing.copy(rollAxis).applyQuaternion(character.quaternion);
          right.copy(pitchAxis).applyQuaternion(character.quaternion);
          wake?.burst?.(id,position,facing.multiplyScalar(entry.travelForward).addScaledVector(right,entry.travelRight));
        }
      }
      if(mode!=='hover'&&mode!=='lift')entry.style=null;
      // Still in the air or in the water: a varied rest, changing now and then.
      const restingAir=mode==='hover'&&!atTable&&entry.planarSpeed<.6&&Math.abs(entry.rise)<1;
      const restingWater=mode==='swim'&&entry.planarSpeed<.3;
      const afloat=(restingAir||restingWater)&&glanceMotion;
      const restKind=restingAir?'air':restingWater?'water':null;
      entry.restAge=afloat&&entry.restKind===restKind?(entry.restAge??0)+step:0;
      if(afloat&&(entry.restKind!==restKind||entry.restAge>6.5+4*scatter(entry.loopTime))){
        entry.restKind=restKind;entry.restAge=0;
        entry.rest=restingAir?HOVER_STYLES[dealt(entry,'hovers',HOVER_NAMES)]:TREAD_STYLES[dealt(entry,'treads',TREAD_NAMES)];
      }
      const restAmount=glanceMotion?entry.restAmount.update(afloat&&entry.rest?1:0,step,3.5):entry.restAmount.reset().value;
      entry.boostHeld=boostInput;

      // Contact absorbs with the planted legs. Depth follows the fall speed.
      const standing=grounded===true&&!floating;
      if(grounded===false||floating){
        entry.unsupported+=step;
        entry.fall=Math.max(entry.fall*(1-ease(step,3)),-rising);
      }else{
        if(entry.landing&&(touchedDown||entry.unsupported>.16)&&standing&&!underwater&&glanceMotion&&!atTable)entry.landingAge=0;
        if(entry.unsupported>.16&&standing&&!underwater&&glanceMotion&&!atTable){
          entry.absorb=.28+.56*clamp((entry.fall-1)/6);
          entry.absorbAge=0;
        }
        entry.unsupported=0;entry.fall=0;
      }
      if(!standing||!glanceMotion||atTable)entry.landingAge=Infinity;
      if(entry.landingAge<(entry.landing?.duration??0))entry.landing.captureSupport(character);
      const playLanding=()=>{
        if(!entry.landing||entry.landingAge>=entry.landing.duration)return;
        entry.landingAge+=step;
        const gaitWeight=(actor.animationWeights?.[1]??0)+(actor.animationWeights?.[2]??0);
        entry.landing.apply(entry.landingAge,landingBlendWeight(entry.landingAge,entry.landing.duration,speed,gaitWeight));
        entry.landing.plant();
      };
      entry.absorbAge+=step;
      const previousSpeed=entry.planarSpeed;
      entry.planarSpeed+=(speed-entry.planarSpeed)*fade;
      const thrust=entry.thrust.update(clamp((entry.planarSpeed-previousSpeed)/Math.max(step,.004),-30,30),step);
      if(standing&&thrust<-8.5&&previousSpeed>2.1&&entry.brakeAge>.6&&glanceMotion){
        entry.brakeAge=0;
        entry.brake=.16+.30*clamp(previousSpeed/7);
      }
      entry.brakeAge+=step;
      const authoredContact=entry.landing&&entry.landingAge<entry.landing.duration;
      const absorbing=glanceMotion&&standing&&!authoredContact?entry.absorb*pulse(entry.absorbAge,...absorbTiming):0;
      const braking=glanceMotion&&standing&&!authoredContact?entry.brake*pulse(entry.brakeAge,...brakeTiming):0;
      const dip=Math.max(absorbing,braking);

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
      // A pilot going vertical is still cruising, not hovering.
      const cruiseSpeed=piloting?Math.max(entry.planarSpeed,entry.flightSpeed):entry.planarSpeed;
      const target=mode==='hover'||mode==='swim'?clamp((cruiseSpeed-.14)/1.8):0;
      entry.weight+=(target-entry.weight)*ease(step,6);
      entry.hoverWeight+=(Number(Boolean(active))*(1-target)-entry.hoverWeight)*fade;
      entry.lowWeight+=(Number(Boolean(low))-entry.lowWeight)*fade;
      const w=entry.weight;
      // In flight and water the body keeps facing the view, like the camera
      // it rides with. Going ahead it lies out along the travel; sideways it
      // stays upright and leans into the side; backing away it stands and
      // leans back. Only a small turn of the body follows a diagonal, so
      // the keys never swing the whole body around. A turn's own drift is
      // left to the bank.
      const cruising=(mode==='hover'||mode==='swim')&&!atTable&&glanceMotion;
      const along=Math.cos(heading),across=Math.sin(heading);
      const ahead=glanceMotion?entry.ahead.update(cruising?along:1,step):entry.ahead.reset(1).value;
      const headFirst=glanceMotion?entry.headFirst.update(cruising?clamp(heading,-.42,.42)*clamp(along)*w:0,step):entry.headFirst.reset().value;
      const sideLean=glanceMotion?entry.sideLean.update(cruising?across*w*(.42+.18*smooth(boost))*clamp(1-Math.abs(turnRate)/1.2):0,step):entry.sideLean.reset().value;
      const backLean=ahead>=0?ahead:ahead*.55;
      const airWeight=entry.airRig&&active?(mode==='land'?1-smooth(entry.airTime/landSeconds):1):0;
      entry.airWeight+=(airWeight-entry.airWeight)*ease(step,mode==='lift'?20:active?9:13);
      const lowerTarget=mode==='land'||!active?0:airWeight;
      entry.lowerWeight+=(lowerTarget-entry.lowerWeight)*ease(step,lowerTarget?(mode==='lift'?20:9):24);
      const wadeTarget=glanceMotion&&entry.medium==='wade'?smooth((draft-.40)/.34):0;
      entry.wadeWeight+=(wadeTarget-entry.wadeWeight)*ease(step,6);

      // Flight and water tilt turn about the hips. Ground lean stays in the trunk.
      const climb=clamp(entry.rise/5,-1,1);
      const lean=underwater?entry.medium==='surface'?1.12*w*backLean:
          clamp(1.22*w*backLean-clamp(entry.rise/2.8,-1,1)*(.30+.30*w),-.7,1.72):
        mode==='hover'||mode==='lift'?((atTable?.56:.57+.13*clamp((entry.planarSpeed-4)/4))*w+.38*smooth(boost))*backLean-.16*climb*w+clamp(.011*thrust,-.20,.14)-.48*boostRelease:
          0;
      const looking=isLocal&&!atTable&&Number.isFinite(aimPitch);
      const aimTarget=looking?clamp(aimPitch,-1.2,1.2):0;
      const aim=glanceMotion?entry.aim.update(aimTarget,step):entry.aim.reset(aimTarget).value;
      const inclined=clamp(lean+(floating?aim:0),-1.2,1.72);
      const pitchValue=glanceMotion?entry.pitch.update(inclined+(entry.crouchRig?0:.13*entry.lowWeight),step,floating?7.5:20):
        entry.pitch.reset(clamp((underwater?1.12:.56)*w+(floating?aim:0),-1.2,1.72)).value;
      const bankTarget=airborne?clamp(-turnRate*(.055+.085*w),-.52,.52)*(mode==='descend'?.35:atTable?.8:1):
        swimming?clamp(-turnRate*.12,-.34,.34):0;
      const bankValue=glanceMotion?entry.bank.update(bankTarget,step,airborne||swimming?10:18):entry.bank.reset().value;
      const lift=entry.lift.update(floating||Math.abs(pitchValue)>.02?1:0,step);
      // Float shoulder deep. Over a near bed the tucked legs set the limit.
      const sinkTarget=underwater&&entry.medium==='surface'&&entry.airRig?Math.min(.36-.12*w,Math.max(0,sample.feet-sample.ground+.28)):0;
      const sink=glanceMotion?entry.sink.update(sinkTarget,step):entry.sink.reset(sinkTarget).value;
      const trunk=glanceMotion&&standing&&!underwater?1:0;
      // A hard stop plants and leans back against the momentum, like a skid.
      const trunkPitch=entry.lean.update(trunk*(clamp(.009*thrust,-.13,.04)+.10*absorbing-.62*braking+.07*entry.wadeWeight),step);
      const trunkRoll=entry.sway.update(trunk*clamp(-turnRate*entry.planarSpeed*.010,-.17,.17),step);
      const trunkLead=entry.lead.update(trunk*clamp(-airYaw*.45,-.5,.5),step);

      // Legs into the line of travel; past the side the gait backs away.
      const stepping=glanceMotion&&standing&&!underwater&&!atTable&&Boolean(entry.directional);
      const gaitTravel=gaitDirection(heading,entry.gaitBackward);
      if(!stepping)entry.gaitBackward=false;
      else if(entry.planarSpeed>.35)entry.gaitBackward=gaitTravel.backward;
      const hips=stepping?entry.hips.update(gaitTravel.hips*clamp((entry.planarSpeed-.25)/.9),step):entry.hips.reset().value;
      entry.directional?.apply(character,hips);

      const trick=isLocal&&outdoor&&glanceMotion&&!explicitFlight&&grounded===false&&trickAge<TRICK_SECONDS;
      if(trick&&(!entry.trick||trickAge<entry.trickAge))entry.trick=dealt(entry,'tricks',TRICKS);
      entry.trickAge=trick?trickAge:Infinity;
      if(!trick)entry.trick=null;
      const settled=!trick&&w<.01&&entry.hoverWeight<.01&&entry.lowWeight<.01&&entry.airWeight<.01&&
        entry.lowerWeight<.01&&entry.wadeWeight<.01&&dip<.002&&sink<.002&&
        Math.abs(pitchValue)<.002&&Math.abs(bankValue)<.001&&Math.abs(airYaw)<.001&&
        Math.abs(trunkPitch)+Math.abs(trunkRoll)+Math.abs(trunkLead)+Math.abs(aim)<.003;
      const resting=(entry.idleRig||entry.repertoire)&&glanceMotion&&settled&&grounded===true&&!active&&!low&&
        actor.animationState===0&&(actor.animationWeights?.[0]??1)>.9&&speed<.14&&entry.planarSpeed<.14;
      entry.idleDwell=resting?entry.idleDwell+step:0;
      const idleTarget=entry.idleDwell>=.32?1:0;
      entry.idleWeight=glanceMotion?
        entry.idleWeight+(idleTarget-entry.idleWeight)*ease(step,idleTarget?4:24):0;
      entry.idleTime=resting||entry.idleWeight>.001?entry.idleTime+step:0;
      const idle=()=>{
        if(entry.idleWeight<=.001)return;
        entry.idleRig?.apply(character,entry.idleTime+entry.idlePhase,entry.idleWeight,
          Math.max(entry.idleDwell,0),entry.idlePhase);
        // Phrases follow the dwell; leaving rest fades them with the idle.
        entry.repertoire?.apply(character,Math.max(entry.idleDwell,entry.idleTime),entry.idleWeight,entry.idlePhase);
      };
      if(settled){
        idle();
        playLanding();
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
      // Only a chosen crouch is stealth; landing and braking dips stay plain.
      entry.crouchRig?.apply(character,crouchWeight*groundBlend,entry.lowWeight*(1-entry.lowerWeight)*groundBlend);
      // The movement controller keeps a signed pitch through the vertical.
      // The model's vertical rest frame starts 90 degrees from cruise.
      // The pilot lies out along the camera only while travelling. Launching,
      // hovering and climbing in place it stands tall, fist to the sky.
      const aerobatic=isLocal&&floating&&Number.isFinite(loopPitch);
      const pilot=isLocal&&explicitFlight&&aerobatic;
      const outstretched=glanceMotion?entry.outstretched.update(aerobatic&&mode==='hover'?clamp((Math.max(entry.planarSpeed,entry.flightSpeed)-.6)/2.4)*clamp(ahead):0,step):
        entry.outstretched.reset(aerobatic&&mode==='hover'?1:0).value;
      // Snap into the trick body, spin, then open out before the ground.
      const trickProgress=trick?trickAge/TRICK_SECONDS:0;
      const tuck=trick?smooth(trickProgress/.18)*smooth((1-trickProgress)/.22):0;
      const spin=trick?smooth((trickProgress-.08)/.80):0;
      const flip=trick?2*Math.PI*entry.trick.flip*spin:0;
      // The camera's pitch steers only the forward part of the travel.
      // Backing away, the pilot stands up and leans back instead of lying out.
      const piloted=aerobatic?Math.PI/2-loopPitch*Math.cos(headFirst):pitchValue;
      pitch.setFromAxisAngle(pitchAxis,pitchValue+(piloted-pitchValue)*outstretched+flip);
      entry.rotation=character.quaternion;
      entry.unpitched.copy(entry.rotation);
      if(airYaw&&!pilot)entry.rotation.multiply(yaw.setFromAxisAngle(yawAxis,airYaw));
      if(headFirst)entry.rotation.multiply(yaw.setFromAxisAngle(yawAxis,headFirst));
      if(entry.lowWeight>0||entry.hoverWeight>0||w>0){
        character.getWorldQuaternion(bodyFacing);
        right.copy(pitchAxis).applyQuaternion(bodyFacing);
      }
      // Lean into a sideways travel about the body's own forward axis.
      tilt.setFromAxisAngle(rollAxis,-sideLean).multiply(pitch);
      if(bankValue)tilt.multiply(roll.setFromAxisAngle(pilot?yawAxis:rollAxis,bankValue));
      if(trick&&entry.trick.roll)tilt.multiply(roll.setFromAxisAngle(rollAxis,2*Math.PI*entry.trick.roll*spin));
      if(trick&&entry.trick.twist)tilt.multiply(roll.setFromAxisAngle(yawAxis,2*Math.PI*entry.trick.twist*spin));
      entry.rotation.multiply(tilt);
      entry.applied.copy(entry.rotation);
      if(entry.airRig&&(lift>.002||sink>.002||trick)){
        // Offset the model inside its character, so the hips hold their place
        // and the physical position, camera target and name stay untouched.
        tilt.invert();
        pivot.set(0,hipHeight*(trick?1:lift),0);
        shift.copy(pivot).applyQuaternion(tilt).sub(pivot);
        shift.add(cross.set(0,-sink,0).applyQuaternion(tilt));
        entry.shift.copy(shift);
        mesh.position.add(shift);
        entry.shifted=true;
      }
      const armWeight=Math.max(tuck,Math.min(1,entry.airWeight+entry.wadeWeight));
      const trickTorso=trick?Math.max(entry.airWeight,tuck):entry.airWeight;
      if(entry.airRig&&Math.max(armWeight,entry.lowerWeight)>.01){
        const wading=entry.airWeight<entry.wadeWeight;
        if(mode){
          entry.poseMode=mode;
          entry.poseTime=mode==='hover'||mode==='swim'?entry.loopTime:glanceMotion?entry.airTime:1;
        }else if(!floating&&entry.poseMode!=='land')entry.poseTime=entry.loopTime;
        const surface=underwater&&entry.medium==='surface';
        if(surface){
          // The waterline, measured where this body is.
          water.up.copy(up);
          water.point.copy(position).addScaledVector(up,draft);
          character.parent?.localToWorld(water.point);
        }
        entry.airRig.apply(character,{mode:trick?entry.trick.body:wading?'wade':entry.poseMode,time:trick?0:wading?entry.loopTime:entry.poseTime,
          forward:w,weight:armWeight,lowerWeight:Math.max(entry.lowerWeight,tuck),torsoWeight:trickTorso,step,
          bank:entry.airWeight*clamp(bankValue,-.5,.5),boost,boostRelease,style:entry.style,
          climb:mode==='hover'?clamp((entry.rise-1)/2.5)*(1-w):0,rest:entry.rest,restAmount,
          // Reach overhead only once the body lies along the surface.
          stroke:mode==='swim'?smooth((pitchValue-.45)/.5):0,strokeTime:entry.strokeTime,
          water:surface&&!wading?water:null});
      }
      idle();
      // Standing in the air the head follows the view, up and down.
      const viewPitch=pilot&&Number.isFinite(loopPitch)?clamp(-loopPitch*.75,-.7,.6)*(1-outstretched):0;
      entry.accents?.apply(character,trunkPitch+(floating?0:aim*.35),trunkLead,trunkRoll,floating?viewPitch:aim*.88);
      playLanding();
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
