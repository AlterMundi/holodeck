"""Author the explorer's first editable proportions study on the live human rig."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0

project = Path(__file__).resolve().parents[2]
bpy.ops.import_scene.gltf(filepath=str(project / "public/assets/avatar-1-bodyA-skin01.glb"))
rig, = (obj for obj in bpy.data.objects if obj.type == "ARMATURE")
for obj in list(bpy.data.objects):
    if obj.type == "MESH":
        bpy.data.objects.remove(obj, do_unlink=True)


def material(name, rgb, roughness, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Emission Color"].default_value = (*rgb, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


teal = material("Petrol cloth", (.037, .158, .177), .82)
undersuit = material("Ink undersuit", (.045, .044, .065), .83)
bronze = material("Satin champagne-bronze", (.60, .34, .115), .43, .32)
seam = material("Graphite leather", (.023, .028, .035), .76)
skin = material("Warm terracotta skin study", (.56, .32, .225), .63)
silver = material("Silver hair", (.32, .30, .29), .76)
silver_light = material("Silver hair highlights", (.46, .43, .39), .72)
cyan = material("Cyan instruments", (.017, .54, .65), .42, .08, .6)


def joint(name):
    return rig.matrix_world @ rig.data.bones[name].head_local


def attach(obj, name, mat, bone, smooth=False):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    weights = obj.vertex_groups.new(name=bone)
    weights.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    mod = obj.modifiers.new("Live humanoid skeleton", "ARMATURE")
    mod.object = rig
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def ellipsoid(name, location, dimensions, mat, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=location)
    obj = bpy.context.object
    obj.scale = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(obj, name, mat, bone, smooth=True)


def case(name, location, dimensions, rounding, mat, bone):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Rounded machined edges", "BEVEL")
    bevel.width = rounding
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return attach(obj, name, mat, bone)


def segment(name, start, end, start_width, end_width, mat, bone):
    start, end = Vector(start), Vector(end)
    axis = end - start
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=start_width, radius2=end_width,
                                   depth=axis.length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    attach(obj, name, mat, bone, smooth=True)
    for face in obj.data.polygons:
        if len(face.vertices) > 4:
            face.use_smooth = False
    return obj


def shell(name, profiles, angles, mat, bone, periodic=False, follow=None):
    perimeter = len(angles)
    verts = [(rx * math.cos(a), y + ry * math.sin(a), z)
             for z, y, rx, ry in profiles for a in angles]
    cols = perimeter if periodic else perimeter - 1
    faces = [(i * perimeter + j, i * perimeter + (j + 1) % perimeter,
              (i + 1) * perimeter + (j + 1) % perimeter, (i + 1) * perimeter + j)
             for i in range(len(profiles) - 1) for j in range(cols)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if not periodic:
        cloth = obj.modifiers.new("Cloth edge thickness", "SOLIDIFY")
        cloth.thickness = .003
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=cloth.name)
    attach(obj, name, mat, bone, smooth=True)
    if follow:
        primary = obj.vertex_groups[bone]
        thigh = obj.vertex_groups.new(name=follow)
        height = profiles[-1][0] - profiles[0][0]
        for vertex in obj.data.vertices:
            mix = .48 * max(0, min(1, (profiles[-1][0] - vertex.co.z) / height))
            if mix:
                primary.add([vertex.index], 1 - mix, "REPLACE")
                thigh.add([vertex.index], mix, "REPLACE")
    return obj


pelvis, chest, head = joint("pelvis"), joint("spine_05"), joint("head")
profile = [(pelvis.z - .09, 0, .154, .094), (pelvis.z + .09, .002, .124, .081),
           (chest.z, .008, .175, .098), (chest.z + .10, .015, .171, .084),
           (chest.z + .16, .019, .073, .061)]
shell("Close-cut coat body", profile, [i * math.tau / 24 for i in range(24)], teal, "spine_03", True)

for left, side in enumerate(("r", "l")):
    sign = 1 if left else -1
    thigh, calf, foot, ball = (joint(name + "_" + side) for name in ("thigh", "calf", "foot", "ball"))
    shoulder, elbow, hand = (joint(name + "_" + side) for name in ("upperarm", "lowerarm", "hand"))
    segment(f"Trouser thigh {side}", thigh, calf, .082, .062, undersuit, f"thigh_{side}")
    segment(f"Trouser shin {side}", calf, foot, .062, .047, undersuit, f"calf_{side}")
    case(f"Boot {side}", (foot.x, (foot.y + ball.y) / 2 - .024, .065), (.125, .25, .124),
         .028, seam, f"foot_{side}")
    segment(f"Boot cuff {side}", foot, foot.lerp(calf, .48), .060, .066, seam, f"calf_{side}")
    segment(f"Ink sleeve {side}", shoulder, elbow, .075, .060, undersuit, f"upperarm_{side}")
    segment(f"Glove sleeve {side}", elbow, hand, .064, .045, undersuit, f"lowerarm_{side}")
    segment(f"Bronze forearm plate {side}", elbow.lerp(hand, .20), elbow.lerp(hand, .84),
            .064, .051, bronze, f"lowerarm_{side}")
    shoulder_plate = shoulder.lerp(elbow, .10) + Vector((sign * .014, 0, .042))
    ellipsoid(f"Clavicle pauldron {side}", shoulder_plate, (.103, .089, .060), bronze, f"clavicle_{side}")
    fingers = joint(f"middle_01_{side}")
    segment(f"Glove {side}", hand, fingers, .046, .037, seam, f"hand_{side}")
    ellipsoid(f"Hand study {side}", fingers, (.042, .038, .042), skin, f"hand_{side}")
    start = -.35 * math.pi if left else .57 * math.pi
    end = .44 * math.pi if left else 1.35 * math.pi
    angles = [start + (end - start) * j / 12 for j in range(13)]
    shell(f"Split coat tail {side}",
          [(calf.z + .055, .035, .176, .133), (pelvis.z - .24, .011, .165, .119),
           (pelvis.z - .025, 0, .149, .095)], angles, teal, "pelvis", follow=f"thigh_{side}")
    x = sign * .103
    case(f"Bronze thruster shell {side}", (x, chest.y + .13, chest.z), (.129, .130, .276),
         .035, bronze, "spine_05")
    nozzle = (x, chest.y + .134, chest.z - .19)
    segment(f"Nozzle {side}", nozzle, (x, chest.y + .132, chest.z - .141), .048, .038, seam, "spine_05")
    segment(f"Nozzle lamp {side}", (x, nozzle[1], nozzle[2] - .004), (x, nozzle[1], nozzle[2] + .002), .029, .029,
            cyan, "spine_05")

case("Flight pack spine", (0, chest.y + .14, chest.z), (.176, .105, .302), .034, seam, "spine_05")
ellipsoid("Flight pack cyan status", (0, chest.y + .20, chest.z + .077), (.030, .012, .030), cyan, "spine_05")
case("Belt fastening", (0, pelvis.y - .09, pelvis.z + .014), (.092, .025, .047), .012, bronze, "pelvis")
ellipsoid("Belt compass", (-.136, -.091, .973), (.049, .020, .049), bronze, "pelvis")
ellipsoid("Compass face", (-.136, -.108, .973), (.038, .012, .038), cyan, "pelvis")

ellipsoid("Neck study", joint("neck_02"), (.048, .048, .075), skin, "neck_02")
ellipsoid("Head proportions", head + Vector((0, -.012, .083)), (.089, .082, .113), skin, "head")
ellipsoid("Jaw and cheeks study", head + Vector((0, -.035, .037)), (.069, .058, .067), skin, "head")
ellipsoid("Nose volume", head + Vector((0, -.098, .079)), (.020, .021, .026), skin, "head")
for sign in (-1, 1):
    ellipsoid(f"Ear {sign}", head + Vector((sign * .081, .002, .072)), (.019, .023, .037), skin, "head")
    ellipsoid(f"Swept hair side {sign}", head + Vector((sign * .072, .025, .119)), (.035, .078, .061),
              silver, "head")
    ellipsoid(f"Beard line {sign}", head + Vector((sign * .045, -.064, .006)), (.030, .023, .056),
              silver, "head")
beard = ellipsoid("Pointed beard", head + Vector((0, -.068, -.022)),
                  (.045, .027, .068), silver_light, "head")
for vertex in beard.data.vertices:
    if vertex.co.z < 0:
        vertex.co.x *= 1 + .8 * vertex.co.z / .068
for i, (x, y, z, lean) in enumerate(((-.053, .027, .161, -.44), (-.020, .018, .190, -.33),
                                      (.018, .019, .189, .35), (.050, .029, .167, .52))):
    tuft = ellipsoid(f"Swept hair lock {i+1}", head + Vector((x, y, z)), (.040, .092, .031),
                     silver_light if i in (1, 2) else silver, "head")
    tuft.rotation_euler.z = lean
    tuft.rotation_euler.x = -.34

# The concept portrait is a private likeness reference, never a model texture.
scene = bpy.context.scene
scene["design_stage"] = "proportions and costume; facial likeness and deformation pending"
bpy.ops.wm.save_as_mainfile(filepath=str(output / "explorer-blockout.blend"))

# Review exports batch parts by material. The .blend retains separately editable parts.
by_material = {}
for obj in scene.objects:
    if obj.type == "MESH":
        by_material.setdefault(obj.data.materials[0].name, []).append(obj)
for name, parts in by_material.items():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    group = parts[0]
    bpy.context.view_layer.objects.active = group
    if len(parts) > 1:
        bpy.ops.object.join()
    group.name = name
bpy.ops.export_scene.gltf(filepath=str(output / "explorer-blockout.glb"), export_format="GLB",
                         export_animations=False, export_yup=True)
print("EXPLORER_BLOCKOUT", len(rig.data.bones), sum(o.type == "MESH" for o in scene.objects))
