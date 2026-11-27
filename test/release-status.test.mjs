import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {installedRelease,releaseStatus} from '../src/release-status.mjs';

test('only the selected release advertises a current planned update',t=>{
  const state=mkdtempSync(join(tmpdir(),'holodeck-release-'));
  t.after(()=>rmSync(state,{recursive:true,force:true}));
  const running='a'.repeat(64),next='b'.repeat(64),now=100_000;
  const notice={from:running,to:next,expires:now+20_000,kind:'restart'};
  const save=value=>writeFileSync(join(state,'release-notice.json'),JSON.stringify(value));
  assert.equal(installedRelease(new URL('file:///active/release-'+running+'/')),running);
  assert.equal(installedRelease(new URL('file:///development/')),null);
  assert.deepEqual(releaseStatus(running,state,now),{version:'a'.repeat(12),update:null});
  save(notice);
  assert.deepEqual(releaseStatus(running,state,now).update,{kind:'restart'});
  assert.deepEqual(releaseStatus(next,state,now),{version:'b'.repeat(12),update:null});
  assert.equal(releaseStatus(running,state,notice.expires).update,null);
  save({...notice,to:running,kind:'live'});
  assert.deepEqual(releaseStatus(running,state,now).update,{kind:'live'});
  save({...notice,unexpected:'invalid'});
  assert.equal(releaseStatus(running,state,now).update,null);
});
