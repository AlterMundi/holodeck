import test from 'node:test';
import assert from 'node:assert/strict';
import {Group, Mesh, MeshPhysicalMaterial} from 'three';
import {useLightweightMatterGlazing} from '../src/matter-glazing.mjs';

test('lightweight glazing shares local replacements without changing cached or unrelated materials',()=>{
  const glass=new MeshPhysicalMaterial({name:'Clear archive glazing',transmission:.99});
  const other=new MeshPhysicalMaterial({name:'Other glass',transmission:.9});
  const first=new Mesh(undefined,glass), second=new Mesh(undefined,[other,glass]);
  const scene=new Group().add(first,second);
  const release=useLightweightMatterGlazing(scene);
  const replacement=first.material;
  assert.notEqual(replacement,glass);
  assert.deepEqual(second.material,[other,replacement]);
  assert.equal(glass.transmission,.99);
  assert.equal(glass.transparent,false);
  assert.equal(other.transmission,.9);
  assert.equal(replacement.transmission,0);
  assert.equal(replacement.transparent,true);
  assert.equal(replacement.depthWrite,false);
  assert.equal(replacement.forceSinglePass,true);
  let disposals=0;
  replacement.addEventListener('dispose',()=>disposals++);
  glass.addEventListener('dispose',()=>assert.fail('Cached material was disposed'));
  release();
  assert.equal(disposals,1);
});
