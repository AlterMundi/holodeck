"""Give the Navegante a speaking mouth of light on its visor.

    blender -b art/compaii-avatar/navegante.blend --python-exit-code 19 \
        --python art/compaii-avatar/mouth.py -- art/compaii-avatar/navegante.blend

Replaces the thin static "Visor smile" stripe with a luminous lens on the
visor glass, rigid on the head. The "mouth-open" morph target slides the lower
lip down along the curved glass and widens the corners, opening the glow into
a lit "a". `anchor-mouth` and all clips are preserved; the runtime drives the
morph (and the glow strength) from the speech level. Run motion.py afterwards to
re-author the clips and export the GLB.
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
assert not any(m.name.startswith("Luminous mouth") for m in skin.data.materials), "already installed"

VISOR_C, VISOR_R = Vector((0, -.138, 1.054)), Vector((.196, .100, .132))
LIGHT = "Luminous mouth"

# 1. remove the old static smile (turquoise indicator stripe on the head, below the eyes)
signal = next(i for i, m in enumerate(skin.data.materials) if m.name.startswith("Turquoise indicators"))
head = skin.vertex_groups["head"].index
bm = bmesh.new(); bm.from_mesh(skin.data)
dl = bm.verts.layers.deform.active
M = skin.matrix_world
old = {f for f in bm.faces if f.material_index == signal and all(
    abs((M @ v.co).x) < .045 and .97 < (M @ v.co).z < 1.0 and (M @ v.co).y < -.2 and head in v[dl] for v in f.verts)}
assert 20 < len(old) < 400, len(old)
verts = {v for f in old for v in f.verts}
bmesh.ops.delete(bm, geom=list(old), context="FACES_ONLY")
bmesh.ops.delete(bm, geom=[v for v in verts if not v.link_faces], context="VERTS")
bm.to_mesh(skin.data); bm.free()

# 3. luminous lens on the glass: upper lip on head, lower lip on mouth-light
mat = bpy.data.materials.new(LIGHT); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]
glow = (.06, .86, .95)
b.inputs["Base Color"].default_value = (*glow, 1)
b.inputs["Emission Color"].default_value = (*glow, 1)
b.inputs["Emission Strength"].default_value = 3.0
b.inputs["Roughness"].default_value = .3


def on_glass(x, z, lift=.0045):
    """Point on the visor ellipsoid surface (front, -Y) slightly in front of the glass."""
    dx, dz = (x - VISOR_C.x) / VISOR_R.x, (z - VISOR_C.z) / VISOR_R.z
    dy = math.sqrt(max(0.0, 1 - dx * dx - dz * dz))
    n = Vector((dx / VISOR_R.x, -dy / VISOR_R.y, dz / VISOR_R.z)).normalized()
    return Vector((x, VISOR_C.y - VISOR_R.y * dy, z)) + n * lift


W, N = .052, 24                     # half width, columns
upper = lambda t: 1.018 - .017 * (1 - t * t)          # smile curve: corners up  # noqa: E731
lower = lambda t: upper(t) - .0075 * (1 - t * t) ** .7   # thin closed lens  # noqa: E731
me = bpy.data.meshes.new(LIGHT)
bm = bmesh.new()
top, bot = [], []
for i in range(N + 1):
    t = -1 + 2 * i / N
    x = W * t
    top.append(bm.verts.new(on_glass(x, upper(t))))
    bot.append(bm.verts.new(on_glass(x, lower(t)) if 0 < i < N else on_glass(x, upper(t))))
for i in range(N):
    a, b2, c, d = top[i], top[i + 1], bot[i + 1], bot[i]
    if i == 0:
        bm.faces.new((a, b2, c))
    elif i == N - 1:
        bm.faces.new((a, b2, d))
    else:
        bm.faces.new((a, b2, c, d))
bm.verts.index_update()
top_i, bot_i = [v.index for v in top], [v.index for v in bot]
bm.to_mesh(me); bm.free()
lens = bpy.data.objects.new(LIGHT, me)
scene.collection.objects.link(lens)
lens.data.materials.append(mat)
gh = lens.vertex_groups.new(name="head")
gh.add(top_i + bot_i, 1.0, "REPLACE")
for f in me.polygons:
    f.use_smooth = True

# 4. join into the single skinned mesh (the lens vertices are appended after the skin's)
base = len(skin.data.vertices)
bpy.ops.object.select_all(action="DESELECT")
lens.select_set(True); skin.select_set(True)
bpy.context.view_layer.objects.active = skin
bpy.ops.object.join()
assert skin.modifiers and skin.modifiers[0].object == rig
# 5. morph target "mouth-open": the lower lip slides down along the glass into an open glow
light = next(i for i, m in enumerate(skin.data.materials) if m.name.startswith(LIGHT))
inv = skin.matrix_world.inverted()
lens_v = sorted({v for f in skin.data.polygons if f.material_index == light for v in f.vertices})
assert len(lens_v) == 2 * (N + 1) - 2, len(lens_v)
assert lens_v[0] == base
if not skin.data.shape_keys:
    skin.shape_key_add(name="Basis", from_mix=False)
key = skin.shape_key_add(name="mouth-open", from_mix=False)
DEPTH, RISE = .020, .004
for i in range(N + 1):
    t = -1 + 2 * i / N
    k = (1 - t * t) ** .55
    x = W * t * (1 + .08 * k)
    key.data[base + top_i[i]].co = inv @ on_glass(x, upper(t) + RISE * k, .0055)
    key.data[base + bot_i[i]].co = inv @ on_glass(x, (lower(t) - DEPTH * k) if 0 < i < N else upper(t), .0055)
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print("MOUTH", {"removed_faces": len(old), "lens_verts": len(lens_v), "keys": [k.name for k in skin.data.shape_keys.key_blocks]})
