import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Plane,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh/src/index.js';
import {closedMatterPart,firstMatterHit,indexMatterPart,MatterContact} from '../src/matter-contact.mjs';

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


test('a transferred part index serves contact and nearest visible pick through a transformed cut',()=>{
  const {part,parts,contact}=plateFixture();
  const original=part.geometry.clone();
  const packed=MeshBVH.serialize(new MeshBVH(original,{indirect:true}),{cloneBuffers:false});
  const transfer=[packed.index.buffer,packed.indirectBuffer.buffer,...packed.roots];
  const received=structuredClone(packed,{transfer});
  const tree=indexMatterPart(part.geometry,received);
  const model=new Group();
  model.add(part);
  model.scale.setScalar(.6);
  model.position.set(.2,.3,.45);
  part.material.clippingPlanes=[new Plane(point(0,-1,0),.6)];
  const ray=new Ray(point(.2,.45,1.45),point(0,0,-1));
  const hit=firstMatterHit(parts.values(),ray);
  assert.equal(hit?.object,part);
  assert.ok(Math.abs(hit.distance-1)<1e-8);
  assert.ok(contact.limit(parts,ray.origin,point(.2,.45,0),view)<1);
  ray.origin.y=.72;
  assert.equal(firstMatterHit(parts.values(),ray),null);
  assert.equal(indexMatterPart(part.geometry),tree);
  assert.deepEqual(Array.from(part.geometry.index.array),[0,1,2,0,2,3]);
});


test('only a positively wound watertight CAD part lets the eye back out through hidden faces',()=>{
  const geometry=new BoxGeometry(1,1,1);
  geometry.computeBoundingBox();
  const vertices=geometry.getAttribute('position').array,indices=geometry.index.array;
  assert.equal(closedMatterPart(vertices,indices),true);
  assert.equal(closedMatterPart(vertices,indices.slice(3)),false);
  const inverted=indices.slice();
  for(let i=0;i<inverted.length;i+=3)[inverted[i],inverted[i+1]]=[inverted[i+1],inverted[i]];
  assert.equal(closedMatterPart(vertices,inverted),false);

  const part=new Mesh(geometry,new MeshStandardMaterial());
  const parts=new Map([['box',part]]),contact=new MatterContact();
  const inside=point(0,0,.39),exterior=point(0,0,.8);
  assert.ok(contact.limit(parts,inside,exterior,view)<1);
  part.userData.matterClosed=true;
  assert.equal(contact.limit(parts,inside,exterior,view),1);
  const stop=exterior.clone().lerp(inside,contact.limit(parts,exterior,inside,view));
  assert.ok(stop.z>.53&&stop.z<.55,stop);
});
