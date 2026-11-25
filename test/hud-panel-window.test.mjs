import assert from 'node:assert/strict';
import test from 'node:test';
import {conversationTravelLane} from '../src/hud-panel-window.mjs';

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
