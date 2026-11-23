"""Bake the authored cells into self-contained core glTF for runtime review."""
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

CELLS = {
    'garden': ('VIS · Garden court', (0, 0, 0)),
    'house': ('VIS · House', (0, 0, 0)),
    'facade': ('VIS · House', (0, 0, 0)),
    'foyer': ('VIS · House', (0, 0, 0)),
    'beacon': ('VIS · Beacon chamber', (-25, 9.4, 0)),
    'gallery': ('VIS · Collection gallery', (25, 7, 0)),
    'gallery-sealed': ('VIS · Collection gallery', (25, 7, 0)),
    'tower': ('VIS · Listening tower', (0, 0, 0)),
}
ALBEDO_RESOLUTION = 1024
NORMAL_RESOLUTION = 1024
MAX_BYTES = 4 * 1024 * 1024
MAX_TRIANGLES = 64_000
BEACON_STAIRS = ('Descending stair tread', 'Stair rail', 'Stone wall at stair')
FOYER_EXTERIOR = ('Stone plinth','Warm entrance floor','Entrance step','CASA DE COMPAII',
                  'Clerestory smoked glass','Vertical recessed window','Amber window sill',
                  'Right wing stone rib')
GALLERY_FLOOR = ('Limestone gallery floor','Published stone base','Published oak top')


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def append_blocks(obj, specs):
    parts = [obj]
    for name, center, size, material, bevel in specs:
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        part = bpy.context.object
        part.name, part.dimensions = name, size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            border = part.modifiers.new('Dressed edges', 'BEVEL')
            border.width, border.segments = bevel, 3
        part.data.materials.append(bpy.data.materials[material])
        parts.append(part)
    select(parts)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()


def mesh_for(collection, origin, cell):
    scope = bpy.data.collections[collection]
    scope.hide_render = False
    exclusions = {'beacon':BEACON_STAIRS, 'foyer':FOYER_EXTERIOR,
                  'gallery':GALLERY_FLOOR,'gallery-sealed':GALLERY_FLOOR}.get(cell, ())
    objects = [obj for obj in scope.objects if not obj.name.startswith(exclusions)]
    if cell in ('gallery','gallery-sealed'):
        # Keep the working bench clear of the actual stair approach as well
        # as the opening cut in the floor below it.
        for obj in objects:
            if obj.name.startswith(('Drafts stone base','Drafts oak top')):
                obj.location.y += 2.98
    select(objects)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = collection
    obj.location -= Vector(origin)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if cell=='beacon':
        register_beacon(obj)
    if cell=='facade':
        # Front +Z in glTF. The checked-in chamber is full size; the fixture's
        # approved west-parcel facade is 3.15 × 1.5 × 2.65 in world space.
        obj.data.transform(Matrix.Translation((0,-1.195,0)) @
                           Matrix.Diagonal((.153,.320,.391,1)))
    if cell=='foyer':
        obj.data.transform(Matrix.Translation((0,-5.84,-.334)) @
                           Matrix.Diagonal((1.27,1.42,1,1)))
        append_blocks(obj,[('Foyer limestone floor',(0,0,.035),(11.76,11.76,.122),
                            'Honed honey limestone',0)])
    if cell in ('gallery','gallery-sealed'):
        register_gallery(obj,stair=cell=='gallery')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.13, island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def register_gallery(obj,stair):
    obj.data.transform(Matrix.Translation((0,0,.10)) @
                       Matrix.Diagonal((-1.095,-.832,1,1)))
    # Gallery stair slot 1 uses x=3 and z in [-5.86,-3.16]. Cut the
    # visible stone above the existing engine hole rather than sealing it.
    bounds = [(-5.89,2.15,-5.89,5.89),(3.85,5.89,-5.89,5.89),
              (2.15,3.85,-3.16,5.89)] if stair else [(-5.89,5.89,-5.89,5.89)]
    floor = [('Gallery limestone floor',((x1+x2)/2,-(z1+z2)/2,.035),
              (x2-x1,z2-z1,.122),'Honed honey limestone',0) for x1,x2,z1,z2 in bounds]
    steps = [('Gallery stair stone',(3,5.86-.45*(index+.5),.024-.14*(6-index)),
              (1.70,.45,.142),'Honed honey limestone',.012) for index in range(6)] if stair else []
    rails = [('Gallery stair oak rail',(x,4.51,.53),(.12,2.72,.115),'Dark oiled oak',.015)
             for x in (2.08,3.92)] if stair else []
    append_blocks(obj,floor+steps+rails+[
        ('Gallery entrance wall',(0,5.96,1.965),(11.84,.20,3.94),'Ivory limewash',.032),
        ('Published exhibit base',(2.5,-1.25,.48),(1.24,.96,.76),'Split basalt',.055),
        ('Published exhibit top',(2.5,-1.25,.91),(1.32,1.04,.11),'Dark oiled oak',.042),
    ])


