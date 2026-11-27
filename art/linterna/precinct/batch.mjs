import {Group, Mesh} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function batchModel(root) {
  const batches=new Map();
  root.updateMatrixWorld(true);
  root.traverse(source=>{
    if (!source.isMesh) return;
    const geometry=source.geometry.clone();
    for (const attr of Object.keys(geometry.attributes)) {
      if (attr!=='position' && attr!=='normal') geometry.deleteAttribute(attr);
    }
    geometry.applyMatrix4(source.matrixWorld);
    if (!batches.has(source.material)) batches.set(source.material,[]);
    batches.get(source.material).push(geometry);
  });
  const group=new Group();
  group.name=root.name;
  for (const [material,geometries] of batches) {
    // Extruded gables arrive without indices. Preserve indices on all other parts.
    for (const indexed of [true,false]) {
      const compatible=geometries.filter(geometry=>Boolean(geometry.index)===indexed);
      if (!compatible.length) continue;
      const merged=mergeGeometries(compatible);
      if (!merged) throw Error('Could not batch '+material.name);
      const mesh=new Mesh(merged,material);
      mesh.name=material.name;
      mesh.castShadow=true;
      mesh.receiveShadow=true;
      group.add(mesh);
    }
    geometries.forEach(geometry=>geometry.dispose());
  }
  return group;
}
