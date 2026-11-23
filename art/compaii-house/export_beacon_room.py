"""Extract the authored Beacon workshop to the current Holodeck room coordinates."""
import struct
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

asset = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
beacon = bpy.data.collections['03 • Beacon pit']
objects = list(beacon.objects)
assert objects and all(obj.type in ('MESH','CURVE','FONT') for obj in objects)

# Blender Z-up becomes MML Y-up with +Blender Y facing -MML Z.
# Preserve the stair approach, existing room marker and potential exhibit.
offset = Vector((12.15,-.78,1.65))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.matrix_world = Matrix.Translation(offset) @ obj.matrix_world
    if obj.name.startswith('Acoustic side fin'):
        obj.location.x = -5.63
    elif obj.name.startswith(('Beacon title plate','HARMONIC BEACON LAB')):
        obj.location.z -= .36
    obj.select_set(True)

# The workshop sits inside the current walkable shell. These Blender surfaces
# bring the side baffles, dark rear title and room edges into one enclosure.
def panel(name, center, size, material_name):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    item = bpy.context.object
    item.name = name
    item.dimensions = size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    item.data.materials.append(bpy.data.materials[material_name])
    item.modifiers.new('Subtle masonry edge','BEVEL').width = .028
    objects.append(item)

plaster = 'Chalk limewash'
bronze = 'Blue-black gunmetal'
panel('Stone ceiling',(0,0,4.29),(11.75,11.75,.25),plaster)
panel('Rear wall cladding',(0,5.82,2.13),(11.73,.15,4.32),plaster)
panel('West wall cladding',(-5.83,0,2.13),(.19,11.64,4.32),plaster)
panel('East wall cladding',(5.83,0,2.13),(.19,11.64,4.32),plaster)
panel('Entry wall lintel',(0,-5.83,3.70),(11.73,.15,1.25),plaster)
for x in (-4,0,4):
    panel('Beamed ceiling',(x,0,4.08),(.21,11.76,.21),bronze)
for x in (-3.8,3.8):
    panel('Recessed ceiling lamp',(x,0,3.96),(.065,7.2,.032),'Fired amber')
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
# Bake the bounded object modifiers before batching the source by material.
bpy.ops.object.convert(target='MESH')
groups = {}
for obj in bpy.context.selected_objects:
    assert len(obj.data.materials) == 1
    groups.setdefault(obj.data.materials[0].name, []).append(obj)
batched = []
for name, group in sorted(groups.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group)>1:
        bpy.ops.object.join()
    part = bpy.context.object
    part.name = 'Beacon workshop · '+name
    batched.append(part)
for obj in batched:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True, export_texcoords=False)

binary = asset.read_bytes()
assert len(binary) <= 850_000, len(binary)
size, chunk = struct.unpack_from('<II', binary, 12)
assert chunk == 0x4e4f534a
scene = json.loads(binary[20:20+size])
assert not scene.get('extensionsRequired') and not scene.get('images')
triangles = sum(scene['accessors'][p['indices']]['count']//3
                for mesh in scene['meshes'] for p in mesh['primitives'])
assert triangles <= 30_000 and len(scene['meshes']) <= 9
print(json.dumps({'bytes':len(binary),'triangles':triangles,'meshes':len(scene['meshes'])}))
