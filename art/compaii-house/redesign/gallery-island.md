# Outdoor gallery island

A limestone landing carries the west bridge onto the existing island. A basalt
margin and bronze fillet mark the route, opening to a radial apron where visitors
can stop while others cross. The pavilion uses limestone jambs, a celadon
panel, an oak sign and a standing-seam copper canopy. Both sides carry raised
lettering for the Sala de presentaciones. This is the outdoor presentation
landmark, distinct from the three-plinth exhibit gallery inside the Casa.

[Editable Blender scene](gallery-island.blend) · [Model recipe](gallery-island.py)

All visible parts in this pass are original Blender work. The runtime model uses
9,652 triangles and ten material batches. It transfers 79,243 bytes with Brotli.
Paving sits over existing walking surfaces. The pavilion keeps the original
presentation marker collision, nearby visit action and exact stage coordinates.
There is room to approach from either side of the bridge. The world still owns
creation bounds, and the existing viewer still owns edition and audience checks.

Rebuild in a task-owned output directory with Blender 5.2.2.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/gallery-island.py -- "$ART_OUTPUT"
```

[Previous pavilion](review/gallery-island-before-pavilion.jpg) ·
[New pavilion](review/gallery-island-candidate-pavilion.jpg) ·
[West landing](review/gallery-island-candidate-landing.jpg)

In a packaged Chromium run, a simulated visitor walked from the ordinary plaza
spawn, crossed the bridge and opened one pinned fixture report through the
nearby presentation control. Returning kept the same renderer and position
(within 0.01 m). The first render exposed a bracket across the sign. Adjusted
mounting blocks bring the lettering forward on both faces. The receiving check
matched the exact model, identity ranges and Brotli transfer over authenticated
HTTPS and independently read the original presentation anchor through the native
world route.
