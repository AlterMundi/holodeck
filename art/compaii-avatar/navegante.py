"""Author the selected Navegante design as an editable Blender asset."""
import base64
import json
import math
from array import array
from pathlib import Path
from mathutils import Vector

import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "public/assets/avatar"
MODEL = json.loads((ASSETS / "navegante-white.json").read_text())["avatarModel"]
UNIT = 1 / 515
ORIGIN = (288, 697)
DEPTH = {
    "torso": (.19, -.029), "head": (.19, -.047),
    "mouth-interior": (.009, .055), "lower-shell": (.088, .030),
}
LIMBS = {"leg": (.10, -.009), "arm": (.089, .003), "forearm": (.076, .012),
         "palm": (.055, .025), "elbow": (.032, .016), "wrist": (.034, .024),
         "eye-back": (.007, .055), "eye": (.007, .064),
         "brow-back": (.006, .056), "brow": (.007, .065)}
KNEES = {"leg-left": (230, 584), "leg-right": (332, 584)}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def surface(name, color, roughness, metallic=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return material


def pearl_palette(encoded):
    red, green, blue, alpha = bytes.fromhex(encoded[1:])
    if not alpha:
        return red, green, blue, alpha
    if blue > red * 1.14 and green > red * 1.14:
        return red, green, blue, alpha
    lightness = (.2126 * red + .7152 * green + .0722 * blue) / 255
    shade = 11 + 244 * lightness ** .49
    return min(255, round(shade * 1.035)), round(shade), round(shade * .955), alpha


def artwork():
    atlas = MODEL["atlas"]
    width, height = atlas["width"], atlas["height"]
    palette = [pearl_palette(value) for value in atlas["palette"]]
    indices = base64.b64decode(atlas["pixels"])
    pixels = array("f", (
        channel / 255 for row in reversed(range(height))
        for i in indices[row * width:(row + 1) * width] for channel in palette[i]
    ))
    image = bpy.data.images.new("Navegante — original artwork", width, height, alpha=True)
    image.pixels.foreach_set(pixels)
    image.pack()
    material = surface("Navegante artwork", (1, 1, 1), .56)
    tree = material.node_tree
    shader = tree.nodes.get("Principled BSDF")
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.extension = "CLIP"
    tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    tree.links.new(texture.outputs["Alpha"], shader.inputs["Alpha"])
    return material


art = artwork()
shell = surface("Pearl ceramic", (.74, .751, .77), .34, .1)
joints = surface("Anodized bronze joints", (.28, .135, .04), .44, .24)
mouth = surface("Mouth cavity", (.034, .008, .004), .72)


def point(parent, pivot):
    return ((pivot[0] - parent[0]) * UNIT, 0, (parent[1] - pivot[1]) * UNIT)


def silhouette(node):
    if node.get("clip"):
        return node["clip"]
    if node["type"] == "raster":
        x, y, w, h = node["bounds"]
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    if node["type"] == "ellipse":
        return [(node["cx"] + node["rx"] * math.cos(angle),
                 node["cy"] + node["ry"] * math.sin(angle))
                for angle in (j * math.tau / 24 for j in range(24))]
    return []


def part(node, armature):
    polygon = silhouette(node)
    if not polygon:
        return
    if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(polygon, polygon[1:] + polygon[:1])) > 0:
        polygon = polygon[::-1]
    name = node["id"]
    depth, center = DEPTH.get(name, LIMBS.get(name.rsplit("-", 1)[0], (.028, .037)))
    flat_detail = node["type"] == "raster" and not node.get("clip")
    outline = [point(node["pivot"], pixel) for pixel in polygon]
    count = len(outline)
    cx, cz = (sum(v[axis] for v in outline) / count for axis in (0, 2))
    rings = [(1, .5)] if flat_detail else [(1, .5), (.99, .27), (.95, -.3), (.84, -.5)]
    verts = [(cx + (x - cx) * scale, -(center + depth * offset), cz + (z - cz) * scale)
             for scale, offset in rings for x, _, z in outline]
    faces = [tuple(range(count))]
    for layer in range(len(rings) - 1):
        for i in range(count):
            a, b = layer * count + i, layer * count + (i + 1) % count
            faces.append((b, a, a + count, b + count))
    if len(rings) > 1:
        faces.append(tuple(reversed(range(len(verts) - count, len(verts)))))
    mesh = bpy.data.meshes.new(f"{name} surface")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"{name} geometry", mesh)
    scene.collection.objects.link(obj)
    obj.parent = armature
    obj.location = point(ORIGIN, node["pivot"])
    weights = obj.vertex_groups.new(name=name)
    if name in KNEES:
        lower = obj.vertex_groups.new(name=name.replace("leg-", "shin-"))
        knee = point(node["pivot"], KNEES[name])[2]
        for index, (_, _, height) in enumerate(verts):
            flex = max(0.0, min(1.0, .5 + (knee - height) / .056))
            if flex < 1:
                weights.add([index], 1 - flex, "REPLACE")
            if flex > 0:
                lower.add([index], flex, "REPLACE")
    else:
        weights.add(list(range(len(verts))), 1.0, "REPLACE")
    deformation = obj.modifiers.new("Navegante rig", "ARMATURE")
    deformation.object = armature
    if node["type"] == "raster":
        mesh.materials.append(art)
        mesh.materials.append(shell)
        uv = mesh.uv_layers.new(name="Original artwork")
        x, y, w, h = node["bounds"]
        left, top, width, height = node["rect"]
        atlas = MODEL["atlas"]
        for face in mesh.polygons:
            face.material_index = int(face.index != 0)
            for loop in face.loop_indices:
                px, py = polygon[mesh.loops[loop].vertex_index % count]
                uv.data[loop].uv = ((left + width * (px - x) / w) / atlas["width"],
                                    1 - (top + height * (py - y) / h) / atlas["height"])
    else:
        mesh.materials.append(mouth if name == "mouth-interior" else joints)
    for face in mesh.polygons[1:-1]:
        face.use_smooth = True


