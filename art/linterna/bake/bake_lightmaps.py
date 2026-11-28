"""Bake a shared Cycles diffuse atlas and append its UVs to a static GLB."""

import argparse
from collections import Counter, defaultdict
import ctypes as ct
from dataclasses import dataclass
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import struct
import sys
import time

import bpy
import numpy as np
from mathutils import Vector
from mathutils.geometry import box_pack_2d


GLB_HEADER = struct.Struct("<4sII")
CHUNK_HEADER = struct.Struct("<I4s")
FLOAT = 5126
UV_NAME = "lightmap"
PADDING = 4  # final pixels, at the smaller atlas resolution
GUARD = 1  # leave space between adjacent dilated charts
SUN_DIAMETER = 0.526
SUN_ENERGY = 4.0
SKY_STRENGTH = 0.5
REFERENCE_SIZE = (1920, 1200)
REFERENCE_EXPOSURE = 3.0


@dataclass
class Surface:
    attributes: dict
    position: np.ndarray
    triangles: np.ndarray
    base_uv: np.ndarray
    uv: np.ndarray


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="binary glTF 2.0 scene")
    parser.add_argument("output", type=Path, help="output directory")
    parser.add_argument("--elevation", type=float, default=14, help="solar elevation in degrees")
    parser.add_argument("--azimuth", type=float, default=252, help="degrees clockwise from glTF -Z toward +X")
    parser.add_argument("--temperature", type=float, default=3500, help="sun color temperature in kelvin")
    parser.add_argument("--resolution", type=positive, nargs="+", default=[2048, 512])
    parser.add_argument("--samples", type=positive, default=512)
    parser.add_argument("--threads", type=positive, default=len(os.sched_getaffinity(0)))
    parser.add_argument("--camera", type=float, nargs=3, default=(-3, 1.74, -5.35),
                        help="eye coordinates in glTF meters")
    parser.add_argument("--target", type=float, nargs=3, default=(0, 1.146, -2),
                        help="camera target in glTF meters")
    parser.add_argument("--no-foliage", action="store_true", help="omit the workshop leaf cutout")
    parser.add_argument("--reference-scale", type=positive, default=100,
                        help="percentage of the 1920 x 1200 reference, for proofs")
    items = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(items)
    sizes = sorted(set(args.resolution), reverse=True)
    if sizes[-1] < 64 or any(sizes[0] % size for size in sizes):
        parser.error("resolutions must be >=64 and divide the largest resolution")
    if not 0 < args.elevation < 90 or not 1000 <= args.temperature <= 10000:
        parser.error("require elevation in (0, 90) and temperature in [1000, 10000]")
    args.resolution = sizes
    return args


def read_glb(data):
    magic, version, size = GLB_HEADER.unpack_from(data)
    if (magic, version, size) != (b"glTF", 2, len(data)):
        raise ValueError("expected a complete binary glTF 2.0 file")
    chunks = {}
    offset = GLB_HEADER.size
    while offset < size:
        length, tag = CHUNK_HEADER.unpack_from(data, offset)
        offset += CHUNK_HEADER.size
        chunks[tag] = data[offset:offset + length]
        offset += length
    if offset != size or set(chunks) != {b"JSON", b"BIN\0"}:
        raise ValueError("expected JSON and BIN chunks")
    return json.loads(chunks[b"JSON"]), chunks[b"BIN\0"]


def read_accessor(doc, binary, index):
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    if view["buffer"] != 0 or "sparse" in accessor or accessor.get("normalized"):
        raise ValueError("expected a direct accessor in the embedded buffer")
    dtype = np.dtype({FLOAT: "<f4", 5125: "<u4", 5123: "<u2", 5121: "u1"}[accessor["componentType"]])
    cols = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[accessor["type"]]
    return np.ndarray(
        (accessor["count"], cols), dtype, buffer=binary,
        offset=view.get("byteOffset", 0) + accessor.get("byteOffset", 0),
        strides=(view.get("byteStride", dtype.itemsize * cols), dtype.itemsize),
    )


