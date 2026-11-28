import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Matrix4,Scene,Vector3} from 'three';
import {approachCover,grassBesideStones,ToroidalScenery} from '../src/toroidal-scenery.mjs';
import {meadowBankPlants,shortMeadowPlants} from '../src/toroidal-meadow-banks.mjs';
import {TOROIDAL_TERRAIN,terrainFrame,terrainPosition,terrainTrail,TOROIDAL_SPAWN,TOROIDAL_OVERLOOK} from '../src/toroidal-terrain.mjs';
import {approachCoordinates} from '../src/sand3d-trail.mjs';

test('stone contact uses the wrapped footprint at each root and leaves distant grass alone',()=>{
  const stone={u:.99999,v:.25,size:.8,footprint:{along:11500,across:3100,cosine:1,sine:0}};
  const scale=(u,v=.25)=>grassBesideStones([stone],u,v);
  assert.equal(scale(.00001),0);
  assert.equal(scale(.99997),0);
  const margin=scale(.00010);
  assert.ok(margin>0&&margin<1);
  assert.equal(scale(.0002),1);
  assert.equal(scale(.00001,.251),1);
});

test('the lookout collider remains active while analytical plants wait for detailed terrain',()=>{
  const scene=new Scene(),colliders=new Set();
  const cover=new ToroidalScenery(scene,null,{
    addCollider:mesh=>colliders.add(mesh),
    removeCollider:mesh=>colliders.delete(mesh),
  });
  const {u,v}=TOROIDAL_OVERLOOK;
  const position=new Vector3().fromArray(terrainPosition(u,v));
  try{
    cover.update(position,false,null,1,false);
    assert.ok(scene.getObjectByName('Inner ring overlook'));
    assert.ok(colliders.has(scene.getObjectByName('Lookout masonry and seating collision')));
    assert.ok(cover.group.children.every(mesh=>!mesh.visible&&mesh.count===0));
    assert.equal(cover.meadow.group.visible,false);
    cover.update(position,false);
    assert.ok(cover.group.children.some(mesh=>mesh.count>0));
  }finally{
    cover.dispose();
  }
  assert.equal(colliders.size,0);
});

test('both scenery profiles leave Casa Linterna paving clear and keep the garden interstices',()=>{
  const scene=new Scene(),scenery=new ToroidalScenery(scene);
  const origin=new Vector3(1855,498,15.5);
  const camera=new Vector3(1831.754,498,15.443);
  const instance=new Matrix4(),root=new Vector3();
  try{
    for(const lightweight of [false,true]){
      scenery.update(camera,lightweight);
      scene.updateMatrixWorld(true);
      let path=0,garden=0,interstices=0;
      scenery.group.traverse(mesh=>{
        if(!mesh.isInstancedMesh||!mesh.visible)return;
        for(let i=0;i<mesh.count;i++){
          mesh.getMatrixAt(i,instance);
          root.setFromMatrixPosition(instance).applyMatrix4(mesh.matrixWorld);
          const x=root.z-origin.z,z=origin.x-root.x;
          if(Math.abs(x)<2.9&&z>1.8&&z<35.5)path++;
          if(Math.abs(x)>14&&Math.abs(x)<30&&Math.abs(z)<28)garden++;
          if(Math.abs(x)>5&&Math.abs(x)<12&&z>13.6&&z<17.35)interstices++;
        }
      });
      assert.equal(path,0);
      assert.ok(garden>0);
      assert.ok(interstices>0);
    }
  }finally{scenery.dispose();}
});

