"""Author the coastal pine and bay canopies in Blender and reselect their visual primitives."""
from copy import deepcopy
from hashlib import sha256
import json
from math import cos, pi, sin, tau
from pathlib import Path

import sys

import bpy
from mathutils import Vector
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_water import add_view, pack_glb, parse_glb

PINES = [
    (-3.2, -18.2, 2.8), (3.3, -18.5, 3.1),
    (-27.3, -2.8, 3.8), (-27.7, 1.2, 4.1), (-25.7, 5.4, 3.2),
    (-20.4, 6.0, 3.0), (-18.1, -5.7, 3.4), (-24.7, -5.8, 3.0),
]
BAYS = [(-7.95, -5.55, 1.03, 1), (6.68, 6.95, .90, -1)]
COMMONS_SHRUBS = [
    (-8.61, -5.31, .55), (-7.01, -6.49, .67), (-6.05, -7.33, .63),
    (7.36, 6.12, .53), (6.21, 7.68, .61), (5.92, 6.87, .38),
]
ISLAND_SHRUBS = [(-27.65, 0, .65), (-24.55, 6.8, .65)]
ASSETS = {
    "island-scenery-atelier": "d0c5d692cbb64edb79213da7188515f126587588c94004bdec74878a53a9acb4",
    "compaii-atelier-commons": "9692049f367d813f055f7608923be49ffd49911aa9844da15250d450d2da6105",
}
TILE = 192


def dab(image, x, y, width, height, angle, shade):
    """Paint one tapered needle or waxy leaf into a projected surface tile."""
    radius = int(max(width, height) + 2)
    left, right = max(0, int(x) - radius), min(TILE, int(x) + radius + 1)
    bottom, top = max(0, int(y) - radius), min(TILE, int(y) + radius + 1)
    yy, xx = np.mgrid[bottom:top, left:right]
    along = ((xx - x) * cos(angle) + (yy - y) * sin(angle)) / width
    across = ((yy - y) * cos(angle) - (xx - x) * sin(angle)) / height
    filled = along**2 + abs(across)**1.65 < 1
    lit = np.clip(1 + .13 * across + .11 * (1 - abs(along)), .7, 1.3)
    rgb = np.asarray(shade)
    patch = image[bottom:top, left:right]
    for channel in range(3):
        patch[..., channel][filled] = np.clip(rgb[channel] * lit[filled], 0, 1)
    patch[..., 3][filled] = 1


def foliage_tile(broadleaf):
    rng = np.random.default_rng(329 if broadleaf else 3497)
    image = np.zeros((TILE, TILE, 4), dtype=np.float32)
    color = np.array((.29, .39, .21) if broadleaf else (.19, .29, .19))
    # Color in transparent border pixels prevents dark compression/mip edges.
    image[..., :3] = color
    for cluster in range(18 if broadleaf else 22):
        along = .10 + .78 * cluster / (17 if broadleaf else 21)
        hue = color * rng.uniform(.69, 1.26)
        branch_x = along * TILE
        spread = .32 * sin(pi * along) ** .75
        for side in (-1, 1):
            slope = rng.uniform(.36, .80) * side
            length = spread * TILE * rng.uniform(.65, 1.05)
            for tip in range(34 if broadleaf else 42):
                distance = rng.uniform(.06, 1)
                x = branch_x + distance * length * .52
                y = TILE * (.5 + .055 * sin(pi * along)) + distance * length * side
                x += rng.normal(0, 2.8)
                y += rng.normal(0, 2.8)
                if broadleaf:
                    long, short = rng.uniform(3.1, 8.1), rng.uniform(1.8, 3.7)
                else:
                    long, short = rng.uniform(2.1, 6.8), rng.uniform(.8, 1.9)
                tint = hue * rng.uniform(.7, 1.33) + np.array((.037, .025, 0)) * rng.random()
                dab(image, x, y, long, short, slope + rng.normal(0, .36), tint)
    return image


