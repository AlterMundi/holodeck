"""Build the two original Holodeck room kits with Blender 5.2."""
import json
from math import cos, radians, sin, tau
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


MATERIALS = {
    "Limestone": ("#ceb898", 0, .8, 0),
    "Dark ash": ("#594537", 0, .66, 0),
    "Honey ash": ("#b27c48", 0, .57, 0),
    "Bronzed brass": ("#a98752", .67, .38, 0),
    "Oxide": ("#38594f", .34, .55, 0),
    "Blue felt": ("#285659", 0, .95, 0),
    "Glazed porcelain": ("#a8c5b8", 0, .4, 0),
    "Waxed paper": ("#dacaa8", 0, .82, 0),
    "Deep slate": ("#304148", .13, .61, 0),
    "Trace": ("#91cbbe", .16, .45, .4),
    "Archive textile": ("#777770", 0, .93, 0),
    "Shell floor": ("#746d61", 0, .88, 0),
    "Bone plaster": ("#c5b5a0", 0, .87, 0),
    "Library plaster": ("#9ba9a3", 0, .91, 0),
    "Soot oak": ("#473a31", 0, .73, 0),
    "Amber glazing": ("#d9a56e", .02, .57, .54),
    "Jade glazing": ("#b1cfbd", .05, .55, .34),
    "Clerestory brass": ("#837047", .3, .53, 0),
}
SLUGS = ("listening-workshop", "project-archive")
# Shared room-local bounds for conservative collider boxes. Keep the same
# volumes across both appearances so changing them leaves positions valid.
FOOTPRINTS = (
    ((-2.14, .10, -.68), (-.96, 1.18, 1.18)),
    ((.96, .10, -1.70), (2.14, 1.59, .0)),
)


def linear_channel(hexadecimal):
    channel = int(hexadecimal, 16) / 255
    return channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    value, metallic, roughness, emission = MATERIALS[name]
    rgba = tuple(linear_channel(value[i:i + 2]) for i in (1, 3, 5)) + (1,)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    for key, data in {
        "Base Color": rgba, "Metallic": metallic, "Roughness": roughness,
        "Emission Color": rgba, "Emission Strength": emission,
    }.items():
        shader.inputs[key].default_value = data
    return mat


def blender_position(x, y, z):
    return x, -z, y


