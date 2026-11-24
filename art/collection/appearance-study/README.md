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

New calibrated captures also save camera-space metric depth and a visible
surface index alongside the existing world-position/normal grid. The index
resolves through `surfaces.json`; set `holodeck_surface_id` on authored Blender
objects whose identity must survive a rename. Indices are local to the
catalog and zero marks a miss. The capture stores Blender camera-to-world
and full-resolution pixel intrinsics `fx, fy, cx, cy`. The half-resolution
grids sample at full-image coordinates `(2*x + .5, 2*y + .5)`.

With these masks the fitter keeps distinct surfaces in the same voxel and
rejects a cross-view color sample from a different surface, even when depth
and normals agree. The camera set must agree on the surface catalog. Legacy
captures without masks still exercise the original fit. Object identity
helps avoid projection bleed across authored boundaries. It cannot correct
detail that a generated view depicts in the wrong place on a valid surface.
An entry/east calibration check reprojected 195,051 visible samples to within
0.0002 source pixels and recovered 64 shared surface IDs. In the six-view
control with Blender RGB in every view, identity withheld 1,043 color votes
that passed depth and normal checks. Keeping separate samples at shared voxel
boundaries increased the lightweight fit from 123,392 to 126,002 splats.
The legacy fit regenerated the exact previous bytes from those same views
with the new fields removed. This is a correspondence test using coherent
renders. It leaves style coherence and the visual benefit of the extra
boundary samples to be verified on generated inputs.

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

### Single-surface hybrid in the packaged room

The trial profile `matter-workshop-floor-splat-v1` shares the exact GLB,
colliders, Collection anchors and transforms of `matter-workshop-v1`.
It loads an actor-scoped compact splat through the existing room art route,
then replaces only the named visible floor mesh. The furniture and actual
rotating archive stay in the existing scene. The client retires the splat
on exit and restores the floor when no splat is mounted. A withheld
binary test left the original mesh usable.

Reuse the nine approved generated views from the orbital study. Recapture
the same nine cameras from the editable workshop using `capture.py --fine`
to get the exact depth, pose and surface masks. Build the floor-only fit and
regularize it using the measured floor bounds:

```sh
python3 art/collection/appearance-study/fit.py CAPTURE_DIRECTORY \
  --detail --surface 'Full room walking surface'
python3 art/collection/appearance-study/planar-splats.py \
  CAPTURE_DIRECTORY/orbital-detail.bin OUTPUT.bin \
  --bounds -5.94 5.94 -5.98 5.98 --spacing .045
```

The planar resample requires SciPy. It rejects nonhorizontal input instead
of stretching positions across physical surfaces. It makes 70,224 points
from a measured 149,903-point fit. 8,503 cells are farther than one grid
step from a fitted observation. These colors are extrapolated, with the
largest gap under occluded geometry about 1.10 m from an observed sample.
The renderer uses a 33 mm Gaussian radius and uploads the visible slice of
the sorted index buffer. The full-room masked fit, retained separately,
produced 630,215 points. It excludes the held-out camera and remains
an analytic point fit, with no learned radiance or view-dependent color.

On Cuevanico in lightweight mode, the paired packaged room runs at 1020 ×
680 measured the following moving intervals. All three ran with the real
Pi renderer and scoped loopback tunnel, with fixture identities and room
data.

| Floor appearance | Moving samples | Median | p95 |
| --- | ---: | ---: | ---: |
| Existing mesh | 334 | 33.3 ms | 50.0 ms |
| Irregular fitted splats | 172 | 66.6 ms | 100.0 ms |
| Regularized splats | 231 | 50.0 ms | 66.7 ms |

