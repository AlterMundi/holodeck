"""Render an original coastal equirectangular sky in Blender."""
import math
from pathlib import Path
import sys

import bpy


def math_node(tree, operation, left, right):
    node = tree.nodes.new("ShaderNodeMath")
    node.operation = operation
    for socket, value in zip(node.inputs, (left, right)):
        if isinstance(value, bpy.types.NodeSocket):
            tree.links.new(value, socket)
        else:
            socket.default_value = value
    return node.outputs[0]


def ramp(tree, coordinate, points):
    node = tree.nodes.new("ShaderNodeValToRGB")
    tree.links.new(coordinate, node.inputs["Fac"])
    element = node.color_ramp.elements
    element.remove(element[1])
    element[0].position, value = points[0]
    element[0].color = (value, value, value, 1)
    for position, value in points[1:]:
        element.new(position).color = (value, value, value, 1)
    return node.outputs["Color"]


def clouds(scene):
    # Global metres. Holodeck's ground maps X/Z to Blender X/−Y.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 940))
    layer = bpy.context.object
    layer.name = "Coastal cumulus layer"
    layer.dimensions = (36000, 36000, 720)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    material = bpy.data.materials.new("Sunlit maritime cumulus")
    layer.data.materials.append(material)
    tree = material.node_tree
    tree.nodes.clear()
    volume = tree.nodes.new("ShaderNodeVolumeScatter")
    volume.inputs["Color"].default_value = (.95, .97, 1, 1)
    volume.inputs["Anisotropy"].default_value = .43
    position = tree.nodes.new("ShaderNodeTexCoord").outputs["Generated"]
    scaled = tree.nodes.new("ShaderNodeVectorMath")
    scaled.operation = "MULTIPLY"
    scaled.inputs[1].default_value = (36000 / 1340, 36000 / 1480, 720 / 790)
    tree.links.new(position, scaled.inputs[0])
    detail = tree.nodes.new("ShaderNodeTexNoise")
    tree.links.new(scaled.outputs["Vector"], detail.inputs["Vector"])
    detail.inputs["Scale"].default_value = 1
    detail.inputs["Detail"].default_value = 4
    detail.inputs["Roughness"].default_value = .61
    detail.inputs["Distortion"].default_value = .16
    masses = ramp(tree, detail.outputs["Fac"], [(.42, 0), (.49, .03), (.57, .73), (.71, 1)])
    generated = position
    separate = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(generated, separate.inputs["Vector"])
    height = ramp(tree, separate.outputs["Z"], [(0, 0), (.13, .73), (.42, 1), (.72, .64), (1, 0)])
    density = math_node(tree, "MULTIPLY", math_node(tree, "MULTIPLY", masses, height), .011)
    tree.links.new(density, volume.inputs["Density"])
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(volume.outputs["Volume"], output.inputs["Volume"])


def render(directory, width):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 14
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.volume_bounces = 2
    scene.cycles.volume_step_rate = .4
    scene.render.resolution_x = width
    scene.render.resolution_y = width // 2
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 87
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -.38

    world = bpy.data.worlds.new("Maritime daylight")
    scene.world = world
    sky = world.node_tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.atan2(22, math.hypot(12, 16))
    sky.sun_rotation = math.atan2(-16, 12)
    sky.sun_intensity = .92
    sky.altitude = .015
    sky.air_density = .96
    background = world.node_tree.nodes.get("Background")
    world.node_tree.links.new(sky.outputs["Color"], background.inputs["Color"])

    clouds(scene)
    # Extend the visible sea beyond the finite playable-world water plate.
    bpy.ops.mesh.primitive_plane_add(size=240000, location=(0, 0, -7))
    ocean = bpy.context.object
    ocean.name = "Distant maritime horizon"
    sea = bpy.data.materials.new("Sea in atmospheric distance")
    ocean.data.materials.append(sea)
    shader = sea.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (.07, .17, .21, 1)
    shader.inputs["Roughness"].default_value = .37
    data = bpy.data.cameras.new("Equirectangular viewpoint")
    data.type = "PANO"
    data.panorama_type = "EQUIRECTANGULAR"
    data.clip_end = 200000
    camera = bpy.data.objects.new("Coastal observer", data)
    scene.collection.objects.link(camera)
    camera.location = (0, 0, 16)
    camera.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    scene.camera = camera
    scene.render.filepath = str(directory / "coastal-sky.jpg")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:]
    output = Path(args[0]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    render(output, int(args[1]) if len(args) > 1 else 1536)
