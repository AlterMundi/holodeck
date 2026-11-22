import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomSceneCache} from '../src/room-scene-cache.mjs';

test('detached scene cache rejects different actors and revisions and evicts least recently used',()=>{
  globalThis.document={createElement:name=>({name})};
  try{
    const cache=new RoomSceneCache('actor-a',2);
    const scene=(id,marker,markup='<m-group></m-group>',actor='actor-a')=>({id,actor,revision:marker.repeat(64),markup});
    const first=cache.remember(scene('foyer','a'));
    assert.equal(first.template.name,'template');
    cache.remember(scene('gallery','b'));
    const {markup,...hit}=scene('foyer','a');
    assert.equal(cache.remember(hit),first);
    cache.remember(scene('tower','c'));
    assert.equal(cache.revision('gallery'),undefined);
    assert.equal(cache.remember({...hit,revision:'d'.repeat(64)}),null);
    assert.equal(cache.remember(scene('foyer','c',markup,'actor-b')),null);
    cache.clear();
    assert.equal(cache.remember(hit),null);
  }finally{delete globalThis.document;}
});
