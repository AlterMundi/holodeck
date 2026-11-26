# Holodeck environment art revamp

Nicolás selected three Gemini frames as the quality target. The outdoor
views place layered meadow, a readable path and a detailed home under
an open sky with distinct middle and distant silhouettes. The celestial
arc contributes color and scale above the horizon. The astral passage
has a luminous cyan and brass threshold. Review the full in-game
approach at eye height and the view from the first bend before using
an isolated material close-up to make a release decision.

## Current baseline and observed gaps

The initial art comparison used `476adaf02828`. It has authored vegetation near
the house, coarse scattered props beyond it, a seeded level-of-detail
torus, an Argentine solar clock, procedural clouds, a projected cosmic
panorama, and materials that already use radial lighting. The production
surface can look flat between nearby vegetation banks. The cosmic
panorama occupies more of the dusk frame than in the selected references.
The detailed house and local plants need a coherent foreground,
middle distance and horizon in the same moving shot.

A clean visual branch off that production source built a draft with
continuous ground shading and deterministic camera-neighborhood grass
tiles. Each tile uses canonical torus coordinates, a bounded candidate
count and retained seeds during camera movement. Close plants use root-
fixed vertex wind, small mid-distance tufts supplement the palette, and
distant slopes carry continuous material variation. The first Chromium
fixture loaded the new material at arrival and a remote tile without a
shader error. This was a functional software-rendered check. The first
remote sample was at the water and is unsuitable for an artistic meadow
comparison. Use the dry cave approach and overlook for traveled matches.

The branch also contains the team's initial portal and interface work.
The built-in image generator produced an original landscape plate with
an upright cyan/brass astrolabe portal in a dark interstellar field and
space for live text below. The 29,820-byte AVIF is a derivative of that
plate. DOM status follows the actual arrival state. CSS runs the visual
motion and reduced-motion alternative. The existing A2UI retry still
works and reverts to the browser control if WebGL is lost.

## Environment decisions

### Vegetation by distance

