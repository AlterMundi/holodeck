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
