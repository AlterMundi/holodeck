import assert from 'node:assert/strict';
import test from 'node:test';
import {Bone, Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Plane, PlaneGeometry, Scene, Vector3} from 'three';
import {PublicWorldPicker} from '../src/world-indication.mjs';
import {TabletopCompanionPerch} from '../src/tabletop-companion-perch.mjs';
import {bindTabletopAttention, TabletopGlance} from '../src/tabletop-attention.mjs';

test('tabletop hover needs a fresh pointer and dwell on the current part',()=>{
  const canvas=new EventTarget(), document=new EventTarget(), win=new EventTarget();
  const preference=new EventTarget();
  win.matchMedia=()=>preference;
  document.defaultView=win;
  const oldMesh=new Group(),newMesh=new Group();
  let mesh=oldMesh, allowed=true, now=0;
  const attention=bindTabletopAttention({canvas,document,allowed:()=>allowed,clock:()=>now,
    pick:()=>({id:'part',mesh,point:new Vector3(0,0,1)}),
    current:hit=>hit.mesh===mesh,
  });
  const move=()=>canvas.dispatchEvent(Object.assign(new Event('pointermove'),{pointerType:'mouse',buttons:0}));
  assert.equal(attention.sample(0),null);
  move();
  assert.equal(attention.sample(0),null);
  assert.equal(attention.sample(179),null);
  assert.deepEqual(attention.sample(180)?.toArray(),[0,0,1]);
  assert.equal(attention.part(),oldMesh);
  mesh=newMesh;
  assert.equal(attention.sample(181),null);
  assert.equal(attention.part(),null);
  assert.equal(attention.sample(290),null);
  assert.deepEqual(attention.sample(480)?.toArray(),[0,0,1]);
  assert.equal(attention.sample(4000),null);
  allowed=false;
  assert.equal(attention.sample(4200),null);
  allowed=true;
  assert.equal(attention.sample(4400),null);
  now=4400;move();
  assert.equal(attention.sample(4400),null);
  assert.ok(attention.sample(4600));
  attention.dispose();
});

test('a glance preserves the base pose and decays without accumulating rotations',()=>{
  const body=new Group(),neck=new Bone(),head=new Bone();
  body.rotation.y=.65;
  neck.rotation.z=.20;
  head.rotation.x=.1;
  body.add(neck);
  neck.add(head);
  const base=head.quaternion.clone(),glance=new TabletopGlance();
  const target=new Vector3(.5,-.2,1).applyQuaternion(body.quaternion);
  for(let index=0;index<24;index++){
    glance.restore();
    glance.apply(body,head,target,.016);
  }
  assert.ok(head.quaternion.angleTo(base)>.15);
  assert.ok(head.quaternion.angleTo(base)<.65);
  for(let index=0;index<100;index++){
    glance.restore();
    glance.apply(body,head,null,.016);
  }
  assert.ok(head.quaternion.angleTo(base)<.002);
  glance.restore();
  assert.ok(head.quaternion.equals(base));
  const above=new Vector3(0,1,-.0001);
  glance.apply(body,head,above,.06);
  assert.ok(glance.pitch<-.10&&Math.abs(glance.yaw)<.01);
  glance.reset();
  assert.ok(head.quaternion.equals(base));
  assert.equal(glance.pitch,0);

});


test('only visible worktable parts take gaze through the companion hologram',()=>{
  const scene=new Scene(),canvas=new EventTarget(),companion=new Group();
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  const tile=()=>new Mesh(new PlaneGeometry(2,2),new MeshBasicMaterial());
  const part=tile(),occluder=tile(),companionShell=tile();
  companion.position.z=1;
  companion.add(companionShell);
  occluder.position.z=.5;
  scene.add(part,companion);
  const picker=new PublicWorldPicker({scene,canvas,companion:()=>companion,
    collection:()=>new Map([[part,{kind:'worktable-part',id:'test',mesh:part}]]),
    cameraState:()=>({fov:60,aspect:1,position:{x:0,y:0,z:3},rotation:{x:0,y:0,z:0,w:1}}),
  });
  assert.equal(picker.worktableHit(50,50)?.id,'test');
  scene.add(occluder);
  assert.equal(picker.worktableHit(50,50),null);
  scene.remove(occluder);
  part.material.clippingPlanes=[new Plane(new Vector3(0,0,1),-.1)];
  assert.equal(picker.worktableHit(50,50),null);
  picker.dispose();
});

test('the tabletop companion clears a piece without oscillating between both sides',()=>{
  const space=new Scene(),mesh=new Mesh(new BoxGeometry(.24,.2,.24));
  mesh.position.set(0,.2,.3);space.add(mesh);
  space.position.set(3,0,1);
  const perch=new TabletopCompanionPerch();
  const bounds=new Box3(new Vector3(-.9,.05,-.7),new Vector3(.9,.85,.7));
  const player=new Vector3(.0,.28,-.36);
  const current=new Vector3(.07,.29,-.31);
  const formation=new Vector3(.07,.29,-.31);
  const target=formation.clone();
  for(const offset of [-.035,.016,-.01,.023,-.017]){
    target.copy(formation);
    assert.equal(perch.apply(target,current,player,new Vector3(3+offset,.31,.58),mesh,bounds,space),true);
    assert.ok(target.x>.18&&target.distanceTo(formation)<.35);
    assert.ok(bounds.containsPoint(target));
    current.copy(target);
  }
  const tight=new Box3(new Vector3(-.12,.05,-.7),new Vector3(.12,.85,.7));
  target.copy(formation);
  assert.equal(perch.apply(target,formation,player,new Vector3(3,.31,.58),mesh,tight,space),false);
  assert.ok(target.equals(formation));
});

test('the companion holds on its side when the follow path cuts through the focused piece',()=>{
  const space=new Scene(),mesh=new Mesh(new BoxGeometry(.42,.2,.26));
  mesh.position.set(0,.20,0);space.add(mesh);
  const bounds=new Box3(new Vector3(-.28,.05,-.45),new Vector3(.28,.85,.45));
  const current=new Vector3(0,.30,-.36),target=new Vector3(0,.30,.35);
  const perch=new TabletopCompanionPerch();
  assert.equal(perch.apply(target,current,new Vector3(.08,.4,.28),new Vector3(0,.4,.45),mesh,bounds,space),false);
  assert.ok(target.equals(current));
  // A part can be repositioned over a stopped avatar. In that case
  // the next motion step can get out, with no further penetration.
  const inside=new Vector3(.12,.30,0);
  assert.equal(perch.blocked(inside,new Vector3(.16,.3,0)),false);
  assert.equal(perch.blocked(inside,new Vector3(.07,.3,0)),true);
});
