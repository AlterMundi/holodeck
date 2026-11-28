import test from 'node:test';
import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {Box3,Vector3} from 'three';
import {parseGlb} from '../tools/avatar-motion/rig.mjs';
import {
  faceViewer,showNodes,stationMotion,stationParts,TELEPORT_CLIPS,TELEPORT_MINIATURE_KINDS,TELEPORT_NODE_COUNT,
} from '../src/teleport-station-asset.mjs';

const assets=new URL('../public/assets/teleport/',import.meta.url);
const station=()=>parseGlb(new URL('teleport-station.glb',assets).pathname);

test('station stays within its runtime byte budget',()=>{
  assert.ok(statSync(new URL('teleport-station.glb',assets)).size<1_100_000);
  assert.ok(statSync(new URL('teleport-miniatures.glb',assets)).size<400_000);
});

test('station exposes every named anchor and clip',async()=>{
  const gltf=await station();
  const parts=stationParts(gltf.scene);
  assert.equal(parts.nodes.length,TELEPORT_NODE_COUNT);
  for(const name of Object.values(TELEPORT_CLIPS))assert.ok(gltf.animations.some(clip=>clip.name===name),name);
});

test('board fits the brief: low, round and open behind the parent',async()=>{
  const gltf=await station();
  const parts=stationParts(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const center=parts.center.getWorldPosition(new Vector3());
  assert.ok(center.y>.6&&center.y<.9,'board surface '+center.y);
  const parent=parts.parent.getWorldPosition(new Vector3());
  assert.ok(parent.y>center.y+.25,'parent above the board');
  for(const node of parts.nodes){
    const at=node.getWorldPosition(new Vector3());
    assert.ok(at.y>center.y&&at.y<parent.y,'child between board and parent');
  }
  // The travel column is collapsed at rest, so it cannot hide the world.
  parts.beam.forEach(object=>object.visible=false);
  const box=new Box3().setFromObject(gltf.scene);
  const size=box.getSize(new Vector3());
  assert.ok(size.x>1.6&&size.x<2.0,'width '+size.x);
  assert.ok(Math.abs(size.x-size.z)<.12,'round footprint');
  // Front nodes sit toward the viewer (+Z).
  const front=parts.nodes.slice(0,2).map(node=>node.getWorldPosition(new Vector3()).z);
  assert.ok(front.every(z=>z>0));
});

test('travel carriage turns on its rail to face the viewer',async()=>{
  const gltf=await station();
  const parts=stationParts(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const slot=()=>{gltf.scene.updateMatrixWorld(true);return parts.travelSlot.getWorldPosition(new Vector3());};
  assert.ok(slot().z>.8,'rests at the front');
  faceViewer(parts,new Vector3(3,1.5,0));
  const right=slot();
  assert.ok(right.x>.8&&Math.abs(right.z)<.05,'faces a viewer on the right');
  faceViewer(parts,new Vector3(0,1.5,-3));
  assert.ok(slot().z<-.8,'faces a viewer behind');
  const before=parts.carriage.rotation.y;
  faceViewer(parts,new Vector3(3,1.5,0),.25);
  assert.ok(Math.abs(parts.carriage.rotation.y-before)>0&&Math.abs(parts.carriage.rotation.y-before)<Math.PI/2,'eases');
});

test('node visibility and reduced-motion clips',async()=>{
  const gltf=await station();
  const parts=stationParts(gltf.scene);
  showNodes(parts,2,{parent:false});
  assert.deepEqual(parts.nodes.map(node=>node.visible),[true,true,false,false]);
  assert.equal(parts.parent.visible,false);
  const motion=stationMotion(gltf.scene,gltf.animations,{reduced:()=>true});
  motion.travel();
  assert.ok(parts.beam[0].scale.y>.9,'reduced motion shows the final travel pose');
  motion.dispose();
});

test('miniature library covers every destination kind',async()=>{
  const gltf=await parseGlb(new URL('teleport-miniatures.glb',assets).pathname);
  for(const kind of TELEPORT_MINIATURE_KINDS)assert.ok(gltf.scene.getObjectByName('tp_mini_'+kind),kind);
});
