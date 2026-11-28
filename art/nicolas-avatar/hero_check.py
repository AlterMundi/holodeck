"""Validate, render and export the hero rig candidate.

    blender -b <explorer-hero.blend> --python-exit-code 9 \
        --python art/nicolas-avatar/hero_check.py -- <out-dir> <v27-rest.json> [--no-render]

Writes <out-dir>/report.json, contact sheets and explorer-hero.glb. The GLB
holds only the stock deform joints: the hero clips are baked onto them and
the control armature and constraints are dropped from the in-memory session.
The blend on disk is not modified. Exits non-zero when a check fails.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

args = sys.argv[sys.argv.index("--") + 1:]
out, v27 = Path(args[0]).resolve(), json.loads(Path(args[1]).read_text())
render = "--no-render" not in args
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
deform = bpy.data.objects["SK_BodyA_ArmsHeadless_01"]
rig = bpy.data.objects["Explorer hero rig"]
dp = deform.pose.bones
report = {"checks": {}, "clips": {}}
fails = []


def check(name, ok, value):
    report["checks"][name] = {"ok": bool(ok), "value": value}
    if not ok:
        fails.append(name)


# 1. interface: names, parents, rest identical to v27
bones = {b.name: b for b in deform.data.bones}
check("joint_count", len(bones) == 87 == len(v27), len(bones))
check("joint_names_parents", all(n in bones and (bones[n].parent.name if bones[n].parent else None) == p
                                 for n, (p, _) in v27.items()), "names and parents vs v27")
rest_err = max(max(abs(a - b) for a, b in zip(sum(map(list, bones[n].matrix_local), []), m))
               for n, (_, m) in v27.items())
check("rest_matrix_vs_v27", rest_err < 1e-6, rest_err)
check("deform_has_no_actions", not (deform.animation_data and deform.animation_data.action), "deform unkeyed")
face = [o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys]
check("jawOpen_kept", any("jawOpen" in o.data.shape_keys.key_blocks for o in face), [o.name for o in face])

# 2. rest with controls at identity reproduces stock rest
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.location, pb.rotation_quaternion = (0, 0, 0), (1, 0, 0, 0)
bpy.context.view_layer.update()
err = max((dp[n].matrix.translation - bones[n].matrix_local.translation).length for n in bones)
check("controls_at_rest_reproduce_rest_m", err < 1e-4, err)

# 3. per-frame motion checks
boots = bpy.data.objects["Trousers and boots"]
# The fist is the gloved sleeve plus the jointed hands (sheet_refine.py), when present.
gloves = [o for o in (bpy.data.objects.get("Sleeves, armour and gloves"), bpy.data.objects.get("Fingered hands")) if o]
tips = {f"hand_{s}": f"hero_hand_ik_{s}" for s in "lr"} | {f"foot_{s}": f"hero_foot_ik_{s}" for s in "lr"}
baked = {}
TWIST = list(deform.get("hero_twist", []))


def distribute_twist():
    """Give the stock forearm twist joints their share of the hand's roll about the forearm axis."""
    if not TWIST:
        return
    for s in "lr":
        for n in (f"lowerarm_twist_01_{s}", f"lowerarm_twist_02_{s}"):
            dp[n].rotation_mode = "QUATERNION"; dp[n].rotation_quaternion = (1, 0, 0, 0)
    bpy.context.view_layer.update()
    db = deform.data.bones
    for s in "lr":
        a = (db[f"hand_{s}"].head_local - db[f"lowerarm_{s}"].head_local).normalized()
        qc = dp[f"hand_{s}"].matrix.to_quaternion() @ db[f"hand_{s}"].matrix_local.to_quaternion().inverted()
        qp = dp[f"lowerarm_{s}"].matrix.to_quaternion() @ db[f"lowerarm_{s}"].matrix_local.to_quaternion().inverted()
        q = qp.inverted() @ qc
        if q.w < 0:
            q = -q
        # measured sign convention: the twist joint turns opposite to this delta (v29 qualification)
        t = -2 * math.atan2(Vector(q[1:]).dot(a), q.w)
        for n, k in zip((f"lowerarm_twist_01_{s}", f"lowerarm_twist_02_{s}"), TWIST):
            axis = db[n].matrix_local.to_quaternion().inverted() @ a
            dp[n].rotation_quaternion = Quaternion(axis, k * t)
    bpy.context.view_layer.update()


