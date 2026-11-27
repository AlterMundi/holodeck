import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {Box3,Float32BufferAttribute,Group,Int16BufferAttribute,Mesh,MeshStandardMaterial,Texture,Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {batchModel} from './batch.mjs';
import {embedFinishMaps} from './finish-maps.mjs';
import {makePorticoBeam,makePorticoCrown} from './model.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=['architecture.js','scene.js','materials.js','layout.js','nature.js','sculpture.js'];
const budget={bytes:768*1024,triangles:24000,draws:20};
const envelope={x:.98,y:2.74,z:1.81};
const uvScale=4;
const segments=[
  ['flutes * 10','flutes * 2'],
  ['Math.max(24, Math.round(h * 14))','Math.max(6, Math.round(h * 3))'],
  ['const N = 160','const N = 42'],
  ['CatmullRomCurve3(pts), 220, tube, 6','CatmullRomCurve3(pts), 15, tube, 4'],
  ['0.05 * r, 10, 48','0.05 * r, 5, 16'],
  ['[0, 0.32 * r]], 48','[0, 0.32 * r]], 18'],
  ['const egg = new THREE.SphereGeometry(1, 10, 8)','const egg = new THREE.SphereGeometry(1, 5, 3)'],
  ['const eggs = 22','const eggs = 11'],
  ['let i = 0; i <= 24; i++','let i = 0; i <= 7; i++'],
  ['const t = i / 24, zz','const t = i / 7, zz'],
  ['lathe(prof, 36)','lathe(prof, 9)'],
  ['0.1 * r, 12, 8','0.1 * r, 8, 5'],
  ['a0, a1, n = 10','a0, a1, n = 3'],
  ['lathe(pts, 56)','lathe(pts, 10)'],
];

function replaceSource(source,replacements){
  for(const [from,to] of replacements){
    const at=source.indexOf(from);
    assert.ok(at>=0&&source.indexOf(from,at+from.length)<0,
      'The HD generator revision changed at: '+from);
    source=source.slice(0,at)+to+source.slice(at+from.length);
  }
  return source;
}

function architecturalSource(source,low) {
  if(low)source=replaceSource(source,segments);
  // Roof tile variation is the only stochastic input in the shrine.
  return `let seed=41;
    const tileRandom=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    ${source.replaceAll('Math.random()', 'tileRandom()')}`;
}

function shrineSource(source,low){
  if(!low)return source+'\nexport {streetShrine};';
  const roof=source.indexOf('  entabRect(B, f, -0.88, 0.88, -1.1, 1.38,');
  const door=source.indexOf('  // doorway with bronze doors');
  assert.ok(roof>0&&door>roof,'The HD shrine roof and opening must match the selected source');
  source=source.slice(0,roof)+source.slice(door);
  return replaceSource(source,[
    ['colH, x > 0.5 ? r : r * 0.9)','colH - 0.105, x > 0.5 ? r * 1.18 : r * 1.06)'],
    ['0, s * -0.55, 0','0, 0, 0'],
  ])+'\nexport {streetShrine};';
}

async function hdGenerators(directory,sources,low) {
  const {outputFiles}=await build({
    stdin:{
      contents:"export {streetShrine} from './scene.js'; export {buildMaterials} from './materials.js';",
      resolveDir:directory,sourcefile:'selected-linterna-hd.js',
    },
    bundle:true,write:false,platform:'node',format:'esm',
    plugins:[{
      name:'selected-hd-sources',
      setup(builder){
        builder.onResolve({filter:/^three(?:\/addons\/.*)?$/},({path})=>({
          path:import.meta.resolve(path),external:true,
        }));
        builder.onResolve({filter:/^\./},({path})=>{
          assert.ok(sourceFiles.includes(path.slice(2)),'Unexpected HD dependency: '+path);
          return {path:join(directory,path)};
        });
        builder.onLoad({filter:/\.js$/},({path})=>{
          const name=Object.keys(sources).find(name=>join(directory,name)===path);
          const source=sources[name];
          if(name==='scene.js')return {contents:shrineSource(source,low)};
          if(name==='architecture.js')return {contents:architecturalSource(source,low)};
          return {contents:source};
        });
      },
    }],
  });
  return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].contents).toString('base64'));
}

