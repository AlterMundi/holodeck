"""Build and export a connected, walkable valley in authored meter coordinates."""
import argparse
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
output = parser.parse_args(sys.argv[sys.argv.index('--') + 1:]).output.resolve()
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(339)
scene = bpy.context.scene


def smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def mix(a, b, factor):
    return tuple(x + (y - x) * factor for x, y in zip(a, b))


def bump(x, z, cx, cz, width, length):
    return math.exp(-((x - cx) / width) ** 2 - ((z - cz) / length) ** 2)


def pool_distance(x, z):
    return math.hypot((x + 22) / 12, (z + 8) / 10)


def height(x, z):
    distance = math.hypot(max(abs(x) - 8, 0), max(0, -z - 7, z - 26))
    rough = (.55 * math.sin(x * .27 + z * .14) + .32 * math.cos(z * .45 - x * .18))
    rolling = (
        7.6 * bump(x, z, 32, -21, 14, 13) +
        6.4 * bump(x, z, -37, 24, 16, 14) +
        5.1 * bump(x, z, 18, 40, 22, 13) +
        3.8 * bump(x, z, -39, -34, 23, 16)
    )
    y = .1 + smooth(distance / 7) * (rolling + rough)
    radial = pool_distance(x, z)
    if radial < 1.24:
        shore = .04 - 2.45 * (1 - smooth(radial))
        y = y + (shore - y) * (1 - smooth((radial - 1) / .24))
    # Lower section of the approach meets the cave portal without a step.
    path = bump(x, z, 26, -7, 3, 4)
    return y + (.13 - y) * path * .95


