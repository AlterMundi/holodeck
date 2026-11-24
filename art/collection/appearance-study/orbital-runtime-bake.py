"""Bake the orbital reference scene's fixed diffuse light for a runtime trial."""
import argparse
from pathlib import Path
import sys

import bpy


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


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
parser.add_argument('--size', type=int, choices=(512, 1024, 2048), default=1024)
parser.add_argument('--samples', type=int, default=24)
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
for obj in static:
    mesh = bpy.data.meshes.new_from_object(
        obj.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph,
    )
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
margin = 4 / args.size
bpy.ops.uv.smart_project(island_margin=margin, margin_method='FRACTION')
bpy.ops.object.mode_set(mode='OBJECT')

atlas = bpy.data.images.new('Orbital static diffuse', args.size, args.size, alpha=False)
for material in {slot.material for slot in shell.material_slots}:
    nodes = material.node_tree.nodes
    target = nodes.new('ShaderNodeTexImage')
    target.image = atlas
    nodes.active = target
    target.select = True
scene.cycles.samples = args.samples
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
bpy.ops.object.bake(
    type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'},
    uv_layer=atlas_uv_name, use_clear=True, margin=3,
)
atlas.filepath_raw = str(output / 'orbital-static-diffuse.jpg')
atlas.file_format = 'JPEG'
atlas.save(quality=92)
atlas.pack()

material = bpy.data.materials.new('Orbital static diffuse')
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
texture = nodes.new('ShaderNodeTexImage')
texture.image = atlas
texture.extension = 'EXTEND'
uv = nodes.new('ShaderNodeUVMap')
uv.uv_map = atlas_uv_name
unlit = nodes.new('ShaderNodeBackground')
surface = nodes.new('ShaderNodeOutputMaterial')
links = material.node_tree.links
links.new(uv.outputs['UV'], texture.inputs['Vector'])
links.new(texture.outputs['Color'], unlit.inputs['Color'])
links.new(unlit.outputs['Background'], surface.inputs['Surface'])
shell.data.materials.clear()
shell.data.materials.append(material)
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
