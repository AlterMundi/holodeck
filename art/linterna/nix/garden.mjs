import * as T from 'three';
import { makeScene, floorClearance } from '../precinct/model.mjs';
import { batchModel } from '../precinct/batch.mjs';
import { pavilionDoor, place } from '../precinct/plan.mjs';
import { foyerPlan, makeFoyer, textPanel } from './foyer.mjs';
import { gardenPlan } from './garden-plan.mjs';
import { plan } from './plan.mjs';
import { domePlan } from './dome.mjs';

const walkRadius=.56;
const foyerArrival=[0,0,2.45];
const foliage=new Set(['leaf','brightLeaf','olive','bark']);
const xz=([x,,z])=>[x,z];
const curve=points=>new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));
const sample=(walk,pitch)=>walk.getSpacedPoints(Math.ceil(walk.getLength()/pitch));

function footprintGap(first,second) {
  const corners=({pavilion,bounds:{min,max}})=>[
    [min.x,min.z],[max.x,min.z],[max.x,max.z],[min.x,max.z],
  ].map(([x,z])=>place(pavilion,x,z));
  const limits=[corners(first),corners(second)];
  const axes=[first.pavilion.turn,second.pavilion.turn].flatMap(angle=>[
    [Math.cos(angle),-Math.sin(angle)],[Math.sin(angle),Math.cos(angle)],
  ]);
  return Math.max(...axes.map(([x,z])=>{
    const [a,b]=limits.map(c=>c.map(([u,v])=>x*u+z*v));
    return Math.max(Math.min(...b)-Math.max(...a),Math.min(...a)-Math.max(...b));
  }));
}

function localBounds(group) {
  const bounds=new T.Box3(), toLocal=group.matrixWorld.clone().invert();
  group.traverse(mesh=>{
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const matrix=new T.Matrix4().multiplyMatrices(toLocal,mesh.matrixWorld);
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));
  });
  return bounds;
}