The comparison at the same player-height view shows the bright holes along
the walls disappearing with the resample. Its floor remains visibly softer
than the generated reference and differs from the rest of the base room.
The regularized run turned the archive, cleared 24 corner camera samples
and returned through the doorway. Both the GLB and the splat URL refused
reads after exit. The matched mesh remains the practical lightweight choice.
In a separate two-context run on the physical Pi, the desktop writer and
emulated-touch reader both mounted the regularized layer. They shared the
retained 197,642-triangle edition, rotated independently, prepared an exact
part reference, enforced edition-specific revocation, and shared and cleared
the 34,000-triangle edition. Following the large edition took 7.37 s in that
run. The actor identities and Conversation receiver were fixtures.
The regularized standalone-desktop-client route also passed the door,
archive and sampled corner checks on SwiftShader, but moving frame pacing
was poor (733 ms median, 1,550 ms p95 over 11 intervals). Two-context
SwiftShader entry for the earlier, irregular layer timed out.

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
The later [Cuevanico run](#physical-splat-comparison) covers physical
Raspberry Pi load time and frame pacing.

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

`training-capture.py` produces a bounded synthetic dataset from an orbital
GLB or an editable Blender scene and the neutralized geometry seed. Use
the normal Blender build and NumPy:

```sh
blender --background --python-exit-code 1 \
  --python art/collection/appearance-study/training-capture.py -- \
  orbital-room.glb orbital-detail.bin DATASET_DIR
```

The output contains calibrated 768×512 JPEGs, metric camera-to-world poses,
40 train images and eight held-out images, explicit split lists and a neutral
PLY. An editable Blender source preserves its view transform and lights.
Use `--samples` to control Cycles samples per view. The receipt records
the source and seed hashes, view transform, sample count and image hashes.
For Brush 0.3.0, create a separate working dataset with the same image
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

The editable glossy orbital source was captured with AgX at eight Cycles
samples per camera. A new fit used the same Brush compute settings and a
neutral 68,991-point seed. On its own eight held-out cameras, mean RGB
PSNR was 19.96 dB after 550 steps and 21.68 dB after 1,100 steps, using
sRGB pixels and a Lanczos resize to 512×341. The reference images differ
from the earlier GLB pilot. The final fit contains 133,645 Gaussians with
spherical harmonics through degree 3. Chromium loaded the 2,089,169-byte
SPZ and drew all eight held-out views. At the wide view of the worktable,
panel seams, hard edges and glazing reflections are visibly softer than
the reference. The observed browser path was a software-rendered loopback
preview. The same SPZ was then loaded by hardware-accelerated Chromium on
Cuevanico (Broadcom V3D). Fetch and decode took 1.73 s through the fixture
tunnel. In an isolated 960×640 canvas, a camera move between two held-out
poses measured 100 ms median and 116.7 ms p95 over 90 post-warmup frame
intervals. This preview exercised camera motion only. The fit is retained
as a full-room control for further comparisons.

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

### Constructive review of the spatial style architecture

In the 24 November follow-up, Claude Fable 5.2 at high effort completed a
text-only analysis of the provided implementation and measurements after
the image-based review and its follow-up timed out. It proposed a compiled
style cascade, with per-surface material roles and optional node-local
Gaussian layers. It singled out two gaps in the current hybrid: a coordinate
box to exclude the archive platform and two visible representations drawing
the same opaque surface. Its recommendation was a coherent baked/PBR mesh
as base and a learned, surface-bound splat where close-up evidence justifies
the extra representation. These are Claude's design recommendations. This
run did not execute, inspect images from, or modify the Blender project.

In a second text review, Fable 5.2 at high effort recommended replacing
the hardcoded orbital/amber atlas swap with a versioned look manifest,
then loading both looks through one path. Surface roles and stable scene
IDs select material channels, texel density, decals and look-level light
and environment settings. The authored sources stay editable and atlases
are derived outputs. Fable recommended separating static indirect light
from base color, excluding moving doors and the archive from fixed
occlusion, and lighting moving parts from probes and local shadows.
A two-state door lightmap blend is an unverified candidate. It recommended
keeping the full-room learned splat as a comparison control and deferring
local splats until their added visual detail justifies their frame cost.

Use one authoring contract for the two existing looks before generalizing
selectors. Keep structural geometry, collisions and native interaction
references invariant. The look can add disposable visual relief in a
declared, bounded slot. A silhouette or passage change that affects
occlusion, picking or traversal needs a compatible structural revision.
Recompile one material role independently and compare the same reserved
cameras, joints and glazing against Blender. Include new door and archive
poses, identical native interaction tests and moving-frame median and p95
on the physical Pi. These checks are proposed acceptance evidence for the
shared contract. The comparison measured so far used the room-specific
bindings and fixed-light maps.

For Holodeck, keep the native Room, Collection and passage authorities.
Export stable object and surface-slot IDs with Blender geometry, and bind
style independently of those IDs and their transforms. A reusable look
defines choices by material role, object class and surface slot, with room
and object overrides. Resolve those choices before shipping tier-specific
materials, fine-detail maps, lightmaps and optional splat chunks through
the existing scoped art path. Mesh and splat candidates must use the same
piece of structure, with one visible base representation per surface.
Record which visual assets were selected so a changed theme or object can
invalidate its own material outputs and the lighting that actually depends
on it. The material binding and inheritance ideas have a production
precedent in [UsdShade](https://openusd.org/release/wp_usdshade.html); the
compiled browser artifact can remain glTF without adopting USD as the
runtime format.

Prove the split first on Matter's work surface and archive with two visibly
different styles at the same camera positions. Exercise a material override,
an object move and a door change while retaining IDs and exact worktable
references. Compare generated close-up detail and occlusion from reserved
views, then compare PBR and surface-bound splats on one eligible object in
the same runtime. Coherent geometry-conditioned video is a source candidate;
the demonstrated object pipeline in [Ink3D](https://github.com/YueHan99/Ink3D.TextureGen)
does not establish room-level camera or depth consistency. Measure lighting
invalidation against a full rebake after each edit. The prior co-visible
error and single-route Pi frame time are comparison baselines; their values
do not set universal acceptance thresholds. Any first-frame shader change
needs a physical repeat because queuing screen shaders alone already failed
to reduce the first-draw cost.

The focused Matter export introduced **Apariencia → Estilo de la sala** in
the live-room client. The authored orbital look is the default. **Luz ámbar**
applies separate color factors to the fixed-light shell and the emissive
work surfaces. The renderer binds the rules to the exact material slots
from this export and clones those materials per mounted room. Both styles
reuse the same textured geometry and exact art revision. The control is
local to the current page and stays independent of the saved avatar choice.
This increment establishes local style selection and reversibility. Its
rules are color grades over the existing bake, with no new detail maps or
recomputed lighting.

In a packed application fixture, one desktop writer and one emulated-touch
reader each changed style independently. The room node and the original
197,642-triangle model stayed mounted, and the shared worktable revision
did not change. Switching back restored the exact original material
factors. The same two clients then rotated the model independently,
prepared an exact part reference and verified edition revocation and
table clear. The part source was retained Home geometry; identities and
decisions were fixtures.

On Cuevanico, the packed room fetched its art once. The browser then
applied amber and restored orbital without fetching again or remounting
the room. The operator clicked the foyer door and the old scoped art
request returned 404 after exit. Attempting the E hotkey immediately
after dismissing Appearance did not move: keyboard focus was still on
the Appearance button. The verified round trip used the door control.

### Authored amber materials on the same structure

The amber selection now loads its own baked light and material-response
atlases. The editable recipe gives the deck warm stone variation, the
fixtures a green patina, and the work zones separately authored light pools.
It builds on the combined orbital source with identical object transforms.
To reproduce it, open that source and run:

```sh
blender --background matter-orbital-combined.blend --python-exit-code 1 \
  --python art/collection/appearance-study/orbital-amber-look.py \
  --python art/collection/appearance-study/orbital-runtime-bake.py -- OUTPUT_DIR \
  --specular focused --size 2048 --layout-size 1024
```

The 2048 diffuse/light atlas and 1024 packed roughness/metalness atlas come
from the export. The amber and orbital GLBs generated for comparison have
byte-identical positions, indices, normals and UV attributes for both
styled material batches. Ship only the amber maps. The existing 1024 UV
layout stays bound to base geometry, so changing style swaps maps at the
material slots without rebuilding geometry or reloading the Collection.
The GLB and both image revisions use the same scene authorization and
are readable only while the visitor can occupy the selected room.

The packed desktop and emulated-touch browsers selected the new maps
independently while sharing the 197,642-triangle worktable model. The
mounted shell, displayed model and exact worktable revision stayed in
place. The active view restored the orbital maps on selection and the
shared part reference and revoke/clear flow still worked.
On the physical Pi, in lightweight mode through the fixture tunnel, the
first amber choice took 1.79 s to fetch, decode and apply the two atlases
(415,034 and 651,883 transferred body bytes). It reused the mounted GLB.
Switching back to orbital restored its original maps, and after returning
to the foyer the GLB and both atlas endpoints refused access.
A separate Pi run with amber active retained 387 moving intervals
at 33.3 ms median and 33.5 ms p95, turned the archive and cleared all 24
sampled corner positions. A desktop fixture forced one atlas request to
fail. The room kept its orbital appearance and a voluntary retry loaded
both amber maps.


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

The `--specular focused` export keeps the fixed-light atlas on 11,948
triangles and applies a weaker live response to the 196 triangles of the
worktable rim, model pad and archive rear panel. The same atlas supplies
emission in those surfaces, alongside the baked roughness and metalness.
The export stays at 1,381,860 bytes and is selectable as
`matter-workshop-orbital-focused-v1`. It uses the same anchors and moving
archive mesh and neither replaces nor edits the diffuse export. Rebuild
from the editable combined finish with the same command above, appending
`--specular focused` to the arguments after the output directory.

On the matched SwiftShader route with lightweight graphics, 124 moving
intervals for the diffuse bake measured 66.7 ms median and 133.3 ms p95.
The retuned whole-shell response measured 166.6 ms and 333.4 ms over 54
intervals. The focused response measured 83.3 ms and 133.4 ms over 111.
Matched player-height captures show the focused reflections on the blue
tabletop and archive panel with the existing warmth retained on the floor.
The physical Pi run of the focused GLB entered cold in 9.69 s through the
fixture tunnel. It walked around the bench, turned the archive, cleared
24 sampled camera centers and returned through the door. The 445 moving
intervals measured 33.2 ms median and 33.4 ms p95. The earlier diffuse
movement run through this tunnel took 8.57 s to enter. These single runs
demonstrate the paths and do not establish a stable latency difference.
Two independent browsers with desktop writer and emulated-touch reader
then exercised the real retained worktable sample with the exact focused
GLB. They restored the 197,642-triangle edition, retained independent
rotation, prepared the exact part reference, enforced edition revocation
and shared and cleared the 34,000-triangle edition. Access identities,
decisions and native delivery were controlled fixtures.

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
A second instrumented Pi run reproduced the split at 9.11 s and 10.2 ms.
None of the sampled individual WebGL compile, link, parameter, texture
upload or draw calls exceeded the 25 ms recording threshold. The full
composer timing localized the delay to the first draw. The aggregate trace
then measured 8.89 s across 17 WebGL program-info queries in a 9.18 s draw.
The queries waited for first-use shader preparation. The lightweight
profile already skipped shadows. A trial that queued the main-scene shader
programs first took 9.48 s to prepare and draw, with 17 program-info
queries still on the draw path. That experiment was discarded.

Replacing the workshop window and archive glazing with single-pass
translucency in a room fixture removed the offscreen transmission pass.
The same Pi and packed baked model then recorded 8 program-info queries
and a 5.41 s first draw. The matched player-height desktop images show
slightly brighter, flatter glass and readable fixtures behind it. The
runtime candidate applies this treatment only in Matter's lightweight
graphics profile. It clones only the active scene's glazing materials,
including all panes that share an original, and disposes the clones when
the scene leaves. The automatic profile and the authored Blender/glTF
materials retain physical transmission.

The packed runtime reproduced the fixture result without browser-side
substitution. Chromium on the physical Pi measured 5.33 s for its first
draw, 5 ms for the next draw and 7.46 s to finish the doorway. The earlier
packed profile with transmission took 9.18 s for its first draw and 10.85 s
for the doorway. Both runs used the loopback tunnel, one model fetch and the
same baked GLB, and verified that the model endpoint refused reads after
exit. Desktop automatic and emulated touch lightweight each passed the
doorway and the expected glazing treatment.

In a separate physical movement run with that package, cold passage took
8.57 s, the archive turned and all 24 sampled corner camera centers cleared.
The 418 moving intervals measured 33.3 ms median and 33.4 ms p95. The
packing, fixed viewport and lightweight setting match the physical checks
above. One successful route per package is insufficient to infer a stable
p95 difference between packages.

### Physical splat comparison

The existing artifact viewer ran on Cuevanico with headless Chromium 154,
Broadcom V3D, a 1020 × 680 viewport, the lightweight setting and the
sandboxed iframe reproduced on loopback. A held forward key moved the camera
with each tested appearance, and the screenshots confirmed that the view
changed. The first pure view took 14.38 s from navigation until the viewer
reported ready. It produced 66 animation-frame intervals with a 33.4 ms
median and 50.1 ms p95 during the held-input sample. The nine-view orbital
splat took 10.69 s to switch from the already loaded pure view, with 48
intervals at 50.0 ms median and 66.7 ms p95. These timings cover separate
entry points and do not establish equivalent cold loads. From the same entry
camera the orbital fit retained richer reflected light and fixture detail.
It showed visible breakup along thin shelf and ceiling edges.
The initial hybrid reused the loaded lightweight splat and took 7.20 s to
switch, including loading its interactive mesh. Its 63 intervals had a
50.0 ms median and 50.1 ms p95, and rotating the archive changed the rendered
view. This verifies the comparator's controls on hardware. The hybrid uses
the lightweight fit, and the fixture does not include the live shared
worktable or door traversal. All three views used the same browser profile
and the profile and forwarding connections were cleaned up afterward.
