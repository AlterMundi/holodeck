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
world scene. In the receiving candidate, the table view is at the miniature
visitor's eye height. Drag to orbit and scroll or pinch to dolly the visitor
around the review point. Movement uses the table's bounds and collisions.
Walking or changing elevation moves the review point with the visitor.
**Salir de la mesa** or Escape returns control to the visitor in the same
room. The foyer door handles room exit.

The direct viewer also offers **Entrar al taller** from the foyer when the
world confirms the Character door. Inside the studio, **Abrir sala 3D**
returns to the same room in the world projection, where the visitor can
approach the physical table and select **Usar mesa**. If the graphics
context cannot start in the direct viewer, **Reintentar** reloads the
same pose link. The available room and return links remain usable.
When WebGL is interrupted during a review, playback pauses and the
navigation remains usable. Graphics restoration brings back the local
frame and any unpublished note draft in the same tab.

The physical table and direct web projection use the same Three.js player
for Navegante and the humanoid rig, Proyección A2UI controls and scoped
review state. Both support compatible clips, play, pause, scrubbing at
30 fps and frame stepping. Open **Vista** for front, three-quarter and
profile presets, or orbit freely. Each visitor keeps their own angle.
Leaving the physical table restores the visitor's previous world camera.
The player starts paused at the table, with reduced motion, or when
opening an exact frame link.

Copying a pose link includes the rig and clip content digests, frame
and selected view preset. When the served assets have changed, the studio reports
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

The worktable candidate also includes **Marcha, frenada y reposo**. It
samples dry-ground motion at 30 Hz using the toroidal controller, the MML
idle/walk blend, the live stock idle and jog assets, and the humanoid
pose adapter used in the world. **Fase** seeks to ground support, the
start of stride, release and settling. Sharing one of these poses pins
both animation inputs and the sampler revision, so the web projection
can reopen the same frame.

The pose link pins the rig, stock animation and the browser-compiled
sampler code. Visual-only terrain changes such as woodland shading preserve
the edition. A change to a physical input used by the sampler, such as
the water level, generates a new edition. The first build using this
fingerprint assigns fresh editions to the generated studies. Use the
selected previous build for links saved against the old fingerprint.
Two separate fixture actors reopened the same
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

The full desktop web panel reserves room for the complete pose and note
action labels alongside the rig. The table and compact displays keep
their sectioned controls.

## Studio on compact displays

The compact HUD groups controls into **Pose**, **Clips**, **Comparar** and
**Notas**. Portrait places the rig above the controls. Short landscape
places them beside it. The same Three.js controls use the same playback and
room actions across layouts. The host fits the active panel to the viewport
and keeps its text at screen density. It keeps 46 px plates for the base
controls on a 390 px portrait viewport. Short viewports show one or two
options per page in a menu over the controls. The panel keeps its
placement when the menu fits inside it. The active choice and pending
highlight are retained across resize. Escape dismisses a spatial choice
without selecting it or leaving the tabletop. A separate Escape press
can then leave the table.

The physical table widens its panel on short touch-landscape screens and
keeps the lower locomotion targets clear. The note and playback sections keep
their original labels. The desktop scene anchors the offered E action above
the nearby Character table and hides the label when the table opens.

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
The physical worktable only writes shared notes. If a room request is denied
while a review is open, the viewer clears the loaded notes, keeps the pose
preview and offers **Comprobar acceso**. The visitor can check again after
returning to the room. A pending shared submission keeps its original pose
and ID. Saving a shared note never falls back to local storage on failure.
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

With the exact candidate archive `15ed1ac8a65e` and its protected
predecessor `df929b9352b3`, an isolated rollout wrote a presentation and
one note at flight frame 36. The predecessor reopened the same room
placement, served reciprocal travel to the foyer and left the review
checkpoint byte-for-byte intact. Reinstalling the candidate restored the
exact presentation revision, edition, frame and attributed note. A retry
with the original note ID still returned one note. This covers code
rollback with retained state. Protected activation and authorized world
participation remain open.

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

## Packaged browser check

Build and stage the exact candidate with the deployment runtime (Node 24).
Use an existing Playwright module with its installed Chromium, or set
`HOLODECK_CHROMIUM` to the selected executable.

```sh
npm run build
node deployment/build-package.mjs "$PWD/.state/character-review"
HOLODECK_STAGE="$PWD/.state/character-review" \
  HOLODECK_PLAYWRIGHT="/path/to/installed/playwright" \
  HOLODECK_EVIDENCE_DIR="$PWD/.state/character-review-evidence" \
  node tools/browser-character-review-check.cjs
```

The loopback check runs the staged server with separate browser and
own-native fixture identities. It prints the confirmed pose and revision,
saves one screenshot, and closes both clients. It exercises the native
presentation, browser follow, exact-frame note readback and room exit.
It also opens Conversation at the physical table. Opening the panel
preserves the locally displayed rig, clip edition and frame while the
table is suspended. Preparing an original includes that selection as
`referredCharacterPose` in its machine-authored situation. The room
checks the reported pose against its installed catalog and requires
current room access for both sender and recipient. The capture leaves the
shared presentation alone and grants no new editing rights.

The Conversation surround can also select the table as the room topic.
This is a separate, visitor-local room object reference. The capture
checks the room and the table's current revision, so the recipient can
resolve both the table and the exact animation frame.

The world port exposes the reference on the retained Conversation original
after canonical admission. The paired daimon can use the ordinary room
approach and, once in the studio, call `character-review.notes` for that
exact edition and frame. The same action list offers
`character-review.add-note` when the daimon has room edit rights. The
receiving writer keeps the daimon attribution and the ordinary idempotent
note ID. The browser reads the note from that frame. The shared
presentation and visitor-local cameras are independent of this action.

The protected receiving trial below qualifies the real identities and
world.

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
