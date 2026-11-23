# Coastal water

The outdoor Atelier's water surface uses two original maps authored in Blender.
A world-scale reflected color map shifts from teal to pale blue across the
existing basin. The color map follows shallows and soft foam only where existing
rock triangles intersect the water plane. A repeating tangent-space normal map
adds wind ripples aligned with the current sunlight. Both textures use core
glTF PBR on the same opaque surface.

The source scenery is the version pinned by the Atelier before this material
change, SHA-256
`61f058ac7d7ba1de6f2fff1237dae7a473afcd2596849939eabb4b41b443a104`.
To rebuild after the material has been selected, recover that input with
`git show e30ece2:public/assets/island-scenery-atelier.glb`.
Run Blender 5.2.2 using the source and an empty output directory.

```sh
blender -b --factory-startup -t 8 --python-exit-code 1 \
  -P art/compaii-house/redesign/coastal_water.py -- "$SOURCE_GLB" "$ART_OUTPUT"
```

The 110 m radius and the surface at Y=−6.94 m retain their original geometry.
The exporter verifies the original geometry buffers, all other materials and
the scene transforms byte-for-byte, then appends the two UV channels and baked
images. The asset retains 3,260 triangles in 12 batches, with 256 triangles for
the water. It is 343,424 bytes, an increase of 101,312 bytes over the previous
variant. The two embedded JPEGs use approximately 6.67 MiB of decoded RGBA
storage with mipmaps. The layer continues to use the scene's existing
world registration and collision proxies.

The comparative Chromium fixture verified both response digests, texture
decoding, the same camera at player height and keyboard movement toward the
coast. Its two software-renderer intervals per render were insufficient to
measure pacing.
