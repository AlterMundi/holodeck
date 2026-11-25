export const sand3dTrailAssets=Object.freeze({
  'feather-reed-grass':{path:'assets/terrain/sand3d/feather-reed-grass.glb',bytes:131560,sha256:'ef2f34b8ad980f6579a996351f398efa79794e90705834521dbef96bc46fc8ea'},
  'sensitive-fern':{path:'assets/terrain/sand3d/sensitive-fern.glb',bytes:72452,sha256:'6134d81df2a5720ef04249076520af5b9b58dd8f29e9407ca4188c659d19f63e'},
  'pumice':{path:'assets/terrain/sand3d/pumice.glb',bytes:102424,sha256:'6853e9d3c267747ff3d3203f55944171bee285182b3524f436048d58514222c1'},
});
export const SAND3D_TRAIL_REVISIONS=Object.freeze(Object.fromEntries(
  Object.values(sand3dTrailAssets).map(({path,sha256})=>[path,sha256])));
