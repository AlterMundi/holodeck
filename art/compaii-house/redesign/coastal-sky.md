# Arrival sky and distant sea

The original coastal sky is an equirectangular Blender render of multiple
atmospheric scattering, a layered cumulus volume and the distant sea. Its
eastward camera convention matches the renderer's environment direction. The
sun direction follows the plaza light. The clouds and water are baked, so
browsers run the existing renderer without volumetric work.

Use Blender 5.2.2 to render the selected 1536 × 768 JPEG.

```sh
blender -b --factory-startup -t 6 --python-exit-code 1 \
  -P art/compaii-house/redesign/coastal_sky.py -- "$ART_OUTPUT" 1536
```

The authored sky adds 37,943 bytes. It loads once per exterior browser
session and stays in memory for return visits. Interior scenes retain their
existing lighting and background. The renderer releases the image on disposal.
The [coastal water](coastal-water.md) is a separate texture revision for the
existing sea plate. Neither asset adds collision geometry.

## Distant headlands and fog

The [editable Blender scene](coastal-ridges.blend) adds four low headlands
beyond the walkable terraces. Shale and coastal heath share one vertex-colour
material. The outer rings sink below the existing water line at −6.94 m. The
GLB is 59,152 bytes with 2,640 triangles and four batches, with no extra image
textures, colliders or shadow passes.

Regenerate the editable scene and GLB with Blender 5.2.2:

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  --python art/compaii-house/redesign/coastal-ridges.py -- "$ART_OUTPUT"
```

The selected coastal art profile starts distance fog at 24 m and reaches
full fog at 124 m. Its colour matches the rendered horizon. Rooms explicitly
turn fog off so the coast ambience does not carry into the foyer during
same-document travel. Returning restores the exterior configuration.
[Previous browser view](review/coastal-depth-baseline.jpg) ·
[Headlands and fog in the browser](review/coastal-depth-candidate.jpg)
