# Matter workshop Gaussian appearance study

This study keeps the room graph, editable Blender scene, movement, interactive
fixtures and Collection editions in their existing Holodeck owners. It changes
only the static render in an isolated browser run. The comparison uses the
[workshop Blender source](../matter-workshop.blend) as a calibrated scaffold.

## Capture and fit

Run from the repository root. Use Blender 5.2.2, Python with NumPy and
FFmpeg. The capture has six fit viewpoints and a seventh held-out viewpoint
called `held`. The latter never enters the fit. A camera projection is tied
to the first surface hit and its facing normal. Dynamic display parts and
archive glass stay separate.

```sh
blender --background art/collection/matter-workshop.blend --python-exit-code 1 \
  --python art/collection/appearance-study/capture.py -- CAPTURE_DIRECTORY
```

Use the entry, east and reverse renders as the respective ImageGen edit
targets. Keep a single material and lighting brief across the three edits.
Use the first edited view as the material reference for the other two. Specify
an uncropped 3:2 frame, the existing lens and silhouettes, oiled dark oak,
honed limestone, malachite, limewash, aged bronze, blue dusk and warm lights.
Preserve the geometry and omit people, moving exhibits and new furniture.
Save the three selected edits beside the renders as `entry-style.png`,
`east-style.png` and `reverse-style.png`. The other three Blender captures
contribute coverage.

```sh
python3 art/collection/appearance-study/fit.py CAPTURE_DIRECTORY
python3 art/collection/appearance-study/fit.py CAPTURE_DIRECTORY --light
```

The fitter merges points on the Blender surfaces, using the calibrated depth
and facing normal to reject occluded or unrelated samples. It writes a
32-byte-record `.splat` for Blender color, raw ImageGen color and guided
color. Guided color bounds the generator's local color and texture change
around displaced edges. The light variant coarsens sampling and offsets the
splat centers 18 mm toward the exposed side for a GLB underlay. The format
stores oriented Gaussian scale, opacity and direct RGB. This is a fixed
geometry appearance fit without trained spherical harmonics or learned
positions. Reuse a single bounded capture directory. Keep selected image
masters and the outcome evidence. Rebuild disposable geometry and bundle
derivatives from these inputs for another pass.

## 23 November 2026 result

Spark 2.4.0 and the app shared the same Three.js instance in a loopback
Chromium trial. The Spark-only Trial bundle was injected into the existing
Holodeck client in the test browser, with no receiving path added. The dense
fit had 307,343 Gaussians (9,834,976 bytes), with 85% of points observed by
more than one calibrated camera and 85% receiving some generated color. The
hybrid used 123,392 Gaussians (3,948,544 bytes) over the room GLB. It kept the
opaque fallback and the live rotating archive mesh, and prevented invisible
collision boxes from writing to the visual depth buffer while retaining their
collision surfaces.

The isolated Chromium route showed the splat from the reserved camera and
walked to the worktable and around it, independently stopped at the archive
cabinet, and returned through the room door. Access to scoped room art was
denied after exit. In a separate two-browser trial, the desktop visitor
selected an exact part of the Support Study on the worktable with the hybrid
visible and captured the reference. The existing Conversation and native
transport delivered the exact reference in the isolated run with simulated
actors and a scripted worker. The original response appeared once and its
receipt was recoverable after returning. The comparison was rendered using three
matched views. The two higher-density variants had coverage holes and soft or
doubled edges. The hybrid improved coverage and retained painted atmosphere,
with softness and residual edge artifacts still visible.

In the lightweight software-WebGL profile, at 1020×680 CSS pixels, the
stationary hybrid had a median frame interval of 1,117 ms and p95 of 2,367 ms
over 20 samples. The stationary GLB measured 283 ms median and 983 ms p95
in the same browser and room. The samples used different room positions.
Walking with the hybrid reached 2,100 ms median and 5,367 ms p95. These
software-renderer samples describe the cost in this fixture. Target GPU,
peak VRAM and physical Raspberry Pi performance were outside this trial.
The splat remains an experiment. The live room still uses its Blender GLB.

## Direct UV material proof

Nicolás selected a reusable workflow from neutral Blender volumes and ImageGen
references, with a pure-splat physical Raspberry Pi trial, a splat-and-mesh
interaction trial and a texture-on-mesh trial. This first texture proof uses
the exact existing Matter floor and fixed room fixtures; it does not yet
produce a complete skin from a new neutral blockout.

