# Reusable garden assets

Choose by role, silhouette, scale and material fit. Poly Haven is a useful
source for scan-derived natural objects. Kenney provides CC0 game props that
can start with a smaller geometry budget. Check the individual item's terms
each time. A license limited to personal use can permit a private study;
use terms that permit adaptation and redistribution for assets that a shared
Holodeck client downloads, even when the world itself requires sign-in.

## Prepare the selected object in Blender

1. Record the asset page, author, license, exact source edition and bytes.
   Fetch the selected source and its dependencies only. Keep a single
   recoverable original with its provenance outside the runtime package.
2. Inspect scale, origin, silhouette, UVs and the existing LODs. Use the
   least expensive representation that still reads from the nearest normal
   approach. Reduce geometry, bake or trim maps as appropriate, and reuse
   shared mesh and material data for repetitions. Validate pivots and normals.
   Use independent, simple collision where an object affects navigation.
3. Export the reduced derivative with supported glTF features and no network
   references. Measure triangles, primitives/materials, texture dimensions
   and bytes. Reopen the exact output and inspect the placed object from
   player height. For deployment, verify the actual client with a representative
   number of objects. Keep the authoring file available for future edits.

### Rock 09 · garden stone

- Source: [Rock 09](https://polyhaven.com/a/rock_09) by Jenelle van Heerden.
  [CC0 license](https://polyhaven.com/license).
- Input: glTF 1K resource set. Source entry point SHA-256
  `636e57eb0090889627da18edaec202ff9f65f83101b94f91b7da4d21dc080ab9`
  and geometry buffer SHA-256
  `780c37d6fc11ca3a01c3763535ef883908b6007271a46bd446d2289ded820751`.
- Adaptation: reduce the mesh, retain its UVs, set a grounded pivot, rescale
  to roughly 0.82 m wide and retain one 256×256 color texture, with a
  constant dry-stone roughness. The shared Blender garden scene reuses the
  same mesh and material for its two occurrences.
- Measured: 12,416 to 1,400 triangles. The five 1K source files total
  1,964,421 bytes; the self-contained GLB is 56,280 bytes. The largest
  relative difference in bounding dimensions before uniform rescaling
  was below 0.9%. Blender reimport confirmed one mesh and one material.
- This is an art-asset qualification. The updated garden has no runtime
  deployment or device performance measurement.

Reproduce using the licensed source's 1K glTF distribution and Blender 5.2.2:

```sh
blender -b --factory-startup --python-exit-code 1 \
  -P art/compaii-house/assets/prepare_rock_09.py -- "$ROCK_SOURCE" "$ASSET_OUTPUT"
```

[Poly Haven models](https://polyhaven.com/models) ·
[Kenney's asset license guidance](https://kenney.nl/support)
