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
