// Exact Blender exports of art/residencia-nobleza (see toroidal-residence.mjs).
export const residenceAssets=Object.freeze({
  visual:{path:'assets/residencia/residencia.glb',bytes:4669884,
    sha256:'d534ebe33fc74da187dc5bfb2c7e9835e8b5f1a5e784a67b1f96b2c43e3e2b07'},
  collision:{path:'assets/residencia/residencia-colision.glb',bytes:415640,
    sha256:'0606e21108c94d08403887807c7b5e166a5659fcaf32d35118f6e098eee3d6c8'},
});
export const RESIDENCE_REVISIONS=Object.freeze(Object.fromEntries(
  Object.values(residenceAssets).map(({path,sha256})=>[path,sha256])));
