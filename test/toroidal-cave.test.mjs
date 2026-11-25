import assert from 'node:assert/strict';
import test from 'node:test';
import {DoubleSide, MeshBasicMaterial, Raycaster, Scene, Vector3} from 'three';
import {buildCaveCrown, CAVE, ToroidalCave} from '../src/toroidal-cave.mjs';
import {terrainCoordinates, terrainElevation, terrainFrame, terrainPosition, terrainTrail} from '../src/toroidal-terrain.mjs';

const point = (u,v,offset=0) => new Vector3(...terrainPosition(u,v,terrainElevation(u,v)+offset));

test('the shared collision shell has two open mouths and two covered chambers', () => {
  const scene = new Scene();
  const colliders = new Set();
  const cave = new ToroidalCave(scene,{addCollider:mesh=>colliders.add(mesh),removeCollider:mesh=>colliders.delete(mesh)});
  cave.update(point(CAVE.from,CAVE.latitude));
  const {mesh} = cave;
  assert.ok(mesh && colliders.has(mesh));
  assert.ok(mesh.geometry.index.count / 3 < 2500);
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

test('visible crown triangles and collision share one footprint off the path and the arch',()=>{
  const {origin,positions,indices}=buildCaveCrown();
  assert.equal(indices.length/3,624);
  const crownPoint=index=>new Vector3().fromArray(positions,index*3).add(new Vector3(...origin));
  for(let i=0;i<indices.length;i+=3){
    const [a,b,c]=[indices[i],indices[i+1],indices[i+2]].map(crownPoint);
    for(const sample of [a,b,c,a.clone().add(b).add(c).divideScalar(3),a.clone().lerp(b,.5)]){
      const p=terrainCoordinates(sample.toArray());
      assert.ok(Math.abs(p.v-CAVE.latitude)>.00195);
      assert.ok(terrainTrail(p.u,p.v)<.16);
    }
  }
  const eye=new Vector3(1801.38,499.60,8);
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
  const direction=top.clone().sub(eye).normalize();
  assert.ok(new Raycaster(eye,direction,0,120).intersectObject(cave.crown,false).length);
  cave.dispose();
  assert.equal(colliders.size,0);
});
