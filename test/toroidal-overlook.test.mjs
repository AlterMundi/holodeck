import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene, Vector3} from 'three';
import {ToroidalOverlook} from '../src/toroidal-overlook.mjs';
import {overlookCoordinates, terrainElevation, terrainPosition, TOROIDAL_TERRAIN} from '../src/toroidal-terrain.mjs';

function elevation(x,z,terrain){
  const {u,v}=overlookCoordinates(x,z);
  return terrainElevation(u,v,terrain);
}

test('the overlook follows a continuous grade and preserves the surrounding ring',()=>{
  const comparator={...TOROIDAL_TERRAIN,id:'ungraded comparison'};
  for(const z of [-7.5,0,7.5])for(const x of [-4,0,4])
    assert.ok(Math.abs(elevation(x,z)-(44.29+.025*z))<1e-8);
  for(const [x,z] of [[-20,0],[20,0],[0,-30],[0,30],[0,-700]])
    assert.equal(elevation(x,z),elevation(x,z,comparator));
  for(let z=-40;z<40;z+=.2){
    const grade=Math.abs(elevation(0,z+.2)-elevation(0,z))/.2;
    assert.ok(grade<.65,'walkable centerline near the lookout at '+z);
  }
});

test('one landmark remains visible across collision unload and releases its owned collider',()=>{
  const scene=new Scene();
  const added=[],removed=[];
  const lookout=new ToroidalOverlook(scene,{addCollider:mesh=>added.push(mesh),removeCollider:mesh=>removed.push(mesh)});
  const point=(x,z)=>{
    const {u,v}=overlookCoordinates(x,z);
    return new Vector3(...terrainPosition(u,v,terrainElevation(u,v)));
  };
  lookout.update(new Vector3(NaN,0,0));
  assert.equal(scene.children.length,0);
  lookout.update(point(0,130));
  const root=scene.children[0];
  assert.equal(root.name,'Inner ring overlook');
  assert.equal(added.length,0);
  lookout.update(point(0,0));
  assert.equal(added.length,1);
  assert.equal(added[0].parent,root);
  assert.equal(added[0].visible,false);
  lookout.update(point(0,100));
  assert.deepEqual(removed,added);
  assert.equal(scene.children[0],root);
  lookout.update(point(0,0));
  assert.equal(added[1],added[0]);
  lookout.dispose();
  assert.deepEqual(removed,added);
  assert.equal(scene.children.length,0);
});
