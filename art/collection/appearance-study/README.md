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
