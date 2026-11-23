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

// Templates are starting layouts for the existing recipe, not new game state.
// All coordinates use the ordinary room-local clear aisle.
const target=(x,z,color)=>({x,z,color,radius:.45});
const templates=[
  {id:'light-pair',title:'Par de luces',play:{schema:'signal-garden/v1',minContributors:1,
    targets:[target(0,.25,'mint'),target(0,1.5,'amber')]}},
  {id:'shared-constellation',title:'Constelación en equipo',play:{schema:'signal-garden/v1',minContributors:2,
    targets:[target(-.65,-.55,'mint'),target(.65,.5,'amber'),
      target(-.65,1.55,'rose'),target(.65,2.6,'violet')]}},
];

export function indoorGardenTemplates(){
  return structuredClone(templates);
}
