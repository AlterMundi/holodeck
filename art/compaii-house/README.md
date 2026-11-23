# Casa de CompAII

The current Blender level is a house that can grow one wing at a time.
The garden has a reflecting pool, seats and a dedicated outdoor work patio.
A low stone entrance frames the tall shared atrium. From there, one wide
stair descends into the warm acoustic lab and one direct stair climbs to the
cool Sensorial gallery. Both use the same visible table and skylight as
orientation landmarks. Materials and proportions tie the wings together
while allowing each addition to have a purpose and an individual character.

Two project rooms and a courtyard form the starting house. Leave intentional
edges for a future workshop, leisure room or greenhouse. Add the next room
where it serves a job and gives an intelligible connection to the main house.
Generalize the same placement flow for furniture, authorized active workstations
and game objectives. The patio's outdoor bench is the first example of a
placement slot. An authorized owner should be able to preview a replacement,
see clearances and access, publish a durable revision and recover the previous
layout without relearning the engine. The Blender study shows those positions;
the normal player-facing creator is tracked in #15.

The previous three parallel rooms remain an archived study in `model.py`.

| Place | Spatial intent | First supported working binding |
| --- | --- | --- |
| Shared table | Orient, decide what to work on, and return to the same discussion or project revision. | Existing situated Conversation and authorized, version-pinned Nexus exhibits. |
| Harmonic Beacon Lab | Walk around the instrument prototype, listen, adjust an experimental setting, and compare what changed at the adjacent bench. | Start from an existing revisioned prototype with the owner's viewer. Bind a reversible software control through the owning Beacon service once its scoped operation and readback fit. |
| Sensorial | Compare a recorded run on the observation wall, inspect its provenance and examine it from the analysis console. | First bind one genuine, authorized retained run from the existing Sensorial bench. For live work, use a selected source-bound feed and distinguish measured samples, derived analysis and stale data. Scope any device operation through the existing owner. |

The panels and prototype currently show architectural placeholders. Sample
traces are drawn in the artwork and labeled as an interface study. There is no
live instrument operation, device connection, or whole-house runtime placement.
The next integration should map the authored visual geometry and approved
colliders to the existing independent room projections and preserve the current
doorway, source access and ordinary return. Connector names and camera
locations in this study are authoring data, separate from room authority.

Decorative objects can come from reusable catalogs when they fit the space.
The garden incorporates the first compact derivative from the
[asset intake and qualification workflow](assets/README.md).

## Wayfinding and interface

- Architecture leads: the threshold, atrium light, stair and distinctive
  lab entrances establish direction before overlays are needed. Use short
  place names on mounted stone or metal plaques in the approach line of
  sight. At a two-way junction, indicate both approaches. Check size and
  contrast in motion at player height and from both directions.
- A single contextual action sits near the lower center when a station is
  in range. Show its verb and recognizable name, plus the key or the
  touch affordance. Give the same place a spatially stable position and
  a persistent identity. This way, the architecture still reads while
  an actionable station provides clear feedback and keyboard focus.
- Protect the center of the view. Use a compact room label on arrival and
  a focused panel for actual data, tools or conversation. Keep long text
  and routine debug status off the scenery. A dedicated panel can expose
  measurements, units, source, timestamp and status when the player opens
  the control. Check the real interface at phone width and with reduced motion.

The supplied HUD illustration is a design study over the Blender view. It
does not represent installed controls. The actual rendering, input layout
and accessibility have their own browser acceptance.

## First playable mounting

The original Beacon workshop objects also have a room-local export. Blender
batches the materials into seven meshes, with 21,184 triangles and no textures
or decoder extensions. The 801,332-byte GLB is attached to the already
authorized CompAII laboratory. Its current stairs, entry/exit and situated
room identity provide the walkable integration boundary. Simple collision
proxies cover the prototype base and console. Scene authorization applies to
the GLB as well as the room markup. The console and instrument remain visual
studies pending independent, real project control bindings.

The **Banco de prototipos** at the authored workbench opens the existing
54-part H.B. Guitar prototype review, published edition `935e6262`. Its
room-local station and physical label share one identity and revision.
The room does not add a public outdoor source node or copy the artifact.
The visit is served by the existing protected Nexus descriptor and Home
source, which continue to decide viewer access. The station revision
must advance if its authored selection or position changes.

A ready visit can supply a workstation reference when sending from the
continuing Conversation. Holodeck checks the station and revision against
the authorized room snapshot and retains the matched reference. Source
IDs, renderer state and media stay with their existing viewer.

```sh
blender -b "$ART_OUTPUT/Casa de CompAII - Nivel.blend"   --python-exit-code 1 -P art/compaii-house/export_beacon_room.py --   public/room-art/beacon-workshop.glb
```

## Reproduce and review

From the Holodeck checkout, run Blender 5.2.2 with the scene script and a small
task-owned output directory on the project data filesystem.

```sh
blender -b --factory-startup --python-exit-code 1 -t 8 \
  -P art/compaii-house/level.py -- "$ART_OUTPUT"
```

The script tests walking-floor support along the continuous route at 15 cm
intervals and checks that the centerline camera is clear. It saves a
compressed editable file and six Cycles views taken from player height.
This is a Blender scene qualification. Runtime locomotion, collision and
controls require the existing Holodeck integration: align the authored
floors/rails with allowed traversal, export the visible sections per their
scope, and qualify the walk and return in a real client. Review source
authorization and any reversible control separately from art.

- [Holodeck house contract](../../docs/houses.md)
- [Harmonic Beacon source](https://github.com/nicoechaniz/harmonic-beacon-webapp)
- [Sensorial accepted bench baseline](https://github.com/compaii/HarmonicBeaconCenter/blob/c163931/implementation/sensory-system/linux-rust/PLATFORM-ACCEPTANCE.md)


## Design references

- [ESO Homestead](https://www.elderscrollsonline.com/en-us/updates/update/homestead)
  informs the idea of a personal, furnished residence with activities.
- [Roblox creation templates](https://create.roblox.com/docs/experiences)
  inform the ease of recombining working game elements.
- [Shared MMORPG roadmap](../../docs/shared-roadmap.md#mmorpg-experience-and-creator-loop)
