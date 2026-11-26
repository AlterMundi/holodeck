import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {applyGallerySigns} from '../src/gallery-display.mjs';

test('the gallery plaque uses the current authorized title and disappears on access loss',()=>{
  const {window}=new JSDOM('<div id="scene"><m-model id="room-art" src="/gallery.glb"></m-model></div>');
  try{
    const scene=window.document.getElementById('scene');
    const entry={id:'house-exhibit',galleryDisplay:true,nodeRevision:1,editionTitle:'Estación de escucha'};
    const front=()=>scene.querySelector('#house-exhibit-edition-front');
    applyGallerySigns(scene,[entry]);
    const initial=front();
    assert.equal(initial.getAttribute('content'),'Estación de escucha');
    const plate=scene.querySelector('#house-exhibit-plaque');
    assert.equal(plate.getAttribute('x'),'1.895');
    assert.equal(plate.getAttribute('y'),'0.965');
    assert.equal(plate.querySelectorAll(':scope > m-cube').length,2);
    assert.equal(plate.querySelectorAll('m-label[collide="false"]').length,4);
    applyGallerySigns(scene,[{...entry}]);
    assert.equal(front(),initial);

    applyGallerySigns(scene,[{...entry,nodeRevision:2,editionTitle:'Estación de campo'}]);
    assert.equal(front().getAttribute('content'),'Estación de campo');
    applyGallerySigns(scene,[{...entry,nodeRevision:2,editionTitle:'Estación de campo sur'}]);
    assert.equal(front().getAttribute('aria-label'),'Estación de campo sur');
    assert.match(front().getAttribute('content'),/^Estación de campo/);
    applyGallerySigns(scene,[{...entry,galleryDisplay:false}]);
    assert.equal(scene.querySelector('#gallery-stage-signs'),null);

    applyGallerySigns(scene,[{...entry,editionTitle:undefined}]);
    assert.equal(front(),null);
    assert.equal(scene.querySelector('#house-exhibit-sign-front').getAttribute('content'),'Terminado');

    scene.querySelector('#room-art').remove();
    applyGallerySigns(scene,[entry]);
    const generic=scene.querySelector('#house-exhibit-plaque');
    assert.equal(generic.getAttribute('x'),'2.5');
    assert.ok(Number(generic.getAttribute('y'))>1.5);
    assert.equal(generic.querySelectorAll(':scope > m-cube').length,0);

    const fallback=window.document.createElement('m-group');
    fallback.id='house-exhibit';
    fallback.innerHTML='<m-cube y="1.10" height=".49"></m-cube>';
    scene.append(fallback);
    applyGallerySigns(scene,[entry]);
    const mounted=scene.querySelector('#house-exhibit-plaque');
    assert.ok(Math.abs(Number(mounted.getAttribute('y'))-1.345)<1e-9);
    assert.equal(mounted.querySelectorAll(':scope > m-cube').length,2);
  }finally{
    window.close();
  }
});
