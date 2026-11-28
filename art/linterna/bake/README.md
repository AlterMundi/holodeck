# Casa Linterna lightmap trial

This offline recipe starts from the Claymon workshop art at Holodeck
`c045078d969f40defcb847d50abb693004cb4d75`, as built in
`art/linterna/workshop` and selected in the Hefesto slice. The input is the
12 × 12 × 3.3 m room geometry with visual materials from the workshop source
and its existing provenance record. The selected trial GLB has SHA-256
`fd17011c6e2caf35c2804f353fc4ac658b88ffd4739149d0e1bf63d95225bace`.
The west leaf cutout and exterior ground are original procedural bake and
reference fixtures.

Run with the official Linux x86-64 Blender 4.5.17 LTS distribution. The
script uses its bundled NumPy and OpenImageDenoise 2.3.3. The reference
run used four CPU threads. The recipe runs without a display.

```sh
blender -b --factory-startup --python-exit-code 1 \
  -P art/linterna/bake/bake_lightmaps.py -- \
  input.glb output-directory --elevation 14 --azimuth 252 \
  --temperature 3500 --resolution 2048 512 --samples 512 --threads 4
```

Azimuth is clockwise from glTF -Z toward +X. Scene coordinates are metres
with +Y up in glTF, mapped once to Blender's Z-up basis on import. The
default camera is 1.64 m above the finished floor, inside the return door
and looking at the turntable. The trial assumes a west-facing opening.
Use `--camera`, `--target`, or `--no-foliage` for subsequent trials.
The baked pass uses Cycles Diffuse Direct and Indirect with Color disabled.
It uses a fixed sample count and then runs the OIDN HDR filter on the
atlas. Smaller atlases are averaged in linear space from the largest one.

The script packs the new `lightmap` channel against the smallest
resolution so a single UV layout can serve both editions. The calculations
use existing triangle indices and chart junctions. The script checks
overlapping UV triangles at pixel centers and checks that each chart covers
a pixel. It expects a static indexed GLB with uncompressed source
accessors, material UVs, and named mesh nodes. A layout that cannot be
represented on the existing indices fails with an error.

The GLB writer appends glTF `TEXCOORD_1` and keeps the original binary
ranges intact. The build adds no lamps, cameras, foliage, new material
definitions or baked texture bindings to the GLB. The bake and the optional
reference-set fixtures live in Blender's transient scene.

## Sampling the maps

The EXR images have scene-linear RGB float32 values. The PNG and JPEG use
the sRGB transfer of the linear bake scaled by the recorded exposure gain.
Decode them as sRGB and divide by that gain to recover comparable linear
samples. Use PNG for the compact review when possible, because JPEG can
soften thin gutters and introduce compression artifacts.

For three.js r182, use `channel = 1` in all formats. Load PNG/JPEG as
sRGB with `flipY = false` to match the glTF UV convention. Load EXR as
linear RGB. Its EXRLoader makes bottom-up data, so keep its default
`flipY = false` and set `repeat.y = -1`, `offset.y = 1` for this atlas.
The runtime diffuse lightmap term goes through Lambert's division by π.
Start with a linear intensity of π for the raw map or π divided by the
recorded gain for the sRGB files. Compare against the Cycles reference
before choosing the runtime factor. The reference includes the original
surface textures and specular response while the atlas carries diffuse
lighting. Account for the AgX view transform and reference exposure when
comparing images. Avoid counting the baked daylight twice when the
lightmap and runtime lights are combined.

The manifest records environment, source hash, exact lighting and camera,
exposure, elapsed times and a digest of each generated file. Maps, GLBs and
renders are generated deliverables kept outside source control.

## Split room assets

Use `bake_room_parts.py` for a static room assembled from separate GLBs that
already share one metric world frame. The scene geometry supplies the
exterior bounce. The recipe preserves the material UV set and uses xatlas
to allocate a second UV set over all parts. It verifies the triangle-order
mapping, checks the atlas for overlaps at the selected pixel centers and
exports the individual models with `TEXCOORD_1`. Blender may split vertices
at the new seams. Recheck decoded bounds, triangle counts and receiver sizes
on those exported bytes. The bake target and preview join made by Cycles
are transient and stay out of the exported parts.

Provide the unpacked `xatlas` module for the Blender Python ABI. The tested
Linux x86-64 wheel is `xatlas==0.0.11` for CPython 3.11, SHA-256
`c044ee009a427898b26c0929646bfb0e0356f6762be40a140f4af41a33026208`.

```sh
blender -b --factory-startup --python-exit-code 1 \
  -P art/linterna/bake/bake_room_parts.py -- \
  output-directory room-a.glb room-b.glb room-c.glb \
  --atlas-module /path/to/unpacked-wheel --resolution 2048 --samples 16 --threads 3
```

The recipe writes the raw atlas, display-encoded maps, scoped UV exports,
one reference render and a manifest. The renderer must bind the same map
and its recorded gain to the baked static materials. Exporting a second
UV does not select a Holodeck edition or bind the map in a receiving
client. For production, repack any over-budget part and qualify the map,
material selection and retained geometry on the exact receiving client.
