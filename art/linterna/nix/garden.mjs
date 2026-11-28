import * as T from 'three';
import { makeScene, floorClearance } from '../precinct/model.mjs';
import { batchModel } from '../precinct/batch.mjs';
import { plan, walkable } from './plan.mjs';

export const gardenPlan = {
  basis: 'Casa Linterna authored precinct, metres, +Y up',
  origin: [-17.50, 0, 10.60],
  yaw: Math.PI / 2,
  pathWidth: 1.42,
  walk: [[0,4.08],[0,.50],[-2.8,.18],[-5.75,.68],[-8.7,1.05],[-9.30,3.85],
    [-9.50,7.70],[-9.55,10.60],[-10.58,10.60],[-11.62,10.60],[-12.40,10.60]],
  sign: [-2.97,1.02,-.93],
};
const foliage = new Set(['leaf','brightLeaf','olive','bark']);

function curve(points) {
  return new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));
}

function wayfinding(at) {
  const post = new T.Group();
  post.position.set(...at);
  const standard = (color) => new T.MeshStandardMaterial({color,roughness:.87});
  const base = new T.Mesh(new T.BoxGeometry(.37,.85,.29),standard('#aa9d85'));
  base.position.y=-.59;
  post.add(base);
  const panel = new T.Mesh(new T.BoxGeometry(1.13,.31,.12),standard('#4b372a'));
  post.add(panel);
  const c = document.createElement('canvas');
  c.width=512; c.height=152;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#223035'; ctx.fillRect(0,0,512,152);
  ctx.textBaseline='middle'; ctx.textAlign='center'; ctx.fillStyle='#fff2d7';
  ctx.font='bold 67px Georgia'; ctx.fillText('←  NIX',256,76);
  const map=new T.CanvasTexture(c);
  map.colorSpace=T.SRGBColorSpace;
  const plate=new T.Mesh(new T.PlaneGeometry(1.05,.23),new T.MeshBasicMaterial({map,toneMapped:false}));
  plate.position.z=.062;
  post.add(plate);
  return {post,plate};
}

