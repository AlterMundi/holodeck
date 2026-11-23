# Interior furnishings for owned rooms

The **Listening workshop** has an acoustic tuning bench, brass resonator and
slatted soundbox. The **Project archive** has a limestone reading table, blank
folio and a brass-inlaid archival cabinet. The two kits share warm ash,
limestone, patinated metal and visible joinery. The workshop has amber glazing
and timber coffers. The archive uses jade glass and cool stone against a
cream ceiling. Both are original Blender geometry with scalar materials. The folio and resonator are scenery. The
active room and its authorized project exhibit continue to resolve through
Holodeck and the existing source viewer.

The kits fit the same two furniture volumes in the existing room. The
room-local coordinate system is glTF and Holodeck's X, up Y and Z, in
meters. Each row gives a box center followed by its dimensions.

| Furniture | X | Y | Z | Width | Height | Depth |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Work surface | -1.55 | .64 | .25 | 1.18 | 1.08 | 1.86 |
| Cabinet or resonator | 1.55 | .845 | -.85 | 1.18 | 1.49 | 1.70 |

The Blender export checks every mesh vertex against these boxes and the
wall and ceiling bounds. The wall details sit behind the passage faces
and room title. A coffered ceiling with brass reveals replaces the
open top. The floor, underlying wall colliders, doors and stair openings
remain supplied by the existing room geometry. The project exhibit
at X 2.5, Z 1.25 lies outside the furniture volumes.

## Build and review

Run Blender 5.2.2 inside the project. The optional second path receives two
editable Blender scenes and two eye-height review images. The images include
the ordinary floor for context and use Blender lights. Holodeck supplies its
runtime lighting. Exact byte comparisons to the checked-in GLBs can be made
with the same Blender build.

```sh
blender -b --factory-startup -t 8 --python-exit-code 1 \
  -P art/owned-rooms/rooms.py -- public/room-art "$REVIEW"
```

The GLBs are self-contained core glTF without textures, decoder dependencies
or remote references. Converted export copies batch all surfaces of one
material as one primitive. The original editable geometry remains separate
by part.

| GLB | Bytes | Triangles | Primitives |
| --- | ---: | ---: | ---: |
| owned-listening-workshop.glb | 505,760 | 9,344 | 13 |
| owned-project-archive.glb | 534,332 | 9,176 | 14 |
