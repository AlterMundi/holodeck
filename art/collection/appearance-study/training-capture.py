"""Render one coherent orbital room into calibrated Nerfstudio data."""
import argparse
import hashlib
import json
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector
import numpy as np


def camera_plan(train_count):
    # Views surround the table and cover the room thresholds. Each camera
    # stays in a walkable perimeter and several aim across, rather than in,
    # so that walls and cabinet backs receive overlapping observations.
    for i in range(train_count):
        angle = 2 * pi * i / train_count
        position = (4.55 * cos(angle), 4.55 * sin(angle), 1.35 + .65 * ((i % 3) / 2))
        heading = angle + pi + (-.70, 0., .70, 1.05, -1.05)[i % 5]
        distance = 5.
        target = (position[0] + distance * cos(heading),
                  position[1] + distance * sin(heading),
                  (1.05, 1.45, 2.3)[i % 3])
        yield 'train', position, target
    # Exact positions and aim are reserved from both the input split and the
    # point colors. Include a nearer view of the workbench and the threshold.
    for position, target in (
        ((.96, -2.55, 1.66), (.05, 2.8, 1.15)),
        ((-3.2, -3.55, 1.74), (1.6, 2.9, 1.65)),
        ((2.91, -1.12, 1.7), (-.29, 2.75, 1.11)),
        ((-4.0, 1.37, 1.62), (-.23, .53, .9)),
        ((3.01, 2.35, 1.81), (3.35, 3.69, 1.62)),
        ((-1.86, 3.02, 1.77), (-1.85, -1., 1.68)),
        ((4.18, -3.25, 1.69), (-1.8, -5.39, 1.32)),
        ((1.60, 4.88, 1.63), (-3.22, 1.18, 1.12)),
    ):
        yield 'test', position, target


def save_seed(compact, path):
    dtype = np.dtype([('xyz', '<i2', (3,)), ('rgb', 'u1', (3,)), ('normal', 'i1', (3,))])
    if compact.stat().st_size % dtype.itemsize:
        raise ValueError('Invalid compact splat point seed')
    points = np.fromfile(compact, dtype=dtype)
    # A compact, neutral initialization from Blender geometry. Strip color
    # from ImageGen projections so the seed cannot leak observations.
    quant = points['xyz'].astype(np.float32) / 4096
    grid = np.rint(quant / .085).astype(np.int16)
    _, keep = np.unique(grid, axis=0, return_index=True)
    xyz = quant[keep][:, [0, 2, 1]] * (1, -1, 1)
    packed = np.empty(len(xyz), dtype=np.dtype([('xyz', '<f4', (3,)), ('rgb', 'u1', (3,))]))
    packed['xyz'] = xyz
    packed['rgb'] = 120
    with path.open('wb') as out:
        out.write(('ply\nformat binary_little_endian 1.0\n'
                   f'element vertex {len(xyz)}\nproperty float x\nproperty float y\nproperty float z\n'
                   'property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n').encode())
        packed.tofile(out)
    return len(xyz)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('room', type=Path)
parser.add_argument('seed', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--train', type=int, default=40)
parser.add_argument('--samples', type=int, help='Override Cycles samples per view')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not 12 <= args.train <= 200:
    parser.error('--train must be between 12 and 200')
if args.samples is not None and not 4 <= args.samples <= 64:
    parser.error('--samples must be between 4 and 64')
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
images = output / 'images'
images.mkdir(exist_ok=True)
editable = args.room.suffix.lower() == '.blend'
if editable:
    bpy.ops.wm.open_mainfile(filepath=str(args.room.resolve()))
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.room.resolve()))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples or (12 if editable else 4)
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
if not editable:
    scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 94
width, height = 768, 512
scene.render.resolution_x, scene.render.resolution_y = width, height
scene.render.resolution_percentage = 100
data = bpy.data.cameras.new('Calibrated orbital capture')
camera = bpy.data.objects.new(data.name, data)
scene.collection.objects.link(camera)
scene.camera = camera
data.sensor_fit = 'HORIZONTAL'
data.sensor_width = 36
data.lens = 18
focal = width * data.lens / data.sensor_width
frames, train, test = [], [], []
hashes = {}
for index, (split, position, target) in enumerate(camera_plan(args.train)):
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    filename = f'images/{split}-{index:03}.jpg'
    scene.render.filepath = str(output / filename)
    bpy.ops.render.render(write_still=True)
    frames.append({'file_path': filename, 'transform_matrix': [list(r) for r in camera.matrix_world]})
    (train if split == 'train' else test).append(filename)
    hashes[filename] = hashlib.sha256((output / filename).read_bytes()).hexdigest()
seed_count = save_seed(args.seed, output / 'seed.ply')
meta = {
    'camera_model': 'OPENCV', 'w': width, 'h': height, 'fl_x': focal, 'fl_y': focal,
    'cx': width / 2, 'cy': height / 2, 'orientation_override': 'none',
    'ply_file_path': 'seed.ply', 'frames': frames,
    'train_filenames': train, 'val_filenames': test, 'test_filenames': test,
}
(output / 'transforms.json').write_text(json.dumps(meta, indent=2) + '\n')
(output / 'capture-receipt.json').write_text(json.dumps({
    'sourceSha256': hashlib.sha256(args.room.read_bytes()).hexdigest(), 'seedPoints': seed_count,
    'seedSha256': hashlib.sha256(args.seed.read_bytes()).hexdigest(),
    'sourceFormat': 'blend' if editable else 'gltf', 'samples': scene.cycles.samples,
    'viewTransform': scene.view_settings.view_transform,
    'train': len(train), 'heldOut': len(test), 'images': hashes,
}, indent=2) + '\n')
