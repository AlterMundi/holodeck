// Exact Blender exports of art/residencia-nobleza (see toroidal-residence.mjs).
export const residenceAssets=Object.freeze({
  visual:{path:'assets/residencia/residencia.glb',bytes:1790920,
    sha256:'9517a56b7693cf451185d479d417952aae87b748dd6c06a220a19744d6062ddd'},
  collision:{path:'assets/residencia/residencia-colision.glb',bytes:393192,
    sha256:'89110ccfea393f49dd0dd71f376cdfebf88101265cbb5f5a2b860bb35714f3f1'},
});
export const RESIDENCE_REVISIONS=Object.freeze(Object.fromEntries(
  Object.values(residenceAssets).map(({path,sha256})=>[path,sha256])));

