import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TOROIDAL_OVERLOOK,TOROIDAL_TERRAIN,terrainElevation,terrainPosition,terrainTrail,toroidalSpurPoint} from '../src/toroidal-terrain.mjs';
import {bindToroidalMinimap,paintToroidalRelief,projectToroidalSpur,toroidalMapChart,toroidalMapHeading,toroidalMapPoint,toroidalSpurGuide} from '../src/toroidal-minimap.mjs';

test('the chart and raster stay continuous across both torus joins',()=>{
  const anchor={u:.99999,v:.99999};
  const chart=toroidalMapChart(anchor);
  const equivalent=toroidalMapChart({u:anchor.u-1,v:anchor.v+1});
  assert.deepEqual(equivalent,chart);
  const first=new Uint8ClampedArray(96*96*4),second=new Uint8ClampedArray(first.length);
  paintToroidalRelief(chart,first);
  paintToroidalRelief(equivalent,second);
  assert.deepEqual(first,second);
  assert.ok(new Set(first).size>12,'relief is not a flat patch');
  for(let i=3;i<first.length;i+=4)assert.equal(first[i],255);

  const mark=toroidalMapPoint(chart,{u:.00001,v:.00001});
  const player=toroidalMapPoint(chart,anchor);
  assert.ok(mark.x>player.x&&mark.y<player.y,'east and north stay stable across the joins');
  assert.ok(Math.hypot(mark.x-player.x,mark.y-player.y)<.003);
});

test('the player arrow matches projected travel on the torus tangent',()=>{
  const {majorRadius,tubeRadius}=TOROIDAL_TERRAIN;
  const tau=Math.PI*2;
  for(const point of [{u:.999999,v:.000001},{u:.42,v:.999999},{u:.15,v:.5}]){
    const chart=toroidalMapChart(point);
    const from=toroidalMapPoint(chart,point);
    for(const yaw of [0,Math.PI/2,-2.4,1.72]){
      const distance=.025;
      const ring=majorRadius+tubeRadius*Math.cos(point.v*tau);
      const to=toroidalMapPoint(chart,{u:point.u+distance*Math.sin(yaw)/(tau*ring),
        v:point.v+distance*Math.cos(yaw)/(tau*tubeRadius)});
      assert.ok(Math.abs(Math.atan2(to.x-from.x,from.y-to.y)-toroidalMapHeading(chart,point.v,yaw))<1e-8);
    }
  }
});

test('the overlook spur follows the terrain and distinguishes open water from land',()=>{
  const guide=toroidalSpurGuide();
  const {runs,shores}=guide;
  assert.deepEqual(runs.map(run=>run.water),[false,true,false]);
  assert.equal(runs[0].points.at(-1),shores[0]);
  assert.equal(runs[1].points.at(-1),shores[1]);
  assert.deepEqual(runs.at(-1).points.at(-1),TOROIDAL_OVERLOOK);
  for(const {u,v} of shores)assert.ok(Math.abs(terrainElevation(u,v)-TOROIDAL_TERRAIN.waterLevel)<.001);
  const [from,to]=shores;
  assert.ok((to.v-from.v)*2*Math.PI*TOROIDAL_TERRAIN.tubeRadius>320);
  for(const {water,points} of runs)
    for(const {u,v} of points.slice(1,-1)){
      assert.equal(terrainTrail(u,v),1);
      assert.equal(terrainElevation(u,v)<TOROIDAL_TERRAIN.waterLevel,water);
    }
  const chart=toroidalMapChart(toroidalSpurPoint(.35));
  const wetPath=projectToroidalSpur(chart,guide);
  assert.ok(wetPath.length&&wetPath.every(path=>path.water));
  assert.ok(wetPath[0].phase>0);
  const opposite=toroidalMapChart({u:.51,v:.35});
  assert.deepEqual(projectToroidalSpur(opposite,guide),[]);
  const nearJoin=toroidalMapChart({u:.9997,v:.25});
  const joined=projectToroidalSpur(nearJoin,guide);
  assert.ok(joined.length>0);
  const precision=paths=>paths.map(({water,phase,points})=>
    [water,phase.toFixed(9),points.map(({x,y})=>[x.toFixed(9),y.toFixed(9)])]);
  assert.deepEqual(precision(joined),precision(projectToroidalSpur({...nearJoin,u:nearJoin.u-1},guide)));
});

test('the map reuses the terrain raster while still updating its position and heading',()=>{
  let paints=0,composites=0,time=0,restore;
  const raster={createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>paints++};
  const view={
    drawImage:()=>composites++,save(){},scale(){},restore(){},translate(){},rotate(){},
    beginPath(){},moveTo(){},lineTo(){},arc(){},closePath(){},stroke(){},fill(){},fillRect(){},fillText(){},strokeText(){},
    measureText:()=>({width:58}),setLineDash(){},
  };
  const canvas={width:384,height:384,getContext:()=>view,setAttribute(){},addEventListener:(_,callback)=>{restore=callback;},
    ownerDocument:{createElement:()=>({getContext:()=>raster,addEventListener(){}})}};
  const panel={open:true,dataset:{},querySelector:()=>canvas};
  const paint=bindToroidalMinimap(panel,{now:()=>time});
  const position=(u,v)=>{
    const [x,y,z]=terrainPosition(u,v,terrainElevation(u,v));
    return {x,y,z};
  };
  const starting=position(0,.25);
  const entrances=[];
  assert.equal(paint(starting,0,entrances),true);
  time+=100;
  assert.equal(paint(starting,0,entrances),undefined);
  time+=100;
  assert.equal(paint(starting,.2,entrances),true);
  time+=100;
  assert.equal(paint(position(.00007,.25),.2,entrances),true);
  assert.deepEqual([paints,composites],[1,3]);
  time+=100;
  assert.equal(paint(position(.001,.25),.2,entrances),true);
  assert.deepEqual([paints,composites],[2,4]);
  panel.dataset.terrainFormat='circle';
  time+=100;
  assert.equal(paint(position(.001,.25),.2,entrances),true);
  assert.deepEqual([paints,composites],[2,5]);
  restore();
  assert.equal(paint(position(.001,.25),.2,entrances),true);
  assert.deepEqual([paints,composites],[3,6]);
});
