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