test('the meadow profiles share rooted banks outside the trail and dispose their instance buffers',()=>{
  const normal=meadowBankPlants(false),light=meadowBankPlants(true);
  assert.deepEqual(meadowBankPlants(false),normal);
  assert.equal(normal.length,5);
  for(const [index,plants] of normal.entries()){
    assert.ok(plants.length>light[index].length);
    const selected=plants.filter(p=>light[index].some(q=>p.u===q.u&&p.v===q.v));
    assert.deepEqual(selected,light[index]);
    for(const plant of plants){
      assert.ok(plant.size<=1&&plant.h>TOROIDAL_TERRAIN.waterLevel);
      const x=(.25-plant.v)*2*Math.PI*(TOROIDAL_TERRAIN.tubeRadius+18);
      const z=plant.u*2*Math.PI*TOROIDAL_TERRAIN.majorRadius;
      assert.ok(Math.abs(x)>=6.25);
      assert.ok(z>.82&&z+.82<70);
      for(let i=0;i<8;i++){
        const angle=i*Math.PI/4;
        const {u,v}=approachCoordinates(x+.82*Math.cos(angle),z+.82*Math.sin(angle));
        assert.ok(terrainTrail(u,v)<=.10);
      }
    }
  }
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  const spawn=new Vector3(TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z);
  const batches=()=>cover.meadow.profiles.find(p=>p.group.visible).group.children;
  const triangleCount=()=>batches().reduce((total,batch)=>total+batch.count*(batch.geometry.index?.count??batch.geometry.attributes.position.count)/3,0);
  const normalRoots=shortMeadowPlants(-18,18,false);
  const lightRoots=shortMeadowPlants(-18,18,true);
  assert.deepEqual(shortMeadowPlants(-18,18,false),normalRoots);
  assert.ok(normalRoots.length>600);
  const woodlandRoots=shortMeadowPlants(-81,81,false);
  assert.ok(woodlandRoots.length>450);
  assert.ok(woodlandRoots.filter(root=>root.canopy>.6).length>150);
  assert.ok(woodlandRoots.every(root=>root.size<=1.3*(1-root.canopy*.20)+1e-8));
  const identities=new Set(normalRoots.map(p=>p.u+':'+p.v));
  assert.ok(lightRoots.every(p=>identities.has(p.u+':'+p.v)));
  assert.ok(normalRoots.every(p=>terrainTrail(p.u,p.v)<=.08));
  cover.update(spawn,false);
  const shortLayer=()=>batches().find(batch=>batch.name==='Short meadow grass');
  assert.ok(shortLayer()?.count>0);
  assert.equal(triangleCount(),21342+15*shortLayer().count);
  assert.equal(batches().length,11);
  const original=batches()[0];
  cover.update(spawn,true);
  assert.equal(triangleCount(),4911+12*shortLayer().count);
  cover.update(spawn,false);
  assert.equal(batches()[0],original);
  const threshold=spawn.clone().setZ(154);
  cover.update(threshold,false);
  assert.equal(cover.meadow.group.visible,true);
  cover.update(threshold.clone().setZ(169),false);
  assert.equal(cover.meadow.group.visible,false);
  cover.update(threshold,false);
  assert.equal(cover.meadow.group.visible,false);
  cover.update(new Vector3().fromArray(terrainPosition(.4,.25,25)),false);
  assert.equal(cover.meadow.group.visible,false);
  let disposed=false;
  original.addEventListener('dispose',()=>{disposed=true;});
  cover.dispose();
  assert.ok(disposed);
  assert.equal(scene.children.length,0);
});

test('trail-edge planting preserves the clear route and keeps the same flowers in both profiles',()=>{
  const normal=approachCover(false),light=approachCover(true);
  assert.ok(normal.length>light.length);
  assert.deepEqual(normal.filter(p=>p.kind==='bloom'),light.filter(p=>p.kind==='bloom'));
  assert.deepEqual(normal,approachCover(false));
  for(const plant of normal){
    assert.ok(terrainTrail(plant.u,plant.v)<=.22);
    const arc=plant.u*2*Math.PI*TOROIDAL_TERRAIN.majorRadius;
    assert.ok(plant.v<.25 || Math.abs(arc-15.5)>=1.9);
    assert.ok([plant.h,plant.size,plant.yaw].every(Number.isFinite));
  }
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  cover.update(new Vector3(TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z),false);
  assert.equal(cover.blooms.count,normal.filter(p=>p.kind==='bloom').length);
  assert.ok(cover.meshes.every(mesh=>mesh.count<=mesh.instanceMatrix.count));
  cover.update(new Vector3().fromArray(terrainPosition(.4,.25,25)),false);
  assert.equal(cover.blooms.count,0);
  cover.dispose();
  assert.equal(scene.children.length,0);
});

test('the permitted entrance anchors bounded approach planting without filling the passage',()=>{
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  const light=approachCover(true,door),normal=approachCover(false,door);
  assert.notDeepEqual(light,approachCover(true));
  assert.deepEqual(light.filter(p=>p.kind==='bloom'),normal.filter(p=>p.kind==='bloom'));
  const localArc=plant=>plant.u*2*Math.PI*TOROIDAL_TERRAIN.majorRadius;
  assert.ok(normal.every(plant=>plant.v<.25 || Math.abs(localArc(plant)-door.z)>=1.9));
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  const position=new Vector3(TOROIDAL_SPAWN.x,TOROIDAL_SPAWN.y,TOROIDAL_SPAWN.z);
  cover.update(position,false,door);
  assert.equal(cover.ribbonGrass.count,normal.filter(p=>p.kind==='grass').length);
  cover.update(position,false);
  assert.equal(cover.ribbonGrass.count,approachCover(false).filter(p=>p.kind==='grass').length);
  cover.dispose();
});

