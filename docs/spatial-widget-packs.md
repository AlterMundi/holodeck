# 3D widget packs

The [portable surfaces roadmap in Proyección](https://github.com/AlterMundi/proyeccion/blob/feat/spatial-button-models/docs/portable-spatial-surfaces.md) owns the shared architecture.

Holodeck can render application actions with a Three.js model selected by
the host. The A2UI surface supplies semantics, current state and actions.
The asset pack supplies geometry, materials, motion and presentation. The
spatial renderer resolves model hits to the same control instance exposed
to a keyboard and screen reader. The host can mount the surface on the HUD
or on a workbench without changing the A2UI messages.

The teleport instrument is the first pack. Char Design's station and
destination miniatures are loaded from their authored GLBs. Named anchors
place the spatial A2UI ray targets on the child nodes, floating parent and
travel carriage. The carriage turns on its rail toward the current view.
See the [station asset contract](../art/teleport-station/README.md).

## Camera-mounted and immersive presentation

The teleport instrument has two local mounts. Q defaults to the situated
workstation. The client invokes its model in the current location, using
the local up direction and a nearby clear placement in front of the player.
The same renderer draws the scenery and the model with a bounded inspection
camera. WASD translates that camera, drag moves it around the object and
wheel approaches or backs away. Shift + wheel lifts or lowers the view
along the table's vertical axis, as in the fixed worktables. The camera
respects known world colliders.

Every navigable A2UI device mounts one `WorktableNavigation` per viewer.
The shared mode acquires exclusive navigation, handles Shift + wheel and
Escape, and releases navigation on unmount. The mount supplies the anchor
in the current scene, the camera's collision bounds, and the audience.
It uses the shared tabletop avatar scale for Explorer and Companion. Fixed shared tables use the existing
table flight and its presence where supported. For a personal device,
the rendered figures are borrowed for the local view, so opening or
moving around it does not move the networked avatar. Esc releases the
input and restores the world camera and full-size presentation. The
camera-mounted mode remains an alternative mount for the same A2UI
controls.

The model and miniature hit regions live in the 3D location. Camera-mounted
A2UI controls are reachable from any angle. Picking is scoped to each
camera's A2UI surfaces. The same TeleportHud owns selection, favorites and
permissions through both mounts. No server entity, arrival or room change
occurs until the visitor confirms an authorized destination. If local
placement is blocked, the instrument opens in its camera-mounted view.
The browser remembers the chosen mount when the location supports it.

## Shared selection with a future map

The location catalog assigns a stable destination ID. `teleportModelId`
maps that ID to a model family; `makeDestinationModel` can render it in a
map, a HUD or a room. The catalog's optional `links` list points to other authorized destination
IDs, such as the rooms accessible through the Residence portals. The UI also
uses the catalog's existing house and room fields to construct containment.
Picking a branch opens one level and keeps its actual destination selected.
The `back` action leaves that branch without traveling. The renderer can bind
the stable `back` control instance to the selected parent model. If the authored station cannot load, the camera-mounted A2UI controls still
expose the same actions.

The teleport controller exposes
`selectDestination(id)` and a selection callback for a future map.
A map will use the same authorized catalog and the same trip request
with its existing server-side access check. Its position and camera remain
local to its projection. The current instrument has no map.

A future workbench can mount switch models with the same hook today.
Continuous knobs and sliders need explicit normalized gesture and display
bindings before accepting a physical input. A physical MIDI adapter will
request changes through the application's existing action interface so its
web and Three.js views can render the confirmed state.
