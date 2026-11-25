import test from 'node:test';
import assert from 'node:assert/strict';
import {bindVideoSettings} from '../src/video-settings.mjs';

test('requested app fullscreen protects W only, and releases it on exit',async()=>{
  const elements=new Map();
  for(const key of ['video-dialog','video-open','video-close','video-fullscreen','video-quality','video-status']){
    elements.set('#'+key,{setAttribute(){}});
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
  toggle.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[['KeyW']]);
  toggle.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[['KeyW'],'unlock']);
});
