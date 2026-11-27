import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pendingRoom,readPendings} from '../src/pending-book.mjs';

const world=new URL('https://world.test/holodeck/');
const binding='c'.repeat(64),revision='b'.repeat(64);
const make=(id,kind='task')=>({id:id.repeat(32),kind,state:'pending',title:id,binding,revision});

test('the book counts existing Conversation and Sessions entries once across pages',async()=>{
  const calls=[];
  const page=(items,cursor=1,more=false)=>({items,binding,cursor,more});
  const result=await readPendings(async path=>{
    calls.push(path);
    if(path==='tasks?after=0')return page([make('a')],1,true);
    if(path==='tasks?after=1')return page([make('f')],2);
    if(path==='requests?after=0')return page([make('d','question')]);
    return page([make('a'),make('e','question'),{...make('c'),state:'completed'}]);
  },binding);
  assert.equal(result.items.length,4);
  assert.equal(result.items.find(item=>item.id==='a'.repeat(32)).detail,'tasks/'+'a'.repeat(32));
  assert.ok(calls.includes('tasks?after=1'));
  await assert.rejects(readPendings(async()=>({...page([]),binding:'foreign'}),binding),/lista/);
});

test('only explicit destinations on this Holodeck entrance are jumpable',()=>{
  assert.equal(pendingRoom({url:world+'?sala=gallery'},world),'gallery');
  for(const url of [
    'https://elsewhere.test/holodeck/?sala=gallery', world+'?sala=gallery&other=1',
    world+'?sala=../gallery', world+'?sala=gallery#pose', world+'?sala=outside',
  ])assert.equal(pendingRoom({url},world),null);
});
