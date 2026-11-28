"""Review renders of residencia.blend: plan cut, roof, elevations, reference-like night views and interior.

    blender -b OUT/residencia.blend --python-exit-code 9 --python art/residencia-nobleza/render.py -- OUT [--fast]

Adds a render-only night setting (ground, pines, moon) in collection "Ambiente de revisión";
it is not part of the house and is never saved.
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()
fast = "--fast" in args
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 16 if fast else 64
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
world = bpy.data.worlds.new("Noche"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]

# bloom through the compositor glare node
sc.use_nodes = True if hasattr(sc, "use_nodes") else None
try:
    tree = sc.compositing_node_group or bpy.data.node_groups.new("Revisión", "CompositorNodeTree")
    sc.compositing_node_group = tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    rl = tree.nodes.new("CompositorNodeRLayers"); gl = tree.nodes.new("CompositorNodeGlare")
    if "Type" in gl.inputs:
        gl.inputs["Type"].default_value = "Bloom"
    elif hasattr(gl, "glare_type"):
        gl.glare_type = "BLOOM"
    outn = tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    go = tree.nodes.new("NodeGroupOutput")
    tree.links.new(rl.outputs["Image"], gl.inputs[0]); tree.links.new(gl.outputs[0], go.inputs[0])
except Exception as exc:  # noqa: BLE001 - review renders still work without bloom
    print("bloom unavailable:", exc)


def sun(name, energy, rot, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "SUN"); d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = rot
    return o


def camera(name, loc, target, ortho=None, lens=35):
    c = bpy.data.cameras.new(name)
    if ortho:
        c.type = "ORTHO"; c.ortho_scale = ortho
    c.lens = lens; c.clip_end = 3000; c.clip_start = 0.2
    o = bpy.data.objects.new(name, c); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def shot(cam, name, w, h, hide=()):
    sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = w, h
    for o in bpy.data.objects:
        o.hide_render = any(c.name in hide for c in o.users_collection)
    sc.render.filepath = str(out / name); bpy.ops.render.render(write_still=True)


def material(name, color, rough=0.9, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1); b.inputs["Emission Strength"].default_value = emit
    return m


env = bpy.data.collections.new("Ambiente de revisión"); sc.collection.children.link(env)


def env_obj(name, bm, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); env.objects.link(o)
    return o


bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=600)
env_obj("Césped", bm, material("Césped nocturno", (0.03, 0.07, 0.035)))
rng = random.Random(7)
bm, bm_t = bmesh.new(), bmesh.new()
for _ in range(140):
    while True:
        p = Vector((rng.uniform(-170, 170), rng.uniform(-150, 170), 0))
        if p.length > 42 and not (abs(p.x) < 22 and p.y < -30):
            break
    h = rng.uniform(14, 30)
    for k in range(3):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=h * (0.28 - 0.06 * k), radius2=0.1,
                              depth=h * 0.45, matrix=Matrix.Translation(p + Vector((0, 0, h * (0.32 + 0.22 * k)))))
    bmesh.ops.create_cone(bm_t, cap_ends=True, segments=6, radius1=0.5, radius2=0.35, depth=h * 0.3,
                          matrix=Matrix.Translation(p + Vector((0, 0, h * 0.15))))
env_obj("Pinos", bm, material("Pino", (0.02, 0.06, 0.04)))
env_obj("Troncos", bm_t, material("Tronco", (0.06, 0.04, 0.03)))
bm = bmesh.new()
for _ in range(260):
    p = Vector((rng.uniform(-90, 90), rng.uniform(-120, 60), rng.uniform(0.4, 3.5)))
    if p.xy.length > 32:
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.07, matrix=Matrix.Translation(p))
env_obj("Luciérnagas", bm, material("Luciérnaga", (0.2, 0.9, 1.0), emit=40))
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=40,
                                            matrix=Matrix.Translation(Vector((-300, 700, 420))))
env_obj("Luna", bm, material("Luna", (0.6, 0.95, 1.0), emit=6))
REVIEW = {"Ambiente de revisión"}

day = [sun("Sol", 3.5, (math.radians(50), 0, math.radians(30))), sun("Relleno", 1.0, (math.radians(70), 0, math.radians(210)))]
bg.inputs["Color"].default_value = (0.08, 0.1, 0.13, 1); bg.inputs["Strength"].default_value = 1.0
size = 1600 if not fast else 900
plan = camera("Planta", (0, -8, 300), (0, -8, 0), ortho=96)
cut = {"Cúpula", "Fachada", "Cubierta", "Portal"}
dark = material("Corte", (0.25, 0.27, 0.3))
floors = [bpy.data.objects[n] for n in ("Piso interior", "Podio")]
keep = [o.data.materials[0] for o in floors]
for o in floors:
    o.data.materials[0] = dark
day[0].rotation_euler = (0, 0, 0); day[1].data.energy = 0
shot(plan, "planta-corte.png", size, size, hide=cut | {"Entorno"} | REVIEW)
for o, m in zip(floors, keep):
    o.data.materials[0] = m
shot(plan, "planta-cubierta.png", size, size, hide={"Entorno"} | REVIEW)
day[0].rotation_euler = (math.radians(50), 0, math.radians(30)); day[1].data.energy = 1.0
shot(camera("Alzado frontal", (0, -300, 34), (0, 0, 34), ortho=78), "alzado-frontal.png", size, size, hide={"Entorno"} | REVIEW)
shot(camera("Alzado lateral", (300, 0, 34), (0, 0, 34), ortho=78), "alzado-lateral.png", size, size, hide={"Entorno"} | REVIEW)

# night, matching the reference perspective and the ambient sample
day[0].data.energy = 0.7; day[0].data.color = (0.5, 0.65, 1.0); day[0].rotation_euler = (math.radians(60), 0, math.radians(200))
day[1].data.energy = 0.05
bg.inputs["Color"].default_value = (0.02, 0.03, 0.08, 1)
shot(camera("Perspectiva", (-30, -112, 3.5), (6, -10, 26), lens=30), "perspectiva-noche.png", size, int(size * 0.62))
shot(camera("Muestra ambiental", (-95, -120, 6), (10, 0, 30), lens=34), "ambiente-noche.png", size, int(size * 0.56))
# interior: from the entrance hall into the domed core, at eye height
shot(camera("Interior", (0, -22, 3.5), (0, 0, 14), lens=20), "interior-nucleo.png", size, int(size * 0.62), hide=REVIEW)
shot(camera("Corredor", Vector((16.3 * math.sin(math.radians(150)), 16.3 * math.cos(math.radians(150)), 3.5)),
            Vector((16.3 * math.sin(math.radians(110)), 16.3 * math.cos(math.radians(110)), 4.5)), lens=20),
     "interior-corredor.png", size, int(size * 0.62), hide=REVIEW)
