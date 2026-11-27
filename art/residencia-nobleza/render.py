"""Review renders of residencia.blend: plan, front and side elevations, night perspective.

    blender -b OUT/residencia.blend --python-exit-code 9 --python art/residencia-nobleza/render.py -- OUT [--fast]
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()
fast = "--fast" in args
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 16 if fast else 64
sc.render.film_transparent = False
sc.view_settings.view_transform = "AgX"
world = bpy.data.worlds.new("Noche"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]


def sun(name, energy, rot, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "SUN"); d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = rot
    return o


def camera(name, loc, target, ortho=None, lens=35):
    c = bpy.data.cameras.new(name)
    if ortho:
        c.type = "ORTHO"; c.ortho_scale = ortho
    c.lens = lens; c.clip_end = 2000
    o = bpy.data.objects.new(name, c); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def shot(cam, name, w, h, hide=()):
    sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = w, h
    for o in bpy.data.objects:
        o.hide_render = any(o.users_collection and c.name in hide for c in o.users_collection)
    sc.render.filepath = str(out / name); bpy.ops.render.render(write_still=True)


day = [sun("Sol", 3.5, (math.radians(50), 0, math.radians(30))), sun("Relleno", 1.0, (math.radians(70), 0, math.radians(210)))]
bg.inputs["Color"].default_value = (0.08, 0.1, 0.13, 1); bg.inputs["Strength"].default_value = 1.0
size = 1600 if not fast else 900
plan = camera("Planta", (0, -8, 300), (0, -8, 0), ortho=96)
# hide everything above the interior walls for a plan cut
cut = {"Cúpula", "Fachada", "Cubierta"}
dark = bpy.data.materials.new("Corte"); dark.diffuse_color = (0.05, 0.07, 0.09, 1)
dark.use_nodes = True; dark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.25, 0.27, 0.3, 1)
floors = [bpy.data.objects[n] for n in ("Piso interior", "Podio")]
keep = [o.data.materials[0] for o in floors]
for o in floors:
    o.data.materials[0] = dark
day[0].rotation_euler = (0, 0, 0); day[1].data.energy = 0
shot(plan, "planta-corte.png", size, size, hide=cut | {"Entorno"})
for o, m in zip(floors, keep):
    o.data.materials[0] = m
shot(plan, "planta-cubierta.png", size, size, hide={"Entorno"})
day[0].rotation_euler = (math.radians(50), 0, math.radians(30)); day[1].data.energy = 1.0
shot(camera("Alzado frontal", (0, -300, 34), (0, 0, 34), ortho=78), "alzado-frontal.png", size, size, hide={"Entorno"})
shot(camera("Alzado lateral", (300, 0, 34), (0, 0, 34), ortho=78), "alzado-lateral.png", size, size, hide={"Entorno"})
for s in day:
    s.data.energy *= 0.06
day[0].data.color = (0.55, 0.7, 1.0); day[0].data.energy = 0.9
bg.inputs["Color"].default_value = (0.01, 0.015, 0.04, 1); bg.inputs["Strength"].default_value = 1.0
shot(camera("Perspectiva", (-38, -118, 9), (4, 0, 30), lens=32), "perspectiva-noche.png", size, int(size * 0.62))
