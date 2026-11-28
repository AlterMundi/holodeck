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
    const step=point(.004+1.2/(2*Math.PI*1000),.27);
    // Walk a few metres: footprints appear behind.
    for(let i=1;i<=30;i++){
      const t=i/30;
      grass.update({x:start.x+(step.x-start.x)*t*4,y:start.y+(step.y-start.y)*t*4,z:start.z+(step.z-start.z)*t*4},false,1,1/30);
    }
    const walked=live(grass).length;
    assert.ok(walked>2,`footprints: ${walked}`);
    assert.ok(grass.uniforms.grassPushBounds.value.w>0);
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

test('ordinary flight leaves a softer, longer trail than boost',()=>{
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
    assert.ok(wake.index>=4,`cruise particles: ${wake.index}`);
    const cruise=wake.kind.getX(0);
    const cruiseLife=wake.kind.getY(0);
    const first=wake.index;
    wake.observe(2,at.set(0,5,0),up,true,.03);
    wake.observe(2,at.set(.75,5,0),up,true,.03);
    assert.ok(wake.index>first);
    assert.ok(cruise<wake.kind.getX(first),'boost is brighter');
    assert.ok(cruiseLife>wake.kind.getY(first),'cruise lasts longer');
    // A boost sample can carry more than one cruise spacing. The first
    // cruise particle must still be inside the segment just flown.
    wake.observe(4,at.set(0,8,0),up,true,.03);
    wake.observe(4,at.set(.65,8,0),up,true,.03);
    const beforeCruise=wake.index;
    wake.observe(4,at.set(.8,8,0),up,true,.015);
    for(let index=beforeCruise;index<wake.index;index++)
      assert.ok(wake.position.getX(index)>=.65);
    // Walking (not flying) leaves nothing.
    const before=wake.index;
    wake.observe(3,at.set(0,9,0),up,false,.03);
    wake.observe(3,at.set(.15,9,0),up,false,.03);
    assert.equal(wake.index,before);
  }finally{wake.dispose();}
});
