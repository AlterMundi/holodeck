"""Teleport station (Alternative 3) — source build for Holodeck.

Run:  blender -b --factory-startup -P art/teleport-station/build_station.py -- OUT_DIR

Builds the floating teleport station in the same construction language as the
N-3X companion (CompAII's avatar): crackled porcelain with raised gold filigree,
engraved bronze bands with rivets, the cape's teal weave with its laurel hem,
and cyan light. It writes:

  OUT_DIR/teleport-station.glb      station, named anchors and three clips
  OUT_DIR/teleport-miniatures.glb   one miniature per destination kind
  OUT_DIR/teleport-station.blend    editable source scene
  art/teleport-station/textures/*.png  generated texture maps

Coordinates are Blender Z-up; glTF export converts to Y-up. The front, where
the player stands, is Blender -Y (glTF +Z). The origin is the floor under the
station. See README.md for anchor and animation contracts.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, 'build')
TEX = os.path.join(HERE, 'textures')
SRC = os.path.join(TEX, 'source')
os.makedirs(OUT, exist_ok=True)

R = .82          # board radius scale; outer band ~1.72 m across
H = .78          # board surface above the floor
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS


# ---------------------------------------------------------------- textures
def load(name):
    image = bpy.data.images.load(os.path.join(SRC, name))
    w, h = image.size
    px = np.array(image.pixels[:], dtype=np.float32).reshape(h, w, 4)
    return px


def upscale(px, factor):
    """Bilinear upscale; keeps the robot's own pattern but avoids pixel steps."""
    h, w, c = px.shape
    ys = (np.arange(h * factor) + .5) / factor - .5
    xs = (np.arange(w * factor) + .5) / factor - .5
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int)
    fy = (ys - y0)[:, None, None]; fx = (xs - x0)[None, :, None]
    y0m, y1m = y0 % h, (y0 + 1) % h
    x0m, x1m = x0 % w, (x0 + 1) % w
    a = px[y0m][:, x0m]; b = px[y0m][:, x1m]; c_ = px[y1m][:, x0m]; d = px[y1m][:, x1m]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c_ * (1 - fx) + d * fx) * fy


def blur(channel, radius=1):
    out = channel.copy()
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-radius, radius + 1):
            acc += np.roll(out, k, axis=axis)
        out = acc / (2 * radius + 1)
    return out


def normal_from_height(height, strength):
    gy, gx = np.gradient(height)
    nx, ny, nz = -gx * strength, gy * strength, np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / length, ny / length, nz / length], -1) * .5 + .5
    return n


def save(name, rgb, alpha=None, colour=True):
    h, w = rgb.shape[:2]
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(rgb, 0, 1)
    if alpha is not None:
        rgba[..., 3] = np.clip(alpha, 0, 1)
    image = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    if not colour:
        image.colorspace_settings.name = 'Non-Color'
    image.pixels[:] = rgba.ravel()
    image.filepath_raw = os.path.join(TEX, name + '.png')
    image.file_format = 'PNG'
    image.save()
    return image


def hsv_saturation(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1)
    return np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)


