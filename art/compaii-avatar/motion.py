"""Author the Navegante clips on the existing mechanism armature.

All poses are original to Holodeck. Angles are XYZ degrees in armature axes:
+X leans or points the toe, -X lifts a thigh, flexes an elbow or looks up,
"out" spreads an arm from the body on either side, +Z turns to the robot's left.
Run on the packed scene to rebuild motion without the private texture inputs:

  blender -b --python-exit-code 19 --python motion.py -- OUTPUT
"""
import math
import sys
from pathlib import Path

import bpy

FPS = 30
TAU = 2 * math.pi
CUES = ("calm", "curious", "joy", "sad", "anger", "uncertain", "focus", "welcome", "sleep")
LEGS = (("left", "L", 0), ("right", "R", .5))
# Base clips key every one of these joints, so a blend never falls through to
# the bind pose. The speech jaw and the eyes are deliberately absent.
BODY = ("hips", "chest", "head", "cape", "antenna",
        "arm-L", "arm-R", "elbow-L", "elbow-R", "hand-L", "hand-R",
        "leg-left", "leg-right", "shin-left", "shin-right", "foot-L", "foot-R")


def arms(forward=(0, 0), out=(0, 0), elbow=(0, 0), hand=(0, 0), twist=(0, 0)):
    """Left then right. Positive forward, spread and flex read the same per side."""
    pose = {}
    for i, (suffix, side) in enumerate((("L", 1), ("R", -1))):
        pose["arm-" + suffix] = (-forward[i], side * out[i], side * twist[i])
        pose["elbow-" + suffix] = (-elbow[i], 0, 0)
        pose["hand-" + suffix] = (-hand[i], 0, 0)
    return pose


def legs(thigh=(0, 0), knee=(0, 0), toe=(0, 0), out=(0, 0)):
    pose = {}
    for i, (direction, suffix, _) in enumerate(LEGS):
        side = 1 if i == 0 else -1
        pose["leg-" + direction] = (-thigh[i], side * out[i], 0)
        pose["shin-" + direction] = (knee[i], 0, 0)
        pose["foot-" + suffix] = (toe[i], 0, 0)
    return pose


def planted(joints, drop, offsets=((0, 0), (0, 0))):
    """Bend both legs so the ankles stay at (back, up) offsets under lowered hips."""
    pose = {}
    for (direction, suffix, _), (back, up) in zip(LEGS, offsets):
        hip, shin, ankle = [joints[name] for name in ("leg-" + direction, "shin-" + direction, "foot-" + suffix)]
        upper = (shin[1] - hip[1], hip[2] - shin[2])
        lower = (ankle[1] - shin[1], shin[2] - ankle[2])
        a, b = math.hypot(*upper), math.hypot(*lower)
        y = ankle[1] - hip[1] + back
        down = hip[2] - ankle[2] + drop - up
        length = min(a + b - 1e-5, math.hypot(y, down))
        knee = math.acos(max(-1, min(1, (length * length - a * a - b * b) / (2 * a * b))))
        thigh = math.atan2(y, down) - math.atan2(b * math.sin(knee), a + b * math.cos(knee))
        turn = thigh - math.atan2(*upper)
        bend = knee - math.atan2(*lower) + math.atan2(*upper)
        pose["leg-" + direction] = (math.degrees(turn), 0, 0)
        pose["shin-" + direction] = (math.degrees(bend), 0, 0)
        pose["foot-" + suffix] = (-math.degrees(turn + bend), 0, 0)
    return pose


