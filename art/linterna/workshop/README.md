# Hefesto · Claymon room art

This first finish pass reuses the full 12 m Claymon room and the four object
footprints in `../dimensions.json`. It adds toned photographs of worn timber
and limewash, a wood floor normal map, bevelled furniture edges, an opening with
a wooden window sash, a framed return door, and separate oak boards for showing
comparison samples. The room stays editable in `model.mjs`.

The `room-marker` at room-local `(0, .45, -2)` keeps its semantic address.
The visible turntable's top is at `(0, 1.146, -2)`. The GLB includes that data
as art metadata so the room can be reviewed against the existing host projection.
Visual geometry is floor-relative and +Y up. Use the existing four furniture
footprints for collision. The model has a full wall behind the visual return
fitting, so its look and the passage offer are independent.

## Build

```sh
node art/linterna/workshop/build-review.mjs OUTPUT_DIR
cd OUTPUT_DIR
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/` in a WebGL browser. The review constructs the art,
exports a GLB and then renders its decoded bytes. Use
`window.workshopReview.save()` in the browser console to obtain the GLB, or
`window.workshopReview.chooseView('table')` to inspect the closer view.
The optional `?sample` mode previews a separately selected local reference
sculpture at the turntable and on the comparison boards. Supply a local example
revision as `sample.sculpt` for that mode. The GLB export always precedes sculpture
placement. The warm window lighting and garden context are review-stage
ingredients and can be carried forward into the runtime's art profile.

No shared room, project content, access selection or editor state is set by this
recipe. The workshop art is sized for evaluation against the ordinary 768 KiB
room kit budget. The selected receiving art profile still has to align lighting
and room geometry with its own window, doorway and collision projection before
a live adoption.

## Material sources

The original photographs are from Poly Haven and are available under
[CC0](https://polyhaven.com/license). This project stores the bounded JPEG
derivatives used during build, with the links below retaining the masters.

| Local file | Original | Credit and changes |
| --- | --- | --- |
| `materials/floor.jpg` | [Wood Floor](https://polyhaven.com/a/wood_floor) diffuse | Dimitrios Savva. 1K JPEG reduced to 512 × 512. |
| `materials/floor-normal.jpg` | [Wood Floor](https://polyhaven.com/a/wood_floor) OpenGL normal | Dimitrios Savva. 1K JPEG reduced to 512 × 512. |
| `materials/bench.jpg` | [Wood Table Worn](https://polyhaven.com/a/wood_table_worn) diffuse | Dimitrios Savva and Rico Cilliers. 1K JPEG reduced to 512 × 512, with brighter grain and lower saturation. |
| `materials/wall.jpg` | [Beige Wall 001](https://polyhaven.com/a/beige_wall_001) diffuse | Dimitrios Savva and Rico Cilliers. 1K JPEG reduced to 384 × 384. |
