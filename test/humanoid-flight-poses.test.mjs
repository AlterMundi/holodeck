import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Bone,Group,Matrix4,Quaternion,Skeleton,SkinnedMesh,Vector3} from 'three';
import {bindHumanoidCrouch} from '../src/humanoid-crouch.mjs';
import {bindFlightAvatarAnimation} from '../src/flight-avatar-animation.mjs';
import {bindHumanoidFlightRig} from '../src/humanoid-flight-poses.mjs';

function avatar(file){
  const bytes=readFileSync(new URL('../public/assets/'+file,import.meta.url));
  const length=bytes.readUInt32LE(12);
  const {nodes,skins,accessors,bufferViews,scenes}=JSON.parse(bytes.toString('utf8',20,20+length));
  const {joints,inverseBindMatrices}=skins[0];
  const bones=new Set(joints);
  const objects=nodes.map((entry,index)=>{
    const object=bones.has(index)?new Bone():new Group();
    object.name=entry.name;
    if(entry.translation)object.position.fromArray(entry.translation);
    if(entry.rotation)object.quaternion.fromArray(entry.rotation);
    if(entry.scale)object.scale.fromArray(entry.scale);
    return object;
  });
  nodes.forEach((entry,index)=>{for(const child of entry.children??[])objects[index].add(objects[child]);});
  const {bufferView,byteOffset=0,count}=accessors[inverseBindMatrices];
  const start=28+length+(bufferViews[bufferView].byteOffset??0)+byteOffset;
  const inverse=Array.from({length:count},(_,i)=>new Matrix4().fromArray(
    Array.from({length:16},(_,j)=>bytes.readFloatLE(start+i*64+j*4))));
  const root=new Group(),mesh=new SkinnedMesh();
  for(const node of scenes[0].nodes)mesh.add(objects[node]);
  mesh.skeleton=new Skeleton(joints.map(index=>objects[index]),inverse);
  root.add(mesh);
  return {root,mesh};
}

