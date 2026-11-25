# Explicit shared object indications

A short mouse click or touch tap on a current public light or bridge selects a
local preview, using existing MML containers, the public camera state and Three
raycasting. A light outline and **Señalar** distinguish selecting from sharing.
Only that explicit action sends a typed command. Camera drag, multi-touch,
virtual joystick and text editing do not share an indication. Scenery/private
preview occludes selection; communication glyphs do not block the referenced
object. Picking requires the existing applied-geometry check for the current
source version. This is a public-geometry screen pick, not gaze or human eyesight.

Both human and native entry use the same `act`/command envelope and current
source, actor and grant checks:

- `focus.set`: canonical `bridge` or existing `garden-…` target, its observed
  `expectedRevision`, and exactly empty `args: {}`. The actor-owned observation
  must contain that same version and it must still be current/alive.
- `focus.clear`: `target: null`, exactly empty args, and `expectedRevision` equal
  to that actor's latest indication `sequence`. It cannot clear another actor
  or erase a newer statement with a delayed clear. Native commands retain their
  original native request through the existing verified port, without a new CLI
  operation or human control emulation. Existing edit permission is required.

Room is the only authority. It keeps one latest statement per actor, at most16
human/native actors, with canonical target/revision, event sequence, actual
server time and bounded existing display name. Replacing/clearing one's own
statement bounds growth; capacity rejects new slots rather than silently erasing
another person's statement. No expiry timer, model wakeup or attention inference
is installed. Older optional-field-free saves load unchanged; preserve a current
compatible writer after using indications, because an older writer cannot round
trip this new optional state.

A shared gold marker labels who **señaló** the object (or how many indications
share it). The bridge uses its authored control anchor. Indications change the
communication journal, never the creation's entity revision. If an entity moves,
changes or is deleted, the original statement keeps its revision and reports
`currentRevision` plus `current`/`revised`/`deleted`. A stale marker disappears;
it never silently follows a changed object. A fresh explicit statement can refer
to its new version. Past frozen observations remain unchanged.

The latest statements enter the server-frozen native situation alongside place,
time, activity, participants, public entities and events. Selecting locally
without pressing Señalar creates no shared statement or native attention.
Client/server capture times and the exact human original remain distinct.

## Worktable pointing

Visitors in miniature can use **Señalar esta pieza** on the selected part of
the shared model. The cue is independent of private selection, hover, section,
rotation and the published table state. It is a five-second presence signal.
Holodeck validates the connection proof, the current table revision and the
exact source edition, scene and part. Each miniature recipient is independently
authorized against Home and the exact edition before it receives the signal.
A read-only visitor can point using the same scope. The room journal, table
checkpoint and native Conversation stay independent of this gesture.

A matching, visible part receives a thin gold outline in the receiving view.
The sending miniature turns its head toward that view's part bounds. The
viewer keeps their own rotation, scene, section and hidden parts. The outline
follows a partial horizontal section and disappears when the remaining bounds
are empty. With reduced motion the outline remains available. Changing the
table edition, leaving its scope or reconnecting drops the cue. Late arrivals
receive no replay.

## Capture and export bounds

The completed native observation is checked after its input association and
bounded client view are attached, with a32KiB ceiling. Capture first removes old
public events, then other indication/participant summaries only when necessary.
`source.partial`, exact `source.omissions` counts and history `gap`/`retainedAfter`
make that loss explicit. All canonical entities, exact speaker and their own
statement are preserved. If the existing canonical original lookup already
knows the paired being, its indication/participant is preserved too. Unknown
binding is explicitly marked `pairFocusBinding: unavailable-at-capture`, without
trusting names or client claims. This remains a bounded structured situation,
not a claim of complete perception or human understanding.

At the worst exercised32-entity/16-participant/16-indication room with a near4KiB
client view, the final capture retained both speaker/pair statements and all
entities within32KiB without omitting any of those bounded current-room facts or sixteen actual typed events. Oversized synthetic history is explicitly truncated before any current participant/indication summary. The unchanged1.8MiB journal and128KiB wire retain their own byte-capacity limits.
GLB and review export omit communication glyphs and private selection outlines;
Nexus media/notes/report context retains its separate authority.

## Qualification

`test/focus.test.mjs` exercises persisted statements, native/human identity and
stale-reference guards, export exclusion and the complete bounded native capture.
`test/world-indication.test.mjs` uses actual Three ray intersections and pointer
gestures. The finite `tools/browser-focus-check.mjs` fixture additionally checks
two real MML clients, desktop click/mobile tap confirmation, cue occlusion,
camera drag, standard touch joystick, typing and resumed WASD, then revision and
own-only clearing against a frozen native context. Its native transport is a
controlled fixture: it proves no actual human acceptance or model understanding.
Conversation drafts remain editable while content context is captured; submitting
an earlier original must not erase or unfocus a different draft entered meanwhile.