export function makeGarden() {
  const foyer=makeFoyer();
  const nix=gardenPlan.nix;
  const base=new T.Group();
  base.position.set(nix.origin[0],0,nix.origin[1]);
  base.rotation.y=nix.turn;
  base.add(foyer.group);
  base.updateMatrixWorld(true);
  const world=xyz=>base.localToWorld(new T.Vector3(...xyz)).toArray();
  const local=xyz=>base.worldToLocal(new T.Vector3(...xyz)).toArray();
  const threshold=world(foyerPlan.anchors['nix.foyer.entry'].at);
  const gardenWalk=curve([...gardenPlan.route,xz(world(foyerArrival))]);
  const {doorX,rear,front,width}=foyerPlan;
  const innerWalk=curve([foyerArrival,[.38,0,.34],[doorX,0,rear+.82]].map(p=>xz(world(p))));
  const approaches=Object.fromEntries(gardenPlan.temples.map(pavilion=>[pavilion.id,curve([
    pavilion.pathJoin,place(pavilion,0,pavilionDoor+.72),place(pavilion,0,pavilionDoor),
  ])]));
  const steps=[gardenWalk,...Object.values(approaches),...gardenPlan.paths.map(path=>curve(path.points))]
    .flatMap(walk=>sample(walk,.21));
  const footprint=new T.Box3().setFromObject(base);
  function plantBlocks({min,max},x,z,radius) {
    return min.y<1.8 && x+radius>min.x && x-radius<max.x && z+radius>min.z && z-radius<max.z;
  }
  const {group,obstacles}=makeScene('precinct',{
    layout:{pavilions:gardenPlan.temples,paths:gardenPlan.paths},
    acceptPlant(bounds) {
      return !footprint.intersectsBox(bounds) && !steps.some(({x,z})=>plantBlocks(bounds,x,z,walkRadius));
    },
  });
  const clear=floorClearance([...obstacles,...foyer.obstacles]);
  const retainedPlants=[];
  group.traverse(obj=>{
    if(obj.isMesh && foliage.has(obj.material.name)){
      const box=new T.Box3().setFromObject(obj);
      if(box.max.y>.17) retainedPlants.push(box);
    }
  });
  const buildings=gardenPlan.temples.map(pavilion=>({
    pavilion,bounds:localBounds(pavilion===nix?base:group.getObjectByName(pavilion.id)),
  }));
  const garden=batchModel(group);
  garden.name='Casa Linterna four-temple semicircle';
  garden.add(base);
  const names={athena:'ATENEA',hephaestus:'HEFESTO',apollo:'APOLO'};
  const lights=foyer.frontLights.map(light=>({...light,at:world(light.at)}));
  lights.push({at:world([3.8,8.8,8.1]),color:'#c2d4f4',intensity:38,range:17});
  for (const pavilion of gardenPlan.temples) {
    if (pavilion===nix) continue;
    const label=textPanel(names[pavilion.id],1.50,.229);
    const [x,z]=place(pavilion,0,4.948);
    label.position.set(x,3.21,z);
    label.rotation.y=pavilion.turn;
    garden.add(label);
    for (const side of [-1,1]) {
      const [x,z]=place(pavilion,side*.98,pavilionDoor+.50);
      lights.push({at:[x,1.85,z],color:'#ffce8d',intensity:4.75,range:4.0});
    }
  }
  garden.updateMatrixWorld(true);

  const from=(eye,target,options={})=>({eye:world(eye),target:world(target),...options});
  const poses={
    columnata:{eye:[0,1.64,4.08],target:[0,1.76,-17.3],fov:67},
    approach:from([.36,1.64,11.28],[0,4.17,3.0],{fov:59}),
    'cupula-lateral':from([7.1,1.64,10.78],[0,3.95,.8],{fov:53}),
    semicirculo:{eye:[0,28.5,4.8],target:[0,.28,-15.1],elevated:true,fov:61},
    vestibulo:from([.05,1.64,2.37],[-.43,1.56,-3.08],{fov:59}),
    'puerta-wanda':from([doorX,1.64,rear+1.58],[doorX,1.48,rear+.055],{fov:62}),
  };

  function usable([x,z],radius=plan.avatar.radius) {
    if(x < -25.5+radius || x > 25.5-radius || z < -33+radius || z > 21-radius) return false;
    if(!clear([x,z],radius))return false;
    if(retainedPlants.some(bounds=>plantBlocks(bounds,x,z,radius)))return false;
    const [xLocal,,zLocal]=local([x,0,z]);
    const half=width/2-.11;
    if(zLocal < rear-radius-.10 || zLocal > front+radius+.10 || Math.abs(xLocal)>half+radius)
      return true;
    if(zLocal > front-radius-.10) return Math.abs(xLocal)+radius<foyerPlan.entrances.garden/2;
    if(Math.abs(xLocal)+radius>half || zLocal<rear+radius+.11)return false;
    const [sx,,sz]=foyerPlan.statue;
    return Math.abs(xLocal-sx)>=.465+radius || Math.abs(zLocal-sz)>=.41+radius;
  }

  function survey() {
    const temples=buildings.map(({pavilion,bounds})=>{
      const threshold=place(pavilion,0,pavilionDoor);
      const [x,z]=threshold.map((v,i)=>v-gardenPlan.center[i]);
      const {min,max}=bounds, size=max.clone().sub(min);
      return {id:pavilion.id,origin:pavilion.origin,threshold,angleDeg:Math.atan2(x,-z)*180/Math.PI,
        radiusM:Math.hypot(x,z),facadeWidthM:pavilion.width,
        boundsM:size.toArray(),turn:pavilion.turn};
    });
    const spacings=temples.slice(1).map(({threshold,angleDeg},i)=>({
      from:temples[i].id,to:temples[i+1].id,degrees:angleDeg-temples[i].angleDeg,
      chordM:Math.hypot(...threshold.map((value,j)=>value-temples[i].threshold[j])),
    }));
    const pitch=gardenPlan.angularPitch*180/Math.PI;
    const first=temples[0], last=temples.at(-1);
    if(Math.abs(first.angleDeg+90-pitch/2)>1e-8 || Math.abs(90-last.angleDeg-pitch/2)>1e-8 ||
      spacings.some(({degrees,chordM})=>Math.abs(degrees-pitch)>1e-8 || Math.abs(chordM-spacings[0].chordM)>1e-8) ||
      temples.some(({radiusM})=>Math.abs(radiusM-first.radiusM)>1e-8))
      throw Error('The four thresholds must divide the semicircle into equal sectors');
    const nix=temples.find(temple=>temple.id==='nix');
    if(temples.some(temple=>temple.facadeWidthM>nix.facadeWidthM ||
      temple.boundsM.some((dimension,index)=>dimension>nix.boundsM[index]+.001)))
      throw Error('Nix must match the largest temple envelope');
    const gaps={};
    for(let i=0;i<buildings.length;i++) for(let j=i+1;j<buildings.length;j++){
      const a=buildings[i],b=buildings[j];
      const gap=footprintGap(a,b);
      if(gap<.10)throw Error(`Pavilion envelopes overlap ${a.pavilion.id} and ${b.pavilion.id}`);
      gaps[`${a.pavilion.id}/${b.pavilion.id}`]=gap;
    }
    const counts={};
    for(const [name,walk] of Object.entries({gardenWalk,innerWalk,...approaches})){
      const points=sample(walk,.05);
      for(const {x,z} of points)
        if(!usable([x,z],walkRadius))throw Error(`Blocked ${name} at ${x.toFixed(3)}, ${z.toFixed(3)}`);
      counts[name]=points.length;
    }
    const targets=[];
    for(const height of plan.avatar.eyes){
      const [sx,,sz]=foyerPlan.statue;
      const from=new T.Vector3(...world([.12,height,foyerArrival[2]]));
      for(const [name,point] of [
        ['statue',new T.Vector3(...world([sx,1.903,sz+.07]))],
        ['WANDA door',new T.Vector3(...world([doorX+.08,1.40,rear+.062]))],
      ]){
        const line=new T.Raycaster(from,point.clone().sub(from).normalize(),0,from.distanceTo(point)+.19);
        const hit=line.intersectObject(foyer.group,true)[0]?.object;
        if(name==='statue' ? hit?.parent!==foyer.figure : !foyer.doorHits.includes(hit))
          throw Error(`Occluded ${name} from vestibule at ${height} m: ${hit?.name}`);
        targets.push({name,eyeM:height});
      }
    }
    const domeSightlines=[];
    for(const [view,{eye}] of Object.entries({columnata:poses.columnata,approach:poses.approach,
      'cupula-lateral':poses['cupula-lateral']})){
      for(const height of plan.avatar.eyes){
        const observer=new T.Vector3(eye[0],height,eye[2]);
        let visible=0;
        for(const x of [-1.37,-.90,.90,1.37]){
          const [cx,,cz]=domePlan.gardenCenter;
          const target=new T.Vector3(...world([cx+x,domePlan.crown-.78,cz+.93]));
          const ray=new T.Raycaster(observer,target.clone().sub(observer).normalize(),0,observer.distanceTo(target)+1.6);
          const hit=ray.intersectObject(garden,true)[0]?.object;
          if(hit?.parent===foyer.dome) visible++;
        }
        if(visible<2)throw Error(`Dome obscured from ${view} at ${height} m (${visible} visible)`);
        domeSightlines.push({view,height,visible,samples:4});
      }
    }
    return {center:gardenPlan.center,temples,spacings,counts,walkingWidthM:2*walkRadius,
      lengthM:gardenWalk.getLength(),separateDoor:true,gardenThreshold:threshold,
      wandaThreshold:world(foyerPlan.anchors['nix.foyer.wanda-door'].at),
      roofGapProjectionM:gaps,targets,domeSightlines};
  }
  return {garden,foyer,poses,usable,survey,gardenWalk,innerWalk,lanterns:lights};
}
