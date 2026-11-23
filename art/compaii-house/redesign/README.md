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
- [The walk from the plaza to the house](house-walk.md)
- [Parcel terrace and coastline](parcel-terrace.md)
- [West verge garden and path](parcel-garden.md)
- [Outdoor gallery island and presentation pavilion](gallery-island.md)
- [North Mirador](mirador.md)
- [East Garden, playable meadow and sea arbor](east-garden.md)
- [Foyer joinery and orientation table](foyer-joinery.md)
- [Harmonic Beacon workshop from the stair](review/beacon.jpg)
- [Architecture of the collection room](review/gallery.jpg)

All visible architecture and instruments in this scene are authored in Blender.
The bench controls open the embedded Spatializer and Weaver panels near their
respective instruments.
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
for cell in garden facade foyer beacon beacon-return gallery gallery-sealed; do
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

The [Cycles lighting reference](review/foyer-cycles-reference.jpg) and
768px linear EXR show the indirect diffuse illumination of the same registered
foyer. The runtime export bakes direct and indirect diffuse light in one pass,
then multiplies it by the exact albedo in linear color. FFmpeg writes a
512px sRGB JPEG, which Blender embeds as a glTF emissive texture on the
non-emissive surfaces. Metallic surfaces receive proportionally less diffuse
light. The lamps keep their original emission. The real-time key and lower
ambient fill provide moving-character light and shadows.
See the [baked lighting in the game renderer](review/foyer-baked-light.jpg)
from the foyer approach used for the earlier comparison.

The Beacon lab uses the same export pipeline. Four area lights in Cycles
give separate pools of light to the stair, the central instrument and the
Spatializer and Weaver benches. The runtime uses a softer shadowed key and
keeps the bench lights. The lighting matches the existing geometry and
collision. See the [stair reveal before](review/beacon-light-before.jpg)
and [after](review/beacon-light-after.jpg) in the game renderer.

### Gallery exhibition bays

A framed clerestory and a suspended lighting rail distinguish the viewing path
from the collection wall. Three oak-framed, matte stone bays back the existing
plinths, and a warm inset behind the collection sign makes the lettering legible
from the entrance. The bronze floor seams guide the walk through the room.
The three display points keep their original positions and audience. The
working bay has an oak trestle bench with a blue inset and tool drawer. The
finished bay uses a limestone pedestal with a bronze reveal and dark oak top.
The archive uses a five-drawer flat file with recessed bronze pulls. The
joinery is modeled in Blender in [the registered gallery export](export_cells.py).
Both permission variants share these fittings, which carry no source labels or
models. The permitted lab stair and the continuous visitor floor keep separate
exports.

[Previous fittings at player height](review/gallery-furniture-before.jpg) ·
[Workbench, pedestal and flat file at the same camera](review/gallery-furniture-after.jpg)

[Previous entry](review/gallery-finish-before-entry.jpg) ·
[Revised entry](review/gallery-finish-revised-open-entry.jpg) ·
[Collection wall](review/gallery-finish-revised-open-collection.jpg) ·
[Restricted visitor floor](review/gallery-finish-revised-sealed-collection.jpg)

Both exports use the editable gallery cell, the named fittings in
[`register_gallery()`](export_cells.py) and the same Cycles lighting
rig. The static diffuse map remains 512 px. The stair variant batches the
geometry into 11 glTF primitives and the continuous-floor variant into 10.
The runtime key still lights the moving avatar. Browser trials used the
existing camera and collision over both floor variants.
The exact same packaged rooms also rendered three distinct fixture works
for the admitted actor and one for the limited visitor. The archive
disappeared after its source access was revoked.
[Admitted actor fixture](review/gallery-finish-owner-fixture.jpg) ·
[Limited visitor fixture](review/gallery-finish-visitor-fixture.jpg)


### Beacon joinery and workstations

At the stair foot, dressed limestone and bronze edging set the landing apart
from the basalt floor. A continuous basalt and oak base ties the vault to the
walls. Each bench has an oak acoustic bay and recessed instrument drawers.
The existing stair, walkable floor and bench envelopes govern collision.
Both bench actions still refer to the established Spatializer and Weaver panel
routes. The packaged trial checked these handoffs in the game UI.

