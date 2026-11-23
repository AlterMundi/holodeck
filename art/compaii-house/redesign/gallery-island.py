"""Author the west promenade landing and the outdoor presentation pavilion."""
from math import cos, pi, sin
from pathlib import Path
from random import Random
import sys

import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"

rng = Random(183)
pieces = []


def finish(name, colour, roughness, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Emission Color"].default_value = mat.diffuse_color
    shader.inputs["Emission Strength"].default_value = emission
    return mat


limestone = [
    finish("Limestone ashlar " + name, colour, .78)
    for name, colour in (
        ("chalk", (.54, .462, .34)), ("warm", (.47, .398, .293)),
        ("sand", (.49, .421, .322)), ("pale", (.58, .510, .381)))
]
basalt = finish("Honed basalt", (.099, .12, .12), .80)
oak = finish("Stained oak soffit", (.268, .138, .072), .73)
patina = finish("Patinated copper seams", (.074, .195, .18), .51, .52)
bronze = finish("Satin bronze inlay", (.48, .302, .115), .38, .53)
glass = finish("Deep celadon reveal", (.045, .225, .19), .28, .32, .16)
light = finish("Warm letter enamel", (.96, .77, .51), .43, 0, .19)


def point(x, height, z):
    return x, -z, height


def block(name, center, size, mat, edge=0, yaw=0):
    width, height, depth = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(*center))
    obj = bpy.context.object
    obj.name, obj.dimensions = name, (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = yaw
    if edge:
        bevel = obj.modifiers.new("Dressed edges", "BEVEL")
        bevel.width, bevel.segments = edge, 1
    obj.data.materials.append(mat)
    pieces.append(obj)
    return obj


def plank(name, a, b, width, depth, mat):
    start, end = Vector(point(*a)), Vector(point(*b))
    delta = end - start
    m = (start + end) / 2
    item = block(name, (m.x, m.z, -m.y), (width, depth, delta.length), mat, .012)
    item.rotation_euler = delta.to_track_quat("Y", "Z").to_euler()
    return item


def shape(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([point(*item) for item in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    pieces.append(obj)
    return obj


# The bridge termination and actual circle's east edge meet at x=-14.6.
# Flagstones emphasize the central line while the existing floor and editor
# remain available on either side for future displays.
for row in range(4):
    z = -.86 + .49 * row
    x = -14.59
    while x > -20.5:
        depth = .475
        span = min(rng.uniform(.61, .97), x + 20.5)
        if span < .09:
            break
        block("West landing limestone", (x - span / 2, .102, z),
              (span - .013, .018, depth), rng.choice(limestone), .006)
        x -= span
for z in (-1.20, 1.02):
    block("West landing basalt margin", (-17.52, .100, z), (5.86, .025, .15), basalt, .008)
    block("West landing bronze fillet", (-17.52, .114, z), (5.73, .008, .018), bronze)
for z in (-1.26, 1.08):
    for x in (-14.78, -15.25, -15.72):
        block("Sawn sill at bridge head", (x, .119, z), (.43, .058, .14), basalt, .010)

# A stone apron widens the arrival route into a semicircular viewing terrace.
# Its paving stays flush so the installation never consumes an authoring slot.
walk_x, walk_z = -22, 2.98
for band, (inner, outer) in enumerate(((1.05,1.54), (1.56,2.03), (2.05,2.5), (2.52,2.96))):
    sectors = 19
    for i in range(sectors):
        a = -.18 * pi + i * (1.36 * pi / sectors) + .006
        b = -.18 * pi + (i + 1) * (1.36 * pi / sectors) - .006
        coords = [(walk_x + r * cos(angle), .116, walk_z - r * sin(angle))
                  for r, angle in ((inner,a), (outer,a), (outer,b), (inner,b))]
        shape("Inset radial limestone voussoir", coords, [(0, 1, 2, 3)],
              limestone[(band + 2 * i + rng.randrange(2)) % len(limestone)])
for i in range(28):
    r = 3.01
    a = -.18 * pi + i * (1.36 * pi / 28)
    b = -.18 * pi + (i + 1) * (1.36 * pi / 28)
    vertices = [(walk_x + radius * cos(angle), .118, walk_z - radius * sin(angle))
                for radius, angle in ((r,a),(r+.115,a),(r+.115,b),(r,b))]
    shape("Basalt edge to the viewing terrace", vertices, [(0, 1, 2, 3)], basalt)

# The four original collision primitives remain in the runtime. The glazed
# marker and two masonry jambs dress their existing footprint and visit point.
for radius, depth, top, mat in ((1.05,.16,.275,basalt),(.81,.065,.312,limestone[1])):
    bpy.ops.mesh.primitive_cylinder_add(vertices=36, radius=radius, depth=depth,
                                       location=point(-22, top - depth/2, 3))
    obj = bpy.context.object
    obj.name = "Presentation portal circular base"
    obj.data.materials.append(mat)
    pieces.append(obj)
for x in (-22.66, -21.34):
    block("Basalt column shoe", (x, .28, 3), (.188, .14, .25), basalt, .013)
    for j in range(5):
        block("Quoin of the presentation jamb", (x, .454 + j*.328, 3),
              (.15 + (j%2)*.025, .32, .224), limestone[(j+1)%4], .009)
    block("Capped oak jamb", (x, 1.946, 3), (.153, .11, .238), oak, .011)
    block("Bronze side reveal", (x, 1.132, 3.121), (.025, 1.52, .015), bronze, .005)
block("Oak entrance lintel", (-22, 1.955, 3), (1.48, .15, .22), oak, .015)
block("Celadon presentation panel", (-22, 1.067, 3), (1.105, 1.51, .052), glass, .011)
for x in (-22.45,-21.55):
    block("Metal inlay behind glass", (x, 1.067, 2.964), (.014,1.35,.014), bronze, .004)
    block("Metal inlay in the entrance face", (x, 1.067, 3.036), (.014,1.35,.014), bronze, .004)

for x in (-22.67,-21.33):
    plank("Raked oak cantilever bracket", (x,1.94,3), (x,2.23,2.48), .102,.128,oak)
    plank("Raked oak cantilever bracket", (x,1.94,3), (x,2.40,3.49), .102,.128,oak)
roof_corners = [(-23.08, 2.29, 2.43), (-20.92, 2.29, 2.43),
                (-20.92, 2.51, 3.57), (-23.08, 2.51, 3.57)]
soffit = [(x, y-.038, z) for x, y, z in roof_corners]
shape("Standing seam copper canopy", roof_corners + soffit,
      [(3,2,1,0), (4,5,6,7)] + [(a,b,b+4,a+4) for a,b in ((0,1),(1,2),(2,3),(3,0))], patina)
for x in (-23.08, -22.72, -22.36, -22, -21.64, -21.28, -20.92):
    plank("Standing copper seam", (x,2.297,2.41), (x,2.517,3.58), .021,.025,patina)
for z, height in ((2.43,2.287),(3.57,2.507)):
    block("Folded copper drip edge", (-22,height,z), (2.18,.057,.032),patina,.006)

# Letterforms are raised enamel on two independently readable oak faces.
for side in (-1, 1):
    z = 3 + .39*side
    for x in (-22.66, -21.34):
        block("Oak sign mounting block", (x,2.109,3+.23*side), (.083,.082,.32),oak,.007)
    block("Oak presentation sign panel", (-22,2.115,z), (1.78,.21,.044),oak,.014)
    block("Bronze rule in sign", (-22,2.032,z+.023*side), (1.62,.011,.008),bronze)
    curve = bpy.data.curves.new("Sala de presentaciones", "FONT")
    curve.body, curve.align_x, curve.align_y = "Sala de presentaciones", "CENTER", "CENTER"
    curve.size, curve.extrude, curve.resolution_u = .132, .003, 4
    letters = bpy.data.objects.new("Presentation pavilion lettering", curve)
    bpy.context.collection.objects.link(letters)
    letters.location = point(-22, 2.127, z + .024*side)
    letters.rotation_euler = (pi/2, 0, 0 if side == 1 else pi)
    curve.materials.append(light)
    pieces.append(letters)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / "gallery-island.blend"), compress=True)
bpy.ops.object.select_all(action="DESELECT")
for item in pieces:
    item.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
pieces[0].name = "West gallery island pavilion and limestone approach"
assert not pieces[0].data.validate(verbose=True), "Invalid merged pavilion mesh"
bpy.ops.export_scene.gltf(filepath=str(output / "gallery-island.glb"), export_format="GLB",
                         use_selection=True, export_cameras=False, export_lights=False)
