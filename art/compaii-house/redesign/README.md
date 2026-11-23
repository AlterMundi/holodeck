# Casa de CompAII and the garden court

This Blender scene is an original environment design. Its folded roof, oak
ribs and brass structural joints give the exterior, miniature and underground
chamber the same architectural identity. The foreground water line and
quiet planting point to a single house entrance. The lower stair opens into
a broad chamber with one illuminated prototype and two offset working bays.
The long, cooler gallery gives visitors room to look and pass one another.

## Player-height review

- [Arrival through the garden](review/garden.jpg)
- [House threshold and scale model](review/threshold.jpg)
- [Harmonic Beacon workshop from the stair](review/beacon.jpg)
- [Architecture of the collection room](review/gallery.jpg)

All geometry is authored in Blender. The visible benches are designed to open
the supported Spatializer and Weaver interfaces once those routes are qualified.
The instrument is an architectural reference. The live tool and exact published
prototype remain owned by their existing services. The gallery's three anchors
reserve space for drafts, published versions and the archive under their
existing audiences. No source files, runtime permissions or device operations
are implied by the scene.

## Source and delivery

Open the [editable Blender scene](casa-compaii-redesign.blend) or regenerate
it from the authored source. The scene contains the original materials and
light rigs with no linked libraries or external textures.

Run Blender 5.2.2 on an empty, task-owned output directory:

```sh
blender -b --factory-startup -t 8 --python-exit-code 1 \
  -P art/compaii-house/redesign/house.py -- "$ART_OUTPUT" garden threshold beacon gallery
```