def dress(obj, name, finish, bevel):
    obj.name = name
    obj.data.materials.append(material(finish))
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        rounding = obj.modifiers.new("Dressed edges", "BEVEL")
        rounding.width, rounding.segments = bevel, 2 if bevel >= .025 else 1
        normals = obj.modifiers.new("Face-weighted normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


def block(name, center, size, finish, bevel=.019, yaw=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=blender_position(*center))
    obj = bpy.context.object
    width, height, depth = size
    obj.dimensions = width, depth, height
    obj.rotation_euler.z = radians(yaw)
    return dress(obj, name, finish, bevel)


def cylinder(name, center, radius, depth, finish, rotation=(0, 0, 0), sides=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth,
        location=blender_position(*center), rotation=rotation)
    return dress(bpy.context.object, name, finish, .006 if radius >= .045 else 0)


def halo(name, center, radius, thickness, finish, upright=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=6,
        major_radius=radius, minor_radius=thickness, location=blender_position(*center),
        rotation=(radians(90), 0, 0) if upright else (0, 0, 0))
    obj = bpy.context.object
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return dress(obj, name, finish, 0)


def feet(x, z, finish):
    for dx in (-.43, .43):
        for dz in (-.65, .65):
            block("Stone isolator", (x + dx, .156, z + dz), (.22, .112, .26), "Limestone")
            block("Tapered work leg", (x + dx, .515, z + dz), (.13, .67, .14), finish)


def upholstered_base(name, x, z, finish):
    block(name, (x, .124, z), (1.17, .044, 1.82), finish, .015)
    for dx in (-.42, .42):
        block("Inset floor stitch", (x + dx, .148, z), (.012, .004, 1.54), "Bronzed brass", 0)


def workshop():
    x, z = -1.55, .25
    upholstered_base("Petrol bench mat", x, z, "Blue felt")
    feet(x, z, "Dark ash")
    block("Oiled working top", (x, .895, z), (1.14, .13, 1.78), "Honey ash", .043)
    block("Service drawer carcass", (x, .653, z + .19), (1.02, .32, 1.15), "Dark ash")
    for line in (.583, .718):
        block("Flush drawer face", (x + .526, line, z + .19), (.046, .119, 1.11), "Honey ash")
        block("Inlaid brass pull", (x + .555, line, z + .19), (.022, .026, .42), "Bronzed brass", .007)
    block("Felt prototype bedding", (x, .969, z - .15), (.76, .018, .73), "Blue felt", .006)
    cylinder("Small resonator shell", (x + .07, 1.035, z - .18), .21, .12, "Bronzed brass")
    cylinder("Porcelain tuning puck", (x + .07, 1.104, z - .18), .158, .04, "Glazed porcelain")
    halo("Tuning reference", (x + .07, 1.136, z - .18), .102, .008, "Trace")
    for dz in (.39, .53):
        block("Blank sample cards", (x - .12, .985, z + dz), (.24, .038, .108), "Waxed paper", .009, 9)
    block("Small brass square", (x + .22, .979, z + .46), (.042, .018, .27), "Bronzed brass", .008)
    x, z = 1.55, -.85
    block("Basalt resonator plinth", (x, .228, z), (1.14, .254, 1.65), "Deep slate", .041)
    for line in (.239, .307):
        block("Continuous inlaid seam", (x, line, z + .827), (1.02, .016, .012), "Bronzed brass", .004)
    block("Soundbox uprights", (x, .655, z - .21), (1.05, .63, .90), "Dark ash", .041)
    for dx in (-.38, -.27, -.16, -.05, .06, .17, .28, .39):
        block("Waxed ash acoustic rib", (x + dx, .659, z + .246), (.066, .49, .034), "Honey ash", .012)
    block("Travertine header", (x, .974, z - .21), (1.16, .083, 1.03), "Limestone", .03)
    cylinder("Core housing", (x, 1.28, z - .10), .245, .19, "Blue felt", (radians(90), 0, 0))
    halo("Tuned outer ring", (x, 1.28, z + .01), .278, .025, "Bronzed brass", True)
    halo("Living trace ring", (x, 1.28, z + .03), .167, .013, "Trace", True)
    cylinder("Porcelain membrane", (x, 1.28, z + .018), .113, .035, "Glazed porcelain",
             (radians(90), 0, 0))
    for index in range(8):
        angle = tau * index / 8
        cylinder("Harpsichord pin", (x + cos(angle) * .236, 1.28 + sin(angle) * .236, z + .024),
                 .013, .025, "Bronzed brass", (radians(90), 0, 0), sides=12)
    for dx in (-.30, .30):
        block("Raked ring restraint", (x + dx, 1.10, z - .21), (.059, .255, .08), "Bronzed brass")


def archive():
    x, z = -1.55, .25
    upholstered_base("Neutral pull-out study rug", x, z, "Archive textile")
    feet(x, z, "Oxide")
    block("Limestone reading top", (x, .894, z), (1.14, .126, 1.76), "Limestone", .043)
    block("Manuscript tray", (x, .656, z + .24), (.98, .203, .99), "Dark ash", .025)
    for dz in (-.12, .15, .41):
        block("Inlaid folio pull", (x + .49, .66, z + dz), (.031, .041, .125), "Bronzed brass")
    block("Dark mount board", (x, .973, z - .19), (.65, .042, .73), "Deep slate", .009, -4)
    for dx in (-.147, .148):
        leaf = block("Open blank folio", (x + dx, 1.01, z - .19), (.287, .045, .47),
                     "Waxed paper", .016, -4)
        leaf.rotation_euler.y = radians(dx * 36)
    block("Visible binding", (x, 1.033, z - .188), (.038, .024, .51), "Honey ash", .009, -4)
    for dx in (-.11, .10):
        for dz in (-.101, -.064, -.027, .011):
            block("Embossed folio ruling", (x + dx, 1.037, z + dz - .245), (.123, .004, .006),
                  "Limestone", 0, -4)
    cylinder("Porcelain weight", (x + .21, 1.033, z + .43), .085, .12, "Glazed porcelain")
    cylinder("Handle inset", (x + .21, 1.098, z + .43), .038, .028, "Bronzed brass")
    x, z = 1.55, -.85
    block("Archive stone kick", (x, .214, z), (1.14, .228, 1.67), "Limestone", .04)
    for dx in (-.496, .496):
        block("Verdigris cabinet stile", (x + dx, .875, z), (.1, 1.22, 1.5), "Oxide", .032)
        block("Waxed inner reveal", (x + dx * .87, .875, z + .689), (.035, 1.08, .04), "Bronzed brass", .005)
    block("Teal lining", (x, .875, z - .71), (.97, 1.19, .07), "Blue felt", .025)
    for line in (.405, .764, 1.113, 1.474):
        block("Oak cabinet shelf", (x, line, z), (1.10, .069, 1.53), "Honey ash", .025)
        block("Brass inlay", (x, line + .006, z + .765), (.94, .011, .015), "Bronzed brass", .003)
    for line in (.817, 1.166):
        for dx, (finish, height) in zip((-.31, -.16, -.014, .14, .30),
            (("Blue felt", .193), ("Deep slate", .241), ("Limestone", .186),
             ("Oxide", .254), ("Waxed paper", .176))):
            block("Closed unmarked binder", (x + dx, line + height / 2, z + .12),
                  (.119, height, .55), finish, .008)
            block("Archive binder tooling", (x + dx, line + .048, z + .397),
                  (.077, .011, .011), "Bronzed brass", .002)
    block("Instrument folio drawer", (x, .551, z + .70), (.90, .202, .105), "Dark ash", .019)
    block("Drawer loop", (x, .553, z + .758), (.22, .035, .032), "Bronzed brass", .011)


def enclosure(slug):
    archive = slug == "project-archive"
    plaster = "Library plaster" if archive else "Bone plaster"
    frame = "Oxide" if archive else "Soot oak"
    infill = "Deep slate" if archive else "Dark ash"
    window = "Jade glazing" if archive else "Amber glazing"
    soffit = "Bone plaster" if archive else "Dark ash"

    # Subtract nothing from the engine shell. All modeled wall surfaces sit
    # behind the published door faces and stair landings at ±5.86.
    for axis in ("x", "z"):
        for sign in (-1, 1):
            def panel(name, u, height, inset, width, rise, relief, finish, bevel=0):
                center = (sign * inset, height, u) if axis == "x" else (u, height, sign * inset)
                size = (relief, rise, width) if axis == "x" else (width, rise, relief)
                block(name, center, size, finish, bevel)

            panel("Mineral wall", 0, 1.69, 6.03, 12.08, 3.38, .14, plaster)
            panel("Low timber rail", 0, .251, 5.93, 11.81, .24, .045, frame, .012)
            panel("Sill shadow", 0, .387, 5.911, 11.81, .034, .017, "Clerestory brass", .005)
            panel("Crown channel", 0, 2.985, 5.932, 11.81, .22, .054, frame, .015)
            panel("Inlaid crown line", 0, 2.933, 5.898, 11.80, .017, .01, "Clerestory brass", .003)
            # Wide window bays at the middle of the side walls leave the
            # ±3m passage strips visually empty.
            if axis == "x":
                width = 2.95 if archive else 2.62
                rise = 1.55 if archive else 1.32
                panel("Recessed timber lining", 0, 1.74, 5.948, width + .25, rise + .24, .084, frame, .026)
                panel("Tufted reveal", 0, 1.74, 5.916, width, rise, .037, infill, .009)
                for i in range(3):
                    for j in range(2):
                        uu = width * (i - 1) / 3
                        yy = 1.74 + rise * (j - .5) / 2
                        panel("Frosted art glass", uu, yy, 5.907, width / 3 - .13,
                              rise / 2 - .105, .024, window, .006)
                panel("Honed window sill", 0, 1.74 - rise / 2 - .13, 5.91,
                      width + .37, .104, .059, "Limestone", .016)
            # End walls frame the room title and the house exit. Slim
            # recessed panels also keep the entry sightline legible.
            for u in (-4.85, 4.85):
                panel("Linen pilaster inset", u, 1.65, 5.956, .87, 2.03, .082, frame, .02)
                panel("Ribbed pilaster core", u, 1.65, 5.918, .70, 1.86, .041, infill, .01)
                for dx in (-.20, -.10, 0, .10, .20):
                    panel("Routed pilaster rib", u + dx, 1.65, 5.901, .043, 1.73, .027,
                          "Honey ash" if archive else "Clerestory brass", .006)
            if axis == "z" and sign < 0:
                panel("Room-name mineral panel", 0, 2.23, 5.934, 4.15, .76, .063,
                      frame, .02)
                panel("Room-name inset field", 0, 2.24, 5.898, 3.94, .64, .020,
                      infill, .005)
                panel("Room-name brass rule", 0, 1.947, 5.887, 3.82, .018, .008,
                      "Clerestory brass", .002)

    block("Continuous ceiling backing", (0, 3.42, 0), (12.14, .14, 12.14), frame)
    # Long ceiling panels break the silhouette and lead back to the door.
    for x in (-4.45, -1.48, 1.48, 4.45):
        block("Coffered soffit", (x, 3.267, 0), (2.82, .13, 11.87), soffit, .032)
        for dx in (-.975, .975):
            block("Brass ceiling reveal", (x + dx, 3.193, 0), (.027, .018, 11.69),
                  "Clerestory brass", .004)
    for z in (-4.43, -.02, 4.42):
        block("Exposed transverse rib", (0, 3.188, z), (11.9, .206, .15), frame, .027)
        block("Inlaid rib bolting plate", (0, 3.078, z), (11.57, .018, .053),
              "Clerestory brass", .004)
    for x in (-1.59, 1.59):
        block("Perimeter-mounted luminaire", (x, 3.175, -.04), (.31, .104, .83),
              frame, .034)
        block("Opal luminaire diffuser", (x, 3.109, -.04), (.212, .046, .733), window, .01)


def portable_meshes(parts):
    """Export one mesh per material while preserving individually editable source."""
    groups = {}
    for part in parts:
        groups.setdefault(part.data.materials[0].name, []).append(part)
    for name, same_finish in sorted(groups.items()):
        bpy.ops.object.select_all(action="DESELECT")
        for part in same_finish:
            part.select_set(True)
        bpy.context.view_layer.objects.active = same_finish[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        active = bpy.context.object
        active.name = name
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        yield active


def review_scene(slug, path):
    """Show real room proportions and eye height without including the shell in GLB."""
    scene = bpy.context.scene
    block("Room floor proxy", (0, .0, 0), (12, .2, 12), "Shell floor", 0)
    for name, position, target, energy, size, color in [
        ("High warm work light", (-2.7, 2.98, 1.4), (0, .6, -.9), 850, 3, (1, .76, .55)),
        ("Broad cool fill", (3.4, 2.95, -.5), (0, .2, 0), 650, 4, (.65, .82, 1)),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size, data.color = energy, "DISK", size, color
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = blender_position(*position)
        light.rotation_euler = (Vector(blender_position(*target)) - light.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Player eye height")
    camera = bpy.data.objects.new("Entry sightline", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.location = blender_position(.48, 1.66, 4.55)
    camera.rotation_euler = (Vector(blender_position(-.2, 1.32, -1.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    data.lens = 26
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 960, 620, 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.filepath = str(path / f"{slug}-eye-height.jpg")
    bpy.ops.render.render(write_still=True)


def inspect_glb(filename):
    data = filename.read_bytes()
    length, kind = struct.unpack_from("<I4s", data, 12)
    assert kind == b"JSON"
    manifest = json.loads(data[20:20 + length])
    assert not manifest.get("images") and len(data) <= 620 * 1024
    primitives = [primitive for mesh in manifest["meshes"] for primitive in mesh["primitives"]]
    accessors = manifest["accessors"]
    positions = [accessors[p["attributes"]["POSITION"]] for p in primitives]
    bounds = [[round(fn(entry[key][axis] for entry in positions), 4) for axis in range(3)]
              for fn, key in ((min, "min"), (max, "max"))]
    assert all(not any(key in node for key in ("translation", "rotation", "scale", "matrix"))
               for node in manifest["nodes"])
    for accessor in positions:
        view = manifest["bufferViews"][accessor["bufferView"]]
        assert accessor["componentType"] == 5126 and accessor["type"] == "VEC3"
        offset = 28 + length + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", 12)
        for index in range(accessor["count"]):
            point = struct.unpack_from("<3f", data, offset + index * stride)
            x, y, z = point
            if y >= 3.03 or max(abs(x), abs(z)) >= 5.87:
                assert max(abs(x), abs(z)) <= 6.11 and .0 <= y <= 3.5, point
                continue
            lower, upper = FOOTPRINTS[x > 0]
            assert all(low - 1e-6 <= value <= high + 1e-6
                       for low, value, high in zip(lower, point, upper)), point
    return {"bytes": len(data), "triangles": sum(accessors[p["indices"]]["count"] // 3 for p in primitives),
            "primitives": len(primitives), "bounds": bounds}


def build(slug, output, review):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    (workshop if slug == SLUGS[0] else archive)()
    enclosure(slug)
    parts = sorted((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), key=lambda obj: obj.name)
    if review:
        bpy.ops.wm.save_as_mainfile(filepath=str(review / f"{slug}.blend"), compress=True)
        review_scene(slug, review)
    assets = list(portable_meshes(parts))
    bpy.ops.object.select_all(action="DESELECT")
    for asset in assets:
        asset.select_set(True)
    filename = output / f"owned-{slug}.glb"
    bpy.ops.export_scene.gltf(filepath=str(filename), export_format="GLB", use_selection=True,
                             export_animations=False, export_texcoords=False)
    print(json.dumps({"asset": filename.name, **inspect_glb(filename)}), flush=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:]
    output = Path(args[0]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    review = Path(args[1]).resolve() if len(args) > 1 else None
    if review:
        review.mkdir(parents=True, exist_ok=True)
    for slug in SLUGS:
        build(slug, output, review)