export function makeGarden(rig) {
  const {group,obstacles}=makeScene('precinct');
  const clear=floorClearance(obstacles);
  const flora=[];
  group.traverse(o=>{
    if (!o.isMesh || !foliage.has(o.material.name)) return;
    const bounds=new T.Box3().setFromObject(o);
    if(bounds.max.y>.16) flora.push(bounds);
  });
  const garden=batchModel(group);
  garden.name='Casa Linterna reference garden with Nix study';
  const base = new T.Group();
  base.position.set(...gardenPlan.origin);
  base.rotation.y=gardenPlan.yaw;
  base.add(rig.model);
  garden.add(base);
  garden.updateMatrixWorld(true);

  const world = (xyz) => base.localToWorld(new T.Vector3(...xyz)).toArray();
  const room = (xyz) => base.worldToLocal(new T.Vector3(...xyz)).toArray();
  const threshold = world(plan.anchors['nix.entry'].at);
  const {post,plate}=wayfinding(gardenPlan.sign);
  garden.add(post);
  const walkCurve=curve(gardenPlan.walk);
  const paved=curve(gardenPlan.walk.slice(1,9));
  const stone=new T.BoxGeometry(1,.035,1);
  const colors=['#9d8d74','#a29179','#a89c86'].map(color=>new T.MeshStandardMaterial({color,roughness:.98}));
  const stepCount=Math.ceil(paved.getLength()/.47);
  for(let i=0;i<stepCount;i++){
    const u=(i+.5)/stepCount;
    const p=paved.getPointAt(u), dir=paved.getTangentAt(u);
    const mesh=new T.Mesh(stone,colors[(i*5+i%4)%colors.length]);
    mesh.position.set(p.x,-.001,p.z);
    mesh.scale.set(gardenPlan.pathWidth,1,paved.getLength()/stepCount-.016);
    mesh.rotation.y=Math.atan2(dir.x,dir.z);
    mesh.receiveShadow=true;
    garden.add(mesh);
  }

  const marker = new T.Vector3(-2.97,1.08,.05);
  const leftLight = {at:marker.toArray(), intensity:11, color:'#ffcb8a', range:3.2};
  const turnLight = {at:[-8.7,1.6,7.0], intensity:20, color:'#dcaa74', range:6.5};
  const localDoor = world([0,1.42,5.97]);
  const poses = {
    columnata: {eye:[0,1.64,4.08],target:[-2.3,1.31,-2.8]},
    desvio: {eye:[-8.62,1.64,1.34],target:[-9.41,1.48,8.32]},
    jardin: {eye:[-9.43,1.64,7.55],target:localDoor},
    approach: {eye:[-7.93,1.64,10.27],target:world([0,2.0,5.97]),fov:62},
  };
  const usable=([x,z],radius=plan.avatar.radius)=>{
    if(x < -25.5+radius || x > 25.5-radius || z < -33+radius || z > 21-radius) return false;
    if(!clear([x,z],radius)) return false;
    if(flora.some(({min,max})=>min.y<1.8 && x+radius>min.x && x-radius<max.x &&
      z+radius>min.z && z-radius<max.z)) return false;
    if(Math.abs(x-post.position.x)<.185+radius && Math.abs(z-post.position.z)<.145+radius) return false;
    const [localX,,localZ]=room([x,0,z]);
    const nearShell=Math.abs(localX)<6+radius && localZ> -6-radius && localZ<6.92;
    return !nearShell || walkable(localX,localZ,radius);
  };

  function survey() {
    garden.updateMatrixWorld(true);
    const building = new T.Box3().setFromObject(rig.model);
    const structuralBounds = obstacles.map(obstacle=>{
      return obstacle.isMesh ? new T.Box3().setFromObject(obstacle) :
        new T.Box3(new T.Vector3(-.5,-.5,-.5),new T.Vector3(.5,.5,.5)).applyMatrix4(obstacle.matrixWorld);
    });
    if ([...flora,...structuralBounds].some(box=>building.intersectsBox(box)))
      throw Error('Nix footprint overlaps retained precinct art');
    const samples=Math.ceil(walkCurve.getLength()/.05);
    for(let i=0;i<=samples;i++){
      const {x,z}=walkCurve.getPointAt(i/samples);
      if(!usable([x,z],.56)) throw Error(`Garden route blocked at ${i}: ${x.toFixed(2)}, ${z.toFixed(2)}`);
    }
    const sightlines=[];
    for (const height of plan.avatar.eyes) {
      const signOrigin=new T.Vector3(0,height,4.08);
      const point=plate.getWorldPosition(new T.Vector3());
      const rayToSign=new T.Raycaster(signOrigin,point.clone().sub(signOrigin).normalize(),0,signOrigin.distanceTo(point)+.01);
      if (rayToSign.intersectObject(garden,true)[0]?.object!==plate) throw Error('Columnata wayfinding is occluded');
      const reveal = new T.Vector3(-9.43,height,7.55);
      const opening = new T.Vector3(...world([0,height,5.78]));
      const rayToDoor=new T.Raycaster(reveal,opening.clone().sub(reveal).normalize(),0,reveal.distanceTo(opening));
      if(rayToDoor.intersectObject(garden,true).length) throw Error('Garden entry is occluded');
      sightlines.push({eyeM:height, signs:['Nix wayfinding from the columns','Nix clear opening from the west path']});
    }
    return {samples:samples+1,walkingWidthM:1.12,lengthM:walkCurve.getLength(),threshold,sightlines,
      baseArt:'art/linterna/precinct/model.mjs', preservedPavilions:['athena','hephaestus','apollo']};
  }
  return {garden,world,room,poses,usable,survey,walkCurve,threshold,lanterns:[leftLight,turnLight]};
}
