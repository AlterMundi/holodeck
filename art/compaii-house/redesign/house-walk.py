"""Model the public parcel walk in Blender in the world's metre coordinates."""
import math
import sys
from pathlib import Path

import bpy

art_dir, asset_dir = map(Path, sys.argv[sys.argv.index("--") + 1:])
bpy.ops.wm.read_factory_settings(use_empty=True)

palette = {
    "Limestone": ((.35, .29, .21), (.42, .36, .27), (.38, .32, .24)),
    "Basalt": ((.085, .097, .092), (.111, .119, .109)),
    "Brick": ((.24, .133, .086), (.30, .177, .106)),
    "Mortar": ((.147, .130, .109),),
}
batches = {name: ([], [], [], []) for name in palette}


def slab(name, x, z, width, depth, top, thickness, bevel, tone=0):
    verts, faces, colours, groups = batches[name]
    start = len(verts)
    bottom = min(top - bevel, max(top - thickness, .101))
    for height, inset in ((bottom, 0), (top, bevel)):
        for px, pz in ((-1, 1), (1, 1), (1, -1), (-1, -1)):
            verts.append((x + px * (width / 2 - inset),
                          -(z + pz * (depth / 2 - inset)), height))
    slab_faces = [(4, 5, 6, 7)]
    for a in range(4):
        b = (a + 1) % 4
        slab_faces.append((a, b, b + 4, a + 4))
    faces.extend(tuple(start + index for index in face) for face in slab_faces)
    colour = palette[name][tone % len(palette[name])]
    colours.extend((*colour, 1) for face in slab_faces for _ in face)
    groups.append(range(start, start + 8))


# The walkway overlays the established -Z/+Z approach at floor y=.1.
# The narrower paved ribbon leaves room near the entrance for the existing signs.
slab("Mortar", 0, 17.36, 2.58, 15.08, .104, .08, .004)
for row in range(30):
    z = 9.946 + row * .502
    joints = [-1.066, -.48, .55, 1.066] if row % 2 else [-1.066, -.12, .44, 1.066]
    for column, (a, b) in enumerate(zip(joints, joints[1:])):
        slab("Limestone", (a + b) / 2, z, b - a - .013, .487, .113, .035,
             .005, row + column * 2 + row // 4)
    for side in (-1, 1):
        slab("Brick", side * 1.159, z, .16, .492, .117, .032, .005, row // 3)
        slab("Basalt", side * 1.275, z, .064, .495, .116, .046, .004, row // 5)

# Opposed branches express the plot grain. The first west apron meets the actual
# facade face at x=-2.925, leaving the interaction and return frame on the stone.
for row, z in enumerate((15.5, 18, 20.5, 23)):
    for side in (-1, 1):
        end = 3.015 if (row, side) == (0, -1) else 2.55
        start = 1.310
        length = end - start
        slab("Mortar", side * (start + end) / 2, z, length, 1.28, .111, .065, .004)
        n = math.ceil(length / .44)
        for i in range(n):
            x = side * (start + (i + .5) * length / n)
            for j in (-1, 1):
                slab("Limestone", x, z + j * .231, length / n - .012, .446, .123,
                     .034, .005, row + i + j)
                slab("Basalt", x, z + j * .536, length / n - .008, .14, .125,
                     .046, .005, row + i)
        slab("Brick", side * (end - .048), z, .097, .903, .132, .036, .005, row)


# Objects remain editable by material, with each stone addressable in edit mode.
# A single colour attribute supplies tonal variation with four draw batches.
for name, (verts, faces, colours, groups) in batches.items():
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    colour = mesh.color_attributes.new(name="Stone colour", type="FLOAT_COLOR", domain="CORNER")
    colour.data.foreach_set("color", [value for rgba in colours for value in rgba])
    mesh.color_attributes.active_color = colour
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*palette[name][0], 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .83
    tint = material.node_tree.nodes.new("ShaderNodeVertexColor")
    tint.layer_name = colour.name
    material.node_tree.links.new(tint.outputs["Color"], shader.inputs["Base Color"])
    obj.data.materials.append(material)
    for index, indices in enumerate(groups, 1):
        obj.vertex_groups.new(name=f"{name} {index:03d}").add(list(indices), 1, "REPLACE")

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(art_dir / "house-walk.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(asset_dir / "house-walk.glb"), export_format="GLB",
                          export_vertex_color="MATERIAL")
