import assert from 'node:assert/strict';
import test from 'node:test';
import {bindHudPanelWindow,conversationTravelLane} from '../src/hud-panel-window.mjs';

test('touch Conversation only shares travel controls when the viewport has room',()=>{
  const lane=(width,height,options={},previous='')=>conversationTravelLane({
    width,height,visualHeight:height,touch:true,zoom:1,...options,
  },previous);
  assert.equal(lane(430,782),'bottom');
  assert.equal(lane(360,640),'');
  assert.equal(lane(360,645,{},'bottom'),'bottom');
  assert.equal(lane(782,430),'side');
  assert.equal(lane(685,430,{},'side'),'side');
  assert.equal(lane(650,410,{},'side'),'');
  assert.equal(lane(782,330),'');
  assert.equal(lane(430,782,{visualHeight:424},'bottom'),'');
  assert.equal(lane(430,782,{zoom:1.25},'bottom'),'');
  assert.equal(lane(1060,700,{touch:false}),'');
});

test('a moved panel follows changed host insets without losing its preferred placement',()=>{
  const window=Object.assign(new EventTarget(),{
    innerWidth:800,innerHeight:600,navigator:{maxTouchPoints:0},
    matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),
  });
  const panel={ownerDocument:{defaultView:window},style:{},hidden:false,classList:{contains:()=>true},
    getBoundingClientRect:()=>({left:20,top:35,width:300,height:280})};
  const move=new EventTarget();
  let insets={};
  const fit=bindHudPanelWindow(panel,{move,resize:new EventTarget(),readInsets:()=>insets});
  move.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:'ArrowRight'}));
  assert.equal(panel.style.left,'28px');
  insets={left:190,top:78};
  fit();
  assert.equal(panel.style.left,'190px');
  assert.equal(panel.style.top,'78px');
  insets={};
  fit();
  assert.equal(panel.style.left,'28px');
  assert.equal(panel.style.top,'35px');
});
