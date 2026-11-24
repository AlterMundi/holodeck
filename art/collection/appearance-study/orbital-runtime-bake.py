"""Bake the orbital reference scene's fixed diffuse light for a runtime trial."""
import argparse
from pathlib import Path
import sys

import bpy
import numpy as np


def select_only(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def is_live_object(obj, platform):
    if obj == platform or obj.parent == platform:
        return True
    for slot in obj.material_slots:
        if not slot.material or not slot.material.node_tree:
            continue
        for node in slot.material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED' and (
                node.inputs['Transmission Weight'].default_value > 0
                or node.inputs['Emission Strength'].default_value > 0
            ):
                return True
    return False

def image_pixels(image):
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(height, width, 4)


def save_linear_atlas(title, rgb, destination):
    height, width, _ = rgb.shape
    image = bpy.data.images.new(title, width, height, alpha=False, float_buffer=True)
    try:
        # Save the linear numeric channels verbatim, without Blender's
        # display transfer on export. Consumers interpret the data as linear.
        image.colorspace_settings.name = 'Non-Color'
        pixels = np.ones((height, width, 4), dtype=np.float32)
        pixels[..., :3] = rgb
        image.pixels.foreach_set(pixels.ravel())
        image.filepath_raw = str(destination)
        image.file_format = 'OPEN_EXR'
        image.save()
    finally:
        bpy.data.images.remove(image)


def clean_irradiance(rgb):
    # Reject isolated high radiance from indirect rays. The color atlas is
    # composed afterward, so this filter never softens material detail.
    height, width, _ = rgb.shape
    padded = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
    taps = np.stack([padded[y:y+height, x:x+width] for y, x in
                     ((1, 1), (0, 1), (2, 1), (1, 0), (1, 2))])
    lum = taps @ np.asarray((.2126, .7152, .0722), np.float32)
    middle = np.median(lum, axis=0)
    limit = np.maximum(.025, middle * 1.8 + .026)
    reliability = np.minimum(1, limit[None, :, :] / np.maximum(lum, 1e-7))
    similarity = 1 / (1 + np.abs(lum - middle) / (.10 + middle * .35))
    weights = similarity * (lum > 1e-6)
    total = weights.sum(axis=0)
    averaged = (taps * (weights * reliability)[..., None]).sum(axis=0)
    averaged /= np.maximum(total[..., None], 1e-7)
    # Keep the original edge when there are too few valid UV neighbors.
    edge = np.count_nonzero(lum > 1e-6, axis=0) < 4
    return np.where(edge[..., None], rgb * reliability[0, ..., None], averaged)


def set_bake_image(materials, image):
    for material in materials:
        nodes = material.node_tree.nodes
        target = next((node for node in nodes if node.name == 'Orbital bake target'), None)
        if target is None:
            target = nodes.new('ShaderNodeTexImage')
            target.name = 'Orbital bake target'
        target.image = image
        nodes.active = target
        target.select = True


def bake_material_input(materials, image, channel, uv_layer, margin, colors=None):
    saved = []
    for material in materials:
        tree = material.node_tree
        shader = tree.nodes.get('Principled BSDF')
        output = next(node for node in tree.nodes if node.type == 'OUTPUT_MATERIAL' and node.is_active_output)
        surface = output.inputs['Surface']
        previous = surface.links[0].from_socket
        emission = tree.nodes.new('ShaderNodeEmission')
        color = shader.inputs[channel]
        if colors is not None:
            emission.inputs['Color'].default_value = colors[material.name]
        elif color.is_linked:
            tree.links.new(color.links[0].from_socket, emission.inputs['Color'])
        else:
            value = color.default_value
            emission.inputs['Color'].default_value = (value,value,value,1) if color.type=='VALUE' else value
        tree.links.new(emission.outputs[0], surface)
        saved.append((tree, previous, surface, emission))
    try:
        set_bake_image(materials, image)
        bpy.ops.object.bake(type='EMIT', uv_layer=uv_layer, use_clear=True, margin=margin)
    finally:
        for tree, previous, surface, emission in saved:
            tree.links.new(previous, surface)
            tree.nodes.remove(emission)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
parser.add_argument('--size', type=int, choices=(512, 1024, 2048), default=1024)
parser.add_argument('--layout-size', type=int, choices=(512, 1024, 2048),
                    help='Reuse the UV layout of another atlas size')
