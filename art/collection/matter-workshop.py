"""Author the Manipulación de Materia workshop in Blender meters."""
import json
from math import pi
from pathlib import Path
import sys

import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index('--') + 1])
output.mkdir(parents=True, exist_ok=True)
if any(output.iterdir()):
    raise ValueError('Choose an empty workshop output')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def finish(name, colour, roughness, metal=0, emission=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*colour, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    for key, value in [('Base Color', (*colour, 1)), ('Roughness', roughness),
                       ('Metallic', metal), ('Emission Strength', emission),
                       ('Emission Color', (*colour, 1))]:
        shader.inputs[key].default_value = value
    return material


plaster = finish('Warm ivory mineral plaster', (.59, .47, .33), .83)
stone = finish('Honed limestone', (.43, .32, .235), .66)
border = finish('Basalt stair and skirting', (.078, .093, .087), .76)
oak = finish('Oiled oak casework', (.255, .119, .057), .50)
green = finish('Deep green tool surface', (.032, .113, .100), .62)
steel = finish('Blued steel fixtures', (.043, .053, .062), .36, .67)
brass = finish('Satin bronze index marks', (.52, .297, .111), .33, .65)
lamp = finish('Warm opal', (1, .77, .49), .31, emission=2)
recess = finish('Cold window recess', (.15, .23, .30), .67)
etched = finish('Light etched lettering', (.72, .54, .30), .45, .19)
glazing = finish('Clear archive glazing', (.35, .58, .52), .16)
glazing.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .085


def fit(obj, name, material, rounded):
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rounded:
        bevel = obj.modifiers.new('Joinery arris', 'BEVEL')
        bevel.width, bevel.segments = rounded, 3
        obj.modifiers.new('Weighted shading', 'WEIGHTED_NORMAL')
    return obj


def box(name, point, size, material, rounded=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point)
    obj = bpy.context.object
    obj.scale = size
    return fit(obj, name, material, rounded)


def cylinder(name, point, radius, depth, material, rounded=.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius, depth=depth, location=point)
    return fit(bpy.context.object, name, material, rounded)


def anchor(name, x, y, z):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = (x, y, z)
    obj.empty_display_type = 'ARROWS'
    obj.empty_display_size = .32


def lettering(name, text, point, size):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body, curve.size, curve.align_x = text, size, 'CENTER'
    curve.materials.append(etched)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.location = point
    obj.rotation_euler.x = pi / 2


box('Full room walking surface', (0, 0, -.10), (12, 12, .4), stone, 0)
for x in (-6.02, 6.02):
    box('Side wall', (x, 0, 2.04), (.25, 12, 4.08), plaster, .035)
    box('Basalt skirting', (x, 0, .14), (.25, 12, .28), border)
for x in (-3.33, 3.33):
    box('Entry wall wings', (x, -6.02, 1.45), (4.75, .25, 2.9), plaster)
box('Entry lintel', (0, -6.02, 3.46), (12, .25, 1.20), plaster)
# Give the return passage a solid dressed surround at the standard north slot.
for center, width in [(-4.94, 2.16), (1.94, 8.16)]:
    box('Rear window base', (center, 6.02, .78), (width, .25, 1.56), plaster)
    box('Broad sill', (center, 5.75, 1.52), (width, .52, .16), stone)
box('Rear beam', (0, 6.02, 3.66), (12, .30, .83), plaster)
for x in (-5.02, -1.87, 0, 2.5, 5.02):
    box('Limestone mullion', (x, 5.98, 2.4), (.20, .36, 1.72), stone, .035)
for center, width in [(-4.94, 2.16), (1.94, 8.16)]:
    box('Cool window backdrop', (center, 6.19, 2.4), (width, .12, 1.70), recess)
for x in (-3.91, -2.09):
    box('Dressed return jamb', (x, 6.01, 1.58), (.24, .30, 3.16), stone, .05)
box('Dressed return lintel', (-3, 6.01, 3.15), (2.08, .30, .27), stone, .04)
box('Return doorway shadow', (-3, 6.18, 1.58), (1.58, .12, 3.12), oak, .02)
for y in (-3.9, -1.7, .5, 2.7, 4.8):
    box('Oak ceiling rib', (0, y, 3.89), (11.42, .19, .23), oak, .027)
box('Plaster ceiling', (0, 0, 4.08), (12, 12, .14), plaster, 0)

# Routes run along the front aisle and around all four sides of the table.
for x in (-1.07, 1.07):
    box('Workbench end saddle', (x, .43, .435), (.18, 1.33, .87), oak, .045)
    box('Bench bronze shoe', (x, .43, .075), (.22, 1.39, .14), brass)
box('Drawer of bench tools', (0, .43, .79), (2.24, 1.11, .16), oak)
box('Bevelled worktable profile', (0, .43, .95), (2.72, 1.58, .17), oak, .056)
box('Inset model handling pad', (0, .43, 1.041), (2.42, 1.30, .025), green, .012)
for x in (-1.36, 1.36):
    box('Worktable alignment strip', (x, .43, .961), (.025, 1.32, .087), brass, .008)
for x in (-1.03, 1.03):
    box('Drop pendant', (x, .43, 3.08), (.056, .056, 1.46), steel, .012)
box('Bench light housing', (0, .43, 2.48), (2.58, .30, .14), steel, .045)
box('Bench light opal', (0, .43, 2.399), (2.45, .22, .034), lamp, .014)

# All display volumes have a separate anchor, so project geometry remains data.
for index, y in enumerate((1.36, -.52)):
    for level, z in enumerate((.64, 1.34, 2.04)):
        box('Oak shelf', (-5.38, y, z), (.77, 1.78, .085), oak, .022)
        for dy in (-.68, .68):
            box('Bronze shelf bracket', (-5.62, y + dy, z - .095), (.41, .048, .17), brass)
        anchor(f'shelf-{index * 3 + level}', -5.25, y, z + .048)

cabinet_x, cabinet_y = 3.35, 3.68
box('Archive oak base', (cabinet_x, cabinet_y, .419), (2.57, 1.40, .84), oak, .053)
box('Archive rear panel', (cabinet_x, 4.32, 1.56), (2.57, .12, 1.58), green)
box('Archive light canopy', (cabinet_x, cabinet_y, 2.37), (2.66, 1.50, .16), oak, .043)
for x in (cabinet_x - 1.242, cabinet_x + 1.242):
    for y in (3.05, 4.31):
        box('Archive glazed cabinet frame', (x, y, 1.586), (.077, .077, 1.49), brass, .012)
for x in (cabinet_x - 1.236, cabinet_x + 1.236):
    box('Archive side glazing', (x, cabinet_y, 1.60), (.009, 1.24, 1.46), glazing, 0)
box('Archive front glazing', (cabinet_x, 3.04, 1.60), (2.42, .009, 1.46), glazing, 0)
box('Cabinet light opal', (cabinet_x, cabinet_y, 2.276), (2.38, .21, .036), lamp, .014)
cylinder('Fixed archive drive housing', (cabinet_x, cabinet_y, .926), .49, .14, steel)
cylinder('Revolving archive display', (cabinet_x, cabinet_y, 1.01), .624, .055, brass)
cylinder('Inset revolving display pad', (cabinet_x, cabinet_y, 1.044), .605, .018, green)
lettering('Archive heading', 'ARCHIVO', (cabinet_x, 2.934, 2.326), .133)
lettering('Room heading', 'MANIPULACIÓN DE MATERIA', (0, 5.835, 3.45), .239)
anchor('worktable-model', 0, .43, 1.058)
anchor('archive-turntable', cabinet_x, cabinet_y, 1.009)
anchor('archive-model', cabinet_x, cabinet_y, 1.061)
anchor('entrance', -3, 4.81, .11)

visual = [obj for obj in scene.objects if obj.type in {'MESH', 'FONT'}]
bpy.ops.object.select_all(action='DESELECT')
for obj in visual:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output / 'matter-workshop.glb'), export_format='GLB',
                          export_animations=False, use_selection=True, export_extras=False)
