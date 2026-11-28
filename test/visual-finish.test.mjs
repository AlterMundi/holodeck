import test from 'node:test';
import assert from 'node:assert/strict';
import {GRADE_DEFAULTS} from '../src/cinematic-grade.mjs';
import {Group} from 'three';
import {grassCover,ToroidalGrass} from '../src/toroidal-grass.mjs';
import {terrainElevation,terrainPosition,TOROIDAL_TERRAIN} from '../src/toroidal-terrain.mjs';
import {CAVE} from '../src/toroidal-cave.mjs';

const TAU=2*Math.PI;
const local=(x,z)=>({u:((z/(TAU*TOROIDAL_TERRAIN.majorRadius))%1+1)%1,v:.25-x/(TAU*(TOROIDAL_TERRAIN.tubeRadius+18))});
const cover=({u,v})=>grassCover(u,v,terrainElevation(u,v));

test('grass leaves the parcel commons, the main trail and the cave mouth bare',()=>{
  assert.equal(cover(local(0,15)),0,'house commons');
  assert.equal(cover(local(8,20)),0,'house plots');
  assert.equal(cover({u:.3,v:.25}),0,'main trail centre');
  assert.equal(cover({u:(CAVE.from+CAVE.to)/2,v:CAVE.latitude}),0,'cave');
  assert.equal(grassCover(.3,.3,TOROIDAL_TERRAIN.waterLevel-1),0,'under water');
});

test('grass grows on the open meadow beside the arrival and thins toward the parcel',()=>{
  const open=cover(local(-30,-15));
  assert.ok(open>.3,'open meadow '+open);
  const edge=cover(local(-11,10));
  assert.ok(edge>0&&edge<open,'feathered edge '+edge);
});

test('cinematic grade keeps a restrained default look',()=>{
  assert.ok(GRADE_DEFAULTS.bloomStrength>0&&GRADE_DEFAULTS.bloomStrength<1);
  assert.ok(GRADE_DEFAULTS.saturation>=1&&GRADE_DEFAULTS.saturation<1.3);
  assert.ok(GRADE_DEFAULTS.contrast>=1&&GRADE_DEFAULTS.contrast<1.2);
  assert.ok(Object.isFrozen(GRADE_DEFAULTS));
});

test('night swarms return to the same world positions and disappear in lightweight mode',()=>{
  const grass=new ToroidalGrass(new Group());
  const point=(u,v)=>{
    const [x,y,z]=terrainPosition(u,v,terrainElevation(u,v)+.6);
    return {x,y,z};
  };
  const points=()=>Array.from(grass.fireflies.geometry.attributes.position.array
    .subarray(0,grass.fireflies.geometry.drawRange.count*3));
  const meadow=point(.004,.27);
  try{
    grass.update(meadow,false,0);
    const before=points();
    assert.ok(before.length>0);
    grass.update(point(.1,.27),false,0);
    assert.notDeepEqual(points(),before);
    grass.update(meadow,true,0);
    assert.equal(grass.fireflies.visible,false);
    grass.update(meadow,false,0);
    assert.deepEqual(points(),before);
    grass.update(meadow,false,1);
    assert.equal(grass.fireflies.visible,false);
  }finally{grass.dispose();}
});
