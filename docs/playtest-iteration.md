# Holodeck playtest iteration

## Starting point

The receiving build `f46d93f436be` (source `f975275`, rollback `2563afe48a8d`) has the toroidal world, one house, wall and roof collision, continuous yaw, sensitivity, double-Space radial flight, a minimap, partial A2UI Matter tools, and canonical web Conversation with a movable, resizable Three.js frame and animated minimize. The pre-change tests reported 296 passes and two skips. Browser checks covered flight, yaw, sensitivity, minimap, Conversation geometry and draft continuity. Those checks do not establish participant or device acceptance for this iteration.

Playtest 285b1415 and its amendments identified soft Three.js text and overlapping controls, requested physical inspection at the worktable and refined Conversation and world controls. Collision request 789201db is part of the regression baseline.

## Reviewed design

Claude Code resolved `fable` to `claude-fable-5-2` and returned three successful reviews at high effort. The first read the implementation. Two initial follow-ups evaluated the expanded HUD scope and the final Three.js presentation requirement. Adopt the independent HUD backing buffer, device-pixel text density, one layout owner, gesture-local browser operations, an exhaustive surface inventory, stable iframe mount, size checks per slice, and one camera mode dispatcher. The user selected Three.js for visible native UI. Generate accessible DOM semantics and native input bridges from the same A2UI state. Deliberately embedded web content retains its web rendering. A loss of all WebGL presentation must remain an explicit release test and reported gap if unresolved.

The receiving bundle has 110,592 bytes available before its 32 MiB cap. Measure the release artifact at each slice. Build candidates using the tracked art from the selected baseline and exclude independent Blender edits.

## Visual direction