def make_textures():
    # Porcelain + filigree from the companion's ceramic (256 px source -> 1024).
    src = upscale(load('Ivory_and_gold_ceramic.png'), 4)[..., :3]
    sat = hsv_saturation(src)
    gold = np.clip((sat - .14) / .16, 0, 1)
    gold = blur(gold, 1)
    lum = src.mean(-1)
    veins = np.clip((.86 - lum) / .25, 0, 1) * (1 - gold)
    porcelain = np.array([.93, .91, .86])
    goldc = np.array([.92, .70, .30])
    base = porcelain * (1 - veins[..., None] * .38)
    base = base * (1 - gold[..., None]) + goldc * gold[..., None] * (.75 + .45 * lum[..., None])
    images = {}
    images['ceramic_base'] = save('ceramic_base', base)
    rough = .16 + .08 * gold + .1 * veins
    # glTF metallicRoughness: G roughness, B metalness; R kept as occlusion.
    occ = 1 - .35 * veins
    images['ceramic_mr'] = save('ceramic_mr', np.stack([occ, rough, gold], -1), colour=False)
    height = blur(gold, 2) * 1.0 - veins * .35
    images['ceramic_normal'] = save('ceramic_normal', normal_from_height(height, 6.0), colour=False)

    # Bronze band: engraved colour, scrolled relief normal from the visor ring.
    band = upscale(load('Engraved_bronze_band.png'), 2)[..., :3] * np.array([1.45, 1.15, .8])
    images['bronze_base'] = save('bronze_base', band)
    relief = upscale(load('Scrolled_bronze_relief.png'), 1)[..., :3]
    images['bronze_normal'] = save('bronze_normal', relief, colour=False)

    # Cape weave (plain rows only) and the laurel hem strip.
    cape = load('Teal_weave_and_embroidered_hem.png')[..., :3]
    h = cape.shape[0]
    plain = cape[int(h * .45):, :]          # Blender rows run bottom-up
    images['weave_base'] = save('weave_base', upscale(plain, 2))
    hem = cape[:int(h * .36), :]
    hem_gold = np.clip((hsv_saturation(hem) * 0 + (hem[..., 0] - hem[..., 2] + .05) / .25), 0, 1)
    images['hem_base'] = save('hem_base', upscale(hem, 2))
    images['hem_mr'] = save('hem_mr', upscale(np.stack([np.ones_like(hem_gold), .7 - .3 * hem_gold, hem_gold], -1), 2), colour=False)
    return images


IM = make_textures()


