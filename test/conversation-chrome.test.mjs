import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {ConversationChrome} from '../src/conversation-chrome.mjs';

function chrome(){
  const {window}=new JSDOM('<section class="shared-conversation"><button id="conversation-close"></button>'+
    '<button id="history-reference-clear"></button><button id="worktable-reference-clear"></button>'+
    '<label id="room-topic"><select id="room-topic-choice" data-topic-scope="studio"><option value="" data-revision="0">Este lugar</option>'+
    '<option disabled value="private">Otra sala</option><option value="bench" data-revision="1">Mesa de trabajo</option>'+
    '</select></label><p id="conversation-hint">Mesa de trabajo</p></section>');
  const panel=window.document.querySelector('section');
  const elements=Object.fromEntries([...panel.querySelectorAll('[id]')].map(el=>[el.id,el]));
  const references={history:{sequence:1},worktable:{revision:2,part:'pin'}};
  const instance=Object.assign(Object.create(ConversationChrome.prototype),{
    panel,elements,lookPreview:{hit(){}},readReferences:()=>references,invalidate(){},
  });
  const clicks=[];
  for(const button of panel.querySelectorAll('button'))button.onclick=()=>clicks.push(button.id);
  return {instance,references,elements,clicks,dispose:()=>window.close()};
}

test('clearing one rendered reference validates its exact revision and preserves the other kind',t=>{
  const {instance,references,clicks,dispose}=chrome();
  t.after(dispose);
  const old=instance.state();
  references.worktable={revision:3,part:'pin'};
  instance.activate('clearWorktable',{source:old.worktable});
  assert.deepEqual(clicks,[]);
  instance.activate('clearHistory',{source:old.history});
  instance.activate('clearWorktable',{source:instance.state().worktable});
  assert.deepEqual(clicks,['history-reference-clear','worktable-reference-clear']);
});

test('topic actions preserve the original select route and skip disabled entries',t=>{
  const {instance,elements,dispose}=chrome();
  t.after(dispose);
  const select=elements['room-topic-choice'],changed=[];
  select.onchange=()=>changed.push(select.value);
  const visible=instance.state();
  assert.equal(visible.topics,true);
  const old=visible.routes.next.key;
  select.options[2].dataset.revision='2';
  instance.activate('next',{selection:old});
  assert.deepEqual(changed,[]);
  instance.activate('next',{selection:instance.state().routes.next.key});
  assert.equal(instance.state().topic,'Mesa de trabajo');
  const previous=instance.state().routes.previous.key;
  select.dataset.topicScope='another-room';
  instance.activate('previous',{selection:previous});
  instance.activate('previous',{selection:instance.state().routes.previous.key});
  select.disabled=true;
  instance.activate('next',{selection:old});
  assert.deepEqual(changed,['bench','']);
});
