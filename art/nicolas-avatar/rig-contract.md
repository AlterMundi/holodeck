# Explorer rig contract

The explorer is a playable human on Holodeck's existing MML human armature.
Navegante and the explorer share motion semantics, medium and contact
conventions. Navegante is a different body driven by its own clips, local
follower and foot solver. Do not use the robot's bone names, proportions,
root travel or clip names as the explorer's animation interface.

## Body and runtime

- Keep the imported stock human joint names, parent hierarchy, local rest
  transforms and compatible inverse bind matrices. In Blender preserve the
  imported armature basis and size. Export glTF with Y up, +Z forward and
  the avatar origin at the soles. Avoid gratuitous scale or root transforms.
- Bind the original meshes to that skeleton. In particular keep `root`,
  `pelvis`, `spine_01` through `spine_05`, the neck and head, clavicles,
  both `upperarm → lowerarm → hand` and `thigh → calf → foot → ball` chains,
  with the original twist and hand joints. The flight retargeter uses the
  inverse binds to derive segment axes. The stock AnimationMixer feeds the
  baseline playback. A missing foot or altered rest axis causes visible
  motion defects even when the export opens.
- MML owns position and base animation. Holodeck layers cadence from
  actual travel, planted crouch, turn, lean, idle, boost, wade, swim and
  landing over those poses. The world supplies support, waterline and own
  motion cues. Keep Blender animation in place where needed. Use shared
  contact and timing tests, with no new movement or network protocol.
- Bind armour and the jetpack rigidly to their actual attachment joints.
  Bend the coat across the existing spine and give lower panels clearance
  in stance, crouch, swim and flight. A decorative bone or shape key must
  leave the original hierarchy intact and remain independently editable.

## Eyes and face

Nicolás asked for an iris mixing green and honey, and a tender, cheerful
default gaze. Use readable muted green through the outer iris and amber
honey around the pupil. Use gentle upper lids, relaxed brows, lifted cheeks
and a slight smile in repose. Leave a broader grin as an expression.
Use original opaque geometry and materials, with no portrait texture.
Check the eye colours both in the close render and at game distance.

The humanoid runtime reads a GLB morph target named exactly `jawOpen`
on the affected facial meshes. Keep the default weight at zero. Let the
chin and beard follow the mouth where relevant. Preserve the key through
any material batching and export. Navegante uses an independent unkeyed
`anchor-mouth` joint for the equivalent speech layer. A visually correct
idle and an independent speech aperture are common to both interfaces.

## Verification

Compare the export to the stock joint names, hierarchy and rest
transforms. Run the existing Three.js walk, flight, boost and swim
studies against the candidate. Inspect feet and accessories in stride,
crouch and flight poses and confirm both default expression and speech
aperture. Verify presentation on two independent clients and physical
Normal/Livianos before a live appearance change.

Source owners: `src/flight-avatar-animation.mjs`,
`src/humanoid-flight-poses.mjs`, `src/humanoid-ground-gait.mjs`,
`src/humanoid-crouch.mjs`, `src/humanoid-microphone-mouth.mjs`,
`src/avatar-medium.mjs`, `src/companion-figure.mjs` and
`src/companion-gait.mjs`.
