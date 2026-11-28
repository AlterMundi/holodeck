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

## Camera-mounted and immersive presentation

The teleport instrument now has two local mounts. Q opens the immersive
workstation by default. Its perspective camera orbits independently when
the visitor drags the space around the instrument or presses A/D. Wheel or
W/S changes the viewing distance. The visible Acercar and Alejar controls also work with touch. The persistent A2UI view controls can
return to the front, switch to the camera-mounted HUD or exit. Esc closes
either view. The browser remembers the chosen mount.

Both mounts reparent the same live A2UI surface and widget models. Selection,
favorites and permissions are independent of the camera. The input layer
routes hits to the respective view without moving the world avatar. The
immersive environment is private to the visitor and creates no world object,
room membership or presence.

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
