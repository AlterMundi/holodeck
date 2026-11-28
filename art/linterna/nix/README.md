# Templo de Nix · room design review

The approved WANDA room and a separate temple vestibule on Casa Linterna’s semicircle. The eye station stands to the
left of the approach, with the east gallery opposite it. The floor is
12 × 12 m, the walls are 3.68 m high, and the south threshold is
2.20 × 2.60 m. The threshold looks back toward the temple vestibule. A timber aperture
opens to a decorative night sky. Limewash, walnut, brass, sage trim and amber
light carry forward the Casa Linterna selection at
a2f245e4a5d58349b28a3b0dd65fc53b9271daec.

## Scene and review

- **model.mjs** builds the shell, carpentry, mount, console, frames, lamps
  and physical display surfaces with original procedural materials.
- **plan.mjs** is the editable room-local layout in metres, +Y up, +Z toward
  the entrance. It includes view poses, clearance footprints and markers.
  Every export repeats its marker's exact identifier in GLB extras.anchorId
  so it stays available even when a loader sanitizes the display name.
- **review.mjs** supplies lighting and the local interactive fixture. The
  GLB contains the art, frame surfaces and marker extras. Media and lighting
  are review-layer operations.
- **build-review.mjs** builds the offline HTML from the exact WANDA fixture.
  Gallery surfaces use derived 240 × 180 thumbnails. The ocular's circle
  crops the center of the same 4:3 image at its natural proportions. The
  eye and the capture frame open the same immutable original in a focus-managed
  dialog with fit, 2× inspection, and a return to the same camera position.

The observation comes from AlterMundi/wanda-telescope at
e0fb9dfdbca38e841419f1ec58f15277411665cc, directory
fixtures/observations/fixed-night-v1. The completed scripted observation is
wanda-fixture-01-000002 at 2025-11-28T03:00:01.100Z, exposure 100 ms and gain 2×.
The exact 640 × 480 JPEG has digest
35a68ced654fac9bfd21a160168ce1aab5ecd385b54ac4c5dba60022c1646e50.
The pixel origin is the top left and the pixels are unmirrored.
Sky calibration is unresolved in the selected record.

Export the fixture from its exact Git revision. With Node, dependencies,
FFmpeg and ffprobe, run from the Holodeck checkout.

```sh
node art/linterna/nix/build-review.mjs "$FIXED_NIGHT_FOLDER" "$OUTPUT_DIR"
node art/linterna/nix/check-review.mjs "$OUTPUT_DIR/Templo-de-Nix-revision.html" "$PLAYWRIGHT_ESM" "$CHECK_DIR"
```

Open the HTML directly in a WebGL browser. Use the view buttons and, on
desktop, WASD and drag. The checks measure a 1.12 m wide walking envelope,
survey both 1.20 and 1.64 m eye heights, cross the threshold with keyboard,
reopen the GLB and verify the exact source digest through inspection.
They exercise fit, zoom, close, focus restoration and the narrow touch layout.

## Spatial handoff

Exact positions and direction vectors are in plan.mjs and the GLB extras.
Placement in an admitted shared room belongs to the existing receiving owner.

| Marker | Proposed role |
| --- | --- |
| nix.entry, nix.return | Coincident threshold anchors facing in and out. |
| wanda.mount | Plinth and angled optical barrel representation. Hardware dimensions, bearings and cable and actuator envelope remain WandaTelescope decisions. |
| wanda.eyepiece, wanda.full-frame | The same station. The circular architectural face opens a contained original through inspect_eyepiece. |
| wanda.controls | Status and inspection station with a reserved display face. |
| wanda.gallery.capture | A framed thumbnail. inspect_poster opens the same immutable JPEG. |
| wanda.gallery.preview-02, wanda.gallery.preview-03 | Two demonstration-only views from the pinned preview sequence. |

The Holodeck integration revision 4a3b16c2 already projects the pinned still
through scoped inspect_eyepiece and inspect_poster A2UI actions. This review
models the transitions locally. **Sin señal** blanks the ocular and leaves
the fixture archive legible. **Modo en vivo · Demo** plays the scripted
750 ms sequence once and keeps its simulation label. Real freshness, route
admission, reciprocal links, runtime projections, and A2UI belong to the
existing Holodeck receiver. Pi, optics, exposure and physical motion belong
to WandaTelescope. The design review opens no node connection.

## Temple and garden review

In the viewer, open **Ver desde el jardín**, then **Ver los cuatro templos**
for the overview. The four peers are Atenea, Nix, Hefesto and Apolo from west
to east. The entrance axes face the same center at (0, -4.50) in the
precinct XZ plane. Each temple occupies the midpoint of one 45° sector of
the semicircle. The four garden thresholds share a 15.20 m radius with
11.63 m chords between consecutive thresholds. The three existing temple
models keep their architecture and move to the new positions. The garden paths
follow the new arc. The two former expansion shelters are left out of this
study, and planting that crosses a path or temple footprint is cleared.

Nix uses the shared four-column portico and gabled roof. Its 9.00 m façade
matches Atenea's width and the common roof reaches the same height as the
other temples. The vestibule continues from the garden door to the rear of
the temple. A statue of Nix in a midnight mantle stands on the left. The
**WANDA · OBSERVATORIO** door stands on the right and opens the approved room
in its own scene. The same thresholds serve the return path. The source
survey checks the four equal entrance spacings, all six pairs of temple
footprints, a 1.12 m clear approach to each temple, and sightlines to the
statue and WANDA door from 1.20 and 1.64 m eye heights.
The app room uses the same geometry and WANDA data.

| Vestibule marker | Purpose |
| --- | --- |
| nix.foyer.entry | Garden to vestibule |
| nix.foyer.return | Vestibule to garden |
| nix.foyer.statue | Statue of Nix on the vestibule's left side |
| nix.foyer.wanda-door | Vestibule to nix.entry; nix.return lands back at this door |

The viewer lets the observer take the garden walk into the vestibule, inspect
the statue, use the labelled door or the keyboard-accessible equivalent,
inspect the original WANDA image, and return through both spaces in order.
The exported vestibule GLB uses its own local origin. The approved app room
GLB is an independent asset. Spatial relationships in this review are
design instructions for the existing Holodeck owner, whose scene graph,
admission, A2UI and media authority remain independent. The review makes
no physical WANDA connection.
