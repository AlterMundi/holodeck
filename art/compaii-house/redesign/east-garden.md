# East Garden

The fixed east promenade opens onto a sandstone walk and the playable meadow.
A second walk bends toward a timber arbor on the southeast coast. Basalt
planters and wind-shaped bays hold the northern edge. The sea-facing rim has
layered rock, darker at the foot of the island.

[Editable Blender scene](east-garden.blend) · [Model recipe](east-garden.py)

Stone, oak, terrain grain and foliage are original or reuse the established
original coastal atlas. The new export replaces the earlier scenery at the
same public position. It keeps the bridge, terrace, creation limits and all
placed content. AABB collision mounts only on peripheral trunks, planters,
bench and columns. The playable targets and authoring space occupy the open
meadow. Static landscaping has no authority over game rules or score.

The 14,390 triangles and eleven material batches transfer in 300,419 bytes
with Brotli, down from 1,231,759 bytes for the previous island model. The
Blender source keeps materials and individual elements editable.

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/east-garden.py -- "$ART_OUTPUT"
```

[Bridge landing in the game](review/east-garden-candidate-landing.jpg) ·
[Signal Garden and path](review/east-garden-candidate-lawn.jpg)

A simulated Chromium visitor followed the ordinary bridge with WASD, passed
the two signal targets, read the game HUD and continued to the arbor. The
motion, targets and walking height matched the existing playfield. The
browser loaded the exact assets and showed the existing edit restriction
for a non-owner. The first export tinted the sandstone and oak with
the grass layer's vertex colors. Only the meadow uses that attribute in the
selected file.
