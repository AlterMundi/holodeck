# Navegante Blender companion

## Navegante v2: the navigator of the identity gallery

Since 28 November 2026 the companion is built from scratch by `navegante_v2.py`
after CompAII's navigator identity (`navigator-neutral-master-v6`,
`navigator-turnaround-v1` and the nine-expression `navigator-gallery-v6`): a
crackled ceramic diving helmet with a riveted brass porthole, side vents and
crown band; a slate knit scarf with a star brooch and a laurel-embroidered
cape; a round ceramic body, brass joint rings, open hands and riveted boots.
Every texture is generated procedurally in the script; there are no image
inputs. The face plate is plain ceramic: `src/navegante-face.mjs` draws its
brows, eyes and mouth live and animates the nine expressions (calm, curious,
joy, sad, anger, uncertain, focus, welcome, sleep). The joint names, leg
proportions (tuned for the companion gait), clip library and `mouth-open`
morph keep the earlier runtime contract.

```sh
blender -b --python-exit-code 19 --python navegante_v2.py -- OUTPUT
```

It writes `navegante.blend` and `navegante.glb` (about 44k triangles, 1.2 MB
with JPEG textures); copy the GLB to `public/assets/avatar/navegante-blender.glb`
and update `modelSha256` in `src/avatar-registry.mjs`. `motion.py` still
re-authors the clips on the saved scene. `mouth.py` belongs to the first
design and does not apply to v2.

## First design (25 November 2026)

The mesh, joint hierarchy, pose curves and procedural bronze colour are
authored for Holodeck. The 25 November 2026 playable draft uses three
human-selected Gemini images as texture input. The original images remain
in the private conversation. This project keeps the compact derivatives
in the editable Blender scene and in the glTF export. The supplied images
were selected for Holodeck. No separate terms for redistribution of the
original images have been provided.

| Input | Source SHA-256 | Mapping |
| --- | --- | --- |
| Ceramic albedo | `f7724685df28d91b9d525b66f5ae10546e4684e1d2a8d2bed0b2e408615b236b` | Ivory shell, with baked vein and filigree colour |
| Scroll normal | `c9e8190842936f87480e2888fbc3a9672d312f347a9d2e807f5e0e29621f51de` | Cropped scroll strip, tangent space on the bronze bezel |
| Teal fabric | `417563245b43a001e029448117d70f66f556b1aed200a7dcebec07d93f5db9d7` | Cape colour, UVs preserve the embroidered hem |

Open `navegante.blend` with no external texture dependencies. To regenerate
the mesh and the three studio views from the selected originals, use
Blender 5.2 in background mode:

```sh
blender -b --python-exit-code 19 --python navegante.py -- OUTPUT CERAMIC RELIEF CAPE
```

Validate the exported asset and update its registry digest together. Preserve
the unkeyed `anchor-mouth` speech joint and the existing NLA clip names.

## Mouth of light

`mouth.py` replaces the old static visor smile with a luminous lens on the
glass and adds the `mouth-open` morph target (lower lip slides down the
curved visor, corners widen). It edits the packed `navegante.blend` once;
then run `motion.py` to export. The runtime drives the morph and the glow
strength from the speech level; the ceramic chin only follows at a third of
its former travel. `tools/browser-companion-mouth-check.cjs` checks it in
the running client.

```sh
blender -b art/compaii-avatar/navegante.blend --python-exit-code 19 \
  --python art/compaii-avatar/mouth.py -- art/compaii-avatar/navegante.blend
```

## Motion

`motion.py` holds every pose and its timing. It replaces the NLA tracks of the
packed scene and exports the GLB without the private texture inputs:

```sh
blender -b --python-exit-code 19 --python motion.py -- OUTPUT
```

`navegante.py` imports the same module. Base clips key all seventeen body
joints. The gestures (`brace`, `scan`, `sway`, `tinker`, `chirp` and the nine
cues except `calm`) start and end at neutral, so the runtime can layer them.
The runtime solves ground contact over these clips. See
[character motion](../../docs/character-motion.md).
