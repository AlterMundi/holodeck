import assert from 'node:assert/strict';
import {test} from 'node:test';
import {capWorldPixelRatio} from '../src/render-pixel-budget.mjs';

function display({adaptive=true,dpr=3}={}){
  let now=0,ratio=1;
  const parent={clientWidth:390,clientHeight:844};
  const allocations=[];
  const webgl={domElement:{parentElement:parent},getPixelRatio:()=>ratio,setPixelRatio(value){
    ratio=value;allocations.push(value);
  }};
  const renderer={composer:{renderer:webgl},fitContainer:()=>webgl.setPixelRatio(dpr)};
  const visibility=new EventTarget();
  const {sample,dispose}=capWorldPixelRatio(renderer,{adaptive,clock:()=>now,visibility});
  return {webgl,allocations,parent,renderer,sample,dispose,visibility,
    frames(interval,count,ready=true){for(let index=0;index<count;index++){now+=interval;sample(ready);}}};
}

test('sustained slow touch frames lower density and reserve recovery for stable headroom',()=>{
  const view=display();
  view.sample(true);
  view.frames(400,1);
  view.frames(16,4);
  assert.deepEqual(view.allocations,[2]);
  view.frames(50,4);
  assert.deepEqual(view.allocations,[2,1.5]);
  view.frames(500,4);
  assert.deepEqual(view.allocations,[2,1.5]);
  view.frames(500,1);
  assert.deepEqual(view.allocations,[2,1.5,1]);

  view.frames(16,120);
  assert.deepEqual(view.allocations,[2,1.5,1]);
  view.frames(16,1100);
  assert.deepEqual(view.allocations,[2,1.5,1,1.5]);
});

test('hidden frames, room changes and resized canvases do not count toward a drop',()=>{
  const view=display();
  view.frames(100,4);
  view.frames(400,8,false);
  view.frames(100,4);
  assert.deepEqual(view.allocations,[2]);
  view.parent.clientWidth=400;
  view.renderer.fitContainer();
  view.frames(100,4);
  assert.deepEqual(view.allocations,[2]);
  view.frames(100,1);
  assert.deepEqual(view.allocations,[2,1.5]);
  view.parent.clientWidth=2000;
  view.parent.clientHeight=2000;
  view.renderer.fitContainer();
  const bounded=Math.sqrt(2500000/(2000*2000));
  assert.equal(view.webgl.getPixelRatio(),bounded);
  view.frames(500,20);
  assert.equal(view.webgl.getPixelRatio(),bounded);
});

test('desktop keeps native density subject to the existing pixel ceiling',()=>{
  const view=display({adaptive:false,dpr:1});
  view.frames(500,200);
  assert.equal(view.webgl.getPixelRatio(),1);
  assert.deepEqual(view.allocations,[]);
  const dense=display({adaptive:false});
  dense.frames(500,200);
  assert.deepEqual(dense.allocations,[2]);
});

test('a visibility change breaks a streak even if rendering paused in the background',()=>{
  const view=display();
  view.sample(true);
  view.frames(100,3);
  view.visibility.dispatchEvent(new Event('visibilitychange'));
  view.frames(2000,1);
  assert.deepEqual(view.allocations,[2]);
  view.frames(100,4);
  assert.deepEqual(view.allocations,[2,1.5]);
  view.dispose();
});
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