[Previous stair view](review/beacon-finish-before-reveal.jpg) ·
[Finished stair view](review/beacon-finish-candidate-reveal.jpg) ·
[Spatializer bench](review/beacon-finish-candidate-audio.jpg) ·
[Weaver bench](review/beacon-finish-candidate-body.jpg)

The editable chamber source and the named joinery in
[`register_beacon()`](export_cells.py) produce the same nine material batches.
The export rebakes albedo, normals, contact and static diffuse light with the
existing Cycles rig. The room's Brotli payload is 1,602,320 bytes, compared
with 1,612,132 bytes for the preceding edition.

The instrument revision gives each station a distinct use and silhouette.
Spatializer has two nearfield monitors and an inset listening field with
three brass source markers. Weaver has a vertical patch matrix,
curved patch leads and a lower row of gesture keys. These modeled components
represent the tools in their idle state. The nearby world action opens the
existing authenticated panel for actual control. Both worktops still use
their original envelopes.

The room stays at nine glTF material batches. Its geometry grows from
34,004 to 42,128 triangles, with the same bounds. The scoped Brotli
response grows from 1,602,320 to 1,669,254 bytes. At the matched bench
viewpoints Chromium reported 33 draw calls before and 33–34 in the
finished build, including the existing shadows. Physical device frame
pacing remains a separate measurement.

| Bench | Before | Finished |
| --- | --- | --- |
| Spatializer | [Previous console](review/beacon-instruments-prior-audio.jpg) | [Listening console](review/beacon-instruments-final-audio.jpg) |
| Weaver | [Previous console](review/beacon-instruments-prior-body.jpg) | [Movement console](review/beacon-instruments-final-body.jpg) |

Rebuild the editable scene without rerendering its review cameras using
`house.py -- "$ART_OUTPUT" --scene-only`, then run the Beacon export above.

The central instrument has a limestone prototype plaque mounted on the
stair-facing rim. Its named `prototype.inspect` anchor is the selection
point for the existing H.B. Guitar review. The atelier advances that station
to revision 2 with the same identity and Nexus edition. Authorized proximity,
the scene anchor and the room reference in Conversation use the new position.
The older profile retains its original bench and station revision.
[Plaque at player height](review/beacon-prototype-plaque.jpg)


```sh
blender -b art/compaii-house/redesign/casa-compaii-redesign.blend -t 6 --python-exit-code 1 \
  -P art/compaii-house/redesign/cell-irradiance.py -- "$EXPORT_OUTPUT" foyer
```

Select `beacon` as the final argument for the laboratory reference.

The [listening tower](listening-tower.blend) has its own editable room-scale
source and can be regenerated with `tower.py`. It uses a warm wall resonator
and cool clerestory light as orientation points. The gallery's east wall
and the tower's return wall share a dark stone arch, bronze trim and a
recessed plaque. The Gallery fitting sits forward of the plaster that
previously hid the portal marker. The Blender models carry the passive
recess. The scene adds the destination and a blue point light only while
the actor has passage access. Both portal landings retain their addresses.
[Gallery approach](review/gallery-tower-approach.jpg) ·
[Return from the tower](review/tower-gallery-return.jpg) ·
[Approach to the tower resonator](review/tower-approach.jpg).

The Atelier's second foyer fitting is the [editable oak and brass portal](foyer-portal.blend).
It uses honey limestone feet, a dark enamel center, a teal inlay and a brass
destination plate. Its geometry is local to the passage so the same fitting
works in reverse. At foyer slot 1 it projects in front of the existing inner
stone face. The walking approach stays at x=3, z=-4.81; the original gallery
door stays at x=-3. The GLB contains 4,600 triangles in five material draws
and no texture downloads. The active room supplies the current authorized
destination label and only serves the GLB to actors with the matching passage.

