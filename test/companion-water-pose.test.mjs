import assert from 'node:assert/strict';
import {test} from 'node:test';
import {companionWaterPitch} from '../src/companion-avatar.mjs';

test('the companion keeps a low surface pitch and tilts farther on descent than ascent',()=>{
  const surface=companionWaterPitch('surface',2,0);
  const glide=companionWaterPitch('submerged',2,0);
  const dive=companionWaterPitch('submerged',2,-2.8);
  const rise=companionWaterPitch('submerged',2,2.8);
  assert.equal(companionWaterPitch(null,8,-5),0);
  assert.ok(surface>0&&surface<rise&&rise<glide&&glide<dive&&dive<Math.PI/2);
  assert.equal(companionWaterPitch('submerged',8,-50),dive);
  assert.ok(companionWaterPitch('submerged',0,0)<glide);
});
