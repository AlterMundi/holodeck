# Teleport station (Char Design, Alternative 3)

Nicolás approved this direction on November 28: a round, floating station
without legs, made like CompAII's N-3X companion. Holodeck shows it in the HUD
as a deployable magical-technological device. The selected parent is above the
board and its children are on pedestals. A separate Viajar control sits on a rim
rail and always turns to face the viewer, with a column of light like a TARDIS.

The brief is `docs/teleport-instrument-design.md` on the teleport branch.
Char Design owns form, materials, anchors and clips. Holodeck owns A2UI
controls, permissions, destination data, mounting and travel.

## Build

```sh
node tools/pack-teleport-station.mjs [path/to/blender]
```

This runs `build_station.py` (Blender 5.3 used), applies meshopt compression
and writes:

| File | Contents |
| --- | --- |
| `public/assets/teleport/teleport-station.glb` | station, anchors, three clips (≈0.8 MB, ≈41k triangles) |
| `public/assets/teleport/teleport-miniatures.glb` | `tp_mini_{plaza,house,residence,room,table}` (≈0.3 MB) |
| `art/teleport-station/teleport-station.blend` | editable scene |
| `art/teleport-station/textures/*.png` | generated maps |

The textures are derived from the companion's own maps in `textures/source/`,
exported from `public/assets/avatar/navegante-blender.glb` (art from
`art/compaii-avatar/`). They are porcelain with raised gold filigree
(base, metallic-roughness and a normal map from the gold mask and veins), an
engraved bronze band with the visor's scrolled relief, and the cape's teal weave
with its laurel hem. Images are embedded as WebP (`EXT_texture_webp`). Materials
use `KHR_materials_clearcoat` and `KHR_materials_emissive_strength`.

## Coordinates

glTF Y-up, metres. The origin is the floor under the station and the front faces +Z.
The board surface is at 0.78 m and the outer diameter is about 1.84 m including the rail.
Mount the root at the floor point that the workspace already chooses, with scale
1. Do not use the old console's `y=1.65, scale=.88`.

## Named nodes

| Node | Use |
| --- | --- |
| `tp_station` | root, target of `tp_deploy` |
| `tp_center` | top of the centre lens; ray/focus centre |
| `tp_parent` | selected parent miniature attaches here (pedestal top); `tp_parent_stem` is its light stem |
| `tp_node_0`…`tp_node_3` | child miniature anchors: front-left, front-right, back-right, back-left; each carries its pedestal mount |
| `tp_thread_0`…`3` | light threads from the parent to each child |
| `tp_travel_rail` | bronze rim track |
| `tp_travel_carriage` | pivots about local Y; rotate so the control faces the viewer |
| `tp_travel_housing`, `tp_travel_button` | Viajar housing and its cyan dome (physical, distinct from destination nodes) |
| `tp_travel_slot` | Viajar control anchor / ray target, on top of the button |
| `tp_travel_beam`, `tp_travel_beam_rings` | travel column; rest scale Y≈0 |
| `tp_glyph_ring`, `tp_energy_rings`, `tp_center_lens`, `tp_body` | presentation |

## Clips

| Clip | Length | Meaning |
| --- | --- | --- |
| `tp_deploy` | 0.9 s | station unfolds from a spark, spins in and settles |
| `tp_idle` | 8 s loop | glyph ring and energy rings turn |
| `tp_travel` | 1.2 s | button sinks, column and rings rise, glyphs spin; holds at the end |

Reduced motion uses each clip's end pose and no loop. The unfold of child nodes
stays a runtime effect between anchors.

## Runtime helpers

`src/teleport-station-asset.mjs` provides `stationParts(scene)` (named parts,
fail closed), `showNodes(parts,count,{parent})`, `faceViewer(parts,worldEye,rate)`
for the rail and `stationMotion(scene,animations,{reduced})`.
`test/teleport-station-asset.test.mjs` checks budget, anchors, fit, rail facing,
reduced motion and the miniature library.

## Destination icons

Every teleport destination supplies its own low-poly icon
(`src/teleport-icons.mjs`, `src/teleport-semantic-icons.mjs`). The icon key
is the source revision, so a change to the source produces a new icon:

| Destination | Source |
| --- | --- |
| room | its current art export, shown as a cutaway dollhouse |
| house | its facade record |
| `terrain:residence` | the Residence export |
| worktable in a room with art | the table cropped from the room art with its real texture colours, plus a small emblem for its function |
| worktable without art, project, topic, public place | a semantic icon from its role (main A2UI widget or function) and its title |

Semantic roles: `plaza home conversation voice music viewer print archive research
code video network character map design tools output project topic`.
A destination can set `iconRole` explicitly or provide `widget`. Otherwise
the role is inferred from the id and title. A topic without a matching role
gets an emblem whose shape and colour derive from its title, so renaming a
topic renames and redraws its icon. New destination kinds such as topics or
project tables only need `id`, `title` and optionally `widget`/`iconRole`.
They then get their icon from `teleportDestinations` with no authored
miniature. Model icons sample PNG and JPEG base colours per vertex (JPEG from
its DC coefficients) and are made slightly more saturated so they read at icon size. The authored miniatures remain loading placeholders.
