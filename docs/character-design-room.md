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
In the worktable candidate, enter the studio through its door, approach
the furniture and choose **Usar mesa**. It mounts the rig in the existing
world scene and uses the worktable's miniature movement and local camera.
**Salir de la mesa** or Escape returns control to the visitor in the same
room. The foyer door handles room exit.

The physical table and direct web projection use the same Three.js player
for Navegante and the humanoid rig, Proyección A2UI controls and scoped
review state. Both support compatible clips, play, pause, scrubbing at
30 fps and frame stepping. The web projection also offers front, side and
three-quarter presets. The player starts paused at the physical table,
with reduced motion, or when opening an exact frame link.

Copying a pose link includes the rig and clip content digests, frame
and view. When the served assets have changed, the studio reports
the older edition and resets to the first frame. It does not assign
the old frame to the new asset. Notes created outside the room are
browser-local, bounded to 30 notes. The studio uses the existing shared
authentication and keeps the visitor's active in-world avatar.

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
and a reference clip from the selected rig. Compare A and B on a shared
30 fps timeline that covers both clips. Either side holds its last pose
after that clip ends. The panel distinguishes that held frame from the
comparison time. Playback, links and notes use the same displayed frame and
exact edition.
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
options per page in a menu over the controls. The panel keeps its
placement when the menu fits inside it. The active choice and pending
highlight are retained across resize.

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
room membership. After the server confirms the visitor is outside, the web
viewer offers a browser-local note. If it cannot confirm the room, the Notes
panel offers **Comprobar acceso** and keeps preview and link copying available.
The physical worktable only writes shared notes. Saving a shared note never
falls back to local storage on failure.
A draft keeps the rig, clip edition and frame where writing started.
If the visitor changes poses, the panel shows the draft target. Following a
new presentation keeps that target and the draft text. A shared save with
an unconfirmed response offers **Reintentar**, using the same submission ID
and original pose.

The pose note checkpoint uses the existing atomic `RoomStore` under
`character-pose-review`, with up to 160 notes in a 256 KiB checkpoint.
Retries of the same actor's submission are idempotent. Notes remain stored
across editions. Reading historical notes needs the corresponding edition
to be selected by the application.

## Own-native review on the same room state

Use the existing Holodeck world port in own-native mode while present in
the Character Design Room. The four typed `act` operations use the same
review state as the worktable and browser.

| Operation | Arguments in addition to `type` |
| --- | --- |
| `character-review.current` | None. The response includes the rig and clip catalog and current presentation revision. |
| `character-review.focus` | `expectedRevision` and `pose` to present a frame. |
| `character-review.notes` | `pose` to read its room-scoped notes. |
| `character-review.add-note` | `id` as a UUID, `pose` and `text`. Use the same ID to recover a submission. |

A pose has `rig`, `clip`, `edition` and `frame`. The receiving lane
chooses the actor. The live room and current authority govern access
on every request. Presentation and note writes require the native edit
grant. HTTP and native results share the same revisions, note checkpoint
and exact-edition checks. The camera, selection and unsent text stay local.

## Protected receiving trial

In the existing protected Holodeck, use the admitted human guest and the
house owner's authenticated identity. Both enter through the foyer.
The owner shows the humanoid landing frame from the physical worktable.
The guest opens the same room's review in the direct web projection and
follows that pose. Compare the rig, clip, edition and frame while each
visitor adjusts their own camera. The guest adds an agreed note. The owner
reopens that exact frame at the table, reads the attributed note and checks
that leaving the table keeps the room active. Returning to the foyer ends
access to the room review.

Record the installed package digest and the observed room entry and
readback. Keep fixture identities and temporary copies in technical
qualification. The receiving trial uses the existing Home audience
and room guest list.

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
