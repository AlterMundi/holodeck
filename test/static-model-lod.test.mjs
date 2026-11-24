import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial} from 'three';
import {staticModelLevels,wantsDetailedModel} from '../src/static-model-lod.mjs';
import {disposeModel} from '../src/gallery-models.mjs';

test('screen-size thresholds leave a stable band and respect interaction proximity',()=>{
  const view={anchor:{x:0,y:1,z:0},diameter:.88,distance:8,pixels:680,
    camera:{position:{x:0,y:1,z:8},fov:64},near:false};
  assert.equal(wantsDetailedModel(view),false);
  assert.equal(wantsDetailedModel({...view,near:true}),true);
  assert.equal(wantsDetailedModel({...view,distance:1.5}),true);
});

test('static display selects a reduced nonempty mesh and restores exact detail',()=>{
  const original=new Mesh(new BoxGeometry(2,1,1,16,16,16),new MeshStandardMaterial({color:0x345987}));
  original.position.set(2,3,4);
  const model=new Group().add(original);
  const levels=staticModelLevels(model);
  assert.equal(model.visible,false);
  assert.equal(levels.low.visible,true);
  assert.ok(levels.low.geometry.index.count>0&&levels.low.geometry.index.count<=640*3);
  const originalBounds=new Box3().setFromObject(model);
  const simplifiedBounds=new Box3().setFromObject(levels.low);
  assert.ok(originalBounds.min.distanceTo(simplifiedBounds.min)<.08);
  assert.ok(originalBounds.max.distanceTo(simplifiedBounds.max)<.08);
  levels.setNear(true);
  assert.equal(model.visible,true);
  assert.equal(levels.low.visible,false);
  assert.equal(model.children[0],original);
  levels.setNear(false);
  assert.equal(levels.low.visible,true);
  let disposed=false;
  levels.low.geometry.addEventListener('dispose',()=>{disposed=true;});
  disposeModel(levels.group);
  assert.ok(disposed);
});
