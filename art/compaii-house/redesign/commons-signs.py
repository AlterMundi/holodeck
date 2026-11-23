"""Build the plaza directory and its route signs in a clean Blender scene."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def finish(name, colour, metallic=0, roughness=0.5, emission=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*colour, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*colour, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = (*colour, 1)
        shader.inputs["Emission Strength"].default_value = emission
    return material


basalt = finish("Dressed basalt footing", (0.061, 0.086, 0.093), roughness=0.88)
metal = finish("Aged brass", (0.48, 0.29, 0.11), metallic=0.58, roughness=0.46)
oak = finish("Smoked oak", (0.122, 0.058, 0.032), roughness=0.68)
enamel = finish("Blue iron enamel", (0.021, 0.067, 0.076), metallic=0.15)
lettering = finish("Ivory inlay", (0.87, 0.79, 0.60), roughness=0.55, emission=0.27)


def anchor(name, x, world_z, angle):
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (x, -world_z, 0.10)
    root.rotation_euler.z = angle
    return root


def box(root, name, at, size, material, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1)
    part = bpy.context.object
    part.name = name
    part.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    part.parent = root
    part.location = at
    part.data.materials.append(material)
    if bevel:
        rounding = part.modifiers.new("Eased corners", "BEVEL")
        rounding.width = bevel
        rounding.segments = 1
        rounding.affect = "EDGES"
        part.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return part


def front(root, face, x, y, z):
    return Vector((face * x, face * y, z))


def glyphs(root, face, title, z, size, max_width, left):
    curve = bpy.data.curves.new(title, "FONT")
    curve.body = title
    curve.size = size
    curve.resolution_u = 3
    curve.align_y = "CENTER"
    text = bpy.data.objects.new(title, curve)
    bpy.context.scene.collection.objects.link(text)
    text.parent = root
    text.location = front(root, face, left, -0.072, z)
    text.rotation_euler = (pi / 2, 0, 0 if face > 0 else pi)
    text.data.materials.append(lettering)
    bpy.context.view_layer.update()
    width = text.bound_box[6][0] - text.bound_box[0][0]
    if width > max_width:
        text.scale = (max_width / width,) * 3


def arrow(root, face, z, direction, x, size):
    angle = {"ahead": 0, "right": -pi / 2, "behind": pi, "left": pi / 2}[direction]
    shape = [(-0.39, -0.42), (0.39, -0.42), (0.39, -0.02), (0.64, -0.02),
             (0, 0.56), (-0.64, -0.02), (-0.39, -0.02)]
    points = []
    for sx, sy in shape:
        u = (sx * cos(angle) - sy * sin(angle)) * size
        v = (sx * sin(angle) + sy * cos(angle)) * size
        points.append(front(root, face, x + u, -0.073, z + v))
    mesh = bpy.data.meshes.new("Direction inlay")
    mesh.from_pydata(points, [], [tuple(range(len(points)))])
    mesh.update()
    part = bpy.data.objects.new("Direction inlay", mesh)
    bpy.context.scene.collection.objects.link(part)
    part.parent = root
    part.data.materials.append(lettering)


def blade(root, z, width, height):
    box(root, "Brass frame", (0, 0, z), (width, 0.118, height), metal, 0.028)
    for face in (-1, 1):
        box(root, "Recessed enamel", (0, face * 0.056, z),
            (width - 0.058, 0.024, height - 0.058), enamel, 0.014)


def footing(root, width, height):
    for x in (-width / 2 + 0.14, width / 2 - 0.14):
        box(root, "Stone footing", (x, 0, 0.073), (0.31, 0.31, 0.146), basalt, 0.035)
        box(root, "Oak upright", (x, 0, height / 2 + 0.055), (0.115, 0.12, height), oak, 0.013)


directory = anchor("Plaza directory", -3.06, -6.75, -0.14)
footing(directory, 2.6, 2.18)
rows = [("Mirador", "ahead"), ("Jardín", "right"), ("Galería exterior", "left"), ("Casas", "behind")]
for z, (title, direction) in zip((2.05, 1.68, 1.31, 0.94), rows):
    blade(directory, z, 2.6, 0.34)
    glyphs(directory, 1, title, z, 0.28, 1.9, -0.72)
    arrow(directory, 1, z, direction, -1.01, 0.24)
    reverse = {"ahead": "behind", "right": "left", "left": "right", "behind": "ahead"}
    glyphs(directory, -1, title, z, 0.28, 1.9, -0.72)
    arrow(directory, -1, z, reverse[direction], -1.01, 0.24)

for title, x, z, angle in [
    ("Jardín", 8.15, 2.65, -pi / 2),
    ("Galería exterior", -8.30, 2.65, pi / 2),
    ("Casas", 2.75, 8.25, pi),
    ("Mirador", 2.75, -8.10, 0),
]:
    sign = anchor(title + " route", x, z, angle)
    footing(sign, 1.72, 1.12)
    blade(sign, 1.21, 1.72, 0.31)
    for face, label in ((1, title), (-1, "Plaza")):
        glyphs(sign, face, label, 1.21, 0.24, 1.24, -0.44)
        arrow(sign, face, 1.21, "ahead", -0.65, 0.20)

bpy.ops.wm.save_as_mainfile(filepath=str(output / "commons-signs.blend"), compress=True)

# Merge export-only copies by finish. The saved scene keeps editable lettering,
# individual anchors and bevels.
bpy.ops.object.select_all(action="DESELECT")
parts = [part for part in bpy.context.scene.objects if part.type in {"FONT", "MESH"}]
for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
groups = {}
for part in bpy.context.selected_objects:
    groups.setdefault(part.data.materials[0].name, []).append(part)
for name, parts in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bpy.context.object.name = name
bpy.ops.export_scene.gltf(filepath=str(output / "commons-signs.glb"), export_format="GLB",
                          export_cameras=False, export_lights=False)