for(const file of ['avatar-1-bodyA-skin01.glb','avatar-2-bodyB-skin03.glb','avatar-3-bodyA-skin05.glb','avatar-4-bodyB-skin07.glb']){
  test('authored flight retargets and restores '+file,()=>{
    const {root,mesh}=avatar(file);
    root.setRotationFromQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),1.4));
    const rig=bindHumanoidFlightRig(mesh);
    assert.ok(rig);
    const left=mesh.getObjectByName('upperarm_l'), calf=mesh.getObjectByName('calf_l');
    const stock=left.quaternion.clone();
    const foot=mesh.getObjectByName('foot_l');
    const ankle=foot.position.clone();
    for(const mode of ['lift','hover','descend','land','swim']){
      for(let frame=0;frame<20;frame++){
        rig.restore();
        rig.apply(root,{mode,time:mode==='swim'?.10:.4,forward:.85,weight:1,lowerWeight:mode==='land'?0:1,step:.05});
      }
      assert.ok(left.quaternion.angleTo(stock)>.05,mode+' '+left.quaternion.angleTo(stock));
      assert.ok(left.quaternion.toArray().every(Number.isFinite));
      if(mode==='land')assert.ok(foot.position.equals(ankle));
      const target=mesh.getObjectByName('lowerarm_l').getWorldPosition(new Vector3()).sub(left.getWorldPosition(new Vector3()))
        .applyQuaternion(root.quaternion.clone().invert()).normalize();
      if(mode==='hover')assert.ok(target.x>.28&&target.y<-.35&&target.z<-.10);
      if(mode==='descend')assert.ok(target.y<-.5);
      assert.ok(calf.quaternion.toArray().every(Number.isFinite));
      rig.restore();
      assert.ok(left.quaternion.equals(stock));
      assert.ok(foot.position.equals(ankle));
    }
  });
  test('crouch retains scaled and rotated stock ankle positions for '+file,()=>{
    const {root,mesh}=avatar(file);
    root.rotateZ(.31);
    root.rotateY(1.29);
    root.position.set(1800,20,513);
    const rig=bindHumanoidCrouch(mesh);
    assert.ok(rig);
    const get=name=>mesh.getObjectByName(name);
    const feet=['foot_l','foot_r'].map(get);
    const thighs=['thigh_l','thigh_r'].map(get);
    const knees=['calf_l','calf_r'].map(get);
    const thighRest=thighs.map(thigh=>thigh.quaternion.clone());
    const lateral=new Vector3(1,0,0).applyQuaternion(root.quaternion);
    const forward=new Vector3(0,0,1).applyQuaternion(root.quaternion);
    const pelvis=get('pelvis');
    const up=new Vector3(0,1,0).applyQuaternion(root.quaternion);
    for(const scale of [.5,1,2]){
      root.scale.setScalar(scale);
      for(const stride of [0,.22,-.19]){
        thighs.forEach((thigh,side)=>{
          thigh.quaternion.copy(thighRest[side]);
          const local=lateral.clone().applyQuaternion(thigh.getWorldQuaternion(new Quaternion()).invert());
          thigh.rotateOnAxis(local,side?-stride:stride);
        });
        const ankles=feet.map(foot=>foot.getWorldPosition(new Vector3()));
        const orientations=feet.map(foot=>foot.getWorldQuaternion(new Quaternion()));
        const stockHip=pelvis.getWorldPosition(new Vector3());
        for(const weight of [.06,.12,.35,.6,1]){
          rig.apply(root,weight);
          const lower=stockHip.clone().sub(pelvis.getWorldPosition(new Vector3())).dot(up);
          assert.ok(lower>.12*scale*weight*weight);
          feet.forEach((foot,side)=>{
            assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(ankles[side])<.001*scale);
            assert.ok(foot.getWorldQuaternion(new Quaternion()).angleTo(orientations[side])<.001);
          });
          if(weight>=.35)knees.forEach((knee,side)=>{
            const hip=thighs[side].getWorldPosition(new Vector3());
            const axis=ankles[side].clone().sub(hip).normalize();
            const pole=knee.getWorldPosition(new Vector3()).sub(hip);
            pole.addScaledVector(axis,-pole.dot(axis));
            assert.ok(pole.dot(forward)>0);
          });
          rig.apply(root,weight);
          rig.restore();
          assert.ok(pelvis.getWorldPosition(new Vector3()).distanceTo(stockHip)<1e-6);
        }
      }
    }
  });

}

test('flight exit holds a descent until contact, then gives the feet back to the ground mixer',()=>{
  const {root,mesh}=avatar('avatar-1-bodyA-skin01.glb');
  root.getMesh=()=>mesh;
  const character={position:new Vector3(1800,498,11)};
  const state={characters:new Map([[1,character]]),localCharacterId:1};
  const manager={loadedCharacters:new Map([[1,{character:root}]]),update(){}};
  // Exact mixer handoff; terrain foot placement is covered in foot-placement.test.mjs.
  const controls={outdoor:true,grounded:true,flying:false,footPlacement:false};
  const release=bindFlightAvatarAnimation(manager,()=>controls);
  assert.equal(bindFlightAvatarAnimation(manager,()=>controls),release);
  const leg=mesh.getObjectByName('calf_l'),arm=mesh.getObjectByName('upperarm_l');
  const pelvis=mesh.getObjectByName('pelvis'),ankle=mesh.getObjectByName('foot_l');
  const hipHeight=()=>pelvis.getWorldPosition(new Vector3()).y;
  const standingHip=hipHeight(),standingAnkle=ankle.getWorldPosition(new Vector3());
  const assertPlanted=()=>{
    assert.ok(standingHip-hipHeight()>.18);
    assert.ok(ankle.getWorldPosition(new Vector3()).distanceTo(standingAnkle)<.001);
  };
  const stockLeg=leg.quaternion.clone(),stockArm=arm.quaternion.clone();
  const render=(frames,delta=0)=>{
    for(let i=0;i<frames;i++){
      character.position.y+=delta;
      manager.update(state,1/60);
    }
  };
  controls.crouch=true;
  render(65);
  assertPlanted();
  Object.assign(controls,{flying:true,grounded:false,crouch:false});
  render(45,.03);
  assert.ok(arm.quaternion.angleTo(stockArm)>.05,JSON.stringify([arm.quaternion.toArray(),stockArm.toArray()]));
  controls.flying=false;
  render(20,-.04);
  assert.ok(arm.quaternion.angleTo(stockArm)>.08);
  controls.grounded=true;
  render(1);
  assert.ok(arm.quaternion.angleTo(stockArm)>.03);
  render(9);
  // The absorbing legs stay on the mixer's contact while the hips give.
  assert.ok(standingHip-hipHeight()>.02);
  assert.ok(ankle.getWorldPosition(new Vector3()).sub(root.position).distanceTo(standingAnkle)<.012);
  render(100);
  assert.ok(leg.quaternion.equals(stockLeg));
  assert.ok(arm.quaternion.equals(stockArm));
  assert.ok(Math.abs(standingHip-hipHeight())<1e-6);
  controls.crouch=true;
  render(100);
  assertPlanted();
  release();
  assert.ok(Math.abs(hipHeight()-standingHip)<1e-6);
});

