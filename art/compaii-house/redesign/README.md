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
