"""Bake the Holm coast into the exact selected Atelier scenery with Blender 5.2."""

from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

import bpy
import numpy as np


SOURCE_SHA = "61f058ac7d7ba1de6f2fff1237dae7a473afcd2596849939eabb4b41b443a104"
OUTPUT = "island-scenery-atelier-coastal.glb"
RADIUS = 110.0
WATER = 11
NORMAL_PERIOD = 9.5
SUN_XZ = np.array((12.0, 16.0))
SUN_XZ /= np.linalg.norm(SUN_XZ)
CROSS_XZ = np.array((-SUN_XZ[1], SUN_XZ[0]))


def parse_glb(raw):
    magic, version, length, json_bytes, kind = struct.unpack_from("<4sIII4s", raw)
    assert (magic, version, length, kind) == (b"glTF", 2, len(raw), b"JSON")
    description = json.loads(raw[20:20 + json_bytes])
    bin_bytes, bin_kind = struct.unpack_from("<I4s", raw, 20 + json_bytes)
    assert bin_kind == b"BIN\0" and len(raw) == json_bytes + 28 + bin_bytes
    return description, bytearray(raw[28 + json_bytes:])


def pack_glb(description, blob):
    description["buffers"][0]["byteLength"] = len(blob)
    manifest = json.dumps(description, separators=(",", ":")).encode("utf-8")
    manifest += b" " * (-len(manifest) % 4)
    blob += b"\0" * (-len(blob) % 4)
    return (struct.pack("<4sIII4s", b"glTF", 2, 28 + len(manifest) + len(blob),
                        len(manifest), b"JSON") +
            manifest + struct.pack("<I4s", len(blob), b"BIN\0") + blob)


def positions(description, blob, primitive):
    accessor = description["accessors"][primitive["attributes"]["POSITION"]]
    view = description["bufferViews"][accessor["bufferView"]]
    assert accessor["type"] == "VEC3" and accessor["componentType"] == 5126
    return np.frombuffer(bytes(blob), "<f4", accessor["count"] * 3,
                         view.get("byteOffset", 0) + accessor.get("byteOffset", 0)).reshape(-1, 3)


def shore_edges(description, blob, water_height):
    """Intersect the existing rock faces with the surface. No fabricated beaches."""
    for primitive in description["meshes"][0]["primitives"][:2]:
        for triangle in positions(description, blob, primitive).reshape(-1, 3, 3):
            hits = []
            for a, b in zip(triangle, np.roll(triangle, 1, axis=0)):
                if (a[1] > water_height) != (b[1] > water_height):
                    hit = a + (b - a) * ((water_height - a[1]) / (b[1] - a[1]))
                    hits.append(hit[[0, 2]])
            if len(hits) == 2 and np.linalg.norm(hits[0] - hits[1]) > 1e-5:
                yield hits


def pixel_plane(size, span):
    midpoints = (np.arange(size, dtype=np.float32) + .5) / size
    return np.meshgrid(midpoints * span - span / 2, midpoints * span - span / 2, indexing="xy")


def mix(a, b, fraction):
    return a + (b - a) * fraction


def bake_diffuse(edges):
    # The broad UV maps world meters onto the entire 220 m disk.
    x, z = pixel_plane(1024, RADIUS * 2)
    r = np.hypot(x, z)
    far = np.clip((r - 14) / 114, 0, 1)
    waves = x * SUN_XZ[0] + z * SUN_XZ[1]
    across = x * CROSS_XZ[0] + z * CROSS_XZ[1]
    turbulence = (np.sin(across * .20 + np.sin(waves * .15)) * .46 +
                  np.cos(across * .51 - waves * .18) * .27 +
                  np.cos(waves * .69 - np.sin(across * .31)) * .13)
    reflection = np.power(np.maximum(0, waves / (r + 8)), 4) * (1 - .32 * far)
    color = mix(np.array((.230, .421, .478)), np.array((.426, .571, .608)), far[..., None])
    color += turbulence[..., None] * np.array((.034, .058, .070))
    color += reflection[..., None] * np.array((.070, .072, .066))

    nearest = np.full(x.shape, 1000, dtype=np.float32)
    for a, b in edges:
        vx, vz = b - a
        dx, dz = x - a[0], z - a[1]
        along = np.clip((dx * vx + dz * vz) / (vx * vx + vz * vz), 0, 1)
        nearest = np.minimum(nearest, np.hypot(dx - along * vx, dz - along * vz))
    shallows = .31 * np.exp(-nearest / 1.68)
    color = mix(color, np.array((.315, .542, .522)), shallows[..., None])
    ripples = np.maximum(0, np.sin(4 * nearest + 1.8 * turbulence))
    foam = .19 * np.exp(-nearest / 1.12) * ripples**4 * np.maximum(0, 2.4 * turbulence + .3)
    color = mix(color, np.array((.681, .787, .793)), foam[..., None])
    return np.clip(color, 0, 1)


