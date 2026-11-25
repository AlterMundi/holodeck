import assert from 'node:assert/strict';
import test from 'node:test';
import {Quaternion,Vector3} from 'three';
import {COMPANION_BODY,HUMAN_BODY,avatarMedium} from '../src/avatar-medium.mjs';
import {Follower,keyed} from '../src/avatar-motion-curves.mjs';
import {TOROIDAL_TERRAIN} from '../src/toroidal-terrain.mjs';
import {groundRoute} from '../tools/avatar-motion/companion-samples.mjs';
import {loadCompanion,presentation} from '../tools/avatar-motion/rig.mjs';
import {runSequence} from '../tools/avatar-motion/sequence.mjs';

test('medium edges follow depth with hysteresis for each body',()=>{
  const at=(body,feet,ground,options)=>avatarMedium(body,{feet,ground,waterLevel:-9},options);
  const standing={supported:true};
  assert.equal(at(HUMAN_BODY,-9.1,-9.1,standing),'ground');
  assert.equal(at(HUMAN_BODY,-9.3,-9.3,standing),'wade');
  assert.equal(at(HUMAN_BODY,-9.8,-9.8,standing),'wade');
  // Floating at draft is nominally supported and must still read as water.
  assert.equal(at(HUMAN_BODY,-9.96,-14,standing),'surface');
  assert.equal(at(HUMAN_BODY,-9.85,-9.85,{...standing,previous:'wade'}),'wade');
  assert.equal(at(HUMAN_BODY,-9.85,-9.85,{...standing,previous:'surface'}),'surface');
  assert.equal(at(HUMAN_BODY,-9.77,-9.77,{...standing,previous:'surface'}),'wade');
  assert.equal(at(HUMAN_BODY,-10.4,-14,{previous:'surface'}),'submerged');
  assert.equal(at(HUMAN_BODY,-10.32,-14,{previous:'submerged'}),'submerged');
  assert.equal(at(HUMAN_BODY,-10.32,-14,{previous:'surface'}),'surface');
  assert.equal(at(HUMAN_BODY,-5,-14),'air');
  assert.equal(at(COMPANION_BODY,-9.86,-14,standing),'surface');
  assert.equal(at(COMPANION_BODY,-9.5,-9.5,standing),'wade');
  assert.equal(at(COMPANION_BODY,3,3,{supported:true}),'ground');
  assert.equal(avatarMedium(COMPANION_BODY,{feet:0,ground:0,waterLevel:-Infinity},standing),'ground');
});

test('followers and keyed holds do not depend on the frame rate',()=>{
  const run=fps=>{const f=new Follower(8);for(let i=0;i<fps/2;i++)f.update(1,1/fps);return f.value;};
  assert.ok(Math.abs(run(20)-run(120))<1e-9);
  const keys=[[0,[0]],[.5,[1]],[1,[1]],[1.5,[0]]],out=[0];
  for(const time of [.5,.62,.8,1])assert.equal(keyed(keys,time,out,2)[0],1);
  for(let time=0;time<2;time+=.01)assert.ok(keyed(keys,time,out,2)[0]>=-1e-9&&out[0]<=1+1e-9);
  assert.ok(Math.abs(keyed(keys,1.9999,out,2)[0]-keyed(keys,.0001,[0],2)[0])<.01);
});

for(const options of [{playerSpeed:.6},{playerSpeed:1.65},{playerSpeed:5},{playerSpeed:5,turn:1.2},
  {playerSpeed:5,outdoor:true,seconds:9},{playerSpeed:8,outdoor:true,seconds:10},
  {playerSpeed:8,outdoor:true,seconds:10,fps:20}]){
  test('companion contacts hold and keep pace '+JSON.stringify(options),async()=>{
    const result=await groundRoute(options);
    const note=JSON.stringify(result);
    assert.equal(result.teleports,0,note);
    assert.ok(result.lag<5,note);
    assert.ok(result.worstDrift<.005,note);
    assert.ok(result.contacts>12,note);
    assert.ok(result.spread>.25,note);
    assert.ok(result.lowest>-.015,note);
    assert.ok(Math.abs(result.sole)<.01,note);
    assert.ok(result.travelled>options.playerSpeed*3,note);
  });
}

const still=(avatar,seconds,extra={},each=()=>{})=>{
  for(let i=0;i<seconds*60;i++){
    avatar.update({position:new Vector3(0,0,0),yaw:0,outdoor:false,table:null,visible:true,seconds:1/60,...extra});
    each(i/60);
  }
};

