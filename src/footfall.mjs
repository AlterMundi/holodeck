import {Vector3} from 'three';

// Footfalls are contact events read from the animated feet, not from a
// timer: a foot that comes down and stops is a step, whatever the clip,
// speed or avatar. Each step asks what it landed on and answers with the
// effect for that surface (footfall-surface.mjs, on the effects side, so the
// motion has no dependency on terrain shading).

const FEET=[['foot_l','ball_l'],['foot_r','ball_r']];
const footWorld=new Vector3();

// Per actor: plant detection with hysteresis on each foot's height above
// the body origin, relative to the lowest height seen recently.
export class FootfallDetector{
  constructor(mesh){
    this.feet=FEET.map(names=>names.map(name=>mesh.getObjectByName(name)).find(Boolean)).filter(Boolean)
      .map(bone=>({bone,low:Infinity,lifted:false,last:Infinity}));
  }

  get available(){return this.feet.length>0;}

  reset(){for(const foot of this.feet){foot.low=Infinity;foot.lifted=false;foot.last=Infinity;}}

  // Returns the feet that planted this frame, with their world position.
  sample(origin,up,scale=1,step=1/60){
    const planted=[];
    for(const foot of this.feet){
      foot.bone.getWorldPosition(footWorld);
      const height=footWorld.sub(origin).dot(up)/scale;
      // The floor estimate follows the lowest contact, recovering slowly so a
      // slope or a new clip does not leave it stale.
      foot.low=Math.min(height,foot.low+step*.25);
      const above=height-foot.low;
      if(above>.07)foot.lifted=true;
      else if(foot.lifted&&above<.025&&height<=foot.last){
        foot.lifted=false;
        foot.bone.getWorldPosition(footWorld);
        planted.push(footWorld.clone());
      }
      foot.last=height;
    }
    return planted;
  }
}
