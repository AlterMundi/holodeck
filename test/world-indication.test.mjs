import {test} from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,SphereGeometry,BoxGeometry,MeshBasicMaterial} from 'three';
import {PublicWorldPicker} from '../src/world-indication.mjs';
function fixture(){
 const scene=new Group(),entity=new Group(),cue=new Group();entity.position.z=-3;cue.position.z=-2;
 entity.add(new Mesh(new SphereGeometry(.5),new MeshBasicMaterial()));cue.add(new Mesh(new BoxGeometry(.3,.3,.3),new MeshBasicMaterial()));scene.add(entity,cue);
 const e={id:'garden-first',getAttribute:()=> '1',getContainer:()=>entity};
 const root={getAttribute:key=>({'data-run':'fixture','data-edition':'edition','data-semantic-sequence':'1'}[key]),
  querySelectorAll:selector=>selector.includes('data-entity-revision')?[e]:[{getContainer:()=>cue}]};
 const canvas=new EventTarget();canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
 const picks=[];let unavailable=0,proof={run:'fixture',edition:'edition',sequence:1};
 const picker=new PublicWorldPicker({document:{querySelector:()=>root},canvas,scene,cameraState:()=>({position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1},fov:60,aspect:1}),proof:()=>proof,onPick:value=>picks.push(value),onUnavailable:()=>unavailable++});
 return {picker,scene,canvas,picks,get unavailable(){return unavailable;},invalidate(){proof=null;}};
}
test('actual Three picking skips communication cues but respects real scenery and private preview occlusion',()=>{
 const f=fixture();assert.equal(f.picker.pick(50.25,50.25).target,'garden-first');
 const wall=new Mesh(new BoxGeometry(1,1,.1),new MeshBasicMaterial());wall.position.z=-1;f.scene.add(wall);
 assert.equal(f.picker.pick(50.25,50.25),null);wall.removeFromParent();
 f.invalidate();assert.equal(f.picker.pick(50.25,50.25),null);assert.equal(f.unavailable,1);f.picker.dispose();
});
test('short stationary pointer gestures select locally, while camera drag/multi-touch/cancel never selects',()=>{
 const f=fixture(),event=(type,extra={})=>{const e=new Event(type);Object.assign(e,{pointerId:1,clientX:50.25,clientY:50.25,button:0,isPrimary:true,...extra});f.canvas.dispatchEvent(e);};
 event('pointerdown');event('pointermove',{clientX:60});event('pointerup',{clientX:60});assert.equal(f.picks.length,0);
 event('pointerdown');event('pointerdown',{pointerId:2,isPrimary:false});event('pointerup');assert.equal(f.picks.length,0);
 event('pointerdown');event('pointercancel');event('pointerup');assert.equal(f.picks.length,0);
 event('pointerdown');event('pointerup');assert.equal(f.picks.length,1);assert.equal(f.picks[0].revision,1);
 f.picker.dispose();event('pointerdown');event('pointerup');assert.equal(f.picks.length,1);
});
