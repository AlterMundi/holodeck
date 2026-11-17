# Applied workshop geometry evidence

Holodeck distinguishes authoritative semantic state, delivery, applied client
geometry and actual frame/human perception. The browser now supplies a useful
narrow acknowledgment for the third layer. `displayedSequence` remains null.

## Inspected runtime evidence

The selected installed MML runtime provides public `MElement.getContainer()`,
`TransformableElement.getWorldPosition()/getVisible()/isDisabled()`, model loading
state and `ThreeJSWorldRenderer.render(state)`. Its Three.js implementation applies
primitive dimensions through mesh scale, transforms through Object3D containers
and colors through materials. The client wraps the public renderer method and
checks only after that method actually returns; it does not patch dependency code.

`workshop-projection.mjs` holds the selected authored mapping of bridge and garden
state to primitive IDs/positions/dimensions/colors. The authoritative server's
MML document includes its run, edition, semantic cursor and bounded entity-state
manifest. The client checks the corresponding actual Three objects independently:

- Correct authoritative world document, run/edition/cursor and entity revisions.
- Live entity groups attached to the selected composition scene. A deleted entity
  is separately labeled `not-in-document` when its MML group is absent; this does
  not prove that a former Three object was detached or that pixels disappeared.
- Matching primitive world transforms, mesh scale, material color and opacity.
- Loaded static scenery with nonempty attached geometry. This is not a check of
  the original GLB bytes or immutable dependency publication.

The manifest is at most 16 KiB, with at most 32 workshop entities. A successful
state gets an asynchronous SHA-256 digest; an intervening version/DOM change
invalidates that pending result. The probe checks actual geometry again when an
interaction captures it, so matching DOM labels alone cannot mask a changed mesh.

## Captured contract

Optional `view.appliedGeometry` has schema `holodeck.applied-geometry/v1`:

```text
schema, evidence, scope
run, edition, sequence, manifestSha256
entityCount, entityRefs, omittedEntityRefs
geometryVerifiedAt, geometryCheckedAt, renderCallReturnedAt
```

`entityRefs` is a compact list `[entity_id, revision, "attached" | "not-in-document"]`,
limited to eight entries. All selected workshop entity declarations are checked internally at their
declared scope; live entities get geometry checks, tombstones get only document-
absence checks. The digest covers the complete entity-state manifest. `entityCount`/`omittedEntityRefs`
state explicitly when individual references were omitted to bound the payload.
The digest is SHA-256 of the UTF-8 `data-geometry-state` attribute value after
HTML attribute decoding, before parsing/re-serialization. Full transforms are
not copied into the acknowledgment. The complete original
client view still has its existing 4 KiB bound; if the optional proof would exceed
that bound it is omitted, without inventing a smaller successful proof.

`geometryVerifiedAt` identifies the version check after a renderer call returned;
`geometryCheckedAt` identifies the actual-object recheck at capture;
`renderCallReturnedAt` identifies the latest returned renderer call. They are
client-reported timestamps, not authoritative world time or proof of GPU completion.
The existing native adapter retains the entire view as attributed client evidence,
not an authority grant. Explicit retry preserves this original proof and capture.

The snapshot becomes unavailable after a run/edition/version mismatch, relevant
DOM changes, missing or mismatched geometry, document replacement, context loss,
a hidden document, disposal or more than two seconds without a returned renderer
call. A failed check means unknown, never a fabricated success. There is one
observer/current proof/digest in flight, no retained frame history or model call.

## What this deliberately does not prove

This is **applied scene-graph geometry evidence**, not a presented-frame receipt,
a GPU fence, screenshots, human eyesight/attention/understanding, visibility in a
particular camera, line of sight, occlusion or identical subjective perception.
It does not acknowledge animated human avatars, daimon projection bodies,
lighting/audio, collision acceptance or every semantic event as a visual fact.
Its scope is explicitly the selected workshop entity primitives; a cursor does
not expand that scope. A malicious client could lie, as with other client reports.

The capability lets a situated turn distinguish the entity version applied to
that participant's client from a later server snapshot. It does not authorize
silently translating an older reference into a new entity/run. Server rights,
semantic preconditions and actual world outcomes remain independent.

## Verification

Focused tests use actual Three scene objects and reject mesh scale/color mismatch,
detached objects, unloaded scenery, wrong source, stale revisions, context loss,
old render calls and a delayed digest of a superseded edition. A capture-time
check also rejects graph mutation without a DOM observer notification.

A finite isolated software-WebGL browser trial exercised the actual MML/Three
runtime: initial bridge geometry, changed bridge revision, newly attached garden
entity, removed-entity tombstone (document absence only) and WebGL context loss. The manifest digest
matched the document's actual state. These trials are not human/device acceptance
or native model participation; the owning work record retains exact evidence.

The browser check also froze this proof into an original submitted to a labeled
local native fixture; the complete client view was under 1 KiB in that run, with
`displayedSequence:null`. No actual native provider/session was invoked. The
fixture retained the same run/edition/cursor/digest as the client proof captured
with that input. A real `WEBGL_lose_context` event made subsequent snapshots null.
