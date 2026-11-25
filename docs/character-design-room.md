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

## Motion studies

Protected release `3fd63da1fd1d` includes Navegante's reauthored Blender library and two
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
The two-fixture test concerns pose links. Independent signed-in reviews,
synchronized presenters and the final quality of in-game motion remain open.

## Comparing motion in the viewer

The optical controls provide local orbit and zoom, playback speed and loop,
and a reference clip from the selected rig. Compare A and B against the same
primary timeline. A shorter reference holds its last pose. Links and notes
refer to the visible clip or study, its exact edition and its displayed frame.
Switching clips restores the rig's neutral channels and resets the waterline
before the other playback owns them. Camera angles remain local.
The flight study adds a **Fase** selector for support, takeoff, hover,
the turn cue and the first ground contact. These bookmarks come from the
sampled control and contact state. Selecting one pauses playback and seeks
to its exact recorded frame.

## Studio on compact displays

The compact HUD groups controls into **Pose**, **Clips**, **Comparar** and
**Notas**. Portrait places the rig above the controls. Short landscape
places them beside it. The same Three.js controls use the same playback and
room actions across layouts. The host fits the active panel to the viewport
and keeps its text at screen density. It keeps 46 px plates for the base
controls on a 390 px portrait viewport. Short viewports show one or two
options per menu page before the panel falls back to scaling. The active
choice and pending highlight are retained across resize.

Section selection is browser-local. Switching sections preserves an
unpublished note and its caret. Publishing still requires the ordinary
explicit action in the current room. Orbit, zoom and playback selection
are independent of the visible controls.

## Room-scoped pose notes

Enter the Character Design Room through the Atelier to share a note or read
the current pose's notes. Holodeck checks current room access on every
read and write. A note binds the exact rig, clip, edition and frame. The
build generates its accepted pose catalog from the shipped rig and animation
bytes together with the compiled motion-study revision. The server validates
the submitted pose against that catalog and takes authorship from the current
session. Camera angles remain local.

**Mostrar pose** confirms one current clip, edition and frame for the room.
**Ver pose del Taller** loads that exact selection on demand with the
visitor's own orbit and zoom. Holodeck rejects competing writes based on
an older presentation revision. A newly selected rig release makes the
previous presentation unavailable until someone presents a current pose.

The **Ver notas** action reads the selected pose on demand. A copied pose
link can be opened outside the room. Shared feedback still requires current
room membership. The existing browser-local note option is available
outside. Saving a shared note never falls back to local storage on failure.

The pose note checkpoint uses the existing atomic `RoomStore` under
`character-pose-review`, with up to 160 notes in a 256 KiB checkpoint.
Retries of the same actor's submission are idempotent. Notes remain stored
across editions. Reading historical notes needs the corresponding edition
to be selected by the application.

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
