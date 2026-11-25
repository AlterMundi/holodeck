# Holodeck environment art revamp

Nicolás selected three Gemini frames as the quality target. The outdoor
views place layered meadow, a readable path and a detailed home under
an open sky with distinct middle and distant silhouettes. The celestial
arc contributes color and scale above the horizon. The astral passage
has a luminous cyan and brass threshold. Review the full in-game
approach at eye height and the view from the first bend before using
an isolated material close-up to make a release decision.

## Current baseline and observed gaps

Production still selects `476adaf02828`. It has authored vegetation near
the house, coarse scattered props beyond it, a seeded level-of-detail
torus, an Argentine solar clock, procedural clouds, a projected cosmic
panorama, and materials that already use radial lighting. The production
surface can look flat between nearby vegetation banks. The cosmic
panorama occupies more of the dusk frame than in the selected references.
The detailed house and local plants need a coherent foreground,
middle distance and horizon in the same moving shot.

A clean visual branch off that production source built a draft with
continuous ground shading and deterministic camera-neighborhood grass
tiles. Each tile uses canonical torus coordinates, a bounded candidate
count and retained seeds during camera movement. Close plants use root-
fixed vertex wind, small mid-distance tufts supplement the palette, and
distant slopes carry continuous material variation. The first Chromium
fixture loaded the new material at arrival and a remote tile without a
shader error. This was a functional software-rendered check. The first
remote sample was at the water and is unsuitable for an artistic meadow
comparison. Use the dry cave approach and overlook for traveled matches.

The branch also contains the team's initial portal and interface work.
The built-in image generator produced an original landscape plate with
an upright cyan/brass astrolabe portal in a dark interstellar field and
space for live text below. The 29,820-byte AVIF is a derivative of that
plate. DOM status follows the actual arrival state. CSS runs the visual
motion and reduced-motion alternative. The existing A2UI retry still
works and reverts to the browser control if WebGL is lost.

## Environment decisions

### Vegetation by distance

Use the maintained analytic terrain for elevation, wetness, slope and
trail masks. Keep the foreground plants grounded on its actual surface
at both ends of each torus address seam. Group grass by wrapped tiles.
Use individual shapes, flowers and seed heads within silhouette range,
fewer crossing tufts and cooler color at middle distance, and color,
normal and roughness variation on the terrain farther out. Let wind
change the bent tips and their lighting while roots remain fixed. Avoid
height changes solely to improve the appearance of a grass patch.
Split new-cell preparation from draw calls and measure CPU upload spikes
while running and turning. Delay density increases until those costs
are measured. [GPU Gems virtual botany](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-1-toward-photorealism-in-virtual-botany)

The torus already has streamed terrain tiles, seam coordination and
walkable collision. Apply gradual visual detail transitions within that
system. A clipmap is an option only if same-route measurements expose
a sustained geometry or update bottleneck. [Geometry clipmaps](https://hhoppe.com/proj/geomclipmap/)

### Air and light

Link the horizon, the terrain's distant color and the low-angle sun.
Start with height- and distance-dependent transmittance on each body's
existing radial frame. Keep the panorama recognizable through clear air
and restore more of its color at dusk with the same solar clock.
For clouds, use the lit edge and underbody to read volume at grazing
angles. Compare the existing low-cost directional field with a lookup
texture for atmospheric transmittance before considering per-pixel
volumetric integration. [Hillaire, scalable atmosphere rendering](https://sebh.github.io/publications/egsr2020.pdf)

Keep materials physically legible with roughness variation, ground
contact and sky bounce. Compare the existing house silhouette with
the selected concept at the same camera height. Prioritize masonry
relief, trim around openings, warm window light and the threshold.
Use selective emission around windows, the robot visor and the tabletop.
For composited landscape or facade details, evaluate meshes, image
cards or splats against equal views, motion parallax, package size and
light response. Use physical geometry wherever visitors can cross or
touch a surface.

## Screening route

Use identical graphics quality, resolution, seed, camera and solar clock
to compare the active build and the candidate. On RTX 2060 Normal and
Pi 5 Livianos record CPU and GPU frame time separately where supported,
draw calls, triangles, worst moving intervals, worker/upload spikes and
package bytes. Sample cold arrival, calm standing, a continuous run past
the house, the dry cave approach, a long ridge view and the portal.
Review individual frames and a continuous pass across a tile seam.
Compare daylight, dusk, a handheld viewport and reduced motion. Carry
the same in-game camera and art cues to the Proyección and character
motion work. Publish exact evidence and a compatible rollback through
the existing service route.