def load_surfaces(doc, binary):
    meshes = {}
    for index, mesh in enumerate(doc["meshes"]):
        surfaces = []
        for prim in mesh["primitives"]:
            attrs = prim["attributes"]
            if prim.get("mode", 4) != 4 or "TEXCOORD_1" in attrs or "targets" in prim:
                raise ValueError("requires static triangle primitives without an existing TEXCOORD_1")
            positions = read_accessor(doc, binary, attrs["POSITION"]).astype("float64")
            triangles = read_accessor(doc, binary, prim["indices"]).reshape(-1, 3)
            base_uv = read_accessor(doc, binary, attrs["TEXCOORD_0"]).astype("float64")
            surfaces.append(Surface(attrs, positions, triangles, base_uv, np.zeros((len(positions), 2))))
        meshes[index] = surfaces
    return meshes


def components(faces, by_edge=False):
    """Group faces by an existing shared index or edge."""
    neighbors = defaultdict(list)
    for index, (a, b, c) in enumerate(faces.tolist()):
        keys = [tuple(sorted(pair)) for pair in ((a, b), (b, c), (c, a))] if by_edge else (a, b, c)
        for key in keys:
            neighbors[key].append(index)
    graph = [[] for _ in faces]
    for first, *others in neighbors.values():
        for other in others:
            graph[first].append(other)
            graph[other].append(first)
    remaining = set(range(len(faces)))
    while remaining:
        pending = [min(remaining)]
        remaining.remove(pending[0])
        found = []
        while pending:
            face = pending.pop()
            found.append(face)
            for neighbor in graph[face]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    pending.append(neighbor)
        yield faces[found]


def signed_area(coords, faces):
    a, b, c = coords[faces].transpose(1, 0, 2)
    ab, ac = b - a, c - a
    return ab[:, 0] * ac[:, 1] - ab[:, 1] * ac[:, 0]


def oriented(area):
    return np.all(area > 1e-12) or np.all(area < -1e-12)


def ring_chart(position, faces):
    """Lay out the rounded-box bands whose original quads meet at point junctions."""
    sheets = list(components(faces, by_edge=True))
    counts = Counter(int(i) for sheet in sheets for i in np.unique(sheet))
    corners = sorted(i for i, count in counts.items() if count > 1)
    if len(sheets) != 4 or len(corners) != 4 or any(counts[i] != 2 for i in corners):
        raise ValueError("unsupported chart junctions; refusing to duplicate source vertices")
    points = position[corners]
    axes = np.argsort(np.ptp(points, axis=0))[-2:]
    anchors = dict(zip(corners, points[:, axes]))
    center = points[:, axes].mean(axis=0)
    result = np.zeros((len(position), 2))
    for sheet in sheets:
        ids = np.unique(sheet)
        ends = sorted(set(ids) & set(corners))
        if len(ends) != 2:
            raise ValueError("expected two fixed chart corners per band")
        a, b = ends
        start, end = anchors[a], anchors[b]
        chord = end - start
        width = np.linalg.norm(chord)
        normal = np.array([-chord[1], chord[0]]) / width
        if np.dot(normal, (start + end) * 0.5 - center) < 0:
            normal *= -1

        edges = Counter(tuple(sorted(pair)) for x, y, z in sheet.tolist() for pair in ((x, y), (y, z), (z, x)))
        boundary = defaultdict(list)
        adjacent = defaultdict(set)
        for (u, v), count in edges.items():
            adjacent[u].add(v)
            adjacent[v].add(u)
            if count == 1:
                boundary[u].append(v)
                boundary[v].append(u)
        if any(len(neighbors) != 2 for neighbors in boundary.values()):
            raise ValueError("rounded band must have a single manifold boundary")
        arcs = []
        for first in boundary[a]:
            arc = [a, first]
            while arc[-1] != b and len(arc) <= len(boundary):
                arc.append(next(i for i in boundary[arc[-1]] if i != arc[-2]))
            if arc[-1] != b:
                raise ValueError("could not trace the boundary between fixed corners")
            arcs.append(arc)
        arcs.sort(key=len, reverse=True)
        depth = max(float(np.ptp(position[ids], axis=0).max()), width * 0.4)
        for arc, reach in zip(arcs, (depth * 0.52, -width * 0.18)):
            distance = np.r_[0, np.cumsum(np.linalg.norm(np.diff(position[arc], axis=0), axis=1))]
            t = distance / distance[-1]
            result[arc] = start + t[:, None] * chord + np.sin(math.pi * t[:, None]) * normal * reach

        interior = [i for i in ids if i not in boundary]
        matrix = np.zeros((len(interior), len(interior)))
        values = np.zeros((len(interior), 2))
        row = {i: n for n, i in enumerate(interior)}
        for i in interior:
            matrix[row[i], row[i]] = len(adjacent[i])
            for neighbor in adjacent[i]:
                if neighbor in row:
                    matrix[row[i], row[neighbor]] -= 1
                else:
                    values[row[i]] += result[neighbor]
        result[interior] = np.linalg.solve(matrix, values)
        if not oriented(signed_area(result, sheet)):
            raise ValueError("rounded band's UV embedding folds")
    return result


