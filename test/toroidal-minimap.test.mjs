import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TOROIDAL_TERRAIN,terrainElevation,terrainPosition} from '../src/toroidal-terrain.mjs';
import {bindToroidalMinimap,paintToroidalRelief,toroidalMapChart,toroidalMapHeading,toroidalMapPoint} from '../src/toroidal-minimap.mjs';

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

test('the map reuses the terrain raster while still updating its position and heading',()=>{
  let paints=0,composites=0,time=0,restore;
  const raster={createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>paints++};
  const view={
    drawImage:()=>composites++,save(){},scale(){},restore(){},translate(){},rotate(){},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){},fillRect(){},fillText(){},
  };
  const canvas={width:384,height:384,getContext:()=>view,addEventListener:(_,callback)=>{restore=callback;},
    ownerDocument:{createElement:()=>({getContext:()=>raster,addEventListener(){}})}};
  const panel={open:true,querySelector:()=>canvas};
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
  restore();
  assert.equal(paint(position(.001,.25),.2,entrances),true);
  assert.deepEqual([paints,composites],[3,5]);
});
