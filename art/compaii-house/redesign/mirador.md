# North Mirador

The north crossing lands on staggered limestone flags. Basalt benches and oak
seats sit on either side of the central walk. A shallow copper and bronze arch
on two masonry piers frames the horizon. The low opening and the side seats can
be approached directly from the existing island landing.

[Editable Blender scene](mirador.blend) · [Model and surroundings recipe](mirador.py)

The fixed model has 9,360 triangles in eight material batches and transfers
61,368 bytes with Brotli. Its four small collision boxes occupy the seats and pier
bases. The walkway sits on the existing island at the same height and stops
short of the movable bridge. The original bridge controller, deck, island
center and native anchors remain the authority.

## Finished movable crossing

On the plaza side, six courses of limestone lead to a basalt keeper and small
bronze fasteners. The stone follows the existing walking surface and ends
just before the first moving plank. The passage opens toward the plaza and
shares the material and joint pattern of the far landing. The raised bridge
has shaped oak boards, copper handrails and bronze post shoes. Its separate
finish fits the eight existing deck blocks and is served only when the shared
bridge is raised. The fixed approach and the finish add no colliders. The
current shared bridge state still owns the visible gap and the eight moving
walking surfaces.

[Previous raised bridge](review/north-crossing-baseline-raised.jpg) ·
[Finished raised bridge](review/north-crossing-candidate-raised.jpg) ·
[Lowered with the gap clear](review/north-crossing-candidate-lowered.jpg)

The bridge finish uses 4,400 triangles across five material batches, no
external textures and 26,312 Brotli bytes. The new fixed apron adds 16,238
Brotli bytes to the Mirador. Both export from the same editable .blend,
with separate named collections for fixed and moving geometry.

Blender 5.2.2 builds the editable file and both GLBs:

```sh
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/mirador.py -- "$ART_OUTPUT"
```

The optional final argument still takes the original pre-Mirador surroundings
from `git show 6032b78:public/assets/island-scenery-atelier.glb` to
reproduce the historical removal of the stock ring.

[Previous Mirador](review/mirador-before.jpg) ·
[Mirador from the approach](review/mirador-candidate-raised.jpg) ·
[Seaward arch](review/mirador-candidate-mirador.jpg) ·
[Bridge lowered](review/mirador-candidate-lowered.jpg)

A simulated visitor raised the bridge with the ordinary HUD, walked from the
plaza to the seaward frame with WASD, and crossed back with the same renderer.
Both crossings reached the deck at .29 m and returned to island ground at
.10 m. After lowering the bridge, the same walk encountered the actual gap.
The applied geometry matched both bridge states.
