import test from 'node:test';
import assert from 'node:assert/strict';
import {bindVideoSettings} from '../src/video-settings.mjs';

test('requested app fullscreen protects W only, and releases it on exit',async()=>{
  const elements=new Map();
  for(const key of ['video-dialog','video-open','video-close','video-fullscreen','video-quality','video-status']){
    const attributes=new Map();
    elements.set('#'+key,{setAttribute(name,value){attributes.set(name,value);},
      toggleAttribute(name,force){if(force)attributes.set(name,'');else attributes.delete(name);},
      hasAttribute(name){return attributes.has(name);}});
  }
  const document=new EventTarget();
  document.querySelector=selector=>elements.get(selector);
  document.fullscreenEnabled=true;
  document.documentElement={async requestFullscreen(){document.fullscreenElement=this;}};
  document.exitFullscreen=async()=>{
    document.fullscreenElement=null;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  const calls=[];
  const window=new EventTarget();
  window.navigator={keyboard:{async lock(keys){calls.push(keys);},unlock(){calls.push('unlock');}}};
  bindVideoSettings({document,window,lightweight:false,onGraphics(){}});
  const toggle=elements.get('#video-fullscreen');
  assert.equal(toggle.hasAttribute('data-fullscreen-available'),true);
  toggle.onclick();
  assert.equal(toggle.hasAttribute('data-fullscreen-available'),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[['KeyW']]);
  toggle.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[['KeyW'],'unlock']);
  document.fullscreenEnabled=false;
  document.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(toggle.hasAttribute('data-fullscreen-available'),false);
  assert.equal(toggle.disabled,true);
});