Using the built-in ImageGen tool, request an orthographic square of honed
honey limestone using the approved Matter room view for style. Ask for a
seamless diffuse base-color swatch, one approximately 1.2-meter slab, with
neutral lighting and no shadows, grout, crop or perspective. Then run:

```sh
blender --background art/collection/matter-workshop.blend --python-exit-code 1 \
  --python art/collection/appearance-study/floor-skin.py -- \
  LIMESTONE_BASE_COLOR.png OUTPUT_DIRECTORY
```

The script maps the stone and regular joints at room scale. Cycles bakes
diffuse illumination from the existing fixtures onto the same floor UVs.
The generated PNG is the editable baked atlas and the JPEG derivative is
embedded in the floor-only glTF. Two Blender camera renders use identical
geometry. The JPEG export was read back as one primitive, one UV channel and
one embedded image, totaling 69,136 bytes.

For a second ImageGen pass, use the complete baked atlas as the square edit
target and the scene image only as style reference. Request the existing ten
rows and columns, no crop, and exact pixels for every grout line and the
bench and cabinet shadows. Request only grain and palette changes on the
existing texels. Apply that image to the same UVs for the second comparison.
In this run the 18 interior grid lines differed by at most one pixel after
resampling both atlases to 512 × 512. The direct ImageGen pass deepened the
cabinet shadow and some local tonal variation. Both variants rendered from
the entry and a lateral camera. The 69,136-byte result describes the
deterministic bake variant, with browser and physical-device qualification
still open for the new texture route.

## Playable three-way comparison

