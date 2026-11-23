"""Author an independent Blender layout study of the coastal settlement."""
from pathlib import Path
import sys

import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def material(name, rgb):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*rgb, 1)
    return value


def mesh(name, points, faces, finish):
    data = bpy.data.meshes.new(name)
    data.from_pydata(points, [], faces)
    data.update()
    object_ = bpy.data.objects.new(name, data)
    scene.collection.objects.link(object_)
    object_.data.materials.append(finish)
    return object_


def platform(name, outline, height, finish, bottom=-0.6):
    count = len(outline)
    points = [(x, y, z) for z in (bottom, height) for x, y in outline]
    walls = [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    faces = [tuple(range(count, count * 2)), tuple(reversed(range(count))), *walls]
    return mesh(name, points, faces, finish)


def path(name, points, width, finish):
    edges = [Vector((b[1] - a[1], a[0] - b[0])).normalized()
             for a, b in zip(points, points[1:])]
    vertices = []
    for index, (x, y, z) in enumerate(points):
        previous = edges[max(0, index - 1)]
        following = edges[min(index, len(edges) - 1)]
        miter = (previous + following).normalized()
        offset = miter * (width / 2) / max(0.5, miter.dot(following))
        vertices.extend([(x + offset.x, y + offset.y, z),
                         (x - offset.x, y - offset.y, z)])
    faces = [(i, i + 2, i + 3, i + 1) for i in range(0, len(vertices) - 2, 2)]
    mesh(name, vertices, faces, finish)


stone = material("Mineral ground", (0.28, 0.32, 0.23))
water = material("Basin", (0.10, 0.26, 0.31))
paving = material("Public routes", (0.70, 0.58, 0.37))
green = material("Garden", (0.23, 0.42, 0.22))
gallery = material("Gallery", (0.45, 0.30, 0.22))
house = material("Casa and tower", (0.22, 0.44, 0.43))
parcel = material("Creator parcels", (0.41, 0.45, 0.39))
platform("Basin", [(-95,-80),(95,-80),(95,80),(-95,80)], -.7, water, -.8)
platform("Arrival peninsula", [(-30,-26),(-11,-22),(-3,-14),(3,7),(-18,15),(-37,10),(-42,-8)], .1, stone)
platform("Garden terrace", [(-5,-20),(21,-13),(29,1),(16,13),(1,8),(-6,-9)], .2, green)
platform("Uphill quarter", [(-13,11),(16,8),(35,11),(40,30),(20,41),(-18,36),(-27,23)], .35, stone)
platform("Gallery headland", [(-26,-19),(-10,-23),(9,-22),(13,-32),(-9,-41),(-28,-33)], .1, stone)
platform("Basin-facing gallery volume", [(-13,-34),(1,-35),(3,-28),(-11,-26)], 4.3, gallery, .04)
platform("Casa above the Beacon lab", [(12,12),(25,13),(28,24),(18,27),(11,21)], 7.0, house, .33)
platform("Tower landmark", [(-23,24),(-17,23),(-16,29),(-22,30)], 10.0, house, .34)
for x, y in [(-12,28),(-3,29),(6,30),(15,31),(25,30),(32,24)]:
    platform(f"Reserved parcel {x:+}", [(x-2.6,y-2.3),(x+2.6,y-2.3),(x+2.6,y+2.3),(x-2.6,y+2.3)], .46, parcel, .32)
path("Arrival through garden to Casa", [(-30,-11,.13),(-19,-8,.13),(-3,-5,.24),(7,0,.24),(13,10,.39),(14,15,.39)], 3.4, paving)
path("Waterfront return via tower", [(13,10,.39),(3,15,.39),(-8,18,.39),(-20,23,.39),(-26,13,.39),(-25,5,.13),(-30,-11,.13)], 3.1, paving)
path("Parcel promenade", [(-20,23,.4),(-8,25,.4),(5,26,.4),(16,27,.4),(31,28,.4),(34,19,.4),(27,12,.4),(13,10,.4)], 2.8, paving)
path("Gallery branch", [(-19,-8,.15),(-16,-18,.15),(-9,-24,.15),(-5,-28,.15)], 2.8, paving)
platform("Gallery footbridge", [(-14,-20),(-12,-18),(-7,-23),(-9,-25)], .14, paving, -.25)
platform("Tower footbridge", [(-28,11),(-25,10),(-19,22),(-22,24)], .37, paving, -.25)

bpy.ops.object.camera_add(location=(0,-2,105))
camera = bpy.context.object
camera.name = "Level plan"
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 106
scene.camera = camera
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x = 1100
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(output / "coastal-settlement-plan.png")
bpy.ops.wm.save_as_mainfile(filepath=str(output / "coastal-settlement.blend"), compress=True)
bpy.ops.render.render(write_still=True)
