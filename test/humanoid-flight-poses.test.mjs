import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Bone,Group,Matrix4,Quaternion,Skeleton,SkinnedMesh,Vector3} from 'three';
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
}

test('flight exit holds a descent until contact, then gives the feet back to the ground mixer',()=>{
  const {root,mesh}=avatar('avatar-1-bodyA-skin01.glb');
  root.getMesh=()=>mesh;
  const character={position:new Vector3(1800,498,11)};
  const state={characters:new Map([[1,character]]),localCharacterId:1};
  const manager={loadedCharacters:new Map([[1,{character:root}]]),update(){}};
  const controls={outdoor:true,grounded:true,flying:false};
  const release=bindFlightAvatarAnimation(manager,()=>controls);
  assert.equal(bindFlightAvatarAnimation(manager,()=>controls),release);
  const leg=mesh.getObjectByName('calf_l'),arm=mesh.getObjectByName('upperarm_l');
  const stockLeg=leg.quaternion.clone(),stockArm=arm.quaternion.clone();
  const render=(frames,delta=0)=>{
    for(let i=0;i<frames;i++){
      character.position.y+=delta;
      manager.update(state,1/60);
    }
  };
  render(10);
  Object.assign(controls,{flying:true,grounded:false});
  render(45,.03);
  assert.ok(arm.quaternion.angleTo(stockArm)>.05,JSON.stringify([arm.quaternion.toArray(),stockArm.toArray()]));
  controls.flying=false;
  render(20,-.04);
  assert.ok(arm.quaternion.angleTo(stockArm)>.08);
  controls.grounded=true;
  render(1);
  assert.ok(arm.quaternion.angleTo(stockArm)>.03);
  render(10);
  assert.ok(leg.quaternion.angleTo(stockLeg)<.04);
  render(80);
  assert.ok(arm.quaternion.equals(stockArm));
  release();
});
