"""Export a small, static GLB from one selected, normalized 3D Viewer scene.

Run with Blender in background. The input is an offline project build artifact.
The caller verifies the Home edition and chooses the representative scene.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy

TRIANGLES = 4800
MODEL_BYTES = 384 * 1024
SCENE_BYTES = 25 * 1024 * 1024


def model_parts(scene):
    if scene.get("units") != "mm" or not 1 <= len(scene.get("parts", [])) <= 256:
        raise ValueError("Select one normalized millimeter review scene")
    parts = scene["parts"]
    for part in parts:
        vertices = part["vertices"]
        faces = part["faces"]
        offset = part.get("offset", [0, 0, 0])
        if (len(vertices) < 3 or not faces or len(offset) != 3
                or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in offset)
                or any(len(v) != 3 or not all(isinstance(n, (int, float))
                       and math.isfinite(n) and abs(n) <= 1e9 for n in v) for v in vertices)
                or any(len(face) != 3 or any(type(i) is not int or not 0 <= i < len(vertices)
                       for i in face) for face in faces)):
            raise ValueError("Invalid review triangles")
    if sum(len(part["faces"]) for part in parts) > 300000:
        raise ValueError("Review scene exceeds the triangle budget")
    return parts


def linear_color(hex_color):
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels)


def build(scene):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts = model_parts(scene)
    sizes = [len(part["faces"]) for part in parts]
    weights = [math.sqrt(size) for size in sizes]
    measured = sum(weights)
    # Leave room for modifiers that retain a few additional feature triangles.
    remainder = int(TRIANGLES * .60) - sum(min(8, size) for size in sizes)
    palette = {}
    for index, (part, size, weight) in enumerate(zip(parts, sizes, weights)):
        target = min(size, min(8, size) + math.floor(remainder * weight / measured))
        mesh = bpy.data.meshes.new(f"Part {index + 1}")
        # The 3D Viewer and Blender use Z-up. Scale millimeters to meters.
        ox, oy, oz = part.get("offset", [0, 0, 0])
        mesh.from_pydata([((x + ox) * .001, (y + oy) * .001, (z + oz) * .001)
                          for x, y, z in part["vertices"]], [], part["faces"])
        mesh.update()
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.collection.objects.link(obj)
        color = part["color"].lower()
        if color not in palette:
            material = bpy.data.materials.new(f"Display {color}")
            material.diffuse_color = (*linear_color(color), 1)
            material.use_nodes = True
            shader = material.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value = material.diffuse_color
            shader.inputs["Roughness"].default_value = .58
            palette[color] = material, []
        material, objects = palette[color]
        mesh.materials.append(material)
        objects.append(obj)
        if target < size:
            editable = bmesh.new()
            try:
                editable.from_mesh(mesh)
                bmesh.ops.remove_doubles(editable, verts=list(editable.verts), dist=1e-8)
                editable.to_mesh(mesh)
            finally:
                editable.free()
            mesh.update()
            bpy.context.view_layer.objects.active = obj
            decimate = obj.modifiers.new("Shelf geometry", "DECIMATE")
            decimate.ratio = min(1, target / max(1, len(mesh.polygons)))
            bpy.ops.object.modifier_apply(modifier=decimate.name)
    for material, objects in palette.values():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = material.name
    count = 0
    for obj in bpy.context.collection.objects:
        obj.data.calc_loop_triangles()
        count += len(obj.data.loop_triangles)
    if not 0 < count <= TRIANGLES:
        raise ValueError(f"Need a representative within {TRIANGLES} triangles. Blender produced {count}.")
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if args.scene.stat().st_size > SCENE_BYTES or args.output.suffix != ".glb" or args.output.exists():
        raise ValueError("Select a bounded source and a new .glb output")
    triangles = build(json.loads(args.scene.read_text()))
    temporary = args.output.with_suffix(".stage.glb")
    if temporary.exists():
        raise ValueError("The selected output already has a stage")
    try:
        bpy.ops.export_scene.gltf(filepath=str(temporary), export_format="GLB", export_texcoords=False,
                                  export_tangents=False, export_animations=False, export_extras=False)
        size = temporary.stat().st_size
        if size > MODEL_BYTES:
            raise ValueError(f"Shelf representation exceeds {MODEL_BYTES} bytes")
        temporary.rename(args.output)
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps({"triangles": triangles, "bytes": size}))


if __name__ == "__main__":
    main()