# --------------------------------------------------------------- materials
def textured(name, base, mr=None, normal=None, normal_strength=1.0, rough=.3, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = IM[base]
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if mr:
        tm = nt.nodes.new('ShaderNodeTexImage'); tm.image = IM[mr]
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tm.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    else:
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
    if normal:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = IM[normal]
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if coat:
        b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .05
    return m


def plain(name, colour, metal=0.0, rough=.4, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*colour, 1)
    b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


CYAN = (.25, .95, 1.0)
M = {
    'porcelain': textured('tp_porcelain', 'ceramic_base', 'ceramic_mr', 'ceramic_normal', .8, coat=.9),
    'bronze': textured('tp_bronze_band', 'bronze_base', normal='bronze_normal', normal_strength=1.2, rough=.32, metal=1.0),
    'weave': textured('tp_teal_weave', 'weave_base', rough=.85),
    'hem': textured('tp_laurel_hem', 'hem_base', 'hem_mr'),
    'brass': plain('tp_brass', (.80, .56, .27), 1.0, .28),
    'graphite': plain('tp_graphite', (.05, .055, .06), .3, .45),
    'rose': plain('tp_rose_enamel', (.6, .18, .1), .6, .35),
    'glass': plain('tp_glass', (.7, .95, .95), 0, .05, alpha=.28),
    'light': plain('tp_light', CYAN, 0, .3, CYAN, 6.0),
    'light_soft': plain('tp_light_soft', CYAN, 0, .3, CYAN, 2.5),
    'gold_light': plain('tp_gold_light', (1, .72, .32), 0, .3, (1, .72, .32), 4.0),
    'beam': plain('tp_beam', CYAN, 0, .2, CYAN, 2.0, alpha=.18),
    'amber': plain('tp_amber', (1, .58, .22), 0, .4, (1, .58, .22), 3.0),
    'roof': plain('tp_roof_teal', (.04, .27, .27), 0, .5),
    'leaf': plain('tp_leaf', (.12, .32, .09), 0, .7),
    'copper': plain('tp_copper', (.66, .30, .14), .6, .4),
}


# ----------------------------------------------------------------- helpers
def active():
    return bpy.context.view_layer.objects.active


def finish(obj, mat, uv_scale=None, smooth=True):
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    obj.data.materials.append(M[mat])
    if uv_scale and obj.data.uv_layers:
        su, sv = uv_scale
        for loop in obj.data.uv_layers.active.data:
            loop.uv = (loop.uv[0] * su, loop.uv[1] * sv)
    return obj


def empty(name, location, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = .05
    e.location = location
    scene.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


def join(name, objects, parent=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    o = active(); o.name = name; o.data.name = name
    if parent:
        o.parent = parent
    return o


def torus(r, t, z, mat, seg=128, minor=16, x=0, y=0, rot=(0, 0, 0), uv=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=t, location=(x, y, z), rotation=rot,
                                     major_segments=seg, minor_segments=minor, generate_uvs=True)
    o = active(); o.scale = scale
    return finish(o, mat, uv)


def cylinder(r, d, loc, mat, seg=64, uv=None, cap=True, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=d, location=loc, rotation=rot,
                                        end_fill_type='NGON' if cap else 'NOTHING', calc_uvs=True)
    return finish(active(), mat, uv)


def sphere(r, loc, mat, seg=12, rings=6, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=loc, calc_uvs=True)
    o = active(); o.scale = scale
    return finish(o, mat)


def rivet_ring(r, z, n, size, phase=0, cx=0, cy=0):
    out = []
    for i in range(n):
        a = phase + i * math.tau / n
        out.append(sphere(size, (cx + math.cos(a) * r, cy + math.sin(a) * r, z), 'brass', 6, 3))
    return out


def annulus(r0, r1, z, mat, repeats, seg=160):
    me = bpy.data.meshes.new('annulus'); bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    a = [bm.verts.new((math.cos(i * math.tau / seg) * r0, math.sin(i * math.tau / seg) * r0, z)) for i in range(seg + 1)]
    b = [bm.verts.new((math.cos(i * math.tau / seg) * r1, math.sin(i * math.tau / seg) * r1, z)) for i in range(seg + 1)]
    for i in range(seg):
        f = bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        u0, u1 = i / seg * repeats, (i + 1) / seg * repeats
        for loop, co in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
            loop[uv].uv = co
    bm.to_mesh(me); o = bpy.data.objects.new('annulus', me); scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    o.data.materials.append(M[mat])
    return o


def strap(p, q, w, t, mat):
    p, q = Vector(p), Vector(q); v = q - p
    bpy.ops.mesh.primitive_cube_add(size=1, location=(p + q) / 2, calc_uvs=True)
    o = active(); o.scale = (w, t, v.length)
    o.rotation_euler = v.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, mat, (6, 1), False)


# ------------------------------------------------------------------ station
root = empty('tp_station', (0, 0, 0))
body_parts = []

# Board: cape weave inside a laurel hem, brass bead and rivets.
body_parts.append(cylinder(R * .80, .03, (0, 0, H - .015), 'weave', 128, (3, 3)))
body_parts.append(annulus(R * .80, R * .90, H + .001, 'hem', 14, 128))
body_parts.append(torus(R * .80, .011, H + .002, 'brass', 128, 6))
body_parts += rivet_ring(R * .80, H + .014, 48, .007)

# Thick porcelain rim with eight riveted bronze straps.
body_parts.append(torus(R * .97, .072, H - .012, 'porcelain', 128, 20, uv=(10, 1), scale=(1, 1, .8)))
for i in range(8):
    a = i * math.tau / 8
    x, y = math.cos(a) * R * .97, math.sin(a) * R * .97
    body_parts.append(cylinder(.075, .032, (x, y, H - .012), 'bronze', 48, (3, 1), cap=False,
                               rot=(math.pi / 2, 0, a + math.pi / 2)))
    for k in (-1, 1):
        body_parts.append(sphere(.0065, (math.cos(a) * R * (.97 + .055 * k), math.sin(a) * R * (.97 + .055 * k), H + .035), 'brass', 6, 3))

# Engraved outer band, like the visor ring, with two rows of rivets.
body_parts.append(cylinder(R * 1.045, .058, (0, 0, H - .015), 'bronze', 128, (28, 1), cap=False))
body_parts += rivet_ring(R * 1.05, H + .01, 72, .006)
body_parts += rivet_ring(R * 1.05, H - .04, 72, .006, math.pi / 72)

# Porcelain underside in eight panels with riveted bronze seams.
bpy.ops.mesh.primitive_cone_add(vertices=128, radius1=R * 1.02, radius2=R * .30, depth=.22,
                                location=(0, 0, H - .155), rotation=(math.pi, 0, 0), calc_uvs=True)
body_parts.append(finish(active(), 'porcelain', (4, 2)))
for i in range(8):
    a = i * math.tau / 8 + math.pi / 8
    p = (math.cos(a) * R * 1.0, math.sin(a) * R * 1.0, H - .05)
    q = (math.cos(a) * R * .31, math.sin(a) * R * .31, H - .26)
    body_parts.append(strap(p, q, .024, .012, 'bronze'))
    for t in (.15, .4, .65, .9):
        c = Vector(p).lerp(Vector(q), t) + Vector((0, 0, -.012))
        body_parts.append(sphere(.0055, c, 'brass', 6, 3))

# Emitter: riveted bronze bezel like the ear disc, graphite throat, cyan core.
body_parts.append(torus(R * .28, .026, H - .27, 'bronze', 96, 12, uv=(10, 1)))
body_parts += rivet_ring(R * .28, H - .295, 20, .006)
body_parts.append(cylinder(R * .26, .04, (0, 0, H - .28), 'graphite', 64))
core = sphere(R * .17, (0, 0, H - .30), 'light', 32, 12, scale=(1, 1, .42))
body_parts.append(core)

# Centre medallion: the compass-rose clasp of the cape, under a glass lens.
body_parts.append(cylinder(.18, .024, (0, 0, H + .004), 'porcelain', 96, (1, 1)))
body_parts.append(torus(.18, .013, H + .016, 'bronze', 96, 10, uv=(8, 1)))
body_parts += rivet_ring(.18, H + .028, 16, .0055)
body_parts.append(cylinder(.105, .01, (0, 0, H + .02), 'rose', 64))
for i in range(8):
    a = i * math.tau / 8; L = .15 if i % 2 == 0 else .095
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.024, depth=L, location=(math.cos(a) * L / 2, math.sin(a) * L / 2, H + .028))
    o = active(); o.rotation_euler = (0, math.pi / 2, a); o.scale = (1, .3, 1)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    body_parts.append(finish(o, 'brass', smooth=False))
lens = sphere(.17, (0, 0, H + .024), 'glass', 48, 12, scale=(1, 1, .2))

body = join('tp_body', body_parts, root)
lens.name = 'tp_center_lens'; lens.parent = root

# Rotating glyph ring on the rim (idle motion).
glyphs = []
for i in range(48):
    if i % 12 == 0:
        continue
    a = i * math.tau / 48
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * R * 1.0, math.sin(a) * R * 1.0, H + .045))
    o = active(); o.scale = (.03 if i % 3 else .045, .005, .008); o.rotation_euler = (0, 0, a + math.pi / 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    glyphs.append(finish(o, 'gold_light', smooth=False))
glyph_ring = join('tp_glyph_ring', glyphs, root)

# Energy rings beneath (idle motion).
rings = []
for r, z, s in ((R * .55, H - .42, .008), (R * .42, H - .55, .006), (R * .30, H - .66, .005)):
    rings.append(torus(r, s, z, 'light_soft', 64, 5))
energy = join('tp_energy_rings', rings, root)

# Travel rail: a bronze track just outside the rim the carriage rides on.
rail_parts = [torus(R * 1.11, .012, H - .045, 'brass', 128, 6),
              torus(R * 1.11, .006, H - .015, 'light_soft', 128, 4)]
for i in range(12):
    a = i * math.tau / 12 + math.pi / 12
    rail_parts.append(strap((math.cos(a) * R * 1.05, math.sin(a) * R * 1.05, H - .045),
                            (math.cos(a) * R * 1.11, math.sin(a) * R * 1.11, H - .045), .02, .012, 'bronze'))
join('tp_travel_rail', rail_parts, root)

# Travel carriage: pivots about the vertical axis; Holodeck turns it so the
# control always faces the viewer. Built at the front (-Y).
carriage = empty('tp_travel_carriage', (0, 0, 0), root)
cy = -R * 1.11
housing_parts = []
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, cy, H - .02), calc_uvs=True)
o = active(); o.scale = (.34, .15, .11)
bev = o.modifiers.new('bevel', 'BEVEL'); bev.width = .028; bev.segments = 5
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.modifier_apply(modifier='bevel')
housing_parts.append(finish(o, 'porcelain', (1, 1)))
housing_parts.append(torus(.062, .015, H + .037, 'bronze', 64, 10, y=cy - .004, uv=(4, 1)))
housing_parts += rivet_ring(.062, H + .05, 12, .0055, cy=cy - .004)
for dx in (-.12, .12):
    housing_parts.append(cylinder(.027, .012, (dx, cy - .008, H + .034), 'brass', 32))
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=.015, depth=.006, location=(dx, cy - .008, H + .042),
                                    rotation=(0, 0, math.pi / 2 if dx < 0 else -math.pi / 2))
    housing_parts.append(finish(active(), 'gold_light', smooth=False))