(output / 'anchors.json').write_text(json.dumps({
    obj.name: [round(obj.location.x, 4), round(obj.location.z, 4), round(-obj.location.y, 4)]
    for obj in scene.objects if obj.type == 'EMPTY'}, indent=2) + '\n')


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


for point, target, colour, power, size in [
    ((-.75, .43, 2.36), (0, .43, .96), (1, .82, .63), 75, 2.0),
    ((3.35, 3.64, 2.26), (3.35, 3.64, .95), (1, .79, .57), 41, 1.6),
    ((-1.5, 4.65, 2.84), (-1, -2, .9), (.61, .77, 1), 335, 4.8),
    ((-2.7, -3.9, 2.91), (-1.1, 1.3, .95), (1, .80, .60), 130, 2.6),
]:
    bpy.ops.object.light_add(type='AREA', location=point)
    light = bpy.context.object
    light.data.energy, light.data.size, light.data.color = power, size, colour
    aim(light, target)
bpy.ops.object.camera_add(location=(-.72, -4.38, 1.68))
camera = bpy.context.object
camera.data.lens = 20
scene.camera = camera
aim(camera, (-.57, 2.79, 1.30))
scene.world = bpy.data.worlds.new('Interior bounce')
scene.world.color = (.10, .10, .10)
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1200, 720
scene.render.resolution_percentage = 100
scene.render.filepath = "//entry.png"
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'matter-workshop.blend'), compress=True)
scene.render.filepath = str(output / 'entry.png')
bpy.ops.render.render(write_still=True)
