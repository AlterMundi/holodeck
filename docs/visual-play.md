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

All displays can reduce the world buffer when four consecutive rendered
intervals reach 45 ms. The client skips tiers that cannot reduce the buffer.
Touch displays start at 1×. The lowest tier uses 0.55× and omits the
dynamic shadow pass. Lights, materials, CSS HUD and input coordinates use
their ordinary settings. Drops are at least
1.6 seconds apart. A higher tier needs 120 consecutive intervals at 21 ms or
less and at least 18 seconds since the last change. A resize, transition or
visibility change breaks the timing streak. The renderer, world authority,
geometry and layout continue through changes in quality.

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

### Adaptive touch rendering

A matched loopback Chromium trial on the 390 × 844 view at DPR 3 used
SwiftShader for both runs. The previous 780 × 1688 framebuffer settled
at 390 × 844 with adaptation, a 75% reduction in world pixels. Draw calls
stayed at 124 in the commons and 30 in the foyer. Interval medians used
12–13 consecutive render intervals per room.

| Measurement | Fixed 2× | Adaptive, settled at 1× |
| --- | ---: | ---: |
| First load to grounded avatar and mounted exterior | 9.29 s | 9.09 s |
| Commons median render interval | 732 ms | 275 ms |
| Foyer median render interval | 678 ms | 265 ms |
| First foyer crossing until movement resumed | 4.66 s | 1.69 s |
| Return to the exterior | 4.56 s | 3.06 s |
| Warm foyer crossing until movement resumed | 4.33 s | 1.79 s |

Both runs kept one renderer and used an authorized cached scene on the warm
crossing. The desktop smoke run kept the native DPR 1 buffer at 1100 × 710.
Separate joystick and WASD trials moved the grounded avatar. The
HUD, touch coordinates and actor's room authority used the same CSS and
server checks. The software-rendered numbers qualify this workload.
Physical-phone and GPU-backed frame pacing remain open.

## Cold arrival and locomotion assets

The Home package now serves the five original avatar locomotion clips with
Brotli. It preserves their decoded GLBs, URLs and identity byte ranges. In
fresh desktop Chromium profiles at 6.4 Mb/s and 80 ms added latency, the
encoded animation bodies fell from 959,316 to 268,415 bytes (72.0%).
All measured resource bodies through visible arrival totaled 5.77 MB
before and 5.08 MB after. The clips finished transferring about 1.8 s
earlier, and the commons model about 0.85 s earlier.

Two runs per package measured navigation to an observed WASD displacement.
The previous package took 12.31 and 12.40 s. The compression-only package
took 12.37 and 11.27 s. These SwiftShader runs bound the transfer benefit.
The small sample does not establish a general movement improvement.
Those runs still requested the previous 1.82 MB compressed house facade. Early location and terrain preload experiments were
slower in this fixture and were discarded.

## Progressive exterior arrival

On the first exterior load, the arrival projection supplies the normal
terrain, colliders, signs, viewpoint and semantic objects. The facade and
two garden models are decorative and have separate colliders. The client
asks for the facade first after the avatar is present, then the remaining
models at least 350 ms apart. The ordinary exterior stream keeps all
sources active for an earlier client and for the return from a house. Both
streams project the same world state and pass the same membership and
room checks.

In fresh desktop Chromium with SwiftShader, 6.4 Mb/s and 80 ms latency,
the earlier package reached an observed WASD displacement of at least
15 cm at 11.48 s. The two selected-package runs took 9.87 and 9.50 s.
They showed the avatar at floor height at 6.70 and 6.97 s, compared
with 8.67 s. All three deferred models were confirmed by 10.71 and
11.89 s. The transfer size is unchanged. These runs measure when
the player can start. Physical-device pacing remains separate.

## Spawn on the arrival terrace

The first exterior spawn is 1 mm above the runtime terrace collider top.
The floor projection and the launch height use the same layout constant.
A paired Chromium trace at 6.4 Mb/s with 80 ms latency showed the previous
first rendered avatar at y=0.623 m while it was falling to y=0.100 m.
The new package rendered its first avatar at y=0.100 m. Measured arrival
at floor height was 8.64 s, versus 9.86 and 10.13 s in the baseline runs.
Observed first movement beyond 15 cm stayed near 12 s. The first render
of the full exterior still had a software-rendered frame taking about
1.4 s.