function collect({streetShrine,buildMaterials},bakedMasonry=false) {
  const M=buildMaterials();
  const group=new Group();
  const finishes=new Map();
  const add=(name,geo,matrix,tint)=>{
    // The standalone walk uses a glowing quad to suggest a room. Here the
    // visible opening belongs to the existing real Holodeck passage.
    if(name==='glow')return;
    const original=M[name];
    assert.ok(original,'Missing HD material '+name);
    const geometry=geo.clone();
    geometry.applyMatrix4(matrix);
    let finish=finishes.get(name);
    if(!finish){
      const u=original.userData.uniforms;
      finish=new MeshStandardMaterial({
        name,color:u?.uColA.value??original.color,metalness:Math.min(.64,original.metalness),
        roughness:u?.uRough.value??original.roughness,
        emissive:original.emissive,emissiveIntensity:Math.min(1.8,original.emissiveIntensity),
      });
      if(/^(marble|ashlar|terracotta)/.test(name))finish.userData.linternaMap='stone';
      if(bakedMasonry&&name==='ashlarSmall'){
        finish.color.setHex(0xffffff);
        finish.userData.linternaMap='hdMasonry';
      }
      finishes.set(name,finish);
    }
    if(tint){
      const rgb=new Float32Array(geometry.getAttribute('position').count*3);
      for(let at=0;at<rgb.length;at+=3)tint.toArray(rgb,at);
      geometry.setAttribute('color',new Float32BufferAttribute(rgb,3));
      finish.vertexColors=true;
    }
    group.add(new Mesh(geometry,finish));
  };
  streetShrine({B:{add,instance:(_key,...args)=>add(...args)},M,obstacles:[],lights:[]});
  for(const {geometry,material} of group.children){
    if(material.vertexColors&&!geometry.hasAttribute('color')){
      const rgb=new Float32Array(geometry.getAttribute('position').count*3).fill(1);
      geometry.setAttribute('color',new Float32BufferAttribute(rgb,3));
    }
  }
  return group;
}

const triangles=group=>group.children.reduce((sum,mesh)=>
  sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0);

function fitToEntrance(group){
  const {min,max}=new Box3().setFromObject(group);
  const protectedX=.43, protectedZ=1.46, lintelStart=2.00, roofSeat=2.183;
  const sx=Math.min(1,(envelope.x-protectedX)/(Math.max(max.x,-min.x)-protectedX));
  const sz=Math.min(1,(envelope.z-protectedZ)/(Math.max(max.z,-min.z)-protectedZ));
  const sy=max.y>roofSeat?(roofSeat-lintelStart)/(max.y-lintelStart):1;
  assert.ok(sx>.52&&sz>.5&&sy>.5&&min.y>=-.001,
    'The HD porch cannot fit this entrance: '+JSON.stringify([min.toArray(),max.toArray()]));
  const uvNormal=new Vector3();
  for(const mesh of group.children){
    const position=mesh.geometry.getAttribute('position'), normal=mesh.geometry.getAttribute('normal');
    const uv=new Float32Array(position.count*2);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i), y=position.getY(i), z=position.getZ(i);
      const dx=Math.abs(x)>protectedX?sx:1, dz=Math.abs(z)>protectedZ?sz:1, dy=y>lintelStart?sy:1;
      const xx=dx===1?x:Math.sign(x)*(protectedX+(Math.abs(x)-protectedX)*dx);
      const zz=dz===1?z:Math.sign(z)*(protectedZ+(Math.abs(z)-protectedZ)*dz);
      const yy=dy===1?y:lintelStart+(y-lintelStart)*dy;
      position.setXYZ(i,xx,yy,zz);
      uvNormal.set(normal.getX(i)/dx,normal.getY(i)/dy,normal.getZ(i)/dz).normalize();
      normal.setXYZ(i,uvNormal.x,uvNormal.y,uvNormal.z);
      const nx=Math.abs(uvNormal.x),ny=Math.abs(uvNormal.y),nz=Math.abs(uvNormal.z);
      const wallU=nx>ny&&nx>nz?z:x;
      if(mesh.material.userData.linternaMap==='hdMasonry'){
        // The private base-color sample covers [-2,2] m by [0,2.5] m.
        uv[i*2]=(wallU+2)/4;
        uv[i*2+1]=1-y/2.5;
      }else{
        uv[i*2]=(nx>ny&&nx>nz?zz:xx)/.8;
        uv[i*2+1]=(ny>nx&&ny>nz?zz:yy)/.8;
      }
    }
    if(mesh.material.userData.linternaMap)
      mesh.geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  }
}

