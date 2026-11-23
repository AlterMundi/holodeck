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
