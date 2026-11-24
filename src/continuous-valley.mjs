// The outside is replaced independently of the retained house and room graph.
export const VALLEY_LAYOUT='continuous-valley@1';
export const VALLEY_GROUND=Object.freeze({
  asset:'continuous-valley.glb',
  revision:'6b31f7eb643b1541f87cd306dbb392e8f74dc6be28d94d181ec7e0d22313056e',
});
export const VALLEY_DRESSING=Object.freeze({
  asset:'valley-water-and-pines.glb',
  revision:'6e73176f9447d0d6da1934c833a4ce290c5a6f5ec703251345380dd00d1d4c3e',
});
export const VALLEY_ASSET_REVISIONS=Object.freeze(Object.fromEntries(
  [VALLEY_GROUND,VALLEY_DRESSING].map(({asset,revision})=>['assets/'+asset,revision])));
