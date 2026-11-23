import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capWorldPixelRatio} from '../src/render-pixel-budget.mjs';

test('world framebuffer limits dense and oversized views and respects lower native density',()=>{
  const size={clientWidth:390,clientHeight:844},calls=[];
  let ratio=3,native=3;
  const webgl={domElement:{parentElement:size},getPixelRatio:()=>ratio,
    setPixelRatio:value=>{ratio=value;calls.push(value);}};
  const renderer={composer:{renderer:webgl},fitContainer:()=>webgl.setPixelRatio(native)};
  capWorldPixelRatio(renderer);
  assert.equal(ratio,2);
  renderer.fitContainer();
  assert.deepEqual(calls,[2]);
  Object.assign(size,{clientWidth:3840,clientHeight:2160});
  renderer.fitContainer();
  assert.ok(size.clientWidth*size.clientHeight*ratio**2<=2500000.000001);
  native=1;
  Object.assign(size,{clientWidth:1280,clientHeight:720});
  renderer.fitContainer();
  assert.equal(ratio,1);
});
