# West verge garden

Limestone paths loop between the public aisle and the coast beside Casa de
CompAII. Salt-tolerant grass and thrift grow along the exposed edge. Two
wind-shaped bays and an oak seat give the walk a shaded pause facing the
houses. Both cross paths remain outside the assigned parcel footprints.

[Editable Blender scene](parcel-garden.blend) · [Model recipe](parcel-garden.py)

The planting reuses the original coastal foliage and atlas from the commons.
The asset uses 4,897 triangles in nine material batches and transfers 151,767
bytes with Brotli. The original terrace remains the walking surface beneath
the flags. Three localized collision boxes match the seat and lower trunks.
The house doors and parcel coordinates retain their existing positions.

In packaged Chromium a simulated visitor walked from the ordinary spawn to
the Casa, entered and returned with E, then followed the west path past the
seat. The return landed at the original threshold in the same document.
The model and foliage atlas loaded in the running game. The first walk
showed leaves in the way of the camera, so the final Blender export raises
the crowns above the walk.

[Previous layout](review/parcel-garden-before-garden-layout.jpg) ·
[Landscaped layout](review/parcel-garden-candidate-garden-layout.jpg) ·
[View from the walk](review/parcel-garden-candidate-garden.jpg)

The two layout captures use an elevated review camera.

To rebuild with Blender 5.2.2, select one task-owned output directory.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/parcel-garden.py -- "$ART_OUTPUT"
```
