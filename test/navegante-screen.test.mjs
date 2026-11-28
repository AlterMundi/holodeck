import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Group,Mesh,MeshStandardMaterial} from 'three';
import {EXPRESSIONS,EXPRESSION_NAMES,SpeechArticulator,installNaveganteDisplay,installNaveganteScreen} from '../src/navegante-screen.mjs';

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

test('the mosaic head keeps its ceramic material and gains the same expression and speech hooks',()=>{
  const ceramic=new MeshStandardMaterial();ceramic.name='Nav4_CeramicMosaic';
  const cyan=new MeshStandardMaterial({emissive:0x2288ff,emissiveIntensity:5});
  cyan.name='Nav4_CyanEyes';
  const root=new Group(),head=new Mesh(new BufferGeometry(),ceramic);
  head.name='Nav4_Head';root.add(head);
  for(const name of ['Nav4_EyeL','Nav4_EyeR']){
    const eye=new Mesh(new BufferGeometry(),cyan);eye.name=name;root.add(eye);
  }
  const display=installNaveganteDisplay(root);
  assert.ok(display.mosaic&&head.material.userData.keepShaderInHologram);
  assert.notEqual(head.material,ceramic);
  for(const mood of EXPRESSION_NAMES){
    display.set(mood);display.update(1,{motion:false});assert.equal(display.name,mood);
  }
  display.set('joy');display.update(1,{motion:false});
  assert.equal(cyan.emissive.getHex(),EXPRESSIONS.joy.colour);
  for(let frame=0;frame<12;frame++)display.update(1/60,{speech:.9});
  assert.ok(display.speech.open>0&&display.uniforms.sTalk.value>0);
  display.update(0,{motion:false});
  assert.equal(display.speech.open,0);
});
