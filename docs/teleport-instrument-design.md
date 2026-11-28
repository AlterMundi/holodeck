# Teleport instrument design brief

The selected direction is Alternative 3, a low tabletop that leaves the world
visible behind it. Use the supplied front and three-quarter views, plaza and
vestibule studies, and low circular board concept. They are design references.
Char Design owns the 3D from a clean design and can improve the form, finish,
materials, silhouette and motion while retaining the interaction below.

## Interaction

- Q opens the instrument at a clear point in the current place. The other
  presentation is mounted to the camera. Escape closes the instrument.
- The board shows the authorized destinations for the current level. Selecting
  a destination with links triggers a single unfold that reveals those links.
  The selected parent remains recognizable at or above the center. Clicking
  that same 3D parent navigates back one level. It is an A2UI control with the
  same action and focus behavior as its keyboard equivalent.
- A leaf selects a destination. A separate Viajar action confirms travel.
  Selecting a hub also leaves it available as a travel target when allowed.
- The unfold is a local presentation effect. It preserves camera control and
  keeps the world as context. The quiet reduced-motion state keeps the same
  layout, selection and actions. Use restrained light and visible connectors
  with a clear distinction between a physical node and a confirmation control.
- The fixtures cover Houses → House → Room → Worktable and the public
  Residence's authorized portal links. Destination IDs come from Holodeck.
  Use genuine room and object names. Miniatures may vary by semantic type.

## Plan and elevations for the first asset pass

These are provisional fit dimensions for the existing invocation, in meters,
for Char Design to revise after checking the world camera. This plan sizes the
asset; the render references provide the visual elevations.

| View | Fit and placement |
| --- | --- |
| Top | Low round or oval board approximately 1.65–1.9 wide by 1.15–1.4 deep; up to four visible children spaced around the central anchor |
| Front | Board surface about 0.60–0.85 above the floor; child miniatures about 0.15–0.26 above the surface; a parent floats just high enough to read behind the nearest child |
| Side | Keep the back silhouette below the parent; shallow dish or rim with no large roof, shield or vertical chassis obstructing the world |
| Detail | Keep visible symbols, focus outlines and ray targets aligned; leave clearance around the center and between leaf targets |

The world mount uses local up, a clear spot ahead of the player, and a bounded
inspection camera. Keep the footprint readable at an oblique angle and a narrow
phone viewport. At least one physical back target and the active destination
miniatures should remain easy to pick. Holodeck wires the presentation to
A2UI control IDs and travel permissions. Deliver source geometry/materials and
a runtime asset or small asset module with named anchors for the center, leaf
slots and, if needed, the unfold effect. Follow the existing venue style for
brass, teal, glass, stone and warm amber within the selected low-profile form.
