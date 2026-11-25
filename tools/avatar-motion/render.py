"""Render sampled runtime skeletons on the shipped meshes as a contact sheet.

  blender -b --python-exit-code 19 --python render.py -- SAMPLES.json SHEET.png follow|side [NAME,NAME]

The follow view stands where the orbit camera stands. It is a Blender picture of
runtime transforms, not a capture of the game renderer.
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
samples = json.loads(Path(args[0]).read_text())
sheet = Path(args[1]).resolve()
view = args[2]
wanted = args[3].split(",") if len(args) > 3 else None
here = Path(__file__).resolve().parents[2]
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()
swap = lambda p: (p[0], -p[2], p[1])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), bone_heuristic="BLENDER")
    made = [o for o in bpy.data.objects if o not in before]
    rig = next(o for o in made if o.type == "ARMATURE")
    rig.animation_data_clear()
    for obj in made:
        if obj.type == "MESH" and not obj.find_armature():
            bpy.data.objects.remove(obj)
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.custom_shape = None
    return rig


human = load(here / "public/assets" / samples["file"])
robot = load(here / "public/assets/avatar/navegante-blender.glb")


def apply(rig, skin):
    world = rig.matrix_world
    inverse = world.inverted()
    posed = {}
    for bone in rig.pose.bones:  # parents come first
        rest = bone.bone.matrix_local
        values = skin.get(bone.name)
        parent = bone.parent
        chain = posed[parent.name] @ parent.bone.matrix_local.inverted() @ rest if parent else rest
        if values is None:
            target = chain
        else:
            delta = C @ Matrix([values[i::4] for i in range(4)]) @ CI
            target = inverse @ delta @ world @ rest
        posed[bone.name] = target
        bone.matrix_basis = chain.inverted() @ target


def material(name, color, alpha=1):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .8 if alpha == 1 else .15
    shader.inputs["Alpha"].default_value = alpha
    return mat


grass, sea = material("ground", (.26, .30, .20)), material("water", (.05, .32, .42), .38)
world = bpy.data.worlds.new("sky")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.50, .60, .70, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = .75
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.6
sun.rotation_euler = (.75, .25, .5)
scene.collection.objects.link(sun)
camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.angle = math.radians(58 if view == "follow" else 42)
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 300, 260
work = sheet.parent / (sheet.stem + ".d")
work.mkdir(parents=True, exist_ok=True)


def surface(name, points, size, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], [(j*size+i, j*size+i+1, (j+1)*size+i+1, (j+1)*size+i)
                                  for j in range(size-1) for i in range(size-1)])
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


images = []
for frame in samples["frames"]:
    if wanted and frame["name"].rsplit("-", 1)[0] not in wanted:
        continue
    apply(human, frame["human"])
    apply(robot, frame["robot"])
    made = [surface("ground", [swap(p) for p in frame["ground"]], frame["size"], grass)]
    if frame["depth"] > .02 or frame["water"] > -6 and frame["depth"] > 0:
        z = frame["water"]
        made.append(surface("water", [(-9, -9, z), (9, -9, z), (-9, 9, z), (9, 9, z)], 2, sea))
    body = Matrix([frame["human"]["spine_03"][i::4] for i in range(4)])
    facing = (C @ body @ CI).to_3x3() @ Vector((0, -1, 0))
    if view == "follow":
        eye, target = Vector((0, 3.5, 2.5)), Vector((.4, 0, 1.15))
    else:
        # Film from the lower side of a slope, clear of the ground.
        size = frame["size"]
        row = [frame["ground"][(size // 2) * size + i][1] for i in (2, size - 3)]
        side = -1 if row[0] <= row[1] + .4 else 1
        eye, target = Vector((4.1 * side, -2.6, 1.45)), Vector((.25, 0, .72))
    size = frame["size"]
    near = [p[1] for p in frame["ground"] if math.hypot(p[0] - eye.x, -p[2] - eye.y) < 1.3]
    eye.z = max([eye.z] + [z + .7 for z in near])
    camera.location = eye
    camera.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
    path = work / (frame["name"] + ".png")
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(path))
    width, height = image.size
    data = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(data)
    images.append(data.reshape(height, width, 4)[::-1])
    for obj in made:
        bpy.data.objects.remove(obj)

columns = 6
height, width = images[0].shape[:2]
rows = (len(images) + columns - 1) // columns
canvas = np.ones((height * rows, width * columns, 4), dtype=np.float32)
for index, image in enumerate(images):
    canvas[(index // columns) * height:(index // columns + 1) * height,
           (index % columns) * width:(index % columns + 1) * width] = image
result = bpy.data.images.new("sheet", width * columns, height * rows)
result.pixels.foreach_set(canvas[::-1].ravel())
result.filepath_raw = str(sheet)
result.file_format = "PNG"
result.save()