The paired [Manipulación de Materia viewer](https://compaii.dmn.homes/access/sso/start?return=%2Fview%2F399b24e2533949bd9dadfc5b5ecc7695%3Fdisplay%3Dwork)
keeps the same camera and navigation across the pure splat, the hybrid with a
rotating archive platform, and the UV-mesh mode. The pure and hybrid views
use the same lightweight guided fit. The UV result in this viewer is the
ImageGen limestone with Blender-baked illumination, applied to the floor
only. The static comparison image shows the two UV baking approaches.

To reproduce the published package, copy the HTML and CSS from `viewer/`
into a fresh staging directory and bundle `viewer/main.mjs` using the
repository's pinned esbuild with `--bundle --minify --format=iife`, saving
the output as `viewer.js`. Stage the workshop GLB from
`public/room-art/matter-workshop.glb` as `room.glb`, the lightweight
guided fit as `matter.splat`, the floor-only GLB as `floor.glb`, the
UV comparison plate as `comparison.jpg`, and Three's license as
`three-license.txt`. Retain at most the current and previous published
derivatives and keep the capture and bake sources under their existing study.

This comparison uses WebGL2 and sorts the Gaussian instances by camera
depth. It needs no embedded workers or WASM in the Homes sandbox. Reduced
graphics caps the drawing buffer at 260,000 pixels with antialiasing
disabled. Chromium under the scoped artifact sandbox rendered all three
views, preserved the camera across mode changes, moved using keyboard
and emulated touch, and rotated the archive platform in the hybrid.
Physical Raspberry Pi load time and frame rate remain unmeasured.

## Orbital art direction and floor A/B

The orbital draft uses a multiview design sheet for the worktable, archive
cabinet, pendant lamp, and shelves. First edit the entry capture with that
sheet to establish the cabin's titanium, graphite, orange, amber and cyan
materials. Then edit the east, west, reverse, side and shelf captures, with
the entry result as the material reference and the sheet as the object
reference. In each edit the camera, large silhouettes and occlusion come
from the matching Blender capture. The camera calibration stays in Blender
coordinates across every view.

Stage the six results as `NAME-style.png` beside the matching captures.
Run `fit.py CAPTURE_DIRECTORY --orbital` and stage `guided-orbital.splat`
as `orbital.splat` alongside the existing comparison assets. The 4 cm fit
uses all six edited views and contains 220,650 Gaussians. A point needs a
depth and surface-normal match to receive color. Closer, more face-on
views receive greater weight. The seventh capture remains outside the fit.
ImageGen views remain approximate near silhouettes. The browser result has
fixed projected light and surface color, and can show softened or doubled
edges from close angles. Keep the inputs in one bounded study workspace and
replace disposable fitted outputs when repeating the trial.

In the viewer, select **Textura UV** and **Mirar el piso** for a matched
camera comparison. Switching **Material original** and **ImageGen +
sombras** swaps the two floor meshes in place, preserving the camera, room,
and interaction state. The generated result changes both the limestone
appearance and the baked light contribution.

## Nine-view detail comparison and full-room UV

Run the capture command with `CAPTURE_DIRECTORY --fine` for 1152 × 768
references. The mode includes the six established cameras plus the threshold,
archive and bench cameras. The three new edits use the exact corresponding
Blender render first, the established entry and a second matching orbital
render as the appearance references, and the fixture sheet for recurring
object details. The matching file stems are `threshold`, `archive` and
`bench`. Retain the nine selected ImageGen masters and the object sheet.
The reference images exposed in the viewer are resized JPEG derivatives.

Run `fit.py CAPTURE_DIRECTORY --detail` to fit 626,496 oriented Gaussians at
2.4 cm spacing. The compact file stores 12 bytes per point and is projected
from the same nine output images. Stage `orbital-detail.bin` in place of the
earlier `orbital.splat`. The viewer culls points outside the camera and
subsamples the detail fit for its lightweight mode. The mesh scaffolding
calibrates color projection with first-hit depth and normals. Independent
image edits can still place edges and reflections differently, which
limits sharpness even when more positions receive color.

Run the following with Blender 5.2.2, its NumPy distribution and FFmpeg:

```sh
blender --background --python-exit-code 1 \
  --python art/collection/appearance-study/surface-bake.py -- \
  public/room-art/matter-workshop.glb CAPTURE_DIRECTORY OUTPUT_DIRECTORY
```

Stage `orbital-room.glb` with the viewer. The script unwraps all opaque
room surfaces into an original 2048 × 2048 atlas. For each texel it
selects visible source projections using depth and face direction. The
existing geometry therefore defines edges and openings even when source
views disagree. Hidden, occluded and out-of-frame portions use a matching
material palette. The archive glass and rotary display retain separate
materials and meshes. The older two-material floor comparison remains
available under **Piso A/B**. Keep one bounded working directory and
retain the previous published comparator through the existing history
policy.

## Geometry and appearance research, November 2026

The selected objective is a stable, editable room and object hierarchy with
replaceable appearance. Collisions, semantics, links, transforms and moving
assemblies stay on the Blender-derived scene. An appearance revision can
supply PBR materials, lighting and optional radiance-field assets associated
with stable object IDs. The fixed projection in the browser is a pretraining
baseline. It does not learn Gaussian centers, scales, rotations, opacity or
view-dependent color.

### Local evidence

A depth and normal reprojection on the nine independently styled images
matched 233,079 samples across 36 camera pairs. The average per-channel
absolute RGB differences were 28.63/255 for the generated images and
1.48/255 for a coherent rerender of one static UV scene at the same cameras.
Occlusions and most silhouette samples were excluded. The two methods
measure disagreement on measured co-visible surfaces. They do not rank
artistic style, and physically valid camera-dependent highlights can also
contribute to the photo error.

`training-capture.py` produces a bounded synthetic dataset from one orbital
room asset and the neutralized geometry seed. Use the normal Blender build
and NumPy:

```sh
blender --background --python-exit-code 1 \
  --python art/collection/appearance-study/training-capture.py -- \
  orbital-room.glb orbital-detail.bin DATASET_DIR
```

The output contains calibrated 768×512 JPEGs, metric camera-to-world poses,
40 train images and eight held-out images, explicit split lists and a neutral
PLY. For Brush 0.3.0, create a separate working dataset with the same image
and seed files. Split the frames of `transforms.json` into
`transforms_train.json` and `transforms_test.json` using their explicit lists,
copying the common intrinsic and seed fields. Brush selects transforms by
filename, so do not include the unsplit JSON in its input. For controlled
coverage comparisons, retain one camera manifest and choose nested training
subsets. Keep the evaluation frames and training settings fixed.

First Brush pilot used 512 px maximum resolution, 160,000 maximum splats,
100-step refinement, SH degree 3, and 1,100 training steps. The matched
eight-view average PSNR was 24.08 dB at 550 steps and 26.69 dB at 1,100 steps
against the resized source images. The last PLY was retained. The GPU run
completed within the designated short allocation. These numbers qualify
training and held-out view rendering on a single scene with mostly baked
color. They do not validate detail from independent AI edits, material
relighting, runtime load on mobile or a full published splat.

`view-overlap.py CAPTURE_DIR CONTROL_DIR` reads the nine calibrated depth
captures, their ImageGen edits and the control rerenders of a single static
scene with the same camera calibration. Its counts and differences can be
used as one part of judging a new generation method.

### Research and independent review

- [WorldMesh, ECCV 2026](https://mschneider456.github.io/world-mesh/) is a close
  geometry-first precedent. It stabilizes appearance across views by
  accumulating texture on the scaffold and using it for subsequent
  generation, then demonstrates the 3DGS reconstruction. Its public CLI's
  complete pipeline also generates layout and reconstructs objects.
  Test its texture propagation on existing geometry before adopting that
  broader pipeline.
- [CustomTex, CVPR 2026](https://chenweilinx.github.io/CustomTex/) uses concrete
  per-object references, depth and instance masks to optimize shared scene
  UV textures. It is a useful benchmark for the editable material route.
- [DiffStyle3D, ICML 2026](https://proceedings.mlr.press/v306/yang26cd.html)
  integrates geometric correspondences in latent attention for styling an
  existing 3DGS model. It is relevant for an experimental residual layer,
  rather than evidence that an arbitrary room can be newly generated
  from pixel edits without side effects.

Claude Code returned a successful review with Claude Fable 5.2 at high
effort. It independently selected shared UV/PBR as the primary appearance
representation, and proposed testing both joint multiview generation
followed by 3DGS, and local radiance-field detail attached to object IDs.
It flagged that training on the unlit atlas is only a reconstruction
control. To test view-dependent highlights, use a coherent scene with
specular material and light. Record held-out close-up detail, projection
consistency, geometric and semantic masks, local style changes and
object motions before selecting a representation for production.


## Orbital finish for the Matter room

The room-owned Blender file is the editable geometry. The selected design
keeps that layout and assigns a replaceable material pack over the authored
objects. The generated, reusable albedo pack is
[`orbital-materials.jpg`](../orbital-materials.jpg). Its six square swatches
are bulkhead, navy anti-static surface, deck, orange enamel, brushed steel
and graphite. Seam blending and derived micro-normals are generated from
the same source at texture build time. Blender owns roughness, metallic
response, normals and lighting. The pack embeds no camera-dependent colors.

```sh
python3 art/collection/appearance-study/pack-materials.py \
  art/collection/orbital-materials.jpg TEXTURE_DIR
blender --background art/collection/matter-workshop.blend --python-exit-code 1 \
  --python art/collection/appearance-study/orbital-finish.py -- TEXTURE_DIR OUTPUT_DIR
```

The exporter writes an editable styled blend, a standalone managed GLB
with embedded textures and a Cycles static occlusion UV atlas, per-object
material assignments, and three exact
camera renders. It batches static geometry by material and keeps glass,
lettering, and the rotating archive parts separate. Its result is selected
by the room's normal `matterCollection.art` configuration. The existing
MML room route, selection and interaction semantics remain authoritative.
Keep the generated concept and albedo master in the project source store.
Reproduce disposable maps and comparison renders in one bounded staging
directory. See the shared deployment guide for the exact profile names.

The method uses one 3D surface material as the authority across views.
[CustomTex](https://chenweilinx.github.io/CustomTex/) and
[SceneHI](https://arxiv.org/abs/2609.10363) represent further routes to
learn these materials jointly across views. The current builder is
a selected art direction and deterministic PBR authoring pipeline, not
a reproduction or a measured ranking of either paper's generator.

The candidate and original GLBs have identical sets of 7,717 world-space
triangles at 0.1 mm quantization. The orbital GLB is 1.21 MiB. In a controlled
test of the full packaged Holodeck runtime, Chrome on Intel UHD rendered
the selected model, entered from the foyer, respected both furniture
collision bounds, moved around the table, advanced an archive edition
and turned the mounted platform, and returned to the foyer. The served model
became inaccessible on exit. At 1020×680, the stationary 31-frame sample
had 16.7 ms median and 16.8 ms p95 frame intervals. The city-scale rendering,
physical mobile devices, sustained moving frame-time and visual parity
with top published work are separate acceptance questions. The orbital
selector remains a release candidate.

### Reference-matched Blender scene

The [chosen concept](../orbital-concept.jpg) is a shot reference for construction and illumination,
including the area-emitter dimensions, the contrast between the cool service
bay and the warm entrance, reflected structures in the glazing, and the
contact shadow under the bench. The reference finish models a service bay
behind the existing apertures, hardware on the worktable and archive, tangent
material response, transmission in the glazing, and a thin scattering layer.
A Cycles scene and a restrained optical glow pass produce the reference
renders. The editable objects and semantic anchors of the original room
remain the layout authority. The new detailing belongs to its own collection.

Starting from the editable `matter-orbital.blend` produced above, run this
with Blender 5.2.2:

```sh
blender --background matter-orbital.blend --python-exit-code 1 \
  --python art/collection/appearance-study/orbital-reference-finish.py -- OUTPUT_DIR
```

The output contains an editable reference scene and three calibrated renders.
The entry camera supplies the direct comparison against the concept. The
bench and return cameras are outside the concept view and show how the light,
materials and secondary geometry behave as the camera moves. Keep this
rendering reference available to the calibrated capture pipeline. The
interactive profile has its own real-time light budget and release evidence.

### Second artist pass

Claude Code (Fable 5.2, high effort) received the selected concept, Blender
entry and bench renders, and the authoring script. Its pass adds broken
specular response to the worn floor, brushed ceiling metal and more focused
key lighting. The entry comparison showed a more convincing floor and
ceiling, with darker walking lanes and stronger blue reflections.

Apply the combined treatment to the editable reference scene. It keeps the
surface response, restores fill and softens the blue and orange highlights.
Use absolute output paths for repeatable renders.

```sh
blender --background OUTPUT_DIR/matter-orbital-reference.blend --python-exit-code 1 \
  --python art/collection/appearance-study/orbital-combined-finish.py \
  --render-output /absolute/output/combined-entry- --render-frame 1
```

The comparison used the same 18 mm camera and 1152 × 768 Cycles settings for
both variants. It checked the transforms of all 229 non-light, non-camera
objects, including the archive platform and worktable. The reference still
shows finer material variation and less conspicuous reflections in the
windows. This grade was evaluated in Blender at the entry view. Live movement,
interaction and physical-device performance need a real-time validation
before using it as the room appearance.

### Orbital fixed-light bake

Open the editable combined-finish scene and bake its fixed diffuse light and
procedural base color to a secondary UV atlas:

```sh
blender --background matter-orbital-combined.blend --python-exit-code 1 \
  --python art/collection/appearance-study/orbital-runtime-bake.py -- OUTPUT_DIR
```

Blender bakes fixed irradiance and material color independently. A bounded
local filter suppresses isolated light spikes before combining the two
passes, preserving the base material texture. The default export batches
static surfaces into one unlit shell. The platform, its children, glazing
and emissive fixtures retain separate geometry and materials. The 1024²
GLB is 1,262,068 bytes. The protected Matter room can select it as
`matter-workshop-orbital-baked-v1`, using the same colliders and anchors as
both predecessor profiles.

Matched software-WebGL runs at 1020 × 680 with lightweight graphics:

| Room art | Cold door to rendered room | Stationary median / p95 | In-motion check |
| --- | ---: | ---: | --- |
| Orbital PBR predecessor | 2.56 s | 133 / 283 ms | 2.18 m; 5 retained intervals |
| Clean diffuse bake | 2.09 s | 83 / 100 ms | 2.18 m; 6 retained intervals |
| Diffuse bake with live specular | 2.23 s | 250 / 283 ms | 2.11 m; 1 retained interval |

The measurements are single controlled runs. The sample counts do not
support moving performance rankings. In a separate touch emulation at
390 × 844, the clean bake loaded in 2.60 s and the real joystick moved
the player 2.42 m. Both lightweight fixtures crossed both ways through
the foyer, verified furniture bounds, rotated the archive and saw the
scoped asset close after exit. The app and browser are real. The actor
and Collection source were fixtures. Physical device performance,
precise camera stress and a full live review on the table remain open.

Use `--specular` to compare emissive baked lighting with additional
UV-baked roughness and metalness under the existing live light rig. The
1,380,808-byte trial GLB preserved those channels and produced visible
reflections. It washed out the contrast and had materially higher static
cost in the matched software fixture. It is a reproducible art candidate
and remains outside the selected runtime profile. Next revisions should
reduce reflected-light intensity and compare more motion before selection.

The exact clean bake also ran under the packaged Holodeck client with a real
retained Support Study on the table. Two independent fixture browsers decoded
197,642 triangles from the pinned historical edition. Their table rotations
stayed independent. The conversation context fixture received the exact
edition, scene and part. The test then revoked that edition for one visitor,
shared the still-readable 34,000-triangle current edition and cleared the
table for both. The controlled local gateway used retained original Home
files. This validates the scoped interaction without acting on the live table.

A separate, longer SwiftShader route recorded 83 moving frame intervals in
the clean bake, with a 100 ms median and 150 ms p95 at 1020 × 680 in lightweight
graphics. The same browser script sampled the main camera 24 times while
orbiting and changing zoom near one room corner. All sampled camera centers
stayed inside the room envelope. These results describe one software-rendered
fixture route and the sampled centers, not physical-device frame pacing or
complete near-plane coverage.

In the same longer SwiftShader fixture route, the orbital PBR predecessor
recorded 59 moving intervals at 150 ms median and 317 ms p95. Both variants
passed the 24 sampled corner camera centers. The six-figure worktable sample
used the separate two-client qualification above.

A physical Raspberry Pi 5 ran the exact clean bake through Chromium 154 with
the Broadcom V3D OpenGL ES renderer at 1020 × 680 in lightweight mode. Over
371 moving intervals it measured 33.3 ms median and 50 ms p95. While stationary
it measured 16.8 ms median and 33.4 ms p95. The browser crossed the door in
both directions, advanced and rotated the archive, sampled 24 camera centers
inside the room envelope and received 404 for the art after leaving. Cold door
entry was 12.93 s, including a 0.91 s transfer of the 1,262,068-byte GLB. The
fixture server ran through a scoped loopback SSH tunnel, so these timings
do not establish the production delivery path's latency. The browser profile
and both forwards were closed. No physical touch or full worktable trial on
the Pi was performed in that run.

On the same Pi and route, the orbital PBR predecessor recorded 271 moving
intervals at 33.4 ms median and 66.6 ms p95, and its cold doorway took 9.86 s.
Its move response arrived at 0.49 s, the new presence socket was created at
2.40 s and the art response arrived at 5.29 s. The GLB transfer took 1.07 s.
This isolates only part of the entry delay. In this pair, the clean bake
had better frame pacing while moving and a slower cold doorway. Qualify
the phases across repeated loads before attributing the difference to art
decode, connection handoff or the tunnel.

### Cold doorway with concurrent art loading

The client now starts fetching and parsing the exact scoped GLB after the
server accepts entry, while presence reconnects. It mounts the scene once the
presence scope matches. In one cold run per configuration on the same physical
Pi through the same tunnel, the packed model response moved from 3.67 s to
0.78 s after crossing. The optimized client made one model request and its
654,542-byte encoded body finished about 0.97 s after the browser recorded
the crossing. The DOM first observed both the room mount and model readiness
about 6.30 s after that browser timestamp. The separate browser-automation
check for full readiness finished at 14.51 s, up from the start of the door
action, versus 15.09 s with the previous load order. These measurements use
different observation points and do not identify the cause of the remaining
delay. Both runs returned to the foyer and confirmed 404 for the scoped model
after exit. The test profiles and forwards were removed.

### First visible interior frame

The client suppresses WebGL draws behind the passage overlay until the
authorized interior can produce a complete frame. The frame loop and
collision processing continue. A cold physical run with the same packed
bake and the previous draw behavior spent 12.24 s from the browser's door
action to the overlay clearing. The candidate took 10.93 s. This pair also
had different presence confirmation times (3.53 s and 1.79 s), so the
end-to-end difference cannot be attributed to the draw change. In the
candidate, the first ready call to the renderer took 9.03 s and the next
draw took 11 ms. Model transfer had already finished at 0.83 s. The entry
and return still worked on the Pi, desktop Chromium and emulated touch.
