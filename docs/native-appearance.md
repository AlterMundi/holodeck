# Selected native spatial appearance

CompAII can select `form: "avatar"` through the existing native projection port.
The verified daimon identity and fixed registry choose the immutable Navegante
blanco appearance. Browser fields, arbitrary URLs and other beings cannot select
CompAII's art. Existing orb/beacon projections remain supported. `position` is the
appearance's feet anchor in world metres, with a 1.6 × 2 metre camera-facing
sprite. It has no new physical collision body or simulated human controller.

This is the original 2D layered/raster rig situated in 3D, not a newly invented
3D body. The public design is the exact selected canonical `ascii-quest-design/v2`
SHA256 pinned in avatar-registry.mjs. It retains the 45-node layered v2 model and
nine authored cues. Only its default authored idle is played here; no speaking,
work, listening or understanding is inferred from an artistic pose. Live speech
and explicit native cue selection are not implemented by this change.

The selected design (153394 bytes) and the existing maintained DaimonApp renderer
closure (99284 bytes, 24 source modules) are bundled once under assets/avatar.
PROVENANCE.json records exact source and output digests; LICENSE retains the MIT
source lineage. No account document, private revision list, voice configuration,
authentication or conversation is exported. Sharing this selected representation
in the existing shared world does not grant access to the original account.

One bounded canvas/texture is owned per admitted spatial marker, at most eight.
Canvas layout is 256 × 320; the maintained renderer caps pixel ratio at two, so
RGBA texture storage is at most 1.25 MiB per instance (10 MiB for eight), without
mipmaps. The registered immutable design is at most 256 KiB and loaded once per
page; the module is cached by the browser. Animation advances no faster than six
frames/second, at most 120 frames per authored loop, with no model/provider calls.
Hidden pages and reduced motion pause frame advancement. Removal, source failure
and disposal release the sprite/material/texture/canvas; page disposal clears
source references. Shared position comes from Room's MML projection.

A beacon remains visible until the actual renderer and texture are ready. Failed
loading leaves the beacon and a plain useful notice; it never silently substitutes
a generic human or another daimon. Asset and design revisions are pinned, and
reload is the explicit retry after failure. Older saved orb/beacon states still
load. An older renderer may show its generic orb for an avatar projection; retain
a compatible runtime/assets for faithful recovery after selecting this form.

The existing geometry acknowledgment covers workshop primitives, not this sprite,
rendered pixels or human eyesight. Avatar test fixtures are not native/human
participation or artistic acceptance.

## Qualification

A finite isolated Chromium trial rendered actual alpha/coloured pixels on two
clients using the exact pinned appearance. Both observed the same controlled
Room projection move from (1.5, .1, -4) to (-1.5, .1, -3). The second loaded with
reduced motion already selected and painted its initial frame; idle remained
paused. Hidden frames stopped, later reduced motion froze the first client, and
page disposal removed owned canvases/objects. Blocking the design request kept
the actual fallback beacon visible and displayed its useful notice. The spatial
screenshot and original renderer canvas were inspected. No JavaScript errors,
real native provider/model turn or human/artistic acceptance was asserted.

## Blender companion

The following companion uses an authored Blender model based on the same selected
Navegante. Its editable scene and generator are under `art/compaii-avatar/`. The
rounded shells and articulated pivots retain the original contours and authored
movement. The atlas uses a pearl palette and preserves the cyan face details.
The generator bakes the nine authored motion clips into an embedded GLB. In
Blender, unmute the corresponding NLA tracks to inspect each alternative pose.

Holodeck plays the original calm loop for the companion. Canonical Conversation
sends its existing bound playback level to the separate jaw pivot, which returns
to rest when the signal stops. The browser check rendered the GLB from the
front, side and back, exercised opening and release with injected playback
levels, and checked reduced motion. This does not qualify spoken phoneme timing
or a full live Conversation turn. Explicit native world markers retain their
existing layered projection and permission checks.
