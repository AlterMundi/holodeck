# Casa de CompAII

An original Blender architectural study for the existing CompAII house in
Holodeck. The arrival leads to a shared table. Two adjacent low thresholds
connect the labs from inside, so a joint work session can move between an
instrument design and the observations used to evaluate it. Exposed ribs,
mineral surfaces, brass and a continuous slate floor tie the house together.
Warm concentric geometry marks Harmonic Beacon. A cool gridded observation
wall marks Sensorial. The editable model keeps architecture, both workspaces,
shared furniture, lights and review cameras in named Blender collections.

| Place | Spatial intent | First supported working binding |
| --- | --- | --- |
| Shared table | Orient, decide what to work on, and return to the same discussion or project revision. | Existing situated Conversation and authorized, version-pinned Nexus exhibits. |
| Harmonic Beacon Lab | Walk around the instrument prototype, listen, adjust an experimental setting, and compare what changed at the adjacent bench. | Start from an existing revisioned prototype with the owner's viewer. Bind a reversible software control through the owning Beacon service once its scoped operation and readback fit. |
| Sensorial | Compare a recorded run on the observation wall, inspect its provenance and examine it from the analysis console. | First bind one genuine, authorized retained run from the existing Sensorial bench. For live work, use a selected source-bound feed and distinguish measured samples, derived analysis and stale data. Scope any device operation through the existing owner. |

The panels and prototype currently show architectural placeholders. Sample
traces are drawn in the artwork and labeled as an interface study. There is no
live instrument operation, device connection, or verified in-world placement.
The next integration should map the authored visual geometry and approved
colliders to the existing independent room projections and preserve the current
doorway, source access and ordinary return. Connector names and camera
locations in this study are authoring data, separate from room authority.

## Reproduce and review

From the Holodeck checkout, run Blender 5.2.2 with the scene script and a small
task-owned output directory on the project data filesystem.

```sh
blender -b --factory-startup --python-exit-code 1 -t 8 \
  -P art/compaii-house/model.py -- "$ART_OUTPUT"
```

The script produces one compressed editable Blender scene, three original
Cycles views, and a neutral GLB candidate with no runtime data or external
resources. Keep the editable model and the chosen camera setup. Before
in-world delivery, export by room, choose a measured draw and byte budget,
align the authored openings with collision, and walk arrival and return
from the actual third-person camera. Review the two project inputs separately
from mesh qualification. The served house continues to have its own scope
and revision.

- [Holodeck house contract](../../docs/houses.md)
- [Harmonic Beacon source](https://github.com/nicoechaniz/harmonic-beacon-webapp)
- [Sensorial accepted bench baseline](https://github.com/compaii/HarmonicBeaconCenter/blob/c163931/implementation/sensory-system/linux-rust/PLATFORM-ACCEPTANCE.md)
