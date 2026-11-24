import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import {bindMatterStyle,matterStyles} from '../src/matter-style.mjs';

test('room style affects local authored surfaces and can restore the original factors',()=>{
  const shell=new MeshBasicMaterial({name:'Orbital static diffuse',color:0xc0b090});
  const work=new MeshStandardMaterial({name:'Orbital focused material response',emissive:0xf4d2ab});
  const untreated=new MeshBasicMaterial();
  const shared=new Mesh(undefined,shell);
  const shellMesh=new Mesh(undefined,shell),workMesh=new Mesh(undefined,[work,untreated]);
  const style=bindMatterStyle(new Group().add(shellMesh,workMesh));
  const baseline=[shell.color.toArray(),work.emissive.toArray()];
  style.apply(matterStyles[1]);
  assert.notDeepEqual(shellMesh.material.color.toArray(),baseline[0]);
  assert.notDeepEqual(workMesh.material[0].emissive.toArray(),baseline[1]);
  assert.deepEqual(shared.material.color.toArray(),baseline[0]);
  assert.equal(workMesh.material[1],untreated);
  style.apply(matterStyles[0]);
  assert.deepEqual(shellMesh.material.color.toArray(),baseline[0]);
  assert.deepEqual(workMesh.material[0].emissive.toArray(),baseline[1]);
  style.dispose();
});
