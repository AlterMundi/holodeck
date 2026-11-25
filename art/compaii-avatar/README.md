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
