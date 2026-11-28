"""Bring the packed Navegante closer to the N-3X production sheet.

    blender -b art/compaii-avatar/navegante.blend --python-exit-code 19 \
        --python art/compaii-avatar/n3x_refine.py -- art/compaii-avatar/navegante.blend

Reference: "Vistas de producción y modelado 3D - N-3X compañero IA" (front,
back, top and three-quarter views). Edits the joined skin in place and keeps
every joint name, clip and the mouth-open morph:
- the antenna rises from the top centre of the helmet, a thin brass spike
  leaning slightly back with a cyan light, and its joint moves with it;
- the stub fingertips and pinch thumb become four long two-segment fingers
  with dark knuckles and an opposed two-segment thumb;
- the dark mouth well and ceramic chin under the visor go (the sheet has
  plain marble there); the visor bezel gets its ring of rivets;
- the cape falls to the ankles and widens as it falls;
- the boots get a tall ceramic cuff with a brass band.
Run motion.py afterwards to re-author the clips and export the GLB.
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
assert "N3X refined" not in skin, "already refined"
mats = {m.name: i for i, m in enumerate(skin.data.materials)}
mat = lambda prefix: next(i for n, i in mats.items() if n.startswith(prefix))  # noqa: E731
PORCELAIN, SEAM, BRASS, SIGNAL, CAPE = (mat("Warm ceramic"), mat("Graphite"), mat("Brushed champagne"),
                                        mat("Turquoise"), mat("Woven and embroidered"))
groups = {g.name: g.index for g in skin.vertex_groups}

# --- 1. remove the old antenna, stub fingers, mouth well and chin ----------------
bm = bmesh.new()
bm.from_mesh(skin.data)
dl = bm.verts.layers.deform.active
M = skin.matrix_world


def weighted(v, name):
    return groups[name] in v[dl] and v[dl][groups[name]] > .5


doomed = set()
for f in bm.faces:
    vs = f.verts
    if all(weighted(v, "antenna") for v in vs):
        doomed.add(f)
    elif f.material_index == PORCELAIN and all(weighted(v, "hand-L") or weighted(v, "hand-R") for v in vs):
        doomed.add(f)
    elif all(weighted(v, "anchor-mouth") for v in vs):
        doomed.add(f)
    elif f.material_index == SEAM and all(weighted(v, "head") and abs((M @ v.co).x) < .15 and .87 < (M @ v.co).z < .99
                                          and (M @ v.co).y < -.02 for v in vs):
        doomed.add(f)
verts = {v for f in doomed for v in f.verts}
bmesh.ops.delete(bm, geom=list(doomed), context="FACES_ONLY")
bmesh.ops.delete(bm, geom=[v for v in verts if not v.link_faces], context="VERTS")

# --- 2. cape to the ankles ---------------------------------------------------------
TOP, DEPTH = .786, .422
cape_verts = {v for f in bm.faces if f.material_index == CAPE for v in f.verts}
Mi = M.inverted()
for v in cape_verts:
    w = M @ v.co
    d = max(0.0, TOP - w.z)
    t = d / DEPTH
    w.z = TOP - d * 1.62
    w.x *= 1 + .45 * t
    w.y += .05 * min(1.0, 3 * t) + .035 * t * t
    v.co = Mi @ w
bm.to_mesh(skin.data)
bm.free()
print("REMOVED", len(doomed), "faces; cape verts", len(cape_verts))

# --- 3. new parts -------------------------------------------------------------------
new = []


def part(obj, material_index, bone):
    obj.data.materials.clear()
    for m in skin.data.materials:
        obj.data.materials.append(m)
    for p in obj.data.polygons:
        p.material_index = material_index
        p.use_smooth = True
    obj.vertex_groups.new(name=bone).add([v.index for v in obj.data.vertices], 1, "REPLACE")
    new.append(obj)
    return obj


def apply(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def rod(a, b, r, material_index, bone, r2=None, verts=12):
    a, b = Vector(a), Vector(b)
    edge = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2,
                                    depth=edge.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = edge.to_track_quat("Z", "Y").to_euler()
    apply(o)
    return part(o, material_index, bone)


def ball(at, size, material_index, bone, seg=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=at)
    o = bpy.context.object
    o.scale = size if isinstance(size, tuple) else (size,) * 3
    apply(o)
    return part(o, material_index, bone)


def ring(at, major, minor, material_index, bone, rot=(0, 0, 0), seg=32, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=6, major_radius=major, minor_radius=minor,
                                     location=at, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    apply(o)
    return part(o, material_index, bone)


# Antenna: top centre of the dome (centre (0, .018, 1.044), radii .239/.218/.236).
ANT_BASE = Vector((0, .045, 1.272))
ANT_TIP = Vector((0, .075, 1.43))
ball(ANT_BASE, (.022, .022, .012), BRASS, "antenna", 16, 6)
rod(ANT_BASE, ANT_TIP, .0095, BRASS, "antenna", .0035)
ball(ANT_TIP + Vector((0, .003, .012)), .021, SIGNAL, "antenna", 14, 8)

# Visor bezel rivets (bezel profile scale ~1.04, front face y ~ -.158).
for k in range(22):
    a = 2 * math.pi * k / 22
    ball((.196 * 1.05 * math.cos(a), -.16, 1.054 + .132 * 1.05 * math.sin(a)), .0065, BRASS, "head", 8, 6)

# Hands: four long two-segment fingers and an opposed thumb, palm facing in.
for side in (-1, 1):
    x = lambda v: side * v  # noqa: E731
    hand = "hand-" + ("L" if side < 0 else "R")
    for k in range(4):
        base = Vector((x(.233 + .0125 * k), -.022 + .004 * abs(k - 1.5), .468))
        mid = base + Vector((x(.002 * (k - 1.5)), -.004, -.034 + .003 * abs(k - 1.5)))
        tip = mid + Vector((x(.002 * (k - 1.5)), -.006, -.028 + .003 * abs(k - 1.5)))
        rod(base, mid, .0078, PORCELAIN, hand, .0072, 10)
        ball(mid, .0078, SEAM, hand, 10, 6)
        rod(mid, tip, .0072, PORCELAIN, hand, .0062, 10)
        ball(tip, .0062, PORCELAIN, hand, 10, 6)
        ball(base, .0085, SEAM, hand, 10, 6)
    t0 = Vector((x(.218), -.03, .497))
    t1 = t0 + Vector((x(-.012), -.022, -.022))
    t2 = t1 + Vector((x(-.002), -.016, -.022))
    ball(t0, .0095, SEAM, hand, 10, 6)
    rod(t0, t1, .0092, PORCELAIN, hand, .0085, 10)
    ball(t1, .0085, SEAM, hand, 10, 6)
    rod(t1, t2, .0082, PORCELAIN, hand, .0068, 10)
    ball(t2, .0068, PORCELAIN, hand, 10, 6)

# Boots: a tall ceramic cuff over the ankle with a brass band at its top.
for side in (-1, 1):
    foot = "foot-" + ("L" if side < 0 else "R")
    c = Vector((side * .113, -.012, 0))
    rod(c + Vector((0, 0, .10)), c + Vector((0, 0, .19)), .066, PORCELAIN, foot, .07, 24)
    ring(c + Vector((0, 0, .19)), .07, .009, BRASS, foot, seg=28)
    ring(c + Vector((0, 0, .118)), .066, .006, BRASS, foot, seg=28)

# --- 4. join, move the antenna joint, save ------------------------------------------
bpy.ops.object.select_all(action="DESELECT")
for o in new:
    o.select_set(True)
skin.select_set(True)
bpy.context.view_layer.objects.active = skin
bpy.ops.object.join()
skin["N3X refined"] = True
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
bone = rig.data.edit_bones["antenna"]
bone.head = ANT_BASE
bone.tail = ANT_BASE + Vector((0, 0, .065))
bpy.ops.object.mode_set(mode="OBJECT")
tris = sum(len(p.vertices) - 2 for p in skin.data.polygons)
print("N3X", {"vertices": len(skin.data.vertices), "triangles": tris})
bpy.ops.wm.save_as_mainfile(filepath=str(out))
