// Drive the companion's actual controller through measured routes.
import {Vector3} from 'three';
import {loadCompanion,presentation} from './rig.mjs';
import {ToroidalLocomotion} from '../../src/toroidal-locomotion.mjs';
import {TOROIDAL_SPAWN,terrainCoordinates,terrainElevation} from '../../src/toroidal-terrain.mjs';

const soleLocal=.126,toe=.115;

export async function groundRoute({playerSpeed=5,outdoor=false,seconds=8,fps=60,turn=0,reduced=false,model,hostSteps=[1]}={}){
  const {avatar}=await loadCompanion({document:presentation({reduced}),...(model?{model}:{})});
  const {figure}=avatar,root=figure.root;
  const feet=figure.gait.limbs;
  const start=terrainCoordinates([TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z]);
  const motion=new ToroidalLocomotion({u:start.u,v:start.v});
  const player=new Vector3();
  let heading=1.2,previous=null,teleports=0,lag=0,travelled=0,spread=0,worstDrift=0,contacts=0,lowest=Infinity,topSpeed=0,bothAir=0,frames=0,cost=0;
  const anchors=new Map();
  const heights=[];
  for(let index=0,hostFrame=0;hostFrame<seconds*fps;index++){
    // Several MML simulation steps can precede a single rendered frame.
    const steps=hostSteps[index%hostSteps.length];
    const time=hostFrame/fps,dt=steps/fps,going=time>1&&time<seconds-2;
    hostFrame+=steps;
    if(going)heading+=turn*dt;
    if(outdoor){
      for(let step=0;step<steps;step++)motion.update(1/fps,{forward:going?1:0,yaw:heading,sprint:playerSpeed>5});
      player.set(...Object.values(motion.pose().position));
    }else if(going)player.addScaledVector(new Vector3(Math.sin(heading),0,Math.cos(heading)),playerSpeed*dt);
    const began=performance.now();
    avatar.update({position:player.clone(),yaw:0,outdoor,table:null,visible:true,seconds:dt,grounded:true});
    cost+=performance.now()-began;frames++;
    root.updateWorldMatrix(true,true);
    if(previous){
      const moved=previous.distanceTo(root.position);
      if(moved>Math.max(.8,14*dt))teleports++;else{travelled+=moved;topSpeed=Math.max(topSpeed,moved/dt);}
    }
    previous=root.position.clone();
    if(time>1)lag=Math.max(lag,root.position.distanceTo(player));
    const inverse=root.quaternion.clone().invert(),points=[];
    let air=true;
    for(const limb of feet){
      // Measure the skeleton that will be drawn, at the toe contact.
      const point=limb.foot.localToWorld(new Vector3(0,-toe,-soleLocal));
      points.push(point.clone());
      if(limb.planted&&!reduced){
        air=false;
        const anchor=anchors.get(limb);
        if(anchor)worstDrift=Math.max(worstDrift,anchor.distanceTo(point));
        else{anchors.set(limb,point);contacts++;}
      }else anchors.delete(limb);
      let height;
      if(outdoor){const c=terrainCoordinates(point.toArray());height=c.height-terrainElevation(c.u,c.v);}
      else height=point.y+.037;
      lowest=Math.min(lowest,height);
      if(limb.planted)heights.push(height);
    }
    if(air)bothAir++;
    if(going&&time>2)spread=Math.max(spread,Math.abs(points[0].sub(points[1]).applyQuaternion(inverse).z));
  }
  heights.sort((a,b)=>a-b);
  return {playerSpeed,outdoor,fps,teleports,lag,travelled,topSpeed,spread,worstDrift,contacts,lowest,
    sole:heights[heights.length>>1],airborneShare:bothAir/frames,cost:cost/frames,settled:feet.every(limb=>limb.planted)};
}

if(import.meta.url===`file://${process.argv[1]}`){
  for(const options of [{playerSpeed:.6},{playerSpeed:1.65},{playerSpeed:5},{playerSpeed:5,turn:1.2},{playerSpeed:5,outdoor:true,seconds:10},
    {playerSpeed:8,outdoor:true,seconds:10},{playerSpeed:5,outdoor:true,seconds:10,turn:1},{playerSpeed:5,outdoor:true,seconds:10,fps:20},{playerSpeed:8,outdoor:true,seconds:10,fps:20}]){
    const result=await groundRoute(options);
    console.log(JSON.stringify(Object.fromEntries(Object.entries({...result,turn:options.turn}).map(([k,v])=>[k,typeof v==='number'?+v.toFixed(4):v]))));
  }
}
