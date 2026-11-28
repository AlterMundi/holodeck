# Navegante Blender companion

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

## N-3X refinement

`n3x_refine.py` brings the packed scene closer to the N-3X production sheet
(front, back, top and three-quarter views): the antenna rises from the top
centre of the helmet with its cyan light, the hands have four long
two-segment fingers and an opposed thumb, the mouth well and chin under the
visor are gone, the visor bezel is riveted, the cape falls to the ankles and
the boots have tall cuffs with brass bands. It edits `navegante.blend` once;
then run `motion.py` to export.

```sh
blender -b art/compaii-avatar/navegante.blend --python-exit-code 19 \
  --python art/compaii-avatar/n3x_refine.py -- art/compaii-avatar/navegante.blend
```

## LED face

`n3x_faces.py` (run after `n3x_refine.py`) removes the modelled pupils,
brows and mouth lens and lays a thin "Visor LED screen" over the visor glass.
`src/navegante-screen.mjs` draws the nine expressions of the navigator
expression sheet on it as pixels, each with its own colour and pattern, and
articulates speech syllable by syllable from the playback level (a, e, i, o,
u shapes and closures) instead of only brightening.

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

## Alternative bodies

CompAII wears the N-3X. Two diving-helmet alternatives are kept as options:

```sh
blender -b --python-exit-code 19 --python art/compaii-avatar/navegante_escafandra.py -- OUT            # escafandra (white ceramic, live face)
blender -b --python-exit-code 19 --python art/compaii-avatar/navegante_escafandra.py -- OUT --bronze   # bronce (aged bronze, LED slits)
```

They ship as `public/assets/avatar/navegante-escafandra.glb` and
`navegante-bronce.glb`, are listed in `NAVEGANTE_VARIANTS`
(`src/avatar-registry.mjs`) and appear in the Character Studio's character
choice. There is no in-game switch: to wear one, point the
`compaii-navegante-white-v1` entry's `model` and `modelSha256` at it and
deploy. The runtime draws the escafandra's face with `navegante-face.mjs` and
the bronce visor with `navegante-screen.mjs`.