def sample(keys, time, length, loop):
    """Monotone cubic timing. Repeating a key holds the pose without drift."""
    names = {name for _, pose, _ in keys for name in pose}
    track = [(t, {**{n: (0, 0, 0) for n in names}, **pose, "@": at}) for t, pose, at in keys]
    if loop:
        track = [(t - length, p) for t, p in track[-2:]] + track + [(t + length, p) for t, p in track[:2]]
    if time <= track[0][0]:
        return track[0][1]
    if time >= track[-1][0]:
        return track[-1][1]
    i = max(index for index, (t, _) in enumerate(track) if t <= time)

    def slope(j, name, axis):
        if j <= 0 or j >= len(track) - 1:
            return 0
        (t0, p0), (t1, p1), (t2, p2) = track[j - 1:j + 2]
        left = (p1[name][axis] - p0[name][axis]) / (t1 - t0)
        right = (p2[name][axis] - p1[name][axis]) / (t2 - t1)
        return 0 if left * right <= 0 else 2 * left * right / (left + right)

    (t0, p0), (t1, p1) = track[i], track[i + 1]
    span = t1 - t0
    s = (time - t0) / span
    result = {}
    for name in p0:
        values = []
        for axis in range(3):
            a, b = p0[name][axis], p1[name][axis]
            values.append((2*s**3 - 3*s*s + 1) * a + (s**3 - 2*s*s + s) * span * slope(i, name, axis)
                          + (3*s*s - 2*s**3) * b + (s**3 - s*s) * span * slope(i + 1, name, axis))
        result[name] = tuple(values)
    return result


def stride(joints, t, gait):
    """One full cycle. The left foot lands at zero and the right at one half.

    The runtime solves the legs to fixed contacts. These legs remain a complete
    preview and fallback at the reference stride.
    """
    reach, duty, lift, lean, swing, flex, twist, bob, dip, cape = {
        "walk": (.40, .58, .07, 3, 25, 20, 11, .013, .030, 7),
        "run": (.70, .40, .13, 10, 44, 66, 15, .024, .048, 24),
        "bound": (.86, .30, .17, 17, 60, 42, 19, .036, .054, 42),
    }[gait]
    wave = lambda phase, rate=1: math.cos(TAU * (rate * t - phase))
    # A walk vaults over the stance leg. A run compresses there and flies after.
    crest = duty / 2 if gait == "walk" else duty / 2 + .25
    hips = (-.018 * math.sin(TAU * t) * (1 if gait == "walk" else .5), 0,
            -dip + bob * math.cos(2 * TAU * (t - crest)))
    pose = {"hips": (lean * .25, 3.5 * math.sin(TAU * t), twist * .55 * wave(0)),
            "chest": (lean * .75 + 1.5 * wave(.2, 2), -4 * math.sin(TAU * t), -twist * 1.45 * wave(.02)),
            "head": (-lean * .8 + 1.2 * wave(.55, 2), 1.2 * math.sin(TAU * t), twist * .72 * wave(.04)),
            "cape": (cape + .30 * cape * wave(.28, 2), 3 * wave(.2), 4 * wave(.12)),
            "antenna": (6 * wave(.34, 2), 0, 5 * wave(.2))}
    pose.update(arms((-swing * wave(.03) + lean * .4, swing * wave(.03) + lean * .4),
                     (6, 6),
                     (flex - .45 * flex * wave(.09), flex + .45 * flex * wave(.09)),
                     (8 - 10 * wave(.15), 8 + 10 * wave(.15)),
                     (-.35 * swing, -.35 * swing)))
    offsets = []
    for _, _, start in LEGS:
        phase = (t + start) % 1
        toe = reach * duty / 2
        if phase < duty:
            offsets.append((-toe + 2 * toe * phase / duty, 0))
        else:
            arc = (phase - duty) / (1 - duty)
            offsets.append((toe * math.cos(math.pi * arc), lift * math.sin(math.pi * arc ** .82) ** 2))
    pose.update(planted(joints, hips[2], offsets))
    return pose, hips


