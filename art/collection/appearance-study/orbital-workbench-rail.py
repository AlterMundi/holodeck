"""Author a fastening rail to exercise appearance regeneration on the existing workbench."""
import argparse
from pathlib import Path
import sys

import bpy


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
parts = bpy.data.collections.new('Workbench fastening rail')
bpy.context.scene.collection.children.link(parts)


def block(name, center, dimensions, material, density):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = dimensions
    obj.data.materials.append(bpy.data.materials[material])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    uv = obj.data.uv_layers.active.data
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda index: abs(face.normal[index]))
        u, v = ((1, 2), (0, 2), (0, 1))[axis]
        for corner in face.loop_indices:
            point = obj.matrix_world @ obj.data.vertices[obj.data.loops[corner].vertex_index].co
            uv[corner].uv = (point[u] * density, point[v] * density)
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    parts.objects.link(obj)


block('Workbench rail base', (0, -.286, 1.05), (1.46, .094, .045), 'Orbital navy', .92)
for offset in (-.59, -.355, -.12, .12, .355, .59):
    block('Workbench rail seat', (offset, -.286, 1.08), (.136, .060, .022), 'Orbital steel', 1.1)
for offset in (-.70, .70):
    block('Workbench rail retention stop', (offset, -.286, 1.079), (.043, .081, .034), 'Orbital orange', 1.2)

bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
