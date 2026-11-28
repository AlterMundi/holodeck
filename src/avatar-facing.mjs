// Which way the explorer's body faces. While it moves it faces the view, so
// a sideways input sidesteps and a backward input backs away instead of
// turning around; the animation then resolves the gait from the actual
// displacement. Standing still, it keeps its last heading so orbiting the
// camera around a resting body does not spin it.
export function presentedYaw({moving=false,flying=false,aiming=false,cameraYaw,travelYaw,restingYaw}={}){
  if(flying||aiming||moving)return Number.isFinite(cameraYaw)?cameraYaw:travelYaw;
  return Number.isFinite(restingYaw)?restingYaw:travelYaw;
}
