"""Author the playable eastern island on the existing metre grid."""
from math import cos, hypot, sin, tau
from pathlib import Path
from random import Random
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_trees import PlantMesh, bay, foliage_atlas, shrub, pack_plant_materials, pack_plant_mesh
from coastal_water import pack_glb, parse_glb

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"

rng = Random(527)
pieces = []


def finish(name, colour, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


stone = [finish("Sandstone landing " + name, rgb, .85) for name, rgb in (
    ("chalk", (.52,.445,.33)), ("ochre", (.46,.371,.249)),
    ("pale", (.57,.489,.366)), ("shell", (.48,.419,.331)))]
basalt = finish("Honed garden basalt", (.086,.111,.109), .82)
oak = finish("Fumed garden oak", (.222,.105,.049), .79)
bronze = finish("Garden bronze seams", (.40,.237,.081), .44, .51)
turf = finish("Coastal meadow", (1,1,1), .95)
loam = finish("Garden loam", (.12,.088,.058), .95)
shader = turf.node_tree.nodes.get("Principled BSDF")
tint = turf.node_tree.nodes.new("ShaderNodeVertexColor")
tint.layer_name = "Terrain tint"
grain = bpy.data.images.new("East island ground grain", width=128, height=128, alpha=False)
grain_rng = Random(886)
noise_layers = [(size, weight, [grain_rng.uniform(-1, 1) for _ in range(size*size)])
                for size, weight in ((5,.065),(13,.067),(29,.055),(57,.042))]


def noise(size, values, x, y):
    x,y = x*size/128,y*size/128
    ix,iy = int(x),int(y)
    u,v = x-ix,y-iy
    u,v = u*u*(3-2*u),v*v*(3-2*v)
    left,right = ix,(ix+1)%size
    low,high = iy*size,((iy+1)%size)*size
    a = values[low+left]*(1-u)+values[low+right]*u
    b = values[high+left]*(1-u)+values[high+right]*u
    return a*(1-v)+b*v


pixels = []
for iy in range(128):
    for ix in range(128):
        n = .86 + sum(weight*noise(size,values,ix,iy) for size,weight,values in noise_layers)
        n = min(1,n + grain_rng.uniform(-.032,.032))
        pixels.extend((n,n*.994,n*.98,1))
grain.pixels.foreach_set(pixels)
grain_path = output/"east-garden-grain.jpg"
grain.filepath_raw, grain.file_format = str(grain_path), "JPEG"
grain.save()
grain.pack()
grain_path.unlink()
texture = turf.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = grain
multiply = turf.node_tree.nodes.new("ShaderNodeMixRGB")
multiply.blend_type = "MULTIPLY"
multiply.inputs[0].default_value = 1
links = turf.node_tree.links
links.new(texture.outputs["Color"], multiply.inputs[1])
links.new(tint.outputs["Color"], multiply.inputs[2])
links.new(multiply.outputs["Color"], shader.inputs["Base Color"])


def place(name, data, mat):
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def box(name, x, y, z, size, mat, bevel=0):
    w, h, d = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,-z,y))
    obj = bpy.context.object
    obj.name, obj.dimensions = name, (w,d,h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        border = obj.modifiers.new("Dressed edges", "BEVEL")
        border.width, border.segments = bevel, 1
    obj.data.materials.append(mat)
    pieces.append(obj)


def terrain(name, vertices, faces, colours):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x,-z,y) for x,y,z in vertices], [], faces)
    data.update()
    layer = data.color_attributes.new(name="Terrain tint", type="BYTE_COLOR", domain="POINT")
    for point, rgb in zip(layer.data, colours):
        point.color = (*rgb,1)
    uv = data.uv_layers.new(name="Ground in metres")
    for loop in data.loops:
        x,y,z = vertices[loop.vertex_index]
        uv.data[loop.index].uv = (x/2.15,(z+y*.39)/2.15)
    pieces.append(place(name,data,turf))


