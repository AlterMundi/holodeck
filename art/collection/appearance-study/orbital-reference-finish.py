"""Match lighting and secondary construction to the orbital reference in Blender."""
import argparse
import json
from math import ceil
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
parser.add_argument('--frames', choices=('none', 'entry', 'entry,bench,return'), default='entry,bench,return')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
collection = bpy.data.collections.new('Orbital reference detailing')
scene.collection.children.link(collection)


def place(obj):
    for group in list(obj.users_collection):
        group.objects.unlink(obj)
    collection.objects.link(obj)


def finish(name, color, roughness, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return mat


def box(name, xyz, dimensions, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    node = bpy.context.object
    node.name, node.scale = name, dimensions
    node.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = node.modifiers.new('Machined edge', 'BEVEL')
        modifier.width, modifier.segments = bevel, 2
        node.modifiers.new('Weighted corners', 'WEIGHTED_NORMAL')
    place(node)
    return node


def screw(xyz, axis='y', material=None, radius=.013):
    rotation = (Vector((0, 1, 0)) if axis == 'y' else Vector((1, 0, 0))).to_track_quat('Z', 'Y')
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=.008, location=xyz)
    node = bpy.context.object
    node.name = 'Recessed fastener'
    node.rotation_euler = rotation.to_euler()
    node.data.materials.append(material)
    place(node)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, position, target, color, power, width, height):
    light = bpy.data.lights.new(name, 'AREA')
    light.shape, light.size, light.size_y = 'RECTANGLE', width, height
    light.color, light.energy = color, power
    obj = bpy.data.objects.new(name, light)
    collection.objects.link(obj)
    obj.location = position
    aim(obj, target)


# The authored shell, tabletop, shelves and interactive archive remain the
# structural reference. Secondary parts belong to their visual dressing.
steel = finish('Anodized brushed frames', (.37, .41, .45), .28, .62)
graphite = finish('Black anodized fasteners', (.035, .043, .055), .36, .72)
navy = finish('Blue graphite rails', (.030, .064, .107), .40, .45)
cast = finish('Orbital passage dark alloy', (.037, .064, .100), .36, .67)
rubber = finish('Pressure gasket', (.018, .023, .025), .55)
cyan = finish('Recess strip cyan', (.065, .25, .71), .24, emission=1.30)
amber = finish('Indicator amber', (1., .34, .065), .26, emission=1.45)


# These pieces close the original blockout's non-traversable positive-Z wall.
# They are drawn separately from the existing UV bake in the packaged room.
infill = Path(__file__).resolve().parents[1] / 'orbital-entry-infill.json'
for part in json.loads(infill.read_text()):
    x, y, z = part['center']
    width, height, depth = part['size']
    # MML's cube material interprets these components in linear light.
    linear_color = [int(part['color'][index:index+2], 16) / 255 for index in (1, 3, 5)]
    material = finish(part['id'], linear_color, .62)
    piece = box(part['id'], (x, -z, y), (width, depth, height), material)
    piece['holodeck_runtime_overlay'] = True

for name in ('panel', 'deck', 'steel', 'navy', 'orange'):
    material = bpy.data.materials['Orbital ' + name]
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = {'panel':.31, 'deck':.33, 'steel':.27, 'navy':.46, 'orange':.36}[name]
    shader.inputs['Coat Weight'].default_value = {'panel':.14, 'deck':.12, 'steel':.18, 'navy':.08, 'orange':.16}[name]
    shader.inputs['Coat Roughness'].default_value = .32

# Keep apertures at the modeled locations and put a separate mechanical
# bay behind them. The panes catch reflections from the laboratory.
for node in list(scene.objects):
    if node.name.startswith('Cool window backdrop'):
        node.hide_render = True
for x, width in ((-4.94, 2.12), (1.94, 8.06)):
    box('Mechanical service bay back', (x, 7.33, 2.42), (width, .12, 1.75), cast, .015)
    box('Mechanical service bay ceiling', (x, 6.64, 3.26), (width, 1.42, .10), cast)
    box('Lower service deck', (x, 6.62, 1.57), (width, 1.42, .10), graphite)
    for z in (1.82, 2.07, 2.67, 2.93):
        box('Paired conduit run', (x, 7.04, z), (width, .10, .048), steel, .017)
    for index in range(ceil(width*.87/.52)):
        xx = x - width*.43 + index*.52
        box('Conduit support', (xx, 6.89, 2.38), (.047, .14, 1.56), navy, .008)
    for z in (1.72, 3.10):
        box('Bay indicator strip', (x, 7.01, z), (width*.85, .014, .020), cyan, .005)
    area('Reflected service bay light', (x,6.36,3.10), (x,7.15,2.04), (.25,.48,1.), 32 if x<0 else 91, width*.78, .15)

glass = finish('Clear laminate, service windows', (.65, .82, .99), .125)
glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .98
glass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.44
for x, width in ((-4.94, 2.11), (1.94, 8.05)):
    box('Inner window gasket', (x, 5.93, 3.19), (width, .075, .037), rubber, .010)
    box('Inner window gasket', (x, 5.93, 1.62), (width, .075, .037), rubber, .010)
    for edge in (-1, 1):
        box('Glazing edge cap', (x + edge*(width/2-.015), 5.928, 2.414),
            (.030, .073, 1.508), steel, .006)
    box('Service window glass', (x, 6.05, 2.407), (width, .012, 1.54), glass)

