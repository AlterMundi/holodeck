import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial} from 'three';
import {EXPRESSIONS,EXPRESSION_NAMES,installNaveganteFace} from '../src/navegante-face.mjs';

const plate=()=>{
  const geometry=new BufferGeometry();
  // A shallow plate: wide in x and y, thin in z, centred at y=.95.
  geometry.setAttribute('position',new Float32BufferAttribute([-.19,.76,.18, .19,.76,.18, .19,1.14,.18, -.19,1.14,.18, 0,.95,.23],3));
  const material=new MeshStandardMaterial();material.name='Navegante face';
  return new Mesh(geometry,material);
};

test('the nine gallery expressions are all defined',()=>{
  assert.deepEqual(EXPRESSION_NAMES,['calm','curious','joy','sad','anger','uncertain','focus','welcome','sleep']);
  for(const e of Object.values(EXPRESSIONS)){
    assert.equal(e.lift.length,2);assert.equal(e.open.length,2);assert.ok(Number.isFinite(e.mouth.open));
  }
});

test('the face finds its plate, eases between expressions and opens with speech',()=>{
  assert.equal(installNaveganteFace(new Mesh(new BufferGeometry(),new MeshStandardMaterial())),null);
  const face=installNaveganteFace(plate());
  assert.ok(face);
  assert.ok(Math.abs(face.uniforms.faceCentre.value.y-.95)<1e-6);
  assert.ok(Math.abs(face.uniforms.faceRadius.value-.19)<1e-6);
  face.set('joy');
  face.update(.05);
  const halfway=face.uniforms.faceMouth.value.x;
  assert.ok(halfway>0&&halfway<1,'eases toward the open laugh');
  for(let i=0;i<60;i++)face.update(1/30);
  assert.ok(face.uniforms.faceMouth.value.x>.95);
  face.set('calm');face.update(1,{motion:false,speech:1});
  assert.equal(face.uniforms.faceMouth.value.x,EXPRESSIONS.calm.mouth.open);
  assert.ok(face.uniforms.faceMouth.value.w>.7,'speech opens the mouth');
  const anger=new (face.colour.constructor)(EXPRESSIONS.anger.brow[0]);
  face.set('anger');face.update(1,{motion:false});
  assert.ok(Math.abs(face.uniforms.faceBrow.value.x-anger.r)<1e-6,'brows take the mood colour');
});
