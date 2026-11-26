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
transforms within 1 µm of translation. With the expression study, the export measures
12,016 triangles, thirteen skinned material draws and 580,304 bytes. It is a local study
and is not registered under the current player's appearance. Blender rendered the green-and-honey eyes and resting smile at
frontal, three-quarter and game-scale framing. Three.js loaded and sampled the current walk,
flight, boost and swim studies with their target bones. These are binding and
pose-sampling checks, not visual acceptance of the final movement.

Check a new GLB against the shipping armature and its motion studies:

```sh
node art/nicolas-avatar/check-rig.mjs .state/nicolas-avatar-blockout/explorer-blockout.glb --blockout
```

This checks joint hierarchy, relative bind matrices and stock rest transforms
in both joint-local and world coordinates,
loads the mesh in Three.js, and runs the same motion studies as the review room.
It also reports skinned draw count, triangle count and exported morph names.
Omit `--blockout` for an authored model. In each sampled frame, the
check inspects the actual jaw vertices in head space before and during
speech and after restoring the resting expression. It checks that the
jaw stays attached to the head, that the live mouth driver moves the
mesh and that every sampled vertex returns to its neutral position.
A temporary Blender fixture validated both paths: a working target moved
66 vertices while an identically named empty target was rejected.
The check uses CPU skinning. Verify the face, lips, beard and costume
visually on the rendered character.

Develop the face from the resting smile with a separate expressive smile pose,
movable lids and a jaw that carries the beard. Sculpt eyes, cheeks and nose to read at
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
