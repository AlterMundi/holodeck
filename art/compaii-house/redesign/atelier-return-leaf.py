"""Export an original, room-local Atelier door in metres with +Z facing the visitor."""

import sys

import bpy


def surface(name, rgb, metal, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = roughness
    return material


def piece(name, center, size, material, bevel=.012):
    x, height, front = center
    width, tall, depth = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -front, height))
    part = bpy.context.object
    part.name = name
    part.dimensions = (width, depth, tall)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    edge = part.modifiers.new('Soft metal and timber edges', 'BEVEL')
    edge.width = bevel
    edge.segments = 2
    bpy.ops.object.modifier_apply(modifier=edge.name)
    part.data.materials.append(material)


bpy.ops.wm.read_factory_settings(use_empty=True)
oak = surface('Smoked oak', (.10, .059, .036), 0, .58)
iron = surface('Blue gunmetal', (.034, .074, .082), .54, .46)
bronze = surface('Warm satin bronze', (.48, .28, .108), .76, .34)
recess = surface('Blackened steel', (.032, .039, .039), .55, .64)

piece('Recess shutter', (0, 1.22, .058), (1.56, 2.24, .108), recess, .024)
piece('Smoked oak leaf', (0, 1.22, .115), (1.44, 2.16, .092), oak, .021)
for center, height in ((.63, .78), (1.69, 1.08)):
    piece('Bronze panel bead', (0, center, .165), (1.142, height, .025), bronze)
    piece('Recessed metal panel', (0, center, .181), (1.108, height-.039, .025), iron)
for x in (-.676, .676):
    piece('Door stile inlay', (x, 1.22, .171), (.024, 1.99, .024), bronze, .004)
piece('Bronze kick plate', (0, .182, .170), (1.27, .118, .024), bronze)
piece('Handle escutcheon', (.592, 1.18, .184), (.089, .23, .035), bronze)
piece('Pull root', (.603, 1.22, .219), (.065, .056, .064), bronze)
piece('Lever', (.536, 1.22, .248), (.178, .043, .047), bronze)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.join()
leaf = bpy.context.object
leaf.name = 'Atelier return door'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

output = sys.argv[sys.argv.index('--') + 1]
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_apply=True)
