import assert from 'node:assert/strict';
import test from 'node:test';
import {Mesh,Raycaster,Vector3} from 'three';
import {makeScene,makeHefestoSliceScenes} from '../art/linterna/precinct/model.mjs';
import {pavilionDoor,pavilions,roomCenters,roomPartition} from '../art/linterna/precinct/plan.mjs';

const hefesto=pavilions.find(pavilion=>pavilion.id==='hephaestus');
const roomDoors=roomCenters(hefesto);

test('Hefesto wall paint and frames leave the existing visual openings clear',()=>{
  const {group}=makeScene('precinct');
  const temple=group.getObjectByName(hefesto.id);
  const openings=[{x:0,z:pavilionDoor},...roomDoors.map(({x})=>({x,z:roomPartition}))];
  const forward=new Vector3(0,0,-1);
  for(const {x,z} of openings){
    for(const offset of [-.66,0,.66]){
      for(const y of [.18,.92,1.64,2.27]){
        const eye=new Vector3(x+offset,y,hefesto.origin[1]+z+.25);
        const ray=new Raycaster(eye,forward,0,.5);
        assert.equal(ray.intersectObject(temple,true).length,0,
          `opening at ${x},${z} must be clear at ${offset},${y}`);
      }
    }
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
