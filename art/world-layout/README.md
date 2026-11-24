# Coastal settlement layout study

This independent Blender draft lays out the shared world as a coastal settlement.
It studies route hierarchy and sightlines. The live parcel coordinates, doors,
creations, permissions and retained room state remain in the existing world.

The arrival overlooks the basin and reveals three destinations without a map.
The garden occupies the sunny edge on the way to the Casa terrace. The quieter
gallery is on the water side, off the main route so visitors can stop without
blocking traffic. A crescent of buildable parcels has two connections to the
public path, with streets along the waterfront and uphill. The tower at the
bend is a distant landmark with a return path to arrival. Reserve an inland edge
for later rooms and district expansion. The Beacon lab stays below the Casa
and has its own room permissions.

Open the [editable draft](coastal-settlement.blend) or see the [plan view](coastal-settlement-plan.jpg). Units are metres.
Numbers are exploratory and will need translation onto the canonical world
placements before any receiving test. Draft blocks indicate volumes and land
use. They have no runtime colliders, assets or source publication grants.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  --python art/world-layout/coastal-settlement.py -- /path/to/draft-output
```

The script saves a named editable scene and a plan view. The level-design
checkpoint is the loop from arrival through the garden, Casa and parcel
promenade back via the tower, with the gallery branch clearly visible. Check
the main landmarks from eye height along the route before turning this study
into production terrain and architecture.

## Continuous valley

The Atelier's new outdoor layout is a connected 108 × 108 m landscape. The
existing spawn and Casa de CompAII entrance are on the same flat datum. The
house is approached on a dirt trail through the valley. Higher ground wraps
around a sheltered pond and a recessed cave entrance. The cave descends under
the east ridge and has an authored floor, side walls and roof.

`continuous-valley.blend` is editable. Rebuild with Blender 5.2.2:

```sh
blender --background --python-exit-code 1 \
  --python art/world-layout/continuous-valley.py -- OUTPUT_DIR
```

The ground, cave and ramp share the walkable GLB. Water and pines are a
separate non-colliding asset so water is not a platform. The outdoor projection
keeps the existing authenticated house entrance and room graph. Trial islands,
bridge, gallery, garden objects and other trial facades are out of the selected
exterior. The persisted room, house and creation records remain available for
recovery. The appearance work inside the house has its own asset selection.
