"""Apply a generated stone sample and bake the existing room's fixed light."""
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
floor = bpy.data.objects['Full room walking surface']
material = floor.data.materials[0]
nodes, links = material.node_tree.nodes, material.node_tree.links
shader = nodes.get('Principled BSDF')
base_colour = shader.inputs['Base Color']
source_image = bpy.data.images.load(str(source.resolve()))
source_image.colorspace_settings.name = 'Non-Color'
width, height = source_image.size
assert 0 < width == height <= 2048, 'Use a square material swatch of up to 2048 pixels'

# The existing floor UV covers the rectangle in room meters. Bake only the
# walking face so overlapping UVs on the underside cannot overwrite it.
top = max(floor.data.polygons, key=lambda face: face.normal.z)
uv_name = floor.data.uv_layers.active.name
mesh = bpy.data.meshes.new('Walking face for light bake')
mesh.from_pydata([floor.matrix_world @ floor.data.vertices[index].co
                    for index in top.vertices], [], [tuple(range(len(top.vertices)))])
mesh.update()
mesh.uv_layers.new(name=uv_name)
for index, loop in enumerate(top.loop_indices):
    mesh.uv_layers.active.data[index].uv = floor.data.uv_layers.active.data[loop].uv
receiver = bpy.data.objects.new('Floor light receiver', mesh)
scene.collection.objects.link(receiver)
receiver.data.materials.append(material)
floor.hide_render = True
bpy.ops.object.select_all(action='DESELECT')
receiver.select_set(True)
bpy.context.view_layer.objects.active = receiver

size = 512
lighting = bpy.data.images.new('Fixed diffuse irradiance', size, size, alpha=False, float_buffer=True)
lighting.colorspace_settings.name = 'Non-Color'
target = nodes.new('ShaderNodeTexImage')
target.image = lighting
nodes.active = target
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.render.bake.margin = 8
scene.render.bake.use_pass_color = False
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
bpy.ops.object.bake(type='DIFFUSE')

pixels = np.empty(size * size * 4, dtype=np.float32)
lighting.pixels.foreach_get(pixels)
rgb = pixels.reshape(size, size, 4)[:, :, :3].copy()
nonzero = np.max(rgb, axis=2) > 1e-5
assert {tuple(loop.uv) for loop in mesh.uv_layers.active.data} == {
    (0, 0), (0, 1), (1, 0), (1, 1),
}, 'The walking face must fill the floor UV rectangle'
assert np.isfinite(rgb).all() and nonzero.any(), 'The diffuse bake returned no usable light'
low, high = np.percentile(rgb[nonzero].mean(axis=1), [5, 95])
assert high > low > 0

# Build a portable single base-color map. Lighting is kept subdued because
# the normal runtime still applies local lighting to characters and objects.
albedo = np.empty(width * height * 4, dtype=np.float32)
source_image.pixels.foreach_get(albedo)
albedo = albedo.reshape(height, width, 4)[:, :, :3]
albedo = np.where(albedo <= .04045, albedo / 12.92, ((albedo + .055) / 1.055)**2.4)
sample = ((np.arange(size) + .5) / size * 10) % 1
indices = np.minimum((sample * width).astype(int), width - 1)
joint = np.minimum(sample, 1 - sample)
joint = np.clip(np.minimum(joint[:, None], joint[None, :]) / .038, 0, 1)
tiles = albedo[indices[:, None], indices[None, :]]
unlit = tiles * (.37 + .63 * joint[:, :, None])
amount = np.clip((rgb.mean(axis=2) - low) / (high - low), 0, 1)
tint = np.clip(rgb / np.maximum(rgb.mean(axis=2, keepdims=True), 1e-5), .7, 1.3)
mixed = np.clip(unlit * (.70 + .37 * amount[:, :, None]) * (.70 + .30 * tint), 0, 1)
baked = bpy.data.images.new('Limestone with fixed workshop light', size, size, alpha=False)
pixels = np.ones((size, size, 4), np.float32)
pixels[:, :, :3] = np.where(mixed < .0031308, 12.92 * mixed, 1.055 * mixed**(1 / 2.4) - .055)
baked.pixels.foreach_set(pixels.ravel())
baked.filepath_raw = str(output.resolve() / 'floor-baked.png')
baked.file_format = 'PNG'
baked.save()
baked.filepath_raw = str(output.resolve() / 'floor-runtime.jpg')
baked.file_format = 'JPEG'
baked.save(quality=92)
runtime_image = bpy.data.images.load(baked.filepath_raw)
runtime_image.pack()
runtime_image.filepath = '//floor-runtime.jpg'

nodes.remove(target)
appearance = nodes.new('ShaderNodeTexImage')
appearance.label = 'ImageGen limestone + baked room light'
appearance.image = runtime_image
links.new(appearance.outputs['Color'], base_colour)
bpy.data.objects.remove(receiver, do_unlink=True)
floor.hide_render = False
bpy.ops.object.select_all(action='DESELECT')
floor.select_set(True)
bpy.context.view_layer.objects.active = floor
bpy.ops.export_scene.gltf(filepath=str(output / 'floor-skin.glb'), export_format='GLB',
                          use_selection=True, export_animations=False)
scene.render.resolution_percentage = 66
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'matter-floor-skin.blend'), compress=True)
for name, position, look_at in [
    ('entry', (-.72, -4.38, 1.68), (-.57, 2.79, 1.30)),
    ('lateral', (2.95, -.4, 1.66), (-.53, 2.2, .98)),
]:
    camera = scene.camera
    camera.location = position
    camera.rotation_euler = (Vector(look_at) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(output.resolve() / f'{name}.png')
    bpy.ops.render.render(write_still=True)
print(f'{nonzero.mean():.3%} of texels received light; diffuse percentile range {low:.3f}–{high:.3f}')
