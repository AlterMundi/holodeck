"""Import a pinned Sand3D USDA and export one compact vertex-colored GLB."""
import bpy
import json
import pathlib
import re
import sys

source, output, cap = sys.argv[sys.argv.index("--")+1:]
source, output, cap = pathlib.Path(source), pathlib.Path(output), int(cap)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=str(source), import_cameras=False, import_lights=False,
                      import_materials=True, read_mesh_uvs=False, import_all_materials=False)
graph=bpy.context.evaluated_depsgraph_get()
points,faces,face_colors=[],[],[]
# Repeated micro-geometry prevents a global decimator from reaching a useful
# game budget. Keep a spatially spread sample of the original authored parts.
passes={
    'pumice': {'dark_vesicle_lining': 31},
    'feather-reed-grass': {'folded_pointed_blade': 12, 'ascending_plume_branch': 0,
        'plume_rachis': 8, 'pointed_seed_spray': 24, 'slender_flowering_culm': 8,
        'scattered_short_grass': 0, 'rough_soil_patch': 0},
}
def qualifies(name):
    m=re.fullmatch(r'(.+?)(?:_(\d+))?',name)
    stride=passes.get(source.stem,{}).get(m[1],1)
    return stride and (int(m[2] or '1')-1)%stride==0

def color(material):
    if material and material.node_tree:
        for node in material.node_tree.nodes:
            if node.type=="BSDF_PRINCIPLED":
                return tuple(node.inputs["Base Color"].default_value)
    return tuple(material.diffuse_color) if material else (.4,.4,.4,1)
for obj in bpy.context.scene.objects:
    if obj.type!="MESH" or not qualifies(obj.name):
        continue
    live=obj.evaluated_get(graph)
    mesh=live.to_mesh()
    if source.stem=="feather-reed-grass": print("PART",obj.name,len(mesh.polygons))
    offset=len(points)
    points.extend(tuple(live.matrix_world @ vertex.co) for vertex in mesh.vertices)
    colors=[color(material) for material in mesh.materials]
    for polygon in mesh.polygons:
        faces.append(tuple(offset+index for index in polygon.vertices))
        face_colors.append(colors[polygon.material_index] if colors else (.4,.4,.4,1))
    live.to_mesh_clear()
assert points and faces
minimum=[min(point[axis] for point in points) for axis in range(3)]
maximum=[max(point[axis] for point in points) for axis in range(3)]
center=[(minimum[0]+maximum[0])/2,(minimum[1]+maximum[1])/2,minimum[2]]
span=[maximum[axis]-minimum[axis] for axis in range(3)]
scale=max(span)
points=[tuple((point[i]-center[i])/scale for i in range(3)) for point in points]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mesh=bpy.data.meshes.new(source.stem)
mesh.from_pydata(points,[],faces,shade_flat=True)
mesh.update()
obj=bpy.data.objects.new(source.stem,mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj
obj.select_set(True)
attribute=mesh.color_attributes.new(name="Natural color",type='BYTE_COLOR',domain='CORNER')
for polygon,rgba in zip(mesh.polygons,face_colors):
    for index in polygon.loop_indices:
        attribute.data[index].color=rgba
material=bpy.data.materials.new("Sandflow · color palette")
material.use_nodes=True
nodes=material.node_tree.nodes
principled=nodes.get("Principled BSDF")
principled.inputs["Roughness"].default_value=.94
attribute_node=nodes.new("ShaderNodeVertexColor")
attribute_node.layer_name=attribute.name
material.node_tree.links.new(attribute_node.outputs["Color"],principled.inputs["Base Color"])
mesh.materials.clear()
mesh.materials.append(material)
decimate=obj.modifiers.new("Game mesh simplification","DECIMATE")
decimate.ratio=min(1,cap/len(faces))
bpy.ops.object.modifier_apply(modifier=decimate.name)
obj.data.calc_loop_triangles()
print("TRIANGLES",len(obj.data.loop_triangles),flush=True)
assert len(obj.data.loop_triangles)<=int(cap*1.18)
bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB",use_selection=True,
                         export_yup=True,export_animations=False)
print("RESULT",json.dumps({"id":source.stem,"trianglesFromUSD":len(faces),"trianglesInGLB":len(obj.data.loop_triangles),
   "bytes":output.stat().st_size,"dimensionsNormalized":list(obj.dimensions)}),flush=True)
