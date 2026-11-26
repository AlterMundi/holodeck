import assert from 'node:assert/strict';
import test from 'node:test';
import {DoubleSide, MeshBasicMaterial, Raycaster, Scene, Vector3} from 'three';
import {buildCaveCrown, buildToroidalCave, CAVE, ToroidalCave} from '../src/toroidal-cave.mjs';
import {caveExitCover} from '../src/toroidal-cave-verge.mjs';
import {TOROIDAL_SPAWN, terrainCoordinates, terrainElevation, terrainFrame, terrainPosition, terrainTrail} from '../src/toroidal-terrain.mjs';

const point = (u,v,offset=0) => new Vector3(...terrainPosition(u,v,terrainElevation(u,v)+offset));

test('the shared collision shell has two open mouths and two covered chambers', () => {
  const scene = new Scene();
  const colliders = new Set();
  const cave = new ToroidalCave(scene,{addCollider:mesh=>colliders.add(mesh),removeCollider:mesh=>colliders.delete(mesh)});
  cave.update(point(CAVE.from,CAVE.latitude));
  const {mesh} = cave;
  assert.ok(mesh && colliders.has(mesh));
  assert.ok(mesh.geometry.index.count / 3 < 2500);
  assert.ok(mesh.geometry.attributes.color.array.every(value=>value>=0&&value<=1));
  const contact=mesh.geometry.attributes.caveGroundContact;
  assert.equal(contact.count,mesh.geometry.attributes.position.count);
  assert.equal(contact.getY(0),1);
  assert.equal(contact.getY(contact.count/2),0);
  const original=mesh.material;
  const twoSided=new MeshBasicMaterial({side:DoubleSide});
  mesh.material=twoSided;
  const radialHit=(u,v)=>new Raycaster(point(u,v,.26),new Vector3(...terrainFrame(u,v).up),0,9)
    .intersectObject(mesh,false)[0]?.distance;
  assert.equal(radialHit(CAVE.from-.00013,CAVE.latitude),undefined);
  assert.equal(radialHit(CAVE.to+.00013,CAVE.latitude),undefined);
  const chamber=t=>radialHit(CAVE.from+(CAVE.to-CAVE.from)*t,CAVE.latitude);
  assert.ok(chamber(.25)>2.5 && chamber(.75)>2.5);
  assert.ok(chamber(.25)>chamber(.5) && chamber(.75)>chamber(.5));
  for (const [u,sign] of [[CAVE.from-.00012,1],[CAVE.to+.00012,-1]]) {
    const along=new Vector3(...terrainFrame(u,CAVE.latitude).alongRing).multiplyScalar(sign);
    const mouth=new Raycaster(point(u,CAVE.latitude,1.1),along,0,3).intersectObject(mesh,false);
    assert.equal(mouth.length,0);
  }

  mesh.material=original;
  twoSided.dispose();
  cave.update(point(.3,.25));
  assert.equal(scene.children.length,0);
  assert.equal(colliders.size,0);
  assert.equal(cave.mesh,null);
  assert.equal(cave.crown,null);
});

test('low rock feet keep the outer sections ordered with room between them',()=>{
  const {origin,positions}=buildToroidalCave();
  const verticesPerArch=17;
  const sections=positions.length/(6*verticesPerArch);
  const minimumStep=.45*(CAVE.to-CAVE.from)/(sections-1);
  const coordinate=index=>terrainCoordinates(origin.map((base,axis)=>base+positions[index*3+axis]));
  for(let row=0;row<sections-1;row++){
    for(let arch=0;arch<verticesPerArch;arch++){
      const vertex=row*verticesPerArch+arch;
      const along=coordinate(vertex+verticesPerArch).u-coordinate(vertex).u;
      assert.ok(along>=minimumStep,`outer section ${row}, arch vertex ${arch}, step ${along}`);
    }
  }
});

test('visible crown triangles and collision share one footprint off the path and the arch',()=>{
  const {origin,positions,indices,colors}=buildCaveCrown();
  assert.ok(colors.every(value=>value>=0&&value<=1));
  assert.equal(indices.length/3,624);
  const finVolume=Array(4).fill(0);
  const crownPoint=index=>new Vector3().fromArray(positions,index*3).add(new Vector3(...origin));
  for(let i=0;i<indices.length;i+=3){
    const [a,b,c]=[indices[i],indices[i+1],indices[i+2]].map(crownPoint);
    const anchor=new Vector3(...origin);
    finVolume[Math.floor(i/(indices.length/4))]+=a.clone().sub(anchor)
      .dot(b.clone().sub(anchor).cross(c.clone().sub(anchor)))/6;
    const edges=[a.clone().lerp(b,.5),b.clone().lerp(c,.5),c.clone().lerp(a,.5)];
    for(const sample of [a,b,c,a.clone().add(b).add(c).divideScalar(3),...edges]){
      const p=terrainCoordinates(sample.toArray());
      assert.ok(Math.abs(p.v-CAVE.latitude)>.00195);
      assert.ok(terrainTrail(p.u,p.v)<.16);
    }
  }
  assert.ok(finVolume.every(volume=>volume>20),'each closed fin faces outwards');
  const eye=new Vector3(TOROIDAL_SPAWN.x+1.38,TOROIDAL_SPAWN.y+1.45,TOROIDAL_SPAWN.z-3);
  const top=Array.from({length:positions.length/3},(_,i)=>crownPoint(i))
    .reduce((highest,p)=>p.y>highest.y?p:highest);
  for(let t=.04;t<1;t+=.04){
    const p=terrainCoordinates(eye.clone().lerp(top,t).toArray());
    assert.ok(p.height>terrainElevation(p.u,p.v)+.9);
  }
  const colliders=new Set(),scene=new Scene();
  const cave=new ToroidalCave(scene,{addCollider:mesh=>colliders.add(mesh),removeCollider:mesh=>colliders.delete(mesh)});
  cave.update(eye);
  assert.ok(colliders.has(cave.crown));
  assert.equal(cave.crown.geometry.attributes.position.array.length,positions.length);
  assert.equal(cave.crown.geometry.attributes.caveGroundContact.count,positions.length/3);
  const direction=top.clone().add(new Vector3(0,-.3,0)).sub(eye).normalize();
  assert.equal(new Raycaster(eye,direction,0,120).intersectObjects([cave.mesh,cave.crown],false)[0]?.object,cave.crown);
  cave.dispose();
  assert.equal(colliders.size,0);
});


test('the exit turf leaves the central tread and rock feet clear',()=>{
  const cave=new ToroidalCave(new Scene(),{addCollider(){},removeCollider(){}});
  cave.update(point(CAVE.to,CAVE.latitude));
  const {mesh}=cave;
  mesh.material.side=DoubleSide;
  const bladeAxialReach=1.3;
  let samples=0;
  for(let u=CAVE.to-.0001;u<CAVE.to+.0017;u+=.000031){
    for(let v=CAVE.latitude-.0042;v<CAVE.latitude+.0042;v+=.00011){
      const [turf]=caveExitCover(u,v);
      if(turf<=.01)continue;
      samples+=1;
      const root=point(u,v,-.03);
      const up=new Vector3(...terrainFrame(u,v).up);
      const hit=new Raycaster(root,up,0,bladeAxialReach).intersectObject(mesh,false);
      assert.equal(hit.length,0,`root would intersect the cave foot at ${u}, ${v}`);
    }
  }
  const [turf,tread]=caveExitCover(CAVE.to+.00045,CAVE.latitude);
  assert.equal(turf,0);
  assert.ok(tread>.8&&samples>300);
  cave.dispose();
});
