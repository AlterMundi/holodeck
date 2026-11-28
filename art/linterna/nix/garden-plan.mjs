import { arrivalStops, pavilionDoor, pavilions, place } from '../precinct/plan.mjs';

const center = [0,-4.5];
const templeRadius = 19;
const pathRadius = 13.25;
const providers = [pavilions[0], {
  id:'nix',width:Math.max(...pavilions.map(pavilion=>pavilion.width)),roof:'sage',externalModel:true,
},pavilions[1],pavilions[2]];
const angularPitch = Math.PI/providers.length;
const pointAt = (angle,radius) => [center[0]+radius*Math.sin(angle), center[1]-radius*Math.cos(angle)];

const temples = providers.map((pavilion,index)=>{
  const angle=(index+.5)*angularPitch-Math.PI/2;
  return {...pavilion,angle,origin:pointAt(angle,templeRadius),turn:-angle,
    pathJoin:pointAt(angle,pathRadius)};
});
const nix = temples.find(pavilion=>pavilion.id==='nix');
const arc = Array.from({length:25},(_,index)=>pointAt((index-12)*angularPitch/8,pathRadius));
const spine = [arrivalStops.garden.point,[0,.55],[0,-7.30],[0,-12.85],arc[12]];
const paths = [
  {points:arc,width:1.86}, {points:[[0,1],...spine.slice(1)],width:2.05},
  ...temples.map(pavilion=>({
    points:[pavilion.pathJoin,place(pavilion,0,pavilionDoor+.12)],
    width:1.85,
  })),
];

export const gardenPlan = {
  basis:'Casa Linterna four-temple study, metres, +Y up',
  center,templeRadius,angularPitch,temples,paths,
  nix,
  route:[...spine,...arc.slice(8,12).reverse(),place(nix,0,pavilionDoor+.86),place(nix,0,pavilionDoor)],
  links:[
    ['garden','nix.foyer.entry'],
    ['nix.foyer.wanda-door','nix.entry'],
    ['nix.return','nix.foyer.wanda-door'],
    ['nix.foyer.return','garden'],
  ],
};
