import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three';
import {ToroidalGrass} from '../src/toroidal-grass.mjs';
import {terrainElevation,terrainPosition} from '../src/toroidal-terrain.mjs';
import {FlightWake,cruiseWakeDistance} from '../src/flight-wake.mjs';

const point=(u,v,lift=0)=>{
  const [x,y,z]=terrainPosition(u,v,terrainElevation(u,v)+lift);
  return {x,y,z};
};
const live=grass=>grass.uniforms.grassPush.value.filter(p=>p.w>-1e3);

test('the far meadow fills in beyond the detailed carpet and leaves with it',()=>{
  const grass=new ToroidalGrass(new Group());
  const meadow=point(.004,.27);
  try{
    let stable=0;
    for(let frame=0,size=-1;frame<2000&&stable<5;frame++){
      grass.update(meadow,false,1,1/60);
      const now=grass.farTiles.size*1000+grass.tiles.size;stable=now===size&&grass.farTiles.size>0?stable+1:0;size=now;
    }
    assert.ok(grass.tiles.size>0,'detailed carpet');
    const near=[...grass.tiles.values()];
    assert.ok(near.some(mesh=>mesh.material===grass.reactiveMaterial),'occupied tiles bend');
    assert.ok(near.some(mesh=>mesh.material===grass.material),'untouched tiles use the wind-only shader');
    assert.ok(near.every(mesh=>mesh.material===mesh.userData.flowers.material),'flowers follow the tile shader');
    assert.ok(grass.farTiles.size>0,'far meadow');
    const clumps=[...grass.farTiles.values()].reduce((sum,mesh)=>sum+mesh.count,0);
    assert.ok(clumps>2000&&clumps<40000,`far clumps: ${clumps}`);
    console.log(`near tiles ${grass.tiles.size}, far tiles ${grass.farTiles.size}, far clumps ${clumps}, near tufts ${[...grass.tiles.values()].reduce((s,m)=>s+m.count,0)}`);
    for(const mesh of grass.farTiles.values()){
      assert.equal(mesh.receiveShadow,false);
      assert.equal(mesh.material,grass.farMaterial);
      // Twelve triangles per clump.
      assert.equal(mesh.geometry.index.count,36);
    }
    grass.update(meadow,true,1);
    assert.equal(grass.farTiles.size,0);
    assert.equal(grass.tiles.size,0);
  }finally{grass.dispose();}
});

test('walking leaves footprints that spring back, and a jump leaves none',()=>{
  const grass=new ToroidalGrass(new Group());
  try{
    const start=point(.004,.27);
    grass.update(start,false,1,1/60);
    assert.equal(live(grass).length,1,'only the explorer, standing');
    grass.seconds+=100; // An old visit clock cannot widen each new footprint.
    const step=point(.004+1.2/(2*Math.PI*1000),.27);
    // Walk a few metres: footprints appear behind.
    for(let i=1;i<=30;i++){
      const t=i/30;
      grass.update({x:start.x+(step.x-start.x)*t*4,y:start.y+(step.y-start.y)*t*4,z:start.z+(step.z-start.z)*t*4},false,1,1/30);
    }
    const walked=live(grass).length;
    assert.ok(walked>2,`footprints: ${walked}`);
    assert.ok(grass.uniforms.grassPushBounds.value.w>0);
    assert.ok(grass.uniforms.grassPushBounds.value.w<8,'bounds follow footprint height, not its timestamp');
    // Standing still, footprints fade out within the spring-back time.
    const here=grass.walkers.get('self').now;
    for(let i=0;i<120;i++)grass.update({x:here[0],y:here[1],z:here[2]},false,1,1/30);
    assert.equal(live(grass).length,1);
    // A teleport across the meadow leaves no footprint.
    grass.update(point(.02,.27),false,1,1/30);
    assert.equal(live(grass).length,1);
    // The companion takes a live slot of its own.
    grass.observe('companion',new Vector3(here[0],here[1],here[2]));
    grass.update(point(.02,.27),false,1,1/30);
    assert.equal(live(grass).length,2);
    grass.update(point(.02,.27),true,1);
    assert.equal(grass.walkers.size,0);
    assert.equal(grass.uniforms.grassPushBounds.value.w,0);
  }finally{grass.dispose();}
});

test('ordinary flight leaves a ribbon; boost adds sparks and breaks away with a shockwave',()=>{
  const origin=new Vector3(),end=new Vector3();
  assert.equal(cruiseWakeDistance(origin,end.set(.15,0,0),.03),.15,'5 m/s');
  assert.equal(cruiseWakeDistance(origin,end.set(.05,0,0),.03),0,'hovering');
  assert.equal(cruiseWakeDistance(origin,end.set(.6,0,0),.03),0,'boost uses its own wake');
  const scene=new Group(),up=new Vector3(0,1,0);
  const wake=new FlightWake(scene);
  try{
    const at=new Vector3();
    wake.observe(1,at.set(0,0,0),up,true,.03);
    for(let i=1;i<=20;i++)wake.observe(1,at.set(i*.15,0,0),up,true,.03);
    // Cruise: a ribbon with a growing path, no sparks.
    const ribbon=wake.ribbons.slots.get(1);
    assert.ok(ribbon,'cruise ribbon');
    assert.equal(wake.index,0,'no cruise sparks');
    assert.ok(ribbon.points.filter(point=>point.born>-1e3).length>=6);
    assert.ok(Math.abs(ribbon.points[0].strength-.6)<1e-9);
    // Boost: sparks and a full-strength ribbon.
    wake.observe(2,at.set(0,5,0),up,true,.03);
    wake.observe(2,at.set(.75,5,0),up,true,.03);
    assert.ok(wake.index>0,'boost sparks');
    assert.equal(wake.ribbons.slots.get(2).points[0].strength,1);
    // A boost breaking away fires a shockwave.
    wake.burst(2,at,new Vector3(1,0,0),up);
    assert.equal(wake.shockwaves.mesh.visible,true);
    // Walking (not flying) starts no ribbon.
    wake.observe(3,at.set(0,9,0),up,false,.03);
    wake.observe(3,at.set(.15,9,0),up,false,.03);
    assert.equal(wake.ribbons.slots.has(3),false);
    wake.update(false);
    assert.equal(wake.ribbons.slots.size,0);
  }finally{wake.dispose();}
  assert.equal(scene.children.length,0);
});
