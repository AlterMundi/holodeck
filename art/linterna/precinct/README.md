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
node art/linterna/precinct/hefesto-slice.mjs OUTPUT_DIR REVIEWED_WORKSHOP_GLB
```

The offline build emits room-local GLBs and a digest manifest for the common
hall and garden, Hefesto's foyer, Claymon's Atelier room and the separate
AnyPrinter room. Four bounded art pieces share the arrival cell. The other
temples appear there as exterior shells. The generator checks room-local
floors, solid walls and reciprocal landing clearance. It reopens the
generated parts and uses the exact hash and embedded metadata of the
reviewed [textured Claymon workshop](../workshop/README.md). The workshop
keeps its full footprint and the `room-marker` at `(0, 0.45, -2)`. The
visible turntable sits at `(0, 1.146, -2)`. The actual projected model
comes from the existing Atelier workspace. Its authorization is a
receiving selection.

The finish pass keeps the approved annular terrain on its timber table. It
embeds PBR base-color maps for the dressed stone, timber and water using
the existing room-art export. The stone and timber images are the existing
[CC0 workshop derivatives](../workshop/README.md#material-sources).
The tileable water pattern and two site plaques are authored for the precinct.
The Pompeian red panels and frieze in Hefesto are built per solid wall bay
from the same opening dimensions as the shell. Sea, ground and rooms from
the HD study are outside this export. The visible closed leaves in the
receiving edition stand at the native door transitions. Plaques identify
those doors while Holodeck owns their actions, authorization and landing.

The precinct entrances use the authored XZ frames. Claymon is a separate
room with its own return door at XZ `(-3, -5.82)` and landing at
`(-3, -4.81)`. Each side of a passage records its threshold, landing,
floor height and yaw in its own frame. The stock 2.4 m interaction radius
keeps the Atelier action separate from the entrance. Bind logical cells
to approved room IDs through a revision-checked owning migration. Bind each
asset part through the existing room authorization and test departure,
re-entry and access revocation. The exporter writes no runtime state.

### Complete temple art edition

```sh
node art/linterna/precinct/hefesto-slice.mjs OUTPUT_DIR REVIEWED_WORKSHOP_GLB --all-temples
```

`linterna-all-temples.json` includes Athena's ochre foyer, its three study
rooms, Apollo's ivory and blue foyer, and its two sound and movement rooms.
The study and music room scenes have furnishings and an authorized door
placement contract. They carry no application endpoints or data.
The front of each temple appears in the arrival cell. Its foyer and site
interiors use their own room-local coordinates and are fetched in their own
authorization scopes. The original command still exports the four-cell
Hefesto edition.

`linterna-approach.glb`, built by `export.mjs`, contains the separate East 1
facade art with clay tiles, amber glass, dressed stone and cedar finishes.
Its envelope and corridor use the existing approach geometry. The walkable
precinct, expanded manifest, and facade are separate selections in a receiving
release. Use the existing exterior offer and keep all shared layout IDs,
grants and live app bindings under their owning integration.

### Importing the HD portico

```sh
node art/linterna/precinct/import-hd-portico.mjs AUTHORIZED_HD_SRC OUTPUT_DIR [BAKED_MASONRY_JPEG]
```

Pass a local copy of the selected Drive edition's editable `src` directory.
The importer calls the original shrine generator for masonry, columns and
door and lantern details, with reduced subdivisions. The shared portico
beam and roof provide a continuous volume with seated roof trim. The door
leaves are represented closed at the same threshold. The build records the
input hashes and both triangle counts. It exports only the exterior mesh.
Holodeck retains the East 1 approach, door action and collision authority.

The portico uses the HD palette in standard glTF materials. The optional
masonry map samples the original ashlar shader's base color on a +Z-facing
plane spanning X `[-2, 2]` and Y `[0, 2.5]` metres, stored top-down in an
sRGB JPEG under 48,000 bytes. Keep the authorized source and derived art in
their selected storage. The importer does not bundle the Drive source into
the runtime or replace the established facade automatically.