def patch(x,z,r):
    drift=.19*sin(1.12*x+z*.90)+.13*cos(1.82*z-x*.63)+rng.uniform(-.12,.12)
    dry=max(0,(r-7.6)/2.4)
    return (.118+.062*drift+.031*dry, .177+.095*drift+.010*dry, .086+.061*drift-.011*dry)


# A shallow mesh with colours gives the walk a varied ground plane and leaves
# the whole authoritative creation rectangle available. The cliff bands sit
# just beyond the older slope and carry darker stone down toward the water.
rings, segments = (1.2,2.3,3.5,4.6,5.7,6.8,7.9,8.9,9.62,10.035), 48
points, faces, colours = [(22,.093,0)], [], [patch(22,0,0)]
for ring, radius in enumerate(rings):
    for i in range(segments):
        t=i*tau/segments
        r=radius if ring==len(rings)-1 else radius+rng.uniform(-.263,.263)
        x,z=22+r*cos(t),r*sin(t)
        points.append((x,.094+.003*sin(x*1.62-z*1.2),z))
        colours.append(patch(x,z,r))
for i in range(segments):
    following=(i+1)%segments
    faces.append((0,1+following,1+i))
for layer in range(len(rings)-1):
    for i in range(segments):
        a=1+layer*segments+i
        b=1+layer*segments+(i+1)%segments
        faces.extend(((a,b,a+segments),(b,b+segments,a+segments)))
terrain("Textured meadow over the east island",points,faces,colours)

points, faces, colours = [], [], []
for band,(radius,y,variance) in enumerate(((10.035,.092,0),(10.10,-.23,.05),(9.93,-.63,.09),
    (10.09,-1.05,.13),(9.78,-1.9,.15),(9.39,-2.86,.16),(8.75,-3.65,.18),
    (8.27,-4.74,.18),(7.91,-6.1,.27))):
    for i in range(segments):
        t=i*tau/segments
        jitter=sin(i*1.74+band*.76)+.34*cos(i*3.98+band)
        r=radius+jitter*variance
        x,z=22+r*cos(t),r*sin(t)
        points.append((x,y+jitter*variance*.84,z))
        colours.append(patch(x,z,10) if band==0 else
                       (.087+.025*jitter,.104+.028*jitter,.098+.024*jitter))
for band in range(8):
    for i in range(segments):
        a,b=band*segments+i,band*segments+(i+1)%segments
        faces.extend(((a,b,a+segments),(b,b+segments,a+segments)))
terrain("Stratified east shore above the wave line",points,faces,colours)

# The bridge already reaches x=12.7. Flared paving and a south walk keep
# circulation clear of the active target discs and the author's game node.
for col in range(17):
    x=12.81+col*.58
    z=.04+min(1.54,col*.139)
    rows=4 if col<6 else 3
    for row in range(rows):
        box("Sandstone east flag",x,.101,z+(row-(rows-1)/2)*.58,
            (.566,.024,.564),rng.choice(stone),.007)
for col in range(14):
    z=1.94+col*.414
    for row in range(3):
        box("Flags toward the sea arbor",22.39+row*.562,.102,z,
            (.545,.024,.395),rng.choice(stone),.007)

# Furniture and solid planting beds stay outside |z|<=6. The play node at
# (22,4), its targets and the wider empty creator field remain unobstructed.
box("South arbor lime base",24.05,.104,7.25,(2.93,.026,1.81),stone[1],.012)
box("South oak bench basalt base",24.05,.261,7.79,(2.44,.328,.38),basalt,.026)
for z in (7.65,7.79,7.93):
    box("South bench oak slat",24.05,.457,z,(2.57,.064,.116),oak,.012)
for x in (22.72,25.38):
    for z in (6.65,7.83):
        box("South arbor basalt post shoe",x,.231,z,(.221,.255,.22),basalt,.014)
        box("South arbor oak column",x,1.295,z,(.14,2.12,.155),oak,.015)
    box("South arbor oak lintel",x,2.374,7.24,(.17,.15,1.5),oak,.015)
for z in (6.55,6.85,7.16,7.47,7.78,8.08):
    box("South arbor joist",24.05,2.491,z,(2.9,.122,.112),oak,.013)
