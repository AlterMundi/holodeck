import * as T from 'three';
import { makeScene, floorClearance } from '../precinct/model.mjs';
import { batchModel } from '../precinct/batch.mjs';
import { gardenArc, pavilions } from '../precinct/plan.mjs';
import { foyerPlan, makeFoyer, textPanel } from './foyer.mjs';
import { plan } from './plan.mjs';

export const gardenPlan = {
  basis:'Casa Linterna authored precinct, metres, +Y up',
  slot:'west garden shelter between Athena and Hephaestus',
  origin:[-8.45,0,-20.65],
  yaw:.29,
  pathWidth:1.42,
  gardenJoin:[...gardenArc[4]],
  links:[
    ['garden','nix.foyer.entry'],
    ['nix.foyer.wanda-door','nix.entry'],
    ['nix.return','nix.foyer.wanda-door'],
    ['nix.foyer.return','garden'],
  ],
};

const walkRadius=.56;
const foyerArrival=[0,0,1.70];
const foliage=new Set(['leaf','brightLeaf','olive','bark']);
const color=(value)=>new T.MeshStandardMaterial({color:value,roughness:.87});
const curve=points=>new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));

function wayfinding(at) {
  const post=new T.Group();
  post.position.set(...at);
  const base=new T.Mesh(new T.BoxGeometry(.32,.70,.28),color('#ac9c80'));
  base.position.y=-.49;
  const frame=new T.Mesh(new T.BoxGeometry(.92,.29,.09),color('#634936'));
  const plate=textPanel('← NIX',.85,.215);
  plate.position.z=.047;
  post.add(base,frame,plate);
  return {post,plate};
}

function branchPaving(group,path) {
  const stone=new T.BoxGeometry(1,.033,1);
  const finishes=['#a09075','#a5957c','#b8aa91'].map(color);
  const stepCount=Math.ceil(path.getLength()/.40);
  for(let i=0;i<stepCount;i++){
    const u=(i+.5)/stepCount;
    const p=path.getPointAt(u), dir=path.getTangentAt(u);
    const mesh=new T.Mesh(stone,finishes[(i*5+i%4)%finishes.length]);
    mesh.position.set(p.x,-.002,p.z);
    mesh.scale.set(gardenPlan.pathWidth,1,path.getLength()/stepCount-.018);
    mesh.rotation.y=Math.atan2(dir.x,dir.z);
    mesh.receiveShadow=true;
    group.add(mesh);
  }
}


function footprintGap(first, second) {
  const corners = ({origin,yaw,halfWidth,back,front})=>[
    [-halfWidth,back],[halfWidth,back],[halfWidth,front],[-halfWidth,front],
  ].map(([x,z])=>[origin[0]+x*Math.cos(yaw)+z*Math.sin(yaw),
    origin[1]-x*Math.sin(yaw)+z*Math.cos(yaw)]);
  const limits=[corners(first),corners(second)];
  const axes=[first.yaw,second.yaw].flatMap(angle=>[
    [Math.cos(angle),-Math.sin(angle)],[Math.sin(angle),Math.cos(angle)],
  ]);
  return Math.max(...axes.map(([x,z])=>{
    const [a,b]=limits.map(c=>c.map(([u,v])=>x*u+z*v));
    return Math.max(Math.min(...b)-Math.max(...a), Math.min(...a)-Math.max(...b));
  }));
}

