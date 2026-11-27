"""Export residencia.blend for the Holodeck toroidal world.

    blender -b OUT/residencia.blend --python-exit-code 9 --python art/residencia-nobleza/export_holodeck.py -- OUT_DIR

Writes OUT_DIR/residencia.glb (visual, one mesh per finish, glTF PBR factors) and
OUT_DIR/residencia-colision.glb (one solid mesh: walls, columns, towers, portal,
chamber thresholds, roof and dome). Floors, podium and stairs are carried by the
graded terrain, so they are not part of the collision shell. The review
environment, path and Blender lights are left out. Metres; glTF Y up, the
entrance faces +Z.
"""
import json
import sys
from pathlib import Path

import bpy

out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
out.mkdir(parents=True, exist_ok=True)
FINISH = {  # base colour (sRGB hex), metallic, roughness, emissive strength
    "Mármol marfil envejecido": ("#e6dfcf", 0.0, 0.42, 0), "Oro champagne": ("#d6b574", 1.0, 0.28, 0),
    "Filigrana de oro": ("#bb8f40", 1.0, 0.36, 0), "Bronce oxidado": ("#6a5036", 0.8, 0.55, 0),
    "Aleación de titanio": ("#a2a6ab", 1.0, 0.32, 0), "Tejas de metal teal": ("#2f7682", 0.85, 0.3, 0),
    "Conectores de éter": ("#3fdcff", 0.0, 0.4, 6), "Ventanal cálido": ("#ffb565", 0.0, 0.5, 3),
    "Vidrio de ojo de buey": ("#1c2c3a", 0.0, 0.1, 0), "Cortinado teal bordado": ("#1a5458", 0.0, 0.85, 0),
    "Núcleo de la esfera armilar": ("#ffd27a", 0.0, 0.4, 8), "Umbral de portal": ("#2aa6d0", 0.0, 0.4, 2.5),
    "Panel teal oscuro": ("#123238", 0.9, 0.4, 0),
}
DROP_COLLECTIONS = {"Entorno", "Iluminación"}
NO_COLLISION = {"Podio", "Piso interior", "Incrustaciones de oro", "Escalinata", "Atrio semicircular",
                "Taraceas del corredor", "Anillos de éter del núcleo", "Circuitos emisivos", "Panel de circuitos del portal",
                "Glifo de éter del portal", "Cortinados", "Bordados de oro", "Ventanales góticos", "Marcos góticos",
                "Tracería de ventanales", "Ventanas del tambor", "Ventanas de la linterna", "Ojos de buey",
                "Friso de filigrana", "Capiteles y cornisa interior", "Anillo de éter y estrella", "Núcleo luminoso",
                "Esfera armilar", "Armilares de los torreones", "Armilares de los pedestales", "Orbes de los pilares",
                "Nervaduras de oro", "Anillos de oro de la cúpula", "Rejillas de ventilación", "Umbrales de puertos de tránsito",
                "Arcos de puertos de tránsito", "Rosetón", "Arco del portal", "Balaustrada", "Balaustrada del tambor",
                "Anillos de bronce de torreones", "Capiteles", "Cúpulas de torreones", "Linterna", "Marcos de puerta"}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


for o in [o for o in bpy.data.objects if o.type == "LIGHT" or any(c.name in DROP_COLLECTIONS for c in o.users_collection)]:
    bpy.data.objects.remove(o)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
collision_meshes = {}
for o in meshes:  # bake modifiers/instances, apply transforms
    o.data = o.data.copy()
    if "holodeck_collision_y" in o:
        # Preserve the structural collision plane beneath the visual cladding.
        matrix = o.matrix_world.copy()
        matrix.translation.y = o["holodeck_collision_y"]
        collision_mesh = o.data.copy()
        collision_mesh.transform(matrix)
        collision_meshes[o.name] = collision_mesh
    o.data.transform(o.matrix_world); o.matrix_world.identity()

# simple glTF materials, one per finish
plain = {}
for name, (hexc, metal, rough, emit) in FINISH.items():
    m = bpy.data.materials.new(name + " · glTF"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    rgb = [srgb_to_linear(int(hexc[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value, b.inputs["Roughness"].default_value = metal, rough
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1); b.inputs["Emission Strength"].default_value = emit
    m.use_backface_culling = False
    plain[name] = m

collide = [o for o in meshes if o.name not in NO_COLLISION and not o.name.startswith("Marco de puerta")]
coll_me = bpy.data.meshes.new("Residencia colisión")
import bmesh  # noqa: E402
bm = bmesh.new()
for o in collide:
    bm.from_mesh(collision_meshes.get(o.name, o.data))
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(coll_me); bm.free()
coll_me.materials.clear()
coll_ob = bpy.data.objects.new("Residencia colisión", coll_me)

groups = {}
for o in meshes:
    mat = o.data.materials[0].name if o.data.materials else "Mármol marfil envejecido"
    groups.setdefault(mat, []).append(o)
visual = []
for mat, objs in groups.items():
    me = bpy.data.meshes.new("Residencia · " + mat)
    bm = bmesh.new()
    for o in objs:
        bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(plain.get(mat, plain["Mármol marfil envejecido"]))
    ob = bpy.data.objects.new("Residencia · " + mat, me)
    visual.append(ob)
portals = [{"id": o["holodeck_portal"], "role": o["holodeck_role"],
            "centre": [round(c, 3) for c in (sum((v.co for v in o.data.vertices), o.data.vertices[0].co * 0) / len(o.data.vertices))]}
           for o in meshes if "holodeck_portal" in o]
for o in meshes:
    bpy.data.objects.remove(o)
scene = bpy.context.scene
for c in list(scene.collection.children):
    scene.collection.children.unlink(c)


def export(objs, path):
    for o in list(scene.collection.objects):
        scene.collection.objects.unlink(o)
    for o in objs:
        scene.collection.objects.link(o)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True, export_apply=True,
                              export_lights=False, export_cameras=False, export_materials="EXPORT",
                              export_normals=True, export_texcoords=False,
                              export_meshopt_compression_enable=True, export_meshopt_extension="EXT_meshopt_compression")


export(visual, out / "residencia.glb")
export([coll_ob], out / "residencia-colision.glb")
summary = {"visual_meshes": len(visual), "visual_triangles": sum(len(o.data.polygons) for o in visual),
           "collision_triangles": len(coll_me.polygons),
           "visual_bytes": (out / "residencia.glb").stat().st_size,
           "collision_bytes": (out / "residencia-colision.glb").stat().st_size,
           # Blender (x, y, z) -> glTF (x, z, -y)
           "portals": [{**p, "gltf": [p["centre"][0], p["centre"][2], -p["centre"][1]]} for p in portals]}
(out / "residencia-holodeck.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
print("HOLODECK", json.dumps({k: v for k, v in summary.items() if k != "portals"}), "portals", len(portals))
