// Exact Blender exports of art/residencia-nobleza (see toroidal-residence.mjs).
export const residenceAssets=Object.freeze({
  visual:{path:'assets/residencia/residencia.glb',bytes:2561308,
    sha256:'5486116c3b95d5756846d2d8085be000778468f886ee7f7b422a68a55a37f660'},
  collision:{path:'assets/residencia/residencia-colision.glb',bytes:393192,
    sha256:'89110ccfea393f49dd0dd71f376cdfebf88101265cbb5f5a2b860bb35714f3f1'},
});
export const RESIDENCE_REVISIONS=Object.freeze(Object.fromEntries(
  Object.values(residenceAssets).map(({path,sha256})=>[path,sha256])));
