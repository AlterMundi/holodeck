import assert from 'node:assert/strict';
import test from 'node:test';
import {WorkspacePanels} from '../src/workspace-panels.mjs';

test('compact panels resume the most recently visible open panel without reopening it',()=>{
  const workspace=new WorkspacePanels(()=>true);
  workspace.set('conversation',true);
  workspace.set('table',true);
  workspace.set('map',true);
  assert.equal(workspace.visible('table'),false);
  assert.equal(workspace.opened('table'),true);
  assert.equal(workspace.visible('map'),true);
  workspace.set('map',false);
  assert.equal(workspace.visible('table'),true);
  workspace.set('table',false);
  assert.equal(workspace.visible('conversation'),true);
});

test('wide panels coexist and resize preserves their stack',()=>{
  let compact=false;
  const workspace=new WorkspacePanels(()=>compact);
  for(const panel of ['table','conversation','map'])workspace.set(panel,true);
  assert.ok(['table','conversation','map'].every(panel=>workspace.visible(panel)));
  compact=true;
  assert.equal(workspace.foreground(),'map');
  workspace.set('conversation',true);
  assert.equal(workspace.visible('conversation'),true);
  workspace.set('conversation',false);
  assert.equal(workspace.visible('map'),true);
  compact=false;
  assert.equal(workspace.visible('table'),true);
});