const [sourceArg,outputArg,masonryArg]=process.argv.slice(2);
if(!sourceArg||!outputArg)
  throw Error('Usage: node art/linterna/precinct/import-hd-portico.mjs AUTHORIZED_HD_SRC OUTPUT_DIR [BAKED_MASONRY_JPEG]');
const directory=await realpath(resolve(sourceArg)), output=resolve(outputArg);
assert.notEqual(directory,output,'Use a separate output directory');
const masonryBytes=masonryArg?await readFile(resolve(masonryArg)):null;
if(masonryBytes)assert.ok(masonryBytes.length>=4&&masonryBytes.length<48000&&masonryBytes.readUInt16BE(0)===0xffd8,
  'Use a bounded JPEG base-color bake');
const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,await readFile(join(directory,name),'utf8')])));
const original=triangles(collect(await hdGenerators(directory,sources,false)));
const candidate=collect(await hdGenerators(directory,sources,true),Boolean(masonryBytes));
fitToEntrance(candidate);
candidate.add(makePorticoBeam(),makePorticoCrown());
const model=batchModel(candidate,{finishUV:true,retainColors:true});
for(const mesh of model.children){
  if(!mesh.geometry.index){
    const source=mesh.geometry;
    mesh.geometry=mergeVertices(source);
    source.dispose();
  }
  // Keep sub-millimetre accuracy without streaming 32-bit positions and
  // normals. The compensating scale is uniform and lives in the glTF node.
  const metreScale=3;
  for(const [name,divisor] of [['position',metreScale],['normal',1],['uv',uvScale]]){
    const attribute=mesh.geometry.getAttribute(name);
    if(!attribute)continue;
    mesh.geometry.setAttribute(name,new Int16BufferAttribute(
      Int16Array.from(attribute.array,value=>Math.round(value/divisor*32767)),attribute.itemSize,true));
  }
  mesh.scale.setScalar(metreScale);
}
const triangleCount=triangles(model);
assert.ok(triangleCount<=budget.triangles&&triangleCount<original*.25&&model.children.length<=budget.draws,
  'The imported shrine exceeds its rendering budget: '+JSON.stringify({
    original,triangles:triangleCount,draws:model.children.length,
    batches:model.children.map(mesh=>[mesh.name,(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3]),
    largest:candidate.children.filter(child=>child.isMesh).map(({material,geometry})=>[material.name,geometry.type,
      (geometry.index?.count??geometry.attributes.position.count)/3]).sort((a,b)=>b[2]-a[2]).slice(0,14),
  }));

globalThis.FileReader??=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(bytes=>{this.result=bytes;this.onloadend?.();});}
};
const exporter=new GLTFExporter().register(writer=>{
  const maps=embedFinishMaps(writer,{hdMasonry:masonryBytes});
  return {async writeMaterialAsync(material,definition){
    await maps.writeMaterialAsync(material,definition);
    const texture=definition.pbrMetallicRoughness.baseColorTexture;
    if(texture){
      texture.extensions={KHR_texture_transform:{scale:[uvScale,uvScale]}};
      writer.extensionsUsed.KHR_texture_transform=true;
    }
  }};
});
const binary=await exporter.parseAsync(model,{binary:true});
assert.ok(binary.byteLength<=budget.bytes,'The imported GLB exceeds its asset byte budget: '+binary.byteLength);
const {scene}=await new GLTFLoader().register(()=>({
  name:'offline inspection',loadTexture:()=>Promise.resolve(new Texture()),
})).parseAsync(binary,'');
const {min,max}=new Box3().setFromObject(scene);
assert.ok(Math.max(max.x,-min.x)<=envelope.x+.001&&max.y<=envelope.y+.001&&
  Math.max(max.z,-min.z)<=envelope.z+.001&&min.y>=-.001);
const report={source:Object.fromEntries(sourceFiles.map(name=>[name,sha(sources[name])])),
  originalTriangles:original,triangles:triangleCount,draws:model.children.length,bytes:binary.byteLength,
  sha256:sha(Buffer.from(binary)),bounds:[min.toArray(),max.toArray()],
  masonrySha256:masonryBytes?sha(masonryBytes):null};
await mkdir(output,{recursive:true});
await writeFile(join(output,'linterna-hd-portico-low.glb'),Buffer.from(binary));
await writeFile(join(output,'linterna-hd-portico-low.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
