# Foyer joinery and orientation table

The existing entry and limestone path lead past an oak table with a small
stone relief of the vestibule. A brass route follows the same bend around the
table from the exterior threshold to the internal passage. The relief shows
the foyer only. The game supplies door labels and actions for each
visitor's current permissions.

The west wall gains a limestone-backed oak bench, a basalt kick plate and a
continuous dado with a brass seam. The new seat occupies the wall edge so
visitors can pause outside the marked route. The table has the existing
footprint, with its collider brought up to the original table surface.

The [editable room source](casa-compaii-redesign.blend) and the named parts in
[`foyer_joinery()`](export_cells.py) build the selected foyer. The existing
Cycles rig rebakes albedo, normals, contact and diffuse light for the
installed model. The 20,260 triangles export in eight material batches with
four embedded textures, at 1,497,106 bytes with Brotli.

```sh
blender -b art/compaii-house/redesign/casa-compaii-redesign.blend -t 8 \
  --python-exit-code 1 -P art/compaii-house/redesign/export_cells.py -- "$ART_OUTPUT" foyer
```

[Previous entry](review/foyer-joinery-before.jpg) ·
[Entry](review/foyer-joinery-candidate-entrance.jpg) ·
[Orientation table](review/foyer-joinery-candidate-map.jpg) ·
[West wall bench](review/foyer-joinery-candidate-bench.jpg)

The packaged Chromium run started at the outside door. A simulated visitor
entered, walked past the table and beside the bench, then used the inner
door both ways and walked back to the public exit. Return used the original
exterior threshold in the same renderer. The exact foyer model was readable
from the foyer and returned HTTP 404 after the visitor entered the gallery.