test('a peer follows scoped crouch and flight cues and releases them on the base animation state',()=>{
  const {root,mesh}=avatar('avatar-2-bodyB-skin03.glb');
  root.getMesh=()=>mesh;
  const peer={position:new Vector3(1800,498,11),animationState:0};
  const state={characters:new Map([[7,peer]]),localCharacterId:1};
  const manager={loadedCharacters:new Map([[7,{character:root}]]),update(){}};
  const peerPoses=new Map();
  const controls={outdoor:true,grounded:false,flying:false,peerPoses};
  const release=bindFlightAvatarAnimation(manager,()=>controls);
  const pelvis=mesh.getObjectByName('pelvis'),arm=mesh.getObjectByName('upperarm_l');
  const height=()=>pelvis.getWorldPosition(new Vector3()).y;
  const stockHip=height(),stockArm=arm.quaternion.clone();
  const frames=count=>{for(let n=0;n<count;n++)manager.update(state,1/60);};
  peerPoses.set(7,'crouch');
  frames(80);
  assert.ok(stockHip-height()>.15);
  peer.animationState=4;
  frames(80);
  assert.ok(Math.abs(height()-stockHip)<.001);
  peerPoses.set(7,'fly');
  frames(60);
  assert.ok(arm.quaternion.angleTo(stockArm)>.05);
  const hover=arm.quaternion.clone();
  peerPoses.set(7,'fly-fast');
  frames(26);
  const fast=arm.quaternion.clone();
  assert.ok(fast.angleTo(hover)>.30);
  peerPoses.set(7,'fly');
  frames(80);
  assert.ok(arm.quaternion.angleTo(fast)>.30);
  peerPoses.clear();
  peer.animationState=5;
  frames(100);
  assert.ok(arm.quaternion.equals(stockArm));
  release();
});

