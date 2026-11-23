"""Build an original listening tower in the existing 12 m Holodeck cell."""

import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


arguments = sys.argv[sys.argv.index("--") + 1:]
output = Path(arguments[0]).resolve()
output.mkdir(parents=True, exist_ok=True)
if any(output.iterdir()):
    raise ValueError("Choose an empty, task-owned output directory")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene["room"] = "compaii-torre"
scene["axes"] = "Blender (X,Y,Z) becomes Holodeck (X,Z,-Y)"
scene["collision"] = "Visual cell only. Keep existing room and portal collision."


def collection(name):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result


visual = collection("VIS · Listening tower")
references = collection("ANCHOR · Portal and approach")
review = collection("LIGHT GUIDE · Player-height review")


def material(name, tone, roughness, metallic=0, grain=0, glow=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*tone, 1)
    result.use_nodes = True
    nodes, links = result.node_tree.nodes, result.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*tone, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Emission Color"].default_value = (*tone, 1)
    shader.inputs["Emission Strength"].default_value = glow
    if grain:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 29
        ramp = nodes.new("ShaderNodeValToRGB")
        for stop, shade in zip(ramp.color_ramp.elements, (.76, 1.11)):
            stop.color = (*(channel * shade for channel in tone), 1)
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .25
        bump.inputs["Distance"].default_value = grain
        links.new(noise.outputs["Fac"], ramp.inputs[0])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(ramp.outputs[0], shader.inputs["Base Color"])
        links.new(bump.outputs[0], shader.inputs["Normal"])
    return result


stone = material("Honed honey limestone", (.52, .37, .23), .73, grain=.021)
limewash = material("Ivory limewash", (.65, .53, .38), .77, grain=.016)
basalt = material("Split basalt", (.075, .099, .088), .81, grain=.024)
copper = material("Weathered copper", (.044, .159, .135), .57, .42, .020)
oak = material("Dark oiled oak", (.23, .115, .058), .51, grain=.027)
brass = material("Satin brass", (.61, .355, .107), .31, .67)
iron = material("Blue gunmetal", (.042, .076, .087), .36, .52)
amber = material("Honey lamp glass", (1, .511, .16), .30, glow=2.4)
ivory = material("Ivory lettering", (.84, .72, .53), .75)
resonance = material("Blue enamel", (.075, .29, .34), .26, .21, glow=.38)


def adopt(obj, name, finish=None, target=visual):
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)
    if finish is not None:
        obj.data.materials.append(finish)
    return obj


def block(name, position, size, finish, edge=.026):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if edge:
        border = obj.modifiers.new("Dressed edges", "BEVEL")
        border.width, border.segments = edge, 3
        obj.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
    return adopt(obj, name, finish)


def beam(name, start, end, size, finish):
    a, b = Vector(start), Vector(end)
    obj = block(name, (a + b) * .5, (*size, (b - a).length), finish, .016)
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def disc(name, position, radius, depth, finish):
    bpy.ops.mesh.primitive_cylinder_add(vertices=80, radius=radius, depth=depth,
                                       location=position, rotation=(math.pi / 2, 0, 0))
    return adopt(bpy.context.object, name, finish)


