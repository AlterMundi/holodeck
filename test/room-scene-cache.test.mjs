import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomSceneCache,roomArtURL} from '../src/room-scene-cache.mjs';

test('detached scene cache rejects different actors and revisions and evicts least recently used',()=>{
  globalThis.document={createElement:name=>({name})};
  try{
    const cache=new RoomSceneCache('actor-a',2);
    const scene=(id,marker,markup='<m-group></m-group>',actor='actor-a')=>({id,actor,revision:marker.repeat(64),markup});
    const first=cache.remember(scene('foyer','a'));
    assert.equal(first.template.name,'template');
    const removed=[];
    const hold=id=>()=>({dispose:()=>removed.push(id)});
    cache.keepArt(first,hold('foyer'));
    cache.keepArt(first,()=>assert.fail('Existing art should be retained'));
    const gallery=cache.remember(scene('gallery','b'));
    cache.keepArt(gallery,hold('gallery'));
    const {markup,...hit}=scene('foyer','a');
    assert.equal(cache.remember(hit),first);
    cache.remember(scene('tower','c'));
    assert.equal(cache.revision('gallery'),undefined);
    assert.deepEqual(removed,['gallery']);
    cache.keepArt(gallery,()=>assert.fail('Evicted scene should not acquire art'));
    assert.equal(cache.remember({...hit,revision:'d'.repeat(64)}),null);
    assert.equal(cache.remember(scene('foyer','c',markup,'actor-b')),null);
    const revised=cache.remember(scene('foyer','c'));
    assert.notEqual(revised,first);
    assert.deepEqual(removed,['gallery','foyer']);
    cache.keepArt(revised,hold('revised foyer'));
    cache.forget('foyer');
    assert.deepEqual(removed,['gallery','foyer','revised foyer']);
    cache.keepArt(cache.remember(scene('tower','c')),hold('tower'));
    cache.clear();
    assert.deepEqual(removed,['gallery','foyer','revised foyer','tower']);
    assert.equal(cache.remember(hit),null);
  }finally{delete globalThis.document;}
});


test('detached art can acquire only the exact room-scoped model URL',()=>{
  const scope=new URL('https://holodeck.example/holodeck/api/space/art/');
  const path=scope.pathname+'a'.repeat(64)+'.glb';
  assert.equal(roomArtURL(path,scope),scope.origin+path);
  for(const source of [null,path+'?download=1',path+'#other','//foreign.example'+path,
    'https://holodeck.example'+path,scope.pathname+'../'+path,scope.pathname+'unretained.glb'])
    assert.equal(roomArtURL(source,scope),null);
});
