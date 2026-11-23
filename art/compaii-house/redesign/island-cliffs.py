"""Author the near islands in Blender and replace only their inherited terrain."""
from copy import deepcopy
from hashlib import sha256
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_water import pack_glb, parse_glb

output, previous, commons = map(Path, sys.argv[sys.argv.index("--") + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"

# World X/Z corresponds to Blender X/-Y. The cap lies below the established
# 0.10 m collision surface. Keep the play and presentation footprints whole.
islands = [
    ("West gallery shore", -22, 0, 8.0, .070, 5.34, 48, .4),
    ("East garden shore", 22, 0, 10.0, .070, 5.91, 56, 2.4),
    ("North Mirador shore", 0, -17, 4.9, .070, 3.62, 36, 3.3),
    ("West skerry", -39, -29, 4.0, -2.30, 4.84, 24, 5.0),
    ("East skerry", 38, -34, 5.0, -2.30, 4.84, 28, 1.3),
    ("South skerry", -31, 29, 3.0, -2.30, 4.84, 24, 2.8),
]
turf = (.93, .96, .91)
stone = (.149, .181, .174)
band_colour = [(.20, .229, .193), stone, (.247, .256, .208),
               (.15, .175, .160), (.204, .215, .178), (.107, .148, .148),
               (.087, .122, .124), (.065, .093, .101)]
# Reuse the project's original tiled meadow and basalt maps, embedding the
# selected images in the editable source. No downloads are needed.
commons_bytes = commons.read_bytes()
assert sha256(commons_bytes).hexdigest() == "c886dceb1c58807b553b9a8bfcfb499dbcc5f105ef3a60264fcb9f6b3be06a75"
source, source_payload = parse_glb(commons_bytes)
colour_layer = "Mineral and ground colour"


def finish(name, tile, strength):
    material = bpy.data.materials.new(name)
    selected = next(item for item in source["materials"] if item["name"] == tile)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .93
    for field, spec in (("Base Color", selected["pbrMetallicRoughness"]["baseColorTexture"]),
                        ("Normal", selected["normalTexture"])):
        source_image = source["images"][source["textures"][spec["index"]]["source"]]
        view = source["bufferViews"][source_image["bufferView"]]
        start = view.get("byteOffset", 0)
        data = bytes(source_payload[start:start+view["byteLength"]])
        assert source_image["mimeType"] == "image/jpeg"
        path = output / (source_image["name"] + ".jpg")
        path.write_bytes(data)
        image = bpy.data.images.load(str(path))
        if field == "Normal":
            image.colorspace_settings.name = "Non-Color"
        image.pack()
        path.unlink()
        node = nodes.new("ShaderNodeTexImage")
        node.image = image
        if field == "Normal":
            normals = nodes.new("ShaderNodeNormalMap")
            normals.inputs["Strength"].default_value = strength
            links.new(node.outputs["Color"], normals.inputs["Color"])
            links.new(normals.outputs["Normal"], shader.inputs[field])
        else:
            links.new(node.outputs["Color"], shader.inputs[field])
    return material


shale = finish("Bedded coastal shale", "Split basalt", .72)
meadow = finish("Salt meadow", "Meadow understorey", .65)


def tinted(base, factor):
    return (*(min(1, v * factor) for v in base), 1)


def sculpt(name, vertices, faces, colours, material=shale):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
    assert not data.validate(verbose=True), name
    data.update()
    attribute = data.color_attributes.new(name=colour_layer, type="BYTE_COLOR", domain="POINT")
    for vertex, value in zip(attribute.data, colours):
        vertex.color = value
    uv = data.uv_layers.new(name="Surface at world scale")
    for face in data.polygons:
        horizontal = material == meadow or abs(face.normal.z) > .72
        u_axis = 0 if horizontal or abs(face.normal.x) < abs(face.normal.y) else 1
        v_axis = 1 if horizontal else 2
        scale = 2.35 if material == meadow else 1.72
        for corner in face.loop_indices:
            point = data.vertices[data.loops[corner].vertex_index].co
            uv.data[corner].uv = (point[u_axis]/scale, point[v_axis]/scale)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


for name, x, z, radius, top, depth, segments, phase in islands:
    playable = top > 0
    angles = [2 * pi * segment / segments for segment in range(segments)]
    vertices, faces, colours = [], [], []
    # Shale beds step out and in. Offset the bedding around the cliff and
    # leave a defined upper ledge. The mainland skirts stay above the sea.
    # The offshore profiles reach the established baked foam at low tide.
    layers = (0, .065, .20, .26, .42, .59, .76, 1)
    ratios = (1, .986, .925, .952, .816, .721, .515, .285) if playable else (1, .96, .81, .86, .65, .56, .39, .27)
    for row, (layer, ratio) in enumerate(zip(layers, ratios)):
        for i, angle in enumerate(angles):
            fracture = .052 * sin(angle*7+phase) + .038 * cos(angle*11-phase) + .07 * cos(angle*3+phase)
            turn = angle + .025 * sin(row*.9+angle*3) * min(row, 1)
            edge = 1 + fracture * (min(row, 1) if playable else 1)
            extent = radius * ratio * edge
            dip = (.18*sin(angle*2+phase) + .105*cos(angle*5-phase)) * (min(row, 1) if playable else 1)
            vertices.append((x+extent*cos(turn), top-depth*layer+dip, z+extent*sin(turn)))
            variation = 1 + .13*sin(angle*7+phase) + .085*cos(i*2.5+row)
            colours.append(tinted(tuple(.59 + 1.45*v for v in band_colour[row]), variation))
    for row in range(len(layers)-1):
        for i in range(segments):
            a = row*segments+i
            b = row*segments+(i+1)%segments
            faces.extend(((a,b,b+segments),(a,b+segments,a+segments)))
    sculpt(name + " · split shale beds", vertices, faces, colours)

    # The meadow shape follows the upper ledge, with only shallow world-space
    # colour mottling. The authoring rectangle and walk surfaces remain level.
    rim = vertices[:segments]
    vertices, faces, colours = [], [], []
    for fraction in (1, .80, .60, .40, .20):
        for angle, (rim_x, rim_y, rim_z) in zip(angles, rim):
            px, pz = x+(rim_x-x)*fraction, z+(rim_z-z)*fraction
            height = rim_y if not playable else top-.004*(1-fraction)
            vertices.append((px,height,pz))
            variation = 1 + .13*sin(px*1.15-pz*.4) * cos(pz*.9+px*.2) + .08*cos(pz*.68+px*.62)
            colours.append(tinted(turf, variation * (.91 if fraction==1 else 1)))
    for row in range(4):
        for i in range(segments):
            a = row*segments+i
            b = row*segments+(i+1)%segments
            faces.extend(((a,a+segments,b),(b,a+segments,b+segments)))
    center = len(vertices)
    vertices.append((x,top-.004,z))
    colours.append(tinted(turf, 1.04))
    faces.extend((4*segments+(i+1)%segments,4*segments+i,center) for i in range(segments))
    cap = sculpt(name + " · meadow cap", vertices, faces, colours, meadow)
    for polygon in cap.data.polygons:
        polygon.use_smooth = True

# Three shallow fragments at the inherited western positions stay clear of the
# creation court.
for index, (x,z,scale) in enumerate(((-28.1,-.4,.70),(-25,6.4,.60),(-18,-5.9,.60))):
    angles = [2*pi*i/7 for i in range(7)]
    verts, faces, colours = [], [], []
    for radius, height in ((.78,.035),(1,.20),(.53,.48)):
        for i, angle in enumerate(angles):
            r = scale*radius*(1+.19*cos(i*1.5+index))
            verts.append((x+r*cos(angle),height+.04*cos(i*3.1),z+.77*r*sin(angle)))
            colours.append(tinted(tuple(.67+1.3*v for v in stone), 1+.13*sin(i*1.11+index)))
    for row in range(2):
        for i in range(7):
            a,b = row*7+i,row*7+(i+1)%7
            faces.append((a,a+7,b+7,b))
    faces.append(tuple(reversed(range(14,21))))
    sculpt("Weathered western fragment "+str(index+1),verts,faces,colours)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / "island-cliffs.blend"), compress=True)
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.join()
bpy.context.object.name = "Near island cliffs and meadows"
bpy.ops.export_scene.gltf(filepath=str(output / "terrain.glb"), export_format="GLB",
                          export_cameras=False, export_lights=False,
                          export_vertex_color="ACTIVE", export_image_format="JPEG")