test('Sand3D batches admit only the composed verge outside the route and flagstone apron',async()=>{
  const {sand3dTrailPlacement}=await import('../src/sand3d-trail.mjs');
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  const placed=sand3dTrailPlacement(door);
  assert.equal(placed.length,14);
  assert.deepEqual(sand3dTrailPlacement(null),[]);
  assert.deepEqual(sand3dTrailPlacement(door),placed);
  assert.equal(placed.filter(({name})=>name==='feather-reed-grass').length,6);
  const tau=2*Math.PI;
  for(const plant of placed){
    assert.ok(terrainTrail(plant.u,plant.v)<=.22);
    const x=(.25-plant.v)*tau*(TOROIDAL_TERRAIN.tubeRadius+18);
    const z=plant.u*tau*TOROIDAL_TERRAIN.majorRadius;
    const axial=(x-door.x+TOROIDAL_TERRAIN.majorRadius)*door.facing;
    const clearance=plant.scale*.55;
    assert.ok(axial<=-4.8-clearance||axial>=1.25+clearance||Math.abs(z-door.z)>=2.8+clearance);
  }
});

test('lightweight and distant approaches do not start optional trail downloads',async()=>{
  const {Sand3DTrail}=await import('../src/sand3d-trail.mjs');
  const scene=new Scene(),origin=[1799,498,23],position=new Vector3(...origin);
  const cover=new Sand3DTrail(scene,new URL('https://fixture.test/'),origin,()=>{},{value:1});
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  let requests=0;
  cover.load=()=>{requests++;};
  cover.update(position,true,door);
  cover.update(new Vector3(1799,498,100),false,door);
  cover.update(position,false,null);
  assert.equal(requests,0);
  cover.update(position,false,door);
  cover.update(position,false,door);
  assert.equal(requests,3);
  cover.update(new Vector3(1799,498,72),false,door);
  cover.update(position,false,door);
  assert.equal(requests,3);
  cover.update(new Vector3(1799,498,100),false,door);
  cover.update(position,false,door);
  assert.equal(requests,6);
  cover.dispose();
  assert.equal(scene.children.length,0);
});

test('a transient Sand3D failure preserves verified siblings and recovers only the missing batch',async t=>{
  const {Sand3DTrail}=await import('../src/sand3d-trail.mjs');
  const {sand3dTrailAssets}=await import('../src/sand3d-trail-assets.mjs');
  const models=new Map(await Promise.all(Object.values(sand3dTrailAssets).map(async ({path})=>
    [path,await readFile(new URL('../public/'+path,import.meta.url))])));
  const scene=new Scene(),position=new Vector3(1799,498,23);
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  const cover=new Sand3DTrail(scene,new URL('https://fixture.test/'),position.toArray(),()=>{},{value:1});
  const requests=[],loads=[],load=cover.load.bind(cover);
  cover.load=(...args)=>loads.push(load(...args));
  let fernRequests=0;
  t.mock.method(globalThis,'fetch',url=>{
    const path=url.pathname.slice(1);
    requests.push(path);
    if(path.includes('sensitive-fern')&&fernRequests++===0)return new Response(null,{status:503});
    return new Response(models.get(path));
  });
  try{
    cover.update(position,false,door);
    await Promise.all(loads.splice(0));
    cover.update(position,false,door);
    assert.equal(cover.group.visible,true);
    assert.deepEqual([...cover.groups.keys()].sort(),['feather-reed-grass','pumice']);
    assert.equal([...cover.groups.values()].reduce((sum,batch)=>sum+batch.count,0),10);
    const retry=cover.attempts.get('sensitive-fern').retryAt;
    cover.update(position,true,door,retry);
    assert.equal(cover.group.visible,false);
    assert.equal(requests.length,3);
    cover.update(position,false,door,retry);
    await Promise.all(loads.splice(0));
    cover.update(position,false,door,retry);
    assert.equal(requests.length,4);
    assert.equal(cover.groups.size,3);
    assert.equal([...cover.groups.values()].reduce((sum,batch)=>sum+batch.count,0),14);
  }finally{cover.dispose();}
  assert.equal(scene.children.length,0);
});

