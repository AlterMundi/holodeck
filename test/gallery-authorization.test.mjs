import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGalleryAuthorization} from '../src/gallery-authorization.mjs';

const origin = 'https://home.example.test';
const cookie = '__Host-home=' + 'x'.repeat(43) + '; holodeck_session=example';
const pin = {kind: 'artifact_review', tableId: 'table-1', reviewId: 'model-1',
  revision: 'edition-1', adapter: 'interactive_3d'};
const descriptor = {
  schema: 'dm.holodeck-visit/descriptor-v2', pin, kind: 'interactive_3d',
  title: 'Authorized assembly', entry: '/nexus/?table=table-1&entry=web',
};

test('gallery reuses the canonical descriptor with the actual visitor cookie', async () => {
  let calls = 0;
  const check = createGalleryAuthorization(origin, {request: async (url, options) => {
    calls++;
    assert.equal(url.href, origin + '/nexus/api/tables/table-1/artifact-review/model-1/edition-1/visit');
    assert.equal(options.headers.Cookie, cookie.split(';')[0]);
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(descriptor);
  }});
  assert.equal(await check(cookie,pin), true);
  assert.equal(await check(cookie,pin), true);
  assert.equal(calls, 2);
});

test('gallery never requests a descriptor with an invalid cookie, pin or origin', async () => {
  for (const invalidOrigin of ['http://home.example.test', origin+'/', origin+'/nexus', origin+'?x=1',
    'https://user@home.example.test']) {
    assert.throws(() => createGalleryAuthorization(invalidOrigin), /canonical HTTPS/);
  }
  let calls = 0;
  const check = createGalleryAuthorization(origin, {request: async () => {
    calls++;
    return Response.json(descriptor);
  }});
  for (const invalidCookie of [undefined, ' ', 'a\r\nb', 'a'.repeat(8193), 'holodeck_session=example']) {
    assert.equal(await check(invalidCookie, pin), false);
  }
  assert.equal(await check(cookie, {...pin,tableId:'../unscoped'}), false);
  assert.equal(calls, 0);
});

test('gallery denies unavailable, redirected or mismatched responses', async () => {
  for (const status of [302, 401, 403, 404, 500]) {
    const check = createGalleryAuthorization(origin, {
      request: async () => Response.json(descriptor,{status}),
    });
    assert.equal(await check(cookie,pin), false);
  }
  const offline = createGalleryAuthorization(origin, {request: async () => {
    throw Error('No receiving response');
  }});
  assert.equal(await offline(cookie,pin), false);
  for (const change of [
    {schema:'dm.holodeck-visit/descriptor-v1'}, {kind:'video'},
    {pin:{...pin,revision:'edition-2'}}, {entry:'https://other.example.test/nexus/?table=table-1'},
    {entry:'/nexus/?table=table-2&entry=web'},
  ]) {
    const check = createGalleryAuthorization(origin, {
      request: async () => Response.json({...descriptor,...change}),
    });
    assert.equal(await check(cookie,pin), false);
  }
});

test('gallery checks the exact viewer entry required by each supported descriptor', async () => {
  for (const candidate of [
    {...descriptor, schema:'dm.holodeck-visit/descriptor-v1', kind:'narrated_visual',
      pin:{tableId:'table-1',reportId:'report',revision:'edition-1'},
      entry:descriptor.entry+'&report_revision=edition-1'},
    {...descriptor, schema:'dm.holodeck-visit/descriptor-v3', kind:'context',
      pin:{kind:'context',tableId:'table-1',contextId:'context-1',revision:'edition-1'},
      entry:descriptor.entry+'&context_id=context-1&context_version=edition-1'},
  ]) {
    const check = createGalleryAuthorization(origin, {request: async () => Response.json(candidate)});
    assert.equal(await check(cookie,candidate.pin), true);
    const altered = { ...candidate, entry: candidate.entry.replace('edition-1','edition-2') };
    const reject = createGalleryAuthorization(origin, {request: async () => Response.json(altered)});
    assert.equal(await reject(cookie,candidate.pin), false);
  }
});

test('gallery caps streamed descriptors without relying on Content-Length', async () => {
  let cancelled = false;
  const encoder = new TextEncoder();
  const check = createGalleryAuthorization(origin, {request: async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify(descriptor)));
      controller.enqueue(encoder.encode(' '.repeat(8192)));
    },
    cancel() { cancelled = true; },
  }))});
  assert.equal(await check(cookie,pin), false);
  assert.equal(cancelled, true);
});