parser.add_argument('--samples', type=int, default=48)
parser.add_argument('--specular', nargs='?', const='whole', choices=('whole', 'focused'),
                    help='Use UV-baked roughness and metalness on the whole shell or selected work surfaces')
parser.add_argument('--separate-light', action='store_true',
                    help='Retain linear albedo and fixed-light atlases with moving archive geometry excluded from the light bake')
parser.add_argument('--material-roles-only', action='store_true',
                    help='Bake the authored surface roles on the same UV layout without rebaking light')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not 4 <= args.samples <= 64:
    parser.error('--samples must be between 4 and 64')
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
platform = scene.objects['archive_turntable_platform']
scene.objects['Cleanroom scattering volume'].hide_render = True

live, static = [], []
for obj in scene.objects:
    if obj.type not in {'MESH', 'FONT'} or obj.hide_render:
        continue
    (live if is_live_object(obj, platform) else static).append(obj)
assert static and platform in live
assert all(obj.type == 'MESH' for obj in static)

graph = bpy.context.evaluated_depsgraph_get()
shell_parts = []
focused_objects = {'Bevelled worktable profile', 'Inset model handling pad', 'Archive rear panel'}
response_attribute = 'Orbital local reflections'
for obj in static:
    mesh = bpy.data.meshes.new_from_object(
        obj.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph,
    )
    if args.specular == 'focused':
        response = mesh.attributes.new(response_attribute, 'INT', 'FACE')
        response.data.foreach_set('value', np.full(len(mesh.polygons), obj.name in focused_objects, np.int32))
    copy = bpy.data.objects.new(obj.name + ' (bake)', mesh)
    scene.collection.objects.link(copy)
    copy.matrix_world = obj.matrix_world
    shell_parts.append(copy)
for obj in static:
    obj.hide_render = True
    obj.hide_set(True)

select_only(shell_parts)
bpy.ops.object.join()
shell = bpy.context.object
shell.name = 'Orbital baked static surfaces'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
atlas_uv_name = 'Orbital diffuse atlas'
shell.data.uv_layers.active = shell.data.uv_layers.new(name=atlas_uv_name)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
margin = 8 / (args.layout_size or args.size)
bpy.ops.uv.smart_project(island_margin=margin, margin_method='FRACTION')
bpy.ops.object.mode_set(mode='OBJECT')

materials = {slot.material for slot in shell.material_slots}
if args.material_roles_only:
    role_ids = {name: index for index, name in enumerate(
        ('panel', 'navy', 'orange', 'steel', 'graphite'), start=1)}
    role_map = bpy.data.images.new('Orbital surface roles', args.size, args.size, alpha=False)
    role_map.colorspace_settings.name = 'Non-Color'
    colors = {material.name: (role_ids.get(material.name.removeprefix('Orbital '), 0) * 32 / 255, 0, 0, 1)
              for material in materials}
    scene.cycles.samples = 1
    bake_material_input(materials, role_map, 'Base Color', atlas_uv_name, margin=5, colors=colors)
    role_map.filepath_raw = str(output / 'orbital-surface-roles.png')
    role_map.file_format = 'PNG'
    role_map.save()
    sys.exit(0)
irradiance = bpy.data.images.new('Orbital irradiance', args.size, args.size, alpha=False, float_buffer=True)
albedo = bpy.data.images.new('Orbital albedo', args.size, args.size, alpha=False, float_buffer=True)
set_bake_image(materials, irradiance)
scene.cycles.samples = args.samples
scene.cycles.sample_clamp_direct = 6
scene.cycles.sample_clamp_indirect = 2
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
movers = [platform, *platform.children_recursive] if args.separate_light else []
render_states = [(obj, obj.hide_render) for obj in movers]
try:
    for obj in movers:
        obj.hide_render = True
    bpy.context.view_layer.update()
    bpy.ops.object.bake(
        type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'},
        uv_layer=atlas_uv_name, use_clear=True, margin=5,
    )
finally:
    for obj, hidden in render_states:
        obj.hide_render = hidden
    bpy.context.view_layer.update()
bake_material_input(materials, albedo, 'Base Color', atlas_uv_name, margin=5)
light = clean_irradiance(image_pixels(irradiance)[..., :3])
base = np.maximum(image_pixels(albedo)[..., :3], 0)
if args.separate_light:
    save_linear_atlas('Orbital UV albedo', base, output / 'orbital-albedo.exr')
    save_linear_atlas('Orbital static irradiance', light, output / 'orbital-irradiance.exr')
