import assert from 'node:assert/strict';
import test from 'node:test';
import {AmbientLight,Group,Scene} from 'three';
import {bindToroidalHouseLight} from '../src/toroidal-house-light.mjs';

test('porch illumination follows the outdoor clock and releases its effects on entry',()=>{
  const scene=new Scene(),group=new Group(),facade=new Group();
  scene.add(group);group.add(facade);
  facade.position.set(15,3,8);
  const initial=new AmbientLight(0xffffff,.85);
  const composer={scene,ambientLight:initial,envValues:{envMapIntensity:.9}};
  let model=null;
  const binding=bindToroidalHouseLight(composer,group,{querySelector:()=>model});
  const porch=group.getObjectByName('Atelier porch light');
  try{
    binding.update({daylight:0});
    assert.equal(porch.visible,false);
    assert.equal(initial.intensity,.85*.32);
    model={isConnected:true,modelGraphics:{hasLoadedModel:()=>true},getContainer:()=>facade,
      getAttribute:()=>'/holodeck/assets/compaii-atelier-facade.glb?v=1'};
    binding.update({daylight:0});
    assert.deepEqual(porch.position.toArray(),[15,4.02,9.55]);
    assert.equal(porch.intensity,7.5);
    assert.equal(porch.castShadow,false);
    facade.position.x=20;
    composer.scene.environmentIntensity=1;
    binding.update({daylight:0});
    assert.equal(porch.position.x,20);
    assert.equal(scene.environmentIntensity,.225);
    binding.update({daylight:1});
    assert.equal(initial.intensity,.85);
    assert.equal(porch.intensity,0);
    binding.update({daylight:0});
    const foyer=new AmbientLight(0xffffff,.22);
    composer.ambientLight=foyer;
    composer.envValues.envMapIntensity=.8;
    binding.update(null);
    assert.equal(foyer.intensity,.22);
    assert.equal(scene.environmentIntensity,.8);
    assert.equal(porch.visible,false);
  }finally{binding.dispose();}
  assert.equal(group.getObjectByName('Atelier porch light'),undefined);
});
