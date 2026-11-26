import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3} from 'three';
import {MatterFlight,bindMatterFlight,bindMatterHologram,matterAvatarScale} from '../src/matter-flight.mjs';
import {bindFlightAvatarAnimation} from '../src/flight-avatar-animation.mjs';

test('a late-loading peer becomes translucent and restores its own material on exit',()=>{
  const character=new Group();
  const root=new Group();
  character.add(root);
  character.getMesh=()=>root;
  const manager={loadedCharacters:new Map([[8,{character}]]),update(){}};
  const players=new Set([8]);
  const release=bindMatterHologram(manager,{active:false},()=>players);
  const state={localCharacterId:3};
  manager.update(state);
  assert.equal(character.scale.x,matterAvatarScale);
  class FadeMaterial extends MeshStandardMaterial{
    constructor({originalMaterial}){super();this.copy(originalMaterial);}
  }
  const original=new MeshStandardMaterial();
  const source=new FadeMaterial({originalMaterial:original});
  const mesh=new Mesh(new BoxGeometry(),source);
  mesh.castShadow=true;
  root.add(mesh);
  manager.update(state);
  assert.equal(mesh.material.transparent,true);
  assert.equal(mesh.material.opacity,.55);
  assert.equal(mesh.castShadow,false);
  players.clear();
  manager.update(state);
  assert.equal(character.scale.x,1);
  assert.equal(mesh.material,source);
  assert.equal(mesh.castShadow,true);
  release();
  mesh.geometry.dispose();
  source.dispose();
  original.dispose();
});

test('a peer adopts a tabletop glide at miniature speed without accumulating pitch',()=>{
  const character=new Group(),root=new Group(),arm=new Bone();
  arm.name='upperarm_l';
  root.add(arm);
  character.getMesh=()=>root;
  const manager={loadedCharacters:new Map([[8,{character}]]),update(){}};
  const tabletopPlayers=new Set([8]);
  const release=bindFlightAvatarAnimation(manager,()=>({tabletopPlayers}));
  const position=new Vector3();
  const state={localCharacterId:1,characters:new Map([[8,{position}]])};
  manager.update(state,1/60);
  for(let i=0;i<120;i++){
    position.x+=matterAvatarScale*.95/60;
    manager.update(state,1/60);
  }
  assert.ok(Math.abs(character.quaternion.x)>.12&&Math.abs(character.quaternion.x)<.5);
  assert.ok(Math.abs(arm.quaternion.x)>.01);
  tabletopPlayers.clear();
  for(let i=0;i<120;i++)manager.update(state,1/60);
  assert.ok(Math.abs(character.quaternion.x)<.01);
  release();
  assert.equal(character.quaternion.x,0);
  assert.equal(arm.quaternion.x,0);
});

test('crouch bends a horizontal-axis humanoid rig into the sagittal plane',()=>{
  const character=new Group(),root=new Group(),thigh=new Bone(),calf=new Bone(),ankle=new Bone();
  character.add(root);
  root.add(thigh);
  thigh.add(calf);
  calf.add(ankle);
  thigh.name='thigh_l';
  calf.name='calf_l';
  thigh.rotation.z=-Math.PI/2;
  calf.position.x=.44;
  ankle.position.x=.42;
  character.getMesh=()=>root;
  const manager={loadedCharacters:new Map([[8,{character}]]),update(){}};
  const release=bindFlightAvatarAnimation(manager,()=>({crouch:true}));
  const state={localCharacterId:8,characters:new Map([[8,{position:new Vector3()}]])};
  for(let i=0;i<120;i++)manager.update(state,1/60);
  const knee=calf.getWorldPosition(new Vector3());
  const foot=ankle.getWorldPosition(new Vector3());
  assert.ok(knee.z>.08&&Math.abs(knee.x)<1e-6);
  assert.ok(foot.z<knee.z&&Math.abs(foot.x)<1e-6);
  release();
  assert.ok(Math.abs(ankle.getWorldPosition(new Vector3()).z)<1e-6);
});

test('a miniature peer turns its head for a shared pointing cue and settles again',()=>{
  const character=new Group(),root=new Group(),head=new Bone();
  head.name='head';
  character.add(root);root.add(head);
  character.getMesh=()=>root;
  const manager={loadedCharacters:new Map([[8,{character}]]),update(){}};
  const tabletopPlayers=new Set([8]),peerGaze=new Map();
  let glanceMotion=true;
  const release=bindFlightAvatarAnimation(manager,()=>({tabletopPlayers,peerGaze,glanceMotion}));
  const state={localCharacterId:1,characters:new Map([[8,{position:new Vector3(),animationState:0}]])};
  const step=()=>{for(let i=0;i<75;i++)manager.update(state,1/60);};
  peerGaze.set(8,new Vector3(1,0,3));
  step();
  assert.ok(head.quaternion.y>.1);
  peerGaze.clear();step();
  assert.ok(Math.abs(head.quaternion.y)<.01);
  glanceMotion=false;peerGaze.set(8,new Vector3(1,0,3));step();
  assert.equal(head.quaternion.y,0);
  release();
});


