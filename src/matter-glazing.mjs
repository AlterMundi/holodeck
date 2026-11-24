// Lightweight display treatment for the two authored optical materials.
// The MML model cache shares source materials between scene instances.
const opticalMaterials=new Set(['Clear archive glazing','Clear laminate, service windows']);

export function useLightweightMatterGlazing(group){
  const alternatives=new Map();
  const replace=material=>{
    if(!opticalMaterials.has(material?.name)||!(material.transmission>0))return material;
    if(!alternatives.has(material)){
      const glaze=material.clone();
      glaze.transmission=0;
      glaze.transparent=true;
      glaze.opacity=.24;
      glaze.depthWrite=false;
      glaze.forceSinglePass=true;
      alternatives.set(material,glaze);
    }
    return alternatives.get(material);
  };
  group.traverse(object=>{
    if(!object.isMesh)return;
    object.material=Array.isArray(object.material)?object.material.map(replace):replace(object.material);
  });
  return ()=>{for(const material of alternatives.values())material.dispose();};
}
