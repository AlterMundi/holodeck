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

### Apply the HD finishes to the functional model

```sh
node art/linterna/precinct/apply-hd-finishes.mjs BASE_EDITION_DIR BASE_FACADE_GLB BAKED_MAP_DIR OUTPUT_DIR
```

Use the all-temples manifest and the corresponding facade export of the
functional model. Apply maps sampled from the selected source shaders as
base color and tangent-space normals to the existing UV slots. Use paired
`NAME.jpg` and `NAME-normal.jpg` files for `marble`, `cedar`, `terracotta`,
`paving`, and `fresco`. Keep those maps with the authorized edition. The
profiles use the existing UV scale, including 1.6 m for stone and 1.32 m
for cedar on most architectural faces.

This pass preserves the original binary geometry, node transforms, meshes
and accessors. The manifest changes only model filenames, checksums and byte
counts. Floors, colliders, passages and the Claymon GLB retain their exact
previous selections. The normal maps add relief at shading time. The
exporter checks each part against the receiver's budget and records the
source and finish digests.

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

### Reviewing the repaired HD scene and importing the portico

```sh
node art/linterna/precinct/build-hd-review.mjs AUTHORIZED_HD_SRC AUTHORIZED_TEMPLATE OUTPUT_HTML
node art/linterna/precinct/import-hd-portico.mjs AUTHORIZED_HD_SRC OUTPUT_DIR [BAKED_MASONRY_JPEG]
```

Pass a local copy of the selected Drive edition's editable `src` directory
and its HTML template. Both builds call the original geometry generators.
The roof fits its tile grid and ridge within the deck and joins the raking
trim and stepped corner cornices in place. The fluted shafts face outward
and seat inside the top collar of each attic base. The visual tour also splits
painted wall skins into bays and lintels around the original door
dimensions and restores the annular terrain in the carved atlas tray.
The tour repairs the joints between plinths, platforms and rails, seats
sculptures and room props on their actual supports, and fits the Atlas
landmarks to the terrain height at their footprints.
The review keeps the source lights, shadows, vegetation and tour with
site URLs omitted. Open the generated preview in a WebGL browser.

The preview budgets 30 rendered frames per second during navigation.
It adapts the number of rendered pixels using measured wall time, draws
the scene directly while the camera moves, and restores only the effects
the device can afford after it stops. Even at the lowest quality the same
collision and tour data drive navigation. Individual buildings and
vegetation patches can be culled separately. Distant columns use a
simpler tapered mesh and grass thins with distance. The small gold stars
in the coffers are an alpha-tested texture on two triangles each. A
shared repeating noise texture replaces expensive material noise during
movement while keeping the fresco patterns and surface palettes.

The portico importer reduces subdivisions and quantizes its exported
attributes. Its report records the source hashes and both triangle counts.
It exports the exterior mesh. Holodeck retains the East 1 approach, native
door action and collision authority. The standalone review runs the visual
tour independently of the shared world.

The portico uses the HD palette in standard glTF materials. The optional
masonry map samples the original ashlar shader's base color on a +Z-facing
plane spanning X `[-2, 2]` and Y `[0, 2.5]` metres, stored top-down in an
sRGB JPEG under 48,000 bytes. Keep the authorized source and derived art in
their selected storage. The importer does not bundle the Drive source into
the runtime or replace the established facade automatically.
