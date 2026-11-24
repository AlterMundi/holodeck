"""Bake calibrated orbital images onto the existing room's UVs in Blender."""
import json
import math
from pathlib import Path
import subprocess
import sys

import bpy
import numpy as np

source, captures, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
size = 2048
views = ('entry', 'east', 'west', 'reverse', 'side', 'shelf', 'threshold', 'archive', 'bench')
palette = {
    'Basalt stair and skirting': (33, 38, 41),
    'Blued steel fixtures': (74, 80, 82),
    'Deep green tool surface': (32, 53, 63),
    'Dusk window glass': (28, 98, 116),
    'Honed limestone': (101, 104, 100),
    'Honed limestone floor with fixture bounce': (49, 53, 55),
    'Oiled oak casework': (92, 84, 73),
    'Patinated workshop bronze': (92, 64, 42),
    'Satin bronze index marks': (137, 92, 41),
    'Warm ivory mineral plaster': (109, 110, 101),
    'Warm opal': (244, 196, 118),
    'Light etched lettering': (164, 158, 137),
}


def unit(points):
    return points / np.linalg.norm(points, axis=-1, keepdims=True).clip(1e-8)


def camera_view(name):
    capture = np.load(captures / f'{name}.npz')
    pos, target = (capture[key][[0, 2, 1]] * (1, 1, -1) for key in ('position', 'target'))
    front = unit(target - pos)
    right = unit(np.cross(front, (0, 1, 0)))
    return pos, front, right, np.cross(right, front), float(capture['fov']), capture['view']


def project(points, normals, prior, cameras):
    total = np.zeros_like(points)
    weights = np.zeros(len(points), np.float32)
    for pos, front, right, up, fov, depth_map, image in cameras:
        h, w = depth_map.shape[:2]
        relative = points - pos
        depth = relative @ front
        focal = h / (2 * math.tan(math.radians(fov) / 2))
        x = (relative @ right) * focal / depth.clip(.05) + w / 2 - .25
        y = -(relative @ up) * focal / depth.clip(.05) + h / 2 - .25
        c, r = np.rint(x).astype(int), np.rint(y).astype(int)
        candidates = np.flatnonzero((depth > .05) & (r >= 0) & (r < h) & (c >= 0) & (c < w))
        if not len(candidates):
            continue
        samples = depth_map[r[candidates], c[candidates]]
        delta = points[candidates] - samples[:, :3]
        facing_surface = np.einsum('ij,ij->i', normals[candidates], samples[:, 3:6])
        along_normal = np.abs(np.einsum('ij,ij->i', delta, normals[candidates]))
        match = (samples[:, 6] > .08) & (facing_surface > .62) & (along_normal < .023)
        match &= np.linalg.norm(delta, axis=1) < np.minimum(.20, .025 + depth[candidates]*.021)
        chosen = candidates[match]
        if not len(chosen):
            continue
        # Weight texels by observed projected resolution and face angle. A
        # fourth power favours the strongest projection across drifting views.
        weight = (samples[match, 6] / (.8 + depth[chosen]*.48))**4
        px = (x[chosen]*2 + .0).clip(0, image.shape[1]-1.001)
        py = (y[chosen]*2 + .0).clip(0, image.shape[0]-1.001)
        ix, iy = px.astype(int), py.astype(int)
        a, b = (px-ix)[:, None], (py-iy)[:, None]
        color = ((1-a)*(1-b)*image[iy, ix] + a*(1-b)*image[iy, ix+1]
                 + (1-a)*b*image[iy+1, ix] + a*b*image[iy+1, ix+1])
        total[chosen] += color * weight[:, None]
        weights[chosen] += weight
    valid = weights > 0
    prior[valid] = total[valid] / weights[valid, None]
    return prior, valid


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
static = [
    obj for obj in meshes
    if not obj.name.startswith(('Archive front glazing', 'Archive side glazing', 'archive_turntable',
                                'Inset revolving display pad', 'Revolving archive index'))
]
assert static and any(obj.name == 'archive_turntable_platform' for obj in meshes)
bpy.ops.object.select_all(action='DESELECT')
for obj in static:
    obj.select_set(True)
bpy.context.view_layer.objects.active = static[0]
bpy.ops.object.join()
shell = bpy.context.object
shell.name = 'Orbital room surface'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh = shell.data
while mesh.uv_layers:
    mesh.uv_layers.remove(mesh.uv_layers[0])
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(65), island_margin=.0025, margin_method='FRACTION')
bpy.ops.object.mode_set(mode='OBJECT')
mesh.calc_loop_triangles()
material_colors = np.asarray([palette[mat.name] for mat in mesh.materials], dtype=np.float32)
uv = mesh.uv_layers.active.data
owner = np.zeros((size, size), dtype=bool)
positions = np.zeros((size, size, 3), dtype=np.float32)
normals = np.zeros_like(positions)
rgb = np.zeros((size, size, 3), dtype=np.uint8)

