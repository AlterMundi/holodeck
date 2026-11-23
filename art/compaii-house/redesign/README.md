# Casa de CompAII and the garden court

This Blender scene is an original environment design. Its folded roof, oak
ribs and brass structural joints give the exterior, miniature and underground
chamber the same architectural identity. The foreground water line and
quiet planting point to a single house entrance. The lower stair opens into
a broad chamber with one illuminated prototype and two offset working bays.
The long, cooler gallery gives visitors room to look and pass one another.

## Player-height review

- [Arrival through the garden](review/garden.jpg)
- [House threshold and scale model](review/threshold.jpg)
- [Harmonic Beacon workshop from the stair](review/beacon.jpg)
- [Architecture of the collection room](review/gallery.jpg)

All geometry is authored in Blender. The visible benches are designed to open
the supported Spatializer and Weaver interfaces once those routes are qualified.
The instrument is an architectural reference. The live tool and exact published
prototype remain owned by their existing services. The gallery's three anchors
reserve space for drafts, published versions and the archive under their
existing audiences. No source files, runtime permissions or device operations
are implied by the scene.

## Source and delivery

Open the [editable Blender scene](casa-compaii-redesign.blend) or regenerate
it from the authored source. The scene contains the original materials and
light rigs with no linked libraries or external textures.

Run Blender 5.2.2 on an empty, task-owned output directory:

```sh
blender -b --factory-startup -t 8 --python-exit-code 1 \
  -P art/compaii-house/redesign/house.py -- "$ART_OUTPUT" garden threshold beacon gallery
```

The script creates a compressed, editable Blender scene and four eye-height
Cycles views. The visible cells, work anchors and light guides have separate
collections. The photos show Blender lighting. Bake the authored material color,
normal and contact detail for WebGL and calibrate light against the real
renderer. Use one room-local shadowed key and non-shadowing fill in the lab.
Align separate walkable colliders and stable entrances to the authored cells
before replacing the current visible shell. Record transfer, draw calls,
decoded texture use and movement timing at the same viewpoints on desktop
and a physical phone. See the [environment production plan](../../../docs/shared-roadmap.md#environment-art-production).

## Blender to WebGL

Export each selected collection from a fresh load of the editable scene:

```sh
for cell in garden house beacon gallery; do
  blender -b "$ART_OUTPUT/casa-compaii-redesign.blend" -t 8 --python-exit-code 1 \
    -P art/compaii-house/redesign/export_cells.py -- "$EXPORT_OUTPUT" "$cell"
done
```

The export evaluates the actual modeled details, bakes one 1024² color atlas
and one tangent normal atlas per cell, and preserves the material batch
boundaries and their scalar metalness, roughness and emission. The GLBs embed
their images and use core glTF without a required decoder. Each cell is
bounded at 4 MiB and 64,000 triangles. PNGs alongside the GLBs are disposable
bake outputs. The JSON inventories report bytes, triangles, primitives and
room-local bounds. Keep Blender area lights and camera setups in the source.

| Cell | GLB bytes | Triangles | Material primitives |
| --- | ---: | ---: | ---: |
| Garden | 1,747,624 | 15,728 | 11 |
| House | 2,009,508 | 15,232 | 9 |
| Beacon laboratory | 2,644,700 | 28,416 | 9 |
| Gallery | 1,461,052 | 5,628 | 6 |

The laboratory export registers the authored chamber to the existing room.
It rebuilds the visible six-tread stair and rail at the existing activation
location. The walkable floor, wall and stair collision keep their current
engine definitions. During local browser qualification the model travels
through the existing room-scoped asset route. A room-local key supplies
shadow and three low-cost lights fill the workstations and stair. The
existing published runtime selects its established room asset.

[Laboratory in the real WebGL client](review/beacon-webgl.jpg). The isolated
desktop Chromium run exercised the stair in both directions, verified two
shared texture instances and one shadow-casting lamp, and retained the
prototype descriptor. A separate fixture had access to the gallery and was
denied both entry to the lab and direct art retrieval. This exercises the
existing renderer and room authority. The full assembled route, touch and
physical-device performance require their own receiving checks.

The supported first control handoff is the authenticated
[Harmonic Lab panel](https://compaii.dmn.homes/harmonic_lab/). Its readiness
view performs no audio or camera start. Spatializer and body Weaver currently
open on the selected receiver's browser. The remote headless Weaver router
is a separate documented option. Qualify the intended user and receiver
before putting a working control label on either bench.
[Owning panel contract](https://github.com/AlterMundi/harmonic-weaver/blob/73f08bcc2c8119cba34e10d661d26f4f9773657f/docs/laboratory/integrations/CONTROL_PANEL.md).
