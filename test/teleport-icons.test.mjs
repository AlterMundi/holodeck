import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Vector3} from 'three';
import {parseGlb} from '../tools/avatar-motion/rig.mjs';
import {TeleportIcons,clusterTriangles,facadeIcon,iconGlb,iconKey,pngGrid,TELEPORT_ICON_VERSION} from '../src/teleport-icons.mjs';
import {residenceAssets} from '../src/toroidal-residence-assets.mjs';

const residence=readFileSync(new URL('../public/'+residenceAssets.visual.path,import.meta.url));

async function parse(bytes){
  const file=new URL('../.icon-test.glb',import.meta.url);
  (await import('node:fs')).writeFileSync(file,bytes);
  try{return await parseGlb(file.pathname);}finally{(await import('node:fs')).rmSync(file,{force:true});}
}
const fits=scene=>{
  const size=new Box3().setFromObject(scene).getSize(new Vector3());
  return Math.max(size.x,size.z)<=.2401&&size.y<=.2601&&size.y>.02;
};

test('icon keys follow the source revision',()=>{
  const a=iconKey({kind:'room',revision:'1'}),b=iconKey({kind:'room',revision:'2'});
  assert.notEqual(a,b);
  assert.equal(a,iconKey({kind:'room',revision:'1'}));
  assert.match(TELEPORT_ICON_VERSION,/^tp-icon-v\d+$/);
});

test('a house icon is drawn from its facade and fits the pedestal',async()=>{
  const glb=iconGlb(facadeIcon({color:'#4a746f',width:3.15,depth:1.5,height:2.65}));
  const {scene}=await parse(glb);
  assert.ok(fits(scene));
});

test('the Residence icon is generated low-poly from its own export',async()=>{
  const icons=new TeleportIcons({worker:false});
  const glb=await icons.glb({kind:'residence',revision:residenceAssets.visual.sha256,bytes:residence});
  assert.ok(glb&&glb.length<60_000,'bytes '+glb?.length);
  const {scene}=await parse(glb);
  let triangles=0;scene.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});
  assert.ok(triangles>40&&triangles<=1400,'triangles '+triangles);
  assert.ok(fits(scene));
  assert.equal(await icons.glb({kind:'residence',revision:residenceAssets.visual.sha256,bytes:residence}),glb,'cached');
});

test('clustering respects the triangle budget',()=>{
  const positions=[],colors=[];
  for(let i=0;i<4000;i++){const a=Math.random()*6.3,b=Math.random()*3.1;
    for(let k=0;k<3;k++){positions.push(Math.cos(a+k*.01)*Math.sin(b),Math.cos(b+k*.01),Math.sin(a)*Math.sin(b));colors.push(1,1,1);}}
  const mesh=clusterTriangles({positions:new Float32Array(positions),colors:new Float32Array(colors)},{triangles:300});
  assert.ok(mesh.indices.length/3<=300);
});

test('PNG colour grid reads an embedded image',()=>{
  // 1x1 red PNG
  const red=Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc000000301010018dd8db00000000049454e44ae426082','hex');
  const grid=pngGrid(red);
  assert.ok(grid[0]>.9&&grid[1]<.05&&grid[2]<.05);
});

test('the worker builds a room icon off the event loop',async()=>{
  const icons=new TeleportIcons();
  let ticks=0;const timer=setInterval(()=>ticks++,5);
  const glb=await icons.glb({kind:'residence',revision:'worker-'+residenceAssets.visual.sha256,bytes:()=>residence});
  clearInterval(timer);
  assert.ok(glb&&glb.length>1000);
  assert.ok(ticks>5,'event loop kept running: '+ticks);
  icons.worker.worker?.terminate();
});
