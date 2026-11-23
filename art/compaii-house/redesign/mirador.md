# North Mirador

The north crossing lands on staggered limestone flags. Basalt benches and oak
seats sit on either side of the central walk. A shallow copper and bronze arch
on two masonry piers frames the horizon. The low opening and the side seats can
be approached directly from the existing island landing.

[Editable Blender scene](mirador.blend) · [Model and surroundings recipe](mirador.py)

The model has 6,632 triangles in eight material batches and transfers 45,130
bytes with Brotli. Its four small collision boxes occupy the seats and pier
bases. The walkway sits on the existing island at the same height and stops
short of the movable bridge. The original bridge controller, deck, island
center and native anchors remain the authority.

The Blender job produces the new pavilion and a corrected scenery asset.
Only the triangles of the former north ring, disk and feet are removed.
The coastal tree, sea, western court and eastern scenery remain in their
original material streams.

```sh
git show 6032b78:public/assets/island-scenery-atelier.glb > "$ART_OUTPUT/previous-surroundings.glb"
blender -b --factory-startup -t 4 --python-exit-code 1 \
  -P art/compaii-house/redesign/mirador.py -- "$ART_OUTPUT" "$ART_OUTPUT/previous-surroundings.glb"
```

[Mirador from the approach](review/mirador-candidate-raised.jpg) ·
[Seaward arch](review/mirador-candidate-mirador.jpg) ·
[Bridge lowered](review/mirador-candidate-lowered.jpg)

A simulated visitor raised the bridge with the ordinary HUD, walked from the
plaza to the seaward frame with WASD, and crossed back with the same renderer.
Both crossings reached the deck at .29 m and returned to island ground at
.10 m. After lowering the bridge, the same walk encountered the actual gap.
The applied geometry matched both bridge states.
