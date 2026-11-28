"""Build the diving-helmet Navegante variants from scratch.

    blender -b --python-exit-code 19 --python navegante_escafandra.py -- OUTPUT [--bronze]

Without --bronze: the white-ceramic diving helmet with a face drawn live by
src/navegante-face.mjs (the 28 Nov 2026 escafandra option).
With --bronze: the aged-bronze navigator of Nicolás's 28 Nov reference: patinated
bronze and cracked ivory ceramic with gold scrollwork, a dark visor that is an
LED screen (src/navegante-screen.mjs, blue slit eyes at rest), an olive scarf
and floor-length cape with gold laurel, a "II" plate on the belly, knee discs
and tall boots. Both are alternatives to the N-3X; see README.md.

The design follows CompAII's navigator identity (navigator-neutral-master-v6,
navigator-turnaround-v1 and the nine-expression gallery v6): a crackled ceramic
diving helmet with a riveted brass porthole, side vents and crown band; a face
plate behind dark glass whose brows, eyes and mouth are drawn live by the
runtime (src/navegante-face.mjs); a thick slate knit scarf with a star brooch
and a cape embroidered with gold laurel; a round ceramic body with brass joint
rings, open hands and heavy riveted boots.

Everything here is authored for Holodeck: geometry, armature, and textures
generated procedurally below (no image inputs). The joint names, the unkeyed
`anchor-mouth` and `eye-*` joints, and the clip library in motion.py keep the
runtime contract of the earlier Navegante.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import motion  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()
BRONZE = "--bronze" in args
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = 0
bpy.context.preferences.filepaths.save_version = 0
rng = np.random.default_rng(1107)
parts = []

# --- Procedural textures -----------------------------------------------------


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - .055)


def to_image(name, rgb, colour=True):
    h, w, _ = rgb.shape
    image = bpy.data.images.new(name, w, h, alpha=False)
    if not colour:
        image.colorspace_settings.name = "Non-Color"
    # Texture colours below are authored directly as sRGB values.
    data = np.clip(rgb, 0, 1)
    rgba = np.concatenate([data, np.ones((h, w, 1))], -1)[::-1]
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.pack()
    return image


def periodic_noise(n, cells, seed):
    g = np.random.default_rng(seed).random((cells, cells))
    x = np.arange(n) / n * cells
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    i0, i1 = i % cells, (i + 1) % cells
    a = g[np.ix_(i0, i0)] * (1 - f[None, :]) + g[np.ix_(i0, i1)] * f[None, :]
    b = g[np.ix_(i1, i0)] * (1 - f[None, :]) + g[np.ix_(i1, i1)] * f[None, :]
    return a * (1 - f[:, None]) + b * f[:, None]


def fbm(n, base, seed, octaves=4):
    total, amp, norm = 0, 1, 0
    for k in range(octaves):
        total = total + amp * periodic_noise(n, base * 2 ** k, seed + k)
        norm += amp
        amp *= .5
    return total / norm


def voronoi_edges(n, cells, seed, jitter=.9):
    """Distance to the nearest cell border of a tileable Voronoi diagram."""
    g = np.random.default_rng(seed)
    pts = (np.arange(cells)[:, None, None] * 0 + 0.0)
    centres = (np.stack(np.meshgrid(np.arange(cells), np.arange(cells), indexing="ij"), -1)
               + .5 + (g.random((cells, cells, 2)) - .5) * jitter)
    y, x = np.mgrid[0:n, 0:n] / n * cells
    p = np.stack([y, x], -1)
    best = np.full((n, n), 1e9)
    second = np.full((n, n), 1e9)
    cy, cx = np.floor(y).astype(int), np.floor(x).astype(int)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ny, nx = cy + dy, cx + dx
            c = centres[ny % cells, nx % cells] + np.stack([ny - ny % cells, nx - nx % cells], -1)
            d = np.linalg.norm(p - c, axis=-1)
            second = np.where(d < best, best, np.minimum(second, d))
            best = np.minimum(best, d)
    del pts
    return (second - best) / cells * n  # in pixels-ish


def ceramic_textures(n=512):
    warp = fbm(n, 4, 11) - .5
    big = voronoi_edges(n, 9, 21)
    small = voronoi_edges(n, 26, 22)
    crack = np.clip(1 - big / 1.6, 0, 1) ** 1.5 + .55 * np.clip(1 - small / 1.1, 0, 1) ** 2
    crack = np.clip(crack * (.75 + .5 * fbm(n, 6, 31)), 0, 1)
    tone = fbm(n, 3, 41)
    base = np.array([.84, .66, .52]) * (.9 + .2 * tone[..., None])
    blush = np.clip(fbm(n, 5, 51) - .62, 0, 1)[..., None] * np.array([.35, .12, .02]) * 1.6
    speck = (fbm(n, 64, 61, 2) > .74)[..., None] * np.array([-.10, -.12, -.12])
    colour = base - blush + speck
    if BRONZE:
        # Aged ivory under grime, with verdigris blooms and gold scrollwork.
        grime = fbm(n, 6, 81)
        colour = colour * (.55 + .22 * grime[..., None]) * np.array([.92, .86, .74])
        patina = np.clip((fbm(n, 5, 91) - .6) * 4, 0, 1)[..., None]
        colour = colour * (1 - .55 * patina) + np.array([.22, .36, .28]) * .55 * patina
        y, x = np.mgrid[0:n, 0:n] / n
        cells = 4
        cx, cy = (x * cells) % 1 - .5, (y * cells) % 1 - .5
        flip = ((np.floor(x * cells) + np.floor(y * cells)) % 2) * 2 - 1
        r, th = np.hypot(cx, cy), np.arctan2(cy, cx * flip)
        spiral = np.abs(((r * 26 - th / (2 * np.pi) * 3) % 3) - 1.5) < .28
        scroll = (spiral & (r < .42) & (r > .06)).astype(float)
        colour = colour * (1 - .85 * scroll[..., None]) + np.array([.78, .58, .22]) * .85 * scroll[..., None]
        crack = np.maximum(crack, scroll * .4)
    colour = colour * (1 - .5 * crack[..., None]) + crack[..., None] * np.array([.06, .03, .01])
    height = -crack * .9 + warp * .2
    gy, gx = np.gradient(height)
    normal = np.stack([-gx * 2.5, gy * 2.5, np.ones_like(gx)], -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return to_image("Crackled ceramic", colour), to_image("Crackled ceramic relief", normal * .5 + .5, False)


def knit_texture(n=512):
    y, x = np.mgrid[0:n, 0:n] / n
    rows, cols = 40, 30
    u, v = (x * cols) % 1, (y * rows) % 1
    # Chevron stitches: two leaning loops per column.
    lean = np.abs(u - .5) * 2
    loop = np.exp(-((v - .5 - .35 * (lean - .5)) / .28) ** 2)
    stitch = loop * (1 - .55 * lean ** 3)
    fuzz = fbm(n, 64, 71, 2)
    tone = fbm(n, 4, 72)
    base = (np.array([.30, .28, .17]) if BRONZE else np.array([.30, .30, .50])) * (.8 + .4 * tone[..., None])
    colour = base * (.55 + .65 * stitch[..., None]) * (.85 + .3 * fuzz[..., None])
    # Sparse gold fleck stitches, as in the scarf of the reference.
    fleck = ((np.floor(x * cols) + 2 * np.floor(y * rows)) % 7 == 0) & (stitch > .7)
    colour = np.where(fleck[..., None], np.array([.80, .62, .26]) * (.8 + .3 * stitch[..., None]), colour)
    height = stitch * .8 + fuzz * .2
    gy, gx = np.gradient(height)
    normal = np.stack([-gx * 6, gy * 6, np.ones_like(gx)], -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return to_image("Slate knit", colour), to_image("Slate knit relief", normal * .5 + .5, False), colour


def laurel_texture(knit, n=512):
    """Cape panel: knit ground, gold running-stitch borders and a laurel branch."""
    colour = knit.copy()
    h, w, _ = colour.shape
    y, x = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    gold = np.array([.90, .68, .24])
    ink = np.zeros((h, w))
    # Borders (bottom and sides) of dashed gold stitches.
    for d in (x - .045, .955 - x, y - .05):
        ink = np.maximum(ink, np.exp(-(d / .008) ** 2) * (np.sin((x + y) * 260) > -.2))
    # Laurel: a stem curving up the middle with paired leaves.
    t = np.linspace(.12, .95, 400)
    stem = np.stack([.5 + .08 * np.sin(t * 5.2), t], -1)
    for sx, sy in stem:
        ink = np.maximum(ink, np.exp(-(((x - sx) ** 2 + (y - sy) ** 2) / .006 ** 2)))
    for k, ty in enumerate(np.linspace(.16, .9, 11)):
        sx = .5 + .08 * np.sin(ty * 5.2)
        for side in (-1, 1):
            ang = side * (.9 - .25 * (k % 2))
            cx, cy = sx + side * .07 * math.cos(.4), ty + .05
            dx, dy = x - cx, y - cy
            ca, sa = math.cos(ang), math.sin(ang)
            lu = dx * ca + dy * sa
            lv = -dx * sa + dy * ca
            leaf = (lu / .055) ** 2 + (lv / .021) ** 2
            ink = np.maximum(ink, np.clip(1.4 - leaf, 0, 1) ** .6)
    thread = .75 + .25 * np.sin(x * 900 + y * 300) ** 2
    colour = colour * (1 - ink[..., None]) + gold * thread[..., None] * ink[..., None]
    return to_image("Laurel embroidered cape", colour)


ceramic_map, ceramic_relief = ceramic_textures()
knit_map, knit_relief, knit_rgb = knit_texture()
laurel_map = laurel_texture(knit_rgb)

# --- Materials -----------------------------------------------------------------


def material(name, color, roughness, metal=0.0, glow=0.0, *, image=None, normal=None, strength=.5,
             alpha=1.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = alpha >= 1
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Coat Weight"].default_value = coat
    if glow:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = glow
    if alpha < 1:
        shader.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "BLENDED"
    if image is not None:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    if normal is not None:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = normal
        nm = nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = strength
        links.new(tex.outputs["Color"], nm.inputs["Color"])
        links.new(nm.outputs["Normal"], shader.inputs["Normal"])
    return mat


ceramic = material("Crackled ceramic", (.80, .66, .52), .34, image=ceramic_map, normal=ceramic_relief,
                   strength=.6, coat=.25)
face = (material("Visor LED screen · slits", (0, 0, 0), .2) if BRONZE else
        material("Navegante face", (.80, .66, .52), .38, image=ceramic_map, normal=ceramic_relief, strength=.4))
brass = material("Patinated bronze" if BRONZE else "Riveted brass", (.24, .15, .07) if BRONZE else (.30, .16, .05),
                 .52 if BRONZE else .38, .85 if BRONZE else .95)
dark_brass = material("Dark brass grille", (.20, .12, .05), .5, .8)
knit = material("Olive knit" if BRONZE else "Slate knit", (.17, .17, .30), .92, image=knit_map, normal=knit_relief, strength=.8)
cape_cloth = material("Laurel cape", (.17, .17, .30), .9, image=laurel_map, normal=knit_relief, strength=.6)
cape_cloth.use_backface_culling = False
glass = material("Visor glass", (.02, .02, .025) if BRONZE else (.08, .02, .015), .05, alpha=.25 if BRONZE else .07)
amber = material("Amber lens", (1.0, .36, .04), .2, glow=.45)
recess = material("Dark recess", (.03, .015, .01), .7)

# --- Geometry helpers ------------------------------------------------------------


def finish(obj, mat, bone, smooth=True, uv_scale=None):
    obj.data.materials.append(mat)
    for face_ in obj.data.polygons:
        face_.use_smooth = smooth
    if uv_scale:
        box_uv(obj, uv_scale)
    parts.append((obj, bone))
    return obj


def apply(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def box_uv(obj, scale):
    """Tri-planar style box projection, enough for tileable ceramic and knit."""
    mesh = obj.data
    uv = mesh.uv_layers.get("UVMap") or mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            a, b = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            uv.data[li].uv = (a * scale, b * scale)


def sphere(name, at, size, mat, bone, seg=32, rings=16, uv=2.2):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    apply(obj)
    return finish(obj, mat, bone, uv_scale=uv)


def ico(name, at, r, mat, bone, sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=at)
    obj = bpy.context.object
    obj.name = name
    apply(obj)
    return finish(obj, mat, bone)


def torus(name, at, major, minor, mat, bone, rot=(0, 0, 0), seg=48, minor_seg=10, scale=(1, 1, 1), uv=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg, minor_segments=minor_seg, major_radius=major,
                                     minor_radius=minor, location=at, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply(obj)
    return finish(obj, mat, bone, uv_scale=uv)


def cylinder(name, a, b, r, mat, bone, verts=20, r2=None):
    a, b = Vector(a), Vector(b)
    edge = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2,
                                    depth=edge.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = edge.to_track_quat("Z", "Y").to_euler()
    apply(obj)
    bev = obj.modifiers.new("Soft edges", "BEVEL")
    bev.width = min(r * .25, edge.length * .25)
    bev.segments = 2
    bpy.ops.object.modifier_apply(modifier=bev.name)
    return finish(obj, mat, bone, uv_scale=3)


def capsule(name, a, b, r, mat, bone, r2=None):
    """A tapered limb shell: cylinder with domed ends."""
    obj = cylinder(name, a, b, r, mat, bone, verts=16 if r > .02 else 8, r2=r2)
    seg = 14 if r > .02 else 8
    sphere(name + " cap A", a, (r * .98,) * 3, mat, bone, seg, seg // 2, 3)
    sphere(name + " cap B", b, ((r2 or r) * .98,) * 3, mat, bone, seg, seg // 2, 3)
    return obj


def rivets(name, points, r, bone, mat=None, sub=0):
    for i, p in enumerate(points):
        ico(f"{name} rivet {i}", p, r, mat or brass, bone, sub)


def ring_points(centre, normal, radius, count, phase=0.0):
    n = Vector(normal).normalized()
    a = Vector((1, 0, 0)) if abs(n.x) < .9 else Vector((0, 1, 0))
    u = n.cross(a).normalized()
    v = n.cross(u)
    return [Vector(centre) + radius * (math.cos(phase + 2 * math.pi * k / count) * u
                                         + math.sin(phase + 2 * math.pi * k / count) * v) for k in range(count)]


# --- Head: crackled ceramic diving helmet ------------------------------------------
HEAD_C = Vector((0, .02, .985))
HEAD_R = Vector((.30, .285, .285))
# Front porthole, tilted a little downward like the reference.
PORT_C = Vector((0, -.218, .955))
PORT_N = Vector((0, -1, -.12)).normalized()
PORT_R = .205
helmet = sphere("Helmet", HEAD_C, HEAD_R, ceramic, "head", 44, 26, 2.4)
# Open the shell where the porthole sits; the bezel covers the clean cut.
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=PORT_R + .006, depth=.24,
                                    location=PORT_C + PORT_N * .06)
cutter = bpy.context.object
cutter.rotation_euler = PORT_N.to_track_quat("Z", "Y").to_euler()
apply(cutter)
boolean = helmet.modifiers.new("Porthole opening", "BOOLEAN")
boolean.operation = "DIFFERENCE"
boolean.object = cutter
boolean.solver = "EXACT"
bpy.ops.object.select_all(action="DESELECT")
helmet.select_set(True)
bpy.context.view_layer.objects.active = helmet
bpy.ops.object.modifier_apply(modifier=boolean.name)
bpy.data.objects.remove(cutter)
for index in reversed(range(len(helmet.material_slots))):
    if helmet.material_slots[index].material is None:
        helmet.active_material_index = index
        bpy.ops.object.material_slot_remove()
box_uv(helmet, 2.4)
tilt = PORT_N.to_track_quat("Z", "Y").to_euler()
torus("Porthole bezel", PORT_C, PORT_R, .03, brass, "head", tilt, 64, 12, (1, 1, .55))
torus("Porthole lip", PORT_C + PORT_N * -.006, PORT_R + .028, .012, brass, "head", tilt, 64, 8)
rivets("Porthole", ring_points(PORT_C + PORT_N * .018, PORT_N, PORT_R, 18, .17), .0105, "head", sub=1)


def face_plate():
    """Ceramic face set back inside the porthole: a shallow dome facing -Y."""
    rings, seg = 14, 64
    radius = PORT_R - .012
    verts, faces = [], []
    centre = PORT_C - PORT_N * -.035  # recessed behind the bezel
    centre = PORT_C + Vector((0, .035, 0))
    for r in range(rings + 1):
        rr = radius * r / rings
        bulge = .045 * (1 - (r / rings) ** 2)
        for s in range(seg if r else 1):
            a = 2 * math.pi * s / seg
            x, z = rr * math.cos(a), rr * math.sin(a)
            verts.append((centre.x + x, centre.y - bulge, centre.z + z))
    def idx(r, s):
        return 0 if r == 0 else 1 + (r - 1) * seg + s % seg
    for s in range(seg):
        faces.append((0, idx(1, s), idx(1, s + 1)))
    for r in range(1, rings):
        for s in range(seg):
            faces.append((idx(r, s), idx(r + 1, s), idx(r + 1, s + 1), idx(r, s + 1)))
    mesh = bpy.data.meshes.new("Navegante face")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Navegante face", mesh)
    scene.collection.objects.link(obj)
    finish(obj, face, "head", uv_scale=None)
    uv = mesh.uv_layers.new(name="UVMap")
    for li, loop in enumerate(mesh.loops):
        co = mesh.vertices[loop.vertex_index].co
        k = .5 / radius if BRONZE else 2.2
        uv.data[li].uv = ((co.x - centre.x) * k + .5, (co.z - centre.z) * k + .5)
    return obj, centre, radius


face_obj, FACE_C, FACE_R = face_plate()
if BRONZE:
    # A black panel behind the LED screen, so the lit pixels read on dark glass.
    sphere("Screen backing", FACE_C + Vector((0, .012, 0)), (FACE_R, .004, FACE_R), recess, "head", 40, 8)
# The jaw seam rim and dark well around the face, so the plate reads as set in.
torus("Face well", FACE_C + Vector((0, -.004, 0)), FACE_R + .004, .012, recess, "head",
      (math.pi / 2, 0, 0), 64, 6)

# Visor glass: a thin cap just inside the bezel, with a clean round edge.
def glass_cap():
    rings, seg = 6, 48
    radius = PORT_R + .004
    centre = PORT_C + Vector((0, .01, 0))
    verts, faces = [], []
    for r in range(rings + 1):
        rr = radius * r / rings
        bulge = .03 * (1 - (r / rings) ** 2)
        for k in range(seg if r else 1):
            a = 2 * math.pi * k / seg
            verts.append((centre.x + rr * math.cos(a), centre.y - bulge, centre.z + rr * math.sin(a)))
    idx = lambda r, k: 0 if r == 0 else 1 + (r - 1) * seg + k % seg  # noqa: E731
    faces += [(0, idx(1, k + 1), idx(1, k)) for k in range(seg)]
    faces += [(idx(r, k), idx(r, k + 1), idx(r + 1, k + 1), idx(r + 1, k)) for r in range(1, rings) for k in range(seg)]
    mesh = bpy.data.meshes.new("Visor glass")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Visor glass", mesh)
    scene.collection.objects.link(obj)
    obj.rotation_euler = (-.12, 0, 0)
    obj.location = (0, 0, 0)
    return finish(obj, glass, "head")


glass_cap()

# Nose: brass socket with an amber lens.
NOSE = FACE_C + Vector((0, -.062, -.03))
sphere("Nose socket", NOSE, (.026, .022, .026), brass, "head", 20, 12)
sphere("Nose lens", NOSE + Vector((0, -.014, .003)), (.017, .012, .017), amber, "head", 16, 10)

# Crown band, front strap and tab.
CROWN = HEAD_C + Vector((0, 0, .215))
torus("Crown band", CROWN, .19, .016, brass, "head", (0, 0, 0), 56, 8, (1, 1, .7))
rivets("Crown band", ring_points(CROWN + Vector((0, 0, .012)), (0, 0, 1), .19, 16), .009, "head")
# A flat tab on the crown band, front and centre.
tab_n = Vector((0, -math.sin(math.radians(38)), math.cos(math.radians(38))))
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1,
                                     location=HEAD_C + Vector((tab_n.x * HEAD_R.x, tab_n.y * HEAD_R.y, tab_n.z * HEAD_R.z)) * 1.01)
tab = bpy.context.object
tab.name = "Crown tab"
tab.scale = (.034, .05, .008)
tab.rotation_euler = tab_n.to_track_quat("Z", "Y").to_euler()
apply(tab)
finish(tab, brass, "head")

# Side portholes with grilles.
for side in (-1, 1):
    s = "L" if side < 0 else "R"
    c = HEAD_C + Vector((side * .292, .02, -.02))
    n = Vector((side, 0, 0))
    rot = (0, math.pi / 2, 0)
    torus(f"Vent ring {s}", c, .072, .016, brass, "head", rot, 40, 8)
    cylinder(f"Vent well {s}", c - n * .01, c + n * .004, .066, recess, "head", 32)
    for k in (-2, -1, 0, 1, 2):
        cylinder(f"Vent bar {s}{k}", c + Vector((side * .004, -.055, k * .022)), c + Vector((side * .004, .055, k * .022)),
                 .0065, dark_brass, "head", 8)
    rivets(f"Vent {s}", ring_points(c + n * .012, n, .072, 8, .3), .008, "head")

# Antenna joint: a small crown knob, the only thing it carries now.
sphere("Crown cap", HEAD_C + Vector((0, .0, .276)), (.06, .06, .012), brass, "antenna", 20, 6)

# --- Body ----------------------------------------------------------------------------
BELLY = Vector((0, .005, .50))
sphere("Belly", BELLY, (.19, .165, .205), ceramic, "chest", 40, 24, 2.6)
sphere("Hip shell", Vector((0, .01, .37)), (.15, .13, .08), ceramic, "hips", 32, 16, 2.6)
torus("Waist ring", Vector((0, .008, .345)), .125, .012, brass, "hips", (0, 0, 0), 40, 8, (1, .9, 1))

# Scarf: two thick, lumpy knit rolls around the neck, with folds.
def lumpy(obj, seed, amount):
    g = np.random.default_rng(seed)
    phases = g.random(4) * 6.283
    for v in obj.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        k = (math.sin(3 * a + phases[0]) * .5 + math.sin(7 * a + phases[1]) * .3
             + math.sin(13 * a + phases[2]) * .2) * amount
        v.co += v.normal * k
    return obj


lumpy(torus("Scarf roll", Vector((0, .0, .70)), .19, .078, knit, "chest", (0, 0, 0), 48, 14, (1.1, 1.02, .82), uv=5), 3, .018)
lumpy(torus("Scarf roll upper", Vector((.012, .006, .765)), .165, .06, knit, "chest", (.1, -.06, 0), 44, 12, (1.12, 1.0, .8), uv=5), 4, .014)
# Brooch with an eight-point star.
BROOCH = Vector((.035, -.305, .69))
cylinder("Brooch", BROOCH + Vector((0, .02, 0)), BROOCH, .052, brass, "chest", 32)
torus("Brooch rim", BROOCH, .047, .008, brass, "chest", (math.pi / 2, 0, 0), 32, 6)
for k in range(8):
    a = k * math.pi / 4
    L = .036 if k % 2 == 0 else .022
    tip = BROOCH + Vector((math.cos(a) * L, -.006, math.sin(a) * L))
    cylinder(f"Brooch star {k}", BROOCH + Vector((0, -.006, 0)), tip, .007, brass, "chest", 4, .001)


def drape(name, bone_weights, rows, cols, point, uv_rect=(0, 0, 1, 1), mat=cape_cloth):
    verts = [point(i / cols, j / rows) for j in range(rows + 1) for i in range(cols + 1)]
    faces = [(j * (cols + 1) + i, j * (cols + 1) + i + 1, (j + 1) * (cols + 1) + i + 1, (j + 1) * (cols + 1) + i)
             for j in range(rows) for i in range(cols)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    solid = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
    solid.thickness = .012
    uv = mesh.uv_layers.new(name="UVMap")
    u0, v0, u1, v1 = uv_rect
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            j, i = divmod(mesh.loops[li].vertex_index, cols + 1)
            uv.data[li].uv = (u0 + (u1 - u0) * i / cols, v1 - (v1 - v0) * j / rows)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    if bone_weights:
        for bone, fn in bone_weights.items():
            group = obj.vertex_groups.new(name=bone)
            for v in obj.data.vertices:
                w = fn(v.co)
                if w > 0:
                    group.add([v.index], w, "REPLACE")
        parts.append((obj, None))
    return obj


def front_panel(side):
    def point(u, v):
        # Hangs from under the scarf down the front, leaving the belly open.
        inner, outer = .03 + .05 * v, .2 + .09 * v
        x = side * (inner + (outer - inner) * (u if side > 0 else 1 - u))
        z = .68 - .38 * v
        wrap = math.sqrt(max(0.0, 1 - (x / .26) ** 2))
        y = -(.17 + .03 * (1 - v)) * wrap - .03 - .028 * math.sin(u * 9 + v * 3) * v - .04 * v * v
        return (x, y, z)
    return point


for side in (-1, 1):
    drape("Front cape " + ("L" if side < 0 else "R"), {"chest": lambda co: 1.0}, 10, 8, front_panel(side))


def back_cape(u, v):
    width = .23 + .13 * v
    a = (u - .5) * math.pi * 1.1
    x = math.sin(a) * width
    y = .12 + math.cos(a) * (.11 + .08 * v) + .03 * v + .02 * math.sin(u * 14) * v
    z = .69 - (.66 if BRONZE else .45) * v
    return (x, y, z)


drape("Back cape", {"chest": lambda co: max(0.0, 1 - ((.69 - co.z) / .42) ** 1.5),
                    "cape": lambda co: min(1.0, ((.69 - co.z) / .42) ** 1.5)}, 10, 16, back_cape)

if BRONZE:
    # A raised "II" plate on the belly, as on the reference.
    for dx in (-.022, .022):
        cylinder("Belly numeral", Vector((dx, -.175, .44)), Vector((dx, -.175, .53)), .009, brass, "chest", 6)
    for z in (.44, .53):
        cylinder("Belly numeral serif", Vector((-.04, -.177, z)), Vector((.04, -.177, z)), .006, brass, "chest", 6)

# --- Limbs ------------------------------------------------------------------------------
for side in (-1, 1):
    s = "L" if side < 0 else "R"
    d = "left" if side < 0 else "right"
    x = lambda v: side * v  # noqa: E731
    sh, el, wr = Vector((x(.205), .0, .60)), Vector((x(.25), -.005, .475)), Vector((x(.272), -.015, .375))
    sphere(f"Shoulder {s}", sh, (.05, .05, .05), ceramic, f"arm-{s}", 24, 12, 3)
    torus(f"Shoulder ring {s}", sh + Vector((x(.02), 0, -.02)), .043, .012, brass, f"arm-{s}",
          (0, math.pi / 2 - side * .4, 0), 28, 8)
    capsule(f"Upper arm {s}", sh + (el - sh) * .2, el - (el - sh) * .12, .041, ceramic, f"arm-{s}", .037)
    torus(f"Elbow ring {s}", el, .036, .012, brass, f"elbow-{s}", (math.pi / 2 - .3, 0, 0), 28, 8,
          (1, 1, 1))
    capsule(f"Forearm {s}", el + (wr - el) * .15, wr - (wr - el) * .1, .038, ceramic, f"elbow-{s}", .034)
    torus(f"Wrist ring {s}", wr + Vector((0, 0, .01)), .031, .01, brass, f"hand-{s}", (0, 0, 0), 24, 8)
    rivets(f"Forearm {s}", [el + (wr - el) * t + Vector((x(.035), -.012, 0)) for t in (.35, .65)], .006, f"elbow-{s}")
    # Open hand, sized like the reference: a broad palm, four long jointed
    # fingers (two segments with a brass knuckle) and an opposed thumb.
    palm = wr + Vector((x(.008), -.012, -.06))
    sphere(f"Palm {s}", palm, (.044, .026, .05), ceramic, f"hand-{s}", 20, 12, 4)
    for k in range(4):
        spread = (k - 1.5) * .022
        base = palm + Vector((x(-.033 + .022 * k), -.008, -.044))
        knuckle = base + Vector((x(spread * .25), -.006, -.036 + .006 * abs(k - 1.5)))
        tip = knuckle + Vector((x(spread * .3), -.014, -.034 + .006 * abs(k - 1.5)))
        capsule(f"Finger {s}{k}", base, knuckle, .0105, ceramic, f"hand-{s}")
        capsule(f"Fingertip {s}{k}", knuckle, tip, .0095, ceramic, f"hand-{s}", .0085)
        ico(f"Knuckle {s}{k}", knuckle, .0095, brass, f"hand-{s}", 1)
    thumb = palm + Vector((x(-.04), -.016, .008))
    thumb_knuckle = thumb + Vector((x(-.022), -.024, -.026))
    capsule(f"Thumb {s}", thumb, thumb_knuckle, .012, ceramic, f"hand-{s}")
    capsule(f"Thumb tip {s}", thumb_knuckle, thumb_knuckle + Vector((x(-.006), -.02, -.024)), .011, ceramic,
            f"hand-{s}", .0095)

    hip, knee, ankle = Vector((x(.085), .006, .431)), Vector((x(.103), -.006, .29)), Vector((x(.113), -.004, .126))
    capsule(f"Thigh {s}", hip, knee + Vector((0, 0, .02)), .048, ceramic, f"leg-{d}", .044)
    sphere(f"Knee joint {s}", knee, (.05, .045, .042), brass, f"shin-{d}", 20, 10)
    for k in (-1, 1):
        torus(f"Knee cap {s}{k}", knee + Vector((x(.046) * k, 0, 0)), .024, .007, brass, f"shin-{d}",
              (0, math.pi / 2, 0), 18, 6)
    capsule(f"Shin {s}", knee - Vector((0, 0, .02)), ankle + Vector((0, 0, .02)), .044, ceramic, f"shin-{d}", .047)
    # Heavy boot: rounded ceramic shell on a riveted brass sole.
    if BRONZE:
        # Knee discs with a key-pattern ring, and tall boot cuffs.
        for k in (-1, 1):
            cylinder(f"Knee disc {s}{k}", knee + Vector((x(.045) * k, 0, 0)), knee + Vector((x(.062) * k, 0, 0)), .034, brass, f"shin-{d}", 20)
        cylinder(f"Boot cuff {s}", Vector((x(.113), -.01, .09)), Vector((x(.113), -.01, .2)), .066, ceramic, f"foot-{s}", 24, .07)
        torus(f"Boot cuff band {s}", Vector((x(.113), -.01, .2)), .07, .008, brass, f"foot-{s}", (0, 0, 0), 28, 6)
    boot = Vector((x(.113), -.035, .075))
    sphere(f"Boot {s}", boot, (.088, .135, .072), ceramic, f"foot-{s}", 36, 18, 3)
    torus(f"Sole rim {s}", boot + Vector((0, 0, -.05)), 1, .018, brass, f"foot-{s}", (0, 0, 0), 40, 8,
          (.092, .138, 1))
    sphere(f"Sole {s}", boot + Vector((0, 0, -.058)), (.09, .136, .012), brass, f"foot-{s}", 32, 6, 3)
    rivets(f"Sole {s}", [boot + Vector((x(.096) * math.cos(a), .143 * math.sin(a), -.04))
                         for a in np.linspace(0, 2 * math.pi, 18, endpoint=False)], .0075, f"foot-{s}")
    torus(f"Ankle ring {s}", ankle + Vector((0, 0, -.005)), .05, .013, brass, f"foot-{s}", (0, 0, 0), 32, 8)
    cylinder(f"Ankle boss {s}", boot + Vector((x(.083), .03, .015)), boot + Vector((x(.093), .03, .015)), .022, brass,
             f"foot-{s}", 20)

# --- Armature (same joint names and parents as the earlier Navegante) ---------------------
# Leg proportions match the earlier Navegante, which the companion gait's
# stride reach is tuned for; the thighs start hidden inside the round body.
joints = {"root": ((0, 0, 0), None), "hips": ((0, 0, .43), "root"),
          "chest": ((0, 0, .52), "hips"), "head": ((0, .01, .74), "chest"),
          "anchor-mouth": ((0, -.25, .90), "head"),
          "cape": ((0, .16, .68), "chest"), "antenna": ((0, .04, 1.25), "head"),
          "eye-L": ((-.07, -.25, .975), "head"), "eye-R": ((.07, -.25, .975), "head")}
for side in (-1, 1):
    s = "L" if side < 0 else "R"
    d = "left" if side < 0 else "right"
    joints.update({
        "arm-" + s: ((side * .205, .0, .60), "chest"),
        "elbow-" + s: ((side * .25, -.005, .475), "arm-" + s),
        "hand-" + s: ((side * .272, -.015, .375), "elbow-" + s),
        "leg-" + d: ((side * .085, .006, .431), "hips"),
        "shin-" + d: ((side * .103, -.006, .29), "leg-" + d),
        "foot-" + s: ((side * .113, -.004, .126), "shin-" + d),
    })
for name in ("antenna", "eye-L", "eye-R", "anchor-mouth"):
    xyz, parent = joints[name]
    joints[name] = (tuple(Vector((0, .01, .74)) + (Vector(xyz) - Vector((0, .01, .74))) * 1.22), parent)
rig = bpy.data.objects.new("Navegante armature", bpy.data.armatures.new("Navigator mechanism"))
scene.collection.objects.link(rig)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name, (xyz, parent) in joints.items():
    bone = rig.data.edit_bones.new(name)
    bone.head = xyz
    bone.tail = Vector(xyz) + Vector((0, .065, 0))
    if parent:
        bone.parent = rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")

HEAD_SCALE, NECK = 1.22, Vector((0, .01, .74))
HEAD_BONES = {"head", "antenna", "eye-L", "eye-R", "anchor-mouth"}
for obj, bone in parts:
    if bone in HEAD_BONES:
        for v in obj.data.vertices:
            v.co = NECK + (v.co - NECK) * HEAD_SCALE
bpy.ops.object.select_all(action="DESELECT")
for obj, bone in parts:
    if bone is not None:
        obj.vertex_groups.new(name=bone).add([v.index for v in obj.data.vertices], 1, "REPLACE")
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
skin = bpy.context.object
skin.name = "Navegante ceramic, brass and knit"
skin.parent = rig
modifier = skin.modifiers.new("Rigid weighted joints", "ARMATURE")
modifier.object = rig
# The runtime face draws the mouth; keep the speech morph contract on the face.
skin.shape_key_add(name="Basis", from_mix=False)
key = skin.shape_key_add(name="mouth-open", from_mix=False)
face_index = next(i for i, m in enumerate(skin.data.materials)
                  if m.name.startswith("Navegante face") or m.name.startswith("Visor LED screen"))
face_verts = {v for p in skin.data.polygons if p.material_index == face_index for v in p.vertices}
for v in face_verts:
    co = skin.data.vertices[v].co
    # A slight inward give below the nose as the mouth opens.
    dz = co.z - (FACE_C.z - .08)
    k = math.exp(-((co.x / .09) ** 2 + (dz / .05) ** 2))
    key.data[v].co = co + Vector((0, .008 * k, 0))

tris = sum(len(p.vertices) - 2 for p in skin.data.polygons)
print("NAVEGANTE_ESCAFANDRA", "bronze" if BRONZE else "white", {"vertices": len(skin.data.vertices), "triangles": tris,
                       "materials": [m.name for m in skin.data.materials]})

motion.author(rig)
scene.render.fps = motion.FPS
scene.frame_set(0)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
skin.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=str(out / "navegante.blend"))
motion.export(rig, out / "navegante.glb", image_format="JPEG")