test('airborne humanoid eases heading changes on a radial frame and releases bank at contact',()=>{
  const {root,mesh}=avatar('avatar-1-bodyA-skin01.glb');
  root.getMesh=()=>mesh;
  const actor={position:new Vector3(1800,498.8,11),animationState:4};
  const state={characters:new Map([[1,actor]]),localCharacterId:1};
  const controls={outdoor:true,grounded:false,flying:true,glanceMotion:true};
  const radial=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.63);
  const along=new Vector3(0,0,1),vertical=new Vector3(0,1,0),lateral=new Vector3(1,0,0);
  const desired=new Quaternion(),stock=new Quaternion();
  const manager={loadedCharacters:new Map([[1,{character:root}]]),update(){root.quaternion.copy(stock);}};
  const release=bindFlightAvatarAnimation(manager,()=>controls);
  const frame=(yaw,dt=1/60)=>{
    stock.copy(radial).multiply(desired.setFromAxisAngle(vertical,yaw));
    manager.update(state,dt);
    return radial.clone().invert().multiply(root.quaternion);
  };
  const angle=q=>{
    const forward=along.clone().applyQuaternion(q);
    return Math.atan2(forward.x,forward.z);
  };
  const bank=q=>{
    const heading=new Quaternion().setFromAxisAngle(vertical,angle(q));
    return vertical.clone().applyQuaternion(q).dot(lateral.clone().applyQuaternion(heading));
  };
  frame(0);
  // A damped turn: it starts gently, banks inward, settles without overshoot.
  const first=angle(frame(Math.PI/2));
  assert.ok(first>0&&first<.10);
  let stable,previous=first,peakBank=0,settledAt=null,peakStep=0;
  for(let i=0;i<110;i++){
    stable=frame(Math.PI/2);
    const at=angle(stable);
    assert.ok(at>=previous-1e-6&&at<Math.PI/2+.035);
    peakStep=Math.max(peakStep,at-previous);
    previous=at;
    peakBank=Math.max(peakBank,bank(stable));
    if(settledAt===null&&Math.PI/2-at<.035)settledAt=i/60;
  }
  assert.ok(settledAt>.4&&settledAt<1.1,String(settledAt));
  assert.ok(peakStep<.12);
  assert.ok(peakBank>.15&&peakBank<.53,String(peakBank));
  assert.ok(Math.abs(angle(stable)-Math.PI/2)<.002);
  assert.ok(Math.abs(bank(stable))<.002);
  let left;
  for(let i=0;i<14;i++)left=frame(0);
  assert.ok(angle(left)>.2&&angle(left)<1.4&&bank(left)<-.02);

  controls.glanceMotion=false;
  const quiet=frame(-.4);
  assert.ok(Math.abs(bank(quiet))<.001&&Math.abs(angle(quiet)+.4)<.001);
  controls.glanceMotion=true;
  actor.position.z+=20;
  const afterJump=frame(.9);
  assert.ok(Math.abs(angle(afterJump)-.9)<.001&&Math.abs(bank(afterJump))<.001);
  for(let i=0;i<90;i++)frame(Math.PI-.04);
  // The short way across the seam, not a turn through the front.
  let across;
  for(let i=0;i<10;i++){
    across=frame(-Math.PI+.04);
    assert.ok(Math.abs(angle(across))>Math.PI-.05);
  }
  for(let i=0;i<5;i++)frame(0);
  Object.assign(controls,{grounded:true,flying:false});
  let ground;
  for(let i=0;i<55;i++)ground=frame(0);
  assert.ok(Math.abs(angle(ground))<.001&&Math.abs(bank(ground))<.01);
  release();
  assert.ok(root.quaternion.angleTo(stock)<.001);
});

