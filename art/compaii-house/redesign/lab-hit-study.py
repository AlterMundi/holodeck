"""Draft spatial composition inspired by Harmonic Information Theory: Foundations.

Visual reference: Fernández Méndez and Echániz, AlterMundi, 2026,
https://hit.altermundi.net/tapa2.jpg. The geometry and curves here are original.
Run in Blender background mode with an output directory after `--`.
This standalone scene makes no changes to the installed Atelier cells.
"""

from math import atan2, cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

destination = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, linear, *, metal=0, roughness=.45, emission=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Emission Color'].default_value = (*linear, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return result


obsidian = material('Obsidian', (.025, .047, .052), metal=.16, roughness=.61)
blue_iron = material('Blue-black iron', (.025, .081, .089), metal=.42)
tide = material('Turquoise luminous trace', (.022, .84, .73), emission=3.4)
ivory = material('Ivory', (.89, .96, .90), emission=.64)


def trace(name, points, thickness, finish, *, loop=False):
    drawing = bpy.data.curves.new(name, 'CURVE')
    drawing.dimensions = '3D'
    drawing.bevel_depth = thickness
    drawing.bevel_resolution = 2
    line = drawing.splines.new('POLY')
    line.points.add(len(points) - 1)
    for vertex, coordinate in zip(line.points, points):
        vertex.co = (*coordinate, 1)
    line.use_cyclic_u = loop
    obj = bpy.data.objects.new(name, drawing)
    bpy.context.collection.objects.link(obj)
    drawing.materials.append(finish)


def ellipsoid(name, center, radius, finish):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=center)
    obj = bpy.context.object
    obj.name, obj.scale = name, radius
    obj.data.materials.append(finish)
    for face in obj.data.polygons:
        face.use_smooth = True


angles = [2 * pi * i / 96 for i in range(96)]
outline = [(5.80*cos(t)*(1+.025*cos(3*t)), .15+5.50*sin(t)*(1+.026*sin(4*t))) for t in angles]
count = len(outline)
island = bpy.data.meshes.new('Flat island with an irregular edge')
island.from_pydata([(*point, z) for z in (0, -.34) for point in outline], [],
    [tuple(range(count)), tuple(reversed(range(count, 2*count))), *[
        (i, i+count, (i+1)%count+count, (i+1)%count) for i in range(count)]])
island.update()
deck = bpy.data.objects.new(island.name, island)
island.materials.append(obsidian)
bpy.context.collection.objects.link(deck)
rim = deck.modifiers.new('Eased rim', 'BEVEL')
rim.width, rim.segments = .09, 4
trace('Arrival follows a continuous edge',
      [(x*.96, .15+(y-.15)*.96, .016) for x, y in outline], .012, tide, loop=True)

ellipsoid('Central Beacon position', (-.44, 1.9, .20), (1.63, 1.63, .26), blue_iron)
trace('Interference suspended above the Beacon',
      [(-.44+1.42*sin(2*t), 1.9+.80*sin(3*t+pi/12), 1.83+1.22*cos(t))
       for t in angles], .026, tide, loop=True)

for name, x, y, rotation in [('Spatializer', 3.75, -.62, -.24), ('Weaver', -3.72, 2.53, .27),
                             ('Shaper', 3.03, 3.12, .63), ('Guitar', -3.10, -1.54, -.43)]:
    ellipsoid(name+' pedestal', (x, y, .38), (.47, .40, .39), obsidian)
    ellipsoid(name+' surface', (x, y, .79), (1.02, .66, .15), blue_iron)
    bpy.context.object.rotation_euler.z = rotation
    trace(name+' edge', [(x+.91*cos(t)*cos(rotation)-.54*sin(t)*sin(rotation),
                          y+.91*cos(t)*sin(rotation)+.54*sin(t)*cos(rotation), .86)
                         for t in angles], .013, tide, loop=True)
    bpy.ops.object.text_add(location=(x, y-.68, 1.04), rotation=(pi/2, 0, atan2(7.6-x, 12+y)))
    obj = bpy.context.object
    obj.data.body, obj.data.size, obj.data.align_x = name, .245, 'CENTER'
    obj.data.materials.append(ivory)

for band in range(4):
    trace('Suspended arch '+str(band + 1),
          [(4.98*cos(t+.15*band), 3.82*sin(t)+.43*band,
            3.60+.30*band+.81*sin(t*2+.42*band)) for t in angles],
          .043 if band == 0 else .026, blue_iron, loop=True)
trace('Upper field',
      [(4.95*cos(t+.15), 3.83*sin(t)+.43, 3.94+.81*sin(t*2+.42)) for t in angles],
      .016, tide, loop=True)

scene = bpy.context.scene
world = scene.world = bpy.data.worlds.new('Black field')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.012, .022, .025, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .4
for name, location, color, energy, size in [
    ('Arrival key', (0, -5, 6), (.76, .91, 1), 1700, 5),
    ('Turquoise release', (-4, 4, 4), (.13, .83, .72), 1600, 5),
]:
    lamp = bpy.data.lights.new(name, type='AREA')
    lamp.energy, lamp.color, lamp.shape, lamp.size = energy, color, 'DISK', size
    obj = bpy.data.objects.new(name, lamp)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, .5))-obj.location).to_track_quat('-Z','Y').to_euler()

bpy.ops.object.camera_add(location=(7.6, -12, 8.0))
scene.camera = bpy.context.object
scene.camera.rotation_euler = (Vector((0, .55, 1.0))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.lens = 37
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1000, 650
scene.render.resolution_percentage = 100
scene.render.filepath = str(destination/'hit-lab-study.png')
bpy.ops.wm.save_as_mainfile(filepath=str(destination/'hit-lab-study.blend'), compress=True)
bpy.ops.render.render(write_still=True)
