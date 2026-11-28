import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3} from 'three';
import {MatterFlight,bindMatterFlight,bindMatterHologram,matterAvatarScale,matterEyeHeight} from '../src/matter-flight.mjs';
import {CharacterReviewFlight,characterReviewCamera,matterInspectionCamera} from '../src/character-review-camera.mjs';
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


function flightFixture(Flight=MatterFlight){
  let keyboard=null,touch=null,up=false,down=false;
  const position=new Vector3(0,.2,.55),quaternion=new Quaternion(),camera={theta:0,distance:2,
    targetTheta:.21,targetPhi:1.4,fov:65,targetFOV:64,minFOV:60,maxFOV:70,maxPolarAngle:3,zoomScale:.04,setOrbitAngle(angle){this.targetTheta=angle;}};
  const controller={config:{position,quaternion,
    keyInputManager:{getOutput:()=>keyboard,getJump:()=>up,isKeyPressed:key=>key==='alt'&&down},
    additionalInputProvider:{getOutput:()=>touch},
    collisionsManager:{setCharacterPosition(){},applyColliders(){}}},
    capsuleInfo:{radius:.28,segment:{end:{y:1.56}}},
    characterVelocity:new Vector3(),updateNetworkState(){}};
  const flight=new Flight(camera);
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
  const {camera,controller,flight,input,step}=flightFixture(CharacterReviewFlight);
  flight.exit(controller);
  const manager={localController:controller,update(){}};
  const target=new Vector3();
  camera.setTarget=point=>target.copy(point);
  const release=bindMatterFlight(manager,camera,flight,()=>true);
  const avatarPoint=new Vector3(0,2,0),modelCentre={x:.34,y:.315,z:0};
  assert.equal(flight.enter(controller,new Vector3(),{reviewTarget:modelCentre,
    reviewScale:.58/characterReviewCamera.rigHeight}),true);
  assert.ok(camera.distance>1.1);
  const desiredEye=new Vector3().setFromSphericalCoords(camera.distance,camera.phi,Math.PI/2-camera.theta)
    .add(flight.reviewTarget);
  assert.ok(desiredEye.distanceTo(controller.config.position.clone().add(new Vector3(0,matterEyeHeight,0)))<1e-12);
  camera.setTarget(avatarPoint);
  assert.deepEqual(target.toArray(),[.34,.315,0]);
  assert.deepEqual(avatarPoint.toArray(),[0,2,0]);
  flight.setReviewAngle(Math.PI/2);
  assert.equal(camera.targetTheta,0);
  assert.equal(camera.targetPhi,Math.atan2(characterReviewCamera.distance,characterReviewCamera.eyeHeight-characterReviewCamera.targetHeight));
  for(const field of ['fov','targetFOV','minFOV','maxFOV'])assert.equal(camera[field],characterReviewCamera.fov);
  assert.equal(camera.zoomScale,.04*matterAvatarScale);
  const requestedEye=new Vector3(3,.62,.5);
  const state={position:requestedEye,rotation:new Quaternion()};
  flight.placeReviewEye(state,controller);
  assert.equal(controller.config.position.x,flight.bounds.max.x);
  assert.deepEqual(requestedEye.toArray(),[flight.bounds.max.x,.62,.5]);
  assert.ok(Math.abs(controller.config.position.y+matterEyeHeight-requestedEye.y)<1e-12);
  const direction=new Vector3(0,0,-1).applyQuaternion(state.rotation);
  assert.ok(direction.distanceTo(target.clone().sub(requestedEye).normalize())<1e-12);
  const feet=controller.config.position.clone();
  input({direction:0},null,true);
  step(.10);
  camera.setTarget(avatarPoint);
  const travel=controller.config.position.clone().sub(feet);
  assert.ok(travel.length()>.025);
  assert.ok(target.distanceTo(new Vector3(.34,.315,0).add(travel))<1e-12);
  const peer=flightFixture();
  assert.equal(peer.camera.targetTheta,.21);
  assert.equal(peer.camera.distance,.68);
  assert.equal(peer.flight.reviewTarget,null);
  flight.exit(controller);
  camera.setTarget(avatarPoint);
  assert.deepEqual(target.toArray(),[0,2,0]);
  assert.deepEqual([camera.fov,camera.targetFOV,camera.minFOV,camera.maxFOV],[65,64,60,70]);
  assert.equal(camera.maxPolarAngle,3);
  assert.equal(camera.zoomScale,.04);
  assert.equal(camera.distance,2);
  assert.equal(camera.targetTheta,.21);
  assert.equal(camera.targetPhi,1.4);
  flight.enter(controller,new Vector3());
  flight.setReviewAngle(Math.PI/2);
  assert.equal(camera.targetTheta,.21);
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

test('ordinary Matter starts at the current miniature eyes and dollies the body',()=>{
  const {camera,controller,flight,position}=flightFixture(CharacterReviewFlight);
  flight.exit(controller);
  const bench=new Vector3(),focus=new Vector3(0,.4,0);
  assert.ok(flight.enter(controller,bench,{reviewTarget:focus,cameraProfile:matterInspectionCamera}));
  assert.equal(camera.fov,65);
  assert.equal(camera.minFOV,65);
  assert.equal(camera.maxFOV,65);
  assert.equal(camera.maxPolarAngle,Math.PI/2);
  assert.equal(camera.zoomScale,.04);
  assert.ok(position.distanceTo(new Vector3(0,.27,.55))<1e-12);
  const before=position.clone(),eye=new Vector3(0,.58,.35);
  const state={position:eye,rotation:new Quaternion()};
  flight.placeReviewEye(state,controller);
  assert.ok(position.distanceTo(before)>.1);
  assert.ok(eye.distanceTo(position.clone().add(new Vector3(0,matterEyeHeight,0)))<1e-12);
  assert.ok(new Vector3(0,0,-1).applyQuaternion(state.rotation)
    .distanceTo(focus.clone().sub(eye).normalize())<1e-12);
  const requestedDistance=camera.desiredDistance;
  state.position.set(0,.58,1.5);
  flight.placeReviewEye(state,controller);
  assert.equal(position.z,flight.bounds.max.z);
  assert.equal(camera.desiredDistance,requestedDistance);
  flight.exit(controller);
  assert.ok(position.distanceTo(new Vector3(0,.2,.55))<1e-12);
  assert.equal(camera.distance,2);
  assert.equal(camera.targetTheta,.21);
  assert.equal(camera.targetPhi,1.4);
});

test('inspection dollies along the cursor and reverses as soon as a part stops it',()=>{
  const {camera,controller,flight,position}=flightFixture(CharacterReviewFlight);
  flight.exit(controller);
  const barrier=new Mesh(new BoxGeometry(2,1,.002),new MeshStandardMaterial());
  barrier.position.set(0,.5,.2);
  barrier.geometry.computeBoundingBox();
  const parts=new Map([['barrier',barrier]]);
  camera.aspect=16/9;
  camera.getMainCameraState=()=>({
    position:position.clone().add(new Vector3(0,matterEyeHeight,0)),
    rotation:new Quaternion(),fov:camera.fov,aspect:camera.aspect,
  });
  assert.ok(flight.enter(controller,new Vector3(),{reviewTarget:new Vector3(0,.4,0),
    cameraProfile:matterInspectionCamera,inspectParts:()=>parts}));
  const start=position.clone();
  const target={point:new Vector3(.15,.6025,.2)};
  flight.dollyInspection(controller,-120,.36,0,target);
  assert.ok(position.x>start.x&&position.z<start.z);
  for(let i=0;i<12;i++)flight.dollyInspection(controller,-120,.36,0,target);
  const stopped=position.clone();
  assert.ok(stopped.z>.23&&stopped.z<.25);
  flight.dollyInspection(controller,120,.36,0,target);
  assert.ok(position.z>stopped.z+.01);
  assert.equal(camera.targetTheta,Math.PI/2);
  barrier.visible=false;
  for(let i=0;i<8;i++)flight.dollyInspection(controller,-120,.36,0,target);
  assert.ok(position.z<.2);
  flight.exit(controller);
  assert.equal(flight.inspectParts,null);
  assert.ok(position.distanceTo(start.clone().setY(.2))<1e-12);
});

test('first-person hides only the local mesh and restores it after leaving',()=>{
  const model=()=>{
    const character=new Group(),root=new Group();
    character.add(root);
    return {root,character:Object.assign(character,{getMesh:()=>root})};
  };
  const local=model(),peer=model();
  const manager={loadedCharacters:new Map([[1,local],[2,peer]]),update(){}};
  const flight={active:true,inspectParts:()=>null};
  const restore=bindMatterHologram(manager,flight,()=>[2]);
  manager.update({localCharacterId:1});
  assert.equal(local.root.visible,false);
  assert.equal(peer.root.visible,true);
  assert.equal(peer.character.scale.x,matterAvatarScale);
  flight.inspectParts=null;
  flight.active=false;
  manager.update({localCharacterId:1});
  assert.equal(local.root.visible,true);
  assert.equal(local.character.scale.x,1);
  restore();
});

test('an inspection orbit stopped by a wall discards the unreachable position',()=>{
  const {camera,controller,flight,position}=flightFixture(CharacterReviewFlight);
  flight.exit(controller);
  assert.ok(flight.enter(controller,new Vector3(),{reviewTarget:new Vector3(0,.4,0),
    cameraProfile:matterInspectionCamera,inspectParts:()=>null}));
  controller.config.collisionsManager.raycastFirst=()=>[.12];
  const start=position.clone();
  const state={position:new Vector3(1.1,start.y+matterEyeHeight,start.z),rotation:new Quaternion()};
  flight.placeReviewEye(state,controller);
  assert.ok(position.x>.06&&position.x<.08);
  const frameEye=new Vector3().setFromSphericalCoords(camera.targetDistance,camera.targetPhi,Math.PI/2-camera.targetTheta)
    .add(flight.reviewTarget);
  assert.ok(frameEye.distanceTo(state.position)<1e-8);
  controller.config.collisionsManager.raycastFirst=()=>null;
  flight.placeReviewEye({position:frameEye,rotation:new Quaternion()},controller);
  assert.ok(position.distanceTo(frameEye.clone().add(new Vector3(0,-matterEyeHeight,0)))<1e-8);
});

test('the character review lifts along table up and restores the original world pose on exit',()=>{
  const {camera,controller,flight,position}=flightFixture(CharacterReviewFlight);
  flight.exit(controller);
  const worldFeet=position.clone();
  assert.ok(flight.enter(controller,new Vector3(),{reviewTarget:new Vector3(0,.4,0),
    cameraProfile:matterInspectionCamera,inspectParts:()=>[]}));
  const eye=position.clone().add(new Vector3(0,matterEyeHeight,0));
  camera.getMainCameraState=()=>({position:eye});
  const before=position.clone(),radius=camera.distance;
  flight.liftCamera(controller,.18);
  assert.ok(position.distanceTo(before.add(new Vector3(0,.18,0)))<1e-10);
  assert.equal(camera.distance,radius);
  eye.copy(position).y+=matterEyeHeight;
  flight.liftCamera(controller,100);
  assert.equal(position.y,flight.bounds.max.y);
  flight.exit(controller);
  assert.deepEqual(position.toArray(),worldFeet.toArray());
});
