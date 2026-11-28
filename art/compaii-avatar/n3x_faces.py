"""Turn the N-3X visor into an LED face screen.

    blender -b art/compaii-avatar/navegante.blend --python-exit-code 19 \
        --python art/compaii-avatar/n3x_faces.py -- art/compaii-avatar/navegante.blend

Removes the modelled cyan pupils, brows and mouth lens and adds one thin
screen over the visor glass, rigid on the head, with UVs spanning the visor
ellipse. Its material is named "Visor LED screen"; src/navegante-screen.mjs
draws every expression and the speaking mouth on it as lit pixels. The
`mouth-open` morph and all joints stay. Run motion.py afterwards to export.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == "ARMATURE")
skin = next(o for o in scene.objects if o.type == "MESH" and o.parent == rig)
assert skin.get("N3X refined") and not skin.get("N3X screen"), "run after n3x_refine.py, once"
mats = {m.name: i for i, m in enumerate(skin.data.materials)}
SIGNAL = next(i for n, i in mats.items() if n.startswith("Turquoise"))
MOUTH = [i for n, i in mats.items() if n.startswith("Luminous mouth")]
groups = {g.name: g.index for g in skin.vertex_groups}
eyes = {groups["eye-L"], groups["eye-R"]}

bm = bmesh.new()
bm.from_mesh(skin.data)
dl = bm.verts.layers.deform.active
doomed = {f for f in bm.faces if f.material_index in MOUTH or
          f.material_index == SIGNAL and all(any(g in v[dl] and v[dl][g] > .5 for g in eyes) for v in f.verts)}
verts = {v for f in doomed for v in f.verts}
bmesh.ops.delete(bm, geom=list(doomed), context="FACES_ONLY")
bmesh.ops.delete(bm, geom=[v for v in verts if not v.link_faces], context="VERTS")
bm.to_mesh(skin.data)
bm.free()
print("REMOVED", len(doomed))

C, R = Vector((0, -.138, 1.054)), Vector((.196, .100, .132))


def on_glass(x, z, lift=.004):
    dx, dz = (x - C.x) / R.x, (z - C.z) / R.z
    dy = math.sqrt(max(0.0, 1 - dx * dx - dz * dz))
    n = Vector((dx / R.x, -dy / R.y, dz / R.z)).normalized()
    return Vector((x, C.y - R.y * dy, z)) + n * lift


rings, seg, reach = 14, 64, .94
verts, faces, uvs = [], [], []
for r in range(rings + 1):
    for k in range(seg if r else 1):
        a = 2 * math.pi * k / seg
        s, t = reach * r / rings * math.cos(a), reach * r / rings * math.sin(a)
        verts.append(on_glass(C.x + R.x * s, C.z + R.z * t))
        uvs.append((s * .5 + .5, t * .5 + .5))
idx = lambda r, k: 0 if r == 0 else 1 + (r - 1) * seg + k % seg  # noqa: E731
faces += [(0, idx(1, k), idx(1, k + 1)) for k in range(seg)]
faces += [(idx(r, k), idx(r + 1, k), idx(r + 1, k + 1), idx(r, k + 1)) for r in range(1, rings) for k in range(seg)]
mesh = bpy.data.meshes.new("Visor LED screen")
mesh.from_pydata([tuple(v) for v in verts], [], faces)
mesh.update()
layer = mesh.uv_layers.new(name=skin.data.uv_layers[0].name if skin.data.uv_layers else "UVMap")
for poly in mesh.polygons:
    for li in poly.loop_indices:
        layer.data[li].uv = uvs[mesh.loops[li].vertex_index]
screen = bpy.data.objects.new("Visor LED screen", mesh)
scene.collection.objects.link(screen)
material = bpy.data.materials.new("Visor LED screen")
material.use_nodes = True
shader = material.node_tree.nodes["Principled BSDF"]
shader.inputs["Base Color"].default_value = (0, 0, 0, 1)
shader.inputs["Emission Color"].default_value = (.2, .95, 1, 1)
shader.inputs["Emission Strength"].default_value = 1.0
for m in skin.data.materials:
    screen.data.materials.append(m)
screen.data.materials.append(material)
for p in mesh.polygons:
    p.material_index = len(screen.data.materials) - 1
    p.use_smooth = True
screen.vertex_groups.new(name="head").add(list(range(len(verts))), 1, "REPLACE")
bpy.ops.object.select_all(action="DESELECT")
screen.select_set(True)
skin.select_set(True)
bpy.context.view_layer.objects.active = skin
bpy.ops.object.join()
skin["N3X screen"] = True
print("N3X screen", {"vertices": len(skin.data.vertices),
                     "triangles": sum(len(p.vertices) - 2 for p in skin.data.polygons)})
bpy.ops.wm.save_as_mainfile(filepath=str(out))