def colored_material(name, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    shader = tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    colors = tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Surface color'
    tree.links.new(colors.outputs['Color'], shader.inputs['Base Color'])
    return material


def textured_grain(obj, span, seed, stone=False):
    # A repeating image carries small-scale detail while vertex color handles
    # paths, terrain zones and cave darkness. Use compatible glTF multiply.
    size = 256
    image_name = 'Sandstone grain' if stone else 'Meadow grain'
    image = bpy.data.images.get(image_name)
    if image is None:
        generator = np.random.default_rng(seed)
        coords = np.mgrid[:size, :size] / size

        def seamless_noise(rows, columns):
            y, x = coords * np.asarray([rows, columns])[:, None, None]
            i, j = y.astype(int), x.astype(int)
            fy, fx = y - i, x - j
            fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
            grid = generator.uniform(-1, 1, (rows, columns))
            top = grid[i, j] * (1 - fx) + grid[i, (j + 1) % columns] * fx
            bottom = grid[(i + 1) % rows, j] * (1 - fx) + grid[(i + 1) % rows, (j + 1) % columns] * fx
            return top * (1 - fy) + bottom * fy

        detail = .82 + .09 * seamless_noise(5, 3 if stone else 7)
        detail += .08 * seamless_noise(19, 7 if stone else 17)
        detail += .052 * seamless_noise(47, 23 if stone else 43)
        detail += .042 * generator.uniform(-1, 1, (size, size))
        color = np.ones((size, size, 4), np.float32)
        color[:, :, :3] = np.clip(detail, 0, 1)[:, :, None]
        image = bpy.data.images.new(image_name, size, size, alpha=False)
        image.pixels.foreach_set(color.ravel())
        image.pack()
    mesh = obj.data
    uv = mesh.uv_layers.new(name='Material coordinates')
    for polygon in mesh.polygons:
        axis = max(range(3), key=lambda index: abs(polygon.normal[index]))
        first, second = ((1, 2), (0, 2), (0, 1))[axis]
        for index in polygon.loop_indices:
            point = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = (point[first] / span, point[second] / span)
    material = mesh.materials[0]
    if material.users > 1:
        material = material.copy()
        mesh.materials[0] = material
    tree = material.node_tree
    shader = tree.nodes.get('Principled BSDF')
    color_source = shader.inputs['Base Color'].links[0].from_socket
    texture = tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    multiply = tree.nodes.new('ShaderNodeMix')
    multiply.data_type = 'RGBA'
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    tree.links.new(color_source, multiply.inputs[6])
    tree.links.new(texture.outputs['Color'], multiply.inputs[7])
    tree.links.new(multiply.outputs[2], shader.inputs['Base Color'])


def mesh_object(name, vertices, faces, colors, material, smooth_shading=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    if colors:
        layer = mesh.color_attributes.new(name='Surface color', type='FLOAT_COLOR', domain='POINT')
        layer.data.foreach_set('color', [channel for color in colors for channel in (*color, 1)])
    if smooth_shading:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


land = colored_material('Meadow, eroded sandstone and moss', .88)
surface, surface_colors, faces = [], [], []
step, radius = 1, 54
stride = radius * 2 // step + 1
for z in range(-radius, radius + 1, step):
    for x in range(-radius, radius + 1, step):
        y = height(x, z)
        slope = math.hypot(height(x + .3, z) - height(x - .3, z),
                           height(x, z + .3) - height(x, z - .3)) / .6
        grain = .5 + .24 * math.sin(x * 1.36 + math.sin(z)) + .17 * math.sin(z * 2.41 + x)
        base = mix((.075, .142, .066), (.235, .277, .105), grain)
        stone = mix((.205, .164, .111), (.35, .295, .211), grain)
        base = mix(base, stone, smooth((slope - .29) / .61))
        base = mix(base, (.29, .229, .143), (1 - smooth((abs(x) - .9) / 1.15)) *
                   smooth((z + 1) / 3) * (1 - smooth((z - 18) / 5)))
        base = mix(base, (.266, .227, .148), (1 - smooth(abs(z - 15.5) / 1.32)) *
                   smooth((x + 6) / 1.5) * (1 - smooth((x + 1) / 1.55)))
        base = mix(base, (.30, .253, .145), (1 - smooth((abs(z + 3) - .4) / 1.1)) *
                   smooth((x - 2) / 4) * (1 - smooth((x - 25) / 5)))
        base = mix(base, (.125, .194, .132), 1 - smooth((pool_distance(x, z) - .84) / .24))
        surface.append((x, y, z))
        surface_colors.append(base)
for row in range(stride - 1):
    for column in range(stride - 1):
        x, z = column - radius, row - radius
        if 23 <= x < 29 and -12 <= z < -7:
            continue
        i = row * stride + column
        faces.extend(((i, i + stride, i + 1), (i + 1, i + stride, i + stride + 1)))
ground = mesh_object('Connected valley and pond bed', surface, faces, surface_colors, land, True)

# Continue the public approach into a roofed, curved passage below the hill.
# The entrance cut removes only the upper triangles over the outside ramp.
rock = colored_material('Cave sandstone', .95)
sections = [(26, -12, -.55, 3, 2.4), (26, -13, -.65, 2.75, 2.55),
            (27, -17, -.91, 2.45, 2.6),
            (28, -21, -.90, 2.65, 2.7), (27, -24, -.78, 2.3, 2.5)]
vertices, cave_faces, cave_colors = [], [], []
for i, (x, z, floor, width, roof) in enumerate(sections):
    ring = [(-width, 0), (width, 0), (width * .96, roof * .60),
            (width * .60, roof * .94), (.13, roof), (-width * .58, roof * .9),
            (-width * .94, roof * .58)]
    for j, (dx, dy) in enumerate(ring):
        vertices.append((x + dx, floor + dy, z))
        shade = (.66 if i < 2 else .32) + rng.uniform(-.04, .10)
        cave_colors.append(tuple(channel * shade for channel in (.54, .40, .26)))
    if i:
        for j in range(len(ring)):
            a = (i - 1) * len(ring)
            b = i * len(ring)
            n = (j + 1) % len(ring)
            cave_faces.append((a + j, a + n, b + n, b + j))
    if i == len(sections) - 1:
        cave_faces.append(tuple(reversed(range(i * len(ring), (i + 1) * len(ring)))))
cave = mesh_object('Walkable cave floor, walls and roof', vertices, cave_faces, cave_colors, rock)
# Extend the entrance floor across the full terrain cut and flank its sides.
ramp_vertices, ramp_faces = [], []
for x in range(23, 30):
    ramp_vertices.extend([(x, height(x, -7), -7), (x, -.55, -12)])
for x in range(6):
    edge = x * 2
    ramp_faces.append((edge, edge + 2, edge + 3, edge + 1))
for x, side in ((23, 0), (29, 12)):
    for z in range(-7, -13, -1):
        ramp_vertices.append((x, height(x, z), z))
    indices = tuple(range(len(ramp_vertices) - 6, len(ramp_vertices)))
    face = (*indices, side + 1)
    ramp_faces.append(face if x == 23 else face[::-1])
ramp = mesh_object('Recessed entrance apron', ramp_vertices, ramp_faces,
                   [(.18, .132, .075)] * len(ramp_vertices), rock)

water = bpy.data.materials.new('Sheltered pond')
water.use_nodes = True
shader = water.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (.046, .195, .205, 1)
shader.inputs['Roughness'].default_value = .28
shader.inputs['Metallic'].default_value = .33
shader.inputs['Coat Weight'].default_value = .25
count = 96
water_vertices = [(-22, -.34, -8)] + [
    (-22 + 12 * math.cos(i * math.tau / count), -.34, -8 + 10 * math.sin(i * math.tau / count))
    for i in range(count)
]
pond = mesh_object('Teal pond surface', water_vertices,
                   [(0, (i + 1) % count + 1, i + 1) for i in range(count)], None, water)

tree_vertices, tree_faces, tree_colors = [], [], []
for _ in range(305):
    x, z = rng.uniform(-49, 49), rng.uniform(-49, 49)
    if ((abs(x) < 9 and -7 < z < 26) or pool_distance(x, z) < 1.10 or
        (1 < x < 30 and -6 < z < 0) or (21 < x < 32 and -15 < z < -3)):
        continue
    y = height(x, z)
    if y < -.14:
        continue
    size = rng.uniform(1.5, 4.8)
    sides, turn = 7, rng.random() * math.tau
    for base, width, top, palette in [
        (0, .037, .67, (.184, .106, .057)),
        (.24, .25, .71, (.042, .135, .085)),
        (.44, .195, .89, (.059, .171, .105)),
        (.63, .132, 1.0, (.076, .193, .113)),
    ]:
        start = len(tree_vertices)
        for j in range(sides):
            theta = turn + j * math.tau / sides
            tree_vertices.append((x + math.cos(theta) * width * size, y + base * size,
                                  z + math.sin(theta) * width * size))
            tree_colors.append(tuple(c * rng.uniform(.8, 1.2) for c in palette))
        tree_vertices.append((x + .048 * size, y + top * size, z - .025 * size))
        tree_colors.append(tuple(c * 1.2 for c in palette))
        for j in range(sides):
            tree_faces.append((start + j, start + sides, start + (j + 1) % sides))
forest = mesh_object('Pine groups on the ridgelines', tree_vertices, tree_faces, tree_colors,
                     colored_material('Pine foliage and bark', .91))

textured_grain(ground, 3.1, 340)
textured_grain(cave, 2.2, 341, stone=True)
textured_grain(ramp, 2.2, 341, stone=True)

bpy.ops.wm.save_as_mainfile(filepath=str(output / 'continuous-valley.blend'), compress=True)
for name, objects in [('continuous-valley', (ground, cave, ramp)), ('valley-water-and-pines', (pond, forest))]:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(output / (name + '.glb')), export_format='GLB',
                              use_selection=True, export_animations=False)
