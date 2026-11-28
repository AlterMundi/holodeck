import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three';
import {verticalWheelDistance} from '../src/avatar-camera.mjs';
import {matterAvatarScale,WorktableNavigation} from '../src/worktable-navigation.mjs';
import {TeleportWorkspace} from '../src/teleport-workspace.mjs';

test('the teleport camera uses the avatar Shift-wheel convention and bounds lift in the table frame',()=>{
  const scene=new Group(),board=new Group();
  const workspace=new TeleportWorkspace(()=>{},()=>({
    feet:new Vector3(2,3,4),up:new Vector3(1,0,0),forward:new Vector3(0,0,1),
  }));
  assert.equal(workspace.enter(board,scene),true);
  const before=workspace.camera.position.clone();
  const distance=verticalWheelDistance({shiftKey:true,deltaX:-100,deltaY:0,deltaMode:0},600);
  workspace.lift(distance);
  assert.ok(workspace.camera.position.distanceTo(before.add(new Vector3(.24,0,0)))<1e-10);
  workspace.lift(100);
  assert.equal(workspace.localEye.y,3.25);
  workspace.lift(-100);
  assert.equal(workspace.localEye.y,.52);
  assert.equal(verticalWheelDistance({shiftKey:false,deltaY:100,deltaMode:0},600),null);
});

test('the teleport draw borrows both bodies at table scale and restores visibility and pose even on error',()=>{
  const world=new Group(),parent=new Group(),explorer=new Group(),companion=new Group();
  world.add(parent);
  parent.position.set(4,-2,5);
  parent.rotation.z=.3;
  parent.add(explorer,companion);
  explorer.position.set(1,2,3);
  companion.position.set(-2,3,1);
  explorer.visible=false;
  const point=new Vector3();
  const original=explorer.getWorldPosition(point).clone(),robot=companion.getWorldPosition(point).clone();
  const workspace=new TeleportWorkspace(()=>{},()=>({
    feet:new Vector3(2,3,4),up:new Vector3(0,1,0),forward:new Vector3(0,0,1),
  }));
  assert.equal(workspace.enter(new Group(),world),true);
  assert.throws(()=>workspace.drawAvatars(explorer,companion,()=>{
    world.updateMatrixWorld(true);
    for(const avatar of [explorer,companion]){
      assert.equal(avatar.visible,true);
      assert.ok(Math.abs(avatar.getWorldScale(point).x-matterAvatarScale)<1e-10);
      const tablePosition=workspace.place.worldToLocal(avatar.getWorldPosition(point));
      assert.ok(Math.abs(tablePosition.y-.8)<1e-10);
      assert.ok(Math.abs(Math.hypot(tablePosition.x,tablePosition.z)-.76)<1e-10);
    }
    throw Error('draw failed');
  }),/draw failed/);
  assert.equal(explorer.visible,false);
  assert.equal(companion.visible,true);
  assert.equal(explorer.matrixAutoUpdate,true);
  assert.ok(explorer.getWorldPosition(point).distanceTo(original)<1e-10);
  assert.ok(companion.getWorldPosition(point).distanceTo(robot)<1e-10);
});


test('fixed and personal worktables use one exclusive navigation lifecycle, Shift wheel and Escape',()=>{
  const navigation=new WorktableNavigation(),fixed={},personal={};
  const calls=[];
  assert.doesNotThrow(()=>navigation.unmount(undefined));
  const mount=(surface,name)=>navigation.mount(surface,{
    enter:()=>{calls.push('enter '+name);return true;},
    leave:()=>calls.push('exit '+name),
    lift:delta=>calls.push(delta),
  });
  for(const [surface,name,other] of [[fixed,'fixed',personal],[personal,'personal',fixed]]){
    assert.equal(mount(surface,name),true);
    assert.equal(mount(other,'unexpected'),false);
    let consumed=false;
    const wheel={shiftKey:true,deltaMode:1,deltaY:-2,preventDefault(){consumed=true;},stopImmediatePropagation(){}};
    assert.equal(navigation.wheel(other,wheel,400),false);
    assert.equal(navigation.wheel(surface,wheel,400),true);
    assert.equal(consumed,true);
    assert.equal(navigation.escape(surface,{key:'Escape',repeat:true},()=>assert.fail()),true);
    assert.equal(navigation.escape(surface,{key:'Escape'},()=>navigation.unmount(surface)),true);
    assert.equal(navigation.wheel(surface,wheel,400),false);
  }
  assert.deepEqual(calls,['enter fixed',.0768,'exit fixed','enter personal',.0768,'exit personal']);
});
