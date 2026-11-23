# Arrival court materials

The original Commons mesh is retained from `holodeck-commons.blend`. The
textured variant gives its honed limestone, limewash, grass, dark oak and
basalt continuous world-scale UVs. Original repeatable maps add grain,
slightly greener ground in depressions and subtle surface relief. The model
does not import imagery or repeat another project's material assets.
Blender's material graph and the Python generator are the editable sources.

Run Blender 5.2.2 with the authored Commons blend file and an empty working
directory.

```sh
blender -b art/compaii-house/redesign/holodeck-commons.blend -t 8 \
  --python-exit-code 1 -P art/compaii-house/redesign/commons_pbr.py -- "$ART_OUTPUT"
```

The export includes five diffuse and tangent normal pairs. The court and
meadow maps use 512² pixels, the remaining materials 256². JPEGs are embedded
in a single core glTF binary. With a four-byte upload format and mipmaps,
their decoded texture footprint is about 7.33 MiB. The ten material batches
and 14,880 triangles retain the original triangle positions, winding and
material assignments. The larger vertex count represents UV splits. The
asset is 964,400 bytes, an increase of 381,732 bytes over the untextured
version. Its receipt is
`9692049f367d813f055f7608923be49ffd49911aa9844da15250d450d2da6105`.

The export uses the existing inverse-Y glTF transform and can replace the
art asset at the same world origin. Holodeck's existing collision proxies,
spawn positions, plot addresses, authored-content areas and room IDs remain
authoritative. Reuse the current scenery asset slot and reselect the exact
new digest in the art profile. Replacing the original asset in that slot
avoids shipping two copies.

An isolated simulated browser comparison changed only the Commons asset
response. Chromium loaded both exact versions through the usual MML model
element, rendered the mapped surface materials and accepted keyboard
movement across the covered route. The comparison is a material upgrade
for this one terrace. Sky, neighboring islands and vegetation silhouettes
are outside this change.
