# 3D widget packs

The [portable surfaces roadmap in Proyección](https://github.com/AlterMundi/proyeccion/blob/feat/spatial-button-models/docs/portable-spatial-surfaces.md) owns the shared architecture.

Holodeck can render application actions with a Three.js model selected by
the host. The A2UI surface supplies semantics, current state and actions.
The asset pack supplies geometry, materials, motion and presentation. The
spatial renderer resolves model hits to the same control instance exposed
to a keyboard and screen reader. The host can mount the surface on the HUD
or on a workbench without changing the A2UI messages.

The teleport instrument is the first pack. It uses reusable miniature
factories, a finish palette, physical switches, miniatures that unfold along a helical rail
and built-in sound only when world sound is enabled. The first meshes are
generated from geometry in `src/teleport-models.mjs`. A later pack can use
preloaded GLB assets through the same renderer hook and dispose its owned
resources when the corresponding control leaves the surface.

## Shared selection with a future map

The location catalog assigns a stable destination ID. `teleportModelId`
maps that ID to a model family; `makeDestinationModel` can render it in a
map, a HUD or a room. The teleport controller exposes
`selectDestination(id)` and a selection callback for a future map.
A map will use the same authorized catalog and the same trip request
with its existing server-side access check. Its position and camera remain
local to its projection. The current instrument has no map.

A future workbench can mount switch models with the same hook today.
Continuous knobs and sliders need explicit normalized gesture and display
bindings before accepting a physical input. A physical MIDI adapter will
request changes through the application's existing action interface so its
web and Three.js views can render the confirmed state.