if TWIST:
    bpy.app.handlers.frame_change_post.append(lambda *_: distribute_twist())


def lowest(obj):
    if isinstance(obj, list):
        return min(lowest(o) for o in obj)
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    z = min((obj.matrix_world @ v.co).z for v in me.vertices)
    ev.to_mesh_clear()
    return z


for act in [a for a in bpy.data.actions if a.name.startswith("hero_")]:
    rig.animation_data.action = act
    f0, f1 = map(int, act.frame_range)
    rows, frames = [], {}
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        distribute_twist()
        frames[f] = {n: dp[n].matrix.copy() for n in bones}
        ik = {lo: (dp[lo].head - rig.pose.bones[t].head).length for lo, t in tips.items()}
        rows.append({"frame": f, "knee_l_z": dp["calf_l"].head.z, "ik_m": ik, "feet": {s: dp[f"foot_{s}"].head.copy() for s in "lr"},
                     "knee_r_z": dp["calf_r"].head.z, "hand_r_z": lowest(gloves),
                     "boot_min_z": lowest(boots)})
    baked[act.name] = frames
    c = {"frames": [f0, f1], "loop": bool(act.get("holodeck_loop"))}
    # contacts must be exact: both feet always, the right fist while the landing holds
    contact = [r["ik_m"][lo] for r in rows for lo in tips
               if lo.startswith("foot") or (act.name == "hero_landing" and lo == "hand_r" and 9 <= r["frame"] <= 30)]
    c["ik_residual_max_m"] = max(contact)
    c["ik_residual_any_limb_max_m"] = max(r["ik_m"][lo] for r in rows for lo in tips)
    c["min_z_frame"] = min(rows, key=lambda r: r["boot_min_z"])["frame"]
    c["boot_min_z_m"] = min(r["boot_min_z"] for r in rows)
    if c["loop"]:
        c["foot_drift_max_m"] = max((r["feet"][s] - rows[0]["feet"][s]).length for r in rows for s in "lr")
        c["loop_seam_m"] = max((frames[f0][n].translation - frames[f1][n].translation).length for n in bones)
        check(f"{act.name}:feet_planted", c["foot_drift_max_m"] < 1e-3, c["foot_drift_max_m"])
        check(f"{act.name}:loop_seam", c["loop_seam_m"] < 1e-4, c["loop_seam_m"])
    else:
        hold = [r for r in rows if 9 <= r["frame"] <= 30]
        c["hold_knee_r_z_max_m"] = max(r["knee_r_z"] for r in hold)
        c["hold_glove_min_z_max_m"] = max(r["hand_r_z"] for r in hold)
        check(f"{act.name}:knee_down", c["hold_knee_r_z_max_m"] < 0.10, c["hold_knee_r_z_max_m"])
        check(f"{act.name}:fist_down", -0.01 < c["hold_glove_min_z_max_m"] < 0.03, c["hold_glove_min_z_max_m"])
    check(f"{act.name}:ik_reached", c["ik_residual_max_m"] < 2e-3, c["ik_residual_max_m"])
    check(f"{act.name}:no_floor_sink", c["boot_min_z_m"] > -0.02, c["boot_min_z_m"])
    check(f"{act.name}:in_place_root", all(frames[f]["root"].translation.length < 1e-6 for f in frames), "root fixed")
    report["clips"][act.name] = c
    print("CLIP", act.name, json.dumps(c))

