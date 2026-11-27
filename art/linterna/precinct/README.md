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
