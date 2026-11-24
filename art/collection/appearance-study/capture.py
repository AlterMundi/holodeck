"""Export known player-height cameras, reference renders, and visible surfaces."""
from pathlib import Path
import math
import sys

import bpy
from mathutils import Vector
import numpy as np

arguments = sys.argv[sys.argv.index('--') + 1:]
out = Path(arguments.pop(0))
fine = '--fine' in arguments
if fine:
    arguments.remove('--fine')
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
camera = scene.camera
scene.render.resolution_x = 1152 if fine else 768
scene.render.resolution_y = 768 if fine else 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
camera.data.lens = 18
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
# Keep glazing and the rotating display as independent live meshes.
dynamic = set()
for obj in scene.objects:
    materials = getattr(obj.data, 'materials', [])
    if (obj.name.startswith('archive_turntable') or
            (obj.parent and obj.parent.name.startswith('archive_turntable')) or
            any(m and m.name == 'Clear archive glazing' for m in materials)):
        obj.hide_render = True
        dynamic.add(obj.name)
views = {
    'entry': ((-.72, -4.38, 1.66), (.0, 2.79, 1.23)),
    'east': ((2.80, -.85, 1.66), (-.2, 2.75, 1.13)),
    'west': ((-2.82, -1.96, 1.66), (.1, 2.68, 1.20)),
    'reverse': ((1.76, 4.85, 1.66), (-.4, -.9, 1.20)),
    'side': ((4.78, .9, 1.66), (-1.85, .1, 1.30)),
    'shelf': ((-4.60, 2.15, 1.66), (-1.05, -.2, 1.18)),
    'held': ((.96, -2.55, 1.66), (.05, 2.8, 1.15)),
}
if fine:
    views.update({
        'threshold': ((-4.25, -5.00, 1.62), (3.8, -3.00, 1.45)),
        'archive': ((4.65, .50, 1.70), (3.35, 3.69, 1.60)),
        'bench': ((-2.73, .60, 2.20), (.00, .43, .68)),
    })
w, h = scene.render.resolution_x, scene.render.resolution_y
for name in (arguments or views):
    position, target = views[name]
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    scene.render.filepath = str(out / f'{name}.png')
    bpy.ops.render.render(write_still=True)
    if name == 'held':
        continue
    graph = bpy.context.evaluated_depsgraph_get()
    origin = camera.matrix_world.translation
    rotation = camera.matrix_world.to_quaternion()
    frame = camera.data.view_frame(scene=scene)
    x0, x1 = min(v.x for v in frame), max(v.x for v in frame)
    y0, y1 = min(v.y for v in frame), max(v.y for v in frame)
    z = frame[0].z
    grid = np.zeros((h//2, w//2, 7), dtype=np.float32)
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            ray = rotation @ Vector((x0 + (x1-x0)*(x+.5)/w, y1 - (y1-y0)*(y+.5)/h, z)).normalized()
            cursor = origin
            for _ in range(4):
                hit, point, normal, _, obj, _ = scene.ray_cast(graph, cursor, ray, distance=18)
                if not hit or obj.name not in dynamic:
                    break
                cursor = point + ray * .002
            if hit and obj.name not in dynamic:
                grid[y//2, x//2] = (
                    point.x, point.z, -point.y, normal.x, normal.z, -normal.y,
                    max(.05, -ray.dot(normal)),
                )
    np.savez_compressed(out / f'{name}.npz', view=grid, position=position,
                        target=target, fov=math.degrees(2*math.atan((y1-y0)/(-2*z))))
