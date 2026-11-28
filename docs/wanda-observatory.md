# Nix observatory · WANDA read-only slice

Nix's observatory places a camera eyepiece and one observation on a wall.
The two faces use the recorded image axes and a common 4:3 aspect ratio.
The eyepiece shows the selected last capture. The poster uses a derived
240 × 180 JPEG. Both A2UI controls open the identical immutable 640 × 480
original in a contained, full-frame inspection. Closing the inspection
preserves the visitor's place and camera.

The WANDA reference is
[fixed-night-v1 at e0fb9df](https://github.com/AlterMundi/wanda-telescope/tree/e0fb9dfdbca38e841419f1ec58f15277411665cc/fixtures/observations/fixed-night-v1).
It selects `wanda-fixture-01 / wanda-fixture-01-000002` at the scripted UTC
instant `2025-11-28T03:00:01.100Z`, exposure 100 ms and gain 2×. The recorded
origin is top left, with pixels increasing right and down and no mirror.
Sky orientation and calibration are unresolved. This cut selects the
completed still from the WANDA contract. The separate scripted preview
sequence does not indicate an online signal.

## Room and media contract

The server requires an existing room ID, an authenticated identity
resolver and the pinned capture and poster digests. Only an actor
currently admitted to the selected room can load the media or inspect
it. Media use a same-origin JPEG path containing node, capture, digest
and variant. The body is never embedded in A2UI. Room exit ends access
to subsequent reads. No outside URL or hardware endpoint is selected.

| A2UI action | Context | Verified result |
| --- | --- | --- |
| `inspect_eyepiece` | `nodeId`, `captureId`, `revision` | The pinned capture metadata and the original JPEG path |
| `inspect_poster` | `nodeId`, `captureId`, `revision` | The same pinned capture metadata and the original JPEG path |

`revision` is the digest of the immutable WANDA observation manifest.
Read the latest projected state again after a stale action. Inspection
has no effect on node state, capture history or other visitors.

| Projected phase | Evidence needed |
| --- | --- |
| `live` | Online node plus a recent, qualified preview from that same node |
| `exposing` | Online node plus a recent authoritative exposure-in-progress observation |
| `latest` | Completed, immutable capture with its recorded time |
| `offline` | Current node availability is unconfirmed, potentially alongside a separately labelled archived capture |

The freshness policy for this first projection requires a preview or
exposure sample age of 0–5000 ms. Ready flags, a running sequence and the
time of a file download do not certify frame or exposure freshness.
The exact fixture is always presented as simulated. Its scripted
observation time does not become the wall-clock time of the visit.

MML loads the individual same-origin JPEGs as image textures. The
existing HarMoCAP surface can play protected prepared MP4s via a
range relay and Three.js. WANDA's fixture uses JPEGs, so this slice
needs no video feed, player clone or generic relay. A future live preview
can update the same eyepiece through qualified frame and time metadata,
with media retaining the WANDA audience.

## Physical node authority

A future live selection needs the owning receiver's existing Nix room ID
and its surveyed art anchors, one authorized WANDA node and a private
media path which can confirm freshness and audience for that node.
The trial selection is explicitly local and production rejects it.

Physical controls stay at WANDA. A proposed capture action carries an
existing WANDA `node_id`, `request_id`, and an observed state revision;
WANDA resolves its authorized capture settings and returns the completed
capture receipt. An eventual mount action would use an exact node,
operation ID, calibration revision and a bounded typed target accepted
by that node. One Pi remains the writer. Any future mount adapter must
enforce local hardware limits, operating mode, explicit operator
authorization and exact outcome readback before exposing an action.
This slice offers only the two inspection actions.

## Reproduce the local trial

Export the complete fixture directory from the cited WANDA Git revision.
With FFmpeg, write the thumbnail from the selected original into that
temporary directory, then run the tests against the maintained build.

```sh
ffmpeg -nostdin -i "$BUNDLE/media/wanda-fixture-01-000002.jpg" \
  -vf scale=240:180 -frames:v 1 -q:v 4 "$BUNDLE/poster.jpg"
npm run build
node tools/check-wanda-observatory.mjs "$BUNDLE" "$PLAYWRIGHT_ESM"
```

The Chromium trial serves the localhost world with distinct authorized
and foreign identities. It confirms the actual MML images, both A2UI
controls, the full-frame image and scope denial outside the room. It
does not enter or change the shared Holodeck or talk to a physical node.
