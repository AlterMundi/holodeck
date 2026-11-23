# Walkable workshop and creation controls

The authored place is a spacious floating archipelago: central arrival/meeting,
a west gallery terrace, an east cooperative play garden and the original north
arch destination. The central canopy is removed; broad fixed promenades connect
west/east while the shared bridge remains an actual activity. Rim trees frame
open sightlines. This is an original stylized environment, not a claim of human
acceptance or the long-term world's final scale.

The deployed atelier profile uses editable Blender sources for the commons,
promenades, parcel walk, facade, gardens, galleries, tower and Beacon chamber.
See the [source scenes and export instructions](../art/compaii-house/redesign/README.md).
The older Three.js scenery remains available for rollback and supplies retained
surroundings in the current profile. New visible level art follows the Blender
pipeline. Room remains the semantic authority, and aligned MML surfaces provide
walking collision.

The client uses MML's public renderer factory and ThreeJSWorldRenderer, with its
large default sun disabled and one 1024-square directional shadow map. Inspection
found the upstream sun defaults to an 8192-square shadow map. The selected bounded
light completed software-rendered screenshot checks where the earlier default
attempt timed out; this is not a general mobile FPS benchmark.

The WebGL buffer uses up to 2× display density and at most 2.5 million
pixels. The canvas keeps the same CSS dimensions and camera aspect, so the
HUD, input coordinates and touch controls retain screen resolution. The
pinned MML composer's window resize and the experience client's container
resize both apply the same limit.

A matched Chromium trial at a 390 × 844 CSS viewport and device ratio 3
reduced the world buffer from 1170 × 2532 to 780 × 1688, a 55.6% reduction.
The world used 125 draw calls on the commons and 30 in the foyer in both
runs. These are software-WebGL observations from one loopback pair with
12 consecutive frame intervals per scene.

| Measurement | Previous | Capped |
| --- | ---: | ---: |
| Commons median frame interval | 1,482 ms | 638 ms |
| Foyer median frame interval | 1,880 ms | 862 ms |
| First entrance to movable foyer | 8.04 s | 4.05 s |
| Return to the exterior | 10.09 s | 5.07 s |
| Warm entrance to movable foyer | 4.54 s | 2.42 s |

The route retained the renderer and used the authorized cached template on
re-entry. A 430 × 932 resize kept the 2× backing ratio, and a 1140 × 1100
resize produced 2,498,777 backing pixels within the budget. Separate
movement checks used the actual emulated touch joystick and keyboard W at
their CSS dimensions. The DPR 1 desktop retained its native resolution.
Physical phone and GPU-backed frame pacing remain open.

## Exterior facade shadow finish

At the shared exterior return, the real-time sun cast repeating dark
triangles on the oak gable and limewash panels. A matched Chromium
comparison reproduced them with the authored normal map removed. The
pattern disappeared with either shadow reception or casting disabled
only for the house. The outdoor light surface offset now removes that
self-shadow pattern while keeping the 1024-square shadow map, roof shadow
and building silhouette. In two flat facade regions at the matched
emulated touch pose, the count of pixels at least five luma units darker
than the receive-off comparison fell from 148 and 90 to zero. The
interior light settings use their own controls.

## Controls

- PC: WASD, drag to look, Space to jump. MML owns locomotion/collision.
- Touch: MML virtual joystick and localized Saltar button. The action dock leaves
  these controls unobstructed. Physical phone qualification remains separate.
- Sound: [opt-in workshop ambience and real-state cues](world-audio.md), off by
  default; hidden pages pause and require explicit resume. No synthetic voice.
- Create light: a private local MML preview, color selection, move-here, accept or
  cancel. Accept sends a typed operation to Room; cancellation creates no shared
  entity. A preview is deliberately not part of native shared situation state.
- Undo: reverses the actor's last confirmed bridge/light change only while its run
  and exact target revision still match. It refuses to overwrite later changes.
- Conversation: explicit submit captures exact text and a bounded client-reported
  MML view. The backend attributes that view; displayed/rendered sequence stays
  unknown. Optional [applied geometry evidence](applied-geometry.md) separately
  reports checked workshop meshes, without claiming a presented frame. Actual native progress/answer updates supply the HUD and discussion.
  Native turn availability comes from the receiving adapter; no timer simulates it.

