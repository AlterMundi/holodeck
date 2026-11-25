# Holodeck playtest iteration

## Starting point

The receiving build `f46d93f436be` (source `f975275`, rollback `2563afe48a8d`) has the toroidal world, one house, wall and roof collision, continuous yaw, sensitivity, double-Space radial flight, a minimap, partial A2UI Matter tools, and canonical web Conversation with a movable, resizable Three.js frame and animated minimize. The pre-change tests reported 296 passes and two skips. Browser checks covered flight, yaw, sensitivity, minimap, Conversation geometry and draft continuity. Those checks do not establish participant or device acceptance for this iteration.

Playtest 285b1415 and its amendments identified soft Three.js text and overlapping controls, requested physical inspection at the worktable and refined Conversation and world controls. Collision request 789201db is part of the regression baseline.

## Reviewed design

Claude Code resolved `fable` to `claude-fable-5-2` and returned three successful reviews at high effort. The first read the implementation. Two initial follow-ups evaluated the expanded HUD scope and the final Three.js presentation requirement. Adopt the independent HUD backing buffer, device-pixel text density, one layout owner, gesture-local browser operations, an exhaustive surface inventory, stable iframe mount, size checks per slice, and one camera mode dispatcher. The user selected Three.js for visible native UI. Generate accessible DOM semantics and native input bridges from the same A2UI state. Deliberately embedded web content retains its web rendering. A loss of all WebGL presentation must remain an explicit release test and reported gap if unresolved.

The receiving bundle has 110,592 bytes available before its 32 MiB cap. Measure the release artifact at each slice. Build candidates using the tracked art from the selected baseline and exclude independent Blender edits.

## Visual direction

Use the [Space Engineers HUD](https://www.spaceengineersgame.com/space-engineers-update-01-179-0-major-new-hud-and-ui/) as an industrial sci-fi reference for compact instrument grouping and visibility over a busy scene. Holodeck's design uses its own shapes, typography and room-driven accents. Keep labels direct, with the same placement and role in each style. Give controls a neutral high-contrast base and use the room accent for focus, selection and progress.

## Delivery order

1. [Holodeck #16](https://github.com/AlterMundi/holodeck/issues/16) owns an independent Three.js HUD layer with CSS-pixel layout, resolution from device pixels and bounded density. [Proyección #5](https://github.com/AlterMundi/proyeccion/issues/5) owns reusable text raster size, placement, focus, input and catalog behavior. Prove the bottom toolbelt with Conversar, minimap and Matter entry. Compare sharpness to a browser reference at fractional and integer DPR with both graphics presets, test touch reach and pointer lock, and measure startup and frame times against the same device baseline.
2. [Holodeck #18](https://github.com/AlterMundi/holodeck/issues/18) owns the A2UI window system and the native Conversation surround, navigation, minimize, restore and resize. Keep the canonical iframe mounted, share one placement and animation clock, and preserve exact piece context, draft, history, device grants and session. Let Conversation and Matter coexist. [DaimonApp #1022](https://github.com/AlterMundi/DaimonApp/issues/1022) owns the A2UI projection of Conversation internals in the following iteration.
3. [Holodeck #17](https://github.com/AlterMundi/holodeck/issues/17) owns the client-local Matter inspection camera. Snapshot locomotion and camera on entry, use a first-person pose plus bounded orbit, view-plane pan/height, tilt and cursor-anchored physical dolly. Touch pinch uses its centroid. Reuse the room collision/near-plane path and keep explicit part rotation separate. Verify restoration on exit, passage, disconnect and revocation.
4. Cut over all native surfaces by reachable state. Inventory entry and retry, passage/recovery, title and wayfinding, toolbelt and minimap, touch movement, Appearance/video, Matter shelves/archive/table, Conversation shell, Beacon, creator/edit/garden/play, activity and exhibition, visit navigation, runtime notifications and generated results controls. For each record its state writer, A2UI component, action and test fixture. Give each deliberate web embed an owner and purpose. Detect interactive visible legacy controls with fixture coverage as each surface migrates.
5. Qualify authoritative, bidirectional state/actions, desktop and touch, normal/lightweight performance, two visitors including read-only and revocation, and native/browser boundary cases. Recheck the published torus, cave, house, wall and roof, flight and yaw, rollback, and actual served package. Record participant acceptance separately.

[The shared roadmap](shared-roadmap.md) owns the subsequent Wiggle/camera, activity timeline, work-state replay and avatar work. Holodeck issues #3, #12 and #1 remain the parent experience, house integration and situated Conversation records.

## Situated Conversation context

[Holodeck #19](https://github.com/AlterMundi/holodeck/issues/19) tracks the semantic projection and baseline policy. The current writer expects one immutable machine source per input. The focused high-effort Fable 5.2 review finished after the broader source-reading review timed out. It identified the distinction between prepared and acknowledged baselines, pose jitter, cumulative deltas, and separate per-input admission. Use the existing canonical receipt authority. Scope the baseline to the writer generation, actor, being, continuing Conversation and authorized world scope. Compare stable room, selection, coarse pose and work state independently of timestamps and request IDs. Acknowledge by retained canonical acceptance and confirmed baseline installation. Reuse exact frozen decisions on retry and require a fresh full snapshot after baseline loss. Enable delta and attachment omission in stages on an explicitly verified compatible receiving path. Treat unchanged, absent context and failed preparation as distinct results and always verify fresh access for a native action.

## Qualification in progress

Source `01c48c9` introduces a separate transparent Three.js framebuffer for Matter A2UI and positions the entry affordance above the current bottom strip. A clean-source candidate was 33,443,840 bytes, the same archived size as the receiving baseline. This slice still uses the pinned Proyección text textures and the legacy toolbelt. Measure glyph sharpness, frame-time cost and context recovery before selecting a release.

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
