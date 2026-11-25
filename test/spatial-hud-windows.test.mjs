import assert from 'node:assert/strict';
import test from 'node:test';
import {placeHudWindow} from '../src/spatial-hud-windows.mjs';

test('custom HUD placement remains fully recoverable after a narrow resize',()=>{
  const bounds={left:-.65,right:.65,top:.12,bottom:-1.63};
  const view={width:320,height:420};
  const wide={x:1080,y:645,scale:310};
  const actual=placeHudWindow(view,bounds,wide);
  assert.ok(actual.scale<wide.scale);
  assert.ok(actual.x+bounds.left*actual.scale>=8-.01);
  assert.ok(actual.x+bounds.right*actual.scale<=view.width-8+.01);
  assert.ok(actual.y-bounds.top*actual.scale>=8-.01);
  assert.ok(actual.y-bounds.bottom*actual.scale<=view.height-8+.01);
});
