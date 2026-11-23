import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {SignalGardenEditor} from '../src/signal-garden-editor.mjs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const node={id:'node-example',title:'Jardín de ensayo',revision:2,position:{x:0,z:1},play:{
  schema:'signal-garden/v1',minContributors:1,targets:[{x:0,z:1,radius:.75,color:'mint'}]}};

function fixture(t,options={}){
  const {window}=new JSDOM(html);
  t.after(()=>window.close());
  const document=window.document,previews=[];
  const editor=new SignalGardenEditor({document,allowed:()=>true,position:()=>node.position,
    preview:targets=>previews.push(targets),...options});
  return {editor,at:id=>document.getElementById(id),previews};
}

test('a late confirmation closes only the draft that submitted that command',async t=>{
  let sends=0;
  const {editor,at,previews}=fixture(t,{save:async(selected,_args,_target,track)=>{
    assert.equal(selected,node);
    sends++;
    track('accepted-save');
  }});
  editor.open(node);
  await editor.submit();
  assert.equal(at('signal-save').disabled,true);
  assert.equal(at('signal-editor').hidden,false);
  editor.settle('unrelated-command','completed');
  await editor.submit();
  assert.equal(sends,1);
  assert.equal(at('signal-editor').hidden,false);
  editor.settle('accepted-save','completed');
  assert.equal(at('signal-editor').hidden,true);
  assert.equal(previews.at(-1),null);
});

test('retirement requires explicit confirmation and rechecks the selected revision',async t=>{
  let allowed=true;
  const retired=[];
  const {editor,at}=fixture(t,{allowed:()=>allowed,remove:async(selected,track)=>{
    retired.push([selected.id,selected.revision]);
    track('accepted-removal');
  }});
  editor.open(node);
  await editor.submit(true);
  assert.deepEqual(retired,[]);
  editor.confirmRemoval();
  assert.equal(at('signal-remove-confirm').hidden,false);
  assert.match(at('signal-remove-title').textContent,/Jardín de ensayo/);
  allowed=false;
  await editor.submit(true);
  assert.deepEqual(retired,[]);
  assert.equal(at('signal-remove-confirm').hidden,true);
  assert.equal(at('signal-save').disabled,true);

  editor.close();
  allowed=true;
  editor.open(node);
  editor.confirmRemoval();
  await editor.submit(true);
  assert.deepEqual(retired,[[node.id,node.revision]]);
  editor.settle('accepted-removal','completed');
  assert.equal(at('signal-editor').hidden,true);
});