# rail shoe clamps
for dx in (-.11, .11):
    housing_parts.append(cylinder(.02, .05, (dx, cy + .055, H - .045), 'bronze', 24, (1, 1), rot=(math.pi / 2, 0, 0)))
housing = join('tp_travel_housing', housing_parts, carriage)
button = sphere(.05, (0, cy - .004, H + .052), 'light', 32, 12, scale=(1, 1, .55))
button.name = 'tp_travel_button'; button.parent = carriage
empty('tp_travel_slot', (0, cy - .004, H + .085), carriage)

# Travel column (TARDIS-like), rest pose collapsed at the board.
beam = cylinder(R * 1.02, 1.7, (0, 0, H + .85), 'beam', 96, cap=False)
beam.name = 'tp_travel_beam'; beam.parent = root
beam_rings = []
for k, z in enumerate((.16, .45, .8, 1.2, 1.6)):
    beam_rings.append(torus(R * (1.04 - .02 * k), .009 - .001 * k, H + z, 'light', 96, 5))
beam_ring = join('tp_travel_beam_rings', beam_rings, root)
for o in (beam, beam_ring):
    # origin at the board so the column grows upward when scaled
    bpy.context.scene.cursor.location = (0, 0, H)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# Anchors and node pedestals. Miniatures attach at each anchor (pedestal top).
