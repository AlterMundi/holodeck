import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import test from 'node:test';
import {parseRenderedView,RenderedViews,renderedViewLifetimeMs} from '../src/rendered-view.mjs';

// An SOF followed by opaque payload tests metadata handling independently
// from the browser check that decodes the real WebGL frame as JPEG.
const jpeg=Buffer.concat([Buffer.from('ffd8ffc0000b0800f0014001011100','hex'),Buffer.alloc(64),Buffer.from('ffd9','hex')]);
const at=1800000000000;
const input={capturedAt:at,camera:{position:[2,3,4],rotation:[0,0,0,1],fov:60,aspect:4/3},jpeg:jpeg.toString('base64')};

test('rendered evidence binds the JPEG and actual camera to one bounded capture',()=>{
  const view={capturedAt:at-16};
  const frame=parseRenderedView(input,view);
  assert.equal(frame.descriptor.sha256,createHash('sha256').update(jpeg).digest('hex'));
  assert.deepEqual([frame.descriptor.width,frame.descriptor.height],[320,240]);
  assert.deepEqual(frame.descriptor.camera,input.camera);
  assert.equal(parseRenderedView(input,{capturedAt:at-1801}),null);
  assert.equal(parseRenderedView({...input,camera:{...input.camera,rotation:[0,0,0,2]}},view),null);
});

test('replay keeps the original bytes scoped to their human, room and run',()=>{
  const views=new RenderedViews();
  const identity={id:randomUUID(),human:'human:fixture',space:'room-a',run:randomUUID()};
  const frame=parseRenderedView(input,{capturedAt:at});
  views.put({...identity,frame},at);
  views.put({...identity,frame:{...frame,jpeg:'replacement'}},at+1);
  assert.deepEqual(views.read(identity,at+2),frame);
  for(const field of ['human','space','run','id'])
    assert.equal(views.read({...identity,[field]:'other'},at+2),null);
  views.remove(identity.id,'someone-else');
  assert.deepEqual(views.read(identity,at+2),frame);
  assert.equal(views.read(identity,at+renderedViewLifetimeMs),null);
});
