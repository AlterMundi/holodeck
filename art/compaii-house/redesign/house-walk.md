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

To regenerate from the authored model recipe, select task-owned art and
asset output directories and use Blender 5.2.2.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/house-walk.py -- "$ART_OUTPUT" "$ASSET_OUTPUT"
```
