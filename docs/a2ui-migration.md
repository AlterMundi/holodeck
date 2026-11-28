# Holodeck interface migration

A2UI is the default for every new or revised Holodeck interface. A specific
exception requires an explicit request from Nicolás. Implement the surface
using the shared Proyección catalog and use the corresponding native
application or world API for state, permissions and actions. Use the spatial
and accessible renderers of the same A2UI surface for visual and keyboard
interaction.

| Surface | Current shared-view implementation | Remaining work |
| --- | --- | --- |
| Travel, map, toolbar, tools and notifications | Spatial A2UI including the teleport catalog, the minimap, doors, world status and passage status | Audit when the legacy HTML controls can still appear, including on context loss |
| Matters, exhibits and Lab operations | Spatial A2UI worktable, collection, exhibit navigation and Beacon controls | Audit remaining legacy status and fallback controls; preserve viewers and media adapters |
| Entry and initial connection | HTML entry in the shared view | Reconcile the A2UI startup implementation in the cumulative HUD line (422cd14 and 15c990b) |
| Gardens and play | Shared view still mounts legacy controls | Reconcile the A2UI implementations in the cumulative HUD line (0ab2be9, 5a2a4f2 and f0d300a) |
| Light preview and world pointing | Shared view already projects visible actions through CreationHud on the normal path | Audit context-loss fallback and remaining world-facing editors; retain the live CreationHud contracts |
| Conversation | Canonical Conversation owns the composer, recording and recognition, history and delivery | Render the canonical state/actions via A2UI in Holodeck; keep links, files, live audio and pending sends in Conversation |
| SysOps | A2UI activity views on feat/sysops-hud (3114e41) | Integrate the read-only panel with live shared view. A navigable room and Shared Resources projection have separate scope |

See [3D widget packs](spatial-widget-packs.md) for authored physical controls in the HUD and workbenches.

The cumulative branch includes changes from older shared-view revisions.
A merge dry run found conflicts in the entry HTML, client, HUD placement, and widget build. Integrate by surface while preserving current input and navigation behavior. Start with startup and gardens, using the intended A2UI surfaces from the cumulative line without replacing the shared-view renderer.
Before retiring a fallback, cover its ordinary, keyboard-only and recovery
paths using an A2UI renderer. Sign-in and embedded application content keep
their owning service and access checks.
