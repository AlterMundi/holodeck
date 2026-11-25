import {AnimationClip,AnimationMixer,AnimationUtils,LoopOnce,Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {bindCompanionGait} from './companion-gait.mjs';
import {TabletopGlance} from './tabletop-attention.mjs';
import {Follower,clamp,ease,pulse,smooth} from './avatar-motion-curves.mjs';

const jawTravel=12/515;
const gaitClips=['walk','run','bound','wade'];
const cycles=['calm',...gaitClips,'hover','glide','tread','swim'];
const edges=['lift','landing'];
const gestures=['curious','welcome','brace','scan','sway','tinker','chirp'];
const idles=['scan','sway','tinker','chirp'];
const right=new Vector3(1,0,0),forward=new Vector3(0,0,1),vertical=new Vector3(0,1,0);
// Repeatable spacing between pauses, blinks and idle choices.
const scatter=index=>{const x=Math.sin(index*12.9898+4.1414)*43758.5453;return x-Math.floor(x);};

export async function loadCompanionFigure(url){
  const {scene:root,animations}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url.href);
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root.traverse(object=>{
    if(!object.isMesh)return;
    if(object.isSkinnedMesh){
      skeletons.add(object.skeleton);
      object.computeBoundingSphere();
      // Poses, leaps and the streaming cape reach past the bind bounds.
      object.boundingSphere.radius+=.40;
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
  const named=new Map(animations.map(clip=>[clip.name,clip]));
  const head=root.getObjectByName('head'),frame=root.getObjectByName('root');
  const hinge=root.getObjectByName('anchor-mouth');
  if(!hinge?.isBone||!frame||!head||![...cycles,...edges,...gestures].every(name=>named.has(name))){
    dispose();
    throw Error('Invalid Navegante asset');
  }
  const gait=bindCompanionGait(root);
  const glance=new TabletopGlance();
  const base=new Map(),shots=new Map(),layers=new Map();
  for(const name of cycles){
    const action=mixer.clipAction(named.get(name)).play().setEffectiveWeight(name==='calm'?1:0);
    if(gaitClips.includes(name))action.paused=true;
    base.set(name,{action,weight:name==='calm'?1:0});
  }
  for(const name of edges){
    const action=mixer.clipAction(named.get(name)).play().setEffectiveWeight(0);
    action.paused=true;
    shots.set(name,{action,time:Infinity,weight:0});
  }
  for(const name of gestures){
    const source=named.get(name);
    // Joints a gesture leaves at rest stay with the layer below it.
    const clip=AnimationUtils.makeClipAdditive(new AnimationClip(source.name,source.duration,source.tracks.map(track=>track.clone())));
    const action=mixer.clipAction(clip).setLoop(LoopOnce,1);
    layers.set(name,{action,weight:0,live:false});
  }
  const jawHeight=hinge.position.z,jawAngle=hinge.rotation.x;
  const eyes=['eye-L','eye-R'].map(name=>root.getObjectByName(name)).filter(Boolean);
  const frameRest=frame.quaternion.clone(),frameSpot=frame.position.clone();
  const tilt=new Quaternion(),roll=new Quaternion(),offset=new Vector3();
  const pitching=new Follower(8),rolling=new Follower(9),pivoting=new Follower(9);
  let contact=1,jaw=0,prior=null,clock=0,lively=0,choice=0,lastIdle=null,nextIdle=4.2,nextBlink=1.6,greeting=0;
  let wasAttending=false,attendedAt=-Infinity,lastSpeed=0;

  function start(name){
    const layer=layers.get(name);
    layer.action.reset().play();
    layer.live=true;
  }
  function quiet(){
    for(const layer of layers.values()){
      layer.live=false;layer.weight=0;layer.action.stop();
    }
    for(const shot of shots.values()){
      shot.time=Infinity;shot.weight=0;shot.action.setEffectiveWeight(0);
    }
    pitching.reset();rolling.reset();
    lively=0;lastSpeed=0;
  }
  const goals=Object.fromEntries(cycles.map(name=>[name,0]));
  function chooseGoals({medium,speed,motion,wading}){
    for(const name of cycles)goals[name]=0;
    if(medium==='surface'||medium==='submerged'){
      const advance=motion?smooth((speed-.22)/.9):0;
      goals.swim=advance;goals.tread=1-advance;
    }else if(medium==='air'){
      const advance=motion?smooth((speed-.35)/2.1):0;
      goals.glide=advance;goals.hover=1-advance;
    }else{
      const going=motion?smooth((speed-.05)/.24):0;
      const run=smooth((speed-1.15)/1.3),bound=smooth((speed-3.7)/1.9);
      const water=medium==='wade'?smooth((wading-.25)/.4):0;
      goals.calm=(1-going)*(1-water);
      goals.wade=water;
      goals.walk=going*(1-run)*(1-water);
      goals.run=going*run*(1-bound)*(1-water);
      goals.bound=going*run*bound*(1-water);
    }
  }

  return {root,dispose,gait,resetGlance:()=>glance.reset(),
    weights:()=>Object.fromEntries([...base].map(([name,{weight}])=>[name,weight])),
    gestures:()=>[...layers].filter(([,layer])=>layer.live).map(([name])=>name),
    greet(){greeting=3.2;},
    pose({seconds,level=0,speed=0,velocity,motion=true,medium='ground',wading=0,gaze=null,attending=false,
      reset=false,liftAllowed=true,place=null,pitch=0,bank=0,crouch=0,braking=0,miniature=false}){
      glance.restore();
      gait.restore();
      const step=Math.min(.1,Math.max(0,seconds));
      const fade=motion&&!reset?ease(step,9):1;
      const airborne=medium==='air',wet=medium==='surface'||medium==='submerged',supported=!airborne&&!wet;
      if(!motion||reset)quiet();
      else if(prior!==null&&prior!==medium){
        const wasAir=prior==='air';
        if(airborne!==wasAir){
          for(const shot of shots.values())shot.time=Infinity;
          if(airborne&&liftAllowed&&prior!=='submerged')shots.get('lift').time=0;
          else if(wasAir&&supported)shots.get('landing').time=0;
        }
      }
      prior=medium;
      if(reset)gait.reset();

      chooseGoals({medium,speed,motion,wading});
      let total=0;
      for(const [name,entry] of base){
        entry.weight+=(goals[name]-entry.weight)*fade;
        total+=entry.weight;
      }
      let edgeWeight=0;
      for(const shot of shots.values()){
        const length=shot.action.getClip().duration;
        // Quick into the edge, slow out of it. Locomotion can always take over.
        const target=shot.time<length?smooth(shot.time/.07)*smooth((length-shot.time)/(length*.45)):0;
        shot.weight=target*(supported?1-smooth((speed-.5)/1.6)*.75:1);
        shot.action.time=Math.min(length,shot.time);
        if(shot.time<length)shot.time+=step;
        edgeWeight+=shot.weight;
      }
      edgeWeight=Math.min(1,edgeWeight);
      for(const shot of shots.values())shot.action.setEffectiveWeight(shot.weight/Math.max(1,edgeWeight));

      if(supported&&motion)gait.advance({step,speed,velocity,place});
      else if(!supported||!motion)gait.reset();
      for(const [name,{action,weight}] of base){
        action.setEffectiveWeight(weight/Math.max(1e-6,total)*(1-edgeWeight));
        if(gaitClips.includes(name))action.time=gait.phase*action.getClip().duration;
      }
      base.get('swim').action.setEffectiveTimeScale(.72+.30*clamp(speed/4));
      base.get('glide').action.setEffectiveTimeScale(.8+.35*clamp(speed/7));

      // Gestures ride on the base pose. Each one has its own gate.
      clock+=step;
      if(motion){
        if(lastSpeed>1.9&&braking>5.2&&supported&&!layers.get('brace').live)start('brace');
        if(attending&&(!wasAttending||clock-attendedAt>5.4)&&speed<.6){start('curious');attendedAt=clock;}
        const calm=speed<.06&&!attending&&level<.02&&!miniature&&(medium==='ground'||airborne)&&crouch<.05;
        lively=calm?lively+step:0;
        if(greeting>0){
          greeting-=step;
          if(lively>.7){start('welcome');greeting=0;nextIdle=lively+5;}
        }else if(lively>nextIdle){
          choice++;
          const options=idles.filter(name=>name!==lastIdle&&(!airborne||name!=='sway'));
          lastIdle=options[Math.floor(scatter(choice)*options.length)];
          start(lastIdle);
          nextIdle=lively+layers.get(lastIdle).action.getClip().duration+3.4+4.6*scatter(choice+37);
        }
        if(lively===0)nextIdle=2.6+3.2*scatter(choice+11);
        for(const [name,layer] of layers){
          if(!layer.live&&layer.weight<.002)continue;
          const ended=!layer.action.isRunning();
          const allowed=name==='brace'||(name==='curious'?attending:calm);
          const target=layer.live&&allowed&&!ended?1:0;
          layer.weight+=(target-layer.weight)*ease(step,target?16:8);
          if(ended||!allowed&&layer.weight<.01){layer.live=false;layer.weight=0;layer.action.stop();}
          else layer.action.setEffectiveWeight(layer.weight);
        }
        wasAttending=attending;
      }
      lastSpeed=speed;
      if(motion)mixer.update(step);
      else mixer.setTime(0);

      // Tilt about the body in air and water, and about the feet on the ground.
      pitching.update(motion||wet?pitch:0,motion&&!reset?step:10);
      rolling.update(motion?bank:0,motion&&!reset?step:10);
      const pivot=pivoting.update(supported?0:.52,motion&&!reset?step:10);
      tilt.setFromAxisAngle(right,pitching.value).multiply(roll.setFromAxisAngle(forward,rolling.value));
      offset.copy(vertical).multiplyScalar(pivot);
      frame.position.copy(offset).negate().applyQuaternion(tilt).add(offset).add(frameSpot);
      frame.quaternion.copy(tilt).multiply(frameRest);

      const landing=shots.get('landing').weight;
      contact+=((supported&&motion?1:0)-contact)*(motion&&!reset?ease(step,landing>.1?30:16):1);
      if(contact>.001&&supported)gait.apply(contact,{crouch:crouch*(1-landing)});
      if(motion)glance.apply(root,head,gaze,step,1-goals.glide*.7-goals.swim*.6);
      else glance.reset();

      // The playback signal alone opens the jaw. Small bodies need a wider,
      // still bounded, opening to read at tabletop distance.
      const aperture=clamp(level)*(miniature?1.45:1);
      jaw=motion?jaw+(aperture-jaw)*ease(step,aperture>jaw?30:15):0;
      if(jaw<.004&&!aperture)jaw=0;
      hinge.position.z=jawHeight-jawTravel*jaw;
      hinge.rotation.x=jawAngle+.10*jaw;
      if(clock>nextBlink+.17)nextBlink=clock+1.9+3.6*scatter(Math.floor(clock*7));
      const closed=motion?pulse(clock-nextBlink,.05,.025,.09):0;
      for(const eye of eyes)eye.scale.z=(1-.9*closed)*(1+.10*jaw);
    }};
}