def chart_coordinates(surface, faces):
    points = surface.position[faces]
    normals = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
    normal = normals.sum(axis=0)
    length = np.linalg.norm(normal)
    if length > 1e-10:
        normal /= length
        along = np.eye(3)[np.argmin(np.abs(normal))]
        u = np.cross(along, normal)
        u /= np.linalg.norm(u)
        planar = surface.position @ np.stack((u, np.cross(normal, u)), axis=1)
        if oriented(signed_area(planar, faces)):
            return planar
    sheets = list(components(faces, by_edge=True))
    if len(sheets) == 4 and any(len(sheet) > 1 for sheet in sheets):
        coords = ring_chart(surface.position, faces)
    elif oriented(signed_area(surface.base_uv, faces)):
        coords = surface.base_uv.copy()
        extent = np.ptp(surface.position[np.unique(faces)], axis=0)
        # The source cylinder wall already has the longitudes split at its seam.
        # Scale its rectangular map by real circumference and axial extent.
        if np.all(extent > 1e-6):
            axial = int(np.argmin(extent))
            radial = np.delete(extent, axial)
            if np.isclose(radial[0], radial[1], rtol=0.06):
                coords *= [math.pi * radial.mean(), extent[axial]]
    else:
        raise ValueError("chart has no injective UVs for the original vertex indices")
    area_2d = np.abs(signed_area(coords, faces)).sum()
    area_3d = np.linalg.norm(normals, axis=1).sum()
    return coords * math.sqrt(area_3d / area_2d)


def pack(surfaces, size):
    charts = []
    for surface in surfaces:
        for faces in components(surface.triangles):
            indices = np.unique(faces)
            uv = chart_coordinates(surface, faces)[indices]
            uv -= uv.min(axis=0)
            extent = uv.max(axis=0)
            if extent[1] > extent[0]:
                uv = uv[:, ::-1]
                extent = extent[::-1]
            charts.append((surface, indices, uv, extent, faces))

    padding = PADDING + GUARD
    lower, upper = 0.0, size / max(extent[0] for _, _, _, extent, _ in charts)
    for _ in range(22):
        scale = (lower + upper) / 2
        boxes = [
            [0, 0, *(np.maximum(extent * scale, 2.5) + padding * 2), index]
            for index, (_, _, _, extent, _) in enumerate(charts)
        ]
        width, height = box_pack_2d(boxes)
        if max(width, height) <= size:
            lower, packed = scale, boxes
        else:
            upper = scale
    if not lower:
        raise ValueError("atlas cannot fit the requested padding at this resolution")
    for x, y, width, height, index in packed:
        surface, ids, uv, extent, _ = charts[index]
        interior = np.array([width, height]) - 2 * padding
        surface.uv[ids] = ((uv / extent) * interior + [x + padding, y + padding]) / size
    return charts


def coverage(charts, size):
    """Check overlaps at pixel centers and count rasterized atlas coverage."""
    result = np.zeros((size, size), dtype=bool)
    misses = 0
    for surface, _, _, _, faces in charts:
        used = False
        for triangle in surface.uv[faces] * size:
            lo = np.maximum(np.floor(triangle.min(axis=0)).astype(int), 0)
            hi = np.minimum(np.ceil(triangle.max(axis=0)).astype(int), size)
            x = np.arange(lo[0], hi[0]) + 0.5
            y = np.arange(lo[1], hi[1])[:, None] + 0.5
            crosses = []
            for a, b in zip(triangle, np.roll(triangle, -1, axis=0)):
                crosses.append((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))
            tested = np.asarray(crosses)
            hit = np.all(tested > 1e-8, axis=0) | np.all(tested < -1e-8, axis=0)
            region = result[lo[1]:hi[1], lo[0]:hi[0]]
            if np.any(region & hit):
                raise ValueError(f"overlapping lightmap triangles at {size} pixels")
            region |= hit
            used |= bool(hit.any())
        misses += not used
    if misses:
        raise ValueError(f"{misses} charts do not cover a pixel at {size}; increase atlas resolution")
    return result