def line(name, coordinates, thickness, finish, closed=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions, data.bevel_depth, data.bevel_resolution = "3D", thickness, 2
    spline = data.splines.new("POLY")
    spline.points.add(len(coordinates) - 1)
    for point, value in zip(spline.points, coordinates):
        point.co = (*value, 1)
    spline.use_cyclic_u = closed
    return adopt(bpy.data.objects.new(name, data), name, finish)


def circle(name, center, radius, thickness, finish):
    x, y, z = center
    return line(name, [(x + radius * math.cos(i * math.tau / 80), y,
                        z + radius * math.sin(i * math.tau / 80))
                       for i in range(80)], thickness, finish, True)


def lettering(name, position, size, finish, return_face=False):
    data = bpy.data.curves.new(name, "FONT")
    data.body, data.align_x, data.align_y, data.size = name, "CENTER", "CENTER", size
    data.extrude = .002
    obj = adopt(bpy.data.objects.new(name, data), name, finish)
    obj.location = position
    obj.rotation_euler = (math.pi / 2, 0, math.pi if return_face else 0)
    return obj


def anchor(name, position):
    obj = bpy.data.objects.new(name, None)
    references.objects.link(obj)
    obj.location = position
    obj.empty_display_size = .19
    return obj


# The engine floor is at .10 m. Keep the visible surface just below it.
block("Limestone floor", (0, 0, -.021), (11.8, 11.8, .24), stone, 0)
for start, end in [((-5.71, -5.71), (5.71, -5.71)), ((5.71, -5.71), (5.71, 5.71)),
                   ((5.71, 5.71), (-5.71, 5.71)), ((-5.71, 5.71), (-5.71, -5.71))]:
    line("Basalt perimeter inlay", [(*start, .098), (*end, .098)], .007, basalt)

# Keep architectural parts against the room boundary and leave both axes clear.
block("West limewash", (-5.89, 0, 2.66), (.20, 11.84, 5.32), limewash, .018)
block("South limestone", (0, -5.89, 2.66), (11.84, .20, 5.32), stone, .018)
block("North limewash", (0, 5.89, 2.66), (11.84, .20, 5.32), limewash, .018)
# The east clerestory is open to a cool, unobstructed sky in the Blender review.
block("East basalt sill", (5.89, 0, .98), (.20, 11.84, 1.96), limewash, .018)
block("East oak lintel", (5.89, 0, 4.92), (.20, 11.84, .80), oak, .018)
for y, width in [(-5.18, 1.48), (-.49, .53), (4.89, 2.06)]:
    block("Window masonry pier", (5.89, y, 3.23), (.20, width, 2.54), limewash, .018)
for y in [-4.41, -3.10, -1.78, -.22, 1.1, 2.42, 3.84]:
    block("Weathered copper window stile", (5.78, y, 3.17), (.07, .066, 2.44), copper, .010)
block("East window spring line", (5.78, 0, 3.65), (.069, 11.64, .060), brass, .010)
block("East oak window seat", (5.59, .12, .57), (.38, 7.80, .14), oak)
block("East basalt seat support", (5.72, .12, .29), (.28, 7.40, .47), basalt, .022)

roofline = [(-5.70, 4.72), (-3.18, 5.40), (-.23, 5.65), (2.89, 5.48), (5.70, 4.72)]
for (x0, z0), (x1, z1) in zip(roofline, roofline[1:]):
    mesh = bpy.data.meshes.new("Folded tower ceiling")
    mesh.from_pydata([(x0, -5.90, z0), (x1, -5.90, z1),
                      (x1, 5.90, z1), (x0, 5.90, z0)], (), [(0, 3, 2, 1)])
    mesh.update()
    roof = adopt(bpy.data.objects.new("Folded roof lining", mesh), "Folded roof lining", oak)
    solid = roof.modifiers.new("Oak lining thickness", "SOLIDIFY")
    solid.thickness = .06
    # Close the short gables above the square wall tops without changing the
    # exterior room footprint or putting a flat cap across the raised roof.
    wall_top = 5.315
    if max(z0, z1) > wall_top:
        left = x0 if z0 >= wall_top else x0 + (x1 - x0) * (wall_top - z0) / (z1 - z0)
        right = x1 if z1 >= wall_top else x1 - (x1 - x0) * (wall_top - z1) / (z0 - z1)
        for y in [-5.79, 5.79]:
            points = [(left, y, wall_top), (right, y, wall_top),
                      (right, y, max(z1, wall_top) + .028),
                      (left, y, max(z0, wall_top) + .028)]
            mesh = bpy.data.meshes.new("Limestone gable closure")
            mesh.from_pydata(points, (), [(0, 1, 2, 3)])
            mesh.update()
            gable = adopt(bpy.data.objects.new("Limestone gable closure", mesh),
                          "Limestone gable closure", stone if y < 0 else limewash)
            gable.modifiers.new("Gable thickness", "SOLIDIFY").thickness = .07
for y in [-4.72, -2.36, 0, 2.36, 4.72]:
    for (x0, z0), (x1, z1) in zip(roofline, roofline[1:]):
        beam("Smoked oak roof rib", (x0, y, z0 - .12), (x1, y, z1 - .12), (.15, .19), oak)
    for x, z in (roofline[1], roofline[-2]):
        block("Rib brass saddle", (x, y, z - .153), (.25, .23, .092), brass, .010)

# Distinct room landmark. The lens is carved into the end wall, outside the
# middle walking lane. It suggests an acoustic instrument without a live feed.
block("Resonator wall recess", (.54, -5.747, 2.31), (5.40, .19, 3.85), basalt, .10)
block("Resonator oak sill", (.54, -5.60, .65), (5.63, .31, .20), oak, .044)
disc("Blackened lens backing", (.54, -5.598, 2.42), 1.468, .102, copper)
circle("Recessed bronze circumference", (.54, -5.515, 2.42), 1.382, .030, iron)
circle("Outer brass ring", (.54, -5.485, 2.42), 1.273, .033, brass)
circle("Blue enamel ring", (.54, -5.460, 2.42), .868, .060, resonance)
circle("Tension ring", (.54, -5.437, 2.42), .542, .022, brass)
disc("Central brass waveguide", (.54, -5.396, 2.42), .288, .092, brass)
disc("Frosted acoustic core", (.54, -5.327, 2.42), .156, .050, amber)
for index in range(8):
    angle = math.tau * index / 8
    direction = Vector((math.cos(angle), 0, math.sin(angle)))
    center = Vector((.54, -5.45, 2.42))
    beam("Tuned radial link", center + direction * .91, center + direction * 1.21,
         (.025, .025), brass)
for x in [-1.79, 2.87]:
    block("Inset practical housing", (x, -5.63, 2.42), (.20, .13, .78), iron, .027)
    block("Inset honey lamp", (x, -5.55, 2.42), (.075, .025, .66), amber, .011)
block("Title plaque", (.54, -5.57, 4.11), (2.92, .092, .37), iron, .034)
lettering("TORRE DE ESCUCHA", (.54, -5.515, 4.11), .192, ivory, return_face=True)
for radius, material_ in [(1.76, basalt), (1.92, brass)]:
    line("Stone and brass resonator inlay", [
        (.54 + radius * math.sin(angle), -4.89 + radius * math.cos(angle), .099)
        for angle in [math.radians(-72 + 4 * i) for i in range(37)]
    ], .006, material_)

# Last link, ordered slot 0 in the current tower. Blender +Y is Holodeck -Z.
# The artwork is shallow and the existing activation remains at (-3,.11,-4.81).
portal_x, portal_wall, spring, radius = -3, 5.82, 1.90, 1.12
field = [(portal_x - radius, 5.752, .10), (portal_x + radius, 5.752, .10)]
field += [(portal_x + radius * math.cos(math.pi * i / 42), 5.752,
           spring + radius * math.sin(math.pi * i / 42)) for i in range(43)]
mesh = bpy.data.meshes.new("Arched portal field")
mesh.from_pydata(field, (), [range(len(field))])
mesh.update()
gate = adopt(bpy.data.objects.new("Arched portal field", mesh), "Arched portal field", iron)
gate.modifiers.new("Portal field depth", "SOLIDIFY").thickness = .025
for x in [portal_x - radius, portal_x + radius]:
    block("Portal basalt jamb", (x, 5.73, 1.06), (.22, .24, 1.92), basalt, .032)
    block("Portal brass strip", (x, 5.585, 1.06), (.055, .035, 1.81), brass, .007)
for depth, line_radius, finish in [(5.70, .071, basalt), (5.605, .028, brass)]:
    line("Rounded stair portal crown", [(portal_x + radius * math.cos(math.pi * i / 42),
         depth, spring + radius * math.sin(math.pi * i / 42)) for i in range(43)],
         line_radius, finish)
block("Portal return bronze inlay", (portal_x, 5.750, 1.44), (.057, .020, 1.17), brass, .011)
block("Portal destination plaque", (portal_x, 5.74, 3.31), (1.61, .10, .28), iron, .022)
anchor("gallery.portal_surface", (portal_x, portal_wall, .10))
anchor("gallery.portal_activation", (portal_x, 4.81, .11))
anchor("gallery.entry_clearance_end", (portal_x, 1.58, .11))
anchor("resonator.approach", (.54, -3.66, .11))


def light(name, position, target, power, color, width, shape="DISK"):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.shape, data.size = power, color, shape, width
    obj = adopt(bpy.data.objects.new(name, data), name, target=review)
    obj.location = position
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def camera(name, position, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    obj = adopt(bpy.data.objects.new(name, data), name, target=review)
    obj.location = position
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


world = bpy.data.worlds.new("Clear tower evening")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.36, .58, .83, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = .36
scene.world = world
light("Clerestory wash", (6.38, -.92, 3.76), (-2.80, -2.1, 1.32), 1180, (.60, .78, 1), 6.10)
light("Resonator grazing practical", (-.34, -4.53, 3.69), (.54, -5.65, 2.35), 260, (1, .68, .36), 1.40)
light("Portal return practical", (-3.19, 3.96, 3.68), (-2.98, 5.79, 1.79), 215, (1, .70, .42), 1.21)
light("Threshold oak bounce", (-4.76, 2.09, 2.17), (-2.81, -.84, .89), 95, (.91, .74, .55), 2.30)

views = {
    "tower-approach": camera("Player eye · approach", (-2.98, 4.63, 1.74),
                             (.45, -4.13, 2.12), 29),
    "tower-return": camera("Player eye · back to gallery", (2.56, -3.65, 1.74),
                           (-2.30, 5.40, 2.04), 28),
}

# Check the physical contract against evaluated Blender geometry, with lights
# and cameras kept outside VIS. The portal corridor can fit a 1.6 m wide avatar.
bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
bounds_min, bounds_max = [math.inf] * 3, [-math.inf] * 3
for obj in visual.objects:
    evaluated = obj.evaluated_get(graph)
    result = evaluated.to_mesh()
    positions = [evaluated.matrix_world @ vertex.co for vertex in result.vertices]
    evaluated.to_mesh_clear()
    low = [min(point[axis] for point in positions) for axis in range(3)]
    high = [max(point[axis] for point in positions) for axis in range(3)]
    if max(abs(low[0]), abs(low[1]), abs(high[0]), abs(high[1])) > 6:
        raise ValueError(f"Tower art crosses its room footprint: {obj.name} {low!r} to {high!r}")
    if (low[2] < 1.90 and high[2] > .115 and low[0] < -2.20 and high[0] > -3.80
            and low[1] < 5.23 and high[1] > 1.58):
        raise ValueError(f"Gallery return corridor blocked by {obj.name}")
    for axis in range(3):
        bounds_min[axis] = min(bounds_min[axis], low[axis])
        bounds_max[axis] = max(bounds_max[axis], high[axis])

scene.render.engine = "CYCLES"
scene.cycles.samples = 22
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 960, 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 90
scene.view_settings.view_transform = "AgX"
bpy.context.preferences.filepaths.save_version = 0
scene.camera = views["tower-approach"]
scene.render.filepath = "//tower-approach.jpg"
bpy.ops.wm.save_as_mainfile(filepath=str(output / "listening-tower.blend"), compress=True)

for name in arguments[1:] or list(views):
    scene.camera = views[name]
    scene.render.filepath = str(output / (name + ".jpg"))
    bpy.ops.render.render(write_still=True)

(output / "geometry.json").write_text(json.dumps({
    "room": "compaii-torre",
    "visibleObjects": len(visual.objects),
    "blenderBounds": [bounds_min, bounds_max],
    "existingGalleryPortal": [-3, .11, -4.81],
    "clearApproachWidth": 1.6,
    "reviewCameras": list(views),
}, indent=2) + "\n")
if sum(file.stat().st_size for file in output.iterdir()) > 12 * 1024 * 1024:
    raise ValueError("Tower review exceeds its 12 MiB output budget")
