# Authored character motion

Scope: the local presentation of the human avatars and the CompAII robot.
Physics, network authority, the pose protocol, renderer and HUD stay as they are.

## Starting evidence

`2d82a5d` was driven through its actual controller, packaged GLB and
`ToroidalLocomotion` in Node (`tools/avatar-motion/rig.mjs`).

| Route | Teleports | Largest lag | Planted-foot slip, mean / worst |
| --- | --- | --- | --- |
| Interior, player 1.65 m/s | 0 | 1.5 m | 0.58 / 2.89 m/s |
| Interior, player 5 m/s | 1 | 10.2 m | 0.77 / 3.63 m/s |
| Exterior walk, 5 m/s | 1 | 9.5 m | 0.86 / 3.89 m/s |
| Exterior run, 8 m/s | 3 | 9.5 m | 0.93 / 4.01 m/s |

The feet were at ground height. The robot read as floating because its feet
slid, not because of its altitude. Its ground speed was capped at 2.4 m/s
while the player moves at 5 and 8, and past 11 m it was repositioned in one
frame. A clip with one stride length cannot hold contact while it blends with
another, accelerates or turns. A short route does not reach steady gait, which
is why the Matter fixture could not show enough foot travel.

For the humans, yaw followed input in about 0.1 s in the air and at once on the
ground, bank stopped at 10°, the torso was held at its bind pose, and all tilt
pivoted at the feet. The swim pose was keyed by feet depth alone. At the
surface the shoulders are 0.46 m above the water, so reaching arms showed.

## Practice

1. **Block poses first.** Each phrase has anticipation, action, contact or
   extreme, and settle. Storytelling poses are readable in silhouette.
2. **Weight before limbs.** Hips lead, the torso counters, the head keeps the
   line of sight, then arms and cape follow with delay.
3. **Contacts are constraints.** A planted foot keeps its ground point. Legs
   are solved to it. Stride length and cadence follow measured speed.
4. **Time with spacing.** Fast out of an extreme, slow into a hold. Pauses are
   authored: the swim glide, a glance, the beat before an idle gesture.
5. **Respond at once, finish fluidly.** Physics never waits for a pose. Visible
   heading, bank and lean are critically damped followers of real motion.
6. **Three separate questions.** Physics says where the body is. The medium says
   what it is in. Presentation chooses pose, tilt, pivot and blend.

## State gates

`src/avatar-medium.mjs` owns the medium for either character, with depths for
its own body and hysteresis at each edge.

| State | Gate | Presentation |
| --- | --- | --- |
| ground | supported, water below the wading depth | stock gait plus accents, robot foot planner |
| wade | supported, water above the wading depth | ground gait, arms clear of the water |
| surface | floating at draft over deep water | upright scull, prone stroke when travelling |
| submerged | shoulders under water | stroke with a streamlined hold, pitch by travel |
| air | explicit flight, or unsupported | launch, hover, glide and bank, flare |

Edges: touchdown absorbs by impact speed. A hard stop braces and settles.
Crossing the table boundary or any discontinuity resets to a rest state.

## Acceptance

| Check | Bound |
| --- | --- |
| Robot planted-foot drift, level ground, 0.4 to 8 m/s | under 5 mm per contact |
| Robot following a 5 and an 8 m/s player | no repositioning, lag under 5 m |
| Robot foot travel | at least 0.25 m in the body frame at walking speed |
| Robot sole under ground | under 15 mm |
| Human crouch, absorb and brace | ankles within 1 mm of the mixer's contact |
| Airborne 90° input | settled in 0.4 to 1.1 s, bank 15° to 32° in forward flight, no overshoot over 2° |
| Human hands at the surface | below the waterline in every swim and scull phase |
| Frame rate | same result at 60 and 20 fps within the bounds above |
| Reduced motion | no idle, accent, bank, lean, stride or jaw movement |
| Peer | same medium and poses from position and the shared pose cue only |
| Speech | `anchor-mouth` stays unkeyed and returns to rest |
| Cost | under 1 ms mean per character update in Node |

