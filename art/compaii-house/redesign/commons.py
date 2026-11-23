"""Author the Commons terrace against the existing Holodeck world coordinates."""

import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


arguments = sys.argv[sys.argv.index('--') + 1:]
output = Path(arguments[0]).resolve()
output.mkdir(parents=True, exist_ok=True)
if any(output.iterdir()):
    raise ValueError('Choose an empty, task-owned output directory')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene['layout'] = 'island-archipelago@2'
scene['axes'] = 'Blender (X, Y, Z) to Holodeck (X, Z, -Y)'
scene['alignment'] = 'Arrival and both promenades. Keep the current walking proxies.'


def collection(name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


surface = collection('VIS · Commons and promenade decks')
landscape = collection('VIS · Peripheral planting')
architecture = collection('VIS · North-west loggia and seats')
anchors = collection('ANCHOR · Existing walk and content coordinates')
review = collection('LIGHT GUIDE · Player-height cameras and lighting')
context = collection('REVIEW ONLY · Neighboring world footprints')
visual_groups = (surface, landscape, architecture)


def finish(name, colour, roughness, metal=0, grain=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Emission Color'].default_value = (*colour, 1)
    shader.inputs['Emission Strength'].default_value = emission
    if grain:
        grain_node = nodes.new('ShaderNodeTexNoise')
        grain_node.inputs['Scale'].default_value = 24
        grain_node.inputs['Detail'].default_value = 2
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .24
        bump.inputs['Distance'].default_value = grain
        links.new(grain_node.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return mat


stone = finish('Honed honey limestone', (.52, .37, .23), .76, grain=.022)
plaster = finish('Ivory limewash', (.65, .53, .38), .80, grain=.016)
basalt = finish('Split basalt', (.075, .099, .088), .86, grain=.034)
copper = finish('Weathered copper', (.044, .159, .135), .59, .42, .021)
oak = finish('Dark oiled oak', (.23, .115, .058), .54, grain=.025)
brass = finish('Satin brass', (.61, .355, .107), .32, .66)
lawn = finish('Meadow understorey', (.129, .183, .078), .94, grain=.066)
leaf = finish('Bay leaves', (.133, .245, .081), .85, grain=.045)
light_leaf = finish('Leaf tips', (.216, .301, .106), .82, grain=.041)
amber = finish('Honey lamp glass', (1, .511, .16), .31, emission=2)


def own(obj, group, name, mat):
    obj.name = name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    group.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def mesh(group, name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, (), faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    group.objects.link(obj)
    data.materials.append(mat)
    return obj


def block(group, name, at, dimensions, mat, bevel=.019):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        cut = obj.modifiers.new('Dressed edge', 'BEVEL')
        cut.width, cut.segments = bevel, 2
        obj.modifiers.new('Weighted edges', 'WEIGHTED_NORMAL')
    return own(obj, group, name, mat)


def beam(group, name, start, end, section, mat):
    a, b = Vector(start), Vector(end)
    obj = block(group, name, (a + b) * .5, (*section, (b - a).length), mat, .012)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def round_beam(group, name, start, end, radius, mat):
    a, b = Vector(start), Vector(end)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=(b - a).length,
                                       location=(a + b) * .5)
    obj = bpy.context.object
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return own(obj, group, name, mat)


def radial(group, name, rings, mat, sides):
    verts = [(r * math.cos(i * math.tau / sides), r * math.sin(i * math.tau / sides), z)
             for r, z in rings for i in range(sides)]
    quads = []
    for index in range(len(rings) - 1):
        for i in range(sides):
            lo, hi, j = index * sides, (index + 1) * sides, (i + 1) % sides
            quads.append((lo + i, lo + j, hi + j, hi + i))
    quads.append(tuple(reversed(range(sides))))
    quads.append(tuple(range(len(verts) - sides, len(verts))))
    return mesh(group, name, verts, quads, mat)


# All core planes lie at or just below the existing .10 m walking proxies.
radial(surface, 'Weathered Commons rock skirt', [(1.65, -5.18), (4.75, -4.6),
       (8.86, -2.9), (10.68, -.39), (10.75, -.06), (10.75, .054)], basalt, 72)
radial(surface, 'Meadow cap', [(10.75, .052), (10.75, .071)], lawn, 96)
radial(surface, 'Limestone court', [(5.63, .072), (5.63, .089)], stone, 80)


def strip(name, start, end, width):
    a, b = Vector(start), Vector(end)
    direction = (b - a).normalized()
    cross = Vector((-direction.y, direction.x)) * (width / 2)
    return mesh(surface, name, [(*p, .097) for p in
                (a - cross, b - cross, b + cross, a + cross)], [(0, 1, 2, 3)], plaster)


strip('North approach to the opening bridge', (0, 5.22), (0, 10.45), 2.6)
strip('South approach to the house lane', (0, -5.22), (0, -10.70), 3.12)
strip('East approach to the game garden', (5.25, 0), (10.55, 0), 3.2)
strip('West approach to the gallery', (-10.55, 0), (-5.25, 0), 3.2)

# Flush ashlar joints and a thin compass-like perimeter echo the inlay at the house.
for row in range(-8, 9):
    y = row * .62
    extent = math.sqrt(5.48 ** 2 - y ** 2)
    block(surface, 'Flush ashlar bed joint', (0, y, .092), (2 * extent, .011, .003), basalt, 0)
    for col in range(-5, 6):
        x = (col + (row % 2) * .50) * 1.02
        if math.hypot(x, abs(y) + .62) < 5.46 and row < 8:
            block(surface, 'Flush ashlar head joint', (x, y + .308, .092),
                  (.009, .609, .003), basalt, 0)

for sign_x, sign_y in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
    def arc(radius):
        return [(sign_x * radius * math.cos(t), sign_y * radius * math.sin(t), .094)
                for t in (.34 + i * .895 / 24 for i in range(25))]
    outer, inner = arc(5.51), arc(5.475)
    mesh(surface, 'Brass arc in limestone', [*outer, *inner],
         [(i, i + 1, i + 26, i + 25) if sign_x == sign_y else
          (i + 25, i + 26, i + 1, i) for i in range(24)], brass)


def promenade(left, right):
    length, centre = right - left, (left + right) / 2
    block(surface, 'Basalt promenade fascia', (centre, 0, -.173), (length, 3.2, .354), basalt, .026)
    divisions = math.ceil(length / .49)
    pitch = length / divisions
    for i in range(divisions):
        block(surface, 'Oak promenade decking', (left + (i + .5) * pitch, 0, .046),
              (pitch - .013, 3.2, .108), oak, .009)
    for y in (-1.670, 1.670):
        block(surface, 'Copper gallery rail', (centre, y, .86), (length, .075, .067), copper, .013)
        beam(surface, 'Tensioned lower promenade wire', (left, y, .59), (right, y, .59),
             (.018, .018), brass)
        for x in (left + .17, centre, right - .17):
            block(surface, 'Oak promenade post', (x, y, .515), (.10, .10, .84), oak)
            block(surface, 'Brass joint at railing hand', (x, y, .902), (.125, .125, .046), brass)


promenade(-14.6, -9.8)
promenade(9.8, 12.7)

# Support plans recorded in world coordinates for the existing collision owner.
collision = []


def footprint(name, x, y, width, depth, bottom, top):
    collision.append({'id': name, 'minX': x - width / 2, 'maxX': x + width / 2,
                      'minZ': -y - depth / 2, 'maxZ': -y + depth / 2,
                      'bottom': bottom, 'top': top})


# The single off-axis loggia uses a tapering, sprung rib led by the same
# dark oak/weathered copper as the house. It faces east onto the open court.
profile = [(-9.44, 2.08), (-9.16, 2.51), (-8.51, 2.81), (-7.76, 2.86), (-7.19, 2.61)]
roof_start, roof_end = 2.73, 4.67
roof = mesh(architecture, 'Folded weathered copper loggia roof',
            [(x, y, z) for y in (roof_start, roof_end) for x, z in profile],
            [(i, i + 1, i + 6, i + 5) for i in range(len(profile) - 1)], copper)
roof.modifiers.new('Copper over oak lining', 'SOLIDIFY').thickness = .053
for y in (2.78, 3.19, 3.59, 3.99, 4.39, 4.62):
    for a, b in zip(profile, profile[1:]):
        beam(architecture, 'Smoked oak roof rib', (a[0], y, a[1] - .10),
             (b[0], y, b[1] - .10), (.072, .136), oak)
for x, z in (profile[1], profile[2], profile[3]):
    beam(architecture, 'Standing seam', (x, roof_start, z + .013), (x, roof_end, z + .013),
         (.022, .021), copper)
for y in (2.87, 4.50):
    block(architecture, 'Basalt loggia post shoe', (-9.11, y, .165), (.34, .34, .18), basalt)
    beam(architecture, 'Raked oak loggia post', (-9.11, y, .23), (-9.16, y, 2.49),
         (.18, .20), oak)
    beam(architecture, 'Triangulated rib brace', (-9.12, y, 1.91), (-8.51, y, 2.68),
         (.078, .091), oak)
    block(architecture, 'Brass brace collar', (-9.13, y, 1.92), (.216, .23, .068), brass)
    footprint('loggia-shoe', -9.11, y, .34, .34, .075, 2.53)
block(architecture, 'Honed limestone seat below the roof', (-8.74, 3.68, .261),
      (.50, 1.45, .35), stone)
block(architecture, 'Oak loggia seat', (-8.73, 3.68, .456), (.59, 1.54, .096), oak, .032)
footprint('loggia-seat', -8.73, 3.68, .59, 1.54, .075, .504)
block(architecture, 'Under-eave honey light', (-8.55, 3.67, 2.588), (.056, 1.17, .041), amber)

# Seating and foliage stay peripheral. Use one tree as a landmark on each
# approach rather than filling the court with repeated fixtures.
for x, y in ((-5.13, -6.84), (7.82, -3.86)):
    block(architecture, 'Basalt sitting ledge', (x, y, .253), (1.31, .49, .36), basalt)
    block(architecture, 'Oak cap on ledge', (x, y, .449), (1.41, .59, .091), oak, .028)
    footprint('sitting-ledge', x, y, 1.41, .59, .073, .495)


def crown(name, at, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=at)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler.z = .29 * at[0]
    for face in obj.data.polygons:
        face.use_smooth = True
    return own(obj, landscape, name, mat)


def tree(x, y, scale, flip):
    root = (x, y, .07)
    shoulder = (x + .18 * flip, y + .08, .07 + 1.83 * scale)
    round_beam(landscape, 'Rim bay trunk', root, shoulder, .15 * scale, oak)
    for dx, dy, h, width, mat in ((-.69, .22, 2.58, .99, leaf),
            (0, -.28, 3.18, .88, light_leaf), (.72, .06, 2.71, .96, leaf),
            (.29, .56, 3.45, .79, light_leaf)):
        point = (x + dx * flip * scale, y + dy * scale, h * scale)
        round_beam(landscape, 'Forked bay branch', shoulder, point, .052 * scale, oak)
        crown('Bay leaf mass', point, (width * scale, (.68 + width * .2) * scale, .75 * scale), mat)
    footprint('bay-trunk', x, y, .33 * scale, .33 * scale, .07, 1.80 * scale)


tree(-7.95, 5.55, 1.03, 1)
tree(6.68, -6.95, .90, -1)
for x, y, sx in [(-8.61, 5.31, .55), (-7.01, 6.49, .67), (-6.05, 7.33, .63),
                 (7.36, -6.12, .53), (6.21, -7.68, .61), (5.92, -6.87, .38)]:
    crown('Understorey beyond the paving', (x, y, .25), (sx, .68 * sx, .37 * sx), leaf)


def anchor(name, at):
    empty = bpy.data.objects.new(name, None)
    anchors.objects.link(empty)
    empty.location = at
    empty.empty_display_size = .2


world_anchors = {
    'spawn-grounded': (0, .10, 6), 'shared-court': (0, .10, 0),
    'east-garden-promenade': (9.8, .10, 0), 'west-gallery-promenade': (-9.8, .10, 0),
    'south-house-lane': (0, .10, 9.8), 'north-opening-bridge': (0, .10, -9.8),
}
for name, (x, y, z) in world_anchors.items():
    anchor(name, (x, -z, y))

# Reject any new solid proxy that enters the existing mutable content rectangle
# or one of its through-routes. No inferred coordinates from a screenshot.
clear = [(-7, 7, -6, 6), (-1.6, 1.6, 5.22, 10.75), (-1.7, 1.7, -10.75, -5.22),
         (-14.60, 12.70, -1.6, 1.6)]
for item in collision:
    for x0, x1, z0, z1 in clear:
        assert not (item['minX'] < x1 and x0 < item['maxX'] and
                    item['minZ'] < z1 and z0 < item['maxZ']), item

# Context silhouettes are only used for composition review. The world keeps
# its own housing, destination art and raised/lowered north bridge.
for name, x, y, radius in (('Western gallery', -22, 0, 8),
                           ('Eastern garden', 22, 0, 10),
                           ('Northern overlook', 0, 17, 4.9)):
    terrace = radial(context, name, [(radius * .40, -3.7), (radius, -.10),
                     (radius, .071)], lawn, 48)
    terrace.location = (x, y, 0)
block(context, 'House lane contextual surface', (0, -11.90, .0),
      (3.2, 4.20, .20), plaster, 0)
block(context, 'Housing contextual neighborhood', (0, -19.375, .0),
      (16, 11.25, .20), lawn, 0)
for x in (-4.5, 4.5):
    for y in (-15.5, -18, -20.5, -23):
        block(context, 'Existing parcel silhouette', (x, y, .96), (2.9, 1.37, 1.72), plaster, .025)
        beam(context, 'Roof in distant parcel silhouette', (x - 1.52, y, 1.82),
             (x + 1.52, y, 1.82), (.12, 1.50), copper)

water = finish('Review water, off the walkable level', (.055, .137, .174), .37, .13)
block(context, 'Review sea', (0, 0, -7.2), (400, 400, .08), water, 0)


def camera(name, at, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    obj = bpy.data.objects.new(name, data)
    review.objects.link(obj)
    obj.location = at
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


views = [
    camera('01 · Spawn toward the Commons', (0, -6, 1.77), (-3.60, 4.00, 1.21), 24),
    camera('02 · Commons east to garden approach', (-2.7, -1.7, 1.77), (9.8, .0, 1.30), 25),
    camera('03 · Commons south toward the house lane', (3, 2.25, 1.77), (0, -9.8, 1.10), 27),
]
world = bpy.data.worlds.new('Clear sky over the Commons')
world.use_nodes = True
sky = world.node_tree.nodes.new('ShaderNodeTexSky')
sky.sky_type, sky.sun_elevation, sky.sun_rotation = 'MULTIPLE_SCATTERING', .33, math.radians(195)
sky.sun_disc = False
world.node_tree.links.new(sky.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .17
scene.world = world
sun = bpy.data.lights.new('Late afternoon sunlight', 'SUN')
sun.energy, sun.angle, sun.color = 2.25, .09, (1, .833, .653)
sun_obj = bpy.data.objects.new(sun.name, sun)
review.objects.link(sun_obj)
sun_obj.rotation_euler = Vector((.70, .21, -.69)).to_track_quat('-Z', 'Y').to_euler()
under_eave = bpy.data.lights.new('Soft spill under the loggia', 'AREA')
under_eave.energy, under_eave.size, under_eave.color = 12, 1.15, (1, .59, .31)
eave_obj = bpy.data.objects.new(under_eave.name, under_eave)
review.objects.link(eave_obj)
eave_obj.location = (-8.55, 3.67, 2.55)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'AgX'
scene.render.resolution_x, scene.render.resolution_y = 1050, 660
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 91
scene.camera = views[0]
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'holodeck-commons.blend'), compress=True)

# glTF keeps surface PBR values and authored geometry. Blender's review-only
# graph bump and lights are deliberately absent from the runtime asset.
asset = output / 'holodeck-commons.glb'
evaluated = bpy.context.evaluated_depsgraph_get()
parts = []
for group in visual_groups:
    for source in group.objects:
        obj = source.evaluated_get(evaluated)
        data = bpy.data.meshes.new_from_object(obj)
        part = bpy.data.objects.new(source.name, data)
        scene.collection.objects.link(part)
        part.matrix_world = obj.matrix_world
        parts.append(part)
bpy.ops.object.select_all(action='DESELECT')
for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
merged = bpy.context.object
merged.name = 'Holodeck Commons visual mesh'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True,
                          export_texcoords=False, export_lights=False, export_materials='EXPORT')
bpy.data.objects.remove(merged, do_unlink=True)
with asset.open('rb') as contents:
    magic, version, total, metadata_bytes, chunk = struct.unpack('<IIIII', contents.read(20))
    assert magic == 0x46546C67 and version == 2 and chunk == 0x4E4F534A
    gltf = json.loads(contents.read(metadata_bytes))
    assert total == asset.stat().st_size and not gltf.get('images') and not gltf.get('extensionsRequired')
primitives = [primitive for part in gltf['meshes'] for primitive in part['primitives']]
triangles = sum(gltf['accessors'][primitive['indices']]['count'] // 3 for primitive in primitives)
assert len(gltf['nodes']) == 1 and len(primitives) <= 10
assert total < 2.4 * 1024 * 1024 and triangles < 24000, (total, triangles)
(output / 'commons.json').write_text(json.dumps({
    'layout': scene['layout'], 'nodes': len(gltf['nodes']), 'drawBatches': len(primitives),
    'bytes': total, 'triangles': triangles,
    'registration': {'x': 0, 'y': 0, 'z': 0, 'scale': [1, 1, 1]},
    'arrivalRadius': 10.75, 'floorTop': .1, 'openFootprints': clear,
    'worldAnchors': world_anchors, 'optionalCollisionFootprints': collision,
    'collision': 'Current walking proxy is authoritative. Footprints are proposed, not active.',
}, indent=2) + '\n')

for view, name in zip(views, ('commons-spawn', 'commons-garden-approach', 'commons-house-approach')):
    scene.camera = view
    scene.render.filepath = str(output / (name + '.jpg'))
    bpy.ops.render.render(write_still=True)
assert sum(p.stat().st_size for p in output.iterdir()) <= 12 * 1024 * 1024
