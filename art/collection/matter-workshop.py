"""Author the Manipulación de Materia workshop in Blender meters."""
import json
from math import cos, pi, sin
from pathlib import Path
import sys
import struct
from tempfile import TemporaryDirectory
import zlib

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
recess = finish('Dusk window glass', (.065, .129, .16), .42, emission=.12)
etched = finish('Light etched lettering', (.68, .51, .28), .45, .65)
patina = finish('Patinated workshop bronze', (.14, .13, .082), .6, .53)
glazing = finish('Clear archive glazing', (.35, .58, .52), .16)
glazing.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .085


def tile_image(name, colour_at):
    # A small, seamlessly repeating pigment map. Keep it packed in Blender and
    # embedded in the static export so a room visit has no texture requests.
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    size = 128
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            pixels.extend(colour_at(x / size, y / size))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(pixels, 9)) + chunk(b'IEND', b'')
    with TemporaryDirectory() as stage:
        path = Path(stage) / (name + '.png')
        path.write_bytes(png)
        image = bpy.data.images.load(str(path))
        image.pack()
        image.filepath = '//' + path.name
    return image


def pigment(base, amount):
    return tuple(max(0, min(255, round(channel + amount))) for channel in base)


def plaster_pigment(u, v):
    wave = 5 * cos(2*pi*(u + 2*v)) + 2 * sin(2*pi*(5*u - 3*v))
    grain = 1.8 * sin(2*pi*17*u) * cos(2*pi*23*v)
    return pigment((168, 153, 131), wave + grain)


def stone_pigment(u, v):
    bands = sin(2*pi*(u + v)) + .4 * cos(2*pi*(5*u - 3*v))
    joints = min(u, 1-u, v, 1-v)
    if joints < .010:
        return pigment((74, 67, 60), 5 * bands)
    return pigment((134, 120, 103), 8 * bands + (5 if joints < .018 else 0))


def oak_pigment(u, v):
    warp = .045 * sin(2*pi*v) + .06 * sin(2*pi*(3*v - u))
    grain = 4 * sin(2*pi*(17*u + warp)) + 3 * cos(2*pi*(29*u - v + warp))
    latewood = 4 * cos(2*pi*(4*u + .13 * cos(2*pi*v)))
    return pigment((124, 78, 48), grain + latewood)


tex_scale = {plaster.name: .62, stone.name: .84, oak.name: 1.8}
for material, name, texture in [(plaster, 'limewash', plaster_pigment),
                                (stone, 'cut-limestone', stone_pigment),
                                (oak, 'oiled-oak', oak_pigment)]:
    graph = material.node_tree
    image_node = graph.nodes.new('ShaderNodeTexImage')
    image_node.image = tile_image(name, texture)
    graph.links.new(image_node.outputs['Color'], graph.nodes.get('Principled BSDF').inputs['Base Color'])


def fit(obj, name, material, rounded):
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material.name in tex_scale and obj.data.uv_layers.active:
        scale = tex_scale[material.name]
        uv = obj.data.uv_layers.active.data
        for face in obj.data.polygons:
            axis = max(range(3), key=lambda i: abs(face.normal[i]))
            a, b = [(1, 2), (0, 2), (0, 1)][axis]
            for index in face.loop_indices:
                vertex = obj.data.vertices[obj.data.loops[index].vertex_index].co
                uv[index].uv = (vertex[a] * scale, vertex[b] * scale)
    if rounded:
        bevel = obj.modifiers.new('Joinery arris', 'BEVEL')
        bevel.width, bevel.segments = rounded, 2 if rounded>=.04 else 1
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


def lettering(name, text, point, size, turn=0):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body, curve.size, curve.align_x = text, size, 'CENTER'
    curve.materials.append(etched)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.location = point
    obj.rotation_euler.x = pi / 2
    obj.rotation_euler.z = turn


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
for x in (-5.90, 5.90):
    for y in (-4.64, -2.36, .02, 2.43, 4.83):
        box('Rebated wall post', (x, y, 1.98), (.14, .22, 3.78), oak, .018)
    box('Raised wainscot top rail', (x, 0, 1.12), (.19, 11.8, .122), oak, .017)
    box('Continuous wainscot field', (x, 0, .68), (.11, 11.8, .84), green, .012)
    box('Inset bronze skirting line', (x, 0, .29), (.15, 11.8, .025), patina, .005)
