"""Add a new hero control rig and new hero clips to a copy of the explorer.

    blender -b <v27 explorer-blockout.blend> --python-exit-code 9 \
        --python art/nicolas-avatar/hero_rig.py -- <out.blend>

The stock 87-joint deform armature stays the Holodeck interface: no bone is
added, removed, renamed, reparented or moved in rest. A separate armature
object, "Explorer hero rig", carries the controls. The deform bones follow it
through pose constraints only: IK for arms and legs (with poles), world copy
rotation for hands and feet, local copy transforms for pelvis, spine, neck,
head, clavicles and fingers. The clips are authored here from scratch on the
controls (no stock or MML clip is read). The input blend is never written.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
out = Path(ARGS[0]).resolve()
# v29 options (defaults reproduce v28 exactly)
HAND_L_ROLL = float(ARGS[ARGS.index("--hand-l-roll") + 1]) if "--hand-l-roll" in ARGS else 0.0
TWIST = "--twist" in ARGS
out.parent.mkdir(parents=True, exist_ok=True)
assert not bpy.data.actions, "v27 is expected to carry no animation"

deform = bpy.data.objects["SK_BodyA_ArmsHeadless_01"]
assert len(deform.data.bones) == 87
assert deform.matrix_world == Matrix.Identity(4)
SIDES = ("l", "r")
FINGERS = [f"{f}_{i:02d}" for f in ("thumb", "index", "middle", "ring", "pinky") for i in (1, 2, 3)]
FK = ["pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "spine_05", "neck_01", "neck_02", "head",
      *[f"clavicle_{s}" for s in SIDES], *[f"ball_{s}" for s in SIDES], *[f"{f}_{s}" for f in FINGERS for s in SIDES]]

# ---------------------------------------------------------------- control rig
rig = bpy.data.objects.new("Explorer hero rig", bpy.data.armatures.new("Explorer hero rig"))
bpy.context.scene.collection.objects.link(rig)
rig.show_in_front = True
rig.data.display_type = "STICK"
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = rig.data.edit_bones
rest = {b.name: b.matrix_local.copy() for b in deform.data.bones}
length = {b.name: b.length for b in deform.data.bones}


def bone(name, head, tail, parent=None, roll=0.0):
    b = eb.new(name)
    b.head, b.tail, b.roll = Vector(head), Vector(tail), roll
    b.parent = eb[parent] if parent else None
    b.use_deform = False
    return b


def twin(src, name, parent):
    """Control bone with exactly the deform bone's rest matrix and length."""
    b = eb.new(name)
    b.length = length[src]
    b.matrix = rest[src]
    b.parent = eb[parent] if parent else None
    b.use_deform = False
    return b


