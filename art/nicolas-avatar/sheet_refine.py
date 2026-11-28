"""Bring the explorer closer to Nicolás's 'Vistas de producción' sheet (28 Nov 2026).

    blender -b v27-source.blend --python-exit-code 9 \
        --python art/nicolas-avatar/sheet_refine.py -- v30-source.blend

Mesh and palette edits on the v27 source only; armature, weights and
shape-key deltas are kept, so hero_rig.py and hero_check.py run unchanged:
- warmer, sun-tanned skin; the pink nose patch takes the skin tone;
- smaller honey-hazel eyes under slightly narrowed, smiling lids;
- silver-grey brows, lighter silver hair and beard;
- a short full beard: the long pointed goatee and beard cards are
  shortened below the chin;
- a brighter cyan compass and pack light;
- real hands: the mitten-like glove is replaced by a palm and five
  jointed fingers built along the stock finger bones, each segment rigidly
  weighted to its bone, in a dark fingerless glove with bare fingertips.
"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()

# --- palette (stored sRGB) -------------------------------------------------------
PALETTE = {
    (2, 2): (.76, .52, .37),    # skin: warm tan
    (6, 2): (.74, .47, .36),    # lid blush
    (10, 2): (.70, .45, .33),   # nose patch -> skin shade
    (18, 18): (.74, .49, .36), (22, 18): (.74, .49, .37),
    (2, 6): (.46, .38, .17),    # iris: honey-hazel
    (6, 6): (.22, .16, .07),    # iris rim
    (22, 6): (.58, .55, .51),   # brows: silver-grey
    (26, 6): (.64, .62, .59), (30, 6): (.80, .78, .75), (2, 10): (.45, .43, .41),   # hair
    (6, 10): (.68, .66, .62), (10, 10): (.84, .82, .78), (14, 10): (.50, .48, .45),  # beard
}
EMISSION = {(30, 14): (.10, .80, .95), (2, 18): (.08, .65, .85)}
for name, table in (("Explorer palette base", PALETTE), ("Explorer palette emission", EMISSION)):
    img = bpy.data.images[name]
    w, h = img.size
    px = list(img.pixels)
    for (x, y), rgb in table.items():
        # Paint the whole 4x4 cell around the sampled texel.
        for yy in range(max(0, y - 2), min(h, y + 2)):
            for xx in range(max(0, x - 2), min(w, x + 2)):
                i = (yy * w + xx) * 4
                px[i:i + 3] = rgb
    img.pixels = px
    img.pack()


def edit(obj, fn):
    """Apply fn(world point) to the basis and every shape key alike."""
    M = obj.matrix_world
    Mi = M.inverted()
    blocks = obj.data.shape_keys.key_blocks if obj.data.shape_keys else None
    basis = [v.co.copy() for v in obj.data.vertices]
    for i, v in enumerate(obj.data.vertices):
        v.co = Mi @ fn(M @ basis[i])
    if blocks:
        for kb in blocks:
            for i, d in enumerate(kb.data):
                delta = d.co - basis[i]
                d.co = Mi @ fn(M @ basis[i]) + delta
    obj.data.update()


# --- eyes: smaller, under narrowed smiling lids -----------------------------------
for side, sx in (("l", 1), ("r", -1)):
    c = Vector((sx * .0435, -.085, 1.7355))
    edit(bpy.data.objects["Eye " + side], lambda p, c=c: c + (p - c) * .86)
    edit(bpy.data.objects["Upper lid " + side], lambda p, c=c: p + Vector((0, 0, -.0035)) * (1 - min(1, abs(p.x - c.x) / .03)))
    edit(bpy.data.objects["Lower lid " + side], lambda p, c=c: p + Vector((0, 0, .003)) * (1 - min(1, abs(p.x - c.x) / .03)))

# --- short full beard -----------------------------------------------------------
CHIN = 1.575


def shorten(p):
    if p.z >= CHIN:
        return p
    return Vector((p.x, p.y + (CHIN - p.z) * .15, CHIN + (p.z - CHIN) * .45))


for name in ("Moustache and goatee", "Beard cards", "Beard shell"):
    edit(bpy.data.objects[name], shorten)
# A fuller jaw beard: widen the shell slightly toward the cheeks.
edit(bpy.data.objects["Beard shell"], lambda p: Vector((p.x * 1.05, p.y, p.z)))

# --- hands -----------------------------------------------------------------------
import bmesh  # noqa: E402

arm = bpy.data.objects["SK_BodyA_ArmsHeadless_01"]
glove = bpy.data.objects["Sleeves, armour and gloves"]
FINGERS = ("thumb", "index", "middle", "ring", "pinky")
HAND = {f"hand_{s}" for s in "lr"} | {f"{f}_{k}_{s}" for f in FINGERS for k in ("01", "02", "03", "metacarpal") for s in "lr"}
names = {g.index: g.name for g in glove.vertex_groups}
bm = bmesh.new()
bm.from_mesh(glove.data)
dl = bm.verts.layers.deform.active


def owner(v):
    w = v[dl]
    return names[max(w.keys(), key=lambda k: w[k])] if w else None


doomed = [f for f in bm.faces if all(owner(v) in HAND for v in f.verts)]
lost = {v for f in doomed for v in f.verts}
bmesh.ops.delete(bm, geom=doomed, context="FACES_ONLY")
bmesh.ops.delete(bm, geom=[v for v in lost if not v.link_faces], context="VERTS")
bm.to_mesh(glove.data)
bm.free()
print("GLOVE removed", len(doomed))

P = lambda name: arm.matrix_world @ arm.data.bones[name].head_local  # noqa: E731
GLOVE, SKIN = (22, 14), (2, 2)
RADIUS = {"thumb": .0115, "index": .0098, "middle": .0102, "ring": .0095, "pinky": .0084}
parts = []


def piece(bmx, cell, bone):
    me = bpy.data.meshes.new("Hand piece")
    bmx.to_mesh(me)
    bmx.free()
    o = bpy.data.objects.new("Hand piece", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(bpy.data.materials["Explorer palette"])
    uv = me.uv_layers.new(name=glove.data.uv_layers.active.name)
    for d in uv.data:
        d.uv = ((cell[0] + .5) / 32, (cell[1] + .5) / 32)
    for p in me.polygons:
        p.use_smooth = True
    o.vertex_groups.new(name=bone).add(list(range(len(me.vertices))), 1, "REPLACE")
    parts.append(o)


def segment(a, b, r0, r1, cell, bone):
    bmx = bmesh.new()
    axis = b - a
    mat = axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
    mat.translation = (a + b) / 2
    bmesh.ops.create_cone(bmx, cap_ends=True, segments=10, radius1=r0, radius2=r1, depth=axis.length, matrix=mat)
    for at, r in ((a, r0), (b, r1)):
        bmesh.ops.create_uvsphere(bmx, u_segments=10, v_segments=6, radius=r, matrix=__import__("mathutils").Matrix.Translation(at))
    piece(bmx, cell, bone)


for side in "lr":
    # Palm: the hull of the wrist, knuckles and finger roots, slightly padded.
    pts = [P(f"hand_{side}")] + [P(f"{f}_metacarpal_{side}") for f in FINGERS[1:]] + [P(f"{f}_01_{side}") for f in FINGERS]
    centre = sum(pts, Vector()) / len(pts)
    bmx = bmesh.new()
    for q in pts:
        bmx.verts.new(centre + (q - centre) * 1.12)
    bmesh.ops.convex_hull(bmx, input=bmx.verts)
    bmesh.ops.subdivide_edges(bmx, edges=bmx.edges[:], cuts=1, use_grid_fill=True, smooth=.6)
    piece(bmx, GLOVE, f"hand_{side}")
    for f in FINGERS:
        j = [P(f"{f}_{k}_{side}") for k in ("01", "02", "03")]
        tip = j[2] + (j[2] - j[1]) * .95
        r = RADIUS[f]
        segment(j[0], j[1], r, r * .94, GLOVE, f"{f}_01_{side}")
        segment(j[1], j[2], r * .94, r * .88, GLOVE if f != "thumb" else SKIN, f"{f}_02_{side}")
        segment(j[2], tip, r * .86, r * .72, SKIN, f"{f}_03_{side}")

bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
hands = parts[0]
hands.name = hands.data.name = "Fingered hands"
hands.parent = arm
mod = hands.modifiers.new("Armature", "ARMATURE")
mod.object = arm
for c in glove.users_collection:
    if hands.name not in c.objects:
        c.objects.link(hands)
for c in list(hands.users_collection):
    if c not in glove.users_collection:
        c.objects.unlink(hands)
print("HANDS", sum(len(p.vertices) - 2 for p in hands.data.polygons), "tris")

bpy.ops.wm.save_as_mainfile(filepath=str(out))
print("SHEETREFINE", out)
