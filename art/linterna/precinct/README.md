# Casa Linterna precinct

An editable exterior pavilion and a separate interior landscape. The approach
model uses metre units, Y up, and a +Z entry facing the promenade before parcel
rotation. It fits within a 4 × 2 m parcel. The precinct uses the same scale,
with a larger columned hall opening to an outdoor arc and three freestanding
temples. Two open shelters mark places where the garden can grow.

The principal hall and its garden form one arrival space. Each deity's door
opens to a foyer with a statue and one separate door per project. The return
uses the same thresholds. Both the model and the review path derive pavilion
origins, orientations and room widths from `plan.mjs`.

The hall imports the Atlas furniture from the original Casa Linterna study.
It retains the round table, annular terrain and water, survey markers,
pendant, bench, paired seats and hook rail. The original horizon mural now
faces into the hall from the east wall, leaving the opening to the garden.
The first study also retains the standalone field cabinet and full Claymon
workshop furniture layouts for their room art. The precinct's compact project
interiors depict the thresholds and a first view of the rooms.

## Build and review

```sh
node art/linterna/precinct/export.mjs OUTPUT_DIR
node art/linterna/precinct/build-review.mjs OUTPUT_HTML
```

The export validates clearances in both directions, reopens the two produced
GLBs, checks the facade footprint, and emits box colliders and a digest
manifest. The main asset batches opaque meshes by material to stay below 4 MiB.
The collider descriptors carry positions, size and yaw in model coordinates.
The precinct GLB contains the ground surface. Render it without full-mesh
collision and validate a corresponding floor and the exported box colliders
in the receiving engine.

The standalone review provides guided stops, keyboard and touch movement, and
reduced-motion navigation. It reads no account or world state. The optional
second review-build argument is a JSON file mapping a site room ID to an
optional `title` and `url`. Keep any private selection with the authorized
review. The linked site continues to handle sign-in and data access.

## Receiving integration

The precinct is larger than the existing 12 m room shell and exceeds the
ordinary 768 KiB per-kit ceiling. A live selection needs a compatible Holodeck
art profile with authored floor bounds, exterior arrival and temple passage
anchors. The enabled floor and wall collision must use the same dimensions as
the rendered art. Mount the arrival and god-temple interiors in the one
existing runtime with server-authorized transitions. For a staged profile,
keep the scene architecture and the engine's semantic room boundaries aligned
at the doors. Keep protected door plaques, reachable site data and the Atelier
workbench binding in their existing authorized receiving paths.

Recheck the actual deployed East 1 entrance and predecessor layout before
selecting this art. Preserve the previous layout, original place IDs and
existing authorized data while qualifying the new room and return paths.

### Hefesto first slice

```sh
node art/linterna/precinct/hefesto-slice.mjs OUTPUT_DIR
```

The offline build emits room-local GLBs and a digest manifest for the common
hall and garden, Hefesto's foyer, Claymon's Atelier room and the separate
AnyPrinter room. Four bounded art pieces share the arrival cell. The other
temples appear there as exterior shells. The generator checks room-local
floors, solid walls and reciprocal landing clearance. It reopens each GLB
and measures the Atelier wood surface at local XZ `(0, -2)`, top Y `0.91`
and yaw `0°`. The actual projected model comes from the existing Atelier
workspace. Its location and authorization are receiving selections.

Passage thresholds and cell origins use precinct XZ metres. Each landing
uses its own cell's XZ and floor surface height. Yaw is in degrees about +Y
and describes the landing view, facing into the destination cell. The
table's suggested 1.1 m interaction radius leaves the arrival stand outside
table range in this compact room. Runtime profile and browser verification
are required before selecting this value. Bind logical cells to approved
room IDs through a revision-checked owning migration. Bind each asset part
through the existing room authorization and test departure, re-entry and
access revocation. The exporter writes no runtime state.
