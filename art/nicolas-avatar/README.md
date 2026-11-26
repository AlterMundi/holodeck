# Nicolás's explorer

Nicolás selected the explorer in his three-view concept and supplied a private
likeness portrait. Use the smile, swept-back silver hair and tapered beard from
the portrait. Carry the split teal coat, bronze armour, gold embroidery, cyan
compass and two-nozzle pack from the concept. The original references stay in
the private conversation. See the [rig and expression contract](rig-contract.md).

## Proportions study

Run the supplied Blender entry point from the repository:

```sh
blender -b --python-exit-code 18 --python art/nicolas-avatar/blockout.py -- .state/nicolas-avatar-blockout
```

It writes one editable Blender scene and a batched GLB. The stock MML human
armature preserves existing pose compatibility. The stock surface is removed.
The blockout geometry and materials are authored here. The mesh mostly uses rigid
weights for proportions. The coat hems blend toward the thighs to study
movement clearance. The 87 joints keep the stock names, hierarchy and rest
transforms within 1 µm of translation. The first export measures 8,272
triangles, eight skinned material draws and 426,124 bytes. It is a local study
and is not registered under the current player's appearance. Blender rendered
a three-quarter view, and Three.js loaded and sampled the current walk,
flight, boost and swim studies with their target bones. These are binding and
pose-sampling checks, not visual acceptance of the final movement.

Check a new GLB against the shipping armature and its motion studies:

```sh
node art/nicolas-avatar/check-rig.mjs .state/nicolas-avatar-blockout/explorer-blockout.glb --blockout
```

This checks junction hierarchy, bind matrices and stock rest transforms,
loads the mesh in Three.js, and runs the same motion studies as the review room.
It also reports skinned draw count, triangle count and exported morph names.
Omit `--blockout` for an authored model to verify that its speech morph opens
and restores the default expression through Holodeck’s mouth driver.

Develop the face with a neutral mouth and an expressive smile pose, movable
lids and a jaw that carries the beard. Sculpt eyes, cheeks and nose to read at
the ordinary game camera distance. Replace the blockout hair masses with
solid swept locks. Weight the coat across torso joints and give the tails
independent motion with thigh and boot clearance. Keep the armour and flight
pack on their rigid attachment bones. Bake detailed embroidery, grain and
metal variation into compact textures after the mesh and weights are stable.

Compare the actual explorer with the same contact and locomotion tests we
use for the existing human and Navegante. Verify crouch, walk, run, hover,
boost, swim, landing, speech and independent-view decoding on Normal and
Livianos. Compare the live companion's reported position skips against its
isolated gait separately in [#21](https://github.com/AlterMundi/holodeck/issues/21).