def library(joints):
    """Return {name: (seconds, loop, keys)} in export order."""
    at = (0, 0, 0)
    still = {name: (0, 0, 0) for name in BODY}
    clips = {}

    def breath(pose, z):
        return {**still, **planted(joints, z), **pose}, (0, 0, z)
    rest = breath({"chest": (1, 0, 0), "cape": (2, 0, 0), **arms(out=(3, 3), elbow=(8, 8))}, -.004)
    inhale = breath({"chest": (-1.5, 0, 0), "head": (1.5, -1.5, 0), "cape": (3, 1, 0), "antenna": (3, 0, 1),
                     **arms(out=(6, 6), elbow=(6, 6), hand=(3, 3))}, 0)
    settle = breath({"chest": (2.2, .8, 1.5), "head": (-1, 1.5, -2), "cape": (1, -1, 0), "antenna": (-3, 0, -1),
                     **arms(out=(2, 3), elbow=(11, 8), forward=(2, 0))}, -.009)
    clips["calm"] = (4.0, True, [(0, *rest), (1.25, *inhale), (1.65, *inhale), (3.05, *settle), (3.35, *settle)])

    def cue(seconds, *keys):
        return (seconds, False, [(0, {}, at), *keys, (seconds, {}, at)])
    # The nine cues follow the navigator gallery (v6). The head is large, so
    # its pitch stays modest: the face must remain readable in every cue.
    chin = dict(forward=(52, 10), out=(-10, 22), elbow=(128, 12), hand=(-8, 0))
    clips["curious"] = cue(2.2,
        (.22, {"head": (3, -4, 0), "antenna": (10, 0, 0)}, (0, .004, -.004)),
        (.55, {"head": (-4, 12, 9), "antenna": (-14, 0, 5), "chest": (4, 3, 4), "cape": (3, 0, 0),
               **arms(**chin)}, (0, -.012, -.010)),
        (1.4, {"head": (-5, 13, 11), "antenna": (-9, 0, 3), "chest": (4, 3, 5), "cape": (2, 0, 0),
               **arms(forward=(54, 12), out=(-10, 24), elbow=(132, 14), hand=(-10, 0))}, (0, -.012, -.010)),
        (1.86, {"head": (-2, 4, 3), "chest": (2, 1, 1), **arms(forward=(16, 4), out=(0, 8), elbow=(40, 6))},
         (0, -.004, -.004)))
    clips["joy"] = cue(1.7,
        (.18, {"head": (6, 0, 0), "chest": (6, 0, 0), **arms(forward=(-10, -10), elbow=(16, 16))}, (0, 0, -.03)),
        (.42, {"head": (-9, 0, 0), "chest": (-7, 0, 0), "cape": (-6, 0, 0), "antenna": (16, 0, 0),
               **arms(forward=(26, 26), out=(98, 98), elbow=(22, 22), hand=(-12, -12))}, (0, 0, .03)),
        (.66, {"head": (-7, -5, -3), "chest": (-5, 0, -4), "cape": (10, 0, 0), "antenna": (-12, 0, 0),
               **arms(forward=(24, 24), out=(90, 90), elbow=(30, 30), hand=(-8, -8))}, (0, 0, -.012)),
        (.9, {"head": (-9, 5, 3), "chest": (-6, 0, 4), "cape": (2, 0, 0), "antenna": (8, 0, 0),
              **arms(forward=(26, 26), out=(96, 96), elbow=(24, 24), hand=(-12, -12))}, (0, 0, .012)),
        (1.2, {"head": (-3, 0, 0), "cape": (4, 0, 0), **arms(forward=(8, 8), out=(24, 24), elbow=(16, 16))}, (0, 0, -.008)))
    clasped = dict(forward=(24, 24), out=(-20, -20), elbow=(30, 30), hand=(6, 6))
    clips["sad"] = cue(2.4,
        (.7, {"chest": (9, 0, 0), "head": (10, -4, 0), "antenna": (18, 0, 0), "cape": (3, 0, 0), **arms(**clasped)},
         (0, 0, -.018)),
        (1.6, {"chest": (10, 0, 0), "head": (11, -5, 3), "antenna": (20, 0, 0), "cape": (3, 0, 0), **arms(**clasped)},
         (0, 0, -.02)))
    clips["anger"] = cue(1.7,
        (.14, {"chest": (-4, 0, 0), "head": (-4, 0, 0)}, (0, 0, .004)),
        (.34, {"chest": (9, 0, 0), "head": (6, 0, 0), "antenna": (-16, 0, 0),
               **arms(forward=(14, 14), out=(24, 24), elbow=(58, 58), hand=(14, 14))}, (0, -.012, -.022)),
        (1.15, {"chest": (8, 0, 0), "head": (5, 0, 0), "antenna": (-10, 0, 0),
                **arms(forward=(12, 12), out=(22, 22), elbow=(55, 55), hand=(14, 14))}, (0, -.010, -.018)))
    shrug = dict(forward=(52, 32), out=(-10, 40), elbow=(128, 44), hand=(-8, -22))
    clips["uncertain"] = cue(2.1,
        (.4, {"head": (4, -10, -10), "chest": (-2, -3, -4), "antenna": (8, 0, -6), **arms(**shrug)}, (.010, 0, -.006)),
        (1.0, {"head": (5, -9, -12), "chest": (-2, -3, -5), "antenna": (4, 0, -4), **arms(**shrug)}, (.012, 0, -.008)),
        (1.32, {"head": (4, 8, 9), "chest": (-2, 2, 4), "antenna": (8, 0, 6), **arms(**shrug)}, (-.010, 0, -.006)))
    explain = dict(forward=(36, 46), out=(20, -4), elbow=(42, 88), hand=(-10, -16))
    clips["focus"] = cue(1.9,
        (.42, {"chest": (6, 0, 0), "head": (5, 0, 0), "antenna": (-12, 0, 0), **arms(**explain)}, (0, -.010, -.012)),
        (1.35, {"chest": (7, 0, 0), "head": (6, 0, 3), "antenna": (-9, 0, 0),
                **arms(forward=(38, 48), out=(22, -4), elbow=(44, 92), hand=(-10, -16))}, (0, -.012, -.014)))
    wave = {"head": (-4, 8, -6), "chest": (-4, -4, -5), "antenna": (6, 0, 0)}
    clips["welcome"] = cue(2.3,
        (.18, {"head": (5, 0, 0), "chest": (3, 0, 4), **arms(forward=(0, -12), elbow=(0, 14))}, (0, 0, -.014)),
        (.52, {**wave, **arms(forward=(30, 14), out=(30, 142), elbow=(30, 34), hand=(-14, 10))}, (-.010, 0, .006)),
        (.74, {**wave, **arms(forward=(30, 14), out=(30, 116), elbow=(30, 18), hand=(-14, -12))}, (-.010, 0, .004)),
        (.96, {**wave, **arms(forward=(30, 14), out=(30, 144), elbow=(30, 36), hand=(-14, 10))}, (-.010, 0, .004)),
        (1.18, {**wave, **arms(forward=(30, 14), out=(30, 118), elbow=(30, 18), hand=(-14, -12))}, (-.010, 0, .003)),
        (1.45, {**wave, **arms(forward=(28, 12), out=(28, 138), elbow=(28, 30), hand=(-12, 0))}, (-.008, 0, .002)),
        (1.85, {"head": (2, 2, -2), **arms(forward=(6, 8), out=(8, 22), elbow=(10, 24))}, (0, 0, -.006)))
    clips["sleep"] = cue(3.2,
        (1.0, {"chest": (9, 0, 0), "head": (11, 6, 7), "cape": (3, -4, 0), "antenna": (16, 0, 0), **arms(**clasped)},
         (0, 0, -.018)),
        (2.1, {"chest": (10, 0, 0), "head": (13, 7, 8), "cape": (4, -4, 0), "antenna": (18, 0, 0), **arms(**clasped)},
         (0, 0, -.022)))

    for name, seconds in (("walk", 14 / 15), ("run", .8), ("bound", .8)):
        count = round(seconds * FPS)
        clips[name] = (seconds, None, [(i / FPS, *stride(joints, i / count, name)) for i in range(count + 1)])

    # Arms ride clear of the water while the planted legs stay with the walk.
    def wade(t):
        pose, hips = stride(joints, t, "walk")
        beat = math.cos(TAU * t)
        pose.update(arms((14 - 12 * beat, 14 + 12 * beat), (54 + 5 * beat, 54 - 5 * beat), (38, 38), (14, 14)))
        pose["chest"] = (8, -6 * math.sin(TAU * t), -9 * beat)
        pose["head"] = (-5, 2 * math.sin(TAU * t), 6 * beat)
        pose["cape"] = (22 + 4 * math.cos(2 * TAU * t), 5 * beat, 0)
        return pose, hips
    clips["wade"] = (1.2, None, [(i / FPS, *wade(i / 36)) for i in range(37)])

    def air(chest, head, cape, antenna, arm, leg, z, hips=(0, 0, 0), x=0):
        return {**still, "hips": hips, "chest": chest, "head": head, "cape": cape, "antenna": antenna,
                **arms(**arm), **legs(**leg)}, (x, 0, z)
    float_a = air((4, 2, 3), (-4, -3, -2), (9, 2, 2), (5, 0, 2),
                  dict(forward=(8, -4), out=(30, 24), elbow=(34, 24), hand=(10, 4), twist=(8, 8)),
                  dict(thigh=(34, -4), knee=(62, 24), toe=(16, 34), out=(2, 4)), .010, (2, 2, 0), -.008)
    float_b = air((7, -2, -2), (-6, 2, 2), (14, -1, -2), (-5, 0, -1),
                  dict(forward=(2, 4), out=(20, 34), elbow=(22, 36), hand=(-6, 8), twist=(4, 10)),
                  dict(thigh=(26, 4), knee=(50, 34), toe=(26, 26), out=(3, 3)), -.016, (4, -1, 0), .004)
    float_c = air((3, -3, -4), (-3, 4, 4), (8, -3, -2), (4, 0, -2),
                  dict(forward=(-2, 10), out=(26, 32), elbow=(24, 38), hand=(4, 12), twist=(8, 6)),
                  dict(thigh=(30, 0), knee=(56, 28), toe=(18, 32), out=(3, 4)), .012, (2, -2, 0), .009)
    float_d = air((6, 1, 1), (-5, -1, -1), (15, 1, 1), (-6, 0, 1),
                  dict(forward=(4, 0), out=(34, 22), elbow=(38, 22), hand=(12, -4), twist=(10, 4)),
                  dict(thigh=(38, -6), knee=(66, 20), toe=(22, 36), out=(2, 3)), -.014, (4, 1, 0), -.003)
    clips["hover"] = (4.2, True, [(0, *float_a), (.95, *float_b), (2.1, *float_c), (3.05, *float_d)])
    glide = lambda flutter, z: air((9, 2 * flutter, 2 * flutter), (-30, -2 * flutter, 0), (46 + 8 * flutter, 3 * flutter, 0),
        (-16 + 5 * flutter, 0, 0),
        dict(forward=(-42 - 4 * flutter, -42 + 4 * flutter), out=(34 + 3 * flutter, 34 - 3 * flutter), elbow=(12, 12),
             hand=(-14, -14), twist=(-6, -6)),
        dict(thigh=(-12 + 5 * flutter, -12 - 5 * flutter), knee=(14 - 4 * flutter, 14 + 4 * flutter),
             toe=(44, 44), out=(-1, -1)), z, (5, 0, 0))
    clips["glide"] = (2.0, True, [(0, *glide(0, 0)), (.5, *glide(1, .006)), (1, *glide(0, 0)), (1.5, *glide(-1, -.006))])

    crouch = ({**still, **planted(joints, -.070), "chest": (20, 0, 0), "head": (-14, 0, 0), "cape": (-6, 0, 0),
               "antenna": (-12, 0, 0), **arms(forward=(-40, -40), out=(12, 12), elbow=(22, 22))}, (0, 0, -.070))
    spring = air((-7, 0, 0), (-10, 0, 0), (-12, 0, 0), (20, 0, 0),
                 dict(forward=(54, 54), out=(16, 16), elbow=(26, 26), hand=(-10, -10)),
                 dict(thigh=(-8, -8), knee=(4, 4), toe=(48, 48)), .026)
    tuck = air((10, 0, 0), (-8, 0, 0), (22, 0, 0), (-8, 0, 0),
               dict(forward=(16, 16), out=(44, 44), elbow=(46, 46)),
               dict(thigh=(52, 24), knee=(84, 56), toe=(14, 28)), .004)
    stance = ({**rest[0]}, rest[1])
    clips["lift"] = (.9, False, [(0, *stance), (.10, *crouch), (.15, *crouch), (.30, *spring), (.38, *spring), (.60, *tuck), (.9, *float_a)])
    reach = air((-4, 0, 0), (12, 0, 0), (-8, 0, 0), (6, 0, 0),
                dict(forward=(14, 14), out=(52, 52), elbow=(24, 24)),
                dict(thigh=(20, 14), knee=(14, 10), toe=(-12, -8)), .004)
    absorb = ({**still, **planted(joints, -.094), "chest": (27, 0, 0), "head": (-20, 0, 0), "cape": (30, 0, 0),
               "antenna": (24, 0, 0), **arms(forward=(22, -10), out=(38, 46), elbow=(28, 18), hand=(16, 8))}, (0, 0, -.094))
    rise = ({**still, **planted(joints, -.002), "chest": (-4, 0, 0), "head": (3, 0, 0), "cape": (-7, 0, 0),
             "antenna": (-15, 0, 0), **arms(forward=(4, 2), out=(14, 14), elbow=(12, 12))}, (0, 0, -.002))
    clips["landing"] = (.95, False, [(0, *float_a), (.09, *reach), (.20, *absorb), (.29, *absorb), (.62, *rise), (.95, *stance)])

    def water(t, prone):
        beat = math.cos(TAU * t)
        turn = math.sin(TAU * t)
        if not prone:
            # Upright, hands flat below the surface and alternating eggbeater legs.
            return air((5 + 2 * beat, 3 * turn, 4 * beat), (-7, -2 * turn, -3 * beat), (26 + 8 * turn, 4 * beat, 0), (4 * beat, 0, 3 * turn),
                       dict(forward=(20 + 24 * turn, 20 - 24 * turn), out=(30 + 10 * beat, 30 - 10 * beat),
                            elbow=(36 - 14 * beat, 36 + 14 * beat), hand=(12 * turn, -12 * turn), twist=(20 * turn, -20 * turn)),
                       dict(thigh=(24 + 20 * beat, 24 - 20 * beat), knee=(42 + 26 * turn, 42 - 26 * turn),
                            toe=(8 + 12 * turn, 8 - 12 * turn), out=(10 + 5 * beat, 10 - 5 * beat)),
                       .008 * math.cos(2 * TAU * t), (3, 2 * turn, 0))
    clips["tread"] = (1.9, None, [(i / FPS, *water(i / 57, False)) for i in range(58)])
    long = air((-2, 0, 0), (-38, 0, 0), (34, 0, 0), (-18, 0, 0),
               dict(forward=(96, 96), out=(26, 26), elbow=(4, 4), hand=(-8, -8)),
               dict(thigh=(-8, -8), knee=(5, 5), toe=(50, 50)), 0, (4, 0, 0))
    spread = air((-7, 0, 0), (-28, 0, 0), (26, 0, 0), (-8, 0, 0),
                 dict(forward=(64, 64), out=(62, 62), elbow=(18, 18), hand=(20, 20)),
                 dict(thigh=(-4, -4), knee=(16, 16), toe=(46, 46)), .006, (3, 0, 0))
    press = air((-10, 0, 0), (-24, 0, 0), (18, 0, 0), (10, 0, 0),
                dict(forward=(-16, -16), out=(34, 34), elbow=(26, 26), hand=(-16, -16)),
                dict(thigh=(22, 22), knee=(52, 52), toe=(18, 18), out=(6, 6)), .012, (0, 0, 0))
    gather = air((4, 0, 0), (-32, 0, 0), (30, 0, 0), (2, 0, 0),
                 dict(forward=(34, 34), out=(16, 16), elbow=(96, 96), hand=(8, 8)),
                 dict(thigh=(62, 62), knee=(104, 104), toe=(-8, -8), out=(16, 16)), -.004, (2, 0, 0))
    shoot = air((2, 0, 0), (-40, 0, 0), (44, 0, 0), (-24, 0, 0),
                dict(forward=(92, 92), out=(20, 20), elbow=(14, 14), hand=(-6, -6)),
                dict(thigh=(-4, -4), knee=(16, 16), toe=(38, 38), out=(12, 12)), -.006, (4, 0, 0))
    clips["swim"] = (2.1, True, [(0, *long), (.55, *long), (.88, *spread), (1.18, *press), (1.50, *gather), (1.74, *shoot)])

    # Additive gestures start and finish at neutral. They ride on any base clip.
    clips["brace"] = cue(.72,
        (.11, {"chest": (-15, 0, 0), "head": (11, 0, 0), "cape": (26, 0, 0), "antenna": (-22, 0, 0),
               **arms(forward=(34, 22), out=(24, 30), elbow=(18, 24))}, (0, .020, -.038)),
        (.34, {"chest": (7, 0, 0), "head": (-5, 0, 0), "cape": (-10, 0, 0), "antenna": (15, 0, 0),
               **arms(forward=(-8, -6), out=(8, 8), elbow=(6, 6))}, (0, -.006, -.014)))
    clips["scan"] = cue(4.6,
        (.30, {"head": (4, 3, -7), "chest": (0, 0, 0)}, at),
        (.62, {"head": (-6, -5, 42), "chest": (0, 0, 5), "antenna": (0, 0, 14)}, (.006, 0, 0)),
        (1.55, {"head": (-9, -4, 47), "chest": (-2, -2, 13), "antenna": (-6, 0, 3), **arms(out=(0, 6), elbow=(0, 8))}, (.010, 0, -.003)),
        (2.12, {"head": (5, 4, -30), "chest": (1, 0, 6), "antenna": (4, 0, -16)}, (0, 0, -.006)),
        (2.50, {"head": (8, 9, -46), "chest": (2, 2, -12), "antenna": (-4, 0, -4), **arms(out=(6, 0), elbow=(10, 0))}, (-.010, 0, -.006)),
        (3.45, {"head": (6, 10, -44), "chest": (2, 2, -14), "antenna": (-2, 0, -2), **arms(out=(6, 0), elbow=(10, 0))}, (-.010, 0, -.004)))
    clips["sway"] = cue(4.2,
        (.55, {"hips": (0, 4, 4), "chest": (2, -6, -6), "head": (-2, 7, 4), "cape": (4, 4, 0), **arms(forward=(-12, 14), out=(4, 6), elbow=(10, 16))}, (.024, 0, -.012)),
        (1.15, {"hips": (0, 4, 4), "chest": (2, -6, -8), "head": (-2, 9, 2), "cape": (2, 2, 0), **arms(forward=(-10, 12), out=(4, 6), elbow=(10, 16))}, (.024, 0, -.010)),
        (1.95, {"hips": (0, -4, -5), "chest": (1, 6, 8), "head": (-3, -8, -4), "cape": (5, -4, 0), **arms(forward=(16, -14), out=(6, 4), elbow=(18, 10))}, (-.024, 0, -.013)),
        (2.75, {"hips": (0, -4, -5), "chest": (0, 6, 9), "head": (-4, -10, -2), "cape": (2, -2, 0), **arms(forward=(14, -12), out=(6, 4), elbow=(18, 10))}, (-.024, 0, -.010)),
        (3.45, {"hips": (0, 1, 1), "chest": (-4, -1, 0), "head": (5, 0, 0), **arms(out=(7, 7), elbow=(4, 4))}, (.003, 0, .006)))
    clips["tinker"] = cue(4.4,
        (.35, {"head": (5, 0, -4), "chest": (2, 0, 0), **arms(forward=(0, 12), elbow=(0, 34))}, (0, 0, -.006)),
        (.85, {"head": (24, -8, -22), "chest": (5, 0, -6), "antenna": (-12, 0, 0), **arms(forward=(-4, 46), out=(4, 2), elbow=(10, 92), hand=(0, 12), twist=(0, 26))}, (0, 0, -.010)),
        (1.55, {"head": (25, 5, -22), "chest": (5, 0, -6), "antenna": (-6, 0, 3), **arms(forward=(-4, 48), out=(4, 2), elbow=(10, 96), hand=(0, -22), twist=(0, 38))}, (0, 0, -.010)),
        (1.92, {"head": (25, -7, -24), "chest": (6, 0, -6), "antenna": (-12, 0, -3), **arms(forward=(-4, 48), out=(4, 2), elbow=(10, 92), hand=(0, 24), twist=(0, 10))}, (0, 0, -.010)),
        (2.70, {"head": (24, -8, -24), "chest": (6, 0, -6), "antenna": (-8, 0, 0), **arms(forward=(-4, 48), out=(4, 2), elbow=(10, 94), hand=(0, 18), twist=(0, 14))}, (0, 0, -.010)),
        (3.05, {"head": (-10, 6, 0), "chest": (-5, 0, 4), "antenna": (16, 0, 0), **arms(forward=(6, 22), out=(14, 26), elbow=(24, 44))}, (0, 0, .004)),
        (3.65, {"head": (-5, 2, 2), "antenna": (-4, 0, 0), **arms(forward=(0, 2), out=(4, 6), elbow=(8, 14))}, (0, 0, -.004)))
    clips["chirp"] = cue(1.9,
        (.20, {"head": (10, 0, 0), "chest": (6, 0, 0), "antenna": (-10, 0, 0), **arms(forward=(-12, -12), out=(4, 4), elbow=(20, 20))}, (0, 0, -.034)),
        (.38, {"head": (-12, -10, 0), "chest": (-6, 0, 0), "cape": (-8, 0, 0), "antenna": (26, 0, 0), **arms(forward=(12, 12), out=(36, 36), elbow=(30, 30), hand=(-18, -18))}, (0, 0, .004)),
        (.58, {"head": (-4, 13, 0), "chest": (3, 0, 0), "cape": (12, 0, 0), "antenna": (-20, 0, 0), **arms(forward=(8, 8), out=(26, 26), elbow=(42, 42))}, (0, 0, -.026)),
        (1.15, {"head": (-6, 14, 4), "antenna": (9, 0, 0), **arms(forward=(6, 6), out=(16, 16), elbow=(34, 34))}, (0, 0, -.010)),
        (1.45, {"head": (2, 4, 1), "antenna": (-4, 0, 0), **arms(out=(5, 5), elbow=(10, 10))}, (0, 0, .002)))
    return clips