for z in (6.53,8.1):
    box("Bronze arbor eaves edge",24.05,2.547,z,(2.92,.029,.036),bronze,.006)
for x in (19.35,22.15,24.95):
    for z in (-6.76,-7.43):
        box("North herb bed basalt sides",x,.225,z,(1.70,.255,.135),basalt,.016)
    for delta in (-.78,.78):
        box("North herb bed basalt ends",x+delta,.225,-7.097,(.135,.255,.55),basalt,.016)
    box("North herb bed loam",x,.202,-7.096,(1.45,.22,.52),loam)

wood, leaves = PlantMesh(), PlantMesh()
for x, z, size, flip, seed in ((16.5,-6.83,1.36,1,91),(22.02,-8.5,1.22,-1,52),
                               (27.76,-6.49,1.10,-1,84),(18.42,7.55,1.14,1,713),
                               (27.80,6.54,1.04,1,719)):
    bay(wood,leaves,x,z,size,flip,seed)
for index in range(30):
    side = -1 if index<18 else 1
    x=rng.uniform(17,27)
    z=side*rng.uniform(7.2,8.95)
    if hypot(x-22,z)<9.5 and not (side>0 and 22.40<x<26):
        shrub(leaves,x,z,.31+rng.uniform(0,.29),seed=617+index)
for bed in (19.35,22.15,24.95):
    for delta in (-.52,-.25,.04,.35,.54):
        shrub(leaves,bed+delta,-7.045,.19,219+int(delta*100))

atlas_path=output/"east-garden-atlas.png"
atlas=foliage_atlas(atlas_path)
image=bpy.data.images.load(str(atlas_path))
image.pack()
atlas_path.unlink()
bark=finish("Salt-weathered bark",(.197,.132,.087),.92)
foliage=finish("Layered coastal foliage",(.22,.3,.17),.87)
shader=foliage.node_tree.nodes.get("Principled BSDF")
tex=foliage.node_tree.nodes.new("ShaderNodeTexImage")
tex.image=image
foliage.node_tree.links.new(tex.outputs["Color"],shader.inputs["Base Color"])
foliage.node_tree.links.new(tex.outputs["Alpha"],shader.inputs["Alpha"])
branches=place("Bay branches",wood.blender_mesh("Wind-shaped branches"),bark)
leaves_obj=place("Bays and herbs",leaves.blender_mesh("Bays and herbs"),foliage)

bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(output/"east-garden.blend"),compress=True)
# glTF multiplies the diffuse texture by COLOR_0 on the meadow material.
links.new(texture.outputs["Color"], turf.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
bpy.ops.object.select_all(action="DESELECT")
for item in pieces:
    item.select_set(True)
bpy.context.view_layer.objects.active=pieces[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
assert not pieces[0].data.validate(verbose=True)
stage=output/"east-garden-surface.glb"
bpy.ops.export_scene.gltf(filepath=str(stage),export_format="GLB",use_selection=True,
                          export_cameras=False,export_lights=False,export_vertex_color="ACTIVE")
doc, blob=parse_glb(stage.read_bytes())
stage.unlink()
for primitive in doc["meshes"][0]["primitives"]:
    mat = doc["materials"][primitive["material"]]
    if mat["name"]!="Coastal meadow":
        primitive["attributes"].pop("COLOR_0",None)
    else:
        assert "COLOR_0" in primitive["attributes"] and "baseColorTexture" in mat["pbrMetallicRoughness"]
bark_mat, leaf_mat=pack_plant_materials(doc,blob,atlas)
parts=[pack_plant_mesh(doc,blob,obj.data,mat,use_uv) for obj,mat,use_uv in (
    (branches,bark_mat,False),(leaves_obj,leaf_mat,True))]
doc["meshes"].append({"name":"East garden bays and herbs","primitives":parts})
doc["nodes"].append({"name":"East garden bays and herbs","mesh":len(doc["meshes"])-1})
doc["scenes"][doc["scene"]]["nodes"].append(len(doc["nodes"])-1)
(output/"east-garden.glb").write_bytes(pack_glb(doc,blob))
