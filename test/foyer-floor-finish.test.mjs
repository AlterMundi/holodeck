import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Mesh,MeshStandardMaterial,PlaneGeometry,ShaderLib} from 'three';
import {bindFoyerFloorFinish} from '../src/foyer-floor-finish.mjs';

test('the authored foyer finish decorates the three loaded materials and releases their shaders',()=>{
  const room=new Group(),geometry=new PlaneGeometry();
  const materials=['Honed honey limestone','Ivory limewash','Split basalt','Blue gunmetal']
    .map(name=>new MeshStandardMaterial({name}));
  const originals=materials.map(mat=>mat.onBeforeCompile);
  materials[0].customProgramCacheKey=()=> 'authored-atlas';
  room.add(...materials.map(material=>new Mesh(geometry,material)));
  const release=bindFoyerFloorFinish(room);
  try{
    for(const [index,material] of materials.entries()){
      const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
      material.onBeforeCompile(shader);
      if(index===3){
        assert.equal(shader.fragmentShader,ShaderLib.standard.fragmentShader);
        continue;
      }
      assert.match(shader.vertexShader,/foyerPoint = position/);
      assert.match(shader.fragmentShader,/1\.0-smoothstep\(\.0006,\.0025,abs\(foyerPoint.y-/);
      assert.match(shader.fragmentShader,index===2?/foyerRouteEdge/:/foyerCourse/);
    }
    assert.equal(materials[0].customProgramCacheKey(),'authored-atlas-foyer-finish-deck');
    assert.equal(room.children.length,4);
  }finally{
    release();
    geometry.dispose();
    for(const material of materials)material.dispose();
  }
  assert.deepEqual(materials.map(mat=>mat.onBeforeCompile),originals);
  assert.equal(materials[0].customProgramCacheKey(),'authored-atlas');
});
