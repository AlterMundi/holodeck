import {MeshDepthMaterial,RGBADepthPacking} from 'three';

function maskFlame(material,active){
  const compile=material.onBeforeCompile;
  const cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.explorerThrust=active;
    shader.vertexShader=`
      varying float explorerFlame;
      ${shader.vertexShader}
    `.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec2 flameCell=abs(uv-vec2(.4375,.4375));
      explorerFlame=(max(flameCell.x,flameCell.y)<.0001 && position.y<1.095 &&
        position.y>.91 && position.z<-.149 && position.z>-.23) ? 1.0 : 0.0;`);
    shader.fragmentShader=`uniform float explorerThrust; varying float explorerFlame;\n${shader.fragmentShader}`
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(explorerFlame>.5 && explorerThrust<.5) discard;`);
  };
  material.customProgramCacheKey=()=>cacheKey+':explorer-thrust';
  material.needsUpdate=true;
  return material;
}

export function bindExplorerThrusters(root){
  let palette;
  root.traverse(node=>{
    if(node.isSkinnedMesh&&node.material?.name==='Explorer palette'&&node.geometry.attributes?.uv&&
      node.geometry.boundingBox?.min.y<.12)palette??=node;
  });
  // The face also uses the palette. Only the body contains the flame cell.
  if(!palette)root.traverse(node=>{
    if(node.isSkinnedMesh&&node.material?.name==='Explorer palette'&&/Explorer.?body/i.test(node.name))palette??=node;
  });
  if(!palette)return null;
  const active={value:0};
  const main=palette.material,depth=palette.customDepthMaterial;
  palette.material=maskFlame(main.clone(),active);
  palette.customDepthMaterial=maskFlame(new MeshDepthMaterial({depthPacking:RGBADepthPacking,side:main.side}),active);
  return {set(value){active.value=value?1:0;},dispose(){
    palette.material.dispose();palette.customDepthMaterial.dispose();
    palette.material=main;palette.customDepthMaterial=depth;
  }};
}