rig = bpy.data.armatures.new("Navegante skeleton")
armature = bpy.data.objects.new("Navegante blanco", rig)
scene.collection.objects.link(armature)
armature.show_in_front = True
bpy.context.view_layer.objects.active = armature
armature.select_set(True)
nodes = {node["id"]: node for node in MODEL["nodes"]}
bpy.ops.object.mode_set(mode="EDIT")
for name, node in nodes.items():
    bone = rig.edit_bones.new(name)
    bone.head = Vector(point(ORIGIN, node["pivot"]))
    # The +Y rest axis matches the authored planar transforms; preserve
    # independent locations for facial movement and overlapping rigid pieces.
    bone.tail = bone.head + Vector((0, .085, 0))
for name, node in nodes.items():
    if node.get("parent") in nodes:
        rig.edit_bones[name].parent = rig.edit_bones[node["parent"]]
for leg, pivot in KNEES.items():
    shin = rig.edit_bones.new(leg.replace("leg-", "shin-"))
    shin.head = Vector(point(ORIGIN, pivot))
    shin.tail = shin.head + Vector((0, .085, 0))
    shin.parent = rig.edit_bones[leg]
bpy.ops.object.mode_set(mode="OBJECT")
for node in nodes.values():
    part(node, armature)
for bone in armature.pose.bones:
    bone.rotation_mode = "XYZ"

# Reuse the authored poses on deforming bones. Rigid vertex weights preserve
# the ceramic shells and articulated joints as the rig moves.
animations = dict(MODEL["animations"])
animations["walk"] = [
    {"node": name, "channel": "swing",
     "frames": [math.sin(i * math.tau / 8) * amplitude for i in range(8)]}
    for name, amplitude in [("leg-left", .62), ("leg-right", -.62),
                            ("arm-left", -.23), ("arm-right", .23)]
] + [
    {"node": "torso", "channel": "y", "frames": [-4, -2, 0, -2, -4, -2, 0, -2]},
    {"node": "shin-left", "channel": "swing", "frames": [0, .12, .36, .47, .18, 0, 0, 0]},
    {"node": "shin-right", "channel": "swing", "frames": [.18, 0, 0, 0, 0, .12, .36, .47]},
    {"node": "elbow-fold-left", "channel": "swing", "frames": [.22, .28, .3, .25, .22, .14, .12, .16]},
    {"node": "elbow-fold-right", "channel": "swing", "frames": [.22, .14, .12, .16, .22, .28, .3, .25]},
]
data = armature.animation_data_create()
channels = {"x": ("location", 0, UNIT), "y": ("location", 2, -UNIT),
            "rotate": ("rotation_euler", 1, 1), "swing": ("rotation_euler", 0, 1),
            "scaleX": ("scale", 0, 1), "scaleY": ("scale", 2, 1)}
for name, tracks in animations.items():
    clip = bpy.data.actions.new(name)
    data.action = clip
    for track in tracks:
        bone = armature.pose.bones[track["node"]]
        prop, axis, factor = channels[track["channel"]]
        component = getattr(bone, prop)
        rest = component[axis]
        for i, value in enumerate([*track["frames"], track["frames"][0]]):
            component[axis] = rest * value if prop == "scale" else rest + value * factor
            bone.keyframe_insert(data_path=prop, index=axis, frame=1 + i * (3 if name == "walk" else 4))
        component[axis] = rest
    for curve in clip.layers[0].strips[0].channelbag(data.action_slot).fcurves:
        for keyframe in curve.keyframe_points:
            keyframe.interpolation = "LINEAR"
    data.action = None
    nla = data.nla_tracks.new()
    nla.name = name
    nla.strips.new(name, 1, clip)
    nla.mute = name != "calm"

scene.frame_end = 49
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_suffix(".blend")))
for track in data.nla_tracks:
    track.mute = False
bpy.ops.export_scene.gltf(filepath=str(ASSETS / "navegante-blender.glb"), export_format="GLB",
                          export_animation_mode="NLA_TRACKS", export_frame_range=False,
                          export_force_sampling=True, export_optimize_animation_keep_anim_armature=False,
                          export_anim_slide_to_zero=True,
                          export_yup=True)
