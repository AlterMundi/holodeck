// Exact Blender exports of art/residencia-nobleza (see toroidal-residence.mjs).
export const residenceAssets=Object.freeze({
  visual:{path:'assets/residencia/residencia.glb',bytes:1790772,
    sha256:'8bf3558cada58c86f85e002d69d40c53ae3a5c7d77fdebb86c4d6a6b1099e4b8'},
  collision:{path:'assets/residencia/residencia-colision.glb',bytes:393192,
    sha256:'89110ccfea393f49dd0dd71f376cdfebf88101265cbb5f5a2b860bb35714f3f1'},
});
export const RESIDENCE_REVISIONS=Object.freeze(Object.fromEntries(
  Object.values(residenceAssets).map(({path,sha256})=>[path,sha256])));