for x in (-4.94, 1.94):
    width = 2.12 if x<0 else 8.06
    for z in (1.9, 2.83):
        box('Blackened steel window transom', (x, 5.93, z), (width, .11, .046), steel, .006)
for x in (-4.47, -2.14):
    box('Bronze return aisle edge', (x, 4.23, .102), (.035, 2.89, .006), patina, .003)
box('Return passage oak header', (-3, 5.83, 3.51), (2.20, .12, .31), green, .025)
lettering('Return heading', 'VESTÍBULO', (-3, 5.753, 3.438), .148)
box('Inlaid material-room nameplate', (-4.89, 2.09, 2.60), (.11, 2.24, .31), green, .028)

# Routes run along the front aisle and around all four sides of the table.
for x in (-1.07, 1.07):
    box('Workbench end saddle', (x, .43, .435), (.18, 1.33, .87), oak, .045)
    box('Bench bronze shoe', (x, .43, .075), (.22, 1.39, .14), brass)
box('Drawer of bench tools', (0, .43, .79), (2.24, 1.11, .16), oak)
for x in (-.58, .58):
    box('Inset drawer fascia', (x, -.139, .798), (1.04, .04, .118), green, .012)
    box('Bronze drawer pull', (x, -.169, .798), (.23, .042, .039), brass, .012)
    box('Workbench end join', (x * 1.75, .80, .451), (.15, .07, .78), patina, .018)
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
    box('Recessed display cabinet back', (-5.79, y, 1.2), (.13, 1.80, 2.21), green, .025)
    for dy in (-.875,.875):
        box('Vertical display stile', (-5.67, y+dy, 1.2), (.38, .074, 2.28), oak, .016)
    for level, z in enumerate((.64, 1.34, 2.04)):
        box('Oak shelf', (-5.38, y, z), (.77, 1.78, .085), oak, .022)
        box('Shelf bronze nosing', (-4.997, y, z+.020), (.019, 1.72, .033), patina, .004)
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
platform = cylinder('archive_turntable_platform', (cabinet_x, cabinet_y, 1.01), .624, .055, brass)
pad = cylinder('Inset revolving display pad', (cabinet_x, cabinet_y, 1.044), .605, .018, green)
marks = [box('Revolving archive index', (cabinet_x, cabinet_y + offset, 1.055),
             (.027, .097, .008), brass, .003) for offset in (-.555, .555)]
bpy.context.view_layer.update()
for part in [pad, *marks]:
    world = part.matrix_world.copy()
    part.parent = platform
    part.matrix_world = world
lettering('Archive heading', 'ARCHIVO', (cabinet_x, 2.934, 2.326), .133)
lettering('Collection heading', 'COLECCIÓN', (-4.82, 2.09, 2.54), .157, turn=pi/2)
anchor('worktable-model', 0, .43, 1.058)
anchor('archive-turntable', cabinet_x, cabinet_y, 1.009)
anchor('archive-model', cabinet_x, cabinet_y, 1.061)
anchor('entrance', -3, 4.81, .11)

# Bake static surfaces into one draw batch per material. Keep the authored
# objects editable, including the cabinet glazing and rotating platform.
groups = {}
standalone = []
for obj in scene.objects:
    if obj.type not in {'MESH', 'FONT'}:
        continue
    material = obj.data.materials[0]
    if obj.type != 'MESH' or obj == platform or obj.parent == platform or material == glazing:
        standalone.append(obj)
    else:
        groups.setdefault(material, []).append(obj)

bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
batches = []
for material, sources in groups.items():
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
    copies[0].name = 'Surface · ' + material.name
    batches.append(copies[0])

bpy.ops.object.select_all(action='DESELECT')
for obj in batches + standalone:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output / 'matter-workshop.glb'), export_format='GLB',
                          export_animations=False, use_selection=True, export_extras=False)
for obj in batches:
    bpy.data.objects.remove(obj, do_unlink=True)
for mesh in list(bpy.data.meshes):
    if not mesh.users:
        bpy.data.meshes.remove(mesh)
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
