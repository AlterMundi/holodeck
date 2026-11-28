import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Mesh,MeshStandardMaterial} from 'three';
import {EXPRESSIONS,EXPRESSION_NAMES,SpeechArticulator,installNaveganteScreen} from '../src/navegante-screen.mjs';

test('the visor screen carries the nine expressions of the navigator sheet',()=>{
  assert.deepEqual(EXPRESSION_NAMES,['calm','curious','joy','sad','anger','uncertain','focus','welcome','sleep']);
  assert.equal(new Set(Object.values(EXPRESSIONS).map(e=>e.colour)).size>=7,true,'moods have their own colours');
  const plain=new MeshStandardMaterial();plain.name='Warm ceramic';
  assert.equal(installNaveganteScreen(new Mesh(new BufferGeometry(),plain)),null);
  const led=new MeshStandardMaterial();led.name='Visor LED screen';
  const mesh=new Mesh(new BufferGeometry(),led),screen=installNaveganteScreen(mesh);
  assert.ok(screen&&mesh.material.userData.keepInHologram);
  screen.set('anger');screen.update(.05);
  const red=screen.uniforms.sCol.value.x;
  assert.ok(red>.2&&red<1,'eases toward the new colour');
  screen.update(1,{motion:false});
  assert.ok(Math.abs(screen.uniforms.sEye1.value.x-EXPRESSIONS.anger.eye[4])<1e-6,'angry lids');
});

test('speech is articulated syllable by syllable, not only louder',()=>{
  const a=new SpeechArticulator(),shapes=new Set();let closed=0,maxOpen=0;
  for(let f=0;f<240;f++){
    const level=Math.max(0,Math.sin(f/60*2*Math.PI*4))*.7;
    a.update(level,1/60);
    if(a.open>.3)shapes.add([a.wide>.4?'wide':'',a.round>.4?'round':'',a.open>.7?'open':''].join('-'));
    if(f>30&&a.open<.1)closed++;
    maxOpen=Math.max(maxOpen,a.open);
  }
  assert.ok(shapes.size>=3,[...shapes].join(' / '));
  assert.ok(closed>20,'closes between syllables');
  assert.ok(maxOpen>.7);
  a.update(0,1);for(let f=0;f<60;f++)a.update(0,1/60);
  assert.ok(a.open<.01&&a.talking<.1,'falls silent');
});
