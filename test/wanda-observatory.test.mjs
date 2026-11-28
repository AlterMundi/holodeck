import test from 'node:test';
import assert from 'node:assert/strict';
import {wandaPhase} from '../src/wanda-observatory.mjs';
import {wandaHudData} from '../src/wanda-hud.mjs';

test('WANDA never promotes archived or simulated media to a live view',()=>{
  assert.equal(wandaPhase({simulated:true,online:true,captured:true,previewAgeMs:0}),'latest');
  assert.equal(wandaPhase({online:true,captured:true,previewAgeMs:5001}),'latest');
  assert.equal(wandaPhase({online:false,captured:true,previewAgeMs:0}),'offline');
  assert.equal(wandaPhase({online:true,previewAgeMs:-1}),'offline');
});

test('WANDA only presents recent, qualified exposure and preview observations',()=>{
  assert.equal(wandaPhase({online:true,captured:true,exposureAgeMs:200,previewAgeMs:100}),'exposing');
  assert.equal(wandaPhase({online:true,captured:true,exposureAgeMs:7800,previewAgeMs:300}),'live');
  assert.equal(wandaPhase({online:true,captured:true,exposureAgeMs:7800}),'latest');
  const view={nodeId:'nix',captureId:'capture',revision:'r1',phase:'exposing',
    capturedAt:'2025-11-28T03:00:01.100Z',exposureUs:100000,analogueGain:2};
  assert.deepEqual(wandaHudData(view),{nodeId:'nix',captureId:'capture',revision:'r1',
    status:'Exposición en curso · Captura archivada',details:'2025-11-28 03:00:01 UTC · 100 ms · 2×',unavailable:false});
  assert.equal(wandaHudData({...view,phase:'offline'}).status,'Nodo desconectado · Captura archivada');
  assert.equal(wandaHudData({...view,phase:'offline',captureId:null}).unavailable,true);
});
