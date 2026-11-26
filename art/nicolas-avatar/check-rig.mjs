import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Matrix4} from 'three';
import {createHumanMotionStudy,humanMotionStudies,motionStudyRate} from '../../src/human-motion-study.mjs';
import {parseGlb} from '../../tools/avatar-motion/rig.mjs';

const assets=new URL('../../public/assets/',import.meta.url);
const candidate=process.argv[2];
if(!candidate)throw Error('Usage: node art/nicolas-avatar/check-rig.mjs CANDIDATE.glb');

function readRig(path){
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const jsonSize=bytes.readUInt32LE(12);
  const document=JSON.parse(bytes.toString('utf8',20,20+jsonSize));
  const binary=28+jsonSize;
  const parents=new Map(document.nodes.flatMap((node,parent)=>(node.children??[]).map(child=>[child,parent])));
  const rigs=document.skins.map(skin=>{
    const inverses=new Map();
    const input=document.accessors[skin.inverseBindMatrices];
    const view=document.bufferViews[input.bufferView];
    assert.equal(input.componentType,5126);
    assert.equal(input.type,'MAT4');
    assert.equal(input.count,skin.joints.length);
    for(const [index,joint] of skin.joints.entries()){
      const offset=binary+(view.byteOffset??0)+(input.byteOffset??0)+index*(view.byteStride??64);
      inverses.set(joint,new Matrix4().fromArray(Array.from({length:16},(_,k)=>bytes.readFloatLE(offset+k*4))));
    }
    const rig=new Map();
    for(const joint of skin.joints){
      const node=document.nodes[joint],parent=parents.get(joint);
      const parentBind=inverses.get(parent);
      const localBind=parentBind?.clone().multiply(inverses.get(joint).clone().invert());
      assert.ok(node.name);
      assert.ok(!rig.has(node.name),`Duplicate joint ${node.name}`);
      rig.set(node.name,{node,parent:parentBind?document.nodes[parent].name:null,localBind});
    }
    return rig;
  });
  return {document,rigs,bytes:bytes.length};
}

function distance(a,b){
  assert.equal(a.length,b.length);
  return Math.max(...a.map((value,i)=>Math.abs(value-b[i])));
}

const stock=readRig(new URL('avatar-1-bodyA-skin01.glb',assets)).rigs[0];
const output=readRig(candidate);
assert.ok(output.rigs.length);
for(const rig of output.rigs){
  for(const [key,base] of stock){
    const value=rig.get(key);
    assert.ok(value,`Missing stock joint ${key}`);
    assert.equal(value.parent,base.parent,key);
    const a=base.node.rotation??[0,0,0,1],b=value.node.rotation??[0,0,0,1];
    assert.ok(Math.min(distance(a,b),distance(a,b.map(x=>-x)))<1e-4,`Rest rotation ${key}`);
    assert.ok(distance(base.node.translation??[0,0,0],value.node.translation??[0,0,0])<1e-5,`Rest offset ${key}`);
    assert.ok(distance(base.node.scale??[1,1,1],value.node.scale??[1,1,1])<1e-5,`Rest scale ${key}`);
    if(base.localBind){
      assert.ok(distance(base.localBind.elements,value.localBind.elements)<1e-4,`Local inverse bind ${key}`);
    }
  }
}

const model=await parseGlb(candidate);
async function clip(file){
  const animation=(await parseGlb(new URL(file,assets))).animations[0];
  animation.tracks=animation.tracks.filter(track=>model.scene.getObjectByName(track.name.split('.')[0]));
  assert.ok(animation.tracks.length>90,`Not enough bindable tracks for ${file}`);
  return animation;
}

const [idle,walk]=await Promise.all([clip('anim_idle.glb'),clip('anim_jog.glb')]);
const studies={};
for(const [name,study] of Object.entries(humanMotionStudies)){
  const sample=createHumanMotionStudy(model.scene,idle.clone(),study,study.walking?walk.clone():undefined);
  assert.equal(sample.count,Math.round(study.duration*motionStudyRate));
  assert.ok(sample.landmarks.length>0);
  studies[name]=sample.count;
}

const draws=output.document.meshes.flatMap(mesh=>mesh.primitives);
assert.ok(draws.every(draw=>'JOINTS_0' in draw.attributes&&'WEIGHTS_0' in draw.attributes),'Unskinned geometry');
const triangles=draws.reduce((count,draw)=>count+output.document.accessors[draw.indices].count/3,0);
const morphs=new Set();
model.scene.traverse(mesh=>{
  for(const name of Object.keys(mesh.morphTargetDictionary??{}))morphs.add(name);
});
console.log(JSON.stringify({bytes:output.bytes,triangles,skinnedDraws:draws.length,stockJoints:stock.size,
  skinCount:output.rigs.length,stockLocalBindsMatch:true,morphs:[...morphs],studies}));
