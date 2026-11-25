import assert from 'node:assert/strict';
import test from 'node:test';
import {Bone, Group, Mesh, MeshBasicMaterial, Plane, PlaneGeometry, Scene, Vector3} from 'three';
import {PublicWorldPicker} from '../src/world-indication.mjs';
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
  mesh=newMesh;
  assert.equal(attention.sample(181),null);
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