# 4. contact sheets from the editable rig
if render:
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.device = 24, "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 420, 560
    world = bpy.data.worlds.new("Hero review")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1)
    scene.world = world
    floor = bpy.data.objects.new("Review floor", bpy.data.meshes.new("Review floor"))
    floor.data.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    scene.collection.objects.link(floor)
    for name, loc, energy in (("Key", (-2, -3, 3), 400), ("Fill", (3, -2, 1.5), 120), ("Rim", (0, 3, 2.5), 300)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        light.data.energy, light.data.size = energy, 2.0
        light.location = loc
        light.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(light)
    cam = bpy.data.objects.new("Hero cam", bpy.data.cameras.new("Hero cam"))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam
    rig.hide_render = True
    shots = []
    for act_name, picks in (("hero_idle", (1, 16, 46)), ("hero_landing", (5, 20, 40, 52))):
        rig.animation_data.action = bpy.data.actions[act_name]
        for f in picks:
            for yaw in (25, -70):
                a = math.radians(yaw)
                cam.location = (3.6 * math.sin(a), -3.6 * math.cos(a), 1.05)
                cam.rotation_euler = (Vector((0, 0, 0.85)) - cam.location).to_track_quat("-Z", "Y").to_euler()
                scene.frame_set(f)
                p = out / f"{act_name}-{f:02d}-{yaw}.png"
                scene.render.filepath = str(p)
                bpy.ops.render.render(write_still=True)
                shots.append(p)
    for act_name in ("hero_idle", "hero_landing"):
        mine = sorted(p for p in shots if p.name.startswith(act_name + "-"))
        subprocess.run(["magick", *map(str, mine), "+append", str(out / f"sheet-{act_name}.png")], check=True)
    report["sheets"] = [f"sheet-{a}.png" for a in ("hero_idle", "hero_landing")]

# 5. bake onto the stock joints, drop controls, export
for o in [o for o in bpy.data.objects if o.name == "Review floor" or o.name == "Hero cam" or o.type == "LIGHT"]:
    bpy.data.objects.remove(o)
bpy.app.handlers.frame_change_post.clear()
TWIST = []
rig.animation_data.action = None
for pb in dp:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
bpy.data.objects.remove(rig)
deform.animation_data_create()
for name, frames in baked.items():
    act = bpy.data.actions.new(name)
    deform.animation_data.action = act
    for f, mats in frames.items():
        for n, b in bones.items():
            pb = dp[n]
            pb.rotation_mode = "QUATERNION"
            if b.parent:
                rel = b.parent.matrix_local.inverted() @ b.matrix_local
                basis = rel.inverted() @ mats[b.parent.name].inverted() @ mats[n]
            else:
                basis = b.matrix_local.inverted() @ mats[n]
            loc, rot, _ = basis.decompose()
            pb.location, pb.rotation_quaternion = loc, rot
            pb.keyframe_insert("location", frame=f, group=n)
            pb.keyframe_insert("rotation_quaternion", frame=f, group=n)
    deform.animation_data.action = None
    track = deform.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, frames and min(frames), act)
for pb in dp:
    pb.location, pb.rotation_quaternion = (0, 0, 0), (1, 0, 0, 0)
# baked pose round trip: re-evaluate the baked hold frame against the rig's frame
scene.frame_set(20)
track = deform.animation_data.nla_tracks["hero_landing"]
deform.animation_data.action = bpy.data.actions["hero_landing"]
scene.frame_set(20)
bake_err = max((dp[n].matrix.translation - baked["hero_landing"][20][n].translation).length for n in bones)
check("bake_round_trip_m", bake_err < 1e-4, bake_err)
deform.animation_data.action = None
scene.frame_set(1)

meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == deform]
for parts, name in (([o for o in meshes if o.data.shape_keys], "Explorer face"),
                    ([o for o in meshes if not o.data.shape_keys], "Explorer body")):
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts[0].name = parts[0].data.name = name
glb = out / "explorer-hero.glb"
bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_yup=True, export_skins=True,
                          export_morph=True, export_image_format="AUTO", export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_force_sampling=True)
report["glb"] = {"path": glb.name, "bytes": glb.stat().st_size}
report["failed"] = fails
(out / "report.json").write_text(json.dumps(report, indent=2, default=float))
print("HEROCHECK", "FAIL" if fails else "PASS", fails, glb.stat().st_size)
sys.exit(1 if fails else 0)