rgb = base * (1.40 * light + .063)
rgb /= 1 + .33 * rgb.max(axis=-1, keepdims=True)
atlas = bpy.data.images.new('Orbital static diffuse', args.size, args.size, alpha=False, float_buffer=True)
pixels = np.ones((args.size, args.size, 4), np.float32)
pixels[:, :, :3] = rgb
atlas.pixels.foreach_set(pixels.ravel())
atlas.filepath_raw = str(output / 'orbital-static-diffuse.jpg')
atlas.file_format = 'JPEG'
atlas.save(quality=92)
atlas.pack()

if args.specular:
    # Faster than the light bake. These evaluate the original material inputs
    # including the surface-class variation in the combined finish.
    image = bpy.data.images.new('Orbital material channel', args.size, args.size,
                                alpha=False, float_buffer=True)
    maps = np.ones((args.size, args.size, 4), np.float32)
    for index, channel in ((1, 'Roughness'), (2, 'Metallic')):
        bake_material_input(materials, image, channel, atlas_uv_name, margin=5)
        maps[:, :, index] = image_pixels(image)[:, :, 0].clip(0, 1)
    # Preserve the full-resolution authored atlas and use one small shared
    # linear texture for roughness and metalness.
    maps = maps.reshape(args.size // 2, 2, args.size // 2, 2, 4).mean(axis=(1, 3))
    orm = bpy.data.images.new('Orbital roughness and metalness', args.size // 2,
                              args.size // 2, alpha=False, float_buffer=True)
    orm.colorspace_settings.name = 'Non-Color'
    orm.pixels.foreach_set(maps.ravel())
    orm.filepath_raw = str(output / 'orbital-material-response.png')
    orm.file_format = 'PNG'
    orm.save()
    orm.pack()

def room_material(name, response=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = atlas
    texture.extension = 'EXTEND'
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = atlas_uv_name
    surface = nodes.new('ShaderNodeOutputMaterial')
    links = material.node_tree.links
    links.new(uv.outputs['UV'], texture.inputs['Vector'])
    if response is None:
        unlit = nodes.new('ShaderNodeBackground')
        links.new(texture.outputs['Color'], unlit.inputs['Color'])
        links.new(unlit.outputs['Background'], surface.inputs['Surface'])
        return material

    shader = nodes.new('ShaderNodeBsdfPrincipled')
    if response == 'focused':
        shader.inputs['Base Color'].default_value = (.018, .019, .023, 1)
        shader.inputs['Specular IOR Level'].default_value = .16
        shader.inputs['Emission Strength'].default_value = 1
    else:
        shader.inputs['Base Color'].default_value = (.070, .075, .084, 1)
        shader.inputs['Emission Strength'].default_value = .96
    texture_channels = nodes.new('ShaderNodeTexImage')
    texture_channels.image = orm
    texture_channels.extension = 'EXTEND'
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(uv.outputs['UV'], texture_channels.inputs['Vector'])
    links.new(texture_channels.outputs['Color'], channels.inputs['Color'])
    links.new(channels.outputs['Green'], shader.inputs['Roughness'])
    links.new(channels.outputs['Blue'], shader.inputs['Metallic'])
    links.new(texture.outputs['Color'], shader.inputs['Emission Color'])
    links.new(shader.outputs[0], surface.inputs['Surface'])
    return material


shell.data.materials.clear()
shell.data.materials.append(room_material('Orbital static diffuse', 'whole' if args.specular == 'whole' else None))
if args.specular == 'focused':
    selected_faces = shell.data.attributes[response_attribute]
    indices = np.empty(len(shell.data.polygons), np.int32)
    selected_faces.data.foreach_get('value', indices)
    if not 0 < indices.sum() < len(indices):
        raise RuntimeError('Expected both fixed-light and responsive faces in the orbital shell')
    shell.data.attributes.remove(selected_faces)
    shell.data.materials.append(room_material('Orbital focused material response', 'focused'))
    shell.data.polygons.foreach_set('material_index', indices)
else:
    for polygon in shell.data.polygons:
        polygon.material_index = 0
for layer in list(shell.data.uv_layers):
    if layer.name != atlas_uv_name:
        shell.data.uv_layers.remove(layer)

select_only([shell, *live])
bpy.ops.export_scene.gltf(
    filepath=str(output / 'matter-workshop-orbital-baked.glb'),
    export_format='GLB', export_animations=False, use_selection=True,
)
