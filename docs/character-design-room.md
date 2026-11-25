# Character Design Room

Review original character rigs and poses in Holodeck, where the human
and daimon can discuss the same frame. Use strong poses, anticipation,
weight transfer, arcs, secondary motion, controlled holds and readable
transitions as the animation quality bar. Masko's documentation
demonstrates clips driven by named inputs and a released graph.
Holodeck's rigs, curves, meshes and visual design are original.
[Masko player](https://masko.ai/docs/player)

## First playable review

The toroidal Atelier has a foyer with doors to the Matter room, Harmonic
Lab and the Character Design Room. The studio's return door moves the actor
back to the foyer through the same authorized spatial navigation. Exact pose
links remain independently reviewable through the protected Holodeck entry.
The studio opens a Three.js view with the shipped Navegante and a humanoid rig.
Proyección A2UI controls select the character and compatible published
clips, play or pause, scrub the sequence at 30 fps, step a frame,
and select front, side or three-quarter views. The view starts paused
under reduced motion or when opening an exact frame link.

Copying a pose link includes the rig and clip content digests, frame
and view. When the served assets have changed, the studio reports
the older edition and resets to the first frame. It does not assign
the old frame to the new asset. A frame note stays in the current
browser, bounded to 30 notes. This draft uses the existing shared
authentication and does not change a visitor's active in-world avatar.

## Motion studies candidate

The next candidate includes Navegante's reauthored Blender library and two
humanoid motion studies. In the humanoid selector, the flight study samples
takeoff, banking and the landing. The swim study samples the surface, dive and
return with a visible water plane. Both run the same toroidal locomotion and
humanoid pose adapter used by the game on a private preview rig at 30 Hz.
The camera keeps the subject centered. The human walk/jog/run source clips
remain separately selectable. The robot's original clips and its live planted
gait are distinct, so the raw walk and run in the studio carry explicit clip
labels. Inspect planted contact in the running world.

The pose link pins the rig and a revision derived from the scenario, stock
asset and pose implementation. Two separate fixture actors reopened the same
flight image at frame 78. Stepping backward restored the same image again,
and a mismatched digest reported an earlier edition and reset the frame.
The swim viewport rendered frame 94. Browser-local notes remain separate.
This is a candidate and does not establish signed-in participant acceptance,
a synchronized presenter or the final quality of the in-game animation.

## Shared session and authored motion

Track the [Character Design Room #24](https://github.com/AlterMundi/holodeck/issues/24)
and [rig-specific motion #21](https://github.com/AlterMundi/holodeck/issues/21).

1. Integrate the exact current robot and humanoid motion revisions.
   Show direction, idle, anticipation, action, settling and return
   as named poses and transitions. First qualify contact in walk
   and landing and visible immersion in wade and swim.
2. Store pose comments in the owning shared review resource, tied
   to the exact rig, clip digest, frame and optional joint. Bind
   each comment to its real author and enforce the room's audience.
   Resolve earlier editions through the existing exact-version viewer.
3. Add explicit presenter and follow controls with independent local
   cameras. One participant selects the reviewed frame and the other
   can inspect it, point to a joint or pin a counter-pose. Preserve
   access boundaries and avoid replacing drafts when someone enters.
4. Use normal game geometry to verify the approved motion from the
   player and a second visitor's view. Publish a selected edition
   explicitly, leaving known-good motion and previous notes available.

Acceptance uses real synchronized choices between separate browser
sessions, an annotated pose on each rig and readback of the exact same
image or pose transforms after reopening. Animation quality review
checks silhouette, contact and loop seam, then timings and transition
continuity in the actual running game.