# True glazing and the fixture's source dimensions affect specular cues.
archive_glass = bpy.data.materials['Clear archive glazing'].node_tree.nodes.get('Principled BSDF')
archive_glass.inputs['Base Color'].default_value = (.63, .84, .92, 1)
archive_glass.inputs['Alpha'].default_value = 1.0
archive_glass.inputs['Transmission Weight'].default_value = .99
archive_glass.inputs['Roughness'].default_value = .14
archive_glass.inputs['IOR'].default_value = 1.42

for x in (-1.18, 1.18):
    for y in (-.247, 1.105):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.012, depth=.004, location=(x,y,1.034))
        part = bpy.context.object
        part.name = 'Fastener in workbench rim'
        part.data.materials.append(graphite)
        place(part)
for x in (-.58, .58):
    box('Indicator in recessed drawer pull', (x, -.192, .8), (.145, .005, .009), amber, .002)
for x in (2.21, 4.49):
    for z in (.16, .68):
        screw((x,2.977,z), material=steel)
for x in (2.79, 3.92):
    for z in (.32, .36, .40, .44, .48):
        box('Archive ventilation recess', (x, 2.981, z), (.49, .012, .014), graphite, .004)
for x in (-5.83, 5.83):
    for y in (-4.62, -2.33, .03, 2.44, 4.82):
        for z in (1.30, 3.59):
            screw((x + (.002 if x<0 else -.002), y, z), axis='x', material=graphite)
for x in (-3.84, -2.16):
    for z in (.47, 1.77, 2.77):
        screw((x, 5.812, z), material=graphite)
for x, z in ((-3.58,.48),(-2.42,.48),(-3.58,2.54),(-2.42,2.54)):
    screw((x,6.116,z), material=graphite)

for light in [obj for obj in scene.objects if obj.type == 'LIGHT' and obj not in collection.objects[:]]:
    bpy.data.objects.remove(light, do_unlink=True)
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (.16, .19, .24, 1.)
background.inputs['Strength'].default_value = .11

# Source shape, distance, color and occluders produce the reference's light.
area('Worktable pendant emission', (0,.43,2.353),(0,.43,.1),(.92,.97,1.), 136,2.38,.20)
area('Archive canopy emission', (3.35,3.69,2.225),(3.35,3.55,.82),(.71,.90,1.), 92,2.35,.22)
area('Window bounce', (.1,5.52,2.68),(.1,.50,.2),(.52,.71,1.),72,8.6,.88)
area('Warm spill from the entrance', (-.63,-5.24,3.26),(-.12,.1,.84),(1.,.81,.62),260,4.10,2.80)
area('Ceiling soft return', (2.13,-1.19,3.63),(.93,1.35,.25),(.97,.94,.86),127,3.7,1.70)
area('Workshop side fill', (-4.91,.49,2.72),(-.54,1.24,.69),(.76,.87,1.),45,2.8,.85)

# Weak aerial perspective in the chamber. Visible highlight diffusion is
# added in the compositor, after real indirect illumination and reflections.
fog = bpy.data.materials.new('Orbital cleanroom atmosphere')
fog.use_nodes = True
tree = fog.node_tree
volume = tree.nodes.new('ShaderNodeVolumeScatter')
volume.inputs['Color'].default_value = (.72,.85,1.,1.)
volume.inputs['Density'].default_value = .0015
volume.inputs['Anisotropy'].default_value = .28
tree.nodes.remove(tree.nodes.get('Principled BSDF'))
tree.links.new(volume.outputs[0],tree.nodes.get('Material Output').inputs['Volume'])
box('Cleanroom scattering volume', (0,0,2.06),(11.94,11.86,3.91),fog)

comp = bpy.data.node_groups.new('Optical highlight diffusion', 'CompositorNodeTree')
comp.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
scene.compositing_node_group = comp
layers = comp.nodes.new('CompositorNodeRLayers')
glare = comp.nodes.new('CompositorNodeGlare')
glare.inputs["Type"].default_value = "Fog Glow"
glare.inputs["Quality"].default_value = "High"
for name, value in {'Threshold':2.7, 'Strength':.32, 'Size':.65}.items():
    if name in glare.inputs:
        glare.inputs[name].default_value = value
output = comp.nodes.new('NodeGroupOutput')
comp.links.new(layers.outputs['Image'], glare.inputs['Image'])
comp.links.new(glare.outputs['Image'], output.inputs['Image'])

scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.adaptive_threshold = .045
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 7
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = .32
scene.render.threads_mode = 'FIXED'
scene.render.threads = 10
scene.render.resolution_x, scene.render.resolution_y = 1152, 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
camera = scene.camera
camera.data.lens = 18
poses = {
    'entry': ((-.72,-4.38,1.66), (0,2.79,1.23)),
    'bench': ((-2.73,.60,2.20), (0,.43,.68)),
    'return': ((1.76,4.85,1.66), (-.4,-.9,1.20)),
}
camera.location, target = poses['entry']
aim(camera,target)
scene.render.filepath = '//entry.png'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'matter-orbital-reference.blend'), compress=True)
for frame in ([] if args.frames == 'none' else args.frames.split(',')):
    camera.location, target = poses[frame]
    aim(camera,target)
    scene.render.filepath = str(out/f'{frame}.png')
    bpy.ops.render.render(write_still=True)
