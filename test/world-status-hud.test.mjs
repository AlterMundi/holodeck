import assert from 'node:assert/strict';
import test from 'node:test';
import {wrapNotice} from '../src/world-status-hud.mjs';

test('narrow notices keep accents and joined glyphs together when splitting long words',()=>{
  const width=text=>[...text].length;
  assert.deepEqual(wrapNotice('Ae\u0301C',width,2),['A','e\u0301','C']);
  assert.deepEqual(wrapNotice('A👩‍🔬B',width,3),['A','👩‍🔬','B']);
  assert.deepEqual(wrapNotice('👩‍🔬',width,2),[]);
  assert.deepEqual(wrapNotice('a\n\nb',width,2),['a',' ','b']);
  assert.deepEqual(wrapNotice('abcdefghij',width,1),[]);
});
