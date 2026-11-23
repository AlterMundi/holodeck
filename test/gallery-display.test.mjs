import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {applyGallerySigns} from '../src/gallery-display.mjs';

test('the gallery plaque uses the current authorized title and disappears on access loss',()=>{
  const {window}=new JSDOM('<div id="scene"></div>');
  try{
    const scene=window.document.getElementById('scene');
    const entry={id:'house-exhibit',galleryDisplay:true,nodeRevision:1,editionTitle:'Estación de escucha'};
    const front=()=>scene.querySelector('#house-exhibit-edition-front');
    applyGallerySigns(scene,[entry]);
    const initial=front();
    assert.equal(initial.getAttribute('content'),'Estación de escucha');
    applyGallerySigns(scene,[{...entry}]);
    assert.equal(front(),initial);

    applyGallerySigns(scene,[{...entry,nodeRevision:2,editionTitle:'Estación de campo'}]);
    assert.equal(front().getAttribute('content'),'Estación de campo');
    applyGallerySigns(scene,[{...entry,nodeRevision:2,editionTitle:'Estación de campo sur'}]);
    assert.equal(front().getAttribute('content'),'Estación de campo sur');
    applyGallerySigns(scene,[{...entry,galleryDisplay:false}]);
    assert.equal(scene.querySelector('#gallery-stage-signs'),null);

    applyGallerySigns(scene,[{...entry,editionTitle:undefined}]);
    assert.equal(front(),null);
    assert.equal(scene.querySelector('#house-exhibit-sign-front').getAttribute('content'),'Terminado');
  }finally{
    window.close();
  }
});