bone("hero_root", (0, 0, 0), (0, 0.35, 0))
twin("pelvis", "hero_pelvis", "hero_root")
chain = ["pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "spine_05", "neck_01", "neck_02", "head"]
for parent, child in zip(chain, chain[1:]):
    twin(child, f"hero_{child}", f"hero_{parent}")
for s in SIDES:
    twin(f"clavicle_{s}", f"hero_clavicle_{s}", "hero_spine_05")
    twin(f"hand_{s}", f"hero_hand_ik_{s}", "hero_root")
    twin(f"foot_{s}", f"hero_foot_ik_{s}", "hero_root")
    twin(f"ball_{s}", f"hero_ball_{s}", f"hero_foot_ik_{s}")
    x = 1 if s == "l" else -1
    bone(f"hero_elbow_pole_{s}", (0.65 * x, 0.35, 1.2), (0.65 * x, 0.45, 1.2), "hero_root")
    bone(f"hero_knee_pole_{s}", (0.15 * x, -0.9, 0.55), (0.15 * x, -1.0, 0.55), "hero_root")
    for f in ("thumb", "index", "middle", "ring", "pinky"):
        parent = f"hero_hand_ik_{s}"
        for i in (1, 2, 3):
            twin(f"{f}_{i:02d}_{s}", f"hero_{f}_{i:02d}_{s}", parent)
            parent = f"hero_{f}_{i:02d}_{s}"
    # IK chains run head to head (the stock tails point sideways); each carries
    # a twin with the exact stock rest that the deform bone copies in world space.
    H = lambda n: deform.data.bones[n].head_local  # noqa: E731
    for up, lo, end, root in ((f"upperarm_{s}", f"lowerarm_{s}", f"hand_{s}", f"hero_clavicle_{s}"),
                              (f"thigh_{s}", f"calf_{s}", f"foot_{s}", "hero_pelvis")):
        a = bone(f"hero_{up}_ik", H(up), H(lo), root)
        b = bone(f"hero_{lo}_ik", H(lo), H(end), a.name)
        b.use_connect = True
        twin(up, f"hero_{up}", a.name)
        twin(lo, f"hero_{lo}", b.name)
bpy.ops.object.mode_set(mode="OBJECT")
for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"

# ---------------------------------------------------------------- constraints
dp = deform.pose.bones
for name in FK:
    c = dp[name].constraints.new("COPY_TRANSFORMS")
    c.name, c.target, c.subtarget = "hero FK", rig, f"hero_{name}"
    c.target_space = c.owner_space = "LOCAL"
for s in SIDES:
    for up, lower, target, pole in ((f"upperarm_{s}", f"lowerarm_{s}", f"hero_hand_ik_{s}", f"hero_elbow_pole_{s}"),
                                    (f"thigh_{s}", f"calf_{s}", f"hero_foot_ik_{s}", f"hero_knee_pole_{s}")):
        c = rig.pose.bones[f"hero_{lower}_ik"].constraints.new("IK")
        c.name, c.target, c.subtarget = "hero IK", rig, target
        c.pole_target, c.pole_subtarget = rig, pole
        c.chain_count, c.use_tail, c.use_stretch = 2, True, False
        for n in (up, lower):
            k = dp[n].constraints.new("COPY_TRANSFORMS")
            k.name, k.target, k.subtarget = "hero limb", rig, f"hero_{n}"
            k.target_space = k.owner_space = "WORLD"
    for end in (f"hand_{s}", f"foot_{s}"):
        kind = "hand_ik" if end.startswith("hand") else "foot_ik"
        c = dp[end].constraints.new("COPY_ROTATION")
        c.name, c.target, c.subtarget = "hero orient", rig, f"hero_{kind}_{s}"
        c.target_space = c.owner_space = "WORLD"


for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"

# calibrate every pole angle so the rig at rest reproduces the stock rest pose


def limb_error(lower):
    bpy.context.view_layer.update()
    upper = deform.data.bones[lower].parent.name
    return sum((dp[n].matrix.translation - rest[n].translation).length
               + (dp[n].matrix.col[1].xyz - rest[n].col[1].xyz).length for n in (upper, lower))


for s in SIDES:
    for lower in (f"lowerarm_{s}", f"calf_{s}"):
        c = rig.pose.bones[f"hero_{lower}_ik"].constraints["hero IK"]
        best = min(range(-180, 180, 2), key=lambda a: (setattr(c, "pole_angle", math.radians(a)), limb_error(lower))[1])
        lo, step = math.radians(best), math.radians(2)
        for _ in range(30):
            cand = [lo - step / 2, lo, lo + step / 2]
            lo = min(cand, key=lambda a: (setattr(c, "pole_angle", a), limb_error(lower))[1])
            step /= 2
        c.pole_angle = lo
        print("POLE", lower, round(math.degrees(lo), 4), "error", f"{limb_error(lower):.2e}")

# ---------------------------------------------------------------- posing tools
cp = rig.pose.bones


def reset():
    for pb in cp:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.view_layer.update()


def turn(name, axis, degrees):
    """Rotate a control about a world axis through its own head (FK, parent first)."""
    pb = cp[name]
    m = pb.matrix.copy()
    h = m.translation.copy()
    r = Matrix.Rotation(math.radians(degrees), 4, Vector(axis))
    pb.matrix = Matrix.Translation(h) @ r @ Matrix.Translation(-h) @ m
    bpy.context.view_layer.update()


def place(name, at=None, delta=None, yaw=0.0, pitch=0.0):
    """Move an IK/pole control in world space; optional yaw (Z) then pitch (local X of world)."""
    pb = cp[name]
    m = pb.matrix.copy()
    h = m.translation.copy()
    r = Matrix.Rotation(math.radians(yaw), 4, "Z") @ Matrix.Rotation(math.radians(pitch), 4, "X")
    m = Matrix.Translation(h) @ r @ Matrix.Translation(-h) @ m
    m.translation = Vector(at) if at is not None else h + Vector(delta or (0, 0, 0))
    pb.matrix = m
    bpy.context.view_layer.update()


def fist(s, amount):
    """Curl fingers toward the palm (amount 0..1); thumb folds less."""
    hand = rest[f"hand_{s}"]
    knuckles = rest[f"index_01_{s}"].translation - rest[f"pinky_01_{s}"].translation
    along = rest[f"middle_01_{s}"].translation - hand.translation
    palm = along.cross(knuckles).normalized()
    thumb = rest[f"thumb_02_{s}"].translation - hand.translation
    if palm.dot(thumb - thumb.project(along)) < 0:
        palm = -palm
    axis = knuckles.normalized()
    # the sign that sends the middle tip toward the palm side
    tip = rest[f"middle_03_{s}"].translation - rest[f"middle_01_{s}"].translation
    sign = 1 if (Matrix.Rotation(0.5, 3, axis) @ tip).dot(palm) > tip.dot(palm) else -1
    hm = cp[f"hero_hand_ik_{s}"].matrix.to_3x3() @ hand.to_3x3().inverted()
    for f in ("index", "middle", "ring", "pinky", "thumb"):
        for i, deg in ((1, 70), (2, 95), (3, 60)):
            k = 0.45 if f == "thumb" else 1.0
            turn(f"hero_{f}_{i:02d}_{s}", hm @ axis, sign * deg * amount * k)


LOC_ROT = ("location", "rotation_quaternion")


def key(frame):
    for pb in cp:
        for path in LOC_ROT:
            pb.keyframe_insert(path, frame=frame, group=pb.name)


# ---------------------------------------------------------------- hero poses
def hero_stand(breath=0.0, sway=0.0):
    """Fists on hips, wide planted stance, chest up, chin lifted."""
    reset()
    place("hero_pelvis", delta=(sway * 0.004, 0, -0.035 + 0.004 * breath))
    for s, x in (("l", 1), ("r", -1)):
        place(f"hero_foot_ik_{s}", delta=(0.085 * x, 0.0, 0.0), yaw=12 * x)
        place(f"hero_knee_pole_{s}", delta=(0.25 * x, 0, 0))
    turn("hero_spine_03", (1, 0, 0), -2 - 0.8 * breath)
    turn("hero_spine_04", (1, 0, 0), -3 - 1.0 * breath)
    turn("hero_spine_05", (1, 0, 0), -3 - 1.2 * breath)
    for s, x in (("l", 1), ("r", -1)):
        turn(f"hero_clavicle_{s}", (0, 1, 0), -x * (4 + 1.5 * breath))   # shoulders broad and back
        turn(f"hero_clavicle_{s}", (1, 0, 0), -4)
    turn("hero_neck_01", (1, 0, 0), 9)
    turn("hero_head", (1, 0, 0), 9 + 0.6 * breath)
    turn("hero_head", (0, 0, 1), 4 * sway)
    for s, x in (("l", 1), ("r", -1)):
        hip = cp["hero_pelvis"].matrix.translation
        place(f"hero_hand_ik_{s}", at=hip + Vector((0.205 * x, 0.035, -0.035 + 0.003 * breath)), yaw=-x * 70)
        turn(f"hero_hand_ik_{s}", (0, 1, 0), x * 25)
        place(f"hero_elbow_pole_{s}", at=(0.75 * x, 0.25, 1.15))
        fist(s, 1.0)


def reach(s, target, limb="arm"):
    """Keep an IK goal inside 99% of the limb length from its root joint."""
    up, lo = (f"hero_upperarm_{s}_ik", f"hero_lowerarm_{s}_ik") if limb == "arm" else \
        (f"hero_thigh_{s}_ik", f"hero_calf_{s}_ik")
    root = cp[up].matrix.translation
    span = 0.99 * (rig.data.bones[up].length + rig.data.bones[lo].length)
    v = Vector(target) - root
    return root + v.normalized() * min(v.length, span)


def toe_down(s, pitch, ball_z=0.028):
    """Pitch the foot goal toes-down and drop it until the ball touches the floor."""
    place(f"hero_foot_ik_{s}", pitch=pitch)
    m = cp[f"hero_foot_ik_{s}"].matrix
    ball = m @ rest[f"foot_{s}"].inverted() @ rest[f"ball_{s}"].translation
    place(f"hero_foot_ik_{s}", delta=(0, 0, ball_z - ball.z))


def three_point(depth=1.0):
    """Superhero landing: right fist and knee down, left foot forward, left arm swept back."""
    reset()
    place("hero_pelvis", delta=(0, 0.05, -0.565 * depth))
    for name, deg in (("hero_pelvis", 48), ("hero_spine_01", 12), ("hero_spine_02", 12),
                      ("hero_spine_03", 10), ("hero_spine_04", 8), ("hero_spine_05", 4)):
        turn(name, (1, 0, 0), deg * depth)
    turn("hero_neck_01", (1, 0, 0), -33 * depth)
    turn("hero_neck_02", (1, 0, 0), -26 * depth)
    turn("hero_head", (1, 0, 0), -24 * depth)
    turn("hero_clavicle_r", (1, 0, 0), 50 * depth)
    turn("hero_clavicle_l", (1, 0, 0), -6 * depth)
    place("hero_foot_ik_l", at=(0.19, -0.30 * depth + 0.056 * (1 - depth), 0.109), yaw=10)
    place("hero_knee_pole_l", at=(0.30, -1.0, 0.9))
    # rear leg: thigh leaning forward, knee just off the floor, shin back, toes planted
    place("hero_foot_ik_r", at=(-0.13, 0.056 + 0.20 * depth, 0.109), pitch=38 * depth)
    toe_down("r", 0)
    turn("hero_ball_r", (1, 0, 0), -38 * depth)  # toes bend back and lie on the floor
    place("hero_knee_pole_r", at=(-0.15, -1.0, -0.3))
    place("hero_foot_ik_r", at=reach("r", cp["hero_foot_ik_r"].matrix.translation, "leg"))
    place("hero_hand_ik_r", at=reach("r", (-0.21, -0.42, 0.09)), yaw=20)
    place("hero_elbow_pole_r", at=(-0.8, 0.4, 1.0))
    place("hero_hand_ik_l", at=reach("l", (0.62, 0.42, 0.82)), yaw=40)
    place("hero_elbow_pole_l", at=(0.6, 0.0, 1.6))
    if HAND_L_ROLL:
        # unwind the swept-back hand about the forearm axis (v29 forearm-twist correction)
        bpy.context.view_layer.update()
        dpb = deform.pose.bones
        fore = (dpb["hand_l"].head - dpb["lowerarm_l"].head).normalized()
        turn("hero_hand_ik_l", fore, HAND_L_ROLL)
    fist("r", 1.0)
    fist("l", 0.35)


def build(name, frames):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    for frame, pose in frames:
        pose()
        key(frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(act.frame_range[0]), act)
    track.mute = True
    rig.animation_data.action = None
    return act


idle = build("hero_idle", [(1, lambda: hero_stand(0, 0)), (16, lambda: hero_stand(1, 0.5)),
                           (31, lambda: hero_stand(0.2, 0)), (46, lambda: hero_stand(0.8, -0.5)),
                           (61, lambda: hero_stand(0, 0))])
landing = build("hero_landing", [(1, lambda: three_point(0.45)), (5, lambda: three_point(1.01)),
                                 (9, lambda: three_point(1.0)), (30, lambda: three_point(0.995)),
                                 (52, lambda: hero_stand(0, 0))])
if TWIST:
    # graded forearm weights: hand the lowerarm share of the sleeves to the stock twist joints
    sleeves = bpy.data.objects["Sleeves, armour and gloves"]
    vg = sleeves.vertex_groups
    to_arm = deform.matrix_world.inverted() @ sleeves.matrix_world
    for s in SIDES:
        lo, hd = deform.data.bones[f"lowerarm_{s}"].head_local, deform.data.bones[f"hand_{s}"].head_local
        L = (hd - lo).length; a = (hd - lo) / L
        gl = vg[f"lowerarm_{s}"]
        g1 = vg.get(f"lowerarm_twist_01_{s}") or vg.new(name=f"lowerarm_twist_01_{s}")
        g2 = vg.get(f"lowerarm_twist_02_{s}") or vg.new(name=f"lowerarm_twist_02_{s}")
        for v in sleeves.data.vertices:
            w = {e.group: e.weight for e in v.groups}
            if gl.index not in w:
                continue
            t = max(0.0, min(1.0, ((to_arm @ v.co) - lo).dot(a) / L))
            wl = w[gl.index]
            k2 = max(0.0, (t - 0.5) * 2) * 0.8
            k1 = (1 - abs(t - 0.5) * 2) * 0.6
            gl.add([v.index], wl * (1 - k1 - k2), "REPLACE")
            if k1:
                g1.add([v.index], wl * k1, "REPLACE")
            if k2:
                g2.add([v.index], wl * k2, "REPLACE")
    deform["hero_twist"] = [0.45, 0.9]   # share of hand roll carried by lowerarm_twist_01/02 (baked by hero_check)
idle["holodeck_loop"] = True
landing["holodeck_loop"] = False
reset()
rig.animation_data.action = idle
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 61
bpy.context.scene.render.fps = 30
rig["hero_rig_contract"] = ("Controls only. Deform joints keep stock names, hierarchy and rest; "
                            "bake to the deform armature and drop this object before export.")
bpy.ops.wm.save_as_mainfile(filepath=str(out), copy=False)
print("HERORIG", out, "controls", len(rig.data.bones), "actions", [a.name for a in bpy.data.actions])
