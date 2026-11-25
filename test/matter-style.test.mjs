import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,NearestFilter,NoColorSpace,RepeatWrapping,SRGBColorSpace,Texture} from 'three';
import {bindMatterStyle} from '../src/matter-style.mjs';
import {compileRoomLooks} from '../src/room-looks.mjs';
import {createHash} from 'node:crypto';
import authored from '../art/collection/matter-looks.json' with {type:'json'};

test('room style replaces only local authored maps and can restore the original textures',()=>{
  const diffuse=new Texture({width:1024}),response=new Texture({width:512});
  const shell=new MeshBasicMaterial({name:'Orbital static diffuse',map:diffuse});
  const work=new MeshStandardMaterial({name:'Orbital focused material response',
    emissiveMap:diffuse,roughnessMap:response,metalnessMap:response});
  const untreated=new MeshBasicMaterial();
  const shared=new Mesh(undefined,shell);
  const shellMesh=new Mesh(undefined,shell),workMesh=new Mesh(undefined,[work,untreated]);
  const [orbital,amber]=authored.looks;
  const workOnly={id:'work-only',materials:{
    ...amber.materials,
    'responsive-work-surfaces':{...amber.materials['responsive-work-surfaces'],emissiveMap:'work-diffuse'},
  }};
  const catalog={...authored,looks:[...authored.looks,workOnly]};
  const style=bindMatterStyle(new Group().add(shellMesh,workMesh),catalog);
  const images=new Map([
    ['amber-diffuse',{width:2048}],['amber-response',{width:1024}],['work-diffuse',{width:2048}],
  ]);
  style.apply(amber,images);
  const replacement=shellMesh.material.map;
  assert.equal(replacement.image,images.get('amber-diffuse'));
  assert.equal(workMesh.material[0].emissiveMap,replacement);
  assert.equal(workMesh.material[0].roughnessMap.image,images.get('amber-response'));
  assert.equal(workMesh.material[0].metalnessMap,workMesh.material[0].roughnessMap);
  assert.equal(shared.material.map,diffuse);
  assert.equal(diffuse.image.width,1024);
  assert.equal(workMesh.material[1],untreated);
  style.apply(workOnly,images);
  assert.equal(shellMesh.material.map,replacement);
  assert.equal(workMesh.material[0].emissiveMap.image,images.get('work-diffuse'));
  assert.equal(workMesh.material[0].roughnessMap.image,images.get('amber-response'));
  style.apply(orbital,images);
  assert.equal(shellMesh.material.map,diffuse);
  assert.equal(workMesh.material[0].emissiveMap,diffuse);
  assert.equal(workMesh.material[0].roughnessMap,response);
  style.apply(amber,images);
  assert.equal(shellMesh.material.map,replacement);
  style.dispose();
});


test('room look compiler scopes immutable assets and rejects invalid bindings',()=>{
  const manifest=structuredClone(authored);
  const files=new Map(Object.values(manifest.assets).map(asset=>{
    const bytes=Buffer.from(asset.file);
    asset.sha256=createHash('sha256').update(bytes).digest('hex');
    return [asset.file,bytes];
  }));
  const compiled=compileRoomLooks(manifest,name=>files.get(name));
  const result=compiled.describe(revision=>'/api/space/art/'+revision);
  assert.deepEqual(result.looks,authored.looks);
  assert.equal(result.default,'orbital');
  assert.equal(compiled.files.get(result.assets['amber-diffuse'].split('/').at(-1)).type,'image/jpeg');
  assert.throws(()=>compileRoomLooks(manifest,()=>Buffer.from('changed')),/does not match/);
  const floor=manifest.looks.find(({id})=>id==='orbital-layered').diffuseLayers['fixed-light-shell'].reflection;
  floor.emitters.push(floor.emitters[0]);
  assert.throws(()=>compileRoomLooks(manifest,()=>assert.fail('Invalid look was resolved')),/diffuse reflection/);
  floor.emitters.pop();
  floor.diffuseFill=-.01;
  assert.throws(()=>compileRoomLooks(manifest,()=>assert.fail('Invalid look was resolved')),/diffuse reflection/);
  delete floor.diffuseFill;
  assert.equal(compileRoomLooks(manifest,name=>files.get(name)).describe(revision=>revision)
    .looks.find(({id})=>id==='orbital-layered').diffuseLayers['fixed-light-shell'].reflection.diffuseFill,undefined);
  manifest.looks[1].materials['fixed-light-shell'].map='missing-asset';
  assert.throws(()=>compileRoomLooks(manifest,()=>assert.fail('Missing asset was resolved')),/channel or asset/);
});

