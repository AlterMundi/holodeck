import {Float32BufferAttribute, Group, Mesh} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function batchModel(root, {retainUV = false, finishUV = false} = {}) {
  const batches=new Map();
  root.updateMatrixWorld(true);
  root.traverse(source=>{
    if (!source.isMesh) return;
    const geometry=source.geometry.clone();
    const textured=finishUV && source.material.userData.linternaMap;
    for (const attr of Object.keys(geometry.attributes)) {
      if (attr!=='position' && attr!=='normal' && !((retainUV||textured) && attr==='uv'))
        geometry.deleteAttribute(attr);
    }
    if (textured && !geometry.hasAttribute('uv')) {
      const positions=geometry.getAttribute('position');
      const uv=new Float32Array(positions.count*2);
      for(let index=0;index<positions.count;index++){
        uv[index*2]=positions.getX(index);
        uv[index*2+1]=positions.getY(index);
      }
      geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
    }
    geometry.applyMatrix4(source.matrixWorld);
    if (!batches.has(source.material)) batches.set(source.material,[]);
    batches.get(source.material).push(geometry);
  });
  const group=new Group();
  group.name=root.name;
  group.userData={...root.userData};
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
