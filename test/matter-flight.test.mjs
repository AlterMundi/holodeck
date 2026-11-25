import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3} from 'three';
import {bindMatterHologram,matterAvatarScale} from '../src/matter-flight.mjs';
import {bindFlightAvatarAnimation} from '../src/flight-avatar-animation.mjs';

test('a late-loading peer becomes translucent and restores its own material on exit',()=>{
  const character=new Group();
  const root=new Group();
  character.add(root);
  character.getMesh=()=>root;
  const manager={loadedCharacters:new Map([[8,{character}]]),update(){}};
  const players=new Set([8]);
  const release=bindMatterHologram(manager,{active:false},()=>players);
  const state={localCharacterId:3};
  manager.update(state);
  assert.equal(character.scale.x,matterAvatarScale);
  class FadeMaterial extends MeshStandardMaterial{
    constructor({originalMaterial}){super();this.copy(originalMaterial);}
  }
  const original=new MeshStandardMaterial();
  const source=new FadeMaterial({originalMaterial:original});
  const mesh=new Mesh(new BoxGeometry(),source);
  mesh.castShadow=true;
  root.add(mesh);
  manager.update(state);
  assert.equal(mesh.material.transparent,true);
  assert.equal(mesh.material.opacity,.55);
  assert.equal(mesh.castShadow,false);
  players.clear();
  manager.update(state);
  assert.equal(character.scale.x,1);
  assert.equal(mesh.material,source);
  assert.equal(mesh.castShadow,true);
  release();
  mesh.geometry.dispose();
  source.dispose();
  original.dispose();
});

test('a peer adopts a tabletop glide at miniature speed without accumulating pitch',()=>{
  const character=new Group(),root=new Group(),arm=new Bone();
  arm.name='upperarm_l';
  root.add(arm);
  character.getMesh=()=>root;
  const manager={loadedCharacters:new Map([[8,{character}]]),update(){}};
  const tabletopPlayers=new Set([8]);
  const release=bindFlightAvatarAnimation(manager,()=>({tabletopPlayers}));
  const position=new Vector3();
  const state={localCharacterId:1,characters:new Map([[8,{position}]])};
  manager.update(state,1/60);
  for(let i=0;i<120;i++){
    position.x+=matterAvatarScale*.95/60;
    manager.update(state,1/60);
  }
  assert.ok(Math.abs(character.quaternion.x)>.12&&Math.abs(character.quaternion.x)<.5);
  assert.ok(Math.abs(arm.quaternion.x)>.01);
  tabletopPlayers.clear();
  for(let i=0;i<120;i++)manager.update(state,1/60);
  assert.ok(Math.abs(character.quaternion.x)<.01);
  release();
  assert.equal(character.quaternion.x,0);
  assert.equal(arm.quaternion.x,0);
});
