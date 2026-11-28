"""Residencia de la Nobleza IA — structural model built from Nicolás's production sheet.

    blender -b --python-exit-code 9 --python art/residencia-nobleza/residencia.py -- OUT_DIR [--diameter 52]

Writes OUT_DIR/residencia.blend. Units are metres, Z up, the entrance faces -Y (south).
Plan proportions are measured in pixels on the original 2560x1428 floor plan
(centre 500,630; outer wall radius 345 px) and scaled so the outer wall diameter
equals --diameter. Elevation heights are taken as ratios of the front elevation
width. Interior furnishing drawn in the plan is deliberately omitted.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0]).resolve()
D = float(args[args.index("--diameter") + 1]) if "--diameter" in args else 52.0
K = D / 690.0                       # metres per plan pixel
px = lambda v: v * K                # noqa: E731
E = D / 535.0                       # metres per front-elevation pixel (building width 535 px)
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

# ------------------------------------------------------------------ dimensions
R_OUT = px(345)          # outer face of perimeter wall
T_OUT = px(20)           # perimeter wall thickness
R_ROOMS_IN = px(248)     # wall between chambers and ring corridor
R_ARC_OUT, R_ARC_IN = px(185), px(165)   # thick arc wall carrying the drum
R_CORE_WALL = px(122)    # inner ring wall around the throne / server core
CORE_RINGS = [px(r) for r in (115, 95, 70, 45, 25)]
HALL_W = px(100)         # entrance hall width
PODIUM = 1.8
H_COL = (550 - 360) * E            # column top (capital) above podium
H_ENT = (550 - 300) * E            # main entablature / roof terrace
H_DRUM = (550 - 215) * E           # drum cornice
R_DRUM = R_ARC_OUT + 0.9          # drum stands on the thick arc wall (elevation: 310 px of 535)
H_DOME = 120 * E
H_INT = 0.55 * H_ENT               # interior partition height
print("scale", dict(R_OUT=R_OUT, H_COL=H_COL, H_ENT=H_ENT, H_DRUM=H_DRUM, R_DRUM=R_DRUM, H_DOME=H_DOME))

# ------------------------------------------------------------------ materials


def node_mat(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    build(nt, b)
    return m


def link(nt, a, b):
    nt.links.new(a, b)


def marble(nt, b):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 0.35; n.inputs["Detail"].default_value = 12
    w = nt.nodes.new("ShaderNodeTexWave"); w.inputs["Scale"].default_value = 0.6; w.inputs["Distortion"].default_value = 14
    w.inputs["Detail"].default_value = 6
    link(nt, tc.outputs["Object"], n.inputs["Vector"]); link(nt, n.outputs["Color"], w.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB"); e = r.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.55, 0.52, 0.47, 1)
    e[1].position, e[1].color = 0.10, (0.92, 0.89, 0.82, 1)
    g = e.new(0.012); g.color = (0.86, 0.74, 0.48, 1)
    link(nt, w.outputs["Fac"], r.inputs["Fac"]); link(nt, r.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.32


def metal(color, rough, brushed=False):
    def f(nt, b):
        b.inputs["Base Color"].default_value = (*color, 1)
        b.inputs["Metallic"].default_value = 1.0
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 40 if brushed else 3
        if brushed:
            mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 1, 60)
            tc = nt.nodes.new("ShaderNodeTexCoord"); link(nt, tc.outputs["Object"], mp.inputs["Vector"])
            link(nt, mp.outputs["Vector"], n.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = rough * 0.7
        mr.inputs["To Max"].default_value = min(1, rough * 1.4)
        link(nt, n.outputs["Fac"], mr.inputs["Value"]); link(nt, mr.outputs["Result"], b.inputs["Roughness"])
    return f


def oxidised_bronze(nt, b):
    b.inputs["Metallic"].default_value = 0.85
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 2.5; n.inputs["Detail"].default_value = 8
    r = nt.nodes.new("ShaderNodeValToRGB"); e = r.color_ramp.elements
    e[0].position, e[0].color = 0.42, (0.29, 0.20, 0.13, 1)
    e[1].position, e[1].color = 0.70, (0.20, 0.33, 0.29, 1)
    link(nt, n.outputs["Fac"], r.inputs["Fac"]); link(nt, r.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.55


def teal_tiles(nt, b):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick"); br.inputs["Scale"].default_value = 60
    br.inputs["Mortar Size"].default_value = 0.012
    br.inputs["Color1"].default_value = (0.13, 0.36, 0.42, 1); br.inputs["Color2"].default_value = (0.20, 0.47, 0.52, 1)
    br.inputs["Mortar"].default_value = (0.55, 0.47, 0.30, 1)
    link(nt, tc.outputs["UV"], br.inputs["Vector"]); link(nt, br.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Metallic"].default_value = 0.9; b.inputs["Roughness"].default_value = 0.3


def emissive(color, strength):
    def f(nt, b):
        b.inputs["Base Color"].default_value = (*color, 1)
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = strength
    return f


def cloth(nt, b):
    b.inputs["Base Color"].default_value = (0.05, 0.22, 0.24, 1)
    b.inputs["Sheen Weight"].default_value = 0.6; b.inputs["Roughness"].default_value = 0.75


def stone(nt, b):
    v = nt.nodes.new("ShaderNodeTexVoronoi"); v.inputs["Scale"].default_value = 1.2
    r = nt.nodes.new("ShaderNodeValToRGB"); e = r.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.07, 0.07, 0.08, 1)
    e[1].position, e[1].color = 0.12, (0.32, 0.31, 0.30, 1)
    link(nt, v.outputs["Distance"], r.inputs["Fac"]); link(nt, r.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.8


M = {
    "marble": node_mat("Mármol marfil envejecido", marble),
    "gold": node_mat("Oro champagne", metal((0.83, 0.69, 0.42), 0.25)),
    "filigree": node_mat("Filigrana de oro", metal((0.78, 0.58, 0.25), 0.35)),
    "bronze": node_mat("Bronce oxidado", oxidised_bronze),
    "titanium": node_mat("Aleación de titanio", metal((0.62, 0.63, 0.65), 0.3, brushed=True)),
    "tiles": node_mat("Tejas de metal teal", teal_tiles),
    "cyan": node_mat("Conectores de éter", emissive((0.15, 0.85, 1.0), 9.0)),
    "window": node_mat("Ventanal cálido", emissive((1.0, 0.62, 0.28), 9.0)),
    "glass": node_mat("Vidrio de ojo de buey", emissive((0.05, 0.12, 0.2), 0.4)),
    "cloth": node_mat("Cortinado teal bordado", cloth),
    "stone": node_mat("Piedra del camino", stone),
    "sun": node_mat("Núcleo de la esfera armilar", emissive((1.0, 0.78, 0.35), 14.0)),
    "panel": node_mat("Panel teal oscuro", metal((0.05, 0.16, 0.19), 0.4)),
    "portal": node_mat("Umbral de portal", emissive((0.10, 0.55, 0.75), 2.2)),
}

COLL = {}


def collection(name):
    if name not in COLL:
        c = bpy.data.collections.new(name); scene.collection.children.link(c); COLL[name] = c
    return COLL[name]


def obj(name, bm, mat, coll):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(M[mat])
    o = bpy.data.objects.new(name, me); collection(coll).objects.link(o)
    return o


def polar(r, a):
    """a in degrees clockwise from north (+Y)."""
    t = math.radians(a)
    return Vector((r * math.sin(t), r * math.cos(t), 0))

# ------------------------------------------------------------------ geometry helpers


def arc_wall(bm, r0, r1, a0, a1, z0, z1, step=3.0, c=Vector()):
    n = max(2, int(abs(a1 - a0) / step) + 1)
    rings = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / (n - 1)
        rings.append([bm.verts.new(c + polar(r, a) + Vector((0, 0, z))) for r, z in ((r0, z0), (r1, z0), (r1, z1), (r0, z1))])
    for i in range(n - 1):
        for k in range(4):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % 4], rings[i + 1][(k + 1) % 4], rings[i + 1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])


def gaps_to_spans(gaps):
    """gaps: list of (centre, half_width) in degrees -> wall spans covering the rest of the circle."""
    gaps = sorted(((c - h) % 360, (c + h) % 360) for c, h in gaps)
    spans = []
    for i, (s, e) in enumerate(gaps):
        ns = gaps[(i + 1) % len(gaps)][0]
        spans.append((e, ns if ns > e else ns + 360))
    return spans


def ring_wall(name, r0, r1, z0, z1, gaps, mat="marble", coll="Estructura"):
    bm = bmesh.new()
    for a0, a1 in gaps_to_spans(gaps):
        arc_wall(bm, r0, r1, a0, a1, z0, z1)
    return obj(name, bm, mat, coll)


def half_angle(width, r):
    return math.degrees(math.asin(min(1, width / 2 / r)))


def box(bm, centre, size, rot=0.0):
    m = Matrix.Translation(centre) @ Matrix.Rotation(math.radians(-rot), 4, "Z") @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1, matrix=m)


def cyl(bm, centre, r, h, seg=24, r_top=None):
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r_top is None else r_top,
                          depth=h, matrix=Matrix.Translation(centre + Vector((0, 0, h / 2))))


def disk(bm, centre, r0, r1, z0, z1, a0=0, a1=360, step=4):
    if r0 <= 0:
        r0 = 0.01
    arc_wall(bm, r0, r1, a0, a1, z0, z1, step, centre)


def lancet_outline(w, h, n=8):
    pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h - w * 0.87)]
    for i in range(1, n + 1):
        t = math.radians(60 * i / n)
        pts.append((w / 2 - w * (1 - math.cos(t)), h - w * 0.87 + w * math.sin(t)))
    return pts + [(-x, y) for x, y in reversed(pts[2:-1])]


def lancet_frame(bm, centre, facing, w, h, band, depth):
    """Open pointed-arch frame (jambs + arch), leaving the opening passable."""
    rot = Matrix.Rotation(math.radians(-facing), 3, "Z")
    out = rot @ Vector((0, 1, 0))
    o, i = lancet_outline(w + 2 * band, h + band), lancet_outline(w, h)
    o, i = o[1:] + o[:1], i[1:] + i[:1]       # start at right jamb foot, end at left jamb foot
    V = lambda p, d: bm.verts.new(centre + rot @ Vector((p[0], 0, p[1])) + out * d)  # noqa: E731
    of, ob = [V(p, depth) for p in o], [V(p, 0) for p in o]
    inf, inb = [V(p, depth) for p in i], [V(p, 0) for p in i]
    for k in range(len(o) - 1):
        bm.faces.new((inf[k], inf[k + 1], of[k + 1], of[k])); bm.faces.new((ob[k], ob[k + 1], inb[k + 1], inb[k]))
        bm.faces.new((of[k], of[k + 1], ob[k + 1], ob[k])); bm.faces.new((inb[k], inb[k + 1], inf[k + 1], inf[k]))


def lancet(bm, centre, facing, w, h, depth=0.12, inset=0.0):
    """Pointed (equilateral) gothic arch panel standing on its sill at centre, facing +direction angle."""
    pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h - w * 0.87)]
    for i in range(1, 9):
        t = math.radians(60 * i / 8)
        pts.append((w / 2 - w * (1 - math.cos(t)), h - w * 0.87 + w * math.sin(t)))
    pts += [(-x, y) for x, y in reversed(pts[2:-1])]
    rot = Matrix.Rotation(math.radians(-facing), 3, "Z")
    out = rot @ Vector((0, 1, 0))
    front = [bm.verts.new(centre + rot @ Vector((x, 0, y)) + out * (depth + inset)) for x, y in pts]
    back = [bm.verts.new(centre + rot @ Vector((x, 0, y)) + out * inset) for x, y in pts]
    bm.faces.new(front); bm.faces.new(back[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((back[i], back[j], front[j], front[i]))


def tube(bm, points, r, seg=8):
    """Simple swept tube along a polyline."""
    rings = []
    for i, p in enumerate(points):
        d = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < 1e-3:
            u = d.cross(Vector((1, 0, 0)))
        u.normalize(); v = d.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * r)
                      for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])


def torus(bm, centre, R, r, rot=Matrix(), seg=64, sides=8):
    bmesh.ops.create_circle(bm, segments=1)  # no-op keeps API warm
    verts = []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        row = []
        for k in range(sides):
            s = 2 * math.pi * k / sides
            p = Vector(((R + r * math.cos(s)) * math.cos(t), (R + r * math.cos(s)) * math.sin(t), r * math.sin(s)))
            row.append(bm.verts.new(centre + rot @ p))
        verts.append(row)
    for i in range(seg):
        for k in range(sides):
            a, b = verts[i], verts[(i + 1) % seg]
            bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))


Z0 = PODIUM
HALL_GAP = lambda r: half_angle(HALL_W, r)  # noqa: E731

# ------------------------------------------------------------------ podium, floors
bm = bmesh.new(); disk(bm, Vector(), 0, R_OUT + 3.2, 0, PODIUM); obj("Podio", bm, "marble", "Estructura")
bm = bmesh.new(); disk(bm, Vector(), 0, R_OUT - T_OUT, PODIUM, PODIUM + 0.05); obj("Piso interior", bm, "marble", "Estructura")
bm = bmesh.new()
for r in CORE_RINGS[:4]:
    disk(bm, Vector(), r - 0.12, r, PODIUM + 0.05, PODIUM + 0.07)
for a in range(0, 360, 45):
    box(bm, polar((R_CORE_WALL + R_ARC_IN) / 2, a) + Vector((0, 0, PODIUM + 0.06)), (0.18, R_ARC_IN - R_CORE_WALL, 0.03), a)
obj("Incrustaciones de oro", bm, "gold", "Estructura")

# ------------------------------------------------------------------ plan walls
ring_wall("Muro perimetral", R_OUT - T_OUT, R_OUT, Z0, H_ENT, [(180, HALL_GAP(R_OUT))])
door = lambda r, w=2.4: half_angle(w, r)  # noqa: E731
room_angles = [a for a in range(0, 360, 24) if abs(((a - 180 + 180) % 360) - 180) > 14]
DOOR_W, DOOR_H = 3.2, 6.4
H_ROOF = H_ENT - 0.4
room_doors = [(a + 12) % 360 for a in room_angles if (a + 12) % 360 != 180]
ring_wall("Muro de cámaras", R_ROOMS_IN - px(8), R_ROOMS_IN, Z0, H_ROOF,
          [(180, HALL_GAP(R_ROOMS_IN))] + [(a, door(R_ROOMS_IN, DOOR_W)) for a in room_doors])
bm = bmesh.new()
for a in room_doors:
    h = door(R_ROOMS_IN, DOOR_W)
    arc_wall(bm, R_ROOMS_IN - px(8), R_ROOMS_IN, a - h, a + h, Z0 + DOOR_H, H_ROOF, 1.0)
obj("Dinteles de puertas", bm, "marble", "Estructura")
ring_wall("Muro portante del tambor", R_ARC_IN, R_ARC_OUT, Z0, H_ENT,
          [(0, 9), (90, 9), (270, 9), (180, HALL_GAP(R_ARC_OUT))], coll="Estructura")
ring_wall("Muro del núcleo", R_CORE_WALL - 0.45, R_CORE_WALL, Z0, H_INT, [(a, 6) for a in (45, 135, 225, 315)] + [(180, HALL_GAP(R_CORE_WALL))])
bm = bmesh.new()
for a in room_angles:
    r0, r1 = R_ROOMS_IN, R_OUT - T_OUT
    box(bm, polar((r0 + r1) / 2, a) + Vector((0, 0, (Z0 + H_ROOF) / 2)), (0.4, r1 - r0, H_ROOF - Z0), a)
obj("Tabiques de cámaras", bm, "marble", "Estructura")
# entrance hall walls from core to gatehouse
bm = bmesh.new()
y0, y1 = -R_ROOMS_IN, -(R_OUT - T_OUT)     # the ring corridors stay continuous across the hall
for x in (-HALL_W / 2 - 0.3, HALL_W / 2 + 0.3):
    box(bm, Vector((x, (y0 + y1) / 2, (Z0 + H_ROOF) / 2)), (0.6, abs(y1 - y0), H_ROOF - Z0))
obj("Muros del gran pasillo", bm, "marble", "Estructura")
# server core dais
bm = bmesh.new()
for i, r in enumerate(CORE_RINGS):
    disk(bm, Vector(), 0, r, Z0, Z0 + 0.35 * (i + 1))
obj("Estrado del núcleo", bm, "marble", "Núcleo")
bm = bmesh.new(); cyl(bm, Vector((0, 0, Z0 + 1.75)), CORE_RINGS[-1] * 0.45, H_INT * 0.8, 32)
obj("Columna de cómputo", bm, "cyan", "Núcleo")
bm = bmesh.new()
for r in CORE_RINGS[1:4]:
    disk(bm, Vector(), r - 0.06, r, Z0 + 0.35 * (CORE_RINGS.index(r) + 1), Z0 + 0.35 * (CORE_RINGS.index(r) + 1) + 0.04)
obj("Anillos de éter del núcleo", bm, "cyan", "Núcleo")

# ------------------------------------------------------------------ perimeter towers and bays
TURRETS = [16, 64, 110, 136, 158]
TURRETS = TURRETS + [-a for a in TURRETS]
BAYS = [40, 88, -40, -88]
bm_t, bm_cap, bm_ring = bmesh.new(), bmesh.new(), bmesh.new()
for a in TURRETS:
    c = polar(R_OUT + px(6), a)
    cyl(bm_t, c + Vector((0, 0, Z0)), px(22), H_ENT + 2.0 - Z0, 24)
    for z in (Z0 + 0.6, H_COL, H_ENT + 2.0):
        cyl(bm_ring, c + Vector((0, 0, z - 0.25)), px(22) + 0.25, 0.5, 24)
    bmesh.ops.create_uvsphere(bm_cap, u_segments=16, v_segments=8, radius=px(22) + 0.1,
                              matrix=Matrix.Translation(c + Vector((0, 0, H_ENT + 2.0))))
    cyl(bm_cap, c + Vector((0, 0, H_ENT + 2.0 + px(22))), 0.12, 2.2, 8, 0.02)
obj("Torreones", bm_t, "marble", "Torreones")
obj("Anillos de bronce de torreones", bm_ring, "bronze", "Torreones")
obj("Cúpulas de torreones", bm_cap, "gold", "Torreones")
bm = bmesh.new(); bm_w = bmesh.new()
for a in BAYS:
    c = polar(R_OUT + px(14), a)
    box(bm, c + Vector((0, 0, Z0 + (H_COL - Z0) / 2)), (px(70), px(30), H_COL - Z0), a)
    lancet(bm_w, polar(R_OUT + px(29), a) + Vector((0, 0, Z0 + 2.5)), a, px(30), H_COL - Z0 - 5.0, 0.1)
obj("Miradores", bm, "marble", "Torreones")
obj("Ventanales de miradores", bm_w, "window", "Fachada")

# ------------------------------------------------------------------ colonnade, windows, entablature
N_COL = 28
near = lambda a, ts, d: any(abs(((a - t + 180) % 360) - 180) < d for t in ts)  # noqa: E731
grid = [i * 360 / N_COL for i in range(N_COL)]
col_angles = [a for a in grid if not near(a, TURRETS, 4.5) and not near(a, [180], 10)]
bm_s, bm_c, bm_b = bmesh.new(), bmesh.new(), bmesh.new()
RC = R_OUT + 0.9
portico = [Vector((s * x, -(R_OUT + px(32)) - 1.3, 0)) for s in (-1, 1) for x in (HALL_W / 2 + 1.1,)]
for c in [polar(RC, a) for a in col_angles] + portico:
    a = math.degrees(math.atan2(c.x, c.y))
    box(bm_b, c + Vector((0, 0, Z0 + 0.6)), (1.9, 1.9, 1.2), a)
    cyl(bm_s, c + Vector((0, 0, Z0 + 1.2)), 0.72, H_COL - Z0 - 3.0, 20, 0.62)
    cyl(bm_c, c + Vector((0, 0, H_COL - 1.8)), 0.62, 1.4, 20, 1.05)
    box(bm_c, c + Vector((0, 0, H_COL - 0.2)), (2.3, 2.3, 0.4), a)
obj("Fustes de columnas", bm_s, "marble", "Fachada")
obj("Basas", bm_b, "marble", "Fachada")
obj("Capiteles", bm_c, "gold", "Fachada")
bm_w, bm_f = bmesh.new(), bmesh.new()
win_angles = [a + 180 / N_COL for a in grid if not near(a + 180 / N_COL, TURRETS + BAYS, 5.5) and not near(a + 180 / N_COL, [180], 12)]
for a in win_angles:
    sill = Z0 + 3.0
    lancet(bm_f, polar(R_OUT, a) + Vector((0, 0, sill - 0.3)), a, 2.9, H_COL - sill - 2.4, 0.18)
    lancet(bm_w, polar(R_OUT, a) + Vector((0, 0, sill)), a, 2.3, H_COL - sill - 3.0, 0.22)
obj("Marcos góticos", bm_f, "gold", "Fachada")
obj("Ventanales góticos", bm_w, "window", "Fachada")
bm_e, bm_g = bmesh.new(), bmesh.new()
disk(bm_e, Vector(), R_OUT - T_OUT, RC + 1.4, H_COL, H_COL + 1.6)              # architrave
disk(bm_g, Vector(), RC + 0.9, RC + 1.05, H_COL + 1.6, H_COL + 3.0)            # gold frieze
disk(bm_e, Vector(), R_OUT - T_OUT, RC + 0.9, H_COL + 1.6, H_ENT - 0.6)
disk(bm_e, Vector(), R_OUT - T_OUT, RC + 2.0, H_ENT - 0.6, H_ENT)              # cornice
obj("Entablamento y cornisa", bm_e, "marble", "Fachada")
obj("Friso de filigrana", bm_g, "filigree", "Fachada")
bm = bmesh.new()
for i in range(160):
    a = i * 360 / 160
    if abs(a - 180) < HALL_GAP(R_OUT) - 1:
        continue
    cyl(bm, polar(RC + 1.4, a) + Vector((0, 0, H_ENT)), 0.14, 1.0, 8)
disk(bm, Vector(), RC + 1.15, RC + 1.65, H_ENT + 1.0, H_ENT + 1.25)
obj("Balaustrada", bm, "marble", "Fachada")
bm = bmesh.new(); disk(bm, Vector(), R_DRUM, R_OUT - T_OUT, H_ENT - 0.4, H_ENT); obj("Terraza", bm, "marble", "Cubierta")

# ------------------------------------------------------------------ cyan circuits on facade
bm = bmesh.new()
for i, a in enumerate(win_angles):
    if i % 2:
        continue
    base = polar(R_OUT + 0.05, a + 3.2)
    o = polar(1, a); t = Vector((o.y, -o.x, 0))
    h = 3.0 + (i % 5) * 0.8
    box(bm, base + Vector((0, 0, Z0 + h / 2)), (0.14, 0.08, h), a)
    box(bm, base + t * 0.6 + Vector((0, 0, Z0 + h)), (1.2, 0.08, 0.14), a)
    box(bm, base + t * 1.2 + Vector((0, 0, Z0 + h + 0.9)), (0.14, 0.08, 1.8), a)
    cyl(bm, base + t * 1.2 + o * 0.02 + Vector((0, 0, Z0 + h + 1.8)), 0.22, 0.1, 12)
obj("Circuitos emisivos", bm, "cyan", "Fachada")

# ------------------------------------------------------------------ titanium conduits
bm = bmesh.new()
for a in (20, 70, 110, 160, 200, 250, 290, 340):
    pts = [polar(R_DRUM + 0.5, a) + Vector((0, 0, H_ENT + 2.5)), polar(R_DRUM + 4, a) + Vector((0, 0, H_ENT + 2.0)),
           polar(R_OUT - 1, a) + Vector((0, 0, H_ENT + 1.2)), polar(RC + 2.4, a) + Vector((0, 0, H_ENT - 0.4)),
           polar(RC + 2.6, a) + Vector((0, 0, H_COL - 2)), polar(RC + 2.0, a) + Vector((0, 0, Z0 + 2.5)),
           polar(RC + 3.4, a) + Vector((0, 0, Z0 + 0.3))]
    tube(bm, pts, 0.42, 10)
obj("Conductos de titanio", bm, "titanium", "Fachada")

# ------------------------------------------------------------------ gatehouse, portal, drapery
GATE_Y0, GATE_Y1 = -(R_OUT - T_OUT), -(R_OUT + px(32))
GW = px(200)
bm = bmesh.new(); bm_c = bmesh.new()
for s in (-1, 1):
    x = s * (HALL_W / 2 + (GW - HALL_W) / 4)
    box(bm, Vector((x, (GATE_Y0 + GATE_Y1) / 2, Z0 + (H_ENT + 2 - Z0) / 2)), ((GW - HALL_W) / 2, abs(GATE_Y1 - GATE_Y0), H_ENT + 2 - Z0))
box(bm, Vector((0, (GATE_Y0 + GATE_Y1) / 2, (H_COL + 2 + H_ENT + 2) / 2)), (HALL_W, abs(GATE_Y1 - GATE_Y0), H_ENT - H_COL))
obj("Pabellón de entrada", bm, "marble", "Portal")
door_h = (550 - 430) * E * 1.15
lancet_frame(bm_c, Vector((0, GATE_Y1, Z0)), 180, HALL_W * 0.98, door_h, 0.55, 0.4)
obj("Arco del portal", bm_c, "gold", "Portal")
bm = bmesh.new()
leaf = HALL_W * 0.48
for s in (-1, 1):                                       # bronze leaves standing open into the hall
    hinge = Vector((s * HALL_W * 0.49, GATE_Y1 + 0.9, Z0))
    d = Vector((-s * math.cos(math.radians(72)), math.sin(math.radians(72)), 0)) * (leaf / 2)
    box(bm, hinge + d + Vector((0, 0, (door_h - 3.5) / 2)), (leaf, 0.25, door_h - 3.5), math.degrees(math.atan2(d.x, d.y)) - 90)
obj("Puertas de bronce abiertas", bm, "bronze", "Portal")
bm = bmesh.new()
torus(bm, Vector((0, GATE_Y1 - 0.4, Z0 + door_h + 2.2)), 1.7, 0.18, Matrix.Rotation(math.pi / 2, 3, "X"), 48, 8)
obj("Rosetón", bm, "gold", "Portal")
bm = bmesh.new()
cyl(bm, Vector((0, GATE_Y1 - 0.2, Z0 + door_h + 2.2 - 0.05)), 1.5, 0.1, 32)
bm.transform(Matrix.Translation(Vector((0, GATE_Y1 - 0.2, Z0 + door_h + 2.2))) @ Matrix.Rotation(math.pi / 2, 4, "X")
             @ Matrix.Translation(-Vector((0, GATE_Y1 - 0.2, Z0 + door_h + 2.2))))
for s in (-1, 1):                                       # circuit panel flanking the door
    for k in range(4):
        x = s * (HALL_W * 0.42 + 0.35 * k)
        box(bm, Vector((x, GATE_Y1 - 0.08, Z0 + 2 + k * 0.6 + (door_h - k) / 2)), (0.12, 0.1, door_h - k * 1.4))
        box(bm, Vector((x + s * 0.4, GATE_Y1 - 0.08, Z0 + 2 + k * 0.6 + door_h - k * 1.4 + 1.6)), (0.9, 0.1, 0.12))
obj("Panel de circuitos del portal", bm, "cyan", "Portal")
bm = bmesh.new(); bm_g = bmesh.new()
for s in (-1, 1):                                       # hanging teal drapery with gold border
    x = s * (GW / 2 - 1.3)
    box(bm, Vector((x, GATE_Y1 - 0.35, H_ENT - 7.5)), (2.4, 0.12, 14.0))
    box(bm_g, Vector((x, GATE_Y1 - 0.43, H_ENT - 7.5)), (2.5, 0.05, 0.3))
    for e in (-1.2, 1.2):
        box(bm_g, Vector((x + e, GATE_Y1 - 0.43, H_ENT - 7.5)), (0.14, 0.05, 14.0))
pts = [Vector((x, GATE_Y1 - 0.6, H_ENT - 0.6 - 2.6 * math.sin(math.pi * (x + GW / 2) / GW))) for x in
       [-GW / 2 + GW * i / 24 for i in range(25)]]
tube(bm, pts, 0.55, 10)
tube(bm_g, [p + Vector((0, -0.2, -0.5)) for p in pts], 0.12, 6)
obj("Cortinados", bm, "cloth", "Portal")
obj("Bordados de oro", bm_g, "filigree", "Portal")

# ------------------------------------------------------------------ forecourt and fan stair
FC = Vector((0, -(R_OUT + px(55)), 0))
FC_R = px(110)
bm = bmesh.new(); disk(bm, FC, 0, FC_R, 0, PODIUM, 90, 270); obj("Atrio semicircular", bm, "marble", "Acceso")
bm = bmesh.new()
for s in (-1, 1):
    c = FC + Vector((s * px(85), px(-0), 0))
    cyl(bm, c + Vector((0, 0, PODIUM)), px(14), 6.0, 24)
obj("Pilares del atrio", bm, "marble", "Acceso")
bm = bmesh.new()
for s in (-1, 1):
    c = FC + Vector((s * px(85), 0, PODIUM + 6.0))
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=px(9), matrix=Matrix.Translation(c + Vector((0, 0, px(9)))))
obj("Orbes de los pilares", bm, "cyan", "Acceso")
STEPS = 10
STAIR_Y0, STAIR_Y1 = FC.y - FC_R, FC.y - FC_R - px(150)
STAIR_W0, STAIR_W1 = px(200) / 2, px(270) / 2       # half widths at the top and at the foot
R_STEP0, R_STEP1 = FC_R, FC.y - STAIR_Y1 - 0.0       # step nosings are arcs about the atrium centre


def stair_half_width(r):
    t = (r - R_STEP0) / (R_STEP1 - R_STEP0)
    return STAIR_W0 + (STAIR_W1 - STAIR_W0) * min(1, max(0, t))


def stair_point(r, x_sign_frac):
    """Point on the arc of radius r, across the stair between its straight cheeks."""
    w = min(stair_half_width(r), r - 1e-3)
    x = x_sign_frac * w
    return Vector((x, FC.y - math.sqrt(max(0.0, r * r - x * x)), 0))


# Curved fan stair: each tread is the band between two arcs about the atrium
# centre, cut by the straight cheeks, so the nosings sweep round the atrium.
bm = bmesh.new()
for i in range(STEPS):
    ra, rb = R_STEP0 + (R_STEP1 - R_STEP0) * i / STEPS, R_STEP0 + (R_STEP1 - R_STEP0) * (i + 1) / STEPS
    z = PODIUM * (1 - (i + 1) / STEPS) + PODIUM / STEPS
    cols = 12
    inner = [stair_point(ra - .02, -1 + 2 * k / cols) for k in range(cols + 1)]
    outer = [stair_point(rb, -1 + 2 * k / cols) for k in range(cols + 1)]
    ring = inner + outer[::-1]
    top = [bm.verts.new((p.x, p.y, z)) for p in ring]
    bottom = [bm.verts.new((p.x, p.y, 0)) for p in ring]
    bm.faces.new(top)
    bm.faces.new(bottom[::-1])
    n = len(ring)
    for k in range(n):
        bm.faces.new((top[k], bottom[k], bottom[(k + 1) % n], top[(k + 1) % n]))
    # A rounded nosing: a half-round bead along the front arc of each tread.
    nose = [Vector((p.x, p.y, z - .035)) for p in outer]
    tube(bm, nose, .045, 4)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
obj("Escalinata", bm, "marble", "Acceso")

# Cheek walls follow the straight sides down the fan, stepped with the treads,
# with a moulded coping and a gold handrail.
bm_w, bm_r = bmesh.new(), bmesh.new()
for sign in (-1, 1):
    rail = []
    for i in range(STEPS + 1):
        r = R_STEP0 + (R_STEP1 - R_STEP0) * i / STEPS
        p = stair_point(r, sign)
        z = PODIUM * (1 - i / STEPS) + PODIUM / STEPS
        rail.append(p + Vector((sign * .35, 0, z + 1.05)))
        if i < STEPS:
            r2 = R_STEP0 + (R_STEP1 - R_STEP0) * (i + 1) / STEPS
            q = stair_point(r2, sign)
            mid = (p + q) / 2 + Vector((sign * .35, 0, 0))
            length = (q - p).length + .05
            ang = math.degrees(math.atan2(q.x - p.x, q.y - p.y))
            box(bm_w, mid + Vector((0, 0, (z + .8) / 2)), (.55, length, z + .8), ang)
            box(bm_w, mid + Vector((0, 0, z + .86)), (.75, length, .12), ang)
    tube(bm_r, rail, .06, 8)
obj("Muretes de la escalinata", bm_w, "marble", "Acceso")
obj("Pasamanos de la escalinata", bm_r, "gold", "Acceso")

bm = bmesh.new()
foot = [stair_point(R_STEP1, s) + Vector((s * .55, -.6, 0)) for s in (-1, 1)]
for c in foot:
    box(bm, c + Vector((0, 0, 1.4)), (1.6, 1.6, 2.8))
    box(bm, c + Vector((0, 0, 2.86)), (1.9, 1.9, .14))
    box(bm, c + Vector((0, 0, .08)), (1.95, 1.95, .16))
obj("Pedestales de la escalinata", bm, "marble", "Acceso")
bm = bmesh.new()
for c, s in zip(foot, (-1, 1)):
    torus(bm, c + Vector((0, 0, 3.6)), 0.6, 0.06, Matrix.Rotation(0.5 * s, 3, "Y"), 32, 6)
    torus(bm, c + Vector((0, 0, 3.6)), 0.6, 0.06, Matrix.Rotation(math.pi / 2, 3, "X"), 32, 6)
obj("Armilares de los pedestales", bm, "gold", "Acceso")

# ------------------------------------------------------------------ drum, dome, lantern, armillary
bm = bmesh.new(); disk(bm, Vector(), R_DRUM - 1.0, R_DRUM, H_ENT, H_DRUM, step=3); obj("Tambor", bm, "marble", "Cúpula")
bm_w, bm_p = bmesh.new(), bmesh.new()
for i in range(20):
    a = i * 18
    lancet(bm_w, polar(R_DRUM, a + 9) + Vector((0, 0, H_ENT + 1.6)), a + 9, 1.4, H_DRUM - H_ENT - 4.2, 0.15)
    box(bm_p, polar(R_DRUM + 0.3, a) + Vector((0, 0, (H_ENT + H_DRUM) / 2)), (0.9, 0.6, H_DRUM - H_ENT), a)
obj("Ventanas del tambor", bm_w, "window", "Cúpula")
obj("Pilastras del tambor", bm_p, "marble", "Cúpula")
bm = bmesh.new(); disk(bm, Vector(), R_DRUM - 1.0, R_DRUM + 1.0, H_DRUM - 0.8, H_DRUM); obj("Cornisa del tambor", bm, "gold", "Cúpula")
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=R_DRUM - 0.3, location=(0, 0, H_DRUM))
dome = bpy.context.object; dome.name = "Cúpula de tejas teal"
bpy.ops.object.mode_set(mode="EDIT"); bm = bmesh.from_edit_mesh(dome.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
for v in bm.verts:
    v.co.z *= H_DOME / (R_DRUM - 0.3)
bmesh.update_edit_mesh(dome.data); bpy.ops.object.mode_set(mode="OBJECT")
dome.data.materials.append(M["tiles"]); scene.collection.objects.unlink(dome); collection("Cúpula").objects.link(dome)
bm = bmesh.new()
for i in range(16):
    a = math.radians(i * 22.5)
    pts = [Vector(((R_DRUM - 0.15) * math.cos(t) * math.cos(a), (R_DRUM - 0.15) * math.cos(t) * math.sin(a),
                   H_DRUM + H_DOME * 1.01 * math.sin(t))) for t in [math.pi / 2 * k / 20 * 0.93 for k in range(21)]]
    tube(bm, pts, 0.22, 6)
obj("Nervaduras de oro", bm, "gold", "Cúpula")
TOP = H_DRUM + H_DOME
bm = bmesh.new(); cyl(bm, Vector((0, 0, TOP - 0.6)), 2.2, 3.6, 24)
bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=2.3, matrix=Matrix.Translation(Vector((0, 0, TOP + 3.0))))
obj("Linterna", bm, "marble", "Cúpula")
bm = bmesh.new()
for i in range(8):
    lancet(bm, polar(2.2, i * 45 + 22.5) + Vector((0, 0, TOP + 0.2)), i * 45 + 22.5, 0.9, 2.2, 0.1)
obj("Ventanas de la linterna", bm, "window", "Cúpula")
ARM = Vector((0, 0, TOP + 5.3 + 6.0))
bm = bmesh.new()
cyl(bm, Vector((0, 0, TOP + 4.6)), 0.5, 1.4, 16, 0.3)
for rot in (Matrix(), Matrix.Rotation(math.pi / 2, 3, "X"), Matrix.Rotation(math.pi / 2, 3, "Y"),
            Matrix.Rotation(math.radians(23.4), 3, "X") @ Matrix.Rotation(math.pi / 2, 3, "Y")):
    torus(bm, ARM, 6.0, 0.22, rot, 96, 8)
torus(bm, ARM, 5.3, 0.12, Matrix.Rotation(math.radians(66), 3, "X"), 96, 6)
cyl(bm, ARM + Vector((0, 0, 5.8)), 0.18, 7.0, 10, 0.02)
obj("Esfera armilar", bm, "gold", "Cúpula")
bm = bmesh.new(); torus(bm, ARM, 8.6, 0.12, Matrix.Rotation(math.radians(-14), 3, "X") @ Matrix.Rotation(0.3, 3, "Y"), 128, 6)
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.45, matrix=Matrix.Translation(ARM + Vector((0, 0, 13.2))))
obj("Anillo de éter y estrella", bm, "cyan", "Cúpula")
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=2.2, matrix=Matrix.Translation(ARM))
obj("Núcleo luminoso", bm, "sun", "Cúpula")

# ------------------------------------------------------------------ bronze portholes and vents on the drum terrace
bm_r, bm_g2, bm_v = bmesh.new(), bmesh.new(), bmesh.new()
for i in range(10):
    a = i * 36 + 18
    c = polar(R_DRUM + 0.05, a) + Vector((0, 0, H_DRUM - 2.2))
    torus(bm_r, c, 0.75, 0.14, Matrix.Rotation(math.radians(-a), 3, "Z") @ Matrix.Rotation(math.pi / 2, 3, "X"), 32, 6)
    cyl(bm_g2, Vector(), 0.62, 0.08, 24)
    bm_g2.transform(Matrix())
for i in range(12):
    a = i * 30 + 15
    box(bm_v, polar(R_OUT - T_OUT - 3.0, a) + Vector((0, 0, H_ENT + 0.5)), (2.4, 1.6, 1.0), a)
obj("Ojos de buey", bm_r, "bronze", "Cúpula")
bm_g2.free()
obj("Rejillas de ventilación", bm_v, "titanium", "Cubierta")

# ------------------------------------------------------------------ path with lanterns
bm = bmesh.new(); bm_l, bm_lw = bmesh.new(), bmesh.new()
lantern_points = []
y, x = STAIR_Y1, 0.0
pts = []
for i in range(30):
    pts.append(Vector((x, y, 0.02)))
    y -= 2.2; x = 9.0 * math.sin(i / 9.0)
for i, p in enumerate(pts[:-1]):
    d = (pts[i + 1] - p).normalized(); n = Vector((-d.y, d.x, 0))
    for k in range(-3, 4):
        box(bm, p + n * k * 1.05 + Vector((0, 0, 0.03)), (0.95, 2.0, 0.08), math.degrees(math.atan2(d.x, d.y)))
    if i % 3 == 0:
        for s in (-1, 1):
            c = p + n * s * 4.6
            cyl(bm_l, c, 0.08, 1.6, 8)
            box(bm_l, c + Vector((0, 0, 1.9)), (0.45, 0.45, 0.05))
            box(bm_lw, c + Vector((0, 0, 1.68)), (0.34, 0.34, 0.42))
            lantern_points.append(c + Vector((0, 0, 1.68)))
obj("Camino de piedra", bm, "stone", "Entorno")
obj("Faroles", bm_l, "bronze", "Entorno")
obj("Luz de faroles", bm_lw, "window", "Entorno")

# ================================================================== detail pass toward the reference perspective
# chamber doors: gold frames with a cyan threshold plane; each is a stable portal anchor for its room
for n, a in enumerate(room_doors, 1):
    bm = bmesh.new()
    c = polar(R_ROOMS_IN, a) + Vector((0, 0, Z0))
    lancet_frame(bm, c, a + 180, DOOR_W, DOOR_H, 0.35, 0.3)
    obj(f"Marco de puerta · cámara {n:02d}", bm, "gold", "Portales")
    bm = bmesh.new(); lancet(bm, polar(R_ROOMS_IN - px(4), a) + Vector((0, 0, Z0)), a + 180, DOOR_W - 0.1, DOOR_H - 0.05, 0.02)
    o = obj(f"Portal · cámara {n:02d}", bm, "portal", "Portales")
    o["holodeck_portal"] = f"camara-{n:02d}"; o["holodeck_role"] = "room-portal"

# monumental portal tower rising above the cornice, with the cyan glyph of the reference
TW = HALL_W + 3.0
bm = bmesh.new()
box(bm, Vector((0, GATE_Y1 + 1.2, H_ENT + 4.6)), (TW + 1.6, 3.2, 0.6))
for s_ in (-1, 1):
    box(bm, Vector((s_ * (TW / 2 + 0.4), GATE_Y1 - 0.3, (Z0 + H_ENT + 4.3) / 2)), (1.2, 1.2, H_ENT + 4.3 - Z0))
obj("Torre del portal", bm, "marble", "Portal")
bm = bmesh.new(); box(bm, Vector((0, GATE_Y1 + 0.2, (H_COL + 2 + H_ENT + 4.3) / 2)), (TW - 0.4, 0.4, H_ENT + 4.3 - H_COL - 2))
panel = obj("Panel teal del portal", bm, "panel", "Portal")
# Keep the cladding clear of the pavilion's coplanar front face.
panel["holodeck_collision_y"] = panel.location.y
panel.location.y -= 0.08
bm = bmesh.new()
g = Vector((0, GATE_Y1 - 0.05, H_ENT + 1.2))
torus(bm, g, 2.2, 0.16, Matrix.Rotation(math.pi / 2, 3, "X"), 64, 6)
torus(bm, g, 1.2, 0.12, Matrix.Rotation(math.pi / 2, 3, "X"), 48, 6)
for k, dx in enumerate((-1.6, -0.8, 0, 0.8, 1.6)):
    top = g.z - 2.2 if k != 2 else g.z - 1.2
    length = 4.0 + abs(dx) * 1.5
    box(bm, Vector((dx, GATE_Y1 - 0.05, top - length / 2)), (0.16, 0.08, length))
    cyl(bm, Vector((dx, GATE_Y1 - 0.1, top - length - 0.15)), 0.28, 0.1, 12)
glyph = obj("Glifo de éter del portal", bm, "cyan", "Portal")
glyph.location.y = panel.location.y

# dome: gold base ring, gold lattice belt and stronger ribs
bm = bmesh.new()
disk(bm, Vector(), R_DRUM - 0.5, R_DRUM + 0.4, H_DRUM, H_DRUM + 0.7)
for k in range(1, 4):
    t = math.radians(18 * k)
    r = (R_DRUM - 0.25) * math.cos(t); z = H_DRUM + H_DOME * math.sin(t)
    torus(bm, Vector((0, 0, z)), r, 0.12, Matrix(), 96, 6)
obj("Anillos de oro de la cúpula", bm, "gold", "Cúpula")

# balustrade around the drum terrace, small armillaries on the towers
bm = bmesh.new()
for i in range(90):
    cyl(bm, polar(R_DRUM + 2.2, i * 4) + Vector((0, 0, H_ENT)), 0.12, 0.95, 8)
disk(bm, Vector(), R_DRUM + 2.0, R_DRUM + 2.4, H_ENT + 0.95, H_ENT + 1.15)
obj("Balaustrada del tambor", bm, "marble", "Cúpula")
bm = bmesh.new()
for a in (64, -64, 136, -136):
    c = polar(R_OUT + px(6), a) + Vector((0, 0, H_ENT + 2.0 + px(22) + 2.6))
    for rot in (Matrix(), Matrix.Rotation(math.pi / 2, 3, "X"), Matrix.Rotation(math.pi / 2, 3, "Y"),
                Matrix.Rotation(0.4, 3, "X") @ Matrix.Rotation(math.pi / 2, 3, "Y")):
        torus(bm, c, 1.3, 0.07, rot, 40, 6)
obj("Armilares de los torreones", bm, "gold", "Torreones")

# ground-level drone/transit bays (dark arches with cyan glow) on the sides, from the plan legend
bm_f, bm_g = bmesh.new(), bmesh.new()
for a in (118, 128, -118, -128, 62, -62):
    c = polar(R_OUT + 0.1, a) + Vector((0, 0, Z0))
    lancet_frame(bm_f, c, a, 3.6, 5.2, 0.3, 0.35)
    lancet(bm_g, polar(R_OUT + 0.05, a) + Vector((0, 0, Z0)), a, 3.5, 5.1, 0.04)
obj("Arcos de puertos de tránsito", bm_f, "titanium", "Fachada")
obj("Umbrales de puertos de tránsito", bm_g, "portal", "Fachada")

# (the earlier mullion-and-oculus window tracery is replaced by the Gothic tracery below)

# Gothic tracery: every main lancet splits into two sub-lancets under a
# quatrefoil, with a moulded ring round the foil (gold, like the frames).
bm = bmesh.new()
for a in win_angles:
    sill = Z0 + 3.0
    h = H_COL - sill - 3.0
    t = math.radians(a)
    tangent = Vector((math.cos(t), -math.sin(t), 0))
    face = polar(R_OUT + 0.3, a)
    for side in (-1, 1):
        lancet_frame(bm, face + tangent * side * .58 + Vector((0, 0, sill)), a, .92, h - 1.9, .07, .07)
    head = face + Vector((0, 0, sill + h - 1.05))
    turn = Matrix.Rotation(math.radians(-a), 3, "Z") @ Matrix.Rotation(math.pi / 2, 3, "X")
    for k in range(4):
        ang = k * math.pi / 2 + math.pi / 4
        torus(bm, head + (tangent * math.cos(ang) + Vector((0, 0, math.sin(ang)))) * .2, .17, .035, turn, 12, 3)
    torus(bm, head, .45, .045, turn, 20, 4)
obj("Tracería gótica", bm, "gold", "Fachada")

# Mouldings: a torus and fillet at the foot of the walls, a podium cornice,
# dentils and a cyma under the main cornice, and a moulded drum cornice.
bm = bmesh.new()
torus(bm, Vector((0, 0, Z0 + .2)), R_OUT + .12, .2, Matrix(), 96, 5)
disk(bm, Vector(), R_OUT - .05, R_OUT + .32, Z0, Z0 + .08)
torus(bm, Vector((0, 0, PODIUM - .12)), R_OUT + 3.25, .14, Matrix(), 96, 5)
disk(bm, Vector(), R_OUT + 3.1, R_OUT + 3.42, PODIUM - .05, PODIUM + .02)
torus(bm, Vector((0, 0, H_ENT - .82)), RC + 1.85, .2, Matrix(), 96, 5)
torus(bm, Vector((0, 0, H_COL + 1.55)), RC + 1.45, .12, Matrix(), 96, 4)
torus(bm, Vector((0, 0, H_DRUM - .15)), R_DRUM + .35, .22, Matrix(), 72, 5)
torus(bm, Vector((0, 0, H_ENT + .02)), R_DRUM + .25, .16, Matrix(), 72, 4)
obj("Molduras", bm, "marble", "Fachada")
bm = bmesh.new()
for i in range(240):
    a = i * 1.5
    if abs(a - 180) < HALL_GAP(R_OUT) - 1:
        continue
    box(bm, polar(RC + 1.82, a) + Vector((0, 0, H_ENT - 1.12)), (.26, .3, .32), a)
obj("Dentículos", bm, "marble", "Fachada")

# interior pilasters with gold capitals along the common corridors, and a gold cornice under the roof
bm_p, bm_g = bmesh.new(), bmesh.new()
for r, face, n, h in ((R_ROOMS_IN - px(8) - 0.25, 180, 30, H_ROOF), (R_ARC_OUT + 0.25, 0, 24, H_ROOF), (R_ARC_IN - 0.25, 180, 16, H_ROOF)):
    for i in range(n):
        a = i * 360 / n + 360 / n / 2
        if near(a, [180], 14) or near(a, room_doors, 4) or near(a, [0, 90, 270], 10):
            continue
        c = polar(r, a)
        box(bm_p, c + Vector((0, 0, (Z0 + h) / 2)), (1.0, 0.5, h - Z0), a)
        box(bm_g, c + Vector((0, 0, h - 1.6)), (1.4, 0.8, 0.9), a)
for r0, r1 in ((R_ARC_OUT, R_ARC_OUT + 0.6), (R_ROOMS_IN - px(8) - 0.6, R_ROOMS_IN - px(8))):
    disk(bm_g, Vector(), r0, r1, H_ROOF - 1.0, H_ROOF - 0.6)
obj("Pilastras interiores", bm_p, "marble", "Interior común")
obj("Capiteles y cornisa interior", bm_g, "gold", "Interior común")
bm = bmesh.new()
for i in range(48):
    a = i * 7.5
    box(bm, polar((R_ROOMS_IN + R_ARC_OUT) / 2, a) + Vector((0, 0, Z0 + 0.06)), (0.12, R_ROOMS_IN - R_ARC_OUT - 1.0, 0.03), a)
disk(bm, Vector(), (R_ROOMS_IN + R_ARC_OUT) / 2 - 0.08, (R_ROOMS_IN + R_ARC_OUT) / 2 + 0.08, Z0 + 0.05, Z0 + 0.08)
obj("Taraceas del corredor", bm, "cyan", "Interior común")

# ================================================================== lighting fixtures (exported as punctual lights)
def light(name, kind, loc, energy, color, coll="Iluminación", rot=None, size=None, spot=None, shadow=False):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color; d.use_shadow = shadow
    if size is not None:
        d.shadow_soft_size = size
    if spot is not None:
        d.spot_size, d.spot_blend = math.radians(spot), 0.6
    o = bpy.data.objects.new(name, d); collection(coll).objects.link(o); o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    return o


WARM, CYAN = (1.0, 0.72, 0.45), (0.3, 0.85, 1.0)
for i, a in enumerate(win_angles):                       # facade uplights between the columns
    p = polar(R_OUT + 4.2, a) + Vector((0, 0, Z0 + 0.3))
    aim = (polar(R_OUT, a) + Vector((0, 0, H_COL)) - p)
    light(f"Bañador de fachada {i:02d}", "SPOT", p, 6000, WARM, rot=aim.to_track_quat("-Z", "Y").to_euler(), size=0.6, spot=55)
for s_ in (-1, 1):
    p = Vector((s_ * 6.0, GATE_Y1 - 7, 0.5))
    aim = Vector((0, GATE_Y1, 12)) - p
    light(f"Bañador del portal {s_:+d}", "SPOT", p, 20000, WARM, rot=aim.to_track_quat("-Z", "Y").to_euler(), size=0.5, spot=50, shadow=True)
for i in range(12):                                      # ring corridor and inner ring lamps
    light(f"Lámpara del corredor {i:02d}", "POINT", polar((R_ROOMS_IN + R_ARC_OUT) / 2, i * 30 + 15) + Vector((0, 0, Z0 + 9)), 700, WARM, size=1.0)
for i in range(8):
    light(f"Lámpara del anillo interior {i:02d}", "POINT", polar((R_CORE_WALL + R_ARC_IN) / 2, i * 45 + 22.5) + Vector((0, 0, Z0 + 7)), 450, WARM, size=0.8)
light("Resplandor del núcleo", "POINT", Vector((0, 0, Z0 + 6)), 2500, CYAN, size=1.5)
for i in range(8):
    light(f"Luz del tambor {i:02d}", "POINT", polar(R_DRUM - 3, i * 45) + Vector((0, 0, H_ENT + 3)), 1200, WARM, size=1.5)
light("Luz de la linterna", "POINT", Vector((0, 0, TOP + 1.2)), 3000, WARM, size=0.8)
light("Luz del sol armilar", "POINT", ARM, 60000, (1.0, 0.8, 0.45), size=2.2)
light("Estrella", "POINT", ARM + Vector((0, 0, 13.2)), 8000, CYAN, size=0.4)
for i, p in enumerate(lantern_points):
    light(f"Farol {i:02d}", "POINT", p, 120, WARM, size=0.2)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "residencia.blend"))
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("RESULT", {"objects": len([o for o in bpy.data.objects if o.type == "MESH"]), "faces": tris,
                 "height_m": round(ARM.z + 13.6, 1), "diameter_m": D})
