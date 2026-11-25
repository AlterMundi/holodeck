import assert from 'node:assert/strict';
import {test} from 'node:test';
import {bindHudAppearance,hudAppearanceKey} from '../src/hud-appearance.mjs';

function fixture(stored){
  const key='holodeck.hudTheme';
  const selector=new EventTarget();
  const document={body:{dataset:{roomLook:'amber',hudLook:'cabina'}},getElementById:id=>{
    assert.equal(id,'hud-theme-choice');
    return selector;
  }};
  const window=new EventTarget();
  Object.defineProperty(window,'localStorage',{get(){
    if(!stored)throw Error('storage disabled');
    return stored;
  }});
  bindHudAppearance(document,window);
  function choose(value){
    selector.value=value;
    selector.dispatchEvent(new Event('change'));
  }
  function observe(next){
    const event=new Event('storage');
    Object.assign(event,{key,newValue:next,storageArea:stored});
    window.dispatchEvent(event);
  }
  return {document,selector,choose,observe};
}

test('appearance preference is browser-local and distinct from the scene and preview look',()=>{
  const data=new Map([['holodeck.hudTheme','invalid']]);
  const {document,selector,choose,observe}=fixture({getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)});
  assert.equal(selector.value,'dark');
  const initial=hudAppearanceKey(document);
  choose('light');
  assert.equal(data.get('holodeck.hudTheme'),'light');
  assert.equal(document.body.dataset.hudTheme,'light');
  assert.notEqual(hudAppearanceKey(document),initial);
  observe(null);
  assert.equal(selector.value,'dark');
  assert.equal(hudAppearanceKey(document),initial);
});

test('the visitor can switch appearance with storage denied',()=>{
  const {document,selector,choose}=fixture();
  choose('light');
  assert.equal(selector.value,'light');
  assert.equal(document.body.dataset.hudTheme,'light');
});