Skipping all draws behind the loading screen let the upstream load
gate finish about 0.4 s earlier, but shifted 4.4–5.0 s of blocking work to
the first visible draw and increased the movement measurement to
13.49–14.02 s. That experiment was discarded. Preserve normal warmup,
auth, collision and spawn gates when testing the next rendering change.
These figures use SwiftShader and the existing protected-route fixture.

## Optimized exterior facade

The Blender facade export kept the full-resolution color atlas with
core glTF JPEG and baked a smaller lossless normal atlas. Its geometry,
material assignments, lettering and threshold coordinates match the
previous export. The exact Brotli response fell from 1,824,932 to
1,089,929 bytes. Player-height Chromium captures inspected the gable,
limestone and glazing from the approach and returned threshold.
The fixture walked the west aisle, entered using E and returned to the
same threshold within the same page.

In a paired 6.4 Mb/s and 80 ms latency trial, the browser received
4.35 MB of resource bodies by visible arrival with the new facade
and 5.08 MB with the previous one. The facade response ended about
1.03 s earlier. Observed first WASD displacement took 12.42 s with
the smaller model and 12.18 s with the previous one. This check establishes
the transfer saving and confirms movement on the new package. Software
render readiness still warrants separate profiling.

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


## Tower resonator walk-up

The Blender resonator's oak sill now has a collision surface at its authored
room dimensions. In the 23 November packaged Chromium comparison, the same
WASD approach stopped at Z 5.450 on the predecessor and Z 4.995 on the new
release. The 0.45 m clearance to the sill face at Z 5.445 matches the avatar
collision radius. The player-height frame shows
the sill in front of the avatar. Retreat and the existing keyboard portal
returned to the gallery arrival at X 4.81, Z −3 in the same session.
This is a desktop Chromium trial of the tower collision and portal.

## Shared outdoor garden on desktop and touch

Two independent Chromium participants moved by WASD and the emulated phone
joystick, then planted through the visible preview and confirm controls. The
phone raised the bridge to finish the garden. Editing the first light to violet
invalidated the result, and restoring mint completed it again. Both views
matched the authenticated native observation and showed the same status and
readable instructions without a reload. The light edits used the authenticated
command path. The phone input was Chromium touch emulation.

## Tower east clerestory

The seven east window bays use the original Blender apertures. The existing
coastal panorama (1536×768, 37,943 bytes) appears behind the windows once
the authorized tower model is mounted. The renderer reuses the decoded sky
from outdoors. The packaged Chromium trial captured a player-height frame
and observed 44 frames through the walk and E-key exit. The gallery kept its
opaque backdrop after crossing, and the authorized Beacon lab also kept its
own backdrop. The tower's model and collisions keep their prior revision.

## Input across the reference card

The exterior reference card passes pointer input through inactive areas.
Its action buttons keep their normal hit targets. In the Chromium fixture
the earlier card intercepted a pointer aimed at a second world object
after a shared indication. With the change, that pointer reached the
canvas and selecting the first object again showed its existing indication.

The emulated phone trial held three contacts for the joystick, camera drag
and jump. It observed movement, rotation and lift together, then settled
after a browser touch cancel. A fresh contact moved the avatar again
without selecting or sharing a world object. This is a touchscreen
emulation result.

## Opening a protected 3D exhibit

The actual Nexus frontend and isolated Home renderer can start a nested
review from the gallery. In the SwiftShader fixture the unchanged world
draw and hidden iframe could leave the inner renderer past its readiness
deadline. The loading cover now conceals the inert frame while allowing
it to render. The world pauses only its drawing submission until the
cover lifts, the opening fails, or the visitor returns to walking.
The room renderer, input guards, authentication and visit lifecycle
remain in the existing session.

An isolated Chromium run used the real Nexus backend, frontend and Home
hydrator with the exact published renderer, gallery JSON and GLB. The
visitor examined the confirmed edition and changed its camera. Returning
kept the same world renderer and position with drawing restored. A separate
gallery-only identity received no exhibit and was refused by the Nexus
artifact handler. Identity and permissions were simulated. The live Home
owner reader separately verified three retained exact snapshots.
Production participant acceptance remains separate.

## Situated Conversation panel

The room topic and return control share the panel header, giving the
canonical thread more of the height. Short portrait displays use the
available viewport with safe-area insets and short landscape displays
use a wider side panel. The host continues to mount the same frame when
the player returns to the world.

