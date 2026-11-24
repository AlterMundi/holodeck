import {buildTerrainTile, selectTerrainTiles} from './toroidal-terrain.mjs';

self.onmessage = ({data}) => {
  try {
    if (data.kind === 'select') {
      self.postMessage({tiles: selectTerrainTiles(data.viewer, data.options)});
      return;
    }
    const {tile, segments} = data;
    const mesh = buildTerrainTile(tile, segments, tile.coarseEdges);
    self.postMessage({mesh}, [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer]);
  } catch {
    self.postMessage({failed: true});
  }
};