def glb_with_uv(doc, binary, meshes):
    if len(doc["buffers"]) != 1:
        raise ValueError("expected one embedded glTF buffer")
    output = bytearray(binary)
    for surfaces in meshes.values():
        for surface in surfaces:
            mapped = surface.uv.copy()
            mapped[:, 1] = 1 - mapped[:, 1]  # Blender bottom origin to glTF top origin.
            raw = mapped.astype("<f4").tobytes()
            view = len(doc["bufferViews"])
            accessor = len(doc["accessors"])
            doc["bufferViews"].append(dict(buffer=0, byteOffset=len(output), byteLength=len(raw), target=34962))
            doc["accessors"].append(dict(bufferView=view, componentType=FLOAT, count=len(mapped), type="VEC2"))
            surface.attributes["TEXCOORD_1"] = accessor
            output.extend(raw)
    doc["buffers"][0]["byteLength"] = len(output)
    encoded = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    size = GLB_HEADER.size + 2 * CHUNK_HEADER.size + len(encoded) + len(output)
    return (GLB_HEADER.pack(b"glTF", 2, size) + CHUNK_HEADER.pack(len(encoded), b"JSON") + encoded
            + CHUNK_HEADER.pack(len(output), b"BIN\0") + output)


def blender_xyz(xyz):
    x, y, z = xyz
    return (x, -z, y)


def bind_blender_uv(scene, doc, meshes):
    targets = []
    bpy.ops.object.select_all(action="DESELECT")
    for node in doc["nodes"]:
        if "mesh" not in node:
            continue
        obj = scene.objects.get(node.get("name", ""))
        if obj is None or obj.type != "MESH":
            raise ValueError("expected each imported mesh node to have a unique source name")
        imported_positions = np.array([vertex.co[:] for vertex in obj.data.vertices])
        expected_positions, expected_faces, generated_uv = [], [], []
        offset = 0
        for surface in meshes[node["mesh"]]:
            ids, index = np.unique(surface.triangles, return_inverse=True)
            expected_positions.extend(map(blender_xyz, surface.position[ids]))
            expected_faces.extend(index.reshape(-1) + offset)
            generated_uv.extend(surface.uv[ids])
            offset += len(ids)
        imported_faces = [loop.vertex_index for loop in obj.data.loops]
        if imported_faces != expected_faces or imported_positions.shape != np.shape(expected_positions):
            raise ValueError(f"imported indices differ for {obj.name}")
        if not np.allclose(imported_positions, expected_positions, atol=2e-6, rtol=0):
            raise ValueError(f"imported positions differ for {obj.name}")
        lightmap = obj.data.uv_layers.new(name=UV_NAME, do_init=False)
        lightmap.uv.foreach_set("vector", np.asarray(generated_uv, dtype=np.float32)[imported_faces].ravel())
        obj.data.uv_layers.active = lightmap
        obj.select_set(True)
        targets.append(obj)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.join()  # Bake proxy only, to do one Cycles bake against the shared image.
    return bpy.context.view_layer.objects.active


def foliage(scene):
    """Create an original procedural cutout in a single plane outside the west sash."""
    rng = random.Random(121217)
    vertices, faces = [], []
    for _ in range(195):
        z = rng.uniform(0.05, 5.1)
        y = rng.uniform(1.2, 3.7)
        tilt = rng.uniform(0, math.tau)
        length, width = rng.uniform(0.075, 0.15), rng.uniform(0.021, 0.044)
        face = []
        for corner in range(6):
            angle = corner * math.tau / 6
            u, v = length * math.cos(angle), width * math.sin(angle)
            leaf_z = z + u * math.cos(tilt) - v * math.sin(tilt)
            leaf_y = y + u * math.sin(tilt) + v * math.cos(tilt)
            face.append(len(vertices))
            vertices.append(blender_xyz((-7.0, leaf_y, leaf_z)))
        faces.append(face)
    mesh = bpy.data.meshes.new("Procedural olive leaf cutout")
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(mesh.name, mesh)
    scene.collection.objects.link(obj)
    mat = bpy.data.materials.new("Olive leaf")
    mat.use_nodes = True
    mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.076, 0.109, 0.042, 1)
    mesh.materials.append(mat)