def author(rig):
    """Replace every motion track. Each clip occupies its own muted NLA track."""
    joints = {bone.name: tuple(bone.head_local) for bone in rig.data.bones}
    rig.animation_data_create()
    rig.animation_data.action = None
    for track in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(track)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for name, (seconds, loop, keys) in library(joints).items():
        action = bpy.data.actions.new(name)
        rig.animation_data.action = action
        if loop:
            keys = keys + [(seconds, *keys[0][1:])]
        names = sorted({bone for _, pose, _ in keys for bone in pose})
        count = round(seconds * FPS)
        for frame in range(count + 1):
            time = frame / FPS
            if loop is None:
                _, pose, at = keys[frame]
            else:
                pose = dict(sample(keys[:-1] if loop else keys, min(time, seconds), seconds, loop))
                at = pose.pop("@")
            for bone in names:
                current = rig.pose.bones[bone]
                current.rotation_mode = "XYZ"
                current.rotation_euler = tuple(math.radians(v) for v in pose.get(bone, (0, 0, 0)))
                current.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone)
            hips = rig.pose.bones["hips"]
            # Bone axes match the armature. Local +Y is the robot's back.
            hips.location = at
            hips.keyframe_insert(data_path="location", frame=frame, group="hips")
        rig.animation_data.action = None
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        track.mute = True
    for bone in rig.pose.bones:
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)


def export(rig, path, image_format=None):
    tracks = rig.animation_data.nla_tracks
    for track in tracks:
        track.mute = False
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
        export_animation_mode="NLA_TRACKS", export_animations=True, export_materials="EXPORT",
        export_texcoords=True, export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression", export_optimize_animation_keep_anim_armature=False,
        **({"export_image_format": image_format, "export_image_quality": 86} if image_format else {}))
    for track in tracks:
        track.mute = True


if __name__ == "__main__":
    out = Path(sys.argv[sys.argv.index("--") + 1])
    out.mkdir(parents=True, exist_ok=True)
    here = Path(__file__).resolve().parent
    bpy.ops.wm.open_mainfile(filepath=str(here / "navegante.blend"))
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
    author(rig)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in rig.children:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "navegante.blend"))
    export(rig, out / "navegante.glb")