Use the [Space Engineers HUD](https://www.spaceengineersgame.com/space-engineers-update-01-179-0-major-new-hud-and-ui/) as an industrial sci-fi reference for compact instrument grouping and visibility over a busy scene. Holodeck's design uses its own shapes, typography and room-driven accents. Keep labels direct, with the same placement and role in each style. Give controls a neutral high-contrast base and use the room accent for focus, selection and progress.

## Closure review

Before closing each deliverable, review its actual implementation with Claude Code Opus 5.5 at high effort, act on actionable findings and rerun the affected receiving checks. Record the result and any concrete blocker.

## Delivery order

1. [Holodeck #16](https://github.com/AlterMundi/holodeck/issues/16) owns an independent Three.js HUD layer with CSS-pixel layout, resolution from device pixels and bounded density. [Proyección #5](https://github.com/AlterMundi/proyeccion/issues/5) owns reusable text raster size, placement, focus, input and catalog behavior. Prove the bottom toolbelt with Conversar, minimap and Matter entry. Compare sharpness to a browser reference at fractional and integer DPR with both graphics presets, test touch reach and pointer lock, and measure startup and frame times against the same device baseline.
2. [Holodeck #18](https://github.com/AlterMundi/holodeck/issues/18) owns the A2UI window system and the native Conversation surround, navigation, minimize, restore and resize. Keep the canonical iframe mounted, share one placement and animation clock, and preserve exact piece context, draft, history, device grants and session. Let Conversation and Matter coexist. [DaimonApp #1022](https://github.com/AlterMundi/DaimonApp/issues/1022) owns the A2UI projection of Conversation internals in the following iteration.
3. [Holodeck #17](https://github.com/AlterMundi/holodeck/issues/17) owns the client-local Matter inspection camera. Snapshot locomotion and camera on entry, use a first-person pose plus bounded orbit, view-plane pan/height, tilt and cursor-anchored physical dolly. Touch pinch uses its centroid. Reuse the room collision/near-plane path and keep explicit part rotation separate. Verify restoration on exit, passage, disconnect and revocation.
4. Cut over all native surfaces by reachable state. Inventory entry and retry, passage/recovery, title and wayfinding, toolbelt and minimap, touch movement, Appearance/video, Matter shelves/archive/table, Conversation shell, Beacon, creation and editing, activity and exhibition, visit navigation, runtime notifications and generated results controls. For each record its state writer, A2UI component, action and test fixture. Give each deliberate web embed an owner and purpose. Detect interactive visible legacy controls with fixture coverage as each surface migrates.
5. Qualify authoritative, bidirectional state/actions, desktop and touch, normal/lightweight performance, two visitors including read-only and revocation, and native/browser boundary cases. Recheck the published torus, cave, house, wall and roof, flight and yaw, rollback, and actual served package. Record participant acceptance separately.

[The shared roadmap](shared-roadmap.md) owns the subsequent Wiggle/camera, activity timeline, work-state replay and avatar work. Holodeck issues #3, #12 and #1 remain the parent experience, house integration and situated Conversation records.

## Multiscale materials and lighting

[Holodeck #20](https://github.com/AlterMundi/holodeck/issues/20) tracks the receiving work. Modern engines layer detail maps and world-aligned sampling, and recommend baking expensive procedural graphs when the result permits it. Randomized tiling is applicable to isotropic signals whose contrast needs to survive a blend. View-dependent stochastic filtering has a different purpose and requires temporal stability the lightweight client cannot assume.

- [Epic detail and world-aligned texturing](https://dev.epicgames.com/documentation/en-us/unreal-engine/texturing-material-functions-in-unreal-engine)
- [Epic utility materials and baking guidance](https://dev.epicgames.com/documentation/en-us/unreal-engine/utility-material-expressions-in-unreal-engine)
- [Deliot, Heitz and Neyret histogram-preserving texture synthesis](https://unity-grenoble.github.io/website/demo/2020/10/16/demo-histogram-preserving-blend-synthesis.html)
- [NVIDIA filtering after shading](https://research.nvidia.com/labs/rtr/publication/pharr2024stochtex/stochtex.pdf)

A focused Claude Code Fable 5.2 High review completed before this implementation. It located the repeated signal in the periodic one-metre detail layer, warned about mip bleed across material-role tiles and about destroying directional grain, and recommended testing decorrelated fine and room-scale domains without additional shipped maps before heavier stochastic synthesis. The first candidate keeps the baked room irradiance, baked structural seams and specular response. It unpacks the existing five grayscale tile cores into an isolated mipmapped texture-array layer per role. Gradient-aware samples add independent fine and coarse variation inside the prior modulation amplitude, with the steel grain direction retained. The existing floor reflection and other appearance variants use their existing paths. Start validation with matched Orbital layered floor, deck and wall/shelf views in normal and lightweight, and measure identical camera motion on each client. Evaluate pattern recurrence and visible silhouette, highlight and contact lighting before proposing the selected look. Claude Code Opus 5.5 High reviewed the actual material diff. It identified cross-grain in the coarse steel band, mid-distance contrast loss and implicit anisotropy changes. The correction keeps both steel bands axis-aligned, restores primary detail weight and preserves the source anisotropy. Runtime canvas readback and projected normal boundaries remain explicit portability checks. The corrected package `1fd0283a0c64` at `d3c42bf` was 33,454,080 bytes, 100,352 bytes under the cap. The exact package rendered Orbital Layered in both modes without a shader error in controlled Chromium. Three paired camera positions and a moving sequence ran in both modes. Software-rendered p95 rose from 349.9 to 383.3 ms in normal mode and from 216.6 to 233.3 ms in lightweight. These are fixture measurements, not hardware frame times. A baseline re-run with the same toolbelt measured software p95 of 333.3 ms in normal and 250 ms in lightweight, against 383.3 and 233.3 ms for the reviewed layered candidate. The mixed result and software timing variance leave the shader budget unresolved on the actual GPU. The benchmark and the visual quality bar remain open before promoting a material. Current live digest readback is still `f46d93f436be`.

The material-gradient follow-up differentiates continuous world position
before choosing the material role or projection plane. At a boundary, a
fragment quad formerly differenced different role scales and could request
a coarser mip. The transformed vector gradients still drive anisotropic
filtering. Uniform rotation and scale reuse one scalar texel footprint for
the band fade. Fable High reviewed both operations and recommended holding
camera and drawing-buffer size constant in comparisons. Opus 5.5 High found
one missing argument in the coarse band. The corrected source passes all
331 active tests, with two existing skips. GLSL compilation was rechecked in
Chromium because source assertions alone cannot prove linking.

The corrected archive `115bb0bf6617` is 33,536,000 bytes. In a first
same-buffer normal-mode SwiftShader sweep, baseline and candidate both
measured 350 ms frame p95 at 268,620 pixels and 38 median draw calls.
Software timer-query p95 was 224.8 versus 245.9 ms. Lightweight at the same
buffer measured 250.0 versus 266.7 ms frame p95 and 142.8 versus 159.2 ms
software timer-query p95. Both lightweight medians were 133.3 ms.
There is no measured performance gain. Use an actual hardware adapter
and a matched run before
promoting this material correction. ITACA exposes SwiftShader and no DRM
graphics device. The comparison therefore records the browser renderer,
WebGL identity, device and render pixel ratios, drawing-buffer area and
draw/triangle counts, and checks whether GPU timer samples are disjoint.
Static comparison now verifies the actual Three.js render camera before
each shot. The earlier close-deck fixture aimed the player orbit camera
above the avatar and produced ceiling shots. The corrected fixture aims at
the floor and shelves explicitly. The three matched lightweight crops
retain SSIM 0.999974 or higher. That is an appearance continuity check and
does not measure seam frequency or prove a physical frame budget.
Normal-mode captures were repeated after the adaptive renderer reached the
same 660 × 407 buffer with extra shadows off on both builds. Floor and deck
crops measured SSIM above 0.99999. The wider shelf crop was 0.96867. Two
static wall and frame crops within it reached 0.99999 or better. Exact
browser captures in both modes reported zero shader errors. Higher
hardware tiers and human visual acceptance remain open.

## Situated Conversation context

[Holodeck #19](https://github.com/AlterMundi/holodeck/issues/19) tracks the semantic projection and baseline policy. The current site bridge retains machine provenance as one immutable file.
The canonical text writer allows text, files and existing presentation
references; its allowlist has no application context receipt. The current
world-action bridge validates the exact file against native admission.
The smaller transport therefore needs a supported canonical association
alongside the existing per-input file route during compatibility rollout. The focused high-effort Fable 5.2 review finished after the broader source-reading review timed out. It identified the distinction between prepared and acknowledged baselines, pose jitter, cumulative deltas, and separate per-input admission. Use the existing canonical receipt authority. Scope the baseline to the writer generation, actor, being, continuing Conversation and authorized world scope. Compare stable room, selection, coarse pose and work state independently of timestamps and request IDs. Acknowledge by retained canonical acceptance and confirmed baseline installation. Reuse exact frozen decisions on retry and require a fresh full snapshot after baseline loss. Enable delta and attachment omission in stages on an explicitly verified compatible receiving path. Treat unchanged, absent context and failed preparation as distinct results and always verify fresh access for a native action.

## Qualification in progress

Source `c82ebfb` introduces a separate transparent Three.js framebuffer for Matter A2UI and positions the entry affordance above the bottom strip and touch controls. The clean-source candidate `649618566fe5` was 33,443,840 bytes, the same archived size as the receiving baseline. The final source builds with 296 passing tests and two skips. Separate controlled desktop and touch sessions opened the table through actual pointer gestures at DPR 1.5 on this exact candidate. The test asserted a native-size HUD backing buffer while the world ran at reduced resolution. A broader on-host two-session trial did not complete, so this evidence covers individual entry and backing resolution only.

The next toolbelt change makes the minimized Conversation and minimap actions and contextual Matter entry part of one bottom A2UI surface. The hidden legacy action handlers still own routing until their panels migrate. Claude Code confirmed `claude-opus-5-5` and returned a high-effort critique of the actual diff. Its findings drove touch-size layout, safe-area wrapping, focus restoration, separation of worktable and Conversation input, and a valid minimize target. A second focused review timed out. After corrections, controlled Chromium passed desktop and touch Matter entry, the minimap action, keyboard focus restoration, and the Conversation fixture's target, drag/resize, minimize/reopen and draft preservation. These checks do not cover every safe-area device, simultaneous visitors, or the Raspberry Pi performance budget.

The captured toolbelt still compresses text horizontally in narrow controls at 1.5 DPR. The receiving evidence and requested reusable capability were posted to Proyección #5. [Proyección PR #6](https://github.com/AlterMundi/proyeccion/pull/6), merged with passing CI, supplies opt-in raster dimensions, measured ellipsis and bounded density for screen-space single-line labels. Opus 5.5 High reviewed the actual change. The correction preserves choice suffixes, the complete accessible label and the currently open menu through density changes, and bounds the raster area. All 16 spatial HUD browser tests passed. The Holodeck candidate pins the reviewed source and uses the layer's actual display ratio for its toolbelt and Matter controls. Multiline and field labels remain to migrate. Continue with density-aware lettering and the native surface cutovers. The legacy world composer still has native HTML. Measure text, frame-time cost and context recovery. Complete desktop/Pi and multi-visitor checks on the selected package before switching the protected release.

## Conversation window qualification

The canonical Conversation iframe stays mounted in a moveable window. The
shared high-density Three.js compositor now renders the frame and A2UI
header, topic navigation, reference removal and resize affordance. The
hidden native buttons and select continue to route the existing Holodeck
actions. Reference removal compares the exact rendered source revision.
The actual shell folds into and restores from the contextual toolbelt.
Restore reveals the same iframe; the motion ends independently of the world
render loop if rendering stops. The window has invisible native pointer and
keyboard grips for drag and resize. The legacy composer remains in scope for
a later native-surface cutover in this iteration.

Opus 5.5 High reviewed the implementation. Its actionable findings led to
independent reference commands, preserved keyboard focus, disabled-topic
handling, usability at short window heights and a bounded animation cleanup.
The browser fixture exposed depth clipping from scaling mesh thickness with
CSS pixel dimensions. The correction preserves catalog depth while sizing the
window in screen pixels. Controlled desktop and touchscreen runs verified drag,
resize, a rendered minimize action, restore, stable iframe and draft, and
viewport clamping. The same tests passed on exact archive `775be6260aa8`
from `e8362e3` (33,454,080 bytes). Hardware and live receiving checks
remain open.

## Map qualification

The toolbelt opens a native Three.js A2UI map for the toroidal exterior or
interior, with painted terrain or projected door/player marks, destination
paging, close/focus restoration and the existing checked return route. The
host keeps the same room-travel authority and validates a drawn destination
against the current scope and exact location. The previous browser map
remains a layout/state adapter and a compatibility presentation outside the
mounted HUD. The bearing badge after the map closes remains in the native
surface inventory.

Opus 5.5 High reviewed the implemented map in the focused run. It identified
a retained raster that could reopen stale and a stale/default heading at a
scope change. The corrections preserve a fresh raster even while the HUD is
suppressed, clear the old viewer and wait for known orientation. Tests cover
stale destination and room events, busy exit and hidden raster painting.
The source suite reported 305 passing tests and two skips. Exact archive
`5f8f9ab14f38` from `3cb6bb4` remained 33,454,080 bytes; controlled Chromium
verified exterior terrain and mesh close, interior destination selection by
keyboard semantics and touch, and launcher focus on exit. The exterior
run also verified sensitivity, pointer lock, continuous yaw and radial flight.
The installed digest remains `f46d93f436be`.

## Matter inspection qualification

The Matter tool enters a local eye-height camera around the worktable. Wheel or
pinch translate toward the selected world point at constant FOV. Right drag
or touch drag orbits, middle or Shift drag pans, Alt drag or arrows tilt, and
WASD plus Q/E translate and change height. Input continues to use the normal
A2UI action path for part rotation and confirmed Collection changes. The
inspection uses the scene collision queries and restores the prior camera
and movement input on exit. Scope also closes on room/permission loss,
opaque visit, conversation or a blocking dialog.

Claude Code Opus 5.5 High reviewed the actual inspection diff. Changes after
review keep the cursor anchor through a pinch, bound dolly speed without
reversing near a surface, align the orbit pivot after off-axis zoom, test
clearance for the near-plane corners and release owned pointer/key capture.
The exact archive `6d064eee1e76` at `a3f0abc` was 33,454,080 bytes.
Receiving Chromium passed eye-height entry, physical mouse-wheel dolly,
independent orbit, prior camera restoration, touch drag and two-finger camera
travel. The same package passed canonical Conversation draft/geometry,
the A2UI minimap, mouse sensitivity, pointer lock, continuous yaw, flight,
wall and ceiling collision, and cave headroom. The source suite reported
300 passes and two skips. The subsequent concise entry label passed its
touch check. The candidate still needs live multi-visitor and hardware
receiving checks.

## Native surface inventory

| Surface | Current presentation and behavior to preserve | Authority and receiving fixture |
| --- | --- | --- |
| Entry, passage and recovery | Entry status and graphics/retry; room-passage retry; generated retained-intervention cards and their inspect/retry/close actions | Entry and routing controller, exact canonical receipts. Force startup timeout, blocked passage and uncertain original. |
| Place and movement | Room title, direction, door/return, world/room map and generated destination controls; help and touch joystick | World scope and local placement. Exercise walking from exterior to Matter and return with keyboard and touch. |
| Toolbelt and video | Dock (map, talk, context tools), video quality, sensitivity, fullscreen, sound, transient notices | Local device settings, synchronous user gestures for fullscreen, audio unlock and capture. Verify safe areas and hotkeys. |
| Appearance | Room style selection and author appearance form | Local style and canonical authorized appearance save. Verify theme changes on native HUD and identity-specific mutations. |
| Matter | Generated shelf rows and reviews, archive carousel/actions, available/active bench modes, worktable status and input | Collection catalog and worktable actions; local selection, pose and inspect state. Verify owner/read-only/revoked actors, revisions, follow and room exit. |
| Conversation shell | Persistent launcher, move/resize/minimize, room/topic/reference controls and status from the embed. The legacy native composer and recovery affordances are owned native UI wherever reachable. | Canonical Conversation, local window geometry. Verify exact selected part, draft, device permission and session across display operations. |
| Creation and editing | Point and discuss, preview and confirm supported world creations, and inspect exact revisions. Light planting and signal gardens are retired playtest surfaces. | World, layout and exhibit commands. Verify local draft, validated publish, owner access and another player's observed result. |
| Activity, exhibition and visits | History filters/paging/revisions, generated exhibit entries, generated visit selector and navigation, pointing and discussion actions | Shared world/activity and original result owner. Verify exact selected result identity, independent session layout, and no private result leaks across visitors. |
| Beacon | In-world affordance, surrounding launch/status/close controls; authorized Harmonic Lab iframe payload when selected | Beacon owner and existing authorized route. Exercise opening and exiting within the room and preserve authorization. |
| Embedded content | Canonical Conversation, deliberately visited Nexus content and the existing Harmonic Lab payload retain the content app renderer. All frames, navigation and host actions belong to Holodeck. | Verify origin, stable mounts where needed, native shell and browser-owned device prompts. |


## Situated context implementation

The Holodeck host and [DaimonApp #1031](https://github.com/AlterMundi/DaimonApp/pull/1031)
now have a browser candidate for independently retained machine receipts.
They negotiate through the existing authorized frame, freeze the choice
per original, and leave the legacy attachment path inspectable across
rollback. The journal-mode ledger stays separate, so an older Holodeck
release can still reopen its own records. A machine receipt remains
distinct from a grant to perform a world action. Fable 5.2 High confirmed
the channel negotiation, reservation retry, and compatibility path.
Opus 5.5 High identified a
same-channel animation reset regression. The corrected host emits silence
on a fresh ready announcement while preserving the negotiated mode.

The real iframe tests with controlled IO exercised both transport modes at
desktop and narrow widths, eight human text attachments, a separate
ordinary voice receipt and uncertain text acknowledgments. An edited
dictation recovered its original UUID and receipt from local storage and
sent only edited text with the two existing evidence files. Existing legacy
bytes remained readable in a separate-host rollback fixture.

The receiving draft now allocates a durable reservation order in the same
SQLite transaction as each new machine receipt. Native text may arrive
before an older recording without changing either receipt's order. Exact
retries keep the number, and upgrades preserve legacy receipts without
assigning them a synthetic order. Fable 5.2 High distinguished reservation
order, world event order and native admission. Opus 5.5 High confirmed the
atomicity and prompted the uniqueness constraint, retry/failure tests and
a compatibility migration fixture. A recreated reservation after expiry
or a restored journal cannot prove the age of the original observation.

The candidate receiver now distinguishes a full snapshot, an unchanged
capture and a delta in the direct native request. It advances the baseline
only on the matching native acceptance. A restart, observed compaction or
unprovable acceptance invalidates the selected baseline without discarding
the reservation floor. An older accepted capture cannot move the latest
baseline back. Routed native tasks keep their full source. Fable 5.2 High
and Opus 5.5 High identified the concurrency, loss and stale-full cases.
The candidate binds the exact payload at admission and marks every delta
against its original. In the controlled native qualification, ordinary
voice and text both preserve their own proof with no context attachment.

The receiving draft now anchors the expiry of new situated reservations
to the Holodeck server capture time. A separate durable clock floor prevents
a swept observation from acquiring a later order after a clock rollback.
Legacy receipts remain readable. Only capture-anchored receipts can
contribute to the native baseline. Opus 5.5 High identified a downgrade
incompatibility in the initial schema change. The final layout preserves
the old two-column order clock and keeps the expiry floor separately.
The previous writer's expiry deletion also retains a capture-anchored
deadline. Confirmed sources continue to read across expiry and restart.

DaimonApp [PR #1031](https://github.com/AlterMundi/DaimonApp/pull/1031)
now includes the owner-local archive (candidate `5bef7f94`). The journal
verifies native acceptance and the exact digest before assigning the
receipt to a separate bounded archive budget. The original bytes,
receipt and digest stay readable in the same private database. Capacity
recovery and a new reservation commit together. Fable 5.2 High reviewed
the design. Opus 5.5 High reviewed the implementation and identified the
capacity errors that remain possible when a binding has no eligible
receipt or its oldest receipt fails verification. The controlled
qualification passed 20 focused tests and the real HTTP and owner
command fixture. A later native input reused the archived baseline.
The selected service still uses the legacy route. Qualification and
activation of the compatible live browser, provider and owner pair
remain open.

The receiving candidate now includes current DaimonApp master `fb5875b8`.
The real Holodeck bridge, canonical HTTP writer, private journal and
isolated native peer exercised full source, unchanged reuse, a pose delta,
archive readback, routed full source and reestablishment after baseline
loss. Separate Chromium checks exercised both receipt and file protocols
in the cross-origin Conversation frame at 1280 and 375 CSS pixels. The
current paired Gateway executable, run in isolated fixture mode, rejects
an unknown receipt and accepts a separate legacy original. None of these
checks changes the production selection.

The current paired bridge has its owned world binding and keeps machine
receipts disabled. Select a compatible native writer and dashboard while
the bridge still advertises the file protocol. Preserve the dashboard's
selected overlay, actor binding and existing native state. Enable the
receipt advertisement only on a verified compatible pair. To roll back,
disable its advertisement first, then restore the dashboard and native
writer while preserving accepted originals and journals. A stale client
with a receipt must recover its exact original through a compatible
receiver. The prior writer refuses unknown receipt fields. It cannot
interpret or retry a journal-backed original as a new legacy capture.

Fable 5.2 High requested explicit receiving refusals. Opus 5.5 High
reviewed those cases and the resulting voice storage guard. The HTTP
test exposed clip staging before the native writer rejected an invalid
receipt. The dashboard now validates the receipt before staging media.
Swapped, wrong-binding and expired proofs leave no new original, native
packet or ASR request. A retained recording can retry its exact receipt,
including after the original reservation deadline. A different receipt for
the same recording does not stage audio. These checks passed with the real
bridge and the candidate in DaimonApp [PR #1031](https://github.com/AlterMundi/DaimonApp/pull/1031).

The optimized receiving artifact is built from `e9af42f3` with locked
all-features dependencies and SHA-256
`e2aeaafed1db0ad5432529cc3032ef7b1169556190bbaf434d0ab4bfa9cb581f`.
The HTTP and bridge fixture passed against those exact bytes. A separate
dedicated Gateway test selected those bytes with the same restored fixture
binding and Telegram disabled. An isolated two-version fixture reattached
active, paused and blocked native work from the current predecessor to this
candidate without a new turn, goal mutation or journal replay. The paired
production Gateway still has an active native session. Its live collector
handoff remains open.

The selected Home Interaction reverse-proxy route was read from the serving
Caddy configuration and exercised in a loopback copy with a disposable
upstream. It preserved the exact `X-Machine-Source` value, request body and
Interaction prefix and stripped a spoofed actor header. The live HTTPS voice
route refused an anonymous request with HTTP 403. Authenticated ingress and
receipt readback through the selected Home and Gateway pair remain open.

The Telecodex receiver check found four active physical turns with journal
correlation. It also found that the master-based candidate lacks installed
Nexus owner commands and `owner-action`. The installed profile has Nexus
configured. The exact receiving branch is `receiving/itaca-claude-private-foreground`
at `78fa4109`. A read-only merge preflight found real conflicts in the native
and web paths. Compose the receipt delta over the effective receiving source
and each selected web overlay. Recheck the preserved owner commands and
current profile before selector changes. The previously qualified candidate
remains useful isolated evidence and was left unselected.

The original Holodeck codec prototype defined a planner and reducer for full,
delta and unchanged situations. The projection keeps distinct object, station,
visit and piece selections, coarse client-reported position and a bounded
summary of canonical work events. Capture timestamps, connection identifiers
and derived work cursors are excluded from comparison. A receiver-selected lane
scopes baselines to the current actor, being, world, room and writer generation.
At that stage, only the codec contract and the full-attachment transport had
been exercised. The current receiving evidence is recorded above.

Claude Code Opus 5.5 High reviewed the code twice. The corrections add monotonic
receiving order and a retained order floor, keep full recovery from the exact
frozen projection, preserve unavailable collections and distinguish workstation
selection. Six tests cover unchanged transport noise, pose, work and selection
changes, event sanitization, bounded history, scope and generation isolation,
out-of-order delivery and recovery after losing the baseline. The tests exercise
the codec. Live zero-attachment delivery is still open under
[Holodeck #19](https://github.com/AlterMundi/holodeck/issues/19).

A later Fable High review found that a voice capture could arrive after a newer
text had installed its context. The source planner and reducer now allow the
earlier original's authorized frozen full projection without moving the
baseline back. An exact installed packet recovers its acknowledgment. Opus
5.5 High identified the late delta case, contradictory envelope fields and
malformed but correctly hashed state; the corrections request the saved full
packet for that exact original and reject malformed inputs before install.
The receiving contract identifies the shared text/voice retention transaction.
The deployed Conversation still selects the established full-file path.
The draft receiving implementation uses separate receipt and checkpoint proofs.

## Video and Appearance HUD

The shared-world toolbelt presents Video and Appearance as Three.js A2UI
panels. Both use the existing preference writers. Graphics mode and mouse
sensitivity remain client-local, avatar selection uses the paired Home
session, and Matter finishes affect the local view. Fullscreen is invoked
synchronously from the control gesture. Settings own their keyboard focus
and canvas input while open. A denied fullscreen request during Conversation
leaves the draft and display open.

Opus 5.5 High reviewed the implementation in two passes. The changes distinguish
native panels from fallback browser dialogs, keep gestures and focus inside the
visible settings surface, restore the launcher after close, and prevent a
fullscreen failure from taking over an open Conversation. Notices are laid out
above the shared toolbelt, including when it wraps to a second row. The legacy
client path for standalone interiors still uses the browser settings adapter.
The shared-world source is `c208f49`.

Exact archive `17f4ea5c7a28` is 33,464,320 bytes, 90,112 bytes below the
32 MiB ceiling. Controlled Chromium verified keyboard focus containment and
restoration, resolution mode and sensitivity changes, the mesh fullscreen
action on desktop, and a tap on the mesh close control on touch. A forced
fullscreen denial preserved the open Conversation. A second authenticated
fixture visitor retained a separate avatar preference. The Matter room's
selected style applied through the native panel and restyled the HUD.
The source suite passed 311 checks with two skips. The protected service
still selects `f46d93f436be`. Device and live acceptance remain open.

## Marked exit bearing

Closing the interior minimap leaves a Three.js A2UI bearing for its selected
exit. It displays the camera-relative heading and rounded distance, hides
inside the matching threshold or while operating Matter, and clears the exact
selection from its own control. The dismissal is scoped to the current map,
room and selection. Closing the bearing returns focus to the minimap launcher.

Opus 5.5 High identified that suppressing the legacy aid whenever the toolbelt
mounted could leave neither presentation visible after a failed HUD render.
The correction ties the legacy suppression to actual native bounds and keeps
modal and worktable suppression explicit. A second Opus 5.5 High pass prompted
clearing presentation on render and context failure, holding the browser
fallback at very narrow widths, carrying focus into the HUD when it replaces
the fallback, and invalidating actions when the target changes. Unit tests
cover heading changes, reaching the threshold and stale or mismatched
dismissals. Archive `a5e37c15bcb1` of `fff2fca` is 33,464,320 bytes. Controlled Chromium verified
the selected exit, visible bearing, rounded distance, mesh dismissal by mouse
and touch, cleared navigation, and return focus in the exact package. A real
WebGL overlay context loss released legacy suppression and the bearing was
then redrawn and dismissed through the world canvas. This test lost the
overlay context only. The source suite passed 312 tests, with two skips.
Live remains `f46d93f436be`.

## Physical doorway prompt

The live-world HUD uses the existing proximity-scoped passage controller
for its doorway button and the E shortcut. Door offers carry the current
space and a distinct revision. The owner checks that offer again after the
visit gate and requests the same native passage API as the browser fallback.
The touch button sits above the joystick and jump zones.

Two Opus 5.5 High reviews identified window and input races. The corrections
recheck open overlays before travel, transfer focus when the HUD returns to
the fallback, and reject a press if the offered door changed. In the native
HUD, creating a new control for a new offer also invalidates the in-flight
pointer target. The qualification checks captured the server's exact move
responses for Matter → exterior by mesh and exterior → Matter by E.

Archive `f722fd13a1eb` at `6d12af3` is 33,464,320 bytes. Exact-package
Chromium confirmed the request and resulting room in both directions.
Desktop used mouse and E in both normal and lightweight graphics. The
touchscreen fixture crossed both directions by tap in lightweight. The
suite passed 313 tests with two skips, including stale proximity, overlay,
held Space and stale pointer regressions. Live remains `f46d93f436be`.

## Matter collection HUD

The shelf uses the current project and edition references to select an
edition, open the canonical 3D Viewer or place it on the worktable. The
archive uses the same rotating catalog and authorized return writer as before.
Both panels are Three.js A2UI surfaces and use the active room palette.
The mounted HUD takes over from the browser controls after a successful draw.
Distance, the map, settings and worktable operation govern availability.

Two Opus 5.5 High reviews identified focus handoff, blocked Viewer popup
feedback and archive status races. The corrections keep feedback attached to
the selected edition, pause paging during a restore and keep the keyboard
on a reachable control as the catalog changes. The Viewer opens the selected
version with its opener cleared. Stale edition and room actions are rejected.

Exact archive `dec1a4c04be4` at `e0ff3b5` is 33,464,320 bytes. Controlled
Chromium verified mouse and touch activation for the canonical versioned
Viewer, placing a shelf edition on the worktable, paging in the archive and
returning the exact archived edition to the shelf (HTTP 204 and a fresh
catalog read). A second authenticated fixture visitor could open the archive
but did not receive its restore control. The suite passed 314 tests with two
skips. The protected service still selects `f46d93f436be`.

## Place, notices and sound

The main world draws the room heading, location details and status in a
Three.js A2UI header, and draws notices above the contextual toolbelt.
Heading and live announcement semantics remain in the accessibility tree.
Notices wrap by measured text width and retain the browser presentation
where their full content would exceed the HUD space. The header accounts for
safe areas and yields to settings. Sound uses the existing world audio
owner and requires browser activation. When activation cannot be read, the
trusted browser button remains available.

Opus 5.5 High reviewed this in two passes. The corrections preserve headings
and announcements, improve wrapping on narrow screens, expose the mute
control after entering a room with sound already on, and disable the
control during passage. The original standalone interior path retains its
browser controls.

Exact archive `27b6044a6b8d` at `6e38d2e` is 33,464,320 bytes. Chromium
verified the title and subtitle when entering Matter, audio activation and
mute by mouse and touch, and an announced native error notice. The exact
candidate also retained the complete notice at 320 CSS pixels and allowed
muting after a confirmed exterior-to-Matter crossing. The compatibility
probe masked the browser activation API and verified the original trusted
button. The suite passed 314 tests with two skips. Live remains
`f46d93f436be`.


## Proyección playtest deployment

At Nicolás's request, the ongoing iteration has an interim protected
playtest. Source `43c39e0` pins the merged
[Proyección density change](https://github.com/AlterMundi/proyeccion/pull/7)
at `a8e5afc`. The exact 33,464,320-byte build `601108cb255e` booted with a
receiving copy and passed the Chromium mouse and touch status checks and 314
Node tests, with two skips. Live readback matched 78 payloads, the HTTPS
client, worker and health, the receiving configuration and the native run.
Rollback is `f46d93f436be`.

Opus 5.5 High reviewed the pinned diff, which preserves package and lockfile
consistency. It found a narrower-than-square `HudJump` raster distortion and
limits for dense paragraphs. The playtest's touch jump uses the existing MML
control and this release adds no `HudJump` surface. Retain those findings for
the touch-control migration and the multiline cases. Physical-device
acceptance and the rest of the iteration remain open.


### HUD art direction

The November 25 selection contains 13 private image references. All 13
were opened and compared. Nicolás singled out the
[Pageflows cockpit image](https://pageflows.com/resources/wp-content/uploads/2024/08/HUD-Design-Example-1024x576.jpg),
also present in the staged set. Give that example priority in Cabina. The
inward-facing side surfaces, thin stationary top edges and low instrument
cluster establish depth while leaving the world visible. The physical map
and compass references support treating navigation as a tool that opens
on demand. The visor and instrument-panel samples support restrained
edge light and solid material around frequent controls. The inventory
examples keep the 3D object dominant and reveal its details beside it.
The high-contrast and pixel examples show how silhouette and hierarchy
distinguish active controls without requiring additional panels.

The [Dreamstime HUD gallery](https://www.dreamstime.com/illustration/hud-game.html)
adds useful examples of corner brackets, segmented markers and layered panel
borders. Build those details with Holodeck's own geometry, icons and materials.
Use brief motion on open, minimize or confirmed change. Hold text and hit
targets steady after the transition and honor reduced-motion preferences.
Compare the exterior toolbelt and minimap, the Matter inspection and the
open Conversation display in the same views. Keep the toolbelt readable
over bright terrain and the Matter piece clear while it is rotated. Verify
the equivalent organization and touch targets at narrow widths. The staged
images are visual references for this evaluation.

[Nasty Rodent's production guide](https://nastyrodent.com/what-is-hud-in-games/)
informs the per-control specification. The toolbelt and heading stay in the
player's view. The doorway cue follows its actual destination in the world.
The map opens on request, and the worktable's inspection controls stay next
to the selected piece. Record each control's visibility rule, state owner,
safe-area placement and keyboard and touch behavior. Use shape or labels
alongside color for state, and inspect the active and disabled states over
both bright outdoor and dark indoor scenery.

The [Alamy instrument sheet](https://www.alamy.com/hud-touch-user-interface-futuristic-circular-panels-or-bars-and-text-boxes-hud-ui-vector-screen-with-equalizer-scales-and-smart-controls-digital-to-image454041959.html)
uses segmented arcs, fine ticks and a contrasting active sector. Translate
that treatment to the actual bearing and minimap markers. Tick spacing
expresses direction and the highlighted sector follows the selected route.
Use smaller ticks at the Matter section control only for its real cut depth.

The [Coherent Labs FPS kit](https://coherent-labs.com/posts/presentation-of-a-complete-fps-interface-kit/)
shows how a consistent family of modules can serve gameplay, navigation and
settings. Test quiet, translucent surrounds against detailed scenes and a
stronger backing under text. Reuse the same silhouette, focus state and
accent roles between the toolbelt, map and settings. On touch, adapt the
grouping to the available width while preserving the controls and their
input targets.

The additional November 25 visual reference (instruction `77d43c71`)
pairs a fixed minimap and bearing above the main view with a compact
action strip below it and short hints near the relevant target. Use that
division in Cabina and the other looks for actual navigation and Matter
actions. The selected room, worktable controls and current destination
give the design its content. Keep the center available for exploration
and inspection, and show contextual hints only while their action is
available. At touch widths, verify that a displayed map or modal cannot
intercept an unrelated movement gesture or expose an underlying action.


The cockpit preview (`hud-look=cabina`) applies the November 25 visual
reference to actual Holodeck surfaces. The desktop toolbelt recedes from
eye level, the location panel turns inward, and the material housings have
visible depth. The center stays clear. The movable map, worktable and
embedded Conversation display retain front-facing controls. Cabina is
selected at load time and retains the flat arrangement on touch and narrow
viewports.

Fable 5.2 High recommended shared convergence, conservative angles and
solid material housings. Opus 5.5 High identified the crossing depth planes,
projection cache and window evidence gaps. The toolbar now stays behind
floating windows and uses projected launcher bounds. Chromium exercised
physical minimap and worktable clicks, native window drag and resize, plus
Conversation fold, restore and draft retention. The follow-up Opus review
found no remaining code blocker. The protected package matched all 80
installed files and exact HTTPS assets with the world run and access scope
intact. Physical Raspberry Pi performance is still open.


The protected native comparison now opens in Holodeck with an opt-in
`hud-look` query: `orbita`, `umbral`, `pulso`, or `estratos`. The three
views use the gameplay toolbar, an actual Matter project, and the A2UI
Conversation chrome over the canonical web frame. The material meshes follow
the existing A2UI groups and sit outside the hit targets. The chrome pivots
on entry and during toolbelt layout changes, folds on exit, and flashes
along its trim on handled actions. It honors reduced motion. The default room
and HUD settings remain independent of the comparison.

Fable High reviewed the implementation approach and prompted a visible
glass/enamel split and stable accessibility targets. The exact release
passed 319 tests with two skipped. All four looks were captured in controlled
Chromium on the real room and worktable surfaces with an isolated conversation
fixture. The packaged build passed desktop and touch Conversation drag,
resize, minimize and reopen with its draft retained. The selected archive
matched all 80 installed files and the protected HTTPS assets. Physical Pi
performance and the final dark/light selection remain open.


Holodeck owns the surface intent, room look, and interaction state. A2UI
describes controls and actions against the registered Proyección catalog.
Proyección resolves those controls into Three.js visuals and the corresponding
accessible controls. Conversation content continues to use its web renderer
within the display.

The current host can set palette, panel width, child weights, spacing, and
raster density. Panel shape, backplate material, padding, typeface and most
control dimensions are built into the renderer. For independently designed
room and application styles, extend the renderer with a host-selected,
versioned theme. The theme should define type roles, spacing, silhouettes,
borders, material and state styles, and reference locally registered icons.
Use explicit component roles for primary, secondary and chrome actions so
themes can produce distinct treatments without changing the action schema.
Keep hit areas and accessible names stable when visual chrome is reduced.
Leave custom component drawing with the registered renderer. Compare at
desktop and touch sizes, with both orbital and a contrasting room look.

Inspiration from Asphalt is the clarity of primary actions, clean negative
space, expressive typography and quick icon recognition. The Matter room
should retain its own visual language.
See the [A2UI catalog guide](https://a2ui.org/guides/defining-a-catalog/) and
[A2UI theming guide](https://github.com/a2ui-project/a2ui/blob/main/docs/public/guides/theming.md).


### November 25 playtest and next controls

The 52ca23ac4a7e release caps the Conversation minimize glyph at
11 CSS pixels and fades its background plate. The corner resize mark and
pointer target are unchanged. The exterior palette supplies an explicit dark control fill.
The browser fixture exercised drag, resize, minimize, restore, draft retention
and viewport clamping. The focused screenshot was inspected before selection.
Matter defaults to Orbital · layered light. A per-account room preference
survives new sessions, with the embedded Orbital material as load fallback.
The preceding release c2d4434bd2e6 retained Collection rearchiving. Both
selected packages passed protected byte and native world continuity checks.

The human rejected the first HUD comparison and identified Elder Scrolls
Online and Asphalt as the art references. The revised private
[HUD comparison](https://compaii.dmn.homes/view/59b2b33b3e7a4fdcbbefee7bb8d21868?display=work)
offers Meridiano and Impulso on actual toroidal and Matter captures, with
day and night settings, compass interaction, minimap, piece inspection and
a preserved sample Conversation draft. Fable High proposed a quiet edge-based
layout and a separate torus-shaped toolbelt. Opus 5.5 High reviewed the rendered
frames and found competing CTAs, an inert compass, cut framing and mobile focus
issues. The revision separates travel from the toolbelt, gives the part and its
section control priority, aligns the compass with the map indicator and
qualifies pointer and touch at desktop, 390px and 320px. World movement and
piece clipping remain native integration requirements. The mock controls
change the review display. They do not submit actions to the shared world.
The previous comparison remains in private version history.

The next [HUD comparison](https://compaii.dmn.homes/view/59b2b33b3e7a4fdcbbefee7bb8d21868?display=work)
uses the actual Proyección A2UI renderer with a Three.js instrument in each
look. Órbita selects waypoints on a toroidal relief, Umbral brings different
world previews to the foreground through translucent glass, Pulso toggles a
sample's moving scan plane and visible structure, and Estratos changes the
separation of a layered assembly. The art uses the existing Holodeck sky and
room captures. A shared material shell follows the bounds of the native
surface, with a beveled opening, lit rim and a damped deformation that keeps
labels and hit targets fixed. Effects can be disabled and follow the browser's
reduced motion setting initially. No fixture action writes shared world state.

Fable High recommended a strong luminance hierarchy, limited overlap between
translucent layers and tying spring motion to meaningful state. Opus 5.5 High
reviewed the rendered frames and found occluded buttons and focus rings,
undersized touch targets, muted scenery and a stale blending mode on Pulso.
The revised check exercises real canvas hits, keyboard actions, keyboard
adjustment of separation, reduced effects, and all four visual layouts in
Chromium at desktop, 390 and 320 CSS pixels. Hitting a control through
software WebGL leaves physical-device GPU cost open. The shell and four
instrument sources live in `src/hud-material-shell.mjs` and `art/hud-spatial/`.

### Select and ship the game-wide HUD design

The selected concept studies now set the quality bar. The previous
six-look comparison is historical. Compare the next integrated design at
arrival, with the minimap open, inside Matter around an actual part, and
with Conversation open alongside it. The historical `hud-look` previews
remain opt-in for reference.

Carry the selected direction through all native HUD surfaces, overlays,
windows and their opening, closing, focused, disabled and confirmed states.
Build coherent dark and light presets from that direction and retain
personal tuning. Apply the chosen materials, depth, typography, icon
language, spacing and motion consistently. Qualify the selected package
in the real game in bright and dark scenes, on desktop and touch, with
both graphics presets and reduced motion. Confirm the canonical
Conversation display still keeps the draft and its device/session access.
Keep preview URLs opt-in until that selection and qualification.
The [private design comparison](https://compaii.dmn.homes/view/59b2b33b3e7a4fdcbbefee7bb8d21868?display=work)
opens with three new in-engine drafts, Puente, Margen and Anillo, on the
same room and workpiece. Puente uses the Cabina perspective, Margen limits
bezel geometry to working displays, and Anillo uses rounder translucent
frames. Desktop Chromium exercised the actual toolbar, map, Matter entry,
project selection and Conversation display for each. The embedded test
payload shows the framing. Fable High addressed composition and text
contrast. Opus 5.5 High checked the draft geometry and the comparison.
Anillo's initial position encroached on the piece and was moved toward the
edge before its final capture. These are historical visual drafts.
A dedicated design workshop table is a later
project.

Position, size, typography and appearance remain independent from shared application state.
Use one shared positioning interaction for minimap, settings, Collection and
Matter worktable panels. Provide keyboard and touch input, increase hit
areas without increasing icon art, clamp windows on viewport change, and
exercise overlap and dismissal with the Conversation display.

The [Sand3D Nature trail comparison](https://compaii.dmn.homes/view/b1cb2de6ec714bfeab4962cc792c2e41?display=work)
qualifies only a focused patch next to the house. It uses the existing terrain
and ground cover, the same eye-height camera in both runs, and three additional
instance batches for 34 objects. USDA identity and conversion details are in
the evidence folder. SwiftShader measured 68 vs 71 median draw calls and
46,065 vs 77,225 median rendered triangles. Frame pacing varied considerably.
Before wider adoption, measure a culled and reduced-density variant on the
game hardware. Retain the live baseline outside the test.

The selected package 29399a048e35 keeps the room geometry and collection data in place
while changing movement and presentation. Inside the Matter work area the
player flies with the regular movement inputs, stays inside the table bounds
and appears as a small translucent figure to the other people in the room.
The room presence channel carries the active tabletop state for each connected
avatar and serves the current roster to a newly connected viewer. A second authorized browser saw the hologram at entry and after a reload and
saw the original scale and materials return on exit. Foreign connection writes
were rejected and a stale revision could not replace the newer exit. Chromium
reported aborted GLB reads for superseded room views, then loaded the current room.

The exterior uses a solar clock evaluated at Buenos Aires and a generated
space panorama behind the atmosphere. The accessible control surfaces keep
their current actions while minimap and table tools can be moved and resized.
The 3D companion reuses the selected Navegante design. Its mouth tracks the
authenticated Conversation playback signal when that capability is present.
[DaimonApp #1026](https://github.com/AlterMundi/DaimonApp/pull/1026) owns the
sender. CompAII received the exact two web assets on the existing Portability
release, preserving native processes and configuration. Sessions returned 200
with the bound human session and 401 after logout. Chromium exchanged a
synthetic playback level and reset through the two bound origins. Hearing live
speech and seeing the lips move during it still needs a live trial.

## Native Activity panel

The production audit found Activity still used its exterior HTML launcher and
dialog. The cutover is part of [Holodeck #16](https://github.com/AlterMundi/holodeck/issues/16).
The Activity read API and retained timeline stay with the existing world owner.
Fable 5.2 High's focused review recommended one controller for both
presentations, a bounded set of visible choices on narrow screens, a stable
sequence for selection, a fixed action row, and page/revision checks before
applying any action. The native panel uses Proyección's paged choice and
keeps the existing fetch boundary of up to 20 records. It retains the HTML
dialog as the presentation fallback for loss of a usable native frame.

Opus 5.5 High found that the initial native modal could open above the
Conversation or creator forms and send their Enter/Space to an Activity
control. The correction keeps the launcher unavailable during those forms,
rechecks the affordance before opening, isolates the legacy DOM overlays as
inert while Activity owns focus, and routes no external form activation
through the native modal. Close and fallback release that ownership.

The 33,536,000-byte package b3aec1e9b89a passed 316 Node tests with two skips.
Chromium exercised authoritative history pagination, snapshot tabs, Escape
focus restoration, and the external keyboard isolation regression in
lightweight desktop and normal at 390 CSS pixels with an actual emulated tap.
Desktop context loss restored the same current page in the HTML dialog.
The protected package readback preserved the prior run and compatible
fda64cf266b7 rollback. The authenticated hosted browser read Activity with
HTTP 200, opened the native HUD, closed it with Escape and logged out.
Exhibition, result navigation, creator and recovery surfaces remain under
issue #16. The broader goal also still includes device-specific performance
and live context deltas.

## Native exhibitions and visit controls

Exhibitions now share their scoped catalog, search and exact revision selection
with the native HUD. The viewer chrome also uses the HUD. The viewer page
retains its mounted frame, draft and existing close checks when a visitor
temporarily returns to the world or cancels a change of edition. The standalone
interior route still uses its compatible HTML controls.

Fable reviewed component and focus ownership. Opus identified a refresh race
that could replace the selected edition and a mismatched Search submit action.
The implementation rechecks the exact edition and uses the same action for
pointer and keyboard submission. Chromium qualified desktop search,
touch return, draft retention and recovery to HTML on WebGL loss. A second
signed-in fixture actor received only its permitted edition.

## Current release collision regression

The exact deployed Cabina archive `8c485a4c8cfe` passed the controlled
Chromium interior wall and ceiling checks and the toroidal cave flight
headroom check. Recorded limits were 5.822 m wall position and 3.926 m
camera height for that fixture, with a 3.958 m interior capsule peak and
2.279 m of cave flight headroom. This exercised the installed package bytes
with controlled local identities and does not claim physical-device or
multi-visitor performance.

## Passage and startup recovery

The live passage uses a separate Three.js A2UI surface over the existing
backdrop. It waits for the original message delay and replaces the HTML
controls only after a visible draw. The passage owns pointer and keyboard
input while active. Each passage receives a distinct A2UI surface identity.
The existing retry still reads the server-admitted place after reload.
Cold bootstrap, lost WebGL, short viewport and a stale paint use one ordinary
HTML retry. A failed native draw keeps that fallback for the rest of the passage.

Fable High recommended a paint acknowledgment and a timer independent of
animation frames. Opus 5.5 High identified render ordering, inert state,
pointer release and focus handoff. The real browser also caught a reversed
Proyección callback and a duplicate DOM-accessible control on fallback.
The corrected archive `8494a6e66177` exercised a delayed canonical move
and exactly one POST from desktop and touch. The browser returned to the
already committed destination after the native retry, lost context and
paused drawing. A failed client import left a working HTML retry. The
package remains qualified locally and unselected in production.

## Multiline HUD and recovery

The host pins Proyección `6e6facd563a146874476e0ddd6b4e89f2a5f8b02` with
archive integrity in the lockfile. The Matter status and Conversation
reference reserve two lines, including names with composed characters.
The same A2UI layer presents recovery actions. The original held input is
shown only on explicit reveal in the browser. The fallback keeps the
recovery controls available on narrow layouts. Closing tracking requires
separate confirmation and preserves the original without cancelling a
possibly accepted operation.

The exact source build passed 326 tests with two skips. Controlled
Chromium verified A2UI retry, narrow-screen fallback, original and
captured-view identity, reload without resubmission, and a new command
after closing local tracking. These are fixture checks with no native
provider calls. Package `73659b794b51` is 33,515,520 bytes. Actual
authenticated two-visitor acceptance remains open.

## Navegante movement follow-up

After the volumetric avatar reached the live service, Nicolas reported that
the movement still felt stiff. A fresh Opus 5.5 High review identified the
camera-driven follow target, unbounded onset, and cadence/distance mismatch.
The companion now keeps its selected side while the camera turns, ramps
velocity under a speed limit and advances the walk phase by distance. Its
follow frame still tracks the torus gravity frame. A review of the exact diff
caught stale velocity on tab return and a potential repeated catch-up jump at
sprint speed. The revisions reset velocity when visibility returns and use an
acceleration that supports the existing 8 m/s sprint.

Controlled Chromium exercised the same GLB and Three.js controller. A full
standing turn translated the robot by 0 m. The stop trace reached 0 m/s, a
hidden-tab return discarded stale velocity, and jaw movement and reduced
motion passed. The combined archive `e77a4ddbfe87e` is 33,515,520 bytes.
It is staged on the development host. The selected live build still serves the
volumetric model with the previous movement controller. Authored fast
locomotion and hovering, ground contact on slopes and stairs, and video review
of transitions in the real world remain part of the visual acceptance.

## Tabletop companion

Nicolas's selected view showed the companion larger than the human avatar and
opaque while the human was translucent. The companion had a separate .33
factor against the human's .19. Both now use .19 and the same material adapter,
with the ordinary materials restored on exit. The Blender asset adds authored
hover and glide cycles. A selected current object can hold the companion's gaze,
and an exact still-loaded table part can draw it closer within the table bounds.
Those reactions are viewer-local while shared companion state is pending.

Fable High reviewed the architecture and Opus 5.5 High reviewed the diff.
The latter highlighted a possible MML material subclass constructor failure,
which the first two-client browser run reproduced. The final adapter copies
into a base Three.js material and the regression covers an MML-like constructor.
Opus also found the geometric pivot and full-body pitch issues, addressed with
the part bounds center and planar facing.

The staged archive `024474ad3115` is 33,525,760 bytes and the 329-test suite
reported 327 passes and two skips. The exact archive's two-client tabletop
browser check reached the matched scale and transparency, bounded hand-led
flight and return to the prior position. Its final error audit still observed
two asynchronous failed reads for an aborted peer room-art request. The whole
browser run is therefore not a clean pass. A separate controlled Chromium
check passed scale, material restoration, expiring attention and jaw playback.
The actual protected release still serves the previous avatar controller.

## Proyección workspace comparison

The referenced Proyección workspace uses the standard A2UI catalog in a CSS3D
surface. Three.js supplies the perspective transform. The workspace applies its
own 20 px rounded edge, 24 px inner spacing, dark neutral fill and soft shadow.
Holodeck uses the separate `spatial-hud` catalog rendered as native Three.js
geometry with an accessible DOM projection. The protected avatar release pinned
`2717bf90d76c`. Holodeck's candidate incorporates the newer fitted text and
does not inherit the workspace CSS.

Fable High reviewed the selection. The optional `hud-look=taller` candidate
adds a shallow matte surround with a restrained edge to the actual worktable
HUD. It keeps the other surfaces on the current theme. Running Chromium with
the candidate verified the real worktable, flight and return on desktop and
390 CSS pixels with touch emulation. Inspection prompted a narrower surround,
safe-area placement and a shorter narrow-screen exit label. Opus 5.5 High
identified corner overhang and peak-tilt concerns, addressed in the revised
geometry and motion. Wider style application and graphics budget remain open.

## Avatar control and authored movement roadmap

Alt is crouch on the ground. Shift remains descent during flight and swimming.
R also runs, including when a browser reserves Ctrl+W. The fullscreen action
requests the browser's permission to capture W only and releases that capture
on exit. A bare cancelable Ctrl+W event is also handled when the browser
delivers it to the world. Regular-window behavior still depends on the browser.

The humanoid rigs use mirrored bone axes. The crouch correction bends about the
body's lateral axis rather than twisting the knee along the bone. The visual
adapter still uses the standing collision capsule. The authored animation pass
must include planted crouch, transitions into and out of run, takeoff and
landing, steady hover and flight, swimming, facial idle variations and speech.
Retarget a canonical humanoid rig with per-avatar rest poses and contact
markers. All four current humanoid GLBs lack facial bones and morph targets.
Add face rigs and test each avatar. Human mouth movement uses an explicitly
enabled microphone signal. The companion's jaw continues to use actual
Conversation playback. Apply the same pose semantics to shared 3D and AR only
after verifying both independently. Close this milestone with transition video,
foot contact on flat ground/slopes, remote presence and reduced-motion tests.

## Room reload and exterior creator

The exact MML browser dependency can report a cancelled room-art fetch as
`TypeError: Failed to fetch`. A scoped Chromium diagnostic observed the
resource's abort signal and zero remaining consumers when this occurred.
Fable High and Opus 5.5 High reviewed the adaptation. It handles that
observed cancellation only for a retired resource, while requests with
live consumers and HTTP or model parse failures remain observable. The
controlled two-client package `ba5f325a0dfd` passed tabletop scale and
transparency, bounded flight, peer reload and position restoration. The
browser captured three cancelled downloads and no page errors.

The exterior light preview and world indication now have a Three.js A2UI
surface. Their visible controls call the existing Room action owners. A
draft belongs to its original run and edition. Accept locks its controls
until a definitive outcome or an explicit close of tracking. An accepted
retained outcome closes only that draft, and an uncertain original can be
retried through the recovery HUD without substituting a new command.
Creator and garden preview ownership are mutually exclusive. The native
surface yields to recovery, settings, map and embedded conversation.

Fable High identified draft mutation, stale edits and overlapping preview
ownership. Opus 5.5 High additionally found recovery precedence, focus and
Escape cases. The revised candidate keeps native recovery available, uses
the existing tracking-close semantics and restores a meaningful focus
target when the active card changes. The playable garden field editor and
production receiving validation remain separate work.

Controlled Chromium verified keyboard Escape and reopening in the native
light preview, choosing Amber, a dropped publish, the draft lock and
explicit retry from the native recovery HUD. The retry kept the exact ID
and command and committed one light. The 331-test suite gave 329 passes
and two skips. The exact Node24 package `883efcd70ed1` is 33,525,760 bytes.
Its standalone shared-world fixture admitted two clients and observed the
same mutation in both. Human-authenticated production acceptance remains
open.

The combined `883efcd70ed1` package also passed the scoped two-browser
tabletop sequence, with four retired GLB requests and zero page errors,
matching .19 figure scale and confirmed return. All 80 archived files
matched the manifest. The operator artifact received the exact archive
under its existing private audience; HTTPS readback matched the full
digest. Cutover completed on the same request after the Home access
authority resumed. The protected service selects `883efcd70ed1` and
rollback `8b3d41a7410a`. Installed inventory, world continuity, and
protected HTTPS readback are recorded in [STATUS](STATUS.md).

## Harmonic Lab station HUD

The nearby Beacon station and embedded lab window now have Three.js A2UI
controls in the live-room client. The station uses the owner's exact object
and revision for both launch and explicit status. The embedded Harmonic Lab
remains the existing authorized web page. The viewer reserves space for the
HUD and uses a narrow input scope. The standalone room retains the HTML
station controls.

Fable High identified the dialog top-layer conflict. Opus 5.5 High identified
the pre-paint input gap, frame focus, and fallback details. The revised
implementation clears held world keys on open, confines keyboard traversal,
and restores the original modal chrome on loss of the HUD context without
replacing the iframe. An Escape from a same-origin iframe returns to the world
unless an inner dialog or composition owns it. The browser owns cross-origin
frame key input.

Archive `52dccaadf135` is 33,536,000 bytes. The exact Chromium fixtures
passed on desktop and at 390 CSS pixels with an actual touchscreen tap.
They exercised one explicit status request, separate-tab launch, iframe
Escape, preserved draft on WebGL loss and a clean close. The lab's network
responses in these checks were controlled fixtures, with zero page errors.
The source suite reported 329 passes and two skips. The protected service
continues to serve the creator release while this package is staged.

## Retiring the light exercise

Light placement and the signal-garden exercise served as an early
authority and shared-state proof. Production Holodeck now selects the
retired mode in the candidate. Existing saved definitions, placed objects,
events and receipts remain loadable. New exterior light and recipe
mutations stop in the shared Room writer. Interior signal and recipe
writes stop in the shared garden writer after exact actor-scoped receipt
lookup. The browser and native surfaces stop advertising the exercise.
The bridge, general room and exhibit authoring, and world pointing remain
independent. Historical test cases opt into the exercise explicitly.

Fable High reviewed the retirement boundary before implementation. Opus
5.5 High reviewed the diff and prompted retained rejection outcomes,
owner revocation, actor-scoped pending receipt access, and explicit native
archive status. The exact package `4e578448c13c` restarts with a retained
garden, hides light tools on desktop and emulated touch and preserves the
minimap. The source suite reported 331 passing tests and two skips.
The exact combined package also passed the Harmonic Lab station and viewer
fixture on desktop and emulated touch, including browser WebGL fallback,
preserved iframe state and clean close. The exact standalone Node24 entry
passed two independent MML visitors, shared bridge state, projected updates
to both and same-original command recovery.

At the initial receiving check the selector was `883efcd70ed1` with
`8b3d41a7410a` as rollback. At the activation check two human participants were connected.
The already-published Harmonic Lab package `52dccaadf135` remains the
operator artifact's current pending version. The combined archive is
locally qualified. The supported archive writer protects both the
artifact's current and immediately previous versions, so prepare a
compatible bounded replacement or use the existing staged cutover after
the visit ends. No production selection or archive retirement occurred in
this pass.

## Terrain minimap

The outdoor minimap samples the same analytic toroidal elevation and trail
functions as locomotion. It shows shaded relief, contours, shoreline,
the actual access anchor for the house, player heading and a 50 m scale.
The native map and fallback draw from the same canvas. A cached 180 m
chart crosses both torus seams and rebuilds only after leaving a 3 m
band. Fable High reviewed sampling and heading. Opus 5.5 High identified
the relief sign, chart hysteresis, context recovery and small-label
issues. The implementation and regressions cover those corrections.

Exact package `2e4121b8de01` passed 334 tests with two skips, plus desktop
and emulated-touch Chromium map open/close with the actual terrain and
house entry. A standalone Node check across 50 warm chart rebuilds measured
3.69 ms median and 6.22 ms p95 on ITACA; these numbers exclude canvas
composition and rendering. The package is staged. Physical GPU and live
selection remain open.

## Ceramic companion and worktable glance

Navegante uses a volumetric authored Blender rig with the selected ceramic,
bronze relief and embroidered cape textures. Opus 5.5 High found the floating
trim, overlaid mouth, excessive double-sided hologram draws and dark bronze.
The revised bezel is one mapped ring with aligned colour/normal repetition.
The speech jaw remains independent. Astra High reviewed the actual turnarounds
and prompted a longer folded cape, a thinner chin and larger plain ivory areas.
The sampled Blender poses had zero cape/limb triangle intersections across 80
frames in calm, walk, hover, glide, joy and uncertain.

Tabletop mouse attention is viewer-local and additive to the existing poses.
It reuses visible worktable hit testing, ignores the companion hologram as
a hover obstruction and applies a bounded glance to each head. Fable High
reviewed local focus and pose ownership. Opus 5.5 High drove the cursor freshness,
occlusion budget, reset and near-vertical changes. The regressions cover
clipped and obstructed models, stale cursor, model changes and restoration of
the base pose. Ordinary click selection keeps its original behavior.

Exact archive `a73f695a9e97` is 33,310,720 bytes, under the 32 MiB receiver
limit. Lossless packing of an existing public figure preserved its decoded
bytes and recovered space for the materials. The exact build passed 337 tests
with two skips. Chromium on the exact Node24 package verified both heads
responding to an actual workpiece and returning toward the sampled no-hover
pose without turning it into a selection. The draw count remained nine.
The draft is staged. Full avatar state transitions and final in-game art
direction remain open. Production and physical GPU qualification
are separate receiving checks.

## House approach material and planting

The toroidal arrival now has a packed-earth strip with a soft grass verge,
a little reflected night light and authored tufts and wildflowers. It keeps
the original terrain and collision. The cover follows the arc of the ring,
keeps the facade side clear at the selected door, and uses the same flowers
in both rendering profiles. Fable High reviewed the local art direction.
Opus 5.5 High caught the facade and door clearance, flower structure, night
light response and LOD boundaries. The corrections were recaptured with
the house at its actual plot and orientation.

Fixed day and night views and matched walking runs used the same 1.6 m camera
and 1100 × 675 buffer in Chromium with SwiftShader. At the house the art
added two draw calls and 792 median triangles in normal mode or 612 in
lightweight. Software frame times were mixed. At night p95 rose from 183 to
217 ms in normal mode and 150 to 217 ms in lightweight. These short runs
establish a visual and draw-cost comparison. They leave physical frame pacing
open.

A separate 14-instance Sand3D test added three draws and about 12,916 rendered
triangles against its own exact control. That is a smaller pilot than the
earlier 34-instance test. It remains a trial pending hardware measurements
and an acceptance decision. Its meshes are absent from the staged runtime.

Exact archive `7608545f20a1` is 33,310,720 bytes and passed 338 tests
with two skips. The package opened and closed the native map on the real
terrain in controlled Chromium. The release remains staged.

## Authored flight and swimming poses

The four registered human models share two bind rigs. The flight and swim
poses now retarget against each model's actual inverse binds and blend over
the SDK mixer. Hover, glide, lift, descent, landing and swim have separate
poses. Only the local exterior pilot uses explicit flight state. Shared table
visitors use the existing table state. The local ground contact returns
leg control to the SDK during landing.

Fable High reviewed the transition plan. Opus 5.5 High found residual
stock limb rotations, abrupt lower-body restoration, elbow and knee
hyperextension, and stale state after crossing the table boundary. The
corrections use separate upper and lower blends, bind-relative hinge limits,
and a state reset on a discontinuity. The companion's Blender rig adds
distinct lift and landing clips. It now settles onto its own follow offset
before resuming ground gait and softens an interrupted clip instead of
snapping between edges. The sampled cape check covered 84 poses across
calm, walk, hover, glide, lift and landing, with zero triangle intersections
between the cape and limbs.

Exact archive `5c287af6591d` is 33,320,960 bytes. The pinned package
passed 343 tests with two skips and remains staged. Chromium on Node24
verified exterior take-off, hover, glide, descent to actual ground contact,
and a submerged dive and swim. Two independent test identities at the
table verified the common miniature factor and translucency, bounded
flight, peer reconnect and return to the entry position. A standalone
browser also verified the robot's independent speech jaw, miniature gaze
and return to its follow position. These checks used software rendering
and controlled identities.

The remaining animation work includes the grounded crouch, run and idle
quality passes, complete facial expression and microphone lip sync across
avatars, and independent authenticated visitor and physical GPU validation.

## Instrument glass on the native HUD

The default Three.js toolbelt, room title, topographic map, worktable and
Conversation header share a dark glass backing with a cool rim and short warm
highlights. The room theme can tint the same material. The optical layer is one
quad per visible surface, behind the translucent Proyección backing. It does
not capture the world framebuffer and does not participate in input. Historical
explicit HUD looks retain their existing shell and palette route.

Fable High proposed the single material plane and static reduced-motion
treatment. Opus 5.5 High found a transparent sorting hazard, stale redraws and
shared CSS defaults spilling into other panels. The rear draw order, bounded
pane reuse, matrix/extent invalidation and HUD-specific tokens address those
findings. The renderer's existing focus, controls and mounted Conversation
remain the input and state owners.

Stage `ccb72f15ef10` is 33,320,960 bytes. The exact source passed 344 tests
with two skips, including the material visibility, theme and relayout regression.
Controlled Chromium verified the daylight topographic map and a mounted
Conversation that preserves its draft while moving, resizing and minimizing.
The exact archive also passed the loaded desktop worktable cut by keyboard,
rotation, part visibility and exit-focus checks. The touch-sized capture
keeps the complete exit label and verified tabletop flight and return. The
browser checks use SwiftShader. Physical device performance,
two authenticated visitors, the full light-base theme, and the remaining
graphic hierarchy across the game remain open.

### Protected cutover

The protected selector now serves `ccb72f15ef10` with `52dccaadf135` as
immediate rollback. The exact source and 81-file archive passed 344 tests,
with two optional installed-gallery checks skipped, two controlled browser
visitors at the shared table, and saved-garden readback in desktop and
emulated touch. The standalone package also passed independent MML peer
and exact shared-command retry checks. Existing Home access, the native
world run and edition and the saved lights were observed after the cutover.
See [production readback](STATUS.md#november-25-archived-light-exercise-and-instrument-hud).

## Viewer-local light and dark HUD

Apariencia offers **Tema de la interfaz** through the existing native
settings surface and its browser fallback. Dark is the initial mode.
Light uses a pale instrument backing and darker ink, control focus and
borders. The warm Matter room keeps its own hue. The browser preference
is independent of room style, avatar and the shared world, and changing it
does not remount the canonical Conversation iframe. Named look previews
keep their placement and the dark rendition. In light mode they use the
same light backing as other native surfaces.

Fable High called out competing palette keys and a passage palette that
only updated on surface creation. Opus 5.5 High found the fallback text
and border contrast, the iframe color-scheme inheritance and the named
look differences. The correction scopes the light tokens to Holodeck
surfaces, retains the iframe's previous outer color scheme, and keys the
shared palette on the theme, room and preview.

Exact candidate `ecfa8dd033a0` is 33,320,960 bytes. The source suite passed
346 tests with two optional gallery checks skipped. Against the nominal
cool and warm light colours, the minimum calculated text and focus
contrasts are 10.98:1 and 5.99:1 across their listed fills. This is a token
comparison, with the translucent background also calculated over black.

Exact Chromium desktop and emulated-touch checks verified theme persistence,
focus and the topographic map with software rendering. Desktop also verified
the warm room variation, the retained Conversation frame and draft, and a
separate browser profile without the preference. A delayed passage recovered
keyboard focus and its committed destination after overlay WebGL loss, with
one move POST. The candidate remains staged.

## Planted local crouch

The Alt crouch lowers the hips and inclines the torso on both shipped
human rigs. It solves the legs against the standing or walking animation's
current ankle positions and orientations. The forward knee pole is
derived before moving the hips and blended near standing. Leg lengths
come from the actual posed joints in world space. The local input,
collision, camera and network pose contract are unchanged.

Fable High reviewed the IK and animation ownership. Opus 5.5 High found
the stale knee-pole origin, the ease near straight legs and residual root
pitch. The correction uses the stock leg axis, a scaled reach tolerance
and a depth that eases from zero. It delays ground pose weight while the
flight tilt visibly settles. The unit checks apply the pose to all four
models on rotated, translated and scaled bodies. They verify knee
direction, ankle position and orientation, duplicate-apply safety and
release through flight and ground contact.

The staged archive `767a588fd4ef` is 33,320,960 bytes. The package source
suite passed 350 tests with two optional gallery checks skipped. In
controlled Chromium, holding Alt while standing lowered the hip by
21.8 cm, with 0.6 cm or less vertical ankle movement in that capture.
The previous build lifted both ankles by roughly 10 cm. Alt walking,
release, ordinary exterior takeoff, hover/glide and landing passed on
the exact candidate with software rendering. MML 0.28.0 currently transmits seven base animation states and has no crouch
state. This slice fixes the player's local pose. Peer pose publication was still pending at this earlier stage. The complete
grounded clip set and physical-device acceptance remain open.

## Peer crouch and exterior flight

The staged Holodeck build shares the supported crouch and exterior flight
poses with peers in that room. The authenticated MML connections retain
their existing animation enum and movement authority. An optional, advertised
pose route accepts only bounded, versioned hints for the current actor's
particular MML connection. A proof derived from the tab's existing
session key covers the room, connection, pose and revision. The route receives
no raw MML session token and does not persist poses. Snapshots and changes
use the existing authenticated MML socket, with disconnect and scope cleanup.
Tabletop miniaturisation retains its existing scoped presence.

Fable High identified the released animation enum and room scope hazards.
Opus 5.5 High tightened disconnect cleanup, snapshot recovery, background-tab
release and peer flight ownership. Its follow-up reviewed the tab proof and
secure-browser fallback. The exact staged archive `b74aa8939953` is
33,331,200 bytes. It passed 351 tests with two optional gallery checks
skipped. Actual shared-Home visitor and physical-GPU evidence remain open.

The two-browser controlled run rendered an 18.5 cm remote crouch and received
its current pose after the observer reloaded. It verified the remote exterior
flight animation and retirement of its pose on disconnect. Both a different
fixture actor and a separately authenticated tab for the same actor were refused
when addressing the original tab's connection with their own proof.
The exact same package passed the two-browser tabletop sequence with
matching scale and translucency, bounded flight, reload and exact return.
These were controlled Chromium runs with software rendering and fixture
identities. The protected service keeps its prior selected release.
