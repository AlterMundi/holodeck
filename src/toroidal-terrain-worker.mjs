import {buildReflectionBank} from './toroidal-bank-reflection.mjs';
import {buildTerrainTile, selectTerrainTiles} from './toroidal-terrain.mjs';

self.onmessage = ({data}) => {
  if (data.kind === 'reflection-bank') {
    try {
      const bank=buildReflectionBank(data.row,data.rows);
      self.postMessage({bank},[bank.buffer]);
    } catch {
      self.postMessage({bank:null});
    }
    return;
  }
  try {
    if (data.kind === 'select') {
      self.postMessage({tiles: selectTerrainTiles(data.viewer, data.options)});
      return;
    }
    const {tile, segments} = data;
    const mesh = buildTerrainTile(tile, segments, tile.coarseEdges);
    const arrays=[mesh.positions,mesh.normals,mesh.colors,mesh.indices];
    if(mesh.water)arrays.push(mesh.water.positions,mesh.water.normals,mesh.water.depth,mesh.water.indices);
    self.postMessage({mesh}, arrays.map(array=>array.buffer));
  } catch {
    self.postMessage({failed: true});
  }
};
