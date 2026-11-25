import assert from 'node:assert/strict';
import test from 'node:test';
import {CollisionsManager,Matr4} from '@mml-io/3d-web-client-core';
import {BufferAttribute,BufferGeometry,Quaternion,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {buildCaveCrown,buildToroidalCave} from '../src/toroidal-cave.mjs';
import {bindToroidalMml} from '../src/toroidal-mml.mjs';
import {terrainCoordinates,terrainElevation,terrainFrame,terrainPosition} from '../src/toroidal-terrain.mjs';

function caveController(u,v,height){
  const collisions=new CollisionsManager();
  for(const {origin,positions,indices} of [buildToroidalCave(),buildCaveCrown()]){
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(positions,3));
    geometry.setIndex(new BufferAttribute(indices,1));
    collisions.addMeshesGroup(geometry,{meshBVH:new MeshBVH(geometry),
      matrix:new Matr4().setPosition(...origin),localScale:new Vector3(1,1,1)});
  }
  const position=new Vector3(...terrainPosition(u,v,height));
  collisions.setCharacterPosition(position);
  let forward=false,flight=false,vertical=0,jump=false,theta=0;
  const keys={getOutput:()=>forward||jump?{direction:forward?Math.PI:null,jump}:null,
    getJump:()=>jump||vertical>0,isKeyPressed:key=>key==='shift'&&vertical<0};
  const controller={config:{position,quaternion:new Quaternion(),collisionsManager:collisions,keyInputManager:keys},
    capsuleInfo:{radius:.45,segment:{end:{y:1.05}}},characterVelocity:new Vector3(),
    getTargetAnimation:()=>0,update(){}};
  const manager={localController:controller,remoteCharacters:new Map(),
    update(dt){this.localController.update(dt);}};
  const camera={get theta(){return theta;},update(){},adjustCameraPosition(){}};
  bindToroidalMml(manager,camera,()=>true,()=>flight);
  const coordinates=()=>terrainCoordinates(position.toArray());
  return {controller,coordinates,position,
    advance(seconds,rate){for(let i=0;i<seconds*rate;i++)manager.update(1/rate);},
    vertical(input){vertical=input;flight=true;},
    jump(value){jump=value;},
    roof(){
      const {u,v}=coordinates();
      const ray=new Ray(new Vector3(...terrainPosition(u,v,30)),new Vector3(...terrainFrame(u,v).down));
      const hit=collisions.raycastFirst(ray,20);
      return hit?30-hit[0]:null;
    },
    walkTo(u,v){
      const target=new Vector3(...terrainPosition(u,v,terrainElevation(u,v)));
      const {u:atU,v:atV}=coordinates(),frame=terrainFrame(atU,atV);
      const delta=target.clone().sub(position);
      theta=3*Math.PI/2-Math.atan2(delta.dot(new Vector3(...frame.alongRing)),delta.dot(new Vector3(...frame.aroundTube)));
      forward=true;
      for(let frame=0;frame<16*60;frame++){
        manager.update(1/60);
        if(Math.hypot(target.x-position.x,target.z-position.z)<.9)break;
      }
      forward=false;
    }};
}

test('dropping above the near cave roof keeps the avatar outside at several frame rates',()=>{
  for(const rate of [10,30,60,120]){
    const player=caveController(.00781,.26418,30);
    assert.ok(player.roof()>19);
    player.advance(4,rate);
    const resting=player.coordinates().height;
    assert.ok(resting>18.8,`the avatar fell through the rock at ${rate} Hz`);
    assert.ok(resting>=player.roof()-.06);
    assert.equal(player.controller.characterOnGround,true);
    player.advance(2,rate);
    assert.ok(Math.abs(player.coordinates().height-resting)<.15);
    player.jump(true);
    player.advance(.2,rate);
    assert.ok(player.coordinates().height>resting+.3);
  }
});

test('powered flight can descend to the roof and take off again',()=>{
  const player=caveController(.00781,.26418,30);
  player.vertical(-1);
  player.advance(5,60);
  const resting=player.coordinates().height;
  assert.ok(resting>18.8&&resting>=player.roof()-.06);
  player.vertical(1);
  player.advance(.4,60);
  assert.ok(player.coordinates().height>resting+1.5);
});

test('the tunnel still permits a ground crossing through both mouths',()=>{
  const player=caveController(.00714,.265,terrainElevation(.00714,.265)+.25);
  player.advance(.5,60);
  for(const u of [.0085,.0106,.01186]){
    player.walkTo(u,.265);
    const at=player.coordinates();
    assert.ok(Math.abs(at.u-u)<.0001,`the avatar did not reach ${u}`);
    assert.ok(at.height-terrainElevation(at.u,at.v)<.3);
  }
});