for tri in mesh.loop_triangles:
    xy = np.array([tuple(uv[i].uv) for i in tri.loops]) * size - .5
    x0, y0 = np.maximum(0, np.floor(xy.min(0)).astype(int))
    x1, y1 = np.minimum(size-1, np.ceil(xy.max(0)).astype(int))
    p, q = xy[1] - xy[0], xy[2] - xy[0]
    det = p[0]*q[1] - p[1]*q[0]
    if abs(det) < 1e-7 or x0 > x1 or y0 > y1:
        continue
    ys, xs = np.mgrid[y0:y1+1, x0:x1+1]
    dx, dy = xs - xy[0, 0], ys - xy[0, 1]
    u = (dx*q[1] - dy*q[0]) / det
    v = (p[0]*dy - p[1]*dx) / det
    inner = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1.000001)
    rows, cols = ys[inner], xs[inner]
    verts = np.array([tuple(mesh.vertices[i].co) for i in tri.vertices], dtype=np.float32)
    xyz = verts[0] + u[inner, None]*(verts[1] - verts[0]) + v[inner, None]*(verts[2] - verts[0])
    positions[rows, cols] = xyz[:, [0, 2, 1]] * (1, 1, -1)
    nx, ny, nz = tri.normal
    normals[rows, cols] = (nx, nz, -ny)
    rgb[rows, cols] = material_colors[tri.material_index]
    owner[rows, cols] = True

cameras = []
for name in views:
    pos, front, right, up, fov, grid = camera_view(name)
    h, w = grid.shape[:2]
    pixels = subprocess.check_output(['ffmpeg', '-v', 'error', '-threads', '1', '-i',
        str(captures / f'{name}-style.png'), '-vf', f'scale={w*2}:{h*2}:flags=lanczos',
        '-frames:v', '1', '-threads:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    cameras.append((pos, front, right, up, fov, grid, np.frombuffer(pixels, np.uint8).reshape(h*2, w*2, 3)))

rows, cols = np.nonzero(owner)
matched = 0
for start in range(0, len(rows), 90_000):
    y, x = rows[start:start+90_000], cols[start:start+90_000]
    colors, valid = project(positions[y, x], normals[y, x], rgb[y, x].astype(np.float32), cameras)
    rgb[y, x] = np.rint(colors).clip(0, 255).astype(np.uint8)
    matched += int(valid.sum())
assert matched > .40 * len(rows), 'Insufficient visible atlas coverage'
# Extend the islands for texture filtering without overwriting other charts.
grown = owner.copy()
for _ in range(14):
    known = grown.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        origin = (slice(max(0, -dy), min(size, size-dy)), slice(max(0, -dx), min(size, size-dx)))
        target = (slice(max(0, dy), min(size, size+dy)), slice(max(0, dx), min(size, size+dx)))
        change = known[origin] & ~grown[target]
        rgb[target][change] = rgb[origin][change]
        grown[target][change] = True

atlas = output / 'orbital-atlas.jpg'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-threads', '1', '-f', 'rawvideo',
    '-pix_fmt', 'rgb24', '-s', f'{size}x{size}', '-i', 'pipe:0', '-frames:v', '1',
    '-q:v', '2', '-threads:v', '1', str(atlas)], input=rgb[::-1].tobytes(), check=True)
material = bpy.data.materials.new('Orbital image projection')
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
tex = nodes.new('ShaderNodeTexImage')
tex.image = bpy.data.images.load(str(atlas.resolve()))
tex.image.pack()
background = nodes.new('ShaderNodeBackground')
surface = nodes.new('ShaderNodeOutputMaterial')
material.node_tree.links.new(tex.outputs['Color'], background.inputs['Color'])
material.node_tree.links.new(background.outputs[0], surface.inputs['Surface'])
mesh.materials.clear()
mesh.materials.append(material)
for polygon in mesh.polygons:
    polygon.material_index = 0
# The archive assembly keeps its separate meshes for glass and rotation.
# The static image is baked; these parts retain their physical shaders.
live_materials = {
    'Clear archive glazing': (.07, .24, .27),
    'Deep green tool surface': (.022, .032, .036),
    'Satin bronze index marks': (.46, .17, .045),
}
for name, base in live_materials.items():
    mat = bpy.data.materials.get(name)
    if not mat:
        continue
    shader = next((node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if shader:
        color = shader.inputs['Base Color']
        color.default_value = (*base, color.default_value[3])
bpy.ops.export_scene.gltf(filepath=str((output / 'orbital-room.glb').resolve()), export_format='GLB',
                          export_animations=False)
(output / 'uv-report.json').write_text(json.dumps({
    'views': list(views), 'atlasPixels': size*size, 'mappedTexels': len(rows),
    'projectedTexels': matched, 'opaqueMeshes': len(static),
    'independentMeshes': len(meshes) - len(static),
}, indent=2) + '\n')
