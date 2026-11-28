import assert from 'node:assert/strict';
import test from 'node:test';
import {Mesh,Raycaster,Vector3} from 'three';
import {makeScene,makeHefestoSliceScenes} from '../art/linterna/precinct/model.mjs';
import {pavilionDoor,pavilions,roomCenters,roomPartition} from '../art/linterna/precinct/plan.mjs';

test('all three foyer finishes leave the existing visual openings clear in both directions',()=>{
  const {group}=makeScene('precinct');
  for(const pavilion of pavilions){
    const temple=group.getObjectByName(pavilion.id);
    const openings=[{x:0,z:pavilionDoor},...roomCenters(pavilion).map(({x})=>({x,z:roomPartition}))];
    for(const {x,z} of openings){
      for(const offset of [-.66,0,.66]){
        for(const y of [.18,.92,1.64,2.27]){
          for(const side of [-1,1]){
            const eye=temple.localToWorld(new Vector3(x+offset,y,z+side*.25));
            const direction=new Vector3(0,0,-side).transformDirection(temple.matrixWorld);
            const ray=new Raycaster(eye,direction,0,.5);
            assert.equal(ray.intersectObject(temple,true).length,0,
              `${pavilion.id} opening at ${x},${z} must be clear at ${offset},${y}`);
          }
        }
      }
    }
  }
});

test('side temple interiors are offered only by the expanded room-art edition',()=>{
  const first=makeHefestoSliceScenes();
  const expanded=makeHefestoSliceScenes({allTemples:true});
  assert.deepEqual(expanded.filter(layer=>!first.some(original=>original.cell===layer.cell)).map(layer=>layer.cell),
    ['athena','planning','reading','library','research-gallery','apollo','instrument','movement']);
  const hall=expanded.find(layer=>layer.name==='pavilion-exteriors').group;
  assert.equal(hall.getObjectByName('Athena wayfinding sculpture'),undefined);
  assert.equal(hall.getObjectByName('Apollo wayfinding sculpture'),undefined);
  for(const [cell,figure] of [['athena','Athena'],['apollo','Apollo']]){
    const foyer=expanded.find(layer=>layer.cell===cell).group;
    assert.ok(foyer.getObjectByName(figure+' wayfinding sculpture'));
  }
});

test('the room art retains the Atlas doughnut and its three survey markers',()=>{
  const hall=makeHefestoSliceScenes().find(layer=>layer.name==='hall').group;
  const ring=hall.getObjectByName('Raised ring terrain');
  assert.equal(ring.geometry.parameters.closed,true);
  assert.ok(hall.getObjectByName('Round atlas timber rim') instanceof Mesh);
  const surface=new Raycaster(new Vector3(0,1.50,6.5),new Vector3(0,-1,0),0,.60);
  assert.equal(surface.intersectObject(ring).length,0,'water remains exposed inside the ring');
  assert.ok(surface.intersectObject(hall.getObjectByName('Blue ceramic map bed')).length>0);
  const markers=[];
  hall.traverse(mesh=>{if(mesh.name==='Survey marker')markers.push(mesh);});
  assert.equal(markers.length,3);
});
