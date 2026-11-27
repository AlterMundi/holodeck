# Casa Linterna art study

An original cedar entry pavilion and three furnished room models for Holodeck's larger linked interiors. The facade is 3.20 × 1.40 m at the walls. The curved roof reaches 2.62 m, and the west threshold remains inside a standard 4 × 2 m parcel. The Atlas, field cabinet and workroom plans use their own 12 × 12 m coordinate systems. The terrain sculpture on the Atlas table is stylized artwork.

Run the recipe with the repository's installed Three.js 0.182:

```sh
node art/linterna/export.mjs /path/to/review/output
node art/linterna/verify.mjs /path/to/review/output
```

The exporter writes four deterministic GLBs and their bounds, draw counts and SHA-256 manifest. The samples contain no third-party meshes, research editions, identities, or world state. The exterior uses metre units and Y-up. Its entry faces +Z before the existing house projector applies the parcel rotation. The interior GLBs contain furnishings and one atlas wall treatment. The world supplies the room envelope, doors and traversal. `projection.mjs` provides collider ingredients for the existing interior document. The Atlas pendant is above the walking volume. The workshop art hides the duplicate visible test marker and retains the worktable's native anchor at room-local X 0, Z −2.

The test uses synthetic identities to traverse and return from the two annexes, checks the existing facade projector and verifies each byte digest. These files are artwork and a local qualification path. A receiving operator still needs to select the exact models in the applicable facade and scoped room-art routes. This branch carries no owner selection, receipt, access rule, live placement or Atelier connector. Access to the target house and to each linked application's data are independently governed by the receiving service.

The [precinct study](precinct/README.md) adds the small classical entrance,
the Templo del Mundo, and the connected internal garden and deity pavilions.
The [finished Claymon room study](workshop/README.md) develops the materials
and daylight of the workshop while reusing its original furniture layout.