empty('tp_center', (0, 0, H + .06), root)
PARENT_Z = H + .44
CHILD_Z = H + .12
slots = [math.radians(a) for a in (-140, -40, 40, 140)]   # front-left, front-right, back-right, back-left


def pedestal(name, x, y, z, lit=False):
    parts = [cylinder(.13, .032, (x, y, z - .016), 'porcelain', 64, (1, 1)),
             cylinder(.133, .013, (x, y, z - .024), 'bronze', 64, (6, 1), cap=False),
             torus(.118, .004, z + .002, 'light' if lit else 'light_soft', 48, 4, x=x, y=y)]
    parts += rivet_ring(.134, z - .024, 10, .0045, cx=x, cy=y)
    return join(name, parts)


anchor = empty('tp_parent', (0, 0, PARENT_Z), root)
p = pedestal('tp_parent_pedestal', 0, 0, PARENT_Z, True); p.parent = anchor
p.matrix_parent_inverse = anchor.matrix_world.inverted()
stem = cylinder(.01, PARENT_Z - H - .06, (0, 0, (PARENT_Z + H + .06) / 2), 'light_soft', 16)
stem.name = 'tp_parent_stem'; stem.parent = root
for i, a in enumerate(slots):
    x, y = math.cos(a) * R * .6, math.sin(a) * R * .6
    node = empty(f'tp_node_{i}', (x, y, CHILD_Z), root)
    ped = pedestal(f'tp_node_{i}_pedestal', x, y, CHILD_Z)
    column = cylinder(.02, CHILD_Z - H - .03, (x, y, (CHILD_Z + H) / 2 - .015), 'bronze', 24, (2, 1), cap=False)
    j = join(f'tp_node_{i}_mount', [ped, column]); j.parent = node
    j.matrix_parent_inverse = node.matrix_world.inverted()
    # thread of light from the parent to this node
    a0, a1 = Vector((0, 0, PARENT_Z)), Vector((x, y, CHILD_Z + .02))
    thread = strap(a0, a1, .006, .006, 'light_soft'); thread.data.materials.clear(); thread.data.materials.append(M['light_soft'])
    thread.name = f'tp_thread_{i}'; thread.parent = root