A frozen command recovery copy (4 KiB maximum) is retained in sessionStorage
before a mutation is sent. A current native original, including exact text and its
client-reported view/capture time, has a separate 16 KiB limit. The canonical
native journal remains the owning source once it receives that original. These
browser copies last for the tab session and are removed on confirmed completion.

After a failed/missing response or a reload, **Comprobar** reads the existing ID;
it never submits. A generic 404 never automatically resends anything. Explicit
**Reintentar** uses the same frozen command/ID within the server retry window, or
the retained native retry route. Only a confirmed not-retained/known-not-submitted
native classification permits explicit resubmission of that exact frozen original.
The original text, view and capturedAt do not change during recovery. A different
current actor cannot resend the preserved original. Server time/run/window evidence
classifies expired commands; expiry never claims an old action did not happen.

**Dejar seguimiento** requires an explicit confirmation explaining that it neither
cancels nor undoes the possible action. It preserves the uncertain original in a
closed-tracking archive before allowing another input. This archive has at most
eight entries and 128 KiB per tab session; it does not silently evict unresolved
sources. Deliberately closed native IDs are not automatically reattached as active
turns. Backend work and native history continue independently. No credential or
capability is stored, and preserved original text is hidden after an actor change.

## Receiving evidence, 2026-11-17

A finite isolated Chromium software-WebGL trial loaded the actual local server,
with no JavaScript errors. The character stood on the terrace at y=0.1. Holding
W moved z from 6 to approximately 3.55. Touch emulation enabled before navigation
showed the joystick and Saltar controls; a real CDP touch drag moved z from 6 to
approximately 1.17. The four action buttons fit the 390px viewport. Desktop,
private-preview and touch-enabled mobile screenshots were inspected.

The targeted browser interaction check verified a local MML preview, an accepted
shared light creation, its actual undo (zero remaining active garden entities),
and ordinary composer typing of `w` without MML swallowing the input. Existing
contract tests and browser build passed. The native composer was unavailable in
this local check; it did not submit an artificial human original or claim actual
model participation. Production reload recovery, protected HTTPS, physical
phone/headset use and human play acceptance require their own receiving evidence.

## Recovery regression evidence

A separate finite real-browser regression used a clearly labeled local stable-
identity/native fixture, not an actual native provider. CDP failed each initial
command/native POST before it reached that fixture. Both missing-write cases
survived a page reload without an automatic POST. Explicit retry sent the same
command or exact original text, ID and view/capturedAt; the command then changed
actual Room state and the fixture accepted the native original once. Explicitly
closing a subsequent uncertain command retained its original, did not change the
world and allowed a new deliberate action. No JavaScript errors were observed.
These are client recovery proofs, not native model participation or human acceptance.

The regression is reusable as `node tools/browser-recovery-check.mjs` after a
normal client build and starting an explicitly selected isolated software-WebGL
Chromium with CDP on 127.0.0.1:18943. It serves its own test-only fixture on
127.0.0.1:18944, opens/closes its own target, retains no private originals and
contacts no actual native provider. Three lightweight client-intent tests run
with the normal Node suite.

## Native spatial appearance

The [selected native appearance contract](native-appearance.md) reuses CompAII's
actual Navegante blanco layered model and maintained renderer as a transparent
spatial sprite. It is a native projection, separate from human locomotion, with
bounded authored idle, hidden/reduced-motion pause and a beacon load fallback.

## Contextual controls and feedback

Selections name the current public creation or game, using its canonical title
without exposing internal identifiers. Escape from a focused light-editor control
discards only the private preview; it does not save, undo or change the world.
Conversation drafts and embedded viewer lifecycles retain their existing owners.

Confirmed command success, private-preview cancellation and return-to-world notices
clear after six seconds so they do not indefinitely cover the avatar or scene.
Only these explicitly marked notices expire. Errors, rejected edits, uncertain
operations and recovery controls do not disappear on a general notification timer.
