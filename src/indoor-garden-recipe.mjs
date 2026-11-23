import {validSignalGarden} from './playable-creations.mjs';
import {workshopColour} from './workshop.mjs';

// The aisle stays clear of furniture, the exhibit and all passage approaches.
export const indoorGardenContains=(x,z,radius)=>
  Math.abs(x)+radius<=1.25&&z-radius>=-1.4&&z+radius<=3.25;

const COLORS=new Set(['mint','amber','rose','violet'].map(workshopColour));
export function validIndoorGardenRecipe(play){
  return validSignalGarden(play,indoorGardenContains)&&!Object.hasOwn(play,'requiredBridgeRaised')&&
    play.minContributors<=play.targets.length&&play.targets.every((a,index)=>
      COLORS.has(workshopColour(a.color))&&play.targets.slice(0,index).every(b=>
        Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius+.08));
}
