# Manipulación de Materia

The editable Blender draft gives Casa de CompAII's Collection a naturally lit
working room, with a walk all the way around the worktable, shelves on the left
and a glazed archive turntable on the right. Named Blender empties mark the
entrance, stable shelf positions, model origin and archive rotation center.
The lamp and player-height camera in the editable file are reference lighting.
The export leaves room for the engine to attach real models and the game HUD.

Build with Blender 5.2.2:

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python art/collection/matter-workshop.py -- EMPTY_OUTPUT_DIRECTORY
```

The build generates one editable scene, one static GLB, named world-space
anchors and one player-height reference render. The runtime asset stays behind
the ordinary scoped room-art endpoint and can be selected through the existing
protected receiving configuration. Invisible cell geometry and the workshop's
furniture colliders support walking and room passage. The build itself does
not select a live room. See the [Collection contract](../../docs/houses.md#the-collection)
for publishing selection, the live worktable and archive interactions.

## Shelf edition derivative

Use the actual selected scene from the existing 3D Viewer builder after
normalization and, for legacy editions, authorized exact-version decoding.

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python art/collection/representative.py -- SELECTED_SCENE.json NEW_MODEL.glb
```

The input is the normalized millimeter scene. Source part colors and basic
silhouette survive the static export. The output is bounded at 4,800 triangles
and 384 KiB. Choose a representative scene before exporting. Pass an authored
representative for geometry that cannot be reduced within those bounds.
Tie the output digest to the exact project edition and scene. The same
publication authority and source grant govern the derivative. Keep the selected
full worktable model separate from these shelf assets.

The Blender producer was exercised against five exact retained reviews.
The exports came to 2,873–4,756 triangles and 216–315 kB. Each could be
imported and rendered in Blender. The shelf contents mounted in the isolated desktop and touch candidate. The
receiving index and exact-access contract are in [deployment](../../docs/deployment.md#receiving-contracts).
Live room selection and worktable refresh remain pending. The current three fixed gallery
displays are available through the existing viewer path.