Evidence kinds are kept apart: numeric samples of the runtime modules, Blender
renders of those sampled skeletons, and the actual browser with its own camera.

## Candidate checkpoint, 25 November 2026

Status: implemented and verified headlessly. **Not yet seen in the game
renderer.** The candidate is not packaged, staged, pushed or deployed.

| Part | Source |
| --- | --- |
| Robot clips, 24 | `art/compaii-avatar/motion.py`, packed scene, registered GLB |
| Robot layers, gestures, jaw, blink | `src/companion-figure.mjs` |
| Robot contacts | `src/companion-gait.mjs` |
| Robot placement, medium, bank | `src/companion-avatar.mjs` |
| Medium gates and timing | `src/avatar-medium.mjs`, `src/avatar-motion-curves.mjs` |
| Human phrases | `src/humanoid-flight-poses.mjs` |
| Human blending, pivot, absorb, brake | `src/flight-avatar-animation.mjs` |
| Human trunk and idle | `src/humanoid-ground-accents.mjs`, `src/humanoid-standing-idle.mjs` |

`src/client.mjs` gained one argument, so the robot lowers with a crouching
player. The stock attributed human walk, run and air clips are unchanged.

Measured by `test/character-motion.test.mjs` and
`tools/avatar-motion/companion-samples.mjs`:

| Check | Result |
| --- | --- |
| Robot teleports, nine routes at 60 and 20 fps | 0 |
| Robot lag behind a 5 / 8 m/s player | at most 2.4 / 2.5 m, was 9.5 m |
| Robot planted-toe drift | under 0.2 mm, was 0.6 to 1.1 m/s of slip |
| Robot foot spread while walking | 0.35 m at 0.6 m/s, 0.74 m at 5 m/s |
| Robot lowest sole | at ground height, terrain slopes included |
| Human hands while afloat, both rigs | 10 cm or more under the surface |
| Human bank and pitch on the route | 17.5° and 41° |
| Human 90° airborne turn | settles within 1.1 s, no 2° overshoot |
| Update cost, Node | 0.13 ms human, 0.06 ms robot |
| Cape against limbs, 24 clips | 0 crossings, control detected 108 |

A contact the legs cannot reach ends as a step, so drift is measured over
contacts the planner keeps. During the hand-over from flight legs, a landing
ankle is within 12 mm of the mixer's contact. On entering deep water the wading
arms take up to a quarter second to go under.

The route test runs as local and as peer actor on both bind rigs. Reduced
motion is covered for both characters. The suite passed 398 tests with two
optional skips, and 49 Python tests. `tools/build.mjs` built the bundle. These
runs used Node 20.19.2. The GLB grew from 547,864 to 648,348 bytes.

Contact sheets were rendered in Blender 5.2.2 from the sampled skeletons on the
shipped meshes, from the side and from behind the player. They are local, under
`.state/avatar-motion/`. Regenerate them with:

```sh
node tools/avatar-motion/sequence.mjs avatar-1-bodyA-skin01.glb SAMPLES.json
blender -b --python-exit-code 19 --python tools/avatar-motion/render.py -- SAMPLES.json SHEET.png follow
```

Open before acceptance:

- Chromium, the game camera and the Matter route. This session had no
  permission to start a browser, and none was started.
- Node 24. The selected runtime also needed a permission that was not given.
- Two browsers showing one another, real network interpolation, real colliders
  on stairs and house floors, and a frame cost on a physical GPU.
- The human gait on slopes keeps the stock feet. Foot sliding of the stock clips
  under the host's own playback rate was not measured.
- The robot remains viewer-local. Peers do not see each other's companion.
- Mouths follow a signal level. No phoneme shapes exist on either rig.
- Nicolás's judgement of the motion.