With a 1000 × 700 viewport, the predecessor clipped three of the seven
rendered lines in the scripted reply after scrolling it into view. The
candidate showed all its wrapped lines in Chromium at 1000 × 700,
390 × 844, 375 × 667 and 844 × 430. The close control and composer stayed
reachable. An unsent draft survived closing and opening the same frame.
This is viewport emulation and a two-participant fixture.

## The controlled avatar's sightline

The [previous Beacon view](../art/compaii-house/redesign/review/beacon-sightline-before.jpg)
and the [current Beacon view](../art/compaii-house/redesign/review/beacon-sightline-after.jpg)
show the same camera, avatar and door in Chromium. The local nameplate at
the center of the previous view no longer covers the door. The client keeps
the remote username sprite and separate chat bubble sprite.

A packaged browser trial used independent keyboard and touch-emulated
visitor identities. Each rendered the other visitor's visible name and
outfit. The result persisted through entering the same room and reconnecting
one visitor. A fixture call to the renderer drew a local chat bubble at the
avatar. The previous package's longer
reconnect check reached the saved room and timed out while waiting for both
avatar meshes. The candidate passed that check. The fixture drove chat
directly through the renderer.

## Spatial player nameplates

Other players have small rounded nameplates in the world HUD palette.
They remain attached to the avatar and depth-tested against the room, so
geometry can occlude them. The name texture uses a single line no wider
than 300 pixels. If a name exceeds the space, the texture ends it at a
whole grapheme and adds an ellipsis. The authenticated profile retains the
full display name. Nameplates and chat bubbles keep their separate styles
and lifetimes.

The same camera and two separate simulated Chromium identities show
[the previous rectangular label](../art/compaii-house/redesign/review/player-nameplate-before.jpg)
and [the compact label](../art/compaii-house/redesign/review/player-nameplate-after.jpg).
The checked long name used 278 × 46 pixels after the change, compared with
743 × 76 before. Both clients drew the other player's label again in the
same interior and after one reconnect. Keep the label's close-range role
in mind. Readability at greater distances and on a physical phone remains
unverified.

## Entering a room on a slow device

A marked authorized room exit now has a dismissible direction and distance
while the map is closed. The arrow follows the camera. At the doorway the
existing travel action takes over. An access loss or room transition clears
the local selection. [Player-height direction to the portal](../art/compaii-house/redesign/review/guided-sensorial-door.jpg).

The room transition remains over the scene until the receiving scope and
primary model are ready. Chromium held the protected room model response,
verified that the canvas remained hidden, then released it and crossed in
the same renderer. [Passage during the delay](../art/compaii-house/redesign/review/passage-while-room-loads.jpg).

The entry shell also covers initial setup. It makes an unsuccessful initial
location request retryable, and shows an explicit retry if the module or
scene takes longer. Touch Chromium without the optional nameplate APIs
showed Retry after a blocked location request and entered on an explicit tap.
The actual phone's failure cause is still unconfirmed.

### Avatar loading with limited worker support

The assigned avatar is independent of optional worker texture processing.
When the processor fails or reaches its deadline, the client uses the existing
model loader for the same packaged GLB. The bundled low-detail rig can use
the same recovery path. A failed worker releases its pending jobs and timers.
The renderer still resolves the authenticated profile and appearance through
the existing world session. This recovery uses the browser's ordinary GLB
and Draco support.

In a 390 × 844 emulated touch viewport, both the healthy processor and four
fault cases reached a skinned, textured copy of the assigned avatar. An
immediate error, unavailable OffscreenCanvas or a rejected texture worker
constructor took 1.1 to 1.4 seconds after the first player pose. An intentionally
silent processor took 20.6 seconds in the same fixture. These are loopback
software-renderer timings.

### Lightweight graphics at entry

The startup screen offers **Entrar con gráficos livianos**. The
[lightweight entrance](https://compaii.dmn.homes/holodeck/?graficos=livianos)
allocates the 0.55× world buffer immediately, with a non-multisampled WebGL
context and dynamic shadows disabled. The controls retain their CSS size.
The selection stays in the URL across room passages and entry retries.
The standard entrance uses automatic quality.

In touch Chromium, the 390 × 844 controls stayed at CSS size while the
actual world buffer was 214 × 464. The joystick moved the avatar by more
than one meter. The desktop fixture kept antialiasing in automatic mode
and moved with WASD. A separate captured portal trial retained the lighter
WebGL context through entry and return. A failed initial location lookup
recovered on touch retry without losing the selected quality.
