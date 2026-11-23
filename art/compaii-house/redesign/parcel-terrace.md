# Parcel terrace and coastal edge

The house street sits on a coastal shelf with a heath and basalt surface.
A shallower rock neck continues the route from the plaza. Recessed and
protruding strata carry the terrace edge down to the water. Wetter rock near
the waterline gives the terrace a visible base from the neighboring islands.

[Editable Blender scene](parcel-terrace.blend) · [Model recipe](parcel-terrace.py)

All distances are in world metres. The meadow and approach tops sit between
Y=.098 and .099. The existing Y=.1 public walking surface governs collision.
The authored cliff descends below the existing sea, with no new
walkable area. Small weathered stones mark the sides of each plot entrance.
The durable parcel envelopes, house walk and doorway remain spatially aligned.
The editable parts merge into one 57,768-byte material batch with vertex colours,
an original packed 128 px terrain-grain JPEG and no extra shadow passes.

To regenerate, pass a task-owned output directory to Blender 5.2.2.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/parcel-terrace.py -- "$ART_OUTPUT"
```
