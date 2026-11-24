"""Build an orbital PBR skin from the unchanged authored Matter Blender layout."""
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

materials, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
specs = {
    # material, roughness, metallic, tiles per meter, normal strength
    'panel': ('bulkhead', .50, .16, .78, .52),
    'navy': ('navy', .61, .04, .92, .39),
    'deck': ('deck', .40, .08, .88, .56),
    'orange': ('orange', .43, .12, 1.20, .25),
    'steel': ('steel', .38, .49, 1.10, .31),
    'graphite': ('graphite', .63, .06, 1.1, .38),
}


def make_material(name, spec):
    albedo, roughness, metallic, _, strength = spec
    result = bpy.data.materials.new('Orbital ' + name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    color = nodes.new('ShaderNodeTexImage')
    color.image = bpy.data.images.load(str((materials/f'{albedo}.jpg').resolve()), check_existing=True)
    color.image.pack()
    links.new(color.outputs['Color'], shader.inputs['Base Color'])
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = bpy.data.images.load(str((materials/f'{albedo}-normal.png').resolve()), check_existing=True)
    texture.image.colorspace_settings.name = 'Non-Color'
    texture.image.pack()
    normal = nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = strength
    links.new(texture.outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    return result


skin = {name: make_material(name, spec) for name, spec in specs.items()}
light_colors = {
    'Warm opal': ((.86, .94, 1.0), 2.8),
    'Dusk window glass': ((.025, .105, .25), .75),
    'Light etched lettering': ((.73, .79, .84), .08),
    'Clear archive glazing': ((.45, .73, .82), 0.),
}
mappings = {
    'Warm ivory mineral plaster': 'panel',
    'Honed limestone': 'steel',
    'Honed limestone floor with fixture bounce': 'deck',
    'Basalt stair and skirting': 'graphite',
    'Oiled oak casework': 'navy',
    'Deep green tool surface': 'navy',
    'Blued steel fixtures': 'graphite',
    'Satin bronze index marks': 'orange',
    'Patinated workshop bronze': 'steel',
}
override = {
    'Bevelled worktable profile': 'panel',
    'Oak ceiling rib': 'orange',
    'Oak shelf': 'panel',
    'Archive light canopy': 'panel',
    'Rebated wall post': 'orange',
    'Raised wainscot top rail': 'orange',
    'Return doorway shadow': 'steel',
    'archive_turntable_platform': 'graphite',
}
for name, (color, emissive) in light_colors.items():
    shader = bpy.data.materials[name].node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = emissive

objects = [obj for obj in scene.objects if obj.type in {'MESH', 'FONT'}]
platform = bpy.data.objects['archive_turntable_platform']
groups, independent, assignment = {}, [], {}
for obj in objects:
    before = obj.data.materials[0]
    key = obj.name.rsplit('.', 1)[0]
    finish = override.get(key, mappings.get(before.name))
    if finish:
        mat = skin[finish]
        obj.data.materials[0] = mat
        if obj.type == 'MESH':
            uvs = obj.data.uv_layers.active.data
            scale = specs[finish][3]
            for face in obj.data.polygons:
                normal = obj.matrix_world.to_3x3() @ face.normal
                axis = max(range(3), key=lambda i: abs(normal[i]))
                a, b = ((1, 2), (0, 2), (0, 1))[axis]
                for index in face.loop_indices:
                    vertex = obj.matrix_world @ obj.data.vertices[obj.data.loops[index].vertex_index].co
                    uvs[index].uv = (vertex[a]*scale, vertex[b]*scale)
    assignment[obj.name] = obj.data.materials[0].name
    if obj.type != 'MESH' or obj == platform or obj.parent == platform or before.name == 'Clear archive glazing':
        independent.append(obj)
    else:
        groups.setdefault(obj.data.materials[0].name, []).append(obj)

rig = [
    ((-.48, .43, 2.36), (0,.43,.96), (.84,.92,1.), 180, 2.0),
    ((3.35,3.64,2.26), (3.35,3.64,.95), (.42,.78,1.), 75, 1.6),
    ((-1.5,4.65,2.84), (-1,-2,.9), (.52,.72,1.), 200, 4.8),
    ((-2.7,-3.9,2.91), (-1.1,1.3,.95), (1.,.82,.56), 130, 2.6),
]
lights = [o for o in scene.objects if o.type == 'LIGHT']
assert len(lights) == len(rig)
for light, (position, target, color, energy, size) in zip(lights, rig):
    light.location = position
    light.rotation_euler = (Vector(target) - light.location).to_track_quat('-Z', 'Y').to_euler()
    light.data.color, light.data.energy, light.data.size = color, energy, size

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str((output/'matter-orbital.blend').resolve()), compress=True)
graph = bpy.context.evaluated_depsgraph_get()
batch = []
for name, sources in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for source in sources:
        mesh = bpy.data.meshes.new_from_object(source.evaluated_get(graph),
                                               preserve_all_data_layers=True, depsgraph=graph)
        copy = bpy.data.objects.new('Export surface', mesh)
        scene.collection.objects.link(copy)
        copy.matrix_world = source.matrix_world
        copy.select_set(True)
        copies.append(copy)
    bpy.context.view_layer.objects.active = copies[0]
    if len(copies) > 1:
        bpy.ops.object.join()
    copies[0].name = 'Surface · '+name
    batch.append(copies[0])
# Bake static contact occlusion into a shared second UV atlas. Live room
# lights, moving models and the glass still use their regular material paths.
bpy.ops.object.select_all(action='DESELECT')
occlusion = bpy.data.images.new('Orbital static occlusion', 1024, 1024, alpha=False)
occlusion.colorspace_settings.name = 'Non-Color'
output_group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
output_group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
for obj in batch:
    obj.select_set(True)
    obj.data.uv_layers.active = obj.data.uv_layers.new(name='Orbital AO')
    source_material = obj.data.materials[0]
    material = source_material.copy()
    material.name = source_material.name + ' static'
    obj.data.materials[0] = material
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'Orbital AO'
    target = nodes.new('ShaderNodeTexImage')
    target.image = occlusion
    target.extension = 'EXTEND'
    links.new(uv.outputs['UV'], target.inputs['Vector'])
    nodes.active = target
    target.select = True
    gltf = nodes.new('ShaderNodeGroup')
    gltf.node_tree = output_group
    links.new(target.outputs['Color'], gltf.inputs['Occlusion'])
bpy.context.view_layer.objects.active = batch[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(island_margin=.004, margin_method='FRACTION')
bpy.ops.object.mode_set(mode='OBJECT')
for obj in batch:
    obj.data.uv_layers[0].active_render = True
originals = [obj for sources in groups.values() for obj in sources]
prior_visibility = [obj.hide_render for obj in originals]
for obj in originals:
    obj.hide_render = True
scene.cycles.samples = 12
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
bpy.ops.object.bake(type='AO', uv_layer='Orbital AO', use_clear=True, margin=4)
for obj, hidden in zip(originals, prior_visibility):
    obj.hide_render = hidden
occlusion.filepath_raw = str((output/'orbital-occlusion.jpg').resolve())
occlusion.file_format = 'JPEG'
occlusion.save(quality=88)
occlusion.pack()

bpy.ops.object.select_all(action='DESELECT')
for obj in batch + independent:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str((output/'matter-workshop-orbital.glb').resolve()),
                          export_format='GLB', export_animations=False,
                          use_selection=True)
for obj in batch:
    bpy.data.objects.remove(obj, do_unlink=True)
(output/'materials.json').write_text(json.dumps(assignment, indent=2)+'\n')

scene.cycles.samples = 24
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.render.resolution_x, scene.render.resolution_y = 1050, 700
scene.render.image_settings.file_format = 'PNG'
camera = scene.camera
camera.data.lens = 18
for name, position, target in (
    ('entry', (-.72,-4.38,1.66), (0,2.79,1.23)),
    ('bench', (-2.73,.60,2.20), (0,.43,.68)),
    ('return', (1.76,4.85,1.66), (-.4,-.9,1.20)),
):
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str((output/f'{name}.png').resolve())
    bpy.ops.render.render(write_still=True)
