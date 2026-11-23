"""Produce the original textured Commons variant from holodeck-commons.blend."""

from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

import bpy
import numpy as np


RESOLUTION = 512
WIDTH = HEIGHT = RESOLUTION
MAX_EXTRA_BYTES = 700 * 1024
BASELINE_BYTES = 582_668
ASSET = "compaii-atelier-commons-pbr.glb"


def noise(random, cells_x, cells_y=None):
    """Periodic interpolation of a small random grid, sampled at texture scale."""
    cells_y = cells_x if cells_y is None else cells_y
    grid = random.random((cells_y, cells_x))
    x = np.arange(WIDTH) * cells_x / WIDTH
    y = np.arange(HEIGHT) * cells_y / HEIGHT
    xi, yi = x.astype(int), y.astype(int)
    u, v = x - xi, y - yi
    u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
    start = grid[yi[:, None], xi] * (1 - u) + grid[yi[:, None], (xi + 1) % cells_x] * u
    end = (grid[(yi[:, None] + 1) % cells_y, xi] * (1 - u)
           + grid[(yi[:, None] + 1) % cells_y, (xi + 1) % cells_x] * u)
    return start * (1 - v[:, None]) + end * v[:, None] - .5


def stone(random):
    broad = noise(random, 5)
    pores = np.minimum(0, noise(random, 103) + .20)
    grain = noise(random, 233)
    strata = noise(random, 11, 32)
    colour = .15 * broad + .073 * strata + .14 * pores + .047 * grain
    relief = .037 * strata + .075 * pores + .034 * grain
    return colour, relief, broad


def meadow(random):
    broad = noise(random, 6)
    stalks = noise(random, 179, 55) + .5 * noise(random, 128, 205)
    small = noise(random, 37, 49)
    variation = .14 * broad + .25 * small + .19 * stalks
    return variation, .042 * small + .023 * stalks, small + broad


def timber(random):
    broad = noise(random, 14, 3)
    grain = noise(random, 112, 9)
    fibres = noise(random, 215, 32)
    variation = .25 * broad + .26 * grain + .13 * fibres
    return variation, .023 * grain + .024 * fibres, broad + .3 * grain


def images(material, modulate, tint, seed, resolution):
    random = np.random.default_rng(seed)
    shade, relief, hue = modulate(random)
    base = np.array(material.diffuse_color[:3])
    srgb = np.where(base <= .0031308, base * 12.92, 1.055 * base ** (1 / 2.4) - .055)
    reflected = srgb * (1 + shade[:, :, None]) + hue[:, :, None] * np.array(tint)
    dy = (np.roll(relief, -1, 0) - np.roll(relief, 1, 0)) * 2.15
    dx = (np.roll(relief, -1, 1) - np.roll(relief, 1, 1)) * 2.15
    vector = np.stack((-dx, -dy, np.ones_like(relief)), axis=-1)
    normals = .5 + .5 * vector / np.linalg.norm(vector, axis=-1, keepdims=True)
    textures = []
    for label, rgb, colour_space in (("Albedo", reflected, "sRGB"), ("Normal", normals, "Non-Color")):
        if resolution != RESOLUTION:
            step = RESOLUTION // resolution
            rgb = rgb.reshape(resolution, step, resolution, step, 3).mean(axis=(1, 3))
        texture = bpy.data.images.new(material.name + " " + label, width=resolution, height=resolution,
                                      alpha=False)
        texture.colorspace_settings.name = colour_space
        rgba = np.ones((resolution, resolution, 4), dtype=np.float32)
        rgba[:, :, :3] = np.clip(rgb, 0, 1)
        texture.pixels.foreach_set(rgba.reshape(-1))
        texture.pack()
        textures.append(texture)
    return textures


def texture_material(name, modulate, tint, seed, repeat, resolution):
    material = bpy.data.materials[name]
    base, normal = images(material, modulate, tint, seed, resolution)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    for socket in ("Base Color", "Normal"):
        for link in list(shader.inputs[socket].links):
            links.remove(link)
    base_node = nodes.new("ShaderNodeTexImage")
    base_node.image = base
    base_node.location = (-650, 180)
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.image = normal
    normal_node.location = (-650, -150)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (-320, -150)
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    return repeat