def setup_scene(args, *, exterior_ground=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.render.engine = "CYCLES"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = args.threads
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.seed = 25
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 6
    scene.cycles.denoising_use_gpu = False
    scene.cycles.use_denoising = False

    bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()), merge_vertices=False)
    altitude, azimuth = map(math.radians, (args.elevation, args.azimuth))
    direction = Vector((math.sin(azimuth) * math.cos(altitude),
                        math.cos(azimuth) * math.cos(altitude), math.sin(altitude)))
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = SUN_ENERGY
    sun.angle = math.radians(SUN_DIAMETER)
    sun.use_temperature = True
    sun.temperature = args.temperature
    sun_obj = bpy.data.objects.new(sun.name, sun)
    scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()

    world = bpy.data.worlds.new("Nishita")
    world.use_nodes = True
    scene.world = world
    sky = world.node_tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_disc = False  # The colocated sun light supplies the disc.
    sky.sun_elevation = altitude
    sky.sun_rotation = azimuth  # Nishita angles use +Y north and clockwise toward +X.
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Strength"].default_value = SKY_STRENGTH
    world.node_tree.links.new(sky.outputs["Color"], bg.inputs["Color"])
    if not args.no_foliage:
        foliage(scene)
    if not exterior_ground:
        return scene, direction
    # A single exterior diffuse surface supplies the bounce the open sash sees.
    ground = bpy.data.meshes.new("Exterior earth")
    ground.from_pydata([blender_xyz((x, -0.2, z)) for x, z in
                       ((-32, -24), (-6.01, -24), (-6.01, 24), (-32, 24))], [], [(3, 2, 1, 0)])
    ground_obj = bpy.data.objects.new(ground.name, ground)
    scene.collection.objects.link(ground_obj)
    earth = bpy.data.materials.new("Dry earth")
    earth.use_nodes = True
    shader = earth.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.29, 0.24, 0.14, 1)
    shader.inputs["Roughness"].default_value = 0.95
    ground.materials.append(earth)
    return scene, direction


def float_image(name, pixels):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width, height, alpha=False, float_buffer=True)
    image.colorspace_settings.name = "Non-Color"
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[..., :3] = pixels
    image.pixels.foreach_set(rgba.ravel())
    return image


