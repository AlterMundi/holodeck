import test from 'node:test';
import assert from 'node:assert/strict';
import {ExhibitionIndex} from '../src/exhibition-index.mjs';

test('the exhibition catalog rejects a stale edition and preserves query through a matching refresh',()=>{
  const panel={open:false,showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};
  const search={value:'',addEventListener(){}};
  const results={replaceChildren(){}};
  const elements={'#exhibition-index':panel,'#exhibition-search':search,'#exhibition-results':results};
  const chosen=[];
  const index=new ExhibitionIndex({querySelector:id=>elements[id],querySelectorAll:()=>[]},value=>chosen.push(value));
  const exhibit={id:'a',title:'Órbita',nodeRevision:1,pin:{revision:'one'}};
  index.update([exhibit]);
  index.open({native:true});
  index.searchFor('orbita');
  const painted=index.version;
  index.update([{...exhibit}]);
  assert.equal(index.version,painted);
  assert.equal(index.search.value,'orbita');
  index.update([{...exhibit,nodeRevision:2,pin:{revision:'two'}}]);
  index.choose('a',painted);
  assert.deepEqual(chosen,[]);
  index.choose('a',index.version);
  assert.equal(chosen[0].pin.revision,'two');
});