original = previous.read_bytes()
assert sha256(original).hexdigest() == "c2816b18bd97fbe50ef89575e271d4cfd385c93774fe037894ea6724f517809b"
world, payload = parse_glb(original)
terrain, terrain_payload = parse_glb((output / "terrain.glb").read_bytes())
assert len(terrain["nodes"]) == len(terrain["meshes"]) == 1
assert len(terrain["materials"]) == 2
assert set(terrain["nodes"][0]) == {"mesh","name"}, terrain["nodes"]
assert len(terrain["images"]) == 4 and not terrain.get("extensionsUsed")
old, = world["meshes"]
replacement, = terrain["meshes"]
removed = {"rock":864,"rockLight":936,"grass":1212}
kept, counts = [], {}
for item in old["primitives"]:
    name = world["materials"][item["material"]]["name"]
    if name in removed:
        counts[name] = world["accessors"][item["attributes"]["POSITION"]]["count"]
    else:
        kept.append(item)
assert removed == counts
assert [world["materials"][p["material"]]["name"] for p in kept] == [
    "water","Salt-weathered bark","Layered coastal foliage",
]
accessor_offset, view_offset = len(world["accessors"]), len(world["bufferViews"])
for view in terrain["bufferViews"]:
    assert view["buffer"] == 0
    world["bufferViews"].append({**view, "byteOffset": len(payload)+view.get("byteOffset", 0)})
for accessor in terrain["accessors"]:
    world["accessors"].append({**accessor, "bufferView": accessor["bufferView"]+view_offset})
image_offset, texture_offset, sampler_offset = (len(world[key]) for key in ("images","textures","samplers"))
world["images"].extend({**image, "bufferView": image["bufferView"]+view_offset}
                       for image in terrain["images"])
world["samplers"].extend(terrain.get("samplers", []))
for texture in terrain["textures"]:
    assert set(texture) <= {"source","sampler","name"}
    world["textures"].append({**texture, "source": texture["source"]+image_offset,
                              **({"sampler": texture["sampler"]+sampler_offset} if "sampler" in texture else {})})
for primitive in replacement["primitives"]:
    assert {"POSITION","NORMAL","COLOR_0","TEXCOORD_0"} <= set(primitive["attributes"]), primitive
    kept.append({**primitive, "material": primitive["material"]+len(world["materials"]),
                 "indices": primitive["indices"]+accessor_offset,
                 "attributes": {key: index+accessor_offset
                                for key,index in primitive["attributes"].items()}})
for material in terrain["materials"]:
    material = deepcopy(material)
    material["pbrMetallicRoughness"]["baseColorTexture"]["index"] += texture_offset
    material["normalTexture"]["index"] += texture_offset
    world["materials"].append(material)
old["primitives"] = kept
payload.extend(terrain_payload)
(output / "island-scenery-atelier.glb").write_bytes(pack_glb(world, payload))
