# The house walk

The arrival promenade continues into a limestone walk edged with brick and
basalt. The paving turns across the public verge at each parcel. The Casa de
CompAII branch reaches its recessed façade, so the change of direction toward
the door is visible from the middle of the street.

[Editable Blender source](house-walk.blend) · [Model recipe](house-walk.py)

The model is authored in world metres and exported as four material batches
with vertex colours. The 258,952-byte GLB uses no textures or shadow passes.
The existing grounds, parcel dimensions, facade colliders, entry permissions
and door anchors remain the authority for movement and entry. The selected
atelier profile replaces the former plain strip with this visual overlay.
Other profiles retain their existing projection.

## Player-height review

[Previous junction](review/house-walk-before.jpg) ·
[Revised junction](review/house-walk-candidate.jpg)

Both frames come from the packaged browser using the ordinary arrival
spawn and keyboard movement. The revised trial walked up the approach,
turned at the house lane, entered the foyer with E and used E to return
to the same exterior anchor on the same page. The measurements from
this software-rendered trial were 1.31 s in and 1.67 s back. The unfinished
parcel surface reads as a flat slab around the masonry and remains part
of the foreground terrain pass.

To regenerate from the authored model recipe, select task-owned art and
asset output directories and use Blender 5.2.2.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/house-walk.py -- "$ART_OUTPUT" "$ASSET_OUTPUT"
```
