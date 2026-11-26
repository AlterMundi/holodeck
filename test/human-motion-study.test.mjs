import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {buildMotionStudyRevision} from '../tools/character-pose-catalog.mjs';
import {Group} from 'three';
import {createHumanMotionStudy,humanMotionStudies,motionStudyRate} from '../src/human-motion-study.mjs';
import {humanAvatar,stockLocomotion} from '../tools/avatar-motion/rig.mjs';

test('a sampled live flight pose plays on the same rig in either direction',async()=>{
  const {mesh}=humanAvatar('avatar-1-bodyA-skin01.glb');
  const {clips}=await stockLocomotion(mesh);
  const run=createHumanMotionStudy(mesh,clips.idle.getClip(),humanMotionStudies['estudio-vuelo']);
  const mount=new Group();
  const snapshot=frame=>{
    const water=run.apply(mesh,mount,frame);
    assert.ok(Number.isNaN(water));
    return [mount.quaternion.toArray(),mesh.getObjectByName('upperarm_l').quaternion.toArray()];
  };
  assert.equal(run.count,6*motionStudyRate);
  assert.deepEqual(run.chapters.map(chapter=>chapter.id),['ground','lift','hover','turn','land']);
  assert.equal(run.chapters[0].frame,0);
  assert.ok(run.chapters.every(({frame},index)=>!index||frame>run.chapters[index-1].frame));
  assert.ok(run.chapters.at(-1).frame>3.2*motionStudyRate&&run.chapters.at(-1).frame<run.count);

  const airborne=snapshot(78);
  assert.notDeepEqual(airborne,snapshot(0));
  assert.notDeepEqual(airborne,snapshot(run.count));
  assert.deepEqual(airborne,snapshot(78));
});

test('the boost study bookmarks entry, extension, release and float on the shipped rig',async()=>{
  const {mesh}=humanAvatar('avatar-1-bodyA-skin01.glb');
  const {clips}=await stockLocomotion(mesh);
  const study=createHumanMotionStudy(mesh,clips.idle.getClip(),humanMotionStudies['estudio-aceleracion']);
  assert.deepEqual(study.chapters.map(({id})=>id),['ground','lift','hover','cruise','boost','fast','turn','release','float','land']);
  const frames=new Map(study.chapters.map(({id,frame})=>[id,frame]));
  const mount=new Group();
  const pose=frame=>{
    study.apply(mesh,mount,frame);
    return ['upperarm_l','upperarm_r','calf_l','calf_r'].flatMap(name=>
      mesh.getObjectByName(name).quaternion.toArray());
  };
  const fast=pose(frames.get('fast'));
  assert.notDeepEqual(fast,pose(frames.get('cruise')));
  assert.notDeepEqual(fast,pose(frames.get('float')));
  assert.deepEqual(fast,pose(frames.get('fast')));
});

test('the swim study follows the actual water surface and revisits identical submerged joints',async()=>{
  const {mesh}=humanAvatar('avatar-2-bodyB-skin03.glb');
  const {clips}=await stockLocomotion(mesh);
  const run=createHumanMotionStudy(mesh,clips.idle.getClip(),humanMotionStudies['estudio-nado']);
  const mount=new Group();
  const water=frame=>run.apply(mesh,mount,frame);
  const baseline=water(14);
  const submerged=water(81);
  assert.ok(submerged>baseline+.1,{baseline,submerged});
  const arm=mesh.getObjectByName('upperarm_l').quaternion.toArray();
  assert.notEqual(water(144),submerged);
  assert.equal(water(81),submerged);
  assert.deepEqual(mesh.getObjectByName('upperarm_l').quaternion.toArray(),arm);
});

test('the walking study samples the live walk blend and settles after release',async()=>{
  const {mesh}=humanAvatar('avatar-1-bodyA-skin01.glb');
  const {clips}=await stockLocomotion(mesh);
  const study=humanMotionStudies['estudio-marcha'];
  const run=createHumanMotionStudy(mesh,clips.idle.getClip(),study,clips.jog.getClip());
  const mount=new Group();
  const sample=frame=>{
    assert.ok(Number.isNaN(run.apply(mesh,mount,frame)));
    return ['thigh_l','calf_l','thigh_r','calf_r'].flatMap(name=>mesh.getObjectByName(name).quaternion.toArray());
  };
  assert.deepEqual(run.chapters.map(({id})=>id),['ground','walk','brake','settled']);
  const [ground,walk,brake,settled]=run.chapters.map(({frame})=>frame);
  assert.equal(ground,0);
  assert.ok(walk>ground&&brake>walk&&settled>brake&&settled<run.count);
  const stride=sample(walk+9);
  assert.notDeepEqual(stride,sample(ground));
  assert.notDeepEqual(stride,sample(settled));
  assert.deepEqual(sample(walk+9),stride);
});

test('pose editions stay stable across shading changes and track pose inputs',async()=>{
  const withEdit=(filter,before,after)=>[{name:'study-source-edit',setup(build){
    build.onLoad({filter},async({path})=>{
      const source=await readFile(path,'utf8');
      assert.ok(source.includes(before));
      return {loader:'js',resolveDir:dirname(path),contents:source.replace(before,after)};
    });
  }}];
  const [original,woodland,braking,water]=await Promise.all([
    buildMotionStudyRevision(),
    buildMotionStudyRevision(withEdit(/toroidal-terrain\.mjs$/,'woodland:[.071,.109,.041]','woodland:[.18,.11,.04]')),
    buildMotionStudyRevision(withEdit(/human-motion-study\.mjs$/,'const walkRelease=1.9;','const walkRelease=2.1;')),
    buildMotionStudyRevision(withEdit(/toroidal-terrain\.mjs$/,'waterLevel: -9,','waterLevel: -8,')),
  ]);
  assert.equal(woodland,original);
  assert.notEqual(braking,original);
  assert.notEqual(water,original);
});