test('Sand3D stops invalid or exhausted attempts and aborts a late load on region exit',async t=>{
  const {Sand3DTrail}=await import('../src/sand3d-trail.mjs');
  const scene=new Scene(),position=new Vector3(1799,498,23);
  const door={x:1797.925,y:498.11,z:15.5,facing:-1};
  const cover=new Sand3DTrail(scene,new URL('https://fixture.test/'),position.toArray(),()=>{},{value:1});
  const loads=new Map(),load=cover.load.bind(cover);
  cover.load=(name,...args)=>loads.set(name,load(name,...args));
  const settleAvailable=()=>Promise.all([...loads].filter(([name])=>name!=='feather-reed-grass').map(([,task])=>task));
  const settleAll=()=>{
    const tasks=[...loads.values()];
    loads.clear();
    return Promise.all(tasks);
  };
  let aborted=0;
  t.mock.method(globalThis,'fetch',(url,{signal})=>{
    if(url.pathname.includes('pumice'))return new Response('bad model');
    if(url.pathname.includes('sensitive-fern'))return new Response(null,{status:429});
    return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{
      aborted++;
      reject(signal.reason);
    },{once:true}));
  });
  try{
    cover.update(position,false,door);
    await settleAvailable();
    cover.update(new Vector3(1799,498,100),false,door);
    await settleAll();
    assert.equal(aborted,1);
    assert.equal(cover.groups.size,0);
    for(let step=0;step<2;step++){
      cover.update(position,false,door,performance.now()+5000);
      await settleAvailable();
      cover.update(position,true,door);
      await settleAll();
    }
    assert.equal(cover.attempts.get('pumice').count,1);
    assert.equal(cover.attempts.get('sensitive-fern').count,3);
    assert.equal(aborted,3);
    cover.update(position,false,door,performance.now()+5000);
    assert.equal(loads.size,0);
  }finally{cover.dispose();}
});

test('meadow quality switches retain deterministic instances and keep the two draws bounded',()=>{
  const scene=new Scene(),cover=new ToroidalScenery(scene);
  const position=new Vector3().fromArray(terrainPosition(.0118,.285,43));
  const profile=lightweight=>{
    cover.update(position,lightweight);
    return [cover.field,cover.fieldFar].map(mesh=>({
      count:mesh.count,
      capacity:mesh.instanceMatrix.count,
      triangles:mesh.geometry.index.count/3,
      matrices:[...mesh.instanceMatrix.array.subarray(0,16*mesh.count)],
      roots:[...mesh.geometry.getAttribute('meadowRootUV').array.subarray(0,2*mesh.count)],
    }));
  };
  try{
    const normal=profile(false),light=profile(true);
    for(const latitude of [0,.25,.5]){
      const onGround=new Vector3().fromArray(terrainPosition(.34,latitude,16));
      const up=new Vector3().fromArray(terrainFrame(.34,latitude).up);
      cover.update(onGround,true);
      const groundUV=cover.fieldViewer.value.clone();
      cover.update(onGround.clone().addScaledVector(up,8),true);
      assert.ok(cover.fieldViewer.value.distanceTo(groundUV)<1e-9);
    }
    assert.ok(normal.every(mesh=>mesh.count>0&&mesh.count<=mesh.capacity));
    assert.ok(light[1].count>0&&light[1].count<=light[1].capacity);
    assert.equal(light[0].count,0);
    assert.ok(light[1].count*light[1].triangles<
      normal.reduce((sum,mesh)=>sum+mesh.count*mesh.triangles,0));
    assert.deepEqual(profile(false),normal);
    assert.deepEqual(profile(true),light);
  }finally{
    cover.dispose();
  }
});

test('grass settles before either field axis recycles tiles at a torus seam',()=>{
  const cover=new ToroidalScenery(new Scene());
  const sample=(u,v)=>{
    cover.update(new Vector3().fromArray(terrainPosition(u,v,20)),false);
    const roots=new Map();
    for(const mesh of [cover.field,cover.fieldFar]){
      const uv=mesh.geometry.getAttribute('meadowRootUV');
      for(let i=0;i<mesh.count;i++){
        const root=[uv.getX(i),uv.getY(i)];
        roots.set(root.join(':'),root);
      }
    }
    return {uv:cover.fieldViewer.value.toArray(),roots};
  };
  const distance=(root,viewer)=>Math.max(...root.map((coordinate,i)=>{
    const delta=Math.abs(coordinate-viewer[i]);
    return Math.min(delta,1-delta)*[2048,512][i];
  }));
  try{
    for(const [left,right] of [
      [sample(1-1e-7,.256),sample(1e-7,.256)],
      [sample(.003,131/512-1e-7),sample(.003,131/512+1e-7)],
    ]){
      for(const [from,to] of [[left,right],[right,left]]){
        const removed=[...from.roots].filter(([key])=>!to.roots.has(key)).map(([,root])=>root);
        assert.ok(removed.length>0);
        for(const root of removed)assert.ok(distance(root,from.uv)>=4.96);
      }
    }
  }finally{cover.dispose();}
});
