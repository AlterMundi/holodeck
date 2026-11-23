"""Author the North Mirador and retire its stock ring and stone disk."""
from hashlib import sha256
from math import cos, pi, sin, sqrt
from pathlib import Path
from random import Random
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coastal_water import pack_glb, parse_glb

args = sys.argv[sys.argv.index("--") + 1:]
output, surroundings = map(Path, args)
output.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"

rng = Random(901)
pieces = []


def finish(name, colour, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


stone = [finish("Dressed limestone " + name, c, .78) for name, c in
         (("sand", (.46,.377,.265)), ("chalk", (.55,.487,.368)),
          ("oyster", (.46,.44,.382)), ("warm", (.51,.428,.301)))]
basalt = finish("Split basalt plinth", (.073,.10,.099), .88)
oak = finish("Weathered oak seat", (.242,.132,.062), .76)
bronze = finish("Brushed bronze edge", (.48,.285,.103), .38, .56)
copper = finish("Patinated mirador copper", (.065,.188,.163), .48, .48)


def box(name, x, y, z, w, h, d, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,-z,y))
    obj = bpy.context.object
    obj.name, obj.dimensions = name, (w,d,h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        border = obj.modifiers.new("Dressed edges", "BEVEL")
        border.width, border.segments = bevel, 1
    obj.data.materials.append(mat)
    pieces.append(obj)


def mesh(name, vertices, faces, mat):
    item = bpy.data.meshes.new(name)
    item.from_pydata([(x,-z,y) for x,y,z in vertices], [], faces)
    item.update()
    obj = bpy.data.objects.new(name, item)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    pieces.append(obj)


# North tip of the shared bridge is at z=-14.295 when raised. The flags
# start on the existing island at z=-14.27, away from the moving deck.
for row in range(10):
    z = -14.54 - .51 * row
    wide = min(2.75, sqrt(4.60**2 - (z+17)**2) - .18)
    widths = [rng.uniform(.48,.74) for _ in range(10)]
    pitch = 2 * wide / sum(widths)
    x = -wide
    for n, raw in enumerate(widths):
        w = raw * pitch
        box("Dressed flagstone on the Mirador", x+w/2,.090,z,w-.016,.027,.494,
            stone[(row + n + rng.randrange(3))%4], .007)
        x += w
for side in (-1,1):
    for n in range(10):
        box("Bronze fillet on east or west walkway seam", side*1.377,.105,-14.54-.51*n,
            .019,.006,.492,bronze)
    for n in range(4):
        box("Basalt seat wall", side*2.32,.281,-17.13-.457*n,.52,.365,.441,basalt,.023)
    for n in range(3):
        box("Weathered oak sitting ledge", side*(2.32+.16*(n-1)),.488,-17.815,
            .14,.065,1.825,oak,.017)

# Two battered limestone piers support a shallow segmented bronze arch
# across the sea view. The central sightline remains open.
for side in (-1,1):
    x=side*1.90
    box("Basalt pier base",x,.265,-19,.61,.33,.69,basalt,.023)
    for i in range(6):
        shift = side*(.018*i)
        box("Limestone pier course",x+shift,.585+.285*i,-19,
            .545-.041*i,.274,.51-.022*i,stone[(i+1)%4],.015)
    box("Limestone impost",x+side*.09,2.188,-19,.54,.14,.55,stone[1],.022)
    box("Bronze foot of arch",x+side*.09,2.274,-19,.43,.035,.48,bronze,.008)


def arch_band(name, inner, outer, face_z, depth, mat):
    vertices=[]
    for i in range(23):
        t=pi*i/22
        for radius in (inner,outer):
            x=radius*cos(t)
            y=2.291 + (radius/2.00)*.79*sin(t)
            vertices.extend(((x,y,face_z-depth/2),(x,y,face_z+depth/2)))
    faces=[]
    for i in range(22):
        a=i*4
        b=a+4
        faces.extend(((a,b,b+2,a+2),(a+1,a+3,b+3,b+1),(a,a+1,b+1,b),(a+2,b+2,b+3,a+3)))
    faces.extend(((0,2,3,1),(88,89,91,90)))
    mesh(name,vertices,faces,mat)


arch_band("Segmented seaward copper frame",1.79,2.14,-19,.37,copper)
arch_band("Seaward arch narrow bronze fillet",2.106,2.139,-18.799,.039,bronze)
arch_band("Inside edge of arch",1.793,1.818,-18.806,.043,bronze)
box("Crown cover plate",0,3.151,-19,.224,.055,.438,bronze,.011)

# Normalize mesh normals before baking joined, material-batched output.
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / "mirador.blend"), compress=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in pieces:
    obj.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
pieces[0].name = "North Mirador paving, seats and seaward frame"
assert not pieces[0].data.validate(verbose=True), "Invalid merged Mirador mesh"
bpy.ops.export_scene.gltf(filepath=str(output/"mirador.glb"), export_format="GLB",
                         use_selection=True, export_cameras=False, export_lights=False)

# Filter the exact old scenery, retaining everything outside the old north
# structure. Untouched meshes, textures, sampler settings and water UVs stay
# byte-identical. The old file remains in Git and in the receiving rollback.
original=surroundings.read_bytes()
assert sha256(original).hexdigest()=="694d83c8ba05d59b062fa7cf0f816461ddb9f8bdff3609549f0f932fa28f69b0"
doc, blob = parse_glb(original)
removed={}
for primitive in doc["meshes"][0]["primitives"]:
    name=doc["materials"][primitive["material"]]["name"]
    if name not in ("stone","copper","gold"):
        continue
    assert "indices" not in primitive
    accessors = [doc["accessors"][index] for index in primitive["attributes"].values()]
    assert all(acc["type"]=="VEC3" and acc["componentType"]==5126 for acc in accessors)
    def buffer(acc):
        view=doc["bufferViews"][acc["bufferView"]]
        assert "byteStride" not in view and view["byteLength"]==acc["count"]*12
        return np.frombuffer(blob, "<f4", acc["count"]*3,
                             view.get("byteOffset",0)+acc.get("byteOffset",0)).reshape(-1,3,3)
    points=buffer(doc["accessors"][primitive["attributes"]["POSITION"]])
    west_clear=np.abs(points[:,:,0])<3.26
    north=(points[:,:,2]>-20.21)&(points[:,:,2]<-13.79)
    kill=np.all(west_clear&north,axis=1)
    removed[name]=int(kill.sum())
    for acc in accessors:
        values=buffer(acc)
        kept=values[~kill].reshape(-1,3)
        values[:]=0
        values.reshape(-1,3)[:len(kept)]=kept
        acc["count"]=len(kept)
        if "min" in acc:
            acc["min"],acc["max"]=kept.min(axis=0).tolist(),kept.max(axis=0).tolist()
assert removed=={"stone":160,"copper":384,"gold":320},removed
(output/"island-scenery-atelier.glb").write_bytes(pack_glb(doc,blob))
