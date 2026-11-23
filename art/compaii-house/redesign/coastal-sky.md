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