test('layered diffuse uses linear light data and restores both material programs',()=>{
  const source=new Texture({width:1024});
  source.colorSpace=SRGBColorSpace;
  const shell=new Mesh(undefined,new MeshBasicMaterial({name:authored.surfaces['fixed-light-shell'],map:source}));
  const work=new Mesh(undefined,new MeshStandardMaterial({
    name:authored.surfaces['responsive-work-surfaces'],emissiveMap:source,
  }));
  const unpacked=[];
  const context={
    drawImage(image,x,y,width,height){
      unpacked.push({image,x,y,width,height});
    },
    getImageData(){return {data:new Uint8Array(248*248*4).fill(unpacked.length)};},
  };
  const document={createElement:()=>({getContext:()=>context})};
  const style=bindMatterStyle(new Group().add(shell,work),authored,{document});
  const albedo={width:1024},irradiance={width:1024},tile={width:512};
  const roles={width:1024},tiles={width:768,height:512};
  const layered=authored.looks.find(({id})=>id==='orbital-layered');
  style.apply(layered,new Map([['orbital-albedo',albedo],['orbital-irradiance',irradiance],['orbital-deck-detail',tile],
    ['orbital-surface-roles',roles],['orbital-surface-tiles',tiles]]));
  for(const [material,channel,chunk] of [
    [shell.material,'map','map_fragment'],[work.material,'emissiveMap','emissivemap_fragment'],
  ]){
    const shader={uniforms:{},fragmentShader:`#include <${chunk}>`,vertexShader:'#include <project_vertex>'};
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader,/vec4\(roomLitDiffuse\(texture2D/);
    const light=shader.uniforms.roomIrradiance.value;
    assert.equal(light.image,irradiance);
    assert.equal(light.colorSpace,NoColorSpace);
    assert.equal(material[channel].image,albedo);
    assert.equal(material[channel].colorSpace,SRGBColorSpace);
    assert.match(shader.fragmentShader,/textureGrad\(roomSurfaceTiles/);
    assert.equal(shader.uniforms.roomSurfaceRoles.value.image,roles);
    assert.equal(shader.uniforms.roomSurfaceRoles.value.minFilter,NearestFilter);
    assert.equal(shader.uniforms.roomSurfaceRoles.value.generateMipmaps,false);
    const array=shader.uniforms.roomSurfaceTiles.value;
    assert.equal(array.isDataArrayTexture,true);
    assert.equal(array.generateMipmaps,true);
    assert.equal(array.wrapS,RepeatWrapping);
    assert.equal(array.anisotropy,source.anisotropy);
    assert.equal(array.image.depth,5);
    assert.deepEqual(Array.from({length:5},(_,i)=>array.image.data[i*248*248]),[1,2,3,4,5]);
    if(channel==='map'){
      assert.match(shader.vertexShader,/modelMatrix \* vec4\(transformed/);
      assert.match(shader.fragmentShader,/reflect\(-view/);
      assert.equal(shader.uniforms.roomReceiverHeight.value,.1);
      assert.deepEqual(shader.uniforms.roomEmitters.value[0].center.toArray(),[0,2.353,-.43]);
      assert.equal(shader.uniforms.roomEmitterCount.value,5);
      assert.deepEqual(shader.uniforms.roomEmitters.value[1].center.toArray(),[3.35,2.225,-3.69]);
      assert.deepEqual(shader.uniforms.roomEmitters.value[4].center.toArray(),[2.13,3.63,1.19]);
      assert.equal(shader.uniforms.roomDeckDetail.value.image,tile);
      assert.equal(shader.uniforms.roomDeckDetail.value.wrapS,RepeatWrapping);
      assert.equal(shader.uniforms.roomDeckTileScale.value,.88);
      assert.equal(shader.uniforms.roomFloorDiffuseFill.value,.03);
      assert.equal(material.customProgramCacheKey(),'room-diffuse-layers:map:reflection:layered-detail-v1');
    }else{
      assert.equal(shader.uniforms.roomEmitters,undefined);
      assert.equal(material.customProgramCacheKey(),'room-diffuse-layers:emissiveMap:layered-detail-v1');
    }
  }
  assert.deepEqual(unpacked.map(({x,y})=>[x,y]),[[4,4],[260,4],[516,4],[4,260],[260,260]]);
  style.apply(authored.looks[0],new Map());
  assert.equal(shell.material.map,source);
  assert.equal(work.material.emissiveMap,source);
  assert.equal(shell.material.customProgramCacheKey(),'');
  assert.equal(work.material.customProgramCacheKey(),'');
  style.dispose();
});
