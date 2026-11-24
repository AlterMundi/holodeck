import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,Texture} from 'three';
import {bindMatterStyle} from '../src/matter-style.mjs';

test('room style replaces only local authored maps and can restore the original textures',()=>{
  const diffuse=new Texture({width:1024}),response=new Texture({width:512});
  const shell=new MeshBasicMaterial({name:'Orbital static diffuse',map:diffuse});
  const work=new MeshStandardMaterial({name:'Orbital focused material response',
    emissiveMap:diffuse,roughnessMap:response,metalnessMap:response});
  const untreated=new MeshBasicMaterial();
  const shared=new Mesh(undefined,shell);
  const shellMesh=new Mesh(undefined,shell),workMesh=new Mesh(undefined,[work,untreated]);
  const style=bindMatterStyle(new Group().add(shellMesh,workMesh));
  const images={diffuse:{width:2048},response:{width:1024}};
  style.apply(images);
  const replacement=shellMesh.material.map;
  assert.equal(replacement.image,images.diffuse);
  assert.equal(workMesh.material[0].emissiveMap,replacement);
  assert.equal(workMesh.material[0].roughnessMap.image,images.response);
  assert.equal(workMesh.material[0].metalnessMap,workMesh.material[0].roughnessMap);
  assert.equal(shared.material.map,diffuse);
  assert.equal(diffuse.image.width,1024);
  assert.equal(workMesh.material[1],untreated);
  style.apply();
  assert.equal(shellMesh.material.map,diffuse);
  assert.equal(workMesh.material[0].emissiveMap,diffuse);
  assert.equal(workMesh.material[0].roughnessMap,response);
  style.apply(images);
  assert.equal(shellMesh.material.map,replacement);
  style.dispose();
});