def register_beacon(obj):
    # Preserve the existing 12m cell and the west stair passage. The rendered
    # chamber extends south from the stair and leaves the original steps free.
    # Blender (X,Y,Z) here is centered on the chamber, before glTF converts it.
    obj.data.transform(Matrix.Translation((0,-.002,.10)) @
                       Matrix.Diagonal((-.88,-.77,1,1)))
    stone = bpy.data.materials['Honed honey limestone']
    oak = bpy.data.materials['Dark oiled oak']
    brass = bpy.data.materials['Satin brass']
    pieces = [obj]

    def piece(name, at, size, mat, tilt=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=at)
        part = bpy.context.object
        part.name, part.dimensions = name, size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        part.rotation_euler.x = tilt
        border = part.modifiers.new('Dressed edges', 'BEVEL')
        border.width, border.segments = .015, 3
        part.data.materials.append(mat)
        pieces.append(part)

    # Coordinates match the existing six walkable MML treads. These are the
    # visible edges, with continuous outboard handrails in darkened brass.
    for index in range(6):
        depth = 5.86-.45*(index+.5)
        top = .1+.14*(6-index)-.004
        piece('Limestone stair tread',(-3,depth,top-.071),(1.70,.45,.142),stone)
    for x in [-3.92,-2.08]:
        for y,z in [(5.69,.93),(4.50,.57),(3.25,.22)]:
            piece('Bronze stair spindle',(x,y,z+.43),(.055,.058,.86),brass)
        piece('Oiled oak handrail',(x,4.49,1.45),(.09,2.62,.088),oak,.285)
    for x,width in [(-4.89,2.02),(1.86,8.00)]:
        piece('Limestone landing wall',(x,5.86,2.799),(width,.16,5.398),stone)
    piece('Stair portal architrave',(-3,5.84,3.55),(1.76,.19,.17),oak)
    piece('Upper landing lintel',(-3,5.86,4.59),(1.74,.16,1.82),stone)
    select(pieces)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()


def bake(obj, name, mode, resolution, scratch):
    image = bpy.data.images.new(name, width=resolution, height=resolution, alpha=False)
    image.colorspace_settings.name = 'Non-Color' if mode == 'NORMAL' else 'sRGB'
    for mat in obj.data.materials:
        nodes = mat.node_tree.nodes
        target = nodes.new('ShaderNodeTexImage')
        target.image = image
        nodes.active = target
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 8
    bpy.ops.object.bake(type=mode)
    image.filepath_raw = str(scratch / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def portable_materials(obj, color, normal):
    for mat in obj.data.materials:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get('Principled BSDF')
        for node in list(nodes):
            if node not in (shader, nodes.get('Material Output')):
                nodes.remove(node)
        color_node = nodes.new('ShaderNodeTexImage')
        color_node.image = color
        links.new(color_node.outputs['Color'], shader.inputs['Base Color'])
        normal_node = nodes.new('ShaderNodeTexImage')
        normal_node.image = normal
        decoded_normal = nodes.new('ShaderNodeNormalMap')
        links.new(normal_node.outputs['Color'], decoded_normal.inputs['Color'])
        links.new(decoded_normal.outputs['Normal'], shader.inputs['Normal'])


def inventory(path):
    binary = path.read_bytes()
    _, version, length, metadata_length, tag = struct.unpack_from('<4sIIII', binary)
    assert version == 2 and length == len(binary) and tag == 0x4e4f534a
    doc = json.loads(binary[20:20+metadata_length])
    assert not doc.get('extensionsRequired')
    assert all('uri' not in x for x in doc['buffers'] + doc['images'])
    primitives = [p for mesh in doc['meshes'] for p in mesh['primitives']]
    triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for p in primitives)
    assert len(binary) <= MAX_BYTES and triangles <= MAX_TRIANGLES, (len(binary),triangles)
    return {'bytes': len(binary), 'triangles': triangles, 'primitives': len(primitives),
            'images': len(doc['images']), 'localBounds': [
                [min(doc['accessors'][p['attributes']['POSITION']]['min'][i] for p in primitives)
                 for i in range(3)],
                [max(doc['accessors'][p['attributes']['POSITION']]['max'][i] for p in primitives)
                 for i in range(3)]]}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--')+1:]
    destination, cell = Path(args[0]).resolve(), args[1]
    destination.mkdir(parents=True, exist_ok=True)
    collection, origin = CELLS[cell]
    obj = mesh_for(collection, origin, cell)
    # This smaller cell keeps its look with a 768px atlas and fits the
    # existing package budget alongside both permissioned gallery variants.
    color_size = 768 if cell == 'tower' else ALBEDO_RESOLUTION
    normal_size = 768 if cell == 'tower' else NORMAL_RESOLUTION
    color = bake(obj, cell+'-albedo', 'DIFFUSE', color_size, destination)
    normal = bake(obj, cell+'-normal', 'NORMAL', normal_size, destination)
    portable_materials(obj, color, normal)
    path = destination / (cell+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_animations=False, export_cameras=False, export_lights=False)
    metrics = inventory(path)
    (destination / (cell+'.json')).write_text(json.dumps(metrics, indent=2)+'\n')
    print(json.dumps(metrics))
