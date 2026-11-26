import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Plane,Vector3} from 'three';
import {MatterContact} from '../src/matter-contact.mjs';

const view={fov:64,aspect:16/9};
const point=(x,y,z)=>new Vector3(x,y,z);
const plateFixture=()=>{
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([-1,0,0,1,0,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.computeBoundingBox();
  const part=new Mesh(geometry,new MeshStandardMaterial());
  return {part,parts:new Map([['plate',part]]),contact:new MatterContact()};
};

test('a long sweep stops with clearance on either side of a zero-thickness CAD face',()=>{
  const {part,parts,contact}=plateFixture();
  const indices=Array.from(part.geometry.index.array);
  for(const direction of [1,-1]){
    const from=point(.45,.65,direction*.7);
    const to=point(.45,.65,-direction*.7);
    const fraction=contact.limit(parts,from,to,view);
    const stopped=from.clone().lerp(to,fraction);
    assert.ok(stopped.z*direction>.03&&stopped.z*direction<.05,{fraction,stopped});
    assert.equal(contact.limit(parts,stopped,from,view),1);
  }
  assert.deepEqual(Array.from(part.geometry.index.array),indices);
});

test('a sweep stops at the plate edge even when its center ray misses the face',()=>{
  const {parts,contact}=plateFixture();
  assert.ok(contact.limit(parts,point(1.017,.5,.5),point(1.017,.5,-.5),view)<.5);
  assert.equal(contact.limit(parts,point(1.08,.5,.5),point(1.08,.5,-.5),view),1);
});

test('a section leaves contact only on the visible part of a transformed mesh',()=>{
  const {part,parts,contact}=plateFixture();
  const model=new Group();
  model.add(part);
  model.rotation.y=Math.PI/2;
  model.scale.setScalar(.6);
  model.position.set(.2,.3,0);
  part.material.clippingPlanes=[new Plane(point(0,-1,0),.6)];
  assert.ok(contact.limit(parts,point(.8,.5,0),point(-.6,.5,0),view)<.5);
  assert.equal(contact.limit(parts,point(.8,.8,0),point(-.6,.8,0),view),1);
  // The near-plane corner still reaches the visible lip just above the cut.
  assert.ok(contact.limit(parts,point(.8,.617,0),point(-.6,.617,0),view)<.5);
  part.visible=false;
  assert.equal(contact.limit(parts,point(.8,.5,0),point(-.6,.5,0),view),1);
});
