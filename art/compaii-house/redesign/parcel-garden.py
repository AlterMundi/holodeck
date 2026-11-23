"""Author the limestone paths and coastal planting on the public parcel verge."""
from math import cos, sin, tau
from pathlib import Path
from random import Random
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_trees import PlantMesh, bay, foliage_atlas, shrub
from coastal_trees import pack_plant_materials, pack_plant_mesh
from coastal_water import pack_glb, parse_glb

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"


def material(name, colour, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    return mat


stones = [material("Honed path stone " + name, colour, .83) for name, colour in (
    ("warm", (.44, .37, .27)), ("sand", (.36, .31, .24)), ("aged", (.33, .28, .22)))]
basalt = material("Split basalt kerb", (.098, .123, .11), .92)
oak = material("Oiled oak seat", (.237, .139, .082), .73)
reed = material("Salt meadow grasses", (.246, .301, .124), .93)
flower = material("Coastal thrift", (.37, .193, .196), .74)
rng = Random(782)
pieces = []


def place(name, data, mat):
    item = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(mat)
    return item


def block(name, center, size, mat, bevel):
    x, y, z = center
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    item = bpy.context.object
    item.name, item.dimensions = name, (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    border = item.modifiers.new("Dressed edges", "BEVEL")
    border.width, border.segments = bevel, 1
    item.data.materials.append(mat)
    pieces.append(item)
    return item


# The slightly varied, narrow joints run entirely outside the reserved plots.
# The path's east side leaves room for the player around the seat and trunks.
for index in range(21):
    z = 14.44 + index * .485
    x = -7.052 + .055 * sin(index * .58)
    slab = block("West walk limestone flag", (x, .102, z), (.91, .021, .472),
                 stones[(index + index // 4) % 3], .007)
    slab.rotation_euler.z = rng.uniform(-.016, .016)
for z in (14.15, 24.47):
    for index in range(12):
        x = -6.94 + index * .494
        block("Cross path limestone flag", (x, .101, z), (.48, .022, .51),
              stones[(index + 1) % 3], .007)
for z in (17.72, 18.57):
    block("Seat basalt plinth", (-7.705, .261, z), (.282, .322, .18), basalt, .025)
for x in (-7.839, -7.702, -7.565):
    block("Edge seat oak slat", (x, .457, 18.145), (.121, .072, 1.19), oak, .013)

wood, leaves = PlantMesh(), PlantMesh()
bay(wood, leaves, -7.72, 15.35, .76, 1, 793)
bay(wood, leaves, -7.73, 21.16, .68, -1, 795)
# Raise the crowns over the walkway while retaining the same trunk bases.
for canopy in (wood, leaves):
    canopy.vertices = [(x, y, z + .88 * min(1, max(0, z / 1.55)))
                       for x, y, z in canopy.vertices]
for index, z in enumerate((14.65, 16.05, 16.72, 19.10, 19.89, 20.31, 22.09, 22.87, 23.55)):
    shrub(leaves, -7.76, z, .28, 121 + index)


def gardens():
    blades, blossoms = PlantMesh(), PlantMesh()
    for index, z in enumerate((14.47, 14.87, 15.88, 16.47, 17.05, 17.40, 18.92, 19.52,
                                 20.08, 20.59, 21.65, 22.42, 23.14, 23.88)):
        for i in range(13):
            angle = rng.random() * tau
            x, pz = -7.77+rng.uniform(-.09,.09), -z+rng.uniform(-.21,.21)
            h, bow, w = rng.uniform(.17,.39), rng.uniform(.04,.16), rng.uniform(.012,.032)
            dx, dz = cos(angle), sin(angle)
            blades.face([(x-dz*w,pz+dx*w,.104), (x+dz*w,pz-dx*w,.104),
                         (x+dx*bow,pz+dz*bow,.10+h)])
            if index % 2 == 0 and i in (1,7,11):
                xf, zf = x+dx*bow, pz+dz*bow
                blossoms.face([(xf+.028*cos(t),zf+.026*sin(t),.10+h+.006*cos(i))
                                for t in (0,tau/5,2*tau/5,3*tau/5,4*tau/5)])
    return (place("Salt grass tussocks", blades.blender_mesh("Salt grass"), reed),
            place("Wild coastal thrift", blossoms.blender_mesh("Thrift flowers"), flower))


pieces.extend(gardens())
bark = material("Salt-weathered bark", (.197,.132,.087), .92)
bough_mat = material("Layered coastal foliage", (.22,.3,.17), .87)
atlas_path = output / "parcel-garden-foliage.png"
atlas = foliage_atlas(atlas_path)
image = bpy.data.images.load(str(atlas_path))
image.pack()
atlas_path.unlink()
shader = bough_mat.node_tree.nodes.get("Principled BSDF")
texture = bough_mat.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = image
bough_mat.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
bough_mat.node_tree.links.new(texture.outputs["Alpha"], shader.inputs["Alpha"])
wood_obj = place("West verge bay branches", wood.blender_mesh("Bay branches"), bark)
leaves_obj = place("West verge bay crowns and shrubs", leaves.blender_mesh("Bay foliage"), bough_mat)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / "parcel-garden.blend"), compress=True)
bpy.ops.object.select_all(action="DESELECT")
for item in pieces:
    item.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
pieces[0].name = "Limestone walk and verge seat"
stage = output / "parcel-hardscape.glb"
bpy.ops.export_scene.gltf(filepath=str(stage), export_format="GLB", use_selection=True,
                          export_cameras=False, export_lights=False)
doc, blob = parse_glb(stage.read_bytes())
stage.unlink()
bark_mat, leaf_mat = pack_plant_materials(doc, blob, atlas)
parts = [pack_plant_mesh(doc, blob, obj.data, mat, uv) for obj, mat, uv in (
    (wood_obj, bark_mat, False), (leaves_obj, leaf_mat, True))]
doc["meshes"].append({"name":"Coastal planting","primitives":parts})
doc["nodes"].append({"name":"Coastal planting","mesh":len(doc["meshes"])-1})
doc["scenes"][doc["scene"]]["nodes"].append(len(doc["nodes"])-1)
(output / "parcel-garden.glb").write_bytes(pack_glb(doc, blob))
