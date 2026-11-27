"""Export residencia.blend to a shared 3D Viewer scene (mm, one part per object).

    blender -b OUT/residencia.blend --python-exit-code 9 --python art/residencia-nobleza/export_viewer.py -- OUT/scene.json REVISION
"""
import json
import re
import sys
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
out, revision = Path(args[0]), args[1]
COLORS = {  # representative display colour of each finish on the texture sheet
    "Mármol marfil envejecido": "#e9e2d2", "Oro champagne": "#d3b273", "Filigrana de oro": "#b98d3e",
    "Bronce oxidado": "#6d5136", "Aleación de titanio": "#9da1a6", "Tejas de metal teal": "#3a7f8a",
    "Conectores de éter": "#3fdcff", "Ventanal cálido": "#ffb565", "Vidrio de ojo de buey": "#1c2c3a",
    "Cortinado teal bordado": "#1d5a5e", "Piedra del camino": "#55534f", "Núcleo de la esfera armilar": "#ffd27a",
}
dg = bpy.context.evaluated_depsgraph_get()
parts, used, tris = [], set(), 0
for o in sorted((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: (o.users_collection[0].name, o.name)):
    me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles()
    M = o.matrix_world
    verts = [[round(c * 1000, 1) for c in (M @ v.co)] for v in me.vertices]
    faces = [list(t.vertices) for t in me.loop_triangles]
    pid = re.sub(r"[^a-z0-9]+", "-", o.name.lower().encode("ascii", "ignore").decode()).strip("-") or "part"
    while pid in used:
        pid += "-x"
    used.add(pid)
    mat = o.data.materials[0].name if o.data.materials else ""
    parts.append({"id": pid, "label": f"{o.users_collection[0].name} · {o.name}", "color": COLORS.get(mat, "#cccccc"),
                  "vertices": verts, "faces": faces})
    tris += len(faces)
    o.evaluated_get(dg).to_mesh_clear()
xs = [v[0] for p in parts for v in p["vertices"]]
zs = [v[2] for p in parts for v in p["vertices"]]
scene = {
    "id": "residencia-estructura", "units": "mm",
    "title": f"Residencia de la Nobleza IA · estructura {revision}",
    "note": "Planta completa, alzados y elementos exteriores modelados desde las tres láminas de Nicolás. "
            "Sin mobiliario interior. Los colores son el tono representativo de cada acabado; "
            "las texturas procedurales están en el Blender.",
    "scope": "Borrador de estructura y fachada; interiores vacíos para equipar después.",
    "status": f"Borrador {revision} · Ø {round((max(xs) - min(xs)) / 1000)} m con torreones · altura {round(max(zs) / 1000)} m",
    "dimensions": {"Diámetro del muro": "52 m", "Altura total": f"{max(zs) / 1000:.1f} m", "Triángulos": str(tris)},
    "parts": parts,
}
out.write_text(json.dumps(scene, separators=(",", ":"), ensure_ascii=False))
print("SCENE", {"parts": len(parts), "triangles": tris, "bytes": out.stat().st_size})