Regenerate with Blender 5.2.2 and an empty output directory:

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/foyer-portal.py -- "$ART_OUTPUT" --render
```


The [arrival commons](holodeck-commons.blend) can be regenerated with
`commons.py`. It replaces the main terrace and both connecting decks in
their existing coordinates. The center remains open for creation and
gathering. A shaded bench and tree frame the arrival without crossing the
main walking lines. The neighboring islands and room entrances keep their
existing geometry addresses. [Arrival](review/commons-spawn.jpg) ·
[Garden approach](review/commons-garden-approach.jpg) ·
[House approach](review/commons-house-approach.jpg).

The export evaluates the actual modeled details, bakes one color atlas
and one tangent normal atlas per cell, and preserves the material batch
boundaries and their scalar metalness, roughness and emission. The GLBs embed
their images and use core glTF without a required decoder. The facade
uses its full 1024² color bake as JPEG at quality 94 and a 768²
lossless tangent-normal PNG. Each cell is
bounded at 4 MiB and 64,000 triangles. Image files alongside the GLBs are disposable bake outputs. The JSON inventories report bytes, triangles, primitives and
room-local bounds. Keep Blender area lights and camera setups in the source.

| Cell | GLB bytes | Triangles | Material primitives |
| --- | ---: | ---: | ---: |
| Garden | 1,747,624 | 15,728 | 11 |
| Parcel facade | 2,105,312 | 19,712 | 9 |
| Foyer | 1,536,588 | 6,700 | 7 |
| Foyer with gallery sign | 2,749,896 | 22,852 | 9 |
| Beacon laboratory, emergency exit only | 3,666,048 | 43,800 | 9 |
| Beacon laboratory, gallery return | 3,925,492 | 48,460 | 10 |
| Gallery with stair | 3,526,312 | 37,281 | 11 |
| Gallery with continuous floor | 2,865,704 | 25,217 | 10 |
| Listening tower | 1,938,568 | 25,100 | 10 |
| Arrival commons | 582,668 | 14,880 | 10 |

The laboratory export registers the authored chamber to the existing room.
It rebuilds the visible six-tread stair and rail at the existing activation
location. The walkable floor, wall and stair collision keep their current
engine definitions. During local browser qualification the model travels
through the existing room-scoped asset route. A room-local key supplies
shadow and three low-cost lights fill the workstations and stair. The
existing published runtime selects its established room asset.

The exterior facade is registered to the existing west parcel with its front
facing the aisle and its measured dimensions inside the lot. The arrival
edition uses a dressed limestone arch, a deep oak reveal, a brass edge,
readable address lettering, window bays and two emissive lanterns. It uses
the existing exterior lights and fits the exact prior model bounds. The
packaged facade transfers in 1,089,929 bytes with Brotli. The new atlas
export preserves the previous index and attribute data, material
parameters and nine draw batches. The smaller
house model in the garden shares the architectural source. Indoors the
registered hall preserves the doorway and leaves navigation space around the
table. The collection gallery has two art revisions. The permitted viewer
sees the authored stair. The other revision has a continuous floor. Both use
the same gallery ID and exhibition anchor, and the server serves only the
variant suited to the visitor's currently permitted passages.

The gallery stair export closes the exposed sides and bottom of the well
with limestone and basalt. Dark nosings follow the six existing tread
heights. Oak handrails, bronze balusters and metal shoes sit over the
existing collision rails. This is registered room art. The descent keeps
its existing coordinates and permissions, and the continuous-floor
variant keeps its previous asset revision.

The published exhibit anchor remains at `(2.5, .1, 1.25)` in gallery-local
meters. The draft and archive anchors are at `(3.3945, .1, -.34944)` and
`(3.3945, .1, 3.67744)`. They use the exact review pins selected in the
protected receiving configuration. The published anchor preserves the
existing owner placement. Holodeck checks each source through Nexus before
offering to open it at its pedestal. The renderer fits the existing
protected snapshot above the corresponding authored work surface. It omits
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

### Parcel entrance review

[Prior façade](review/parcel-entrance-baseline.jpg) and
[released façade](review/parcel-entrance-candidate.jpg) use the same desktop
viewport, camera direction and walking route in separate packaged Chromium
sessions. The avatar partially overlaps the address at the threshold. The
asset loaded at its exact revision on each run. The simulated visitor opened
the door with E and returned to the exterior anchor `(-2.075, .11, 15.5)`
without reloading the document. The new façade was also read back byte for
byte from the protected HTTPS asset route. The original Blender file now
includes this edition alongside the existing house cells.

### Gallery descent

[Previous stair](review/gallery-stair-before.jpg) and
[released stair](review/gallery-stair-after.jpg) show the well from the
same route, field of view and viewport. The avatar approached from a
slightly different lateral position in each run. The new cheeks conceal
the exterior backdrop beside the treads. The nearby Tower action appears
in the second frame. On the steps, the visitor's E action enters the
laboratory and the return action restores the original stair landing.

An independent visitor with gallery access alone received the continuous
floor. The open gallery and Beacon models were denied to that fixture.
The stair edition shown here was 1,473,557 bytes with Brotli compression.

### Gallery roof joins

Limewash gables and oak plates close both end-wall joins without changing
the gallery envelope. The [before](review/gallery-gable-baseline-stair.jpg)
and [after](review/gallery-gable-candidate-stair.jpg) WebGL views use the
same camera and viewport. In fixed comparison regions at the stair and
collection ends, the visible background dropped from 11,783 and 4,535
pixels to zero. The intentional [side clerestory](review/gallery-gable-candidate-clerestory.jpg)
retained its 6,952 background pixels in the matched region.

Both browser fixtures fetched their exact permitted models. The stair and
tower links remained available to the first visitor. The visitor descended
with WASD, entered Beacon with E and returned to the same gallery landing in
the same document. The second visitor crossed the continuous floor at
gallery height and received a denial for direct lab entry. With Brotli, the
assets in those views transfer in 1,458,461 bytes for the stair edition
and 1,463,368 bytes for the continuous floor.

### Laboratory door and sign

The stair edition includes a limestone surround, an oak door with a
gunmetal inset and brass hardware, and an ivory **Laboratorio** sign with
the floor number. The authored fittings sit inside the existing gallery
envelope. The stair and rails retain their original collision surfaces
and the door retains its original route and activation point. The existing
continuous-floor asset contains no laboratory door or sign. The stair
edition shown here transferred in 1,482,647 bytes with Brotli.
[View from the stair landing in Chromium](review/gallery-laboratory-door.jpg).

### Gallery return to the foyer

Both gallery editions have a limestone surround, oak door, recessed
gunmetal panels and brass fittings at the existing foyer passage. The
ivory sign identifies **Vestíbulo · Planta baja** from the player path.
Each browser fixture walked to the door with WASD, pressed E and returned
to the exact approach in the same document. The continuous-floor visitor
received no laboratory route or model. The updated gallery assets transfer
in 1,490,289 and 1,471,814 bytes with Brotli.
[Door from the gallery approach](review/gallery-foyer-door.jpg).

### Foyer entrance to the gallery

The foyer's gallery threshold retains its oak door, latch and route marker,
with an authored gunmetal and oak **Galería · Planta baja** plaque above it.
Viewers who can enter the gallery receive the signed foyer model. The
original foyer model serves visitors without that passage and keeps the
physical exit. The signed asset transfers in 1,501,069 bytes with Brotli.
[Plaque from the foyer approach](review/foyer-gallery-entry.jpg).

### Laboratory return to the gallery

The laboratory's upper landing has a limestone surround, recessed oak
and gunmetal panels, brass fittings and a **Galería · Planta baja** sign.
The stair, rail collision and approach at slot zero retain their existing
positions. The art endpoint serves the return edition only when the viewer
can enter the gallery. Losing that access selects the previous laboratory
model and exposes the existing emergency exit, with no gallery door or
sign and no further access to the return model.

The laboratory editions share their room envelope and texture sizes,
with two atlases at 1024² and two at 512² each. The return edition
transfers in 1,703,241 bytes with Brotli. The viewer receives only the currently
authorized edition.
[Door from the laboratory stair approach](review/beacon-return-gallery-door.jpg).
Independent Chromium fixtures confirmed the authorized WASD and E-key
return at the same gallery landing without a reload, and the denied
visitor's sealed gallery and restricted art responses.

The supported first control handoff is the authenticated
[Harmonic Lab panel](https://compaii.dmn.homes/harmonic_lab/). Walk toward
the Spatializer or Weaver bench to open its tool card inside the room view.
Closing the panel resumes at the same position. The world keeps the
selected bench as a situated reference while it remains nearby. The panel
reads readiness and owns the existing explicit actions. Spatializer and
body Weaver interfaces open from the selected receiver's browser. The
headless Weaver router remains a separate documented option.
[Owning panel contract](https://github.com/AlterMundi/harmonic-weaver/blob/73f08bcc2c8119cba34e10d661d26f4f9773657f/docs/laboratory/integrations/CONTROL_PANEL.md).