The script creates a compressed, editable Blender scene and four eye-height
Cycles views. The visible cells, work anchors and light guides have separate
collections. The photos show Blender lighting. Bake the authored material color,
normal and contact detail for WebGL and calibrate light against the real
renderer. Use one room-local shadowed key and non-shadowing fill in the lab.
Align separate walkable colliders and stable entrances to the authored cells
before replacing the current visible shell. Record transfer, draw calls,
decoded texture use and movement timing at the same viewpoints on desktop
and a physical phone. See the [environment production plan](../../../docs/shared-roadmap.md#environment-art-production).

## Blender to WebGL

Export each selected collection from a fresh load of the editable scene:

```sh
for cell in garden facade foyer beacon gallery gallery-sealed; do
  blender -b "$ART_OUTPUT/casa-compaii-redesign.blend" -t 8 --python-exit-code 1 \
    -P art/compaii-house/redesign/export_cells.py -- "$EXPORT_OUTPUT" "$cell"
done
blender -b art/compaii-house/redesign/listening-tower.blend -t 8 --python-exit-code 1 \
  -P art/compaii-house/redesign/export_cells.py -- "$EXPORT_OUTPUT" tower
```

The two gallery exports build the limestone sill, lower wall and skirting in
the room's existing coordinates. Both bake a 512px contact map with a short
occlusion radius, alongside their color and normal maps. The open version keeps
the real stair opening. In Holodeck one soft shadowed key follows the
clerestory, with weaker warm bounce and room fill. Review the player-height
[before](review/gallery-light-before.jpg) and [after](review/gallery-light-after.jpg) views.

The foyer export registers the oak gallery door and clerestory against the
existing room coordinates. An inlaid limestone route bends around the table
to the gallery door. Its visual mesh sits flush with the engine's walkable
floor and does not add collision. The 512px contact bake and the soft key
connect the oak, stone and copper under the same light. Compare
[the approach before](review/foyer-route-before.jpg),
[the approach after](review/foyer-route-after.jpg) and
[the gallery door from the path](review/foyer-gallery-door.jpg).

The [listening tower](listening-tower.blend) has its own editable room-scale
source and can be regenerated with `tower.py`. It uses a warm wall resonator
and cool clerestory light as orientation points. The existing return portal
retains its address in the shared world. [Approach](review/tower-approach.jpg) ·
[Return](review/tower-return.jpg).

The [arrival commons](holodeck-commons.blend) can be regenerated with
`commons.py`. It replaces the main terrace and both connecting decks in
their existing coordinates. The center remains open for creation and
gathering. A shaded bench and tree frame the arrival without crossing the
main walking lines. The neighboring islands and room entrances keep their
existing geometry addresses. [Arrival](review/commons-spawn.jpg) ·
[Garden approach](review/commons-garden-approach.jpg) ·
[House approach](review/commons-house-approach.jpg).

The export evaluates the actual modeled details, bakes one color atlas
and one tangent normal atlas per cell (1024², or 768² for the tower), and preserves the material batch
boundaries and their scalar metalness, roughness and emission. The GLBs embed
their images and use core glTF without a required decoder. Each cell is
bounded at 4 MiB and 64,000 triangles. PNGs alongside the GLBs are disposable
bake outputs. The JSON inventories report bytes, triangles, primitives and
room-local bounds. Keep Blender area lights and camera setups in the source.

| Cell | GLB bytes | Triangles | Material primitives |
| --- | ---: | ---: | ---: |
| Garden | 1,747,624 | 15,728 | 11 |
| Parcel facade | 2,550,804 | 15,232 | 9 |
| Foyer | 1,536,588 | 6,700 | 7 |
| Beacon laboratory | 2,644,700 | 28,416 | 9 |
| Gallery with stair | 1,615,544 | 7,168 | 6 |
| Gallery with continuous floor | 1,550,224 | 5,640 | 6 |
| Listening tower | 1,983,396 | 26,056 | 10 |
| Arrival commons | 582,668 | 14,880 | 10 |

The laboratory export registers the authored chamber to the existing room.
It rebuilds the visible six-tread stair and rail at the existing activation
location. The walkable floor, wall and stair collision keep their current
engine definitions. During local browser qualification the model travels
through the existing room-scoped asset route. A room-local key supplies
shadow and three low-cost lights fill the workstations and stair. The
existing published runtime selects its established room asset.

The exterior facade is registered to the existing west parcel with its front
facing the aisle and its measured dimensions inside the lot. The smaller
house model in the garden shares the architectural source. Indoors the
registered hall preserves the doorway and leaves navigation space around the
table. The collection gallery has two art revisions. The permitted viewer
sees the authored stair. The other revision has a continuous floor. Both use
the same gallery ID and exhibition anchor, and the server serves only the
variant suited to the visitor's currently permitted passages.

The published exhibit anchor remains at `(2.5, .1, 1.25)` in gallery-local
meters. The draft and archive anchors are at `(3.3945, .1, -.34944)` and
`(3.3945, .1, 3.67744)`. They use the exact review pins selected in the
protected receiving configuration. The published anchor preserves the
existing owner placement. Holodeck checks each source through Nexus before
offering to open it at its pedestal. The renderer fits the existing
protected snapshot inside the authored case, above the plinth top. It omits
the horizon water from the display, matching the existing review export. The
immutable source, normal Nexus controls and publication audiences remain
authoritative. Scenes without a supported static snapshot still have their
ordinary versioned opening action when authorized.

Generate the retained surrounding scenery with
`tools/create-island-scenery.mjs --atelier-surroundings` and a task-owned
`.state` output path. This leaves the neighboring islands and horizon in
place while the new exports replace the eastern dressing, central terrace
and connecting decks. The checked-in exports are selected by
`compaii-atelier-v1` in [the receiving configuration](../../../docs/deployment.md#receiving-contracts).
The server verifies the asset hashes and exact room layout before enabling
this profile. The current scenery is also packaged for use without the
selector.

The [garden](review/connected-garden.jpg), [facade](review/connected-facade.jpg),
[foyer](review/connected-foyer.jpg) and [gallery](review/connected-gallery.jpg)
were captured from the connected fixture in the actual WebGL client. The actor
walked the round trip through the existing doors and stair. The layout probes
do not represent live exhibit authorization or a physical-phone test.

[Laboratory in the real WebGL client](review/beacon-webgl.jpg). The isolated
desktop Chromium run exercised the stair in both directions, verified two
shared texture instances and one shadow-casting lamp, and retained the
prototype descriptor. A separate fixture had access to the gallery and was
denied both entry to the lab and direct art retrieval. This exercises the
existing renderer and room authority. Touch and physical-device performance
require their own receiving checks.

The supported first control handoff is the authenticated
[Harmonic Lab panel](https://compaii.dmn.homes/harmonic_lab/). Walk toward
the Spatializer or Weaver bench to open its tool card in a separate tab.
Returning to the world tab resumes at the same position. The world keeps the
selected bench as a situated reference while it remains nearby. The panel
reads readiness and owns the existing explicit actions. Spatializer and
body Weaver interfaces open from the selected receiver's browser. The
headless Weaver router remains a separate documented option.
[Owning panel contract](https://github.com/AlterMundi/harmonic-weaver/blob/73f08bcc2c8119cba34e10d661d26f4f9773657f/docs/laboratory/integrations/CONTROL_PANEL.md).