export function makeGarden() {
  const foyer=makeFoyer();
  const base=new T.Group();
  base.position.set(...gardenPlan.origin);
  base.rotation.y=gardenPlan.yaw;
  base.add(foyer.group);
  base.updateMatrixWorld(true);
  const world=xyz=>base.localToWorld(new T.Vector3(...xyz)).toArray();
  const local=xyz=>base.worldToLocal(new T.Vector3(...xyz)).toArray();
  const xz=([x,,z])=>[x,z];
  const threshold=world(foyerPlan.anchors['nix.foyer.entry'].at);
  const arrivals=[world(foyerArrival), world([.60,0,.12]), world([foyerPlan.doorX,0,-1.64])];
  const routePoints=[[0,4.08],[0,.55],[0,-7.30],[0,-12.85],[-.26,-16.18],
    [-2.74,-16.39],[-4.35,-15.76],xz(world([0,0,3.87])),xz(threshold),xz(arrivals[0])];
  const gardenWalk=curve(routePoints);
  const innerWalk=curve(arrivals.map(xz));
  const steps=gardenWalk.getSpacedPoints(Math.ceil(gardenWalk.getLength()/.10));
  const footprint=new T.Box3().setFromObject(foyer.group);
  const plantingMoves=[];
  const {group,obstacles}=makeScene('precinct',{
    omitWestLoggia:true,
    acceptPlant(bounds, plant) {
      const fits=!footprint.intersectsBox(bounds) && !steps.some(({x,z})=>
        x+walkRadius>bounds.min.x && x-walkRadius<bounds.max.x &&
        z+walkRadius>bounds.min.z && z-walkRadius<bounds.max.z && bounds.min.y<1.8);
      if(!fits) plantingMoves.push([plant.x,plant.z]);
      return fits;
    },
  });
  const clear=floorClearance(obstacles);
  const retainedPlants=[];
  group.traverse(obj=>{
    if(obj.isMesh && foliage.has(obj.material.name)){
      const box=new T.Box3().setFromObject(obj);
      if(box.max.y>.17) retainedPlants.push(box);
    }
  });
  const garden=batchModel(group);
  garden.name='Casa Linterna semicircle with proposed Nix temple';
  garden.add(base);
  const {post,plate}=wayfinding([.95,.83,-14.78]);
  garden.add(post);
  branchPaving(garden,curve(routePoints.slice(5,9)));
  garden.updateMatrixWorld(true);

  const lights=foyer.frontLights.map(light=>({...light,at:world(light.at)}));
  lights.push({at:[.96,1.1,-13.62],color:'#f6c789',intensity:4.5,range:2.7});
  const from=(eye,target,options={})=>({eye:world(eye),target:world(target),...options});
  const poses={
    columnata:{eye:[0,1.64,4.08],target:[-3.1,1.76,-17.7],fov:55},
    approach:from([.46,1.64,7.64],[0,2.06,2.49],{fov:58}),
    semicirculo:{eye:[-.2,22,3.65],target:[0,0,-13.4],elevated:true,fov:62},
    vestibulo:from([.01,1.64,1.86],[-.12,1.55,-2.32],{fov:58}),
    'puerta-wanda':from([.58,1.64,-.96],[.69,1.46,-2.49],{fov:62}),
  };

  function usable([x,z],radius=plan.avatar.radius) {
    if(x < -25.5+radius || x > 25.5-radius || z < -33+radius || z > 21-radius) return false;
    if(!clear([x,z],radius))return false;
    if(retainedPlants.some(({min,max})=>min.y<1.8 && x+radius>min.x && x-radius<max.x &&
      z+radius>min.z && z-radius<max.z))return false;
    if(Math.abs(x-post.position.x)<.16+radius && Math.abs(z-post.position.z)<.14+radius)return false;
    const [xLocal,,zLocal]=local([x,0,z]);
    const half=foyerPlan.width/2-.14;
    if(zLocal < foyerPlan.rear-radius || zLocal > foyerPlan.front+radius+.23 || Math.abs(xLocal)>half+radius)
      return true;
    if(zLocal > foyerPlan.front-radius-.1) return Math.abs(xLocal)+radius<foyerPlan.entrances.garden/2;
    if(Math.abs(xLocal)+radius>half || zLocal<foyerPlan.rear+radius+.11)return false;
    const [sx,,sz]=foyerPlan.statue;
    return Math.abs(xLocal-sx)>=.465+radius || Math.abs(zLocal-sz)>=.41+radius;
  }

  function survey() {
    const [minX,maxX]=[-2.46,2.46];
    for(let x=minX;x<=maxX;x+=.10){
      for(let z=-2.62;z<=3.24;z+=.10){
        if(!clear(xz(world([x,0,z])),.13))throw Error('Nix overlaps a retained structure');
      }
    }
    const gaps=Object.fromEntries(pavilions.map(pavilion=>[
      pavilion.id, footprintGap({origin:xz(gardenPlan.origin),yaw:gardenPlan.yaw,halfWidth:2.46,back:-2.61,front:3.34},
        {origin:pavilion.origin,yaw:pavilion.turn,halfWidth:pavilion.width/2+.62,back:-5.02,front:5.02}),
    ]));
    if(Object.values(gaps).some(gap=>gap<.10))throw Error('Roof footprints need visible separation');
    const counts={};
    for(const [name,walk] of Object.entries({gardenWalk,innerWalk})){
      const samples=Math.ceil(walk.getLength()/.05);
      for(let i=0;i<=samples;i++){
        const {x,z}=walk.getPointAt(i/samples);
        if(!usable([x,z],walkRadius))throw Error(`Blocked ${name} at ${x.toFixed(3)}, ${z.toFixed(3)}`);
      }
      counts[name]=samples+1;
    }
    const targets=[];
    for(const height of plan.avatar.eyes){
      const from=new T.Vector3(...world([.12,height,1.80]));
      for(const [name,point] of [
        ['statue',new T.Vector3(...world([-1.14,1.903,-.81]))],
        ['WANDA door',new T.Vector3(...world([.77,1.40,-2.428]))],
      ]){
        const line=new T.Raycaster(from,point.clone().sub(from).normalize(),0,from.distanceTo(point)+.19);
        const hit=line.intersectObject(foyer.group,true)[0]?.object;
        if(name==='statue' ? hit?.parent!==foyer.figure : !foyer.doorHits.includes(hit))
          throw Error(`Occluded ${name} from vestibule at ${height} m: ${hit?.name}`);
        targets.push({name,eyeM:height});
      }
    }
    const entryDistance=threshold.map(v=>+v.toFixed(3));
    return {slot:gardenPlan.slot,counts,walkingWidthM:1.12,lengthM:gardenWalk.getLength(),
      separateDoor:true,gardenThreshold:entryDistance,
      wandaThreshold:world(foyerPlan.anchors['nix.foyer.wanda-door'].at).map(v=>+v.toFixed(3)),
      adjustmentPlantGroups:plantingMoves,roofGapProjectionM:gaps,targets,preservedPavilions:['athena','hephaestus','apollo']};
  }
  return {garden,foyer,world,poses,usable,survey,gardenWalk,innerWalk,threshold,plate,lanterns:lights};
}
