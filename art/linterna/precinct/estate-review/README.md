# East 1 exterior study

The [exterior candidate](../estate-exterior/) packages the selected portico
and court as near, distant and collision assets for the East 1 plot.

The sketch fits the Casa Linterna precinct inside the current 72 × 72 m East 1
envelope. Its open lantern portico leads into a level arrival court and the
existing Recibidor threshold. The visual proposal uses a 0.74 multiplier for
the exterior references to keep the court and temple roofs in the parcel with
the door fixed. It does not rescale the gameplay rooms. The separate stairs,
district ground and entrance position of the Residencia are a reference for
exterior legibility and room transitions.

Render using the selected Linterna HD arrival edition, the exact published
Residencia GLB and a locally installed Playwright entry point.

```sh
node art/linterna/precinct/estate-review/capture.mjs \
  OWNER_EDITION RESIDENCE_GLB OUTPUT_DIR PLAYWRIGHT_ESM
```

The loopback renderer opens the six selected arrival assets and the reference
GLB. It writes exterior approaches, a plan, an oblique view, the Residencia
comparison and a survey receipt. It checks the proposed parcel envelope,
pedestrian clearance and the retained threshold. Set `LINTERNA_CHROMIUM` for
a different local Chromium path. Neither source artwork nor exported images
belong in this source directory. The previews carry no live house mutation.