The [selected forest release](STATUS.md#november-26-character-table-water-depth-and-closed-doorway-clearance)
adds a broad, asymmetric evergreen crown beside the original narrow family.
Both use the same placed trees and preserve the selected family across
detail switches. The instance capacity is split by family and empty meshes
are hidden. Matched forest-edge, ground travel and flight checks cover the
inner arc. The open distance transitions and canopy lighting remain in
[biomes #25](https://github.com/AlterMundi/holodeck/issues/25).

Use the maintained analytic terrain for elevation, wetness, slope and
trail masks. Keep the foreground plants grounded on its actual surface
at both ends of each torus address seam. Group grass by wrapped tiles.
Use individual shapes, flowers and seed heads within silhouette range,
fewer crossing tufts and cooler color at middle distance, and color,
normal and roughness variation on the terrain farther out. Let wind
change the bent tips and their lighting while roots remain fixed. Avoid
height changes solely to improve the appearance of a grass patch.
Split new-cell preparation from draw calls and measure CPU upload spikes
while running and turning. Delay density increases until those costs
are measured. [GPU Gems virtual botany](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-1-toward-photorealism-in-virtual-botany)

The torus already has streamed terrain tiles, seam coordination and
walkable collision. Apply gradual visual detail transitions within that
system. A clipmap is an option only if same-route measurements expose
a sustained geometry or update bottleneck. [Geometry clipmaps](https://hhoppe.com/proj/geomclipmap/)

The current open field keeps separate near and far instance batches. It
caches deterministic plant samples by wrapped tile but rewrites the instance
matrices and colors for the whole visible neighborhood when the field cell
changes. The authored meadow banks already maintain bounded per-cell batches.
Measure a running crossing and a low flight first, logging instance uploads,
draw count and GPU time. If the whole-neighborhood upload is visible in frame
pacing, try reusing bounded tile buffers and updating only entering tiles.
Compare the extra draw calls with the CPU work saved. Keep opaque blade
geometry and shader wind for the near field. Use simplified middle-distance
tufts and match their root tint and lighting to distant ground coverage.
Compare Normal and Livianos on the same route before increasing density.
Instance counts and distance fade ranges are tuning outputs of that comparison.

#### Branchlets in nearby pine crowns (local draft)

Candidate `2f857516e807` from `81b7210` splits the nearby and middle
whorls into staggered branchlets, with quieter stems and tip-to-root
colour. The same instancing, root positions and distant canopy tiers
remain. The trees use no new asset requests.

A same-camera upward view on one RTX 2060 opened more sky between the
leaves. A fixed blue-channel proxy in the upper 450 rows rose from
22.6% to 35.8% of the image at noon. It estimates relative openness
for this particular view. A 6.50 m walk and matched dusk view passed.
The scene used 106 draws in both versions and 527,342 versus 505,818
triangles at an 850×552 buffer. Median animation frame interval was
16.7 ms in both. The closest branchlets still read as occasional flat
triangles. The draft remains local for refinement and a subsequent
check of the silhouette while crossing detail transitions.

The next local archive `11fc02fe5faa` (`f38df5a`) connects the stem of
broad pines to their leaning branch hubs. A targeted noon/dusk view
looking up into a broad pine and a 6.56 m walk passed on the same RTX
2060. That camera differs from the first pair. The focused test also
checks that the stem ring crosses an upper whorl hub. Both archives
remain drafts.

#### Installed pine needle and crown trial

Protected `7cb8c7170403` (`faa812f`) uses the connected branchlets and
a small locally generated, mipmapped needle chart on nearby trees. The
opaque cutout is removed as the projected detail becomes too small.
Bark and distant tree materials keep their own appearance. The one
128×128 two-channel texture is allocated on first material use, with
no asset request.

The selected broad crown was compared at noon and dusk on one RTX
2060. The camera showed needle-shaped edges where the earlier draft
had flat foliage. The previous geometric draft and the new chart
both showed 92 draws and 495,535 triangles at the matched 850×552
view. A separate real keyboard run moved the same tree from 11.99 m in
the near batch to 43.66 m in the middle batch without losing its
root. That verifies selection continuity, with visual transition
quality and lightweight cost still available for later review.
The protected runtime read matched 14 state files, terrain worker,
server and room art. Immediate rollback is `de01619ab41c`.

#### Rooted pine shade trial

Protected `0475d40c6496` (`0d06e21`) shares a single locally generated
256×256 shade map between the terrain and the base of nearby vegetation.
It follows the authored pine roots through detail tiers. The existing
daylight input reduces the shade after dark. The map adds no asset request
or shadow draw pass. This trial darkens the ground immediately under the
pines with a soft edge. It models local canopy cover, whose shape stays
fixed as the sun moves.

The exact packaged candidate was walked 6.44 m on one RTX 2060. Matched woodland
poses at noon and dusk retained 135 draws and 545,590 triangles at an
850×552 buffer. Frame-interval p95 was 16.7 ms at noon and 16.8 ms at
dusk. GPU timings were unavailable. The first-pass goal is soft contact
between the grass and ground. The next art comparison should check
patches of needle litter and short understory between trunks while
keeping the meadow approach continuous.

The protected package read matched the served client and terrain worker,
server, room art and 11 state files. The remaining files reflected a
completed facade edit and live observation changes during the window.
Immediate rollback is `d4aebd19a991`, which includes the touch jump fix.
Fable recommended the shared rooted map. Two Opus art review invocations
expired without a verdict.

#### Pine litter and breaks in the grass

Package `8f3cfee9adf7` (`c9998d7`) gives the western pines warm earth
and a filtered pattern of dry needles, with irregular edges. Grass keeps
its same candidate roots and grows shorter and sparser in deep litter.
The two existing sampled textures each pack grass or shade with a second
litter channel, adding 80 KiB of base texture data. The scene adds no
texture requests or geometry batches.

One RTX 2060 ran matched noon and dusk views with both profiles at an
850×552 buffer. Normal retained 135 draws and went from 545,590 to
544,755 triangles. Lightweight retained 97 draws and went from 324,043
to 323,815 triangles. Frame-interval p95 was between 16.7 and 16.8 ms
and was limited by presentation rate. The candidate walked 6.55 m in
Normal and 6.61 m in Lightweight. A fast transition past the grass fade,
the Pi 5 and the paired human's acceptance remain open.

#### Western pine bark trial

Package `17fc3bed2bc0` (`450608b`) adds staggered bark plates, warm
fiber and narrow cracks to the existing stems. Smooth radial normals
give the bark a continuous lighting surface. Silhouette geometry and
trunk collisions keep their existing shapes. A local 128×128, 64 KiB
base texture is generated once and shared across the rendered stem
tiers. The unwrapped derivatives filter the map and fade both tint and
relief as the detail gets smaller on screen.

One physical RTX 2060 walked 6.56 m in Normal and 6.61 m in Lightweight.
Matched noon and dusk poses at 850×552 kept 135 draws and 544,755
triangles in Normal and 97 draws and 323,815 triangles in Lightweight.
Frame-interval p95 was 16.7–16.8 ms at the presentation cap. Fable
identified grazing motion as the next useful check. The matched moving
poses exercise filtering over a short sweep. A subsequent dusk pass loaded exact protected client bytes in a loopback
fixture on the same physical RTX 2060. The controlled camera swept
about 170° around a trunk from 2.25 m. Browser keyboard input then drove
an outbound run of 47.51 m in Normal and 45.84 m in Lightweight, followed
by a walk back. The tracked pine appeared in one tier at all 18/17
outbound and 25 return samples. The tracked tuft switched to the outer
batch in Normal, left both batches and returned. Lightweight used the
outer batch throughout its visible portion. The maximum recorded rAF
interval was 16.8 ms on both profiles at 1000×650 CSS pixels and DPR 1.
These samples establish geometry selection and presentation cadence.
A frame-resolved visual check for shimmer, Pi 5 and paired-human
acceptance remain open.

#### Western woodland spur material

The return from the pine trial crosses an existing grass-free trail
segment whose vertex tint reads green from player height. Protected package
`fae6c8604b6f` (`87835aa`) follows that segment with dry dirt and
a soft verge in the existing terrain material. The fragment mask
matches `terrainTrail` in the bounded test region. A numerical mirror
matched it at 14,016 positions. The first implementation changed the
motion-study edition hashes through a shared numerical module. The
renderer-only version preserved the worker, server and motion catalog
bytes alongside the route geometry and planting rules.

Matched noon and dusk views at the spur used 148 draws and 356,835
triangles on one physical RTX 2060 at 850×552, before and after. The
visible result is qualified in Normal on that device. In Lightweight,
a physical Raspberry Pi 5 with Chromium 154 and Broadcom V3D ran both
archive clients at the same dusk pose. Browser response bytes matched
the corresponding stages. The current terrain program linked and
included the western spur shader. Matched frames show the dirt strip
through the center and foreground. Both runs submitted 82 draws and
215,199 triangles at 512×332. Across 164 moving-camera frame intervals
each, median was 16.7 ms and p95 was 33.4 ms, with no interval above
50 ms. A separate keyboard step walked 6.38 m on the current archive.

The board was 67.0→76.3 °C for the preceding run and 74.1→78.5 °C for
the current run. Neither endpoint reported a current throttle flag.
The headless loopback fixture measures presentation cadence, with no
available GPU timer samples or production login. The unmatched initial
temperature and one pass per build limit the performance comparison.
The material pass covers the western grove segment. A sustained
thermal run, the rest of the spur and participant acceptance remain
open.

### Air and light

Link the horizon, the terrain's distant color and the low-angle sun.
Start with height- and distance-dependent transmittance on each body's
existing radial frame. Keep the panorama recognizable through clear air
and restore more of its color at dusk with the same solar clock.
For clouds, use the lit edge and underbody to read volume at grazing
angles. Compare the existing low-cost directional field with a lookup
texture for atmospheric transmittance before considering per-pixel
volumetric integration. [Hillaire, scalable atmosphere rendering](https://sebh.github.io/publications/egsr2020.pdf)

Keep materials physically legible with roughness variation, ground
contact and sky bounce. Compare the existing house silhouette with
the selected concept at the same camera height. Prioritize masonry
relief, trim around openings, warm window light and the threshold.
Use selective emission around windows, the robot visor and the tabletop.
For composited landscape or facade details, evaluate meshes, image
cards or splats against equal views, motion parallax, package size and
light response. Use physical geometry wherever visitors can cross or
touch a surface.

### Surface contacts

When objects meet terrain or other objects, make the contact read as part of
the scene. This applies indoors and outdoors, including architectural joins
and the waterline. Preserve crisp edges where the construction or material
calls for them, and give the actual joint believable support and lighting.

Choose the treatment that fits the materials. Seat rocks into uneven ground,
vary their base silhouette, and continue local grit, soil or vegetation at the
foot. Use local contact shadow or baked occlusion where it helps show weight.
Use a bevel, a fitted joint or material trim where two built surfaces meet.
At wet edges, let depth, wetness and transparency carry the transition.
Keep collision aligned with the visible solid surface.

Review at eye height from both sides that visitors can reach and while moving
past the object. Check daylight and dusk or night, where a dark terrain can
hide sparse ground cover and leave an abrupt seam. Keep the matched view in
the environment review evidence when resolving a reported example.

### Planted cave exit

Source `2349c0b` gives the outlet a larger uphill belt of rooted grass,
a shorter belt on the other side and a lightly worn centre tread. The
existing instanced meadow supplies the blades. A generated 8 KiB mask
drives plants and filtered ground colour from the same toroidal field.
Normal and Lightweight keep the same added candidate indices, while
Lightweight uses the cheaper four-blade geometry. The reserve is bounded
by the number of cells that can intersect the outlet. The terrain worker,
cave geometry, gameplay and collisions remain byte-identical.

Matched browser screenshots on one RTX 2060 covered noon and dusk in
both profiles at 850×552. Median frame intervals stayed at 16.7 ms
and p95 stayed at 16.7–16.8 ms with 101 draws in Normal and 89 in
Lightweight. Compared with the preceding exit build, added plants
accounted for 3,140 scene triangles in Normal and 1,428 in Lightweight.
A walk near the exit passed in each profile. The full suite passed
492 tests with two skips. A focused clearance test checked the planted
roots against the existing shared
rock surface and verified a clear tread through the middle. Opus
identified an overlap between the tread and ground shading and a
hard-coded shader bound. The final build reduces meadow shading
in the tread and computes the bound from the outlet coordinates.
Independent signed-in visits and multi-device optimization remain open.

### Recessed cave mouths

Source `24319c7` shortens and buries the protruding low exterior feet at
both cave mouths. The unequal setbacks fade out along the cave and below
the shoulders of each arch. The roof, inner shell, crown mesh and index
topology match the preceding build. The visible exterior shell remains
the collider. A focused geometry check keeps a minimum spacing between
successive outer sections. In this build the closest pair stays about
0.66 m apart along the ring, over half the nominal spacing. The shell
keeps 2,368 triangles and the existing roof landing cases pass.

One physical RTX 2060 rendered matched arrival and exit views at
Argentine noon and dusk. The exit matched in Normal and Lightweight.
Both profiles completed an ordinary keyboard walk from the arrival
entrance through the chambers to beyond the exit, with pose readback
along the passage. The frame median stayed 16.7 ms and p95 16.7–16.8 ms
at 850×552. Respective exit views matched 101 and 89 draws. The
suite passed 491 tests with two skips. Fable informed the asymmetry and
feathered setback. Opus flagged the risk of compressed sections,
which the new geometry test covers.

The arrival-side point no longer projects as far onto the trail.
The exit has shorter feet and still needs better ground cover to tie
them to its uphill meadow. Independent signed-in visits remain open.
[Receiving selection](STATUS.md#november-26--recessed-cave-mouths).

### Weathered cave footing

`58cbd62` uses radial clearance in metres to wear the existing arch and
crown where they meet the seeded ground. Rock grain breaks up dampness
and patina along exposed feet. The interior has narrower dry soil
color and softer contact shade. The same 2,368 shell and 624 crown
triangles serve rendering and collision, with byte-identical positions
and indices. No new asset, draw pass or terrain worker changes.

On one physical RTX 2060, the exact candidate was compared against
`fae6c8604b6f` from the same eye-height arrival view at Argentine noon
and dusk in both graphics profiles. An ordinary keyboard walk near
the entrance moved 6.39 m in Normal and 6.50 m in Lightweight. At
850×552, frame intervals were 16.7 ms median and 16.7–16.8 ms p95
in the matched runs. Both packages used 131 scene draws in Normal
and 95 in Lightweight. These were short controlled browser runs.
First-approach shader latency, the far-mouth visual view and independent
signed-in visits remain unmeasured for this package.

The exposed feet read darker and less uniform up close. The projecting
corner still has a sharp silhouette. Shaping that outline and
continuing grit or vegetation into the foot would address the remaining
edge. Fable recommended varying the clearance by patch and keeping
the interior dry. Opus identified the shader cache and interior
wetness issues, which were fixed before the final browser comparison.
The suite passed 490 tests with two skips.
[Receiving selection](STATUS.md#november-26--weathered-cave-footing).

### Weathered meadow stones (local candidate)

Source `f236dc8`, archive `9dcfeec3efe5`, gives the existing instanced
meadow stones world-space mineral grain with a darker foot and an
irregular moss transition. The existing terrain positions, scale and
opaque draw stay in place. The stone shader uses the same noise as
the cave and stonework. The new contact height is radial and measured
in metres from the seeded root.

The same boulder was compared at noon and dusk on an RTX 2060 using the
active woodland build as baseline. The surface and foot now read with
more tonal variation. The faceted outline and some blades passing into
the stone are still visible. The 6.51 m walk passed with no browser
errors. Both versions gave 163 draws, 586,370 triangles and a 16.7 ms
median animation-frame interval at an 850×552 draw buffer. The candidate
remains local. It adds no external assets.

### Installed meadow stone and grass contact trial

Protected `de01619ab41c` (`3cc63b3)) adds a worn, irregular outline to
the same rooted stones. Ground cover uses an oriented approximation of
each rock's footprint to taper blades near the base. A broad first
taper made the rock look surrounded by bare turf. The installed pass
uses a 0.29 m taper to make the transition smaller. Some contact on
steep surfaces and next to authored plant banks can still need work.

The forest-edge pose and a 6.51 m walk passed in Chromium on an RTX 2060.
Both matched cameras recorded 163 draws and a 16.7 ms median frame
interval at 850×552. The measured triangle count changed from 586,370
to 590,354. Both profiles use the same stone roots. The lightweight
cost and live player feedback are still to be checked. The protected
receiver matched 14 state files, server, other room art and terrain
worker. The immediate rollback is `edc4063a617a`.

### Cosmic sky reflected in water

The November 26 water reference calls for a broken ribbon of amber and
magenta following the planet, dark blue water outside that ribbon, a softer
distant shoreline, and readable silhouettes where the characters meet water.
The reference is an art target. Use the actual coast and sky orientation in
the comparison.

Start with the current water tiles, layered wave normals, Fresnel and
depth-based shore transmission. Share the existing cosmic panorama and its
daylight attenuation with the water shader. Sample it using the wave-perturbed
reflection direction in world space, with the same radial horizon and underwater
fade. Keep the reflected planet narrow enough to read against dark water.
Compare the scene at eye level, in the shallows, underwater, and from flight.
Check that the reflected planet follows camera motion and stays aligned across
tile seams, and that the coast reads at day and dusk.

Use existing light and haze controls for soft character contour light and
distant relief. Try localized ripples and shading at the avatar waterline.
Keep the HUD outside world effects. The shared panorama adds no new download
or second scene render. Measure first visible frame and GPU frame time on
Normal and Livianos. Consider a bounded local reflection target only if
reflections of nearby characters or rocks still matter after that trial.
A global planar mirror assumes flat water, while the world's up direction
changes around the torus. Review bloom as a separate optional effect.

### Visual review follow-up

The independent Astra High review checked the estate previsualization,
captured Holodeck coast and woodland views, and the current rendering path.
It assessed Gemini's water and foliage recommendations from retained text.
Both profiles should preserve the scene's composition and depth cues.
Normal can add selective close detail where Livianos uses simpler shapes.

Claude Code Fable 5.2 High inspected the estate previsualization and the
terrain, sky, field and meadow-bank sources. Its alternative first water
trial is a directional glint from the planet's position, angular size and
palette, broadened by wave slope. Compare that with the shared panorama
sample at the same coast and solar time. Choose the simplest variant that
keeps the visible planet and reflection aligned and avoids shimmer. The
estate and water studies show different skies. Use one in-game sky for each
matched comparison, with a common directional reference for sky, water and
character lighting.

Fable also proposed feeding the same localized lantern falloff into the
terrain path and nearby plant tint. Try that against the current lighting
at a fixed player-height view. Evaluate present-view depth and soft shadow
separately from the prior depth-of-field cost. Reserve further passes for
specific measured gaps.

Qualify water in a lateral shoreline turn, shallows crossing and short
flight. The planet's reflection must move with view direction, retain dark
gaps between glints and stay coherent across tile edges. Check character
readability against the reflective band and check the same view with bloom
disabled. For foliage, prefer shaded understory clusters, overlapping
uneven crowns and readable clearings. Compare one passage from an open
clearing into the trees and one near-ground flight. Track density jumps,
alpha-edge shimmer, instance uploads and GPU time. Use the same internal
render size and clock in each baseline and candidate. Keep phone validation
distinct from Pi 5 Livianos and RTX 2060 Normal measurements.

### Background depth of field

Try an optional exterior mode that keeps the avatar, nearby path and
interaction targets sharp. Increase blur gently over a range of metres
behind the subject. Keep the HUD and text outside the effect. Preserve
the current direct render in Livianos and when the option is off.

The pinned MML composer draws the world, clears depth, then draws its
overlay scene. Holodeck draws its A2UI HUD afterward. Prototype at the
world draw boundary, using the world's color and depth from the same
render. Test a bounded, depth-aware blur at reduced resolution before
considering the stock Three.js BokehPass, which renders a separate depth
pass. Qualified integration still needs a supported world-draw hook.
Check that foreground grass and avatar edges stay clean and that shallow
transparent water does not inherit an implausible blur from the seabed.
Compare matched renders at zero blur for color and antialiasing, then
measure GPU cost and frame pacing while turning and flying at dusk.
[Three.js BokehPass](https://threejs.org/docs/pages/BokehPass.html)

The first local prototype captured half-float color and depth during
the normal world draw and added one fullscreen triangle. It softened
the distant shore but carried stale arrival geometry into later camera
positions, including underwater. This candidate was withheld. On Pi 5
Livianos with the preview requested, the fallback matched the direct
path's draw, triangle and texture counts at the same render size. RTX
timings used different adaptive resolutions and do not establish a
matched GPU cost.

The next candidate, `fdea015`, clears color and depth in its private target
before each world draw. Both desktop RTX with MSAA and software Chromium
without it confirmed the renderer has auto-clear disabled. The corrected
shore and underwater captures no longer show previous arrival geometry.
In a dusk coastal crop the sky and hill soften while nearby characters
and A2UI remain readable. A controlled Pi 5 night run with the preview
requested stayed on the lightweight direct path, with 22 textures and
16.7 ms frame p95 in that short sample.

An exact candidate run pinned both RTX buffers to 900 × 555 and compared
90 flight frames at the same view. GPU median went from 3.11 to 13.68 ms
and p95 from 10.60 to 16.20 ms. Frame p95 was 16.8 and 16.7 ms. The GPU
numbers include the existing world and overlay draws. The trial is
single-visitor and short, but this leaves too little GPU headroom for
Normal. Keep the direct release. Isolate the multisampled capture cost
from the blur kernel, and evaluate a lower-resolution effect against
foreground edges and shore transparency before promoting a candidate.

## Installed vertex colours for the arrival meadow

Protected package `a051266d693e` serves source `3c5f6a6`. The immediate
rollback is `62442e1a268b`. Earlier fragment-swath pilots stayed in trial
after their thermal comparison was inconclusive. The selected version
stores a broad, periodic colour field in the RGB stream already built by
the terrain worker, within 76 metres of arrival. It keeps the worn trail
and shore masks and interpolates the local field over the existing
coarse-to-fine chords on both axes. The shader, texture inventory and
vertex payload shape are unchanged.

Matched noon, dusk and night poses in physical Pi 5 Normal (336 × 240
buffer) and Livianos (264 × 189) retained 142 / 80 draws and
329,205 / 159,030 triangles. The daylight meadow crop changed by a mean
2.7 / 3.1 RGB steps of 255; a wall crop was pixel-identical at all
three clocks. Livianos measured about 16.7–16.8 ms p95 in the exact
installed build. The Normal render timings ran at different physical
temperatures with active throttle in the trial. Treat those as render
checks, without a frame-speed comparison.

Separate ABBA/BAAB trials used the exact two terrain workers in a single
physical Pi Chromium instance, without running a 3D scene. Eight
batches per worker and profile measured turnaround and transfer over
the arrival tiles. Batch median was 173.6 → 158.6 ms (64 tiles) and
384.9 → 387.1 ms (112 tiles). Batch p95 was 180.5 → 175.9 ms and
408.2 → 398.8 ms, respectively. Board telemetry began at 75.7 °C and
ended at 78.5 °C, with historical flags only at those readings.
Mesh positions, normals, indices and water arrays were byte-identical in
the separate deterministic terrain comparison.

The two controlled visitors saw the same doorway coordinate and the
Livianos visitor requested zero Sand3D assets. The published Character
catalog stayed byte-identical after an exact 670-pose and chapter
comparison. Fable 5.2 High informed the worker design; Opus 5.5 High
review prompted finite and exact two-axis edge tests. 483 automated
tests passed with two optional skips. Installed server, client, worker,
room art and protected serving checks matched. Thirteen state files
matched by hash. The room journal recorded presence events during the
cut and retained its durable content across the adjacent saves.
Independent participant acceptance and a controlled Normal frame-time
comparison remain open.

## Continuous short cover on the western meadow

Trial `98f37f24b9c1` replaces the three isolated low-grass drifts with
adjacent 9 m tiles on the existing route from the arrival trail toward the
western pines. Each tile grows from deterministic jittered roots. Low leaves
thin toward the shore and trail, and sink into the ground as distance
increases. Tiles are generated near the player without an asset download.
The meadow banks and taller vegetation provide contrast above the low layer.

One RTX 2060 browser reached the exterior, rendered the daylight view and
completed a 7 m walk. The close view showed a more connected foreground.
Gaps remain farther up the slope and the coverage is limited to the west
side of the trail. The closer shapes still read as angular blades. This is
provisional pending player feedback. Device optimization follows approval.

### Finer blades and middle-distance colour (local candidate)

Source `6bc2b7a` prepared the archive `a367976da5eb`. The candidate keeps
the western roots and replaces the flat spikes with narrower bent ribbons.
It extends the staggered geometry fade from 33 m to 43 m and carries olive
and dry-straw variation in the filtered terrain past the grass fade. The
comparison uses the same camera at noon on an RTX 2060, plus a dusk check
and a 7 m walk. The candidate showed more continuity uphill and finer
silhouettes at the same 850×552 draw buffer. The scene peaked at 485,340
triangles and 135 draws for that noon view, compared with 291,077 and 129 on
the installed version. Both reported a median animation-frame interval of
16.7 ms. The test has no GPU timer readings. This candidate is local while
the installed meadow trial is available for feedback.

### Western pines and ground-cover transition (local candidate)

Candidate `2264a32a81e8` from `eacc497` composes the curved blades, the
extended grass field and the fern mixture on top of protected
`81d51189874e`. The same rooted field crosses the western meadow and
continues under the pines. It uses the terrain's woodland density to make
the blades shorter and darker while retaining low cover in dense stands.
Ferns share the existing 384 understory slots. No asset fetch was added.

The matched noon and dusk views under the trees on one RTX 2060 showed
more coverage toward the far ridge and distinguishable fern shapes.
The first trial lost too much foreground cover under the canopy. The
retained iteration recovers some of it with wider curved leaves and
less thinning. The fern selection was 48 ferns and 27 shrubs in the
observed path. A 6.56 m walk completed without client errors. The matched
view peaked at 516,123 triangles and 135 draws against 272,822 and 114.
Both had a 16.7 ms median animation-frame interval at 850×552. No GPU
timer readings were available. At dusk, the lower understory still
reads too dark and broad clearings remain between nearby clumps.
The installed version remains the playable western meadow trial.

### Installed western pines and twilight trial

Protected `edc4063a617a` (`a6fec4f`) makes the composed woodland field and
fern trial available on the existing arrival route. The local vegetation
shader now uses radial orientation and height to separate cooler leaf tips
from darker roots around dusk. Root contact remains present in daylight.
The scene's ambient light and exposure are shared with the rest of the world.

The same RTX 2060 view at noon and dusk and a 6.44 m forest walk passed.
In selected dusk regions, the fern and the trunk rose about 2.2 display luma
levels on a 0–255 scale, while the surrounding floor rose 0.16. The noon
regions stayed within 0.12 levels. This is a local lighting improvement,
with darker vegetation and gaps still visible across the grove.
The exact scene held 135 draws, 516,123 triangles and a 16.7 ms median
animation-frame interval at 850×552. A subsequent wider device pass and
player feedback are pending. Fourteen protected state files, the server,
terrain worker and room art matched. The immediate rollback is
`81d51189874e`.

## Trial of short grass drifts at the arrival meadow

Protected visual trial `4cf4d8b5a6d3` serves source `818502a`, with
`b16825cfa1d6` available for rollback. Three seeded drifts put rooted short grass
between the existing tall plants along the arrival meadow toward the trees.
The geometry is opaque, uses the existing ground and daylight, and has no
asset fetch. Normal admits 1,112 short clumps, with 740 of the same roots
selected in Livianos. Only the client bundle and manifest changed.

The single-device trial used RTX 2060 Normal. It showed all three drifts
and completed a 7.8 m keyboard walk. The matched daylight view added three
draws and 5,560 triangles. This was a readiness and visual comparison,
with participant acceptance and cross-device optimisation open. Fable 5.2
High informed the density layer. Opus 5.5 High reviewed the exact art patch.
The 10 scoped scenery tests passed. Protected receiving readback matched
the running client, server, terrain worker and scoped art. The existing
audience and rollback remain selected.

## Installed short-leaf cover at the arrival meadow

Protected release `b16825cfa1d6` serves `0a22901`, with `ccd70257f992`
available for rollback. The ground between upright tufts now reads as
shorter grass beside the approach. A single local 128 by 128 R8 repeat
is generated only in the terrain renderer. Filtered leaf relief keeps
the existing terrain colour, mutes subpixel detail and has the same
pattern in Normal and Livianos. The top-level texture uses 16 KiB and
has no download. Draws, terrain geometry, room links and planted roots
are unchanged.

At matched noon, dusk and night moving-camera samples, p95 was
16.7–16.8 ms on RTX 2060 Normal and Pi 5 V3D Livianos for both packages.
The matched buffers were 561 × 378 and 264 × 189 respectively. At every
measured sample, draws and triangles were identical within each profile
(114 / 245,754 and 70 / 94,642). Both Pi runs ended warmer than they
began, with historical throttle flags only in recorded pre/post readings.
In one close RTX ground crop, mean display luma went from 150.5 to
148.5/255 while the mean absolute horizontal-neighbour difference grew
from 0.05 to 1.14. This measures local texture contrast, with real lower
vegetation density and a continuous meadow-to-forest walk still to do.

Two Chromium fixture visitors resolved the same house entrance. The
Livianos peer downloaded no Sand3D models. Independently signed-in human
acceptance is open. Fable 5.2 High informed the short cover. Opus 5.5
High reviewed the final bytes after neutralising the mip-level tint and
checking anisotropy, masks and texture disposal. 488 tests passed with
two optional skips. 13 state files matched by hash. The room journal changed only for presence. The server, worker, scoped art and client
matched the selected serving release.

## Installed middle-distance meadow coverage

Protected release `95d58169730b` serves `65344ee`, with `a051266d693e` as
the immediate rollback. 13 state files matched by hash. Only presence events changed in the room journal. Exact readback matched the browser,
terrain worker, server and room art. The release changes the browser
bundle and its manifest.

Wider root-fixed grass tufts and a rounded falloff in wrapped ground
coordinates give the arrival meadow more visible coverage at mid distance.
The falloff follows the avatar's position on the torus. Zoom, orbit and
radial altitude leave the coverage unchanged while the avatar stays over
the same patch. The GPU collapses grass before the streamed cells swap.
The Normal and Livianos draw and instance budgets stay fixed.

On Pi 5 Broadcom V3D, matched noon, dusk and night views reported
127 draws / 262,218 triangles in Normal and 71 / 95,234 in Livianos
in both builds. Candidate p95 frame intervals at those poses were
33.4 ms and 16.7–16.8 ms, respectively. The Normal run ended at
82.9 °C with a current thermal flag. These are fixed-pose samples.
Native input in the controlled run moved the avatar 8.0 m and 8.9 m
in low flight across the respective profiles. The separate controlled
visitor resolved the same door and Livianos requested no Sand3D assets.
The test suite passed 484 cases with two optional skips. Added tests
verify deterministic root attributes, radial climbs and coverage before
either wrapped streaming axis exchanges cells.

Fable 5.2 High suggested the rounded distance in tile coordinates and
a late, staggered fade. Opus 5.5 High checked the edge math and the
per-geometry attribute bindings. Each mesh profile adds two floats per
possible tuft. The grass stays opaque and uses no separate shadow pass.
Longer routes, RTX Normal and independent participant acceptance remain
open.

## Installed cool night lighting on the approach

The protected release `d88590271d57` serves `c908766`, with
`e97413d21211` as immediate rollback. It uses the existing directional
light as a cool three-quarter key after sunset. The Argentine clock
brings the sun to zero before changing direction. The warm porch lamp
still marks the threshold. The sky keeps the solar clock and the water
shader keeps the authored reflection instead of adding this direct
light.

Pi 5 Broadcom V3D comparisons used matched approach poses at noon,
dusk and night on Normal (336 × 240 buffer) and Livianos (264 × 189).
Noon and dusk key direction, intensity and colour matched. The
night path crop rose from 43.5 to
48.4 on a 255-step display scale.
A separate local shore screenshot rose from 26.4
to 27.0 in the water crop with the same
wave phase. The displayed values describe these regions.
The matched renders kept 111 / 72 draws and 314,032 / 158,233
triangles in Normal and Livianos. The hot Normal candidate hit
49.9 ms p95 and registered a current thermal flag. A separate
night-only comparison measured 33.4 ms baseline
and 33.4 ms candidate p95, with final board flags
`0xe0008` and `0xe0008`.
Median differed (16.8 and 33.3 ms). Both runs
ended at 82.3 °C. The samples leave sustained Normal throughput open.

The two profiles passed low flight. A second controlled visitor saw
the same doorway. A separate Pi fixture passed the early dawn change,
then loaded the foyer with ambient .22 and the outdoor key hidden.
Returning to the exterior restored the cool key. Independent
participant and longer sustained desktop acceptance remain open.
Fable 5.2 High informed the use of the existing light and Opus 5.5 High
checked the production diff. 485 tests passed with two optional skips.
14 state files matched by hash. The protected challenge and the exact installed client,
server, worker, room art and health matched.

## Installed limestone and bronze foyer route

Protected release `6719339a8b57` serves `707a5b6`, with `f7528962fb8d`
as immediate rollback. Honed limestone picks up staggered, low-contrast
stone joints. The pale route and the bronze line in its basalt border
lead around the orientation table. The original baked light and contact
shadows provide the lighting. The browser applies the finish to the
three matching floor heights in the authored foyer, keeping both
permission-specific GLBs, the collision and the pose catalog unchanged.

The same cameras at the entry, looking along the path and beside the
bench were sampled on Pi 5 Livianos and RTX 2060 Normal. The entry crop
partially intersects the live avatar in both captures; the lower angle
and bench clearly show the floor treatment. Room draw/triangle counts
matched at each camera. Pi 5 p95 was 16.7 / 16.8 / 16.7 ms before and
33.4 / 16.7 / 16.7 ms after. On RTX 2060 the registered buffers were
matched and p95 was 16.7 / 16.7 / 16.7 ms before and
16.8 / 16.7 / 16.7 ms after. These are short camera samples.

Two authorized Chromium fixture visitors loaded the finish on the
correct open and sealed foyer models. The limited visitor's gallery
passage was denied, and fetching the other variant was HTTP 404.
The physical route entered the foyer with E. Independent participant
acceptance and longer phone motion remain open.

Fable 5.2 High informed the stone courses and bronze border. Opus 5.5
High reviewed the scoped shader and lifecycle. 487 tests passed with
two optional skips. 13 state files matched by hash. The room journal changed only for presence. Installed foyer variants, room art,
client, worker, server and protected health matched.

## Installed Harmonic Lab worktop light pools

Protected release `ccd70257f992` serves source `977a168` with `6719339a8b57`
as rollback. The existing Spatializer and Weaver lights concentrate warmth
on their worktops. The farther acoustic wall stays darker. The Beacon
key, authored HIT vault, geometry, panel actions and model bytes are
unchanged. The archive differs only in the server bundle and manifest.
The only server byte changes are the two light parameter sets.

At the same entry, Spatializer and Weaver camera poses, RTX 2060 Normal
p95 was 16.7 / 16.7 / 16.8 to 16.7 / 16.7 / 16.8 ms. Pi 5 V3D Livianos was 16.8 / 16.8 / 16.7 to
16.8 / 33.4 / 16.7 ms. A separate 120-frame Pi sample at Spatializer was
16.7 to 33.4 ms p95, and median
16.7 to 16.7 ms. With candidate
run first, p95 was 16.8 ms for candidate and
33.4 ms for baseline. The slower sample followed run
order in this check. Matching pictures used identical per-device draw-buffer
sizes, draw counts and triangles.
The selected control crops gained mean display luma from 84.5 to 93.3
for Spatializer and 84.5 to 96.0 for Weaver on RTX, without a sampled
pixel channel reaching 250. These are local still samples.

A two-visitor Chromium fixture entered with E, opened and dismissed each
target panel using its usual keyboard action, and returned through the
scoped passage endpoint. The limited visitor got 409 on passage and
404 on the art. The first visitor could read the art in the room and got
404 after leaving. Both physical profiles resolved the same focused
panel routes. Independent human use and instrument output are not
established by these fixtures.

Fable 5.2 High advised separating local light pools. The current dark vault
already has the broad baked hierarchy, so the pass reuses two existing
practicals. Opus 5.5 High reviewed the exact parameters and requested the
glare check. 487 tests passed with two optional skips. Protected serving
matched the client, terrain worker, server, both chamber models and
return leaf. 13 state files matched by hash. The room journal changed only for presence.

## Screening route

Use identical graphics quality, resolution, seed, camera and solar clock
to compare the active build and the candidate. On RTX 2060 Normal and
Pi 5 Livianos record CPU and GPU frame time separately where supported,
draw calls, triangles, worst moving intervals, worker/upload spikes and
package bytes. Sample cold arrival, calm standing, a continuous run past
the house, the dry cave approach, a long ridge view and the portal.
Review individual frames and a continuous pass across a tile seam.
Compare daylight, dusk, a handheld viewport and reduced motion. Carry
the same in-game camera and art cues to the Proyección and character
motion work. Publish exact evidence and a compatible rollback through
the existing service route.

## First measured atmosphere candidate

The corrected build uses a common linear-light horizon color for sky,
land and water. It attenuates the cosmic panorama in daylight, warms
the sunward air toward dusk, integrates ground haze between the eye
and the visible terrain, and samples the reflected sky direction at
the water. Fable High identified the divergent colors and overly strong
panorama. Opus 5.5 High prompted the symmetric path density, amber
dusk, reflection direction and fixes for texture derivatives and
night fog. Chromium's lightweight dusk and day checks compiled the
candidate shaders. The revised build and the physical daylight test
used the same environment files from `d6930a6`.

Production `476adaf02828` versus candidate `2eb727d13160`, same scripted
daylight camera and movement. Values are p95 milliseconds over the
first 55 samples after warm-up.

| Device and view | Frame interval | GPU time | Draw calls |
| --- | ---: | ---: | ---: |
| RTX 2060 Normal, arrival at 1,200 × 740 | 21.0 → 21.9 | 4.04 → 5.61 | 159 → 160 |
| RTX 2060 Normal, dry ridge | 21.1 → 20.7 | 2.78 → 4.65 | 114 → 115 |
| Raspberry Pi 5 Livianos, arrival at 363 × 244 render buffer | 29.4 → 24.2 | 13.45 → 13.00 | 85 → 87 |
| Raspberry Pi 5 Livianos, dry ridge | 17.3 → 20.0 | 13.78 → 13.85 | 83 → 84 |

These short controlled samples establish the first cost comparison,
with similar frame pacing and increased GPU cost on the RTX. They
are insufficient to qualify continuous visual quality or diagnose
the Pi ridge frame-interval difference. The foreground banks gain
coverage, but large individual grass clumps and sparse middle-distance
detail are still visible against the reference. Next reduce repeated
vertex work, improve blade silhouettes and evaluate sustained flight,
dusk, water transition and the actual detailed house. The isolated
environment candidate has no production selection.


## Installed landscape, HUD and passage pass

Protected package `a4bfd4f17dee` from `c1deb83` merges the optical
HUD and terrain branches with the installed foyer and motion release.
The near meadow now uses curved, narrower blades with many stable
appearances across rooted tiles. The weaker render profile shares the
same seeded addresses and uses simpler geometry. The blades sink into
the ground in a staggered distance fade. The path uses stable grit,
dust and roughness in world metres. The AVIF-backed passage runs its
motion and retry on the existing route.

The pair below used the same camera starts, 15:40 ART, graphics profile
and 55 moving samples per view. Figures are p95 milliseconds for interval
and GPU time. Baseline `3fd63da1fd1d`, final `a4bfd4f17dee`.

| Route | Frame interval | GPU time |
| --- | ---: | ---: |
| RTX 2060 Normal, arrival (1200 × 740 render buffer) | 21.4 → 21.4 | 4.68 → 4.28 |
| RTX 2060 Normal, dry ridge | 19.5 → 21.4 | 2.81 → 3.26 |
| Raspberry Pi 5 Livianos, arrival (363 × 244) | 30.6 → 27.8 | 17.05 → 15.79 |
| Raspberry Pi 5 Livianos, dry ridge | 20.6 → 17.2 | 11.30 → 12.31 |

A separate 23:10 ART RTX run rendered both views at 1020 × 629 after
adaptive resolution and completed the same moving checks. A 390 × 780
touch fixture opened the circular topographic map and closed it through
the native control. A separate desktop and touch test preserved the
mounted Conversation draft through the portrait and landscape control
routes. The passage's WebGL-loss test retried a single committed move,
and no duplicate travel request was sent. The suite passed 399 Node
tests with two optional skips.

The package matched 85 installed files, the existing protected audience
and receiving configuration, and native run, 30 entities and four
creation nodes. The immediate rollback is `3fd63da1fd1d`.
The night screenshot still shows strong illumination on the cream house.
The meadow is sparse in some parts of the arrival view, and the fixture
runs do not establish independent visitor feedback or final quality of
the facade, exhibits and workbench. Do not extend the optional Sand3D
assets beyond their tested trail until the wider route is composed.


## Installed night lighting at the Atelier threshold

Protected package `6a7916621c6c` from `7aa2b35` makes exterior ambient
and reflected lighting follow the Argentine solar clock. The existing
porch sconce gets one warm point light with no shadows, located from
the packaged facade's transform. The terrain retains a cool readable
floor at night. The baked foyer, geometry, room graph and admission
keep their own existing configuration.

At a matched RTX camera, an 80 × 46 pixel crop on the cream side wall
had the same median luma by day before and after the change (182.6/255).
At 23:10 ART it dropped from 171.9 to 73.5. A separate footpath crop went
from 50.9 to 41.5. The small warm sconce and sill read against the wall.
This is a local pixel comparison on the displayed output and does not
measure brightness for every surface or physical display.

At rest, each of two scenes used 36 rAF intervals. RTX 2060 Normal
kept 161 draw calls and p95 16.8 ms by day and 16.7 ms at night.
Pi 5 Livianos kept 88 draw calls and around 16.7–16.8 ms on both
versions. Each physical browser entered the existing foyer and returned
to the same exterior. The foyer recovered ambient 0.22 and disabled the
porch light, then the exterior restored the nighttime fill. Pi logged
one state read conflict during the switch and reached the correct views.

Four hundred Node tests passed with two optional skips. Fable High
reviewed the lighting direction and Opus 5.5 High reviewed the binding.
The final fixture rechecked a replaced fill light, re-applied environment
intensity and a moved facade. The deployment matched 85 installed files,
the protected UI assets, audience, configuration and native world with
30 entities and four creation nodes. Rollback is `a4bfd4f17dee`.
Continue through the exhibit rooms and active workbench in the same
visual language, with independent signed-in visitors still pending.

### Active interior reference on the torus

The exact protected package `6a7916621c6c` ran in a Chromium fixture
from the foyer through Matter and Harmonic Lab and back. Matter's return
has a generic projected door and a second floating “Vestíbulo” label over
the authored lintel. Harmonic Lab's return reads as a generic blue door
tacked on top of the stair landing. The existing Prototypes, Spatializer
and Weaver station objects resolve in the active Lab.

Use those live torus rooms for subsequent comparisons. Let the authorized
destination own a single readable plaque integrated with its frame. Preserve
the current passage slots, interaction prompts and collision clearance.
Compare the instruments from the approach and at use distance before
changing architectural fill, then review the active table and exhibits.

### Fitted Atelier returns

The source at `1c3e309` places an original Blender leaf in Matter's
existing steel jamb and uses the baked plaque above it. Harmonic Lab
reuses the leaf at the upper stair tread with one aligned plaque.
The existing MML door stays a reciprocal link on the same level.
The visible staircase now matches six solid treads and two outboard
rails, with arrival at the upper tread. The fitted leaf has no collider
of its own. Its revision is covered by the same room grant and passage
list used to render it. The normal non-toroidal gallery stair remains.

The editable exporter is
[`atelier-return-leaf.py`](../art/compaii-house/redesign/atelier-return-leaf.py).
Its original four PBR materials use no texture payload. The leaf is
1,296 triangles in four primitives and 93,832 bytes decoded or 13,754
bytes in the package. Total archive size is 33,525,760 bytes, with
the previous client bundle intact.

Exact package `b4031531fdfd` passed the Matter and Lab round trips on
RTX 2060 Normal and Pi 5 Livianos. Both browsers walked from the Lab
landing to the floor and back to 0.94 m. The fitted asset URL resolved in
its two scoped rooms and returned 404 from the foyer and exterior.
These used fixture identities. A separate software browser rendered both
doors but exceeded a timed walk assertion during concurrent qualification.
402 Node tests passed with two optional skips. Protected readback matched
86 payload files and the original configuration and audience. The active
world retained its identity and state. Immediate rollback is `b3cb2d08a6cc`.

### Terrain-first ground cover

Holding the terrain worker's script response reproduced the reported
floating grass on the installed predecessor. Four coarse torus patches
rendered while 2,749 scenery instances used the analytical surface.
The fix keeps the existing early arrival but delays optional ground cover
until the first detailed replacement is committed. Later selections retain
the previous detailed surface and the placed cover until the new set is
ready. A failed worker before the first commit leaves cover hidden.

The first rollout gated the whole scenery group. The code review caught
that this also withheld the authored overlook and its collider. The
follow-up keeps their original lifecycle, defers only analytic
ground cover and avoids preparing empty instanced field draws.

The exact packed client in `b3cb2d08a6cc` held at four patches and zero
cover on RTX 2060 Normal and Raspberry Pi 5 Livianos. After the script
response was released, they drew 112 and 64 patches and 2,749 and 1,165
cover instances. A separate Chromium fixture moved 0.81 m on the coarse
surface before releasing the script. Aborting the request kept the
coarse scene available without cover. These are fixture identities and
controlled browser loads, not a repeat of the phone playtest. The
artificial wait still exposes the coarse geometry around the authored
facade. 401 Node tests passed with two optional skips. The new regression
asserts that the overlook collider is registered and disposed with
terrain detail still pending.
