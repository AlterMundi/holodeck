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
4. Cut over all native surfaces by reachable state. Inventory entry and retry, passage/recovery, title and wayfinding, toolbelt and minimap, touch movement, Appearance/video, Matter shelves/archive/table, Conversation shell, Beacon, creator/edit/garden/play, activity and exhibition, visit navigation, runtime notifications and generated results controls. For each record its state writer, A2UI component, action and test fixture. Give each deliberate web embed an owner and purpose. Detect interactive visible legacy controls with fixture coverage as each surface migrates.
5. Qualify authoritative, bidirectional state/actions, desktop and touch, normal/lightweight performance, two visitors including read-only and revocation, and native/browser boundary cases. Recheck the published torus, cave, house, wall and roof, flight and yaw, rollback, and actual served package. Record participant acceptance separately.

[The shared roadmap](shared-roadmap.md) owns the subsequent Wiggle/camera, activity timeline, work-state replay and avatar work. Holodeck issues #3, #12 and #1 remain the parent experience, house integration and situated Conversation records.

## Multiscale materials and lighting

[Holodeck #20](https://github.com/AlterMundi/holodeck/issues/20) tracks the receiving work. Modern engines layer detail maps and world-aligned sampling, and recommend baking expensive procedural graphs when the result permits it. Randomized tiling is applicable to isotropic signals whose contrast needs to survive a blend. View-dependent stochastic filtering has a different purpose and requires temporal stability the lightweight client cannot assume.

- [Epic detail and world-aligned texturing](https://dev.epicgames.com/documentation/en-us/unreal-engine/texturing-material-functions-in-unreal-engine)
- [Epic utility materials and baking guidance](https://dev.epicgames.com/documentation/en-us/unreal-engine/utility-material-expressions-in-unreal-engine)
- [Deliot, Heitz and Neyret histogram-preserving texture synthesis](https://unity-grenoble.github.io/website/demo/2020/10/16/demo-histogram-preserving-blend-synthesis.html)
- [NVIDIA filtering after shading](https://research.nvidia.com/labs/rtr/publication/pharr2024stochtex/stochtex.pdf)

A focused Claude Code Fable 5.2 High review completed before this implementation. It located the repeated signal in the periodic one-metre detail layer, warned about mip bleed across material-role tiles and about destroying directional grain, and recommended testing decorrelated fine and room-scale domains without additional shipped maps before heavier stochastic synthesis. The first candidate keeps the baked room irradiance, baked structural seams and specular response. It unpacks the existing five grayscale tile cores into an isolated mipmapped texture-array layer per role. Gradient-aware samples add independent fine and coarse variation inside the prior modulation amplitude, with the steel grain direction retained. The existing floor reflection and other appearance variants use their existing paths. Start validation with matched Orbital layered floor, deck and wall/shelf views in normal and lightweight, and measure identical camera motion on each client. Evaluate pattern recurrence and visible silhouette, highlight and contact lighting before proposing the selected look. Claude Code Opus 5.5 High reviewed the actual material diff. It identified cross-grain in the coarse steel band, mid-distance contrast loss and implicit anisotropy changes. The correction keeps both steel bands axis-aligned, restores primary detail weight and preserves the source anisotropy. Runtime canvas readback and projected normal boundaries remain explicit portability checks. The corrected package `1fd0283a0c64` at `d3c42bf` was 33,454,080 bytes, 100,352 bytes under the cap. The exact package rendered Orbital Layered in both modes without a shader error in controlled Chromium. Three paired camera positions and a moving sequence ran in both modes. Software-rendered p95 rose from 349.9 to 383.3 ms in normal mode and from 216.6 to 233.3 ms in lightweight. These are fixture measurements, not hardware frame times. A baseline re-run with the same toolbelt measured software p95 of 333.3 ms in normal and 250 ms in lightweight, against 383.3 and 233.3 ms for the reviewed layered candidate. The mixed result and software timing variance leave the shader budget unresolved on the actual GPU. The benchmark and the visual quality bar remain open before promoting a material. Current live digest readback is still `f46d93f436be`.

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
| Creator and play | Point/send/edit, garden/placement preview and acceptance, recipe selectors, generated signal rows, play instructions and backstage actions | World, layout and recipe commands. Verify local draft, validated publish, owner access and another player's observed result. |
| Activity, exhibition and visits | History filters/paging/revisions, generated exhibit entries, generated visit selector and navigation, pointing and discussion actions | Shared world/activity and original result owner. Verify exact selected result identity, independent session layout, and no private result leaks across visitors. |
| Beacon | In-world affordance, surrounding launch/status/close controls; authorized Harmonic Lab iframe payload when selected | Beacon owner and existing authorized route. Exercise opening and exiting within the room and preserve authorization. |
| Embedded content | Canonical Conversation, deliberately visited Nexus content and the existing Harmonic Lab payload retain the content app renderer. All frames, navigation and host actions belong to Holodeck. | Verify origin, stable mounts where needed, native shell and browser-owned device prompts. |


## Situated context implementation

Holodeck now has a source-side planner and matching receiver reducer for full,
delta and unchanged situations. The projection keeps distinct object, station,
visit and piece selections, coarse client-reported position and a bounded
summary of canonical work events. Capture timestamps, connection identifiers
and derived work cursors are excluded from comparison. A receiver-selected lane
scopes baselines to the current actor, being, world, room and writer generation.
The existing full-attachment transport stays selected. Canonical Conversation
still needs to retain the independent machine receipt and install the baseline
at admission for both text and voice before the new path can be selected.

Claude Code Opus 5.5 High reviewed the code twice. The corrections add monotonic
receiving order and a retained order floor, keep full recovery from the exact
frozen projection, preserve unavailable collections and distinguish workstation
selection. Six tests cover unchanged transport noise, pose, work and selection
changes, event sanitization, bounded history, scope and generation isolation,
out-of-order delivery and recovery after losing the baseline. The tests exercise
the codec. Live zero-attachment delivery is still open under
[Holodeck #19](https://github.com/AlterMundi/holodeck/issues/19).