def bake_normal():
    # Integer periods keep the local swell tile continuous in both directions.
    size = 512
    u, v = pixel_plane(size, 1.0)
    rng = np.random.default_rng(403)
    height = np.zeros_like(u)
    for frequency_x, frequency_z, amplitude, warp_x, warp_z in [
        (3, 4, .025, 1, -1), (2, 5, .015, 2, -1), (6, 8, .012, 1, 1),
        (8, 13, .009, 2, -1), (12, 17, .0055, 3, -1),
        (17, 22, .0036, 2, 1), (22, 35, .0019, 1, -2),
        (23, 43, .0018, 3, 1), (34, 51, .0013, 1, -3),
        (47, 67, .0009, 2, -1),
    ]:
        base = 2 * np.pi * (frequency_x * u + frequency_z * v)
        warp = .82 * np.sin(2 * np.pi * (warp_x * u + warp_z * v) + rng.uniform(0, 2 * np.pi))
        height += (amplitude * np.sin(base + warp + rng.uniform(0, 2 * np.pi))).astype(np.float32)
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) / (2 * NORMAL_PERIOD / size)
    dz = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) / (2 * NORMAL_PERIOD / size)
    direction = np.stack((-dx, -dz, np.ones_like(height)), axis=2)
    return .5 + .5 * direction / np.linalg.norm(direction, axis=2, keepdims=True)


def store_image(name, pixels, color_space, file):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    image.colorspace_settings.name = color_space
    rgba = np.ones((height, width, 4), dtype=np.float32)
    # Blender's image origin is lower-left. A standard glTF texture's v=0
    # samples the image's top row; map rows back to world z after JPEG encoding.
    rgba[:, :, :3] = pixels[::-1]
    image.pixels.foreach_set(rgba.reshape(-1))
    image.file_format = "JPEG"
    image.save(filepath=str(file), quality=88)
    return file.read_bytes()


def add_view(description, blob, data, **extra):
    blob.extend(b"\0" * (-len(blob) % 4))
    offset = len(blob)
    blob.extend(data)
    description["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), **extra})
    return len(description["bufferViews"]) - 1


def add_uv(description, blob, coordinates):
    coordinates = coordinates.astype("<f4")
    view = add_view(description, blob, coordinates.tobytes(), target=34962)
    description["accessors"].append({"bufferView": view, "componentType": 5126, "count": len(coordinates), "type": "VEC2"})
    return len(description["accessors"]) - 1


def add_texture(description, blob, image, name):
    description.setdefault("images", [])
    description["images"].append({"name": name, "bufferView": add_view(description, blob, image), "mimeType": "image/jpeg"})
    description.setdefault("samplers", [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}])
    description.setdefault("textures", [])
    description["textures"].append({"sampler": 0, "source": len(description["images"]) - 1})
    return len(description["textures"]) - 1


def main():
    source, stage = (Path(path).resolve() for path in sys.argv[sys.argv.index("--") + 1:])
    stage.mkdir(parents=True, exist_ok=True)
    if any(stage.iterdir()):
        raise ValueError("Choose an empty candidate directory")
    original = source.read_bytes()
    assert sha256(original).hexdigest() == SOURCE_SHA
    description, blob = parse_glb(original)
    old_payload = bytes(blob)
    mesh = description["meshes"][0]["primitives"]
    primitive = mesh[WATER]
    assert primitive["material"] == WATER and description["materials"][WATER]["name"] == "water"
    water = positions(description, blob, primitive)
    assert len(water) == 768 and abs(float(water[:, 1].max()) - (-6.94)) < 1e-5
    edges = list(shore_edges(description, blob, float(water[:, 1].max())))
    assert edges
    diffuse = store_image("Coastal water / reflected color", bake_diffuse(edges), "sRGB", stage / "coast-color.jpg")
    normal = store_image("Coastal water / wind ripples", bake_normal(), "Non-Color", stage / "coast-normal.jpg")
    xz = water[:, (0, 2)]
    primitive["attributes"]["TEXCOORD_0"] = add_uv(description, blob, xz / NORMAL_PERIOD)
    primitive["attributes"]["TEXCOORD_1"] = add_uv(description, blob, (xz + RADIUS) / (RADIUS * 2))
    layer = description["materials"][WATER]
    layer["pbrMetallicRoughness"] = {
        "baseColorTexture": {"index": add_texture(description, blob, diffuse, "Coastal water / reflected color"), "texCoord": 1},
        "metallicFactor": 0,
        "roughnessFactor": .39,
    }
    layer["normalTexture"] = {"index": add_texture(description, blob, normal, "Coastal water / wind ripples"), "scale": .68}
    result = pack_glb(description, blob)
    assert len(result) - len(original) < 700 * 1024
    after_manifest, after_payload = parse_glb(result)
    before_manifest, _ = parse_glb(original)
    assert after_payload[:len(old_payload)] == old_payload
    assert after_manifest["meshes"][0]["primitives"][:WATER] == before_manifest["meshes"][0]["primitives"][:WATER]
    assert after_manifest["materials"][:WATER] == before_manifest["materials"][:WATER]
    assert after_manifest["nodes"] == before_manifest["nodes"]
    target = stage / OUTPUT
    target.write_bytes(result)
    inventory = {"sha256": sha256(result).hexdigest(), "sourceSha256": SOURCE_SHA, "bytes": len(result),
                 "replacementDelta": len(result) - len(original), "triangles": sum(
                     description["accessors"][part["attributes"]["POSITION"]]["count"] // 3 for part in mesh),
                 "waterTriangles": len(water) // 3, "drawBatches": len(mesh), "shoreSegments": len(edges),
                 "surfaceY": round(float(water[:, 1].max()), 2), "radius": RADIUS,
                 "textures": {"color": [1024, 1024], "normal": [512, 512]}}
    (stage / "coastal-water.json").write_text(json.dumps(inventory, indent=2) + "\n")
    print(json.dumps(inventory))


if __name__ == "__main__":
    main()