def image_rgb(image):
    width, height = image.size
    pixels = np.empty(height * width * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(height, width, 4)[..., :3].copy()


def denoise_atlas(image, threads):
    """Use the HDR RT filter provided by the Blender distribution."""
    library_path = Path(bpy.app.binary_path).parent / "lib" / "libOpenImageDenoise.so.2"
    oidn = ct.CDLL(str(library_path))
    ptr, name, count = ct.c_void_p, ct.c_char_p, ct.c_size_t
    functions = {
        "NewDevice": (ptr, ct.c_int),
        "SetDeviceInt": (None, ptr, name, ct.c_int),
        "CommitDevice": (None, ptr),
        "NewFilter": (ptr, ptr, name),
        "SetSharedFilterImage": (None, ptr, name, ptr, ct.c_int, count, count, count, count, count),
        "SetFilterBool": (None, ptr, name, ct.c_bool),
        "SetFilterInt": (None, ptr, name, ct.c_int),
        "CommitFilter": (None, ptr),
        "ExecuteFilter": (None, ptr),
        "GetDeviceError": (ct.c_int, ptr, ct.POINTER(name)),
        "GetDeviceInt": (ct.c_int, ptr, name),
        "ReleaseFilter": (None, ptr),
        "ReleaseDevice": (None, ptr),
    }
    api = {}
    for symbol, (result, *params) in functions.items():
        callable_ = getattr(oidn, "oidn" + symbol)
        callable_.restype = result
        callable_.argtypes = params
        api[symbol] = callable_

    def check(device):
        message = name()
        if api["GetDeviceError"](device, ct.byref(message)):
            raise RuntimeError(f"OpenImageDenoise: {message.value.decode()}")

    color = image_rgb(image)
    output = np.empty_like(color)
    width, height = image.size
    device = api["NewDevice"](1)  # OIDN_DEVICE_TYPE_CPU
    filter_ = None
    try:
        if not device:
            check(None)
            raise RuntimeError("could not initialize the OIDN CPU device")
        api["SetDeviceInt"](device, b"numThreads", threads)
        api["CommitDevice"](device)
        check(device)
        version = ".".join(str(api["GetDeviceInt"](device, key))
                           for key in (b"versionMajor", b"versionMinor", b"versionPatch"))
        filter_ = api["NewFilter"](device, b"RT")
        check(device)
        for slot, data in ((b"color", color), (b"output", output)):
            api["SetSharedFilterImage"](filter_, slot, data.ctypes.data, 3, width, height, 0, 0, 0)
        api["SetFilterBool"](filter_, b"hdr", True)
        api["SetFilterInt"](filter_, b"quality", 6)  # OIDN_QUALITY_HIGH
        api["CommitFilter"](filter_)
        api["ExecuteFilter"](filter_)
        check(device)
        return np.maximum(output, 0), version
    finally:
        if filter_:
            api["ReleaseFilter"](filter_)
        if device:
            api["ReleaseDevice"](device)


def write_map(scene, pixels, filename):
    image = float_image(filename.stem, pixels)
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "32"
    scene.render.image_settings.exr_codec = "ZIP"
    image.save_render(str(filename.with_suffix(".exr")), scene=scene)
    bpy.data.images.remove(image)


def integer_maps(pixels, exposure, filename):
    # Numerical lightmaps use an sRGB transfer for the file, without a display view transform.
    lin = np.clip(pixels * exposure, 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    rgb = np.rint(srgb * 255).astype(np.uint8).astype(np.float32) / 255
    for format_name, suffix in (("PNG", ".png"), ("JPEG", ".jpg")):
        height, width = rgb.shape[:2]
        image = bpy.data.images.new(filename.stem, width, height, alpha=False, float_buffer=False)
        image.colorspace_settings.name = "Non-Color"
        rgba = np.ones((height, width, 4), dtype=np.float32)
        rgba[..., :3] = rgb
        image.pixels.foreach_set(rgba.ravel())
        image.file_format = format_name
        image.filepath_raw = str(filename.with_suffix(suffix))
        image.save(quality=95) if format_name == "JPEG" else image.save()
        bpy.data.images.remove(image)


def reference(scene, args):
    data = bpy.data.cameras.new("Workshop reference")
    data.type = "PERSP"
    data.sensor_fit = "HORIZONTAL"
    data.lens = data.sensor_width / (2 * math.tan(math.radians(70) * 0.5))
    camera = bpy.data.objects.new(data.name, data)
    camera.location = blender_xyz(args.camera)
    camera.rotation_euler = (Vector(blender_xyz(args.target)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(camera)
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = REFERENCE_SIZE
    scene.render.resolution_percentage = args.reference_scale
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = REFERENCE_EXPOSURE
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.025
    scene.cycles.adaptive_min_samples = min(32, args.samples)
    scene.render.filepath = str(args.output / "workshop-reference.png")
    bpy.ops.render.render(write_still=True)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    args = arguments()
    start = time.monotonic()
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    source = args.input.read_bytes()
    doc, binary = read_glb(source)
    meshes = load_surfaces(doc, binary)
    size, smallest = args.resolution[0], args.resolution[-1]
    charts = pack([s for group in meshes.values() for s in group], smallest)
    masks = {r: coverage(charts, r) for r in args.resolution}
    model = glb_with_uv(doc, binary, meshes)
    (args.output / f"{args.input.stem}-lightmap.glb").write_bytes(model)
    print(f"Atlas: {len(charts)} charts, coverage " + str({r: round(m.mean(), 3) for r, m in masks.items()}), flush=True)

    scene, sun_direction = setup_scene(args)
    target = bind_blender_uv(scene, doc, meshes)
    image = bpy.data.images.new("Diffuse bake", size, size, alpha=True, float_buffer=True)
    image.colorspace_settings.name = "Non-Color"
    for material in target.data.materials:
        nodes = material.node_tree.nodes
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        nodes.active = tex
    scene.cycles.use_adaptive_sampling = False
    print(f"Start diffuse bake {size} x {size}, {args.samples} CPU samples", flush=True)
    begun = time.monotonic()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"},
                       uv_layer=UV_NAME, margin=PADDING * size // smallest, margin_type="EXTEND")
    bake_seconds = time.monotonic() - begun

    begun = time.monotonic()
    pixels, oidn_version = denoise_atlas(image, args.threads)
    if not np.isfinite(pixels).all() or np.max(pixels) <= 0:
        raise ValueError("denoiser returned invalid or empty irradiance")
    denoise_seconds = time.monotonic() - begun
    begun = time.monotonic()
    peak = float(np.percentile(np.max(pixels[masks[size]], axis=1), 99.95))
    exposure = 1.0 / peak
    scene.view_settings.view_transform = "Standard"
    for resolution in args.resolution:
        factor = size // resolution
        reduced = pixels.reshape(resolution, factor, resolution, factor, 3).mean(axis=(1, 3))
        filename = args.output / f"lightmap-{resolution}"
        write_map(scene, reduced, filename)
        integer_maps(reduced, exposure, filename)
    export_seconds = time.monotonic() - begun
    begun = time.monotonic()
    reference(scene, args)
    reference_seconds = time.monotonic() - begun

    pref = bpy.context.preferences.addons["cycles"].preferences
    timing = dict(bake=bake_seconds, oidn=denoise_seconds, encoding=export_seconds,
                  reference=reference_seconds, total=time.monotonic() - start)
    report = dict(
        schema="holodeck.linterna.lightmap-bake/v1",
        input=dict(name=args.input.name, bytes=len(source), sha256=digest(source)),
        blender=dict(version=bpy.app.version_string, build_hash=bpy.app.build_hash.decode(), background=bpy.app.background),
        cycles=dict(device="CPU", model=pref.get_devices_for_type("CPU")[0].name, architecture=platform.machine(),
                    visible_logical_cpus=len(os.sched_getaffinity(0)), threads=args.threads, samples=args.samples,
                    reference_max_samples=args.samples, reference_adaptive_threshold=0.025, denoiser="OpenImageDenoise", oidn_version=oidn_version,
                    bake_type="DIFFUSE", direct=True, indirect=True, color=False),
        solar=dict(elevation_deg=args.elevation, azimuth_deg_from_negative_z_toward_positive_x=args.azimuth,
                   temperature_kelvin=args.temperature, diameter_deg=SUN_DIAMETER, energy=SUN_ENERGY,
                   direction_blender=list(sun_direction), nishita_background_strength=SKY_STRENGTH, nishita_sun_disc=False, nishita_azimuth_deg=args.azimuth,
                   exterior_ground=True,
                   foliage_cutout=not args.no_foliage),
        atlas=dict(uv=UV_NAME, gltf_attribute="TEXCOORD_1", charts=len(charts), padding_pixels_at_smallest=PADDING,
                   primary_resolution=size, sizes=args.resolution, downsample_method="linear box",
                   coverage={r: round(m.mean(), 5) for r, m in masks.items()},
                   exr="scene-linear RGB float32", png_jpeg_transfer="sRGB", png_jpeg_linear_exposure_gain=exposure,
                   png_jpeg_exposure_ev=math.log2(exposure), png_jpeg_recover_linear_multiplier=1.0 / exposure,
                   clipped_channel_fraction=float(np.mean(pixels[masks[size]] * exposure > 1)),
                   three_texture_channel=1, three_texture_flip_y=False),
        reference=dict(width=REFERENCE_SIZE[0] * args.reference_scale // 100,
                       height=REFERENCE_SIZE[1] * args.reference_scale // 100,
                       camera_gltf_m=args.camera, target_gltf_m=args.target, horizontal_fov_deg=70,
                       display_transform="AgX", display_exposure_ev=REFERENCE_EXPOSURE),
        seconds={key: round(val, 3) for key, val in timing.items()},
        files={p.name: {"bytes": p.stat().st_size, "sha256": digest(p.read_bytes())}
               for p in sorted(args.output.iterdir()) if p.suffix in {".glb", ".exr", ".png", ".jpg"}},
    )
    (args.output / "manifest.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Completed in {timing['total']:.1f} seconds", flush=True)


if __name__ == "__main__":
    main()
