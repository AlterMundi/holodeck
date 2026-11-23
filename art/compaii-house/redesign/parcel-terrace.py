"""Author the basalt shore and meadow under the existing house walk."""
from math import cos, sin
from pathlib import Path
from random import Random
import sys

import bpy

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene["layout"] = "House approach and commons in world metres (Blender X, -Z, Y)"

stone = (.153, .168, .153)
heath = (.125, .199, .102)
moss = (.153, .213, .119)
wet = (.058, .093, .088)


def blend(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def terrain_mesh(name, vertices, faces, colours, smooth=False, uv=None, wrap=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
    mesh.update()
    surface = mesh.uv_layers.new(name="Grain")
    for polygon in mesh.polygons:
        seam = wrap and max(uv[index][0] for index in polygon.vertices) > wrap - 1
        for i in polygon.loop_indices:
            index = mesh.loops[i].vertex_index
            x, _, z = vertices[index]
            u, v = uv[index] if uv else (x / 1.68, z / 1.68)
            surface.data[i].uv = (wrap if seam and u == 0 else u, v)
    layer = mesh.color_attributes.new(name="Terrain tint", type="BYTE_COLOR", domain="POINT")
    for point, rgb in zip(layer.data, colours):
        point.color = (*rgb, 1)
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def soil(x, z, edge):
    variation = .48 + .21 * sin(x * 1.64 - z * .91) + .21 * cos(z * 2.21 + x * .23)
    base = blend(heath, moss, variation)
    return blend(base, stone, max(0, 1 - edge * 1.55) * .74)


def meadow(name, xs, zs, top):
    vertices, colours = [], []
    for z in zs:
        for x in xs:
            vertices.append((x, top, z))
            edge = min(x - xs[0], xs[-1] - x, z - zs[0], zs[-1] - z)
            colours.append(soil(x, z, edge))
    stride = len(xs)
    faces = [(a, a + stride, a + stride + 1, a + 1)
             for row in range(len(zs) - 1) for col in range(stride - 1)
             for a in [row * stride + col]]
    return terrain_mesh(name, vertices, faces, colours)


def cliff(name, boundary, center, beds, *, terrace):
    vertices, colours, faces, uv = [], [], [], []
    count = len(boundary)
    repeats = round(count * .61)
    for ring, (level, width, variation) in enumerate(beds):
        for i, (x, z) in enumerate(boundary):
            grain = sin(i * 1.94 + ring * 1.3) + .35 * cos(i * 3.84 - ring * .8)
            bulge = width + grain * variation
            y = level + (grain * .18 if ring and terrace else 0)
            vertices.append((center[0] + (x - center[0]) * bulge,
                             y, center[1] + (z - center[1]) * bulge))
            tone = .47 + .24 * grain
            if ring == 0:
                rgb = soil(x, z, 0)
            elif terrace and level < -4.9:
                rgb = blend(wet, stone, tone * .72)
            else:
                rgb = blend(stone, (.24, .246, .205), tone)
            colours.append(rgb)
            uv.append((i * repeats / count, (y + x * .149 - z * .08) / 1.43))
    for ring in range(len(beds) - 1):
        for i in range(count):
            a, b = ring * count + i, ring * count + (i + 1) % count
            # Triangulate explicitly to give the ledges stable fractures.
            faces.extend(((a, b, b + count), (a, b + count, a + count)))
    return terrain_mesh(name, vertices, faces, colours, smooth=True, uv=uv, wrap=repeats)


# Samples align the top edge, apron side and visible rows of the lower cliff.
xs = [-8, -7.7, -6.9, -6.05, -5.0, -3.9, -2.8, -1.6, 0, 1.6, 2.8,
      3.9, 5.0, 6.05, 6.9, 7.7, 8]
zs = [13.75, 14.08, 14.83, 15.75, 16.65, 17.5, 18.4, 19.44, 20.33, 21.5,
      22.4, 23.4, 24.13, 24.67, 25]
terrace_top = meadow("Meadow above the terrace", xs, zs, .098)
outline = ([(x, zs[0]) for x in xs] + [(xs[-1], z) for z in zs[1:]] +
           [(x, zs[-1]) for x in xs[-2::-1]] + [(xs[0], z) for z in zs[-2:0:-1]])
terrace_cliff = cliff("Basalt strata and tide line", outline, (0, 19.375), [
    (.098, 1, 0), (-.29, 1.014, .005), (-.68, .976, .01), (-1.35, 1.012, .02),
    (-2.83, .936, .035), (-3.28, .996, .027), (-5.02, .905, .046),
    (-6.96, 1.07, .042), (-7.34, 1.09, .04),
], terrace=True)

neck_x = [-1.6, -1.32, -.69, 0, .69, 1.32, 1.6]
neck_z = [9.8, 10.46, 11.23, 12.1, 12.94, 13.76]
neck_top = meadow("Approach verges", neck_x, neck_z, .099)
outline = ([(x, neck_z[0]) for x in neck_x] + [(neck_x[-1], z) for z in neck_z[1:]] +
           [(x, neck_z[-1]) for x in neck_x[-2::-1]] + [(neck_x[0], z) for z in neck_z[-2:0:-1]])
neck_cliff = cliff("Rock neck under the approach", outline, (0, 11.78), [
    (.099, 1, 0), (-.28, 1.035, .02), (-.8, .92, .065), (-2.6, .74, .055),
    (-4.5, .86, .12), (-7.3, 1.22, .11),
], terrace=False)

# A small original, periodic texture adds close-range grain to vertex tints.
def grain_tile():
    size = 128
    random = Random(547)
    bands = [(grid, weight, [random.uniform(-1, 1) for _ in range(grid * grid)])
             for grid, weight in ((5, .064), (11, .052), (23, .064), (56, .043))]

    def sample(grid, values, x, y):
        gx, gy = x * grid / size, y * grid / size
        ix, iy = int(gx), int(gy)
        u, v = gx - ix, gy - iy
        u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
        current, following = iy * grid, ((iy + 1) % grid) * grid
        right = (ix + 1) % grid
        a = values[current + ix] * (1 - u) + values[current + right] * u
        b = values[following + ix] * (1 - u) + values[following + right] * u
        return a * (1 - v) + b * v

    pixels = []
    for y in range(size):
        for x in range(size):
            n = min(1, .89 + sum(weight * sample(grid, values, x, y)
                                 for grid, weight, values in bands))
            pixels.extend((n, .998 * n, .99 * n, 1))
    image = bpy.data.images.new("Original basalt grain", width=size, height=size, alpha=False)
    image.pixels.foreach_set(pixels)
    temp = output / "parcel-grain.jpg"
    image.filepath_raw, image.file_format = str(temp), "JPEG"
    image.save()
    image.pack()
    temp.unlink()
    return image


def boundary_stones():
    vertices, faces, colours = [], [], []
    for side in (-1, 1):
        for z in (15.5, 18, 20.5, 23):
            for offset in (-.77, .77):
                x = side * 2.587
                start = len(vertices)
                vertices.extend(((x - .13, .099, z + offset - .085),
                                 (x + .13, .099, z + offset - .071),
                                 (x + .115, .132, z + offset + .091),
                                 (x - .12, .127, z + offset + .085)))
                faces.append((start, start + 3, start + 2, start + 1))
                colours.extend([(.28, .283, .227)] * 4)
    return terrain_mesh("Weathered plot markers", vertices, faces, colours)


# Keep the named parts editable, exporting one material batch.
material = bpy.data.materials.new("Terrace stone and coastal meadow")
shader = material.node_tree.nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = .92
material.use_nodes = True
texture = material.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = grain_tile()
tint = material.node_tree.nodes.new("ShaderNodeVertexColor")
tint.layer_name = "Terrain tint"
mix = material.node_tree.nodes.new("ShaderNodeMixRGB")
mix.blend_type = "MULTIPLY"
mix.inputs[0].default_value = 1
links = material.node_tree.links
links.new(texture.outputs["Color"], mix.inputs[1])
links.new(tint.outputs["Color"], mix.inputs[2])
links.new(mix.outputs["Color"], shader.inputs["Base Color"])
for obj in (terrace_top, terrace_cliff, neck_top, neck_cliff, boundary_stones()):
    obj.data.materials.append(material)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / "parcel-terrace.blend"), compress=True)
# glTF applies COLOR_0 to the base map, matching the Blender material.
links.new(texture.outputs["Color"], shader.inputs["Base Color"])
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = terrace_top
bpy.ops.object.join()
terrace_top.name = "Parcel terrace"
bpy.ops.export_scene.gltf(filepath=str(output / "parcel-terrace.glb"), export_format="GLB",
                          export_vertex_color="ACTIVE")