def foliage_atlas(path):
    atlas = np.concatenate((foliage_tile(False), foliage_tile(True)), axis=1)
    image = bpy.data.images.new("Holm coastal foliage atlas", width=TILE * 2, height=TILE, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(atlas.reshape(-1))
    image.file_format = "PNG"
    image.save(filepath=str(path))
    return path.read_bytes()


def pack_plant_materials(doc, blob, atlas):
    materials = doc["materials"]
    bark = len(materials)
    materials.append({"name": "Salt-weathered bark", "pbrMetallicRoughness": {
        "baseColorFactor": [.197, .132, .087, 1], "metallicFactor": 0, "roughnessFactor": .92}})
    image = len(doc.setdefault("images", []))
    doc["images"].append({"name": "Original Portuguese bay and coastal pine foliage",
                          "mimeType": "image/png", "bufferView": add_view(doc, blob, atlas)})
    sampler = len(doc.setdefault("samplers", []))
    doc["samplers"].append({"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071})
    texture = len(doc.setdefault("textures", []))
    doc["textures"].append({"source": image, "sampler": sampler})
    materials.append({"name": "Layered coastal foliage", "doubleSided": True, "alphaMode": "MASK",
                      "alphaCutoff": .43, "pbrMetallicRoughness": {
                          "baseColorTexture": {"index": texture}, "metallicFactor": 0, "roughnessFactor": .87}})
    return bark, bark + 1


class PlantMesh:
    """Build the editable positions and UV faces of one Blender mesh."""
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.uv = []

    def face(self, points, uv=None):
        index = len(self.vertices)
        self.vertices.extend(tuple(vertex) for vertex in points)
        self.faces.append(tuple(range(index, len(self.vertices))))
        self.uv.append(uv)

    def branch(self, points, radii, sides=5):
        rings = []
        for index, (point, radius) in enumerate(zip(points, radii)):
            axis = (points[min(index + 1, len(points) - 1)] - points[max(0, index - 1)]).normalized()
            guide = Vector((1, 0, 0)) if abs(axis.x) < .92 else Vector((0, 1, 0))
            tangent = axis.cross(guide).normalized()
            across = axis.cross(tangent)
            start = len(self.vertices)
            self.vertices.extend(point + radius * (tangent * cos(tau * n / sides) + across * sin(tau * n / sides))
                                 for n in range(sides))
            rings.append(tuple(range(start, start + sides)))
        for first, second in zip(rings, rings[1:]):
            for index, next_index in enumerate((*range(1, sides), 0)):
                self.faces.append((first[index], first[next_index], second[next_index], second[index]))
                self.uv.append(None)
        self.faces.extend((rings[0][::-1], rings[-1]))
        self.uv.extend((None, None))

    def tuft(self, start, end, width, broadleaf, spin):
        axis = (end - start).normalized()
        toward = axis.cross(Vector((0, 0, 1))).normalized()
        elevation = axis.cross(toward).normalized()
        left, right = (0.5, 1.0) if broadleaf else (0.0, 0.5)
        inset = 1 / (TILE * 2)
        uv = [(left + inset, .01), (right - inset, .01), (right - inset, .99), (left + inset, .99)]
        for angle in (spin, spin + pi * .44):
            half = (toward * cos(angle) + elevation * sin(angle)) * width / 2
            self.face((start - half, end - half, end + half, start + half), uv)

    def blender_mesh(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, (), self.faces)
        mesh.update()
        if self.uv[0] is not None:
            uv = mesh.uv_layers.new()
            for polygon, quad in zip(mesh.polygons, self.uv):
                for index, point in zip(polygon.loop_indices, quad):
                    uv.data[index].uv = point
        else:
            for polygon in mesh.polygons:
                polygon.use_smooth = True
        return mesh


def pine(wood, leaves, x, z, height, seed):
    rng = np.random.default_rng(seed)
    origin = Vector((x, -z, .047))
    lean = Vector((rng.uniform(-.19, .21), rng.uniform(-.16, .18), height * 1.31))
    trunk = [origin + lean * stage for stage in (0, .28, .62, .87, 1)]
    wood.branch(trunk, (.145, .103, .068, .034, .012), sides=8)
    for tier in range(8):
        fraction = .24 + tier * .097
        crown = height * .367 * (1.14 - fraction) ** .91
        phase = rng.uniform(0, tau)
        boughs = 6 if tier < 6 else 4
        for br in range(boughs):
            angle = phase + tau * br / boughs + rng.uniform(-.25, .25)
            reach = crown * rng.uniform(.7, 1.20)
            direction = Vector((cos(angle), sin(angle), 0))
            base = origin + lean * (fraction + rng.uniform(-.032, .031))
            elbow = base + direction * reach * .54 + Vector((0, 0, -.086 * height))
            edge = base + direction * reach + Vector((0, 0, height * rng.uniform(-.018, .058)))
            if br % 2 == 0:
                wood.branch([base, elbow, edge], (.032 * (1.24-fraction), .02, .004), sides=4)
            for section in (-1, 1):
                span = .79 + .13 * section
                wiggle = direction.cross(Vector((0, 0, 1))) * section * reach * .17
                front = base.lerp(edge, span) + wiggle
                leaves.tuft(elbow.lerp(base, .67), front + direction * reach * .29,
                            reach * (.67 if section == 1 else .56), False, rng.uniform(-.34, .39))
    tip = trunk[-1]
    for angle in range(4):
        delta = Vector((.16 * cos(angle * 1.7), .16 * sin(angle * 1.7), .21))
        leaves.tuft(tip - Vector((0, 0, .35)), tip + delta, .29, False, angle * .34)


def bay(wood, leaves, x, z, scale, flip, seed):
    rng = np.random.default_rng(seed)
    origin = Vector((x, -z, .07))
    bend = origin + Vector((-.12 * flip, .11, 1.04)) * scale
    fork = origin + Vector((.18 * flip, .06, 1.82)) * scale
    wood.branch([origin, bend, fork], (.162 * scale, .118 * scale, .086 * scale), sides=9)
    for branch in range(8):
        angle = branch * 2.399963 + rng.uniform(-.22, .22)
        reach = rng.uniform(.43, .96) if branch < 6 else rng.uniform(.24, .48)
        direction = Vector((cos(angle) * flip, sin(angle), 0))
        rise = 2.15 + branch * .166 + rng.uniform(-.23, .20)
        point = origin + scale * (direction * reach + Vector((.16 * flip, .00, rise)))
        twist = fork.lerp(point, .54) + scale * Vector((.13 * flip, .035, -.09))
        wood.branch([fork, twist, point], (.062 * scale, .039 * scale, .009), sides=6)
        for fan in range(10):
            angle_fan = fan * tau / 10 + rng.uniform(-.34, .34) + angle
            dir_fan = Vector((cos(angle_fan), sin(angle_fan), rng.uniform(-.07, .48)))
            length = scale * rng.uniform(.34, .69)
            spot = point.lerp(twist, rng.uniform(.06, .49))
            end = spot + dir_fan * length
            leaves.tuft(spot.lerp(twist, .34), end, scale * rng.uniform(.29, .53), True,
                        rng.uniform(-.8, .8))
        for twig in range(2):
            side = -1 if twig else 1
            limb = point + Vector((sin(angle) * .45 * side, cos(angle) * .42 * side, .22)) * scale
            wood.branch([twist.lerp(point, .58), point.lerp(limb, .45), limb], (.023, .013, .005), sides=4)
            leaves.tuft(point.lerp(twist, .26), limb + direction * .18,
                        .31 * scale, True, rng.uniform(-.57, .57))


def shrub(leaves, x, z, radius, seed):
    rng = np.random.default_rng(seed)
    base = Vector((x, -z, .13))
    for index in range(12):
        theta = index * tau / 12
        edge = base + Vector((radius * cos(theta) * rng.uniform(.53, .98),
                              radius * sin(theta) * rng.uniform(.48, .88), rng.uniform(.10, .36)))
        leaves.tuft(base + Vector((0, 0, .03)), edge, rng.uniform(.30, .49), True,
                    rng.uniform(-.55, .55))


def array_accessor(doc, blob, values, type_name, component=5126, target=34962, bounds=False):
    dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4"}[component]
    payload = np.asarray(values, dtype=dtype)
    accessor = {"componentType": component, "type": type_name, "count": len(payload),
                "bufferView": add_view(doc, blob, payload.tobytes(), target=target)}
    if bounds:
        accessor.update(min=np.min(payload, axis=0).tolist(), max=np.max(payload, axis=0).tolist())
    doc["accessors"].append(accessor)
    return len(doc["accessors"]) - 1


def local_accessor(doc, blob, accessor_id):
    info = doc["accessors"][accessor_id]
    view = doc["bufferViews"][info["bufferView"]]
    offset = view.get("byteOffset", 0) + info.get("byteOffset", 0)
    width = {"SCALAR": 1, "VEC3": 3}[info["type"]]
    dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4"}[info["componentType"]]
    return np.frombuffer(bytes(blob), dtype, info["count"] * width, offset=offset).reshape(-1, width)


def pack_plant_mesh(doc, blob, mesh, material, has_uv):
    """Preserve corner normals and UV seams while deduplicating Blender triangles."""
    mesh.calc_loop_triangles()
    coords, normals, texcoord, indices, seen = [], [], [], [], {}
    uv = mesh.uv_layers.active.data if has_uv else None
    for triangle in mesh.loop_triangles:
        for index in triangle.loops:
            point = mesh.vertices[mesh.loops[index].vertex_index].co
            normal = mesh.corner_normals[index].vector
            p, n = (point.x, point.z, -point.y), (normal.x, normal.z, -normal.y)
            t = (uv[index].uv[0], 1 - uv[index].uv[1]) if has_uv else ()
            key = (*p, *n, *t)
            if key not in seen:
                seen[key] = len(coords)
                coords.append(p)
                normals.append(n)
                if has_uv:
                    texcoord.append(t)
            indices.append(seen[key])
    attrs = {"POSITION": array_accessor(doc, blob, coords, "VEC3", bounds=True),
             "NORMAL": array_accessor(doc, blob, normals, "VEC3")}
    if has_uv:
        attrs["TEXCOORD_0"] = array_accessor(doc, blob, texcoord, "VEC2")
    assert len(coords) <= 65_535
    return {"attributes": attrs, "indices": array_accessor(doc, blob, indices, "SCALAR", 5123, 34963),
            "material": material}


def strip_commons_trunks(doc, blob, primitive):
    # Only the ten old trunk and branch objects share this oak material.
    # The registered domains below exclude pergola rafters, benches and bridges.
    local = deepcopy(primitive)
    positions = local_accessor(doc, blob, local["attributes"]["POSITION"])
    ids = local_accessor(doc, blob, local["indices"]).reshape(-1, 3)
    corners = positions[ids]
    left = (corners[..., 0] >= -8.70) & (corners[..., 0] <= -7.16) & (corners[..., 2] >= -6.18) & (corners[..., 2] <= -5.21)
    right = (corners[..., 0] >= 5.99) & (corners[..., 0] <= 7.33) & (corners[..., 2] >= 6.40) & (corners[..., 2] <= 7.25)
    remove = left.all(axis=1) | right.all(axis=1)
    assert int(remove.sum()) == 280
    component = doc["accessors"][local["indices"]]["componentType"]
    local["indices"] = array_accessor(doc, blob, ids[~remove].reshape(-1), "SCALAR", component, target=34963)
    return local


def variant(source, name, directory, atlas):
    raw = source.read_bytes()
    assert sha256(raw).hexdigest() == ASSETS[name]
    doc, blob = parse_glb(raw)
    original = deepcopy(doc)
    old_payload = bytes(blob)
    previous = doc["meshes"][0]["primitives"]
    wood, leaves = PlantMesh(), PlantMesh()
    if name == "island-scenery-atelier":
        assert [doc["materials"][p["material"]]["name"] for p in previous[7:11]] == ["bark", "pine", "leaf", "mint"]
        for index, position in enumerate(PINES):
            pine(wood, leaves, *position, seed=534 + index * 69)
        for index, position in enumerate(ISLAND_SHRUBS):
            shrub(leaves, *position, seed=706 + index)
        retained = {index: previous[index] for index in (*range(7), 11)}
        selected = list(retained.values())
    else:
        assert [doc["materials"][p["material"]]["name"] for p in previous[5:9]] == ["Dark oiled oak", "Weathered copper", "Bay leaves", "Leaf tips"]
        for index, position in enumerate(BAYS):
            bay(wood, leaves, *position, seed=548 + index * 89)
        for index, position in enumerate(COMMONS_SHRUBS):
            shrub(leaves, *position, seed=986 + index)
        retained = {index: previous[index] for index in (*range(5), 6, 9)}
        selected = [*previous[:5], strip_commons_trunks(doc, blob, previous[5]), previous[6], previous[9]]
    pair = pack_plant_materials(doc, blob, atlas)
    for shape, material, label in zip((wood, leaves), pair, ("Coastal branches", "Coastal foliage cards")):
        mesh = shape.blender_mesh(label)
        selected.append(pack_plant_mesh(doc, blob, mesh, material, has_uv=shape is leaves))
    doc["meshes"][0]["primitives"] = selected
    output = pack_glb(doc, blob)
    afterward, payload = parse_glb(output)
    assert payload[:len(old_payload)] == old_payload
    assert all(p in afterward["meshes"][0]["primitives"] for p in retained.values())
    assert afterward["nodes"] == original["nodes"]
    assert afterward["materials"][:len(original["materials"])] == original["materials"]
    assert afterward.get("images", [])[:len(original.get("images", []))] == original.get("images", [])
    file = directory / (name + "-trees.glb")
    file.write_bytes(output)
    return {"file": file.name, "sha256": sha256(output).hexdigest(), "bytes": len(output),
            "deltaBytes": len(output) - len(raw), "primitives": len(selected),
            "triangles": sum(doc["accessors"][p["indices"]]["count"] // 3 if "indices" in p
                             else doc["accessors"][p["attributes"]["POSITION"]]["count"] // 3 for p in selected),
            "preservedPrimitiveIndices": list(retained),
            "positions": [list(pos) for pos in PINES] if name == "island-scenery-atelier" else [list(pos) for pos in BAYS]}


if __name__ == "__main__":
    assets, output_dir = (Path(path).resolve() for path in sys.argv[sys.argv.index("--") + 1:])
    output_dir.mkdir(parents=True, exist_ok=True)
    if any(output_dir.iterdir()):
        raise ValueError("Choose an empty candidate directory")
    atlas = foliage_atlas(output_dir / "coastal-foliage.png")
    variants = {name: variant(assets / (name + ".glb"), name, output_dir, atlas) for name in ASSETS}
    net_delta = sum(item["deltaBytes"] for item in variants.values())
    assert net_delta <= 700 * 1024, net_delta
    (output_dir / "trees.json").write_text(json.dumps({"atlasBytes": len(atlas), "deltaBytes": net_delta,
                                                       "assets": variants}, indent=2) + "\n")