# --------------------------------------------------------------- animation
def key(obj, frame, **values):
    for prop, value in values.items():
        setattr(obj, prop, value)
        obj.keyframe_insert(data_path=prop, frame=frame)


def clip(name, keys):
    for obj in {o for o, *_ in keys}:
        obj.animation_data_clear()
    for obj, frame, values in keys:
        key(obj, frame, **values)
    for obj in {o for o, *_ in keys}:
        act = obj.animation_data.action
        act.name = f'{name}_{obj.name}'
        track = obj.animation_data.nla_tracks.new(); track.name = name
        strip = track.strips.new(name, int(act.frame_range[0]), act); strip.name = name
        obj.animation_data.action = None
        track.mute = True   # clips are exported per track; the rest pose stays unanimated


S = lambda v: (v, v, v)
# Deploy: the station unfolds from a spark, spins in and settles.
clip('tp_deploy', [
    (root, 1, dict(scale=S(.04), rotation_euler=(0, 0, -math.pi))),
    (root, 18, dict(scale=S(1.04), rotation_euler=(0, 0, .08))),
    (root, 27, dict(scale=S(1.0), rotation_euler=(0, 0, 0))),
])
# Idle loop: glyph ring and energy rings turn in opposite directions.
clip('tp_idle', [
    (glyph_ring, 1, dict(rotation_euler=(0, 0, 0))), (glyph_ring, 241, dict(rotation_euler=(0, 0, math.tau / 11))),
    (energy, 1, dict(rotation_euler=(0, 0, 0))), (energy, 241, dict(rotation_euler=(0, 0, -math.tau / 4))),
])
# Travel: the control sinks, the column rises and rings climb, then holds.
clip('tp_travel', [
    (button, 1, dict(location=(0, cy - .004, H + .052))), (button, 5, dict(location=(0, cy - .004, H + .03))),
    (beam, 1, dict(scale=(1, 1, .001))), (beam, 8, dict(scale=(1, 1, .001))), (beam, 30, dict(scale=(1, 1, 1))),
    (beam_ring, 1, dict(scale=(1, 1, .001))), (beam_ring, 10, dict(scale=(1, 1, .001))), (beam_ring, 36, dict(scale=(1, 1, 1))),
    (glyph_ring, 1, dict(rotation_euler=(0, 0, 0))), (glyph_ring, 36, dict(rotation_euler=(0, 0, math.tau))),
])
# Rest pose: station deployed, control at the front, column collapsed.
root.scale = (1, 1, 1); root.rotation_euler = (0, 0, 0)
glyph_ring.rotation_euler = (0, 0, 0); energy.rotation_euler = (0, 0, 0)
button.location = (0, cy - .004, H + .052)
beam.scale = (1, 1, .001); beam_ring.scale = (1, 1, .001)
scene.frame_set(0)