test('a standing companion pauses, gestures, blinks and returns to rest with planted feet',async()=>{
  const {avatar}=await loadCompanion();
  const {figure}=avatar,seen=new Set();
  let blinked=1;
  const toes=figure.gait.limbs.map(()=>null);
  let drift=0;
  still(avatar,60,{},time=>{
    for(const name of figure.gestures())seen.add(name);
    blinked=Math.min(blinked,figure.root.getObjectByName('eye-L').scale.z);
    if(time<3)return;
    figure.root.updateWorldMatrix(true,true);
    figure.gait.limbs.forEach((limb,index)=>{
      const point=limb.foot.localToWorld(new Vector3(0,-.115,-.126));
      if(toes[index])drift=Math.max(drift,point.distanceTo(toes[index]));
      toes[index]??=point;
    });
  });
  assert.ok(seen.has('welcome'));
  assert.ok(['scan','sway','tinker','chirp'].filter(name=>seen.has(name)).length>=3,[...seen].join());
  assert.ok(blinked<.25);
  assert.ok(drift<.005,String(drift));
});

test('attention interrupts idle, leads with the head and then turns the body',async()=>{
  const {avatar}=await loadCompanion();
  const {root}=avatar.figure;
  still(avatar,3);
  const before=new Vector3(0,0,1).applyQuaternion(root.quaternion);
  // Well to one side of where it was looking.
  const subject=root.position.clone().addScaledVector(new Vector3(0,1,0).cross(before),3).setY(.7);
  avatar.attend(point=>point.copy(subject));
  const head=root.getObjectByName('head');
  const facing=()=>new Vector3(0,0,1).applyQuaternion(root.quaternion).dot(before);
  const rest=head.quaternion.clone();
  still(avatar,.2);
  assert.ok(head.quaternion.angleTo(rest)>.06);
  const early=facing();
  assert.ok(early>.8,String(early));
  still(avatar,1.6);
  assert.ok(avatar.figure.gestures().includes('curious'));
  const direction=subject.clone().sub(root.position).setY(0).normalize();
  assert.ok(new Vector3(0,0,1).applyQuaternion(root.quaternion).dot(direction)>.95);
});

test('speech owns the jaw at either size, and reduced motion keeps it and the body still',async()=>{
  const {avatar,document}=await loadCompanion();
  const jaw=avatar.figure.root.getObjectByName('anchor-mouth');
  const rest=jaw.position.z;
  const speak=()=>avatar.setSpeechLevel(1);
  still(avatar,.6,{},speak);
  const full=rest-jaw.position.z;
  assert.ok(Math.abs(full-12/515)<.0004,String(full));
  avatar.setSpeechLevel(0);
  still(avatar,.8);
  assert.ok(Math.abs(jaw.position.z-rest)<1e-6);
  const {Box3}=await import('three');
  const table={active:true,bounds:new Box3(new Vector3(-1,.8,-.7),new Vector3(1,2,.7))};
  still(avatar,.8,{table,position:new Vector3(0,1,0)},speak);
  const miniature=rest-jaw.position.z;
  assert.ok(miniature>full*1.3&&miniature<full*1.5);
  document.media.matches=true;
  still(avatar,.2,{},speak);
  assert.equal(jaw.position.z,rest);
  const bones=[];
  avatar.figure.root.traverse(object=>{if(object.isBone)bones.push([object,object.quaternion.clone(),object.position.clone()]);});
  still(avatar,6,{},speak);
  for(const [bone,rotation,position] of bones){
    assert.ok(bone.quaternion.toArray().every((value,index)=>Math.abs(value-rotation.toArray()[index])<1e-6)&&
      bone.position.distanceTo(position)<1e-9,bone.name);
  }
  assert.deepEqual(avatar.figure.gestures(),[]);
});