test('standing idle animates supported humanoids and releases without moving either foot',()=>{
  for(const file of ['avatar-1-bodyA-skin01.glb','avatar-2-bodyB-skin03.glb','avatar-3-bodyA-skin05.glb','avatar-4-bodyB-skin07.glb']){
    const {root,mesh}=avatar(file);
    root.rotateZ(.48);
    root.rotateY(1.3);
    root.getMesh=()=>mesh;
    const id=7;
    const actor={position:new Vector3(),animationState:0,animationWeights:{0:.8}};
    const state={characters:new Map([[id,actor]]),localCharacterId:id};
    const head=mesh.getObjectByName('head'),chest=mesh.getObjectByName('spine_05');
    const stockHead=head.quaternion.clone(),stockChest=chest.quaternion.clone();
    // The repertoire moves the hips (weight shift, squat); the feet stay put.
    const contacts=['foot_l','foot_r'].map(name=>{
      const bone=mesh.getObjectByName(name);
      return [bone,bone.getWorldPosition(new Vector3()),bone.getWorldQuaternion(new Quaternion()).normalize()];
    });
    const manager={
      loadedCharacters:new Map([[id,{character:root}]]),
      update(){
        assert.ok(head.quaternion.equals(stockHead),file);
        assert.ok(chest.quaternion.equals(stockChest),file);
      },
    };
    const controls={grounded:true};
    const release=bindFlightAvatarAnimation(manager,()=>controls);
    const frames=(count,positionDelta=0)=>{
      for(let frame=0;frame<count;frame++){
        actor.position.x+=positionDelta;
        manager.update(state,1/60);
      }
    };
    frames(48);
    assert.ok(head.quaternion.equals(stockHead));
    actor.animationWeights[0]=1;
    frames(18);
    assert.ok(head.quaternion.equals(stockHead));
    let peak=0;
    for(let frame=0;frame<600;frame++){
      frames(1);
      peak=Math.max(peak,head.quaternion.angleTo(stockHead));
      for(const [bone,position,rotation] of contacts){
        assert.ok(bone.getWorldPosition(new Vector3()).distanceTo(position)<1e-5);
        assert.ok(bone.getWorldQuaternion(new Quaternion()).normalize().angleTo(rotation)<1e-5);
      }
    }
    assert.ok(peak>.045,file);
    actor.animationState=1;
    frames(24,.03);
    // Idle is gone. The remaining trunk accent belongs to the acceleration.
    assert.ok(head.quaternion.angleTo(stockHead)<.12);
    actor.animationState=0;
    frames(100);
    assert.ok(!head.quaternion.equals(stockHead));
    const beforeUnsupported=head.quaternion.clone();
    controls.grounded=false;
    frames(1);
    assert.ok(!head.quaternion.equals(stockHead));
    assert.ok(head.quaternion.angleTo(beforeUnsupported)<.04);
    controls.grounded=true;
    frames(65);
    controls.glanceMotion=false;
    frames(1);
    assert.ok(head.quaternion.equals(stockHead));
    controls.glanceMotion=true;
    controls.grounded=false;
    frames(100);
    assert.ok(head.quaternion.equals(stockHead));
    controls.grounded=true;
    frames(65);
    release();
    assert.ok(head.quaternion.equals(stockHead));
  }
});

test('microphone affects only the local jaw and restores old skins or disabled motion',()=>{
  function model(){
    const {root,mesh}=avatar('avatar-1-bodyA-skin01.glb');
    mesh.morphTargetDictionary={jawOpen:0};
    mesh.morphTargetInfluences=[0];
    const faceGroup=new Group();
    faceGroup.add(new SkinnedMesh(),mesh);
    root.add(faceGroup);
    root.getMesh=()=>faceGroup;
    return {root,mesh};
  }
  const local=model(),peer=model(),replacement=model();
  const actors=new Map([local,peer].map((_,id)=>[id,{position:new Vector3(),animationState:0}]));
  const state={characters:actors,localCharacterId:0};
  const controls={grounded:true,microphoneLevel:.75};
  const manager={loadedCharacters:new Map([[0,{character:local.root}],[1,{character:peer.root}]]),
    update(){assert.equal(local.mesh.morphTargetInfluences[0],0);}};
  const unbind=bindFlightAvatarAnimation(manager,()=>controls);
  const frames=count=>{for(let i=0;i<count;i++)manager.update(state,1/60);};
  frames(12);
  assert.ok(local.mesh.morphTargetInfluences[0]>.5);
  assert.equal(peer.mesh.morphTargetInfluences[0],0);
  controls.microphoneLevel=0;
  frames(1);
  assert.ok(local.mesh.morphTargetInfluences[0]>.4&&local.mesh.morphTargetInfluences[0]<.585);
  frames(45);
  assert.equal(local.mesh.morphTargetInfluences[0],0);
  controls.microphoneLevel=.75;
  frames(12);
  manager.loadedCharacters.set(0,{character:replacement.root});
  frames(12);
  assert.equal(local.mesh.morphTargetInfluences[0],0);
  assert.ok(replacement.mesh.morphTargetInfluences[0]>.5);
  controls.glanceMotion=false;
  frames(1);
  assert.equal(replacement.mesh.morphTargetInfluences[0],0);
  controls.glanceMotion=true;
  frames(12);
  unbind();
  assert.equal(replacement.mesh.morphTargetInfluences[0],0);
});
