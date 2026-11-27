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
R_DRUM = 310 / 2 * E
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
    g = e.new(0.025); g.color = (0.80, 0.64, 0.32, 1)
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
    "window": node_mat("Ventanal cálido", emissive((1.0, 0.62, 0.28), 3.5)),
    "glass": node_mat("Vidrio de ojo de buey", emissive((0.05, 0.12, 0.2), 0.4)),
    "cloth": node_mat("Cortinado teal bordado", cloth),
    "stone": node_mat("Piedra del camino", stone),
    "sun": node_mat("Núcleo de la esfera armilar", emissive((1.0, 0.78, 0.35), 14.0)),
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
ring_wall("Muro de cámaras", R_ROOMS_IN - px(8), R_ROOMS_IN, Z0, H_INT,
          [(180, HALL_GAP(R_ROOMS_IN))] + [((a + 12) % 360, door(R_ROOMS_IN)) for a in room_angles if (a + 12) % 360 not in (180,)])
ring_wall("Muro portante del tambor", R_ARC_IN, R_ARC_OUT, Z0, H_ENT,
          [(0, 9), (90, 9), (270, 9), (180, HALL_GAP(R_ARC_OUT))], coll="Estructura")
ring_wall("Muro del núcleo", R_CORE_WALL - 0.45, R_CORE_WALL, Z0, H_INT, [(a, 6) for a in (45, 135, 225, 315)] + [(180, HALL_GAP(R_CORE_WALL))])
bm = bmesh.new()
for a in room_angles:
    r0, r1 = R_ROOMS_IN, R_OUT - T_OUT
    box(bm, polar((r0 + r1) / 2, a) + Vector((0, 0, Z0 + H_INT / 2 - PODIUM / 2)), (0.4, r1 - r0, H_INT - PODIUM), a)
obj("Tabiques de cámaras", bm, "marble", "Estructura")
# entrance hall walls from core to gatehouse
bm = bmesh.new()
y0, y1 = -R_CORE_WALL, -(R_OUT + px(30))
for x in (-HALL_W / 2 - 0.3, HALL_W / 2 + 0.3):
    box(bm, Vector((x, (y0 + y1) / 2, Z0 + (H_INT - PODIUM) / 2)), (0.6, abs(y1 - y0), H_INT - PODIUM))
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
lancet(bm_c, Vector((0, GATE_Y1, Z0)), 180, HALL_W * 0.75, door_h, 0.3)
obj("Arco del portal", bm_c, "gold", "Portal")
bm = bmesh.new(); lancet(bm, Vector((0, GATE_Y1 + 0.6, Z0)), 180, HALL_W * 0.62, door_h - 0.6, 0.2)
obj("Puerta de bronce", bm, "bronze", "Portal")
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
bm = bmesh.new()
for i in range(STEPS):
    t0, t1 = i / STEPS, (i + 1) / STEPS
    ya, yb = STAIR_Y0 + (STAIR_Y1 - STAIR_Y0) * t0, STAIR_Y0 + (STAIR_Y1 - STAIR_Y0) * t1
    wa = px(200) + px(70) * t1
    z = PODIUM * (1 - t1) + PODIUM / STEPS
    box(bm, Vector((0, (ya + yb) / 2 - 0.0, z / 2)), (wa, abs(yb - ya) + 0.02, z))
obj("Escalinata", bm, "marble", "Acceso")
bm = bmesh.new()
for s in (-1, 1):
    c = Vector((s * (px(270) / 2 + 0.4), STAIR_Y1 + 0.5, 0))
    box(bm, c + Vector((0, 0, 1.4)), (1.6, 1.6, 2.8))
obj("Pedestales de la escalinata", bm, "marble", "Acceso")
bm = bmesh.new()
for s in (-1, 1):
    torus(bm, Vector((s * (px(270) / 2 + 0.4), STAIR_Y1 + 0.5, 3.6)), 0.6, 0.06, Matrix.Rotation(0.5 * s, 3, "Y"), 32, 6)
    torus(bm, Vector((s * (px(270) / 2 + 0.4), STAIR_Y1 + 0.5, 3.6)), 0.6, 0.06, Matrix.Rotation(math.pi / 2, 3, "X"), 32, 6)
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
obj("Camino de piedra", bm, "stone", "Entorno")
obj("Faroles", bm_l, "bronze", "Entorno")
obj("Luz de faroles", bm_lw, "window", "Entorno")

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "residencia.blend"))
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("RESULT", {"objects": len([o for o in bpy.data.objects if o.type == "MESH"]), "faces": tris,
                 "height_m": round(ARM.z + 13.6, 1), "diameter_m": D})
