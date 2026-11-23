# Outdoor gallery island

A limestone landing carries the west bridge onto the existing island. A basalt
margin and bronze fillet mark the route, opening to a radial apron where visitors
can stop while others cross. The pavilion uses limestone jambs, a celadon
panel, an oak sign and a standing-seam copper canopy. Both sides carry raised
lettering for the Sala de presentaciones. This is the outdoor presentation
landmark, distinct from the three-plinth exhibit gallery inside the Casa.

[Editable Blender scene](gallery-island.blend) · [Model recipe](gallery-island.py)

The limestone court joins the landing to the existing pavilion. Chair-height
oak slats on basalt feet form a seaward seat beyond the creation rectangle.
The court is flush with the established walking surface and has basalt seams
and narrow bronze inlays. The older west stone, copper, path and lantern
batches are retired from the selected surroundings GLB. All other scenery
primitives and the source binary buffers are retained.

The Blender model uses 13,956 triangles and ten material batches. Paving sits
over existing walking surfaces. The pavilion keeps the original
presentation marker collision, nearby visit action and exact stage coordinates.
There is room to approach from either side of the bridge. The world still owns
creation bounds, and the existing viewer still owns edition and audience checks.

Rebuild in a task-owned output directory with Blender 5.2.2.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/gallery-island.py -- "$ART_OUTPUT"
```

To rebuild the paired surroundings variant, save
`git show ff4a17c:public/assets/island-scenery-atelier.glb` in the task
directory and pass that file as the second argument. The recipe verifies its
digest and the bounds and counts of every removed primitive.

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
