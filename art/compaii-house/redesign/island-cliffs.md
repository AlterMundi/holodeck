# Near island cliffs and meadows

The western gallery, eastern garden and north Mirador now share a coastal
geology. A level meadow follows each existing rim. Broken ledges expose
layers of shale and taper inward beneath it. Three skerries carry the same
materials down to the existing waterline. The playable islands retain their
original clearance above the sea. The three existing west boulder positions
are represented by hand-shaped rubble.

The [editable Blender scene](island-cliffs.blend) keeps each shore and cap
separate. Its original meadow and basalt maps come from the
[Commons materials](commons-pbr.md) and are packed into the scene. World-scale
UVs, tangent-space normals and vertex tint carry surface detail in two material
batches. The new surfaces add 5,067 triangles and bring the complete selected
surroundings asset to 12,491 triangles and 498,396 Brotli bytes.

The GLB replaces exactly the three inherited rock and grass primitives.
The water, coastline maps, bark and foliage retain their geometry and bytes.
The Room still owns the walking surfaces, bridge positions, published results
and creation zones. The terrain GLB is visual only.

## Rebuild

Use Blender 5.2.2 and a task-owned output directory. Recover the exact input
scenery from the previous selected commit and supply the current Commons
asset for the existing material maps.

```sh
git show a1028e0:public/assets/island-scenery-atelier.glb > "$ART_OUTPUT/inherited.glb"
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/island-cliffs.py -- "$ART_OUTPUT" \
  "$ART_OUTPUT/inherited.glb" public/assets/compaii-atelier-commons.glb
```
