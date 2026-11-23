import {sameVisitPin, validVisitPin, visitEntryMatches, visitRoutes, visitVersion} from './content-visits.mjs';

const MAX_BYTES = 8192;
const DEADLINE_MS = 3000;

async function readDescriptor(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const bytes = Buffer.alloc(MAX_BYTES);
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) return JSON.parse(bytes.subarray(0, size).toString('utf8'));
      if (size + value.byteLength > MAX_BYTES) return null;
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// Use the actual visitor's Home session and the descriptor that Nexus already
// protects with both table membership and exact artifact access.
export function createGalleryAuthorization(origin, {request = fetch} = {}) {
  const selected = new URL(origin);
  if (selected.protocol !== 'https:' || selected.origin !== origin)
    throw Error('Select the canonical HTTPS Home origin');

  return async (cookie, pin) => {
    if (typeof cookie !== 'string' || !cookie.trim() ||
        Buffer.byteLength(cookie) > MAX_BYTES || /[\u0000-\u001f\u007f]/.test(cookie) ||
        !validVisitPin(pin)) return false;
    try {
      const sourceCookie = cookie.split(';').map(part => part.trim())
        .filter(part => /^(?:__Host-home|nexus_session)=/.test(part)).join('; ');
      if (!sourceCookie) return false;
      const target = new URL(visitRoutes(pin).descriptor, selected);
      const response = await request(target, {
        method: 'GET',
        headers: {Cookie: sourceCookie, Accept: 'application/json'},
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(DEADLINE_MS),
      });
      if (response.status !== 200 || response.redirected) {
        response.body?.cancel().catch(() => {});
        return false;
      }
      const descriptor = await readDescriptor(response);
      const version = visitVersion(pin);
      const kind = version === 2 ? pin.adapter : version === 3 ? 'context' : 'narrated_visual';
      return descriptor?.schema === `dm.holodeck-visit/descriptor-v${version}` &&
        descriptor.kind === kind && sameVisitPin(descriptor.pin, pin) &&
        visitEntryMatches(descriptor.entry, pin);
    } catch {
      return false;
    }
  };
}