for(const [file,peer,fps] of [['avatar-1-bodyA-skin01.glb',false,60],['avatar-2-bodyB-skin03.glb',false,60],
  ['avatar-1-bodyA-skin01.glb',true,30],['avatar-2-bodyB-skin03.glb',false,20]]){
  test(`continuous route ${file} ${peer?'peer':'local'} at ${fps} fps`,async()=>{
    const {waterLevel}=TOROIDAL_TERRAIN;
    const seen=new Map(),point=new Vector3(),up=new Vector3(),upright=new Vector3(),side=new Vector3();
    let worstHand=-Infinity,peakBank=0,peakPitch=0,lowestHip=Infinity,submergedPitch=0,worstStep=0,previous=null,previousName;
    let bankSpeed=0,wadeHand=-Infinity,duckedRobot=0,afloat=0,swum=0;
    const result=await runSequence({file,peer,fps,onFrame({name,phase,dt,root,mesh,avatar}){
      up.set(0,1,0).applyQuaternion(root.quaternion);
      const depthOf=bone=>{
        mesh.getObjectByName(bone).getWorldPosition(point).sub(root.position);
        // Use the radial up at the body, independent of its drawn tilt.
        return point.dot(upright);
      };
      upright.copy(root.position).sub(point.set(root.position.x,0,root.position.z).setLength(TOROIDAL_TERRAIN.majorRadius)).normalize();
      const feet=root.position.distanceTo(point.set(root.position.x,0,root.position.z).setLength(TOROIDAL_TERRAIN.majorRadius))-TOROIDAL_TERRAIN.tubeRadius;
      const draft=waterLevel-feet;
      seen.set(name,(seen.get(name)??new Set()).add(avatar.medium));
      // Over a shoal the same route is a wade. Judge strokes only afloat,
      // after the arms had a quarter second to come down from wading.
      afloat=draft>.95&&draft<1.05?afloat+dt:0;
      if(afloat>.25){
        swum+=dt;
        for(const hand of ['hand_l','hand_r'])worstHand=Math.max(worstHand,depthOf(hand)-draft);
      }
      if(name==='wade'&&draft>.75)wadeHand=Math.max(wadeHand,depthOf('hand_l')-draft);
      if(name==='bank'){
        side.set(1,0,0).applyQuaternion(root.quaternion);
        peakBank=Math.max(peakBank,Math.abs(Math.asin(Math.max(-1,Math.min(1,side.dot(upright))))));
      }
      if(name==='glide')peakPitch=Math.max(peakPitch,Math.acos(Math.min(1,up.dot(upright))));
      if(name==='submerged')submergedPitch=Math.max(submergedPitch,Math.acos(Math.min(1,up.dot(upright))));
      if(name==='touchdown')lowestHip=Math.min(lowestHip,depthOf('pelvis'));
      // No visible snap of the drawn body between neighbouring frames.
      const drawn=root.quaternion.clone();
      if(previous&&previousName!=='descend'&&name!=='shore')worstStep=Math.max(worstStep,previous.angleTo(drawn)*fps);
      previous=drawn;previousName=name;
      for(const value of mesh.getObjectByName('head').matrixWorld.elements)if(!Number.isFinite(value))throw Error('Non-finite pose in '+name);
      if(name==='crouch'&&phase>.8)duckedRobot=Math.max(duckedRobot,.43-avatar.figure.root.getObjectByName('hips').position.z);
    }});
    const note=JSON.stringify({worstHand,peakBank,peakPitch,lowestHip,submergedPitch,worstStep,wadeHand,duckedRobot,cost:result.cost});
    assert.ok(worstHand<0&&swum>3,note);
    assert.ok(peakBank>.26&&peakBank<.57,note);
    assert.ok(peakPitch>.35&&peakPitch<.9,note);
    assert.ok(submergedPitch>.9,note);
    assert.ok(lowestHip<.90,note);
    assert.ok(worstStep<9,note);
    assert.ok(duckedRobot>.04,note);
    if(!peer)assert.ok(result.cost.human<1&&result.cost.companion<1,note);
    assert.ok(seen.get('walk').has('ground')&&seen.get('glide').has('air'),[...seen.get('glide')].join());
    assert.ok(seen.get('tread').has('surface')&&seen.get('submerged').has('submerged'),[...seen.get('submerged')].join());
    assert.ok(seen.get('touchdown').has('ground'));
    assert.ok([...seen.get('ashore')].some(medium=>medium==='ground'||medium==='wade'),[...seen.get('ashore')].join());
  });
}

test('reduced motion keeps the human pose static in each medium and adds no accents',async()=>{
  let tilt=null,moved=0,checked=0;
  await runSequence({reduced:true,onFrame({name,phase,root,mesh,avatar}){
    assert.deepEqual(avatar.figure.gestures(),[]);
    if(name==='hover'&&phase>1.2||name==='tread'&&phase>1.6){
      const arm=mesh.getObjectByName('upperarm_l').quaternion.clone();
      if(tilt&&tilt.name===name)moved=Math.max(moved,arm.angleTo(tilt.arm));
      tilt={name,arm};checked++;
    }else tilt=null;
    if(name==='bank'){
      const side=new Vector3(1,0,0).applyQuaternion(root.quaternion);
      const base=root.position.clone().sub(new Vector3(root.position.x,0,root.position.z).setLength(TOROIDAL_TERRAIN.majorRadius)).normalize();
      assert.ok(Math.abs(side.dot(base))<.01);
    }
  }});
  assert.ok(checked>20);
  assert.ok(moved<.03,String(moved));
});

test('stacked passes hand every bone back to the mixer',async()=>{
  const stock=new Map();
  await runSequence({onFrame({name,phase,mesh}){
    if(name==='stop'&&phase>1.2&&!stock.size)mesh.traverse(object=>{if(object.isBone)stock.set(object.name,object.position.clone());});
    if(name==='ashore'&&phase>1.8)for(const [bone,position] of stock){
      const now=mesh.getObjectByName(bone).position;
      if(bone!=='pelvis')assert.ok(now.distanceTo(position)<1e-6,bone);
    }
    assert.ok(mesh.position.length()<1.6);
    if(name==='ashore'&&phase>1.8)assert.ok(mesh.position.length()<.002,String(mesh.position.length()));
  }});
  assert.ok(stock.size>80);
  assert.ok(new Quaternion().length()===1);
});
