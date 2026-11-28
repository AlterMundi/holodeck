# Casa Linterna exterior candidate

The exterior of Este 1 contains the lantern portico, the level arrival court,
the Recibidor doorway and the exterior silhouettes of the three temples. It
fits the 72 × 72 m parcel. The individual site rooms are served through their
existing room entrances and separate art selection.

Build the export with the repository's installed dependencies and a local
Playwright ESM entry point. The output directory must be new.

```sh
node art/linterna/precinct/estate-exterior/export.mjs OUTPUT_DIR PLAYWRIGHT_ESM
```

Use `LINTERNA_CHROMIUM` to select a local Chromium executable. The exporter
loads each binary again through Three.js and checks parcel bounds, buffer
ownership, pedestrian clearance and the asset sizes. It renders views at
walking height from the reloaded near model.

| File | Purpose |
| --- | --- |
| `near.glb` | Detailed exterior with embedded textures |
| `distance.glb` | Simplified shape and materials with the same parcel origin |
| `collision.glb` | Closed triangle hulls for the authored obstacles |
| `geometry.json` | Collider boxes, model bounds and clearance evidence |
| `manifest.json` | Provisional author manifest with byte lengths and SHA-256 digests |

The models use metres, +Y up and +Z toward the shared path. Place them at
the East 1 plot centre with −90 degrees of Y rotation. The public walk is
5.8 m wide. The existing native approach point is `[0, .11, 2.45]` in
plot-local space and the doorway plane sits at `z = 1.60`. Use that same
approach point for entry and the reciprocal return. The plaza uses the
existing district ground for walkability. Keep the authored colliders
independent of visual detail, and preserve the native room ID and guest
checks when switching between outdoors and the Recibidor.

The manifest is a candidate for the owning world's exterior importer. Its
75 m / 95 m thresholds describe a proposed hysteresis band for model
selection. The stock `house.publish` facade metadata does not consume this
package. The native room route and an installed production exterior are
verified separately.
