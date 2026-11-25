"""Count cape triangles crossing a limb, per authored clip.

  blender -b --python-exit-code 19 --python cape-check.py -- navegante.blend
"""
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index("--") + 1])
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == "ARMATURE")
skin = next(o for o in rig.children if o.type == "MESH")
limbs = {g.index for g in skin.vertex_groups if g.name.split("-")[0] in ("arm", "elbow", "hand", "leg", "shin", "foot")}
cape = {g.index for g in skin.vertex_groups if g.name == "cape"}
kind = []
for v in skin.data.vertices:
    groups = {g.group for g in v.groups if g.weight > 0}
    kind.append("cape" if groups & cape else "limb" if groups & limbs else None)
faces = {name: [tuple(p.vertices) for p in skin.data.polygons if all(kind[i] == name for i in p.vertices)]
         for name in ("cape", "limb")}
tracks = rig.animation_data.nla_tracks
for wanted in tracks:
    for track in tracks:
        track.mute = track != wanted
    end = int(wanted.strips[0].frame_end)
    worst, hits = 0, 0
    for frame in range(0, end + 1, 2):
        scene.frame_set(frame)
        mesh = skin.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
        points = [skin.matrix_world @ v.co for v in mesh.vertices]
        pairs = BVHTree.FromPolygons(points, faces["cape"]).overlap(BVHTree.FromPolygons(points, faces["limb"]))
        hits += bool(pairs)
        worst = max(worst, len(pairs))
    print("CAPE", wanted.name, "frames with contact", hits, "worst pairs", worst)

# Controls: the armature must deform the evaluated mesh, and a forced crossing
# must be detected. Otherwise the zeros above mean nothing.
def posed(angle):
    for track in tracks:
        track.mute = True
    for name in ("arm-L", "arm-R", "cape"):
        bone = rig.pose.bones[name]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (angle, 0, 0)
    bpy.context.view_layer.update()
    data = skin.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    return [skin.matrix_world @ v.co for v in data.vertices]


rest, moved = posed(0), posed(1.0)
shift = max((a - b).length for a, b in zip(rest, moved))
pushed = [p + Vector((0, -.16, 0)) if kind[i] == "cape" else p for i, p in enumerate(rest)]
control = len(BVHTree.FromPolygons(pushed, faces["cape"]).overlap(BVHTree.FromPolygons(pushed, faces["limb"])))
print("CONTROL deformation", round(shift, 3), "crossing pairs", control)
if shift < .1 or not control:
    raise SystemExit("A control failed")