# ---------------------------------------------------------------- miniatures
def miniatures():
    lib = empty('tp_miniatures', (0, 0, 0))
    def kind(name, x, build):
        e = empty('tp_mini_' + name, (x, 0, 0), lib)
        parts = build(x)
        j = join('tp_mini_' + name + '_mesh', parts); j.parent = e
        j.matrix_parent_inverse = e.matrix_world.inverted()
    def plaza(x):
        p = [cylinder(.032, .025, (x, 0, .012), 'porcelain', 4, (1, 1))]
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.022, radius2=.012, depth=.16, location=(x, 0, .1)); p.append(finish(active(), 'porcelain', (1, 1), False))
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.012, depth=.025, location=(x, 0, .19)); p.append(finish(active(), 'brass', smooth=False))
        for d in (-.06, .06):
            p.append(sphere(.028, (x + d, .015, .07), 'leaf', 12, 8)); p.append(cylinder(.005, .045, (x + d, .015, .022), 'bronze', 8))
        return p
    def house(x):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, .05)); o = active(); o.scale = (.13, .09, .1)
        b = o.modifiers.new('b', 'BEVEL'); b.width = .004; bpy.ops.object.transform_apply(scale=True); bpy.ops.object.modifier_apply(modifier='b')
        p = [finish(o, 'porcelain', (1, 1), False)]
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.11, depth=.08, location=(x, 0, .14), rotation=(0, 0, math.pi / 4)); o = active(); o.scale = (1, .75, 1); p.append(finish(o, 'roof', smooth=False))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -.046, .04)); o = active(); o.scale = (.032, .004, .055); p.append(finish(o, 'amber', smooth=False))
        p.append(torus(.065, .005, .1, 'bronze', 32, 6, x=x, scale=(1, .72, 1)))
        return p
    def residence(x):
        p = [cylinder(.09, .085, (x, 0, .043), 'porcelain', 48, (2, 1))]
        for i in range(10):
            a = i * math.tau / 10
            p.append(cylinder(.0075, .085, (x + math.cos(a) * .097, math.sin(a) * .097, .043), 'porcelain', 10))
        p.append(sphere(.07, (x, 0, .09), 'roof', 24, 12, scale=(1, 1, .75)))
        p.append(torus(.05, .0035, .17, 'light', 32, 6, x=x, rot=(math.radians(70), 0, 0)))
        p.append(sphere(.015, (x, 0, .17), 'gold_light', 12, 8))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -.09, .035)); o = active(); o.scale = (.025, .004, .045); p.append(finish(o, 'amber', smooth=False))
        return p
    def room(x):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, .045)); o = active(); o.scale = (.15, .12, .09)
        b = o.modifiers.new('b', 'BEVEL'); b.width = .006; bpy.ops.object.transform_apply(scale=True); bpy.ops.object.modifier_apply(modifier='b')
        p = [finish(o, 'porcelain', (1, 1), False)]
        p.append(sphere(.045, (x, 0, .09), 'roof', 20, 10, scale=(1, 1, .6)))
        for dx in (-.035, .035):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x + dx, -.061, .045)); o = active(); o.scale = (.022, .004, .045); p.append(finish(o, 'amber', smooth=False))
        return p
    def table(x):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, .07)); o = active(); o.scale = (.16, .08, .012); p = [finish(o, 'porcelain', (1, 1), False)]
        for dx in (-.065, .065):
            p.append(cylinder(.007, .065, (x + dx, 0, .035), 'brass', 8))
        for dx, r in ((-.045, .02), (.0, .015)):
            p.append(sphere(r, (x + dx, 0, .095), 'glass', 16, 8)); p.append(sphere(r * .6, (x + dx, 0, .09), 'light_soft', 12, 6))
        p.append(sphere(.022, (x + .06, .01, .1), 'copper', 12, 8))
        return p
    for i, (n, f) in enumerate((('plaza', plaza), ('house', house), ('residence', residence), ('room', room), ('table', table))):
        kind(n, 3 + i * .5, f)
    return lib


lib = miniatures()


# ----------------------------------------------------------------- export
def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_image_format='WEBP', export_jpeg_quality=86, export_yup=True,
                              export_extras=False, export_cameras=False, export_lights=False)


def tree(obj):
    out = [obj]
    for c in obj.children:
        out += tree(c)
    return out


export(os.path.join(OUT, 'teleport-station.glb'), tree(root))
export(os.path.join(OUT, 'teleport-miniatures.glb'), tree(lib))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'teleport-station.blend'))
print('TP_BUILD_OK', OUT)