function flightFixture(){
  let keyboard=null,touch=null,up=false,down=false;
  const position=new Vector3(0,.2,.55),quaternion=new Quaternion(),camera={theta:0,distance:2};
  const controller={config:{position,quaternion,
    keyInputManager:{getOutput:()=>keyboard,getJump:()=>up,isKeyPressed:key=>key==='alt'&&down},
    additionalInputProvider:{getOutput:()=>touch},
    collisionsManager:{setCharacterPosition(){},applyColliders(){}}},
    capsuleInfo:{radius:.28,segment:{end:{y:1.56}}},
    characterVelocity:new Vector3(),updateNetworkState(){}};
  const flight=new MatterFlight(camera);
  flight.enter(controller,new Vector3());
  return {position,quaternion,camera,controller,flight,step:(dt=1/60,allowed=true)=>flight.move(controller,dt,allowed),
    input:(keys,fingers,ascent=false,descent=false)=>{keyboard=keys;touch=fingers;up=ascent;down=descent;}};
}

test('miniature flight combines keyboard travel and vertical touch, then arrests released axes',()=>{
  const f=flightFixture(),start=f.position.clone();
  f.input({direction:0},{vertical:1});
  for(let i=0;i<21;i++)f.step();
  assert.ok(f.position.x>start.x+.15&&f.position.y>start.y+.12);
  const up=f.position.y;
  f.input({direction:0},{vertical:-1},true);
  f.step();
  assert.equal(f.position.y,up);
  f.input({direction:0},{vertical:-1});
  for(let i=0;i<45;i++)f.step();
  assert.ok(Math.abs(f.position.y-f.flight.bounds.min.y)<1e-12);
  const parked=f.position.clone();
  f.step(1/30,false);
  assert.ok(f.position.distanceTo(parked)<1e-12);
  assert.equal(f.flight.velocity.length(),0);
  f.flight.exit(f.controller);
  assert.ok(f.position.distanceTo(new Vector3(0,.2,.55))<1e-12);
  assert.equal(f.camera.distance,2);
});

test('a review pivots one visitor around the model and restores avatar-centered flight',()=>{
  const {camera,controller,flight}=flightFixture();
  flight.exit(controller);
  const manager={localController:controller,update(){}};
  const target=new Vector3();
  camera.setTarget=point=>target.copy(point);
  const release=bindMatterFlight(manager,camera,flight,()=>true);
  const avatarPoint=new Vector3(0,2,0),modelCentre={x:.34,y:.315,z:0};
  assert.equal(flight.enter(controller,new Vector3(),{reviewTarget:modelCentre}),true);
  camera.setTarget(avatarPoint);
  assert.deepEqual(target.toArray(),[.34,.315,0]);
  assert.deepEqual(avatarPoint.toArray(),[0,2,0]);
  const peer=flightFixture();
  assert.equal(peer.camera.distance,.68);
  assert.equal(peer.flight.reviewTarget,null);
  flight.exit(controller);
  camera.setTarget(avatarPoint);
  assert.deepEqual(target.toArray(),[0,2,0]);
  assert.equal(camera.distance,2);
  flight.enter(controller,new Vector3());
  camera.setTarget(avatarPoint);
  assert.ok(Math.abs(target.y-(2-1.75*(1-matterAvatarScale)))<1e-9);
  release();
});

test('miniature heading turns along the shortest arc at a bounded angular rate',()=>{
  const f=flightFixture();
  f.input({direction:Math.PI/2-.045},null);
  for(let i=0;i<70;i++)f.step();
  const prior=f.quaternion.clone();
  f.input({direction:Math.PI/2+.045},null);
  f.step();
  assert.ok(f.quaternion.angleTo(prior)<.03);
  const rounded=f.quaternion.clone();
  f.input({direction:-Math.PI/2},null);
  f.step();
  assert.ok(f.quaternion.angleTo(rounded)>0&&f.quaternion.angleTo(rounded)<=8/60+1e-9);
  const stable=f.quaternion.clone();
  f.step(NaN);
  assert.deepEqual(f.quaternion.toArray(),stable.toArray());
});

test('miniature collision separation never becomes extra travel speed',()=>{
  const f=flightFixture();
  f.input({direction:0},null);
  f.controller.config.collisionsManager.applyColliders=capsule=>{
    capsule.start.x+=.11;
    capsule.end.x+=.11;
  };
  f.step();
  assert.ok(f.position.x>.11&&f.flight.velocity.x<.2);
  f.controller.config.collisionsManager.applyColliders=capsule=>{
    capsule.start.x-=.04;
    capsule.end.x-=.04;
  };
  f.step();
  assert.equal(f.flight.velocity.x,0);
  f.controller.config.collisionsManager.applyColliders=()=>{};
  const cleared=f.position.x;
  f.step();
  assert.ok(f.position.x>cleared&&f.position.x-cleared<.004);
});
