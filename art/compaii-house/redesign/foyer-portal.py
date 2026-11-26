"""Build the Atelier portal fitting in passage-local metres."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness, metal=0, emission=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return result


stone = material("Honed honey limestone", (.37, .275, .159), .79)
oak = material("Smoked oak", (.079, .033, .016), .66)
brass = material("Satin brass", (.55, .301, .092), .35, .55)
enamel = material("Midnight blue enamel", (.014, .042, .057), .46, .18)
glass = material("Melted teal seam", (.045, .44, .39), .27, .22, .94)
parts = []


def finish(part, name, coating, bevel):
    part.name = name
    part.data.materials.append(coating)
    modifier = part.modifiers.new("Rounded exposed edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    part.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    parts.append(part)


def block(name, at, size, coating, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    part = bpy.context.object
    part.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(part, name, coating, bevel)


def section(name, points, front, back, coating):
    # Front is negative Blender Y, which becomes positive glTF Z.
    vertices = [(x, -depth, z) for depth in (front, back) for x, z in points]
    n = len(points)
    faces = [tuple(range(n)), tuple(reversed(range(n, n * 2)))]
    faces += [(i, i+n, (i+1) % n+n, (i+1) % n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    part = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(part)
    finish(part, name, coating, .005)


def arc(radius, spring, segment=24):
    return [(radius*cos(pi*i/segment), spring+radius*sin(pi*i/segment))
            for i in range(segment+1)]


for side in (-1, 1):
    block("Limestone plinth", (side*1.035, -.397, .278), (.36, .225, .354), stone, .025)
    block("Oak pilaster", (side*1.043, -.386, 1.111), (.226, .169, 1.653), oak, .022)
    block("Brass edge bead", (side*.939, -.482, 1.148), (.026, .020, 1.606), brass)
    block("Brass impost", (side*1.045, -.407, 1.948), (.295, .202, .080), brass)
    block("Teal register", (side*.847, -.407, 1.070), (.019, .018, 1.576), glass, .003)
    block("Blue inset reed", (side*.573, -.369, 1.110), (.034, .052, 1.528), enamel)
    for height in (.63, 1.39):
        block("Inlaid bolt", (side*1.053, -.476, height), (.061, .022, .047), brass)

section("Oak crown", arc(1.16, 1.944)+list(reversed(arc(.947, 1.944))), .465, .306, oak)
section("Brass crown inlay", arc(.988, 1.944)+list(reversed(arc(.953, 1.944))), .489, .458, brass)
section("Enamel lantern face", [(-.878, .151), (.878, .151), *arc(.878, 1.944)], .366, .288, enamel)
section("Teal inset arch", arc(.864, 1.944)+list(reversed(arc(.840, 1.944))), .427, .399, glass)
block("Etched center seam", (0, -.394, 1.316), (.014, .033, 2.304), brass)
block("Floor sill", (0, -.414, .129), (2.02, .233, .050), stone)
block("Raised sill bead", (0, -.500, .154), (1.71, .022, .014), brass, .003)
block("Bronze title frame", (0, -.487, 3.290), (2.08, .106, .420), brass, .023)
block("Title enamel plate", (0, -.551, 3.290), (1.94, .038, .354), enamel, .010)

def select(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


depsgraph = bpy.context.evaluated_depsgraph_get()
export_objects = []
for coating in (stone, oak, brass, enamel, glass):
    pieces = []
    for part in parts:
        if part.data.materials[0] != coating:
            continue
        mesh = bpy.data.meshes.new_from_object(part.evaluated_get(depsgraph))
        piece = bpy.data.objects.new(coating.name, mesh)
        bpy.context.collection.objects.link(piece)
        piece.matrix_world = part.matrix_world
        pieces.append(piece)
    select(pieces)
    bpy.ops.object.join()
    export_objects.append(bpy.context.object)
select(export_objects)
bpy.ops.export_scene.gltf(filepath=str(out/"foyer-portal.glb"), export_format="GLB",
                          use_selection=True, export_animations=False)
bpy.ops.object.delete()

# Keep a player-height reference view and lights in the editable source.
scene = bpy.context.scene
bpy.ops.object.camera_add(location=(2.6, -6.3, 1.70))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, -.44, 1.64))-camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.lens = 49
scene.camera = camera
for name, at, energy, color, size in [
    ("Warm key", (-2.9, -3.6, 4.8), 510, (1, .81, .61), 3),
    ("Cool bounce", (3.3, -1.7, 3.0), 300, (.59, .83, 1), 2),
]:
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.color = color
    light.size = size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = at
    obj.rotation_euler = (Vector((0, -.44, 1.73))-obj.location).to_track_quat("-Z", "Y").to_euler()
scene.render.engine = "CYCLES"
scene.cycles.samples = 20
scene.cycles.use_denoising = True
scene.render.resolution_x = 880
scene.render.resolution_y = 840
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.filepath = "//foyer-portal.jpg"
bpy.ops.wm.save_as_mainfile(filepath=str(out/"foyer-portal.blend"), compress=True)
if "--render" in sys.argv:
    bpy.ops.render.render(write_still=True)
