export function bindHumanoidMicrophoneMouth(mesh){
  const targets=[];
  for(const face of mesh.getObjectsByProperty('isSkinnedMesh',true)){
    const jaw=face.morphTargetDictionary?.jawOpen;
    const weights=face.morphTargetInfluences;
    if(Number.isInteger(jaw)&&jaw>=0&&weights&&jaw<weights.length)targets.push({weights,jaw,stock:undefined});
  }
  if(!targets.length)return null;

  let aperture=0;
  function restore(){
    for(const target of targets){
      if(target.stock===undefined)continue;
      target.weights[target.jaw]=target.stock;
      target.stock=undefined;
    }
  }
  return {
    restore,
    reset(){restore();aperture=0;},
    apply(level,step){
      const target=.78*level;
      aperture+=(target-aperture)*(1-Math.exp(-step/(target>aperture?.045:.085)));
      if(aperture<.001){aperture=0;return;}
      for(const face of targets){
        face.stock=face.weights[face.jaw];
        face.weights[face.jaw]=Math.max(face.stock,aperture);
      }
    },
  };
}
