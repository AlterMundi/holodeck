"""Prepare the single garden stone from the retained Poly Haven 1K source."""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

source, output = (Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source/'rock_09_1k.gltf'))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
assert len(meshes) == 1
original = meshes[0]
bpy.context.view_layer.objects.active = original
bpy.ops.object.select_all(action='DESELECT')
original.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def tris(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


source_triangles = tris(original)
source_files = sorted(source.glob('textures/*.jpg'))
assert len(source_files) == 3
source_bytes = sum(path.stat().st_size for path in [
    source/'rock_09_1k.gltf',source/'rock_09.bin',*source_files,
])
rock = original.copy()
rock.data = original.data.copy()
bpy.context.scene.collection.objects.link(rock)
rock.name = 'Garden stone · Rock 09'
original.select_set(False)
rock.select_set(True)
bpy.context.view_layer.objects.active = rock
decimate = rock.modifiers.new('Keep the main stone silhouette', 'DECIMATE')
decimate.ratio = min(1,1400/source_triangles)
bpy.ops.object.modifier_apply(modifier=decimate.name)

original_size = Vector(original.dimensions)
asset_size_change = max(abs(a-b)/a for a,b in zip(original_size,rock.dimensions))
assert asset_size_change <= .045, f'Unexpected silhouette change: {asset_size_change:.2%}'
rock.scale *= .82/max(original_size)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.update()

# Align the pivot to the footprint at ground level.
points = [vertex.co for vertex in rock.data.vertices]
pivot = Vector(((min(v.x for v in points)+max(v.x for v in points))/2,
                (min(v.y for v in points)+max(v.y for v in points))/2,
                min(v.z for v in points)))
for vertex in rock.data.vertices:
    vertex.co -= pivot
rock.location = (0,0,0)

diffuse = bpy.data.images.load(str(next(p for p in source_files if '_diff_' in p.name)),check_existing=False)
diffuse.scale(256,256)
diffuse.file_format = 'JPEG'
texture_path = output/'rock-09-garden-256.jpg'
diffuse.save(filepath=str(texture_path))
texture = bpy.data.images.load(str(texture_path),check_existing=False)
material = bpy.data.materials.new('Garden stone • dry umber')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = .84
base = material.node_tree.nodes.new('ShaderNodeTexImage')
base.image = texture
material.node_tree.links.new(base.outputs['Color'],shader.inputs['Base Color'])
rock.data.materials.clear()
rock.data.materials.append(material)

file = output/'rock-09-garden.glb'
bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,
                          export_image_format='JPEG',export_image_quality=83)
optimized_triangles = tris(rock)
assert optimized_triangles <= 1450 and file.stat().st_size <= 100*1024

# Read the exact export as glTF, including the material and texture.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(file))
recovered = [obj for obj in bpy.context.scene.objects if obj.type=='MESH']
assert len(recovered) == 1
assert tris(recovered[0]) == optimized_triangles
assert len(recovered[0].data.materials) == 1
assert len(bpy.data.images) == 1 and tuple(bpy.data.images[0].size) == (256,256)
print('CATALOG_ART='+json.dumps({
    'sourceTri':source_triangles,'sourceBytes':source_bytes,
    'variantTri':optimized_triangles,'variantBytes':file.stat().st_size,
    'images':1,'texture':[256,256],'boundsDeltaMax':round(asset_size_change,5),
    'meters':[round(x,4) for x in recovered[0].dimensions],
}))
