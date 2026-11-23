"""Build the silhouettes beyond the playable coast in a blank Blender scene."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

# Blender XY converts to Holodeck X/-Z. All base coordinates are metres.
ridges = [
    ("Western headland", -31, -68, 34, 13, 12, 0.31),
    ("Eastern headland", 47, -72, 27, 12, 10, 1.53),
    ("Outer skerries", 13, -93, 27, 8, 6, 2.76),
    ("North bank", -9, 86, 39, 14, 10, 4.07),
]
waterline = -6.94
segments = 60
rings = [1, 0.84, 0.66, 0.46, 0.24, 0.09]
rock = (0.204, 0.236, 0.237, 1)
heath = (0.105, 0.176, 0.156, 1)
material = bpy.data.materials.new("Shale bluffs with low coastal heath")
material.use_nodes = True
nodes = material.node_tree.nodes
shader = nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = 0.91
colour = nodes.new("ShaderNodeVertexColor")
colour.layer_name = "Coast colour"
material.node_tree.links.new(colour.outputs["Color"], shader.inputs["Base Color"])

for name, east, north, width, length, crest, phase in ridges:
    vertices, faces, colours = [], [], []
    for ring in rings:
        for index in range(segments):
            angle = index * 2 * pi / segments
            edge = 1 + 0.14 * sin(3 * angle + phase) + 0.055 * cos(7 * angle - phase)
            x = east + ring * width * cos(angle) * edge
            y = north + ring * length * sin(angle) * edge
            ridge = 0.78 + 0.17 * sin(2 * angle + phase) + 0.09 * cos(5 * angle - phase)
            rise = (1 - ring**1.8)**1.15
            z = waterline - 0.27 + rise * (0.6 + ridge * crest)
            ground = min(1, max(0, (z - waterline - 2.3) / 4.1))
            variation = 0.98 + 0.06 * cos(angle * 8 + phase) * ring
            vertices.append((x, y, z))
            colours.append(tuple((a + (b - a) * ground) * variation
                                 for a, b in zip(rock[:3], heath[:3])) + (1,))
    for outer in range(len(rings) - 1):
        for index in range(segments):
            next_index = (index + 1) % segments
            a, b = outer * segments + index, outer * segments + next_index
            faces.append((a, b, b + segments, a + segments))
    vertices.append((east, north, waterline + crest * 0.82))
    colours.append(heath)
    rim = (len(rings) - 1) * segments
    faces.extend((rim + i, rim + (i + 1) % segments, len(vertices) - 1)
                 for i in range(segments))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    attribute = mesh.color_attributes.new(name="Coast colour", type="BYTE_COLOR", domain="POINT")
    for item, value in zip(attribute.data, colours):
        item.color = value
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    island = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(island)
    island.data.materials.append(material)

bpy.ops.wm.save_as_mainfile(filepath=str(output / "coastal-ridges.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(output / "coastal-ridges.glb"), export_format="GLB",
                          export_cameras=False, export_lights=False)
