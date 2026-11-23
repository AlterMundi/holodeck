# Arrival wayfinding

The [Blender source](commons-signs.blend) gives the plaza one two-sided
directory and four matching route markers. Dark enamel, ivory inlay and brass
edges use the same material family as the existing commons. The directory is
visible when arriving from the south. Its reverse flips the arrows for the
viewer approaching from the north.

The four markers confirm Jardín, Galería exterior, Casas and Mirador from
the plaza. Their opposite faces mark the route back to the plaza. The
mirador marker names the destination while the existing bridge control still
determines whether it can be reached. Galería exterior refers to the west
terrace. It is a separate destination from the protected gallery inside the
Casa de CompAII.

| Marker | Position in world X/Z |
| --- | --- |
| Directory | −3.06, −6.75 |
| Jardín | 8.15, 2.65 |
| Galería exterior | −8.30, 2.65 |
| Casas | 2.75, 8.25 |
| Mirador | 2.75, −8.10 |

The markers are decorative meshes outside the marked passage centre lines
and the plaza's editable rectangle. The existing world continues to own the
walking surface, bridge, destination coordinates and creation bounds. The
export adds five material batches and uses no textures or shadow passes.
The editable file retains the text objects and individual sign anchors.
The export merges the evaluated meshes by material.

Regenerate with Blender 5.2.2:

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  --python art/compaii-house/redesign/commons-signs.py -- "$ART_OUTPUT"
```

[Desktop player-height view](review/wayfinding-desktop.jpg) ·
[390 px touch-emulated arrival](review/wayfinding-touch.jpg)