def joined_visual():
    """Same evaluated source mesh and transforms as the original GLB."""
    evaluated = bpy.context.evaluated_depsgraph_get()
    parts = []
    for group in bpy.context.scene.collection.children:
        if not group.name.startswith("VIS ·"):
            continue
        for source in group.objects:
            obj = source.evaluated_get(evaluated)
            data = bpy.data.meshes.new_from_object(obj)
            # Existing local primitive UVs have no role in the world-scale material.
            while data.uv_layers:
                data.uv_layers.remove(data.uv_layers.active)
            part = bpy.data.objects.new(source.name, data)
            bpy.context.scene.collection.objects.link(part)
            part.matrix_world = obj.matrix_world
            parts.append(part)
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Holodeck Commons visual mesh"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def map_world_texture(mesh, repeat):
    uv = mesh.uv_layers.new(name="World-scale finish")
    for face in mesh.polygons:
        period = repeat.get(mesh.materials[face.material_index].name)
        if period is None:
            continue
        normal = face.normal
        dominant = max(range(3), key=lambda index: abs(normal[index]))
        axis_u, axis_v = ((1, 2), (0, 2), (0, 1))[dominant]
        for index in face.loop_indices:
            point = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = (point[axis_u] / period[0], point[axis_v] / period[1])


def inventory(filepath):
    data = filepath.read_bytes()
    magic, version, length, json_bytes, tag = struct.unpack_from("<4sII I 4s", data)
    assert magic == b"glTF" and version == 2 and length == len(data) and tag == b"JSON"
    gltf = json.loads(data[20:20 + json_bytes])
    batches = [part for mesh in gltf["meshes"] for part in mesh["primitives"]]
    triangles = sum(gltf["accessors"][part["indices"]]["count"] // 3 for part in batches)
    mapped = [material["name"] for material in gltf["materials"]
              if "baseColorTexture" in material.get("pbrMetallicRoughness", {}) and "normalTexture" in material]
    assert len(mapped) == 5 and not gltf.get("extensionsRequired")
    assert all("bufferView" in image for image in gltf["images"])
    assert all("TEXCOORD_0" in part["attributes"] for part in batches)
    assert triangles == 14880 and len(batches) == 10 and len(gltf["nodes"]) == 1
    assert len(data) - BASELINE_BYTES <= MAX_EXTRA_BYTES
    return {
        "bytes": len(data), "replacementDelta": len(data) - BASELINE_BYTES,
        "sha256": sha256(data).hexdigest(), "drawBatches": len(batches), "triangles": triangles,
        "images": len(gltf["images"]), "materialMaps": mapped,
        "registration": {"x": 0, "y": 0, "z": 0, "scale": [1, 1, 1]},
        "collision": "Existing plan and authoring IDs unchanged.",
    }


def main():
    argument = sys.argv[sys.argv.index("--") + 1:]
    directory = Path(argument[0]).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    if any(directory.iterdir()):
        raise ValueError("Choose an empty, task-owned output directory")
    repeat = dict([
        (name, texture_material(name, recipe, tint, seed, period, resolution))
        for name, recipe, tint, seed, period, resolution in [
            ("Honed honey limestone", stone, (.095, .059, .028), 6934, (2.85, 2.85), 512),
            ("Ivory limewash", stone, (.045, .025, .007), 2292, (2.3, 2.3), 256),
            ("Meadow understorey", meadow, (.078, .049, .015), 4881, (2.35, 2.35), 512),
            ("Dark oiled oak", timber, (.095, .044, .008), 2173, (.48, 1.75), 256),
            ("Split basalt", stone, (.058, .070, .043), 8472, (1.65, 1.65), 256),
        ]
    ])
    visual = joined_visual()
    map_world_texture(visual.data, repeat)
    filepath = directory / ASSET
    bpy.ops.export_scene.gltf(filepath=str(filepath), export_format="GLB", use_selection=True,
                              export_texcoords=True, export_lights=False, export_materials="EXPORT",
                              export_image_format="JPEG", export_jpeg_quality=82)
    (directory / "commons-pbr.json").write_text(json.dumps(inventory(filepath), indent=2) + "\n")


if __name__ == "__main__":
    main()
