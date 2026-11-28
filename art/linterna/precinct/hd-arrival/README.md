# Casa Linterna HD arrival export

Export the `precinct` stage of the approved, contact-repaired HD review source.
The source includes the hall, Atlas table, garden plantings, fountain, rotunda
and temple exteriors. The live graph supplies the destinations, and the existing
Hefesto, Atenea, Research Gallery and Claymon models are carried forward.

Run from the Holodeck checkout with its installed Three.js and esbuild. Supply
the private source's `src/` directory, the ESM entry points for Playwright Core
and meshoptimizer 0.25.0, and a fresh output directory.

```sh
node art/linterna/precinct/hd-arrival/export.mjs \
  PRIVATE_HD_SRC ARRIVAL_EXPORT PLAYWRIGHT_INDEX_MJS MESHOPT_INDEX_MODULE_JS
node art/linterna/precinct/hd-arrival/compose-edition.mjs \
  PREDECESSOR_EDITION ARRIVAL_EXPORT OUTPUT_EDITION
```

The first command runs Chromium on loopback, with outgoing network blocked. Set
`LINTERNA_CHROMIUM` if its executable is outside `/usr/bin/chromium`. It produces
six GLBs, a collider report and two review frames. The export samples the source
shader recipes into standard color textures, simplifies the meshes in their
authored positions, keeps complete textured leaf cards and instances the small
repeated geometry. It uses static materials and foliage. The original dynamic
lighting, water and motion are part of the retained HD reference.

The composer replaces the arrival models and collision boxes, updates the hall
floor at the existing entry pose, checks all arrival landings and walkable
connections, and verifies every carried indoor asset against the predecessor.
Passage coordinates, other cells, the Atelier table and widget contract remain
bound to their existing selections. Each model stays at or below 768 KiB and
the full edition stays within 12 MiB. A receiver can stage the resulting
manifest through the maintained owner-room tour path.

Keep the protected source, screenshots, output GLBs, artwork manifest and
live layout readbacks in the selected project storage. This tool does not
publish to Home or alter world state.
