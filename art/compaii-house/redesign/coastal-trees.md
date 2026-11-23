# Coastal pine and bay silhouettes

The plaza's bays have curved trunks, forked leaders and irregular foliage. Eight
pines frame the north arch and the west terrace with tapered trunks, asymmetric
branch tiers and needle textures. Low shrubs belong to the existing planting
beds. Camera-height comparisons in the current renderer show layered foliage
and broken silhouettes at the same tree positions.

The editable source is [coastal_trees.py](coastal_trees.py). It builds the branch
and card meshes in Blender and paints an original two-tile foliage atlas. glTF
alpha masks and opaque materials render it through the existing engine. The
assembly keeps the destination asset slots and scene nodes, the existing terrain
and water, the plaza's physically based surfaces and the non-tree elements of
the mixed oak batch. Room continues to own movement and placement.

## Rebuild

Use Blender 5.2.2 and the exact pre-vegetation coastal release assets in
`$BASELINE_ASSETS`. The directory contains `compaii-atelier-commons.glb` at
`9692049f367d813f055f7608923be49ffd49911aa9844da15250d450d2da6105` and
`island-scenery-atelier.glb` at
`d0c5d692cbb64edb79213da7188515f126587588c94004bdec74878a53a9acb4`.
Both originals are retained by the coastal horizon source revision `d4e3e49`.

```sh
blender -b --factory-startup -t 5 --python-exit-code 1 \
  -P art/compaii-house/redesign/coastal_trees.py -- "$BASELINE_ASSETS" "$EMPTY_OUTPUT"
```

The output contains both GLBs, their shared editable atlas image and exact
inventory. A second regeneration matched both binaries and the atlas. The
embedded atlas is 384 × 192. It is embedded once in each asset so the existing GLB
slots and normal private asset route can be reused.

| Asset | Bytes | Material batches | Triangles |
| --- | ---: | ---: | ---: |
| Commons | 1,170,180 | 10 | 15,788 |
| Surroundings | 707,860 | 10 | 9,832 |

Both replacements together add 570,216 transfer bytes and 7,480 triangles.
Chromium loaded the exact body of each model, mounted the alpha-cutout atlas,
and accepted keyboard travel. The A/B spawn frames used the same camera and
grounded avatar positions. Frame pacing remains to be measured independently.
