// Build and pack Char Design's teleport station for public/assets/teleport.
//   node tools/pack-teleport-station.mjs [blender]
// Runs the Blender source build into a temporary directory, applies meshopt
// compression (decoded by the existing MeshoptDecoder) and copies the source
// .blend next to the build script.
import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';

const root=new URL('..',import.meta.url).pathname;
const blender=process.argv[2]||'blender';
const work=mkdtempSync(join(tmpdir(),'teleport-station-'));
try{
  execFileSync(blender,['-b','--factory-startup','-P',join(root,'art/teleport-station/build_station.py'),'--',work],{stdio:'inherit'});
  await MeshoptEncoder.ready;await MeshoptDecoder.ready;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const out=join(root,'public/assets/teleport');
  mkdirSync(out,{recursive:true});
  for(const name of ['teleport-station.glb','teleport-miniatures.glb']){
    const doc=await io.read(join(work,name));
    doc.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.FILTER});
    await io.write(join(out,name),doc);
  }
  copyFileSync(join(work,'teleport-station.blend'),join(root,'art/teleport-station/teleport-station.blend'));
}finally{
  rmSync(work,{recursive:true,force:true});
}
