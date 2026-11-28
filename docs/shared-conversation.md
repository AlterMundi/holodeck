# Canonical Conversation inside Holodeck

Human direction20November: directly reuse Conversation rather than repeatedly
copy text, microphone, transcription, original-file and chat behavior. A compact
presentation is permitted; ownership of those features remains Conversation.
Beacon work is explicitly elsewhere. This document owns the integration seam,
not a new goal or a claim of delivery.

## Current state

Holodeck directly embeds canonical Conversation at the
[protected entrance](https://compaii.dmn.homes/holodeck/).
[Current package and receiving evidence](STATUS.md#selected-receiving-release)
are tracked in the release record. An interior Conversation attachment freezes
the authorized room and its garden state under `place.activity`. A subsequent
native observation through the same authorized interaction reads current state
under `space.activity`, even while the observer remains elsewhere. The remote
view sets `canPlay` false. Playing still requires being in the room and having
edit rights. Current room access applies on every new observation.

Canonical Conversation PR926 supplies the hosted surface; PR927/source dd5c0e61
freezes text/audio before asynchronous attachments and adds safe source-only
discard. PR928/source8f643135 fixes the authored mobile margin inside the frame.
The original activation used seven exact HTTPS origins. The current
configuration has eight paired routes and eight exact origins. CompAII,
Eko, Oliva and Emma have the selected routed proof receiver. The remaining
four are covered by the existing service-stop hold. Configuration and
receiver readback do not qualify a production situated original. See the
[active trial coverage](ROADMAP.md).

112Node checks and31Python checks pass, with one unchanged optional gallery skip.
Actual canonical shell/assets in the walkable browser fixture passed desktop/
mobile text and file submission, delayed viewer/file work, exact initial capture,
continued walking, next-draft retention, one mounted frame and forged-envelope
refusals. Screenshots were inspected and controls fit after the CSS correction.
The canonical recorder's unchanged cue tests cover10,5,3,2,1seconds and no catch-up
burst. These synthetic checks are not physical microphone/hearing or real human
conversation acceptance. Nicolas explicitly resumed the full existing MVP22November. Continue that
active objective; specific acceptance observations remain separate and do not
require another generic trial before implementation can continue.

## Ownership and required shared hook

Conversation owns human text, recording/transcription, original file bytes, draft/
recording/upload/unknown-outcome recovery, actual submission and native progress.
Holodeck owns the world view and its immutable machine-authored situation, including
the actual native world-port descriptor. Those facts are not human speech.
No parent/world broadcast receives the pair's unrelated private conversation.

The shared component must allocate the original ID and freeze its native binding
before asynchronous context/attachment work, for both text and audio. Capture
client world view at the user interaction boundary; separately timestamp server
context preparation. For audio, prepare context at the start of capture, before permissions and slow
attachments. Cancellation before any writer attempt sends a source-only discard
hint; the bridge separately verifies canonical absence before releasing its local
reservation. Canonical original files are never deleted by Holodeck.
Keep one ID, exact attachments/context and one canonical send throughout retries.
The canonical8-file/40MiB budget remains authoritative; context occupies a declared
slot rather than silently exceeding it. Do not invent another login, audio service,
provider choice or automatic model turn.

The canonical surface uses the registered paired Home entry with
`view=conversation&client=standalone&surface=holodeck`, exact `surface_parent`
and a random `surface_visit`. It retains relative APIs, CSRF, shared Home login,
microphone and recovery. Holodeck creates one iframe lazily on Conversar and keeps
it mounted when returning to the world. Only exact selected Conversation origins
receive microphone/autoplay delegation; the ordinary world sound switch still
controls world audio, not the recorder or voice playback.

`conversation.surface/v1` pins source window, origin, visit, channel, actor and
binding. Child ready → parent connect precedes prepare. Prepare carries the
original ID, modality and bounded remaining capacity; parent prepared returns
only its ordinary five-field file reference. The optional discard hint may release
machine preparation only after a canonical-absence read, and never after an
unknown write. Status sends only original ID, phase and busy: no chat body,
transcript, audio or unrelated history crosses frames. It is not admission proof.
No arbitrary browser app_context is accepted as authority.

## Implemented world-side source seam

NativeBridge exposes these existing-owner, UID-restricted operations:

- surface: registered paired Home/Conversation URL plus current binding metadata;
  no native coordinates, credentials or provider configuration are returned.
- prepare-context: exact actor/frozen binding/original ID/observation. Reuses the
  existing file writer and holodeck.native-situation-source/v1, returns a normal
  verified file reference with work_admitted:false. Never calls input_submit.
- context-selected status: verifies that the actual canonical original retains
  the exact prepared file and observation, then revalidates current binding.
  Legacy historical status reads retain their existing contract.

The existing receiving native-route mux keeps each operation on that pair's fixed
lane. src/conversation-context.mjs retains only machine-source preparation, with
at most32records and1.8MiB each current/stage file, inside the existing32MiB world
quota. Combined room/legacy-native/context-source/session bounds remain below that
quota. Canonical files use the existing owner limit of1024files/256MiB, refusing
capacity rather than deleting originals. No human text/audio or separate transcript
history is copied into this ledger.

Freeze source before upload. Missing acknowledgment retries the same retained
observation; changed actor, binding, source, room or reused canonical ID refuses.
The explicit own-ID context retry resumes its retained request hash, frozen
binding and observation directly, including after ledger reopen. It never
reconstructs the original request from optional clientReportedView: that view can
omit all detail for capacity or exclude a separately resolved history reference.
A changed world does not recapture or relabel the old source. Current actor,
binding and run checks still apply; a removed source refuses recovery rather than
creating a replacement. Retrying an already prepared source returns its same file
receipt without another upload. This repairs machine-source recovery only; no
human original is resubmitted and an uncertain writer outcome is not replayed.
Confirmed retained canonical terminal results release local source capacity.
Explicit pre-writer cancellation can release a machine reservation only after
canonical absence is verified; unknown preparation is not silently evicted. The actual original/file remains
with Conversation. A source ledger/URL/prepared file alone grants no world action.
Native world access also requires observed canonical admission, exact source/file,
current pair/binding/run, expected being return lane and current room permission.
A rebind during status observation is rechecked before authority is returned.

The optional world APIs use the current Home session and existing Origin/rate
checks: GET api/conversation-surface, POST api/conversation-contexts, and own-ID
recover/retry/release/discard. Return only source references/binding, not machine-file
bytes, private native descriptors or original content. Context failures are marked
machine-context; they never claim the human original was absent or safe to replay.
These APIs remain unavailable when the shared capability is not selected.

## Qualification and activation

The Node/Python regressions cover source-only preparation, scope, exact file
admission, current-binding races, cancellation without touching originals, frame
protocol isolation and initial-position capture during delayed content preparation.
Browser qualification must exercise the actual canonical shell and components,
including text, audio, files, alerts, movement and keeping drafts/capture mounted.
Synthetic local I/O is never a real participant/provider acceptance claim.

Selection uses `receiving.sharedConversation: true` after the seven compatible
native bridges and the canonical early-capture/discard correction are installed.
Configure `receiving.conversationOrigins` with at most eight exact HTTPS origins
from the actual paired receiver URLs. These select permissions delegation, not
new identities or access grants. The existing service/package writer deploys the
world consumer. Preserve the actual predecessor and current state.

In shared mode, old new-message admission is disabled. Existing retained legacy
IDs retain status and exact-original recovery. Conversation owns all new sends;
there is no fallback recorder, copied chat UI or parallel native writer.

Physical phone/microphone/hearing acceptance and the full shared MVP trial remain
separate. This work does not resume the blocked umbrella goal or create another
human pending item. Beacon work is explicitly outside this session.


## Indoor source contract

### Topic explorer

The **Topics** control opens the current pair's topic directory from the
ordinary Holodeck entrance, including without a house. The existing
authenticated Conversation frame reads the Gateway Session Workspace
projection and returns bounded room summaries to the exact bound host.
Holodeck reads the selected room again before showing its current entry.
Discovery and selection use only reads. **Entrar a la sala** performs an
explicit navigation through the existing MML rendering and presence flow.
These actions neither route input nor start a model turn.

Build the client before running `test/shared-conversation-host.test.mjs`.
Set `HOLODECK_PLAYWRIGHT` to the installed Playwright Core module and
`HOLODECK_CONVERSATION_SURFACE` to the compatible Gateway
`dashboard/web/conversation-surface.js` to include the narrow-screen browser
fixture. It uses both actual frame implementations and a controlled
catalogue. Gateway independently verifies the HTTP workspace scope.

The owner route `GET api/topic-space?room=...` reads the exact logical topic
through the paired native bridge and returns one room using the
existing MML interior renderer. The bridge reuses the current owned Gateway
topic reader with the explicit shared Home workspace grant. The HTTP host
rechecks the visitor and current place after the returning read. The room
definition needs no house. The same route accepts an explicit entrance
with the current place and exact topic reference. The live visit keeps the
preceding physical place as its exit destination while that place remains
authorized. Generated room visits are bounded in memory and reuse the
existing socket authorization check. The browser recovers a lost move
response by reading current location. The browser fixture enters and leaves
an actual generated MML room.

Inside that room, **Conversar** opens general Conversation. The existing
machine-source writer freezes the authorized logical topic and room name at
intake under `structured-topic-room`. Moving or leaving after capture
keeps the same context and general destination. Reopening the retained
source checks the exact topic and current pair. The topic attachment
does not grant a physical world action scope or select direct routing.
The isolated HTTP fixture moves to another topic before preparation
resolves, then verifies the original context and its single retained
attachment. Project surfaces and live original delivery remain open.

A shared Conversation iframe can stay mounted while a human closes its
panel and moves between allowed rooms. New indoor sources freeze the
server-selected room at preparation intake, before waiting for the
canonical Conversation binding and file writer. The client's captured room
ID is a match check. Ordinary movement after intake does not replace the
frozen place. Recover and retry preserve the exact source.

The source names the room, level and local objects, with scoped presence
and an optional exhibit revision. The **Tema** selector lets the visitor
choose a fixture or workstation, or continue with the room as a whole. A
selection persists while walking in that room and clears upon crossing to
another room. At intake, the server matches the object's exact ID and
revision against the authorized room catalogue, then records the catalogue's
title, kind and position. A stale object selection yields the room context
without the object. A source already prepared retains that exact earlier
topic through a move, design change or later selection.
Gallery topics name the physical displays regardless of edition visibility.
They contain no Nexus pin or protected source metadata. The deployed source also retains the
room's signal-garden revision, sequence and derived progress at intake.
In the packaged test, the room recipe changes while the writer waits, and
the retained source still contains the original round. The observation is
scoped to the authorized room. The paired
daimon must hold both current app observation and room access. A situated
native read after observed canonical admission resolves only that room.

The same admitted turn can place a `garden.signal` in the captured room if the
daimon is currently there, holds its own edit grant and the turn is still working. Use the current recipe
revision and a command ID. `result` with that same ID and interaction recovers
the exact receipt, including after departure while access still holds. The
server separates command IDs by interaction, so a sibling turn cannot read
or replay that command's receipt. After canonical completion releases the
prepared source, the native route still accepts that exact `result` call.
It rechecks the original and attachment, the current pair and both room
grants. This read-only route exposes neither the room observation nor a
new action. The context ledger retains up to 32 recent indoor receipt
references within its existing 1,800 KiB limit. The oldest references
give way to active preparations and newer completions. The garden's
own receipt limit still applies. The index contains no chat text or room
snapshot and survives a restart on the same world run.

If the daimon starts elsewhere, `observe` can include `approach` with the
next permitted `from` and `to` on the route to the captured room. This
requires a currently working turn, fresh room access and the daimon's edit
grant. The daimon may explicitly pass those two fields to `act` with
`type: "space.move"`. Each call moves through one existing passage and
returns only its endpoints. Observe again to confirm the current position
and obtain the next passage. The route ends at the captured room and
offers no approach after the turn finishes. The same observation carries
`actions` with currently available typed command arguments. For a passage,
pass its `args` to the named `operation`. For a signal, add a fresh `id`
when the entry requests it. The observation suggests unfilled targets or
the available targets when the round still needs a contributor. Observe
again after moving or changing the garden. These are suggestions from
current scoped state, and the receiving writer still checks admission,
room access and revision. The human's location and
retained original are independent. Other indoor mutations still use the
own-native routes. Exterior edits and projections remain outside this turn.

#An acknowledged indoor Nexus visit can accompany the selected room object in
a situated original. Holodeck freezes the current room and placement
revision as preparation begins, checks the speaker's exact source edition
through Nexus, then retains only the approved placement reference in the
attachment. The reference omits the source pin, locator, caption and content.
Room access alone never grants the paired recipient source access. A stale,
unavailable or denied visit is omitted while the original may still retain
its authorized room context.

## Return to the same Conversation

The [browser qualification](../tools/browser-situated-action-check.cjs) uses
the selected Holodeck package, the installed canonical Conversation web client,
the real Holodeck context ledger and world socket, and synthetic I/O for the
canonical writer, admission and final messages. Two independent Chromium
actors contribute to the scenario. One uses the touch controls to set the
first signal. The other submits through Conversation and continues moving
while the original's machine attachment is held. The actual CLI follows
two authorized passages and applies the second signal under that exact
admitted fixture interaction. Both browsers
see completion. The original action receipt is recoverable with the same ID
and unavailable to the sibling interaction.

The fixture delivers the sibling final first. The original remains open and
its context remains retained. Reopening and refreshing the same iframe shows
the original's final once, and the touch browser can reconnect to the completed
garden. After explicit source release, the original retrieves the exact
receipt again. A sibling, a new action and a full room observation are
refused on the completed route. The public scene exposes the game effect without exposing either reply.
The same fixture checks that every rendered line of its short final is
within the transcript viewport at four screen sizes, and that returning to
the world and reopening preserves the same frame and draft.
This covers the browser and world/Conversation handoff with synthetic
admission and final text. In a separate Telecodex qualification,
`foreground_capture` exercised native final-event projection through the
actual owner and isolated SQLite with a synthetic peer.

The optional foreground model trial keeps the browser participants and
canonical admission simulated. An actual Codex model reads the exact fixture
original and its immutable room source, explores only through the scoped
native CLI, and supplies its own answer. The browser harness independently
reads the scoped receipt and projects the model's exact answer into the
Conversation client. In the 23 November trial the model found the two permitted
passages, chose the missing mint signal in the foyer and observed two
contributors and a complete garden. Both browsers showed the effect and the
reply was rendered once under the original. The receipt survived release.
The isolated direct-owner probe then exercised canonical ingress and
final-event projection through the actual Telecodex owner, dashboard
Provider and Holodeck NativeBridge. The opaque attachment did not admit any
work. The ordinary submit admitted exactly one original, preserved the
attachment and rejected a forged hash. The owner published one final
under that original after receiving a simulated app-server event.
The standalone probe uses a fixture identity and peer.

The combined mode uses the same actual Telecodex owner and the installed
Conversation web client while the browser adapter supplies temporary HTTP
and identity. The model receives the exact fixture original and full room
observation sourced from the retained attachment referenced by its actual
`turn/start` packet. The adapter verifies file ID, MIME, size, hash, byte
equality and the world CLI descriptor scoped to the original. It waits
for observed native admission and working status. At the native event
boundary, the isolated peer sends the model's exact answer and the owner
publishes it. The browser reads that actual publication and the scoped
receipt remains recoverable after release. The sibling goes through a
separate serial turn and cannot read the first receipt.

On 23 November this mode verified the same original across attachment,
two authorized passages, the model's mint signal, the matching world
receipt, both Chromium views and one native answer. The foreground model
was a real Codex participant. The provider peer and its event delivery
were simulated under the local owner. This does not qualify a production
native provider or a physical touchscreen.

```sh
python3 tools/check-canonical-conversation-owner.py \
  --telecodex-source "$TELECODEX_SOURCE" --telecodex-binary "$TELECODEX_BINARY"
```

An earlier owner reports transport-accepted routed work as queued until
a covering result appears. The new optional `active_execution` observation
links the exact instruction, explicitly selected target and live native
execution. The bridge accepts a single valid proof and carries its local
turn to Holodeck. Before a situated write the world checks that the exact
instruction and turn are still running, after reading the current app
grant. This is a fresh observation between services. It preserves the
direct path and read-only terminal receipt recovery. An unselected fan-out,
stale proof or transport acceptance alone leaves the turn without write
authority.

Use the existing package stage and installed Conversation/Playwright assets.
Select a task-owned evidence directory and a short-lived loopback certificate
(`key.pem` and `cert.pem`). The test starts two ephemeral listeners and browser
profiles and closes them when done. For the foreground model variant, set
`HOLODECK_MODEL_HANDOFF` to a fresh private empty directory. When the fixture
original exists, the harness atomically writes `request.json` with the input,
immutable source, exact interaction ID and local CLI and socket coordinates.
A foreground model participant uses the scoped CLI and atomically writes
`answer.json` with `original`, `commandId` and `answer`. The harness
waits at most four minutes and checks the actual effect before projecting the
reply. Remove the handoff files after retaining the scoped result.

For the combined mode, also select the Telecodex source and an already built
release binary with `HOLODECK_TELECODEX_SOURCE` and
`HOLODECK_TELECODEX_BINARY`. The Python adapter uses the existing
`conversation_input_control_io.Inputs` fixture to run the actual owner in a
temporary root with synthetic Telegram, identity and app-server. Keep its
socket local to the packaged world under test. The mode needs neither a
provider account nor a deployed receiver configuration.

Set `HOLODECK_ROUTE_NATIVE=1` to exercise the selected-worker path. Use a
matched Telecodex source and binary that expose the active-execution proof
in the original's trace. The loopback owner creates a separate fixture work
topic, and the browser selects it using the existing canonical selector.
The test checks that the selected worker receives the original and exact
attachment, that the world observes the required proof for the action, and
that the same instruction covers the final after its live proof disappears.
It keeps the second fixture original on the direct path. On 23 November
the scripted CLI run and the separate foreground model run both passed.
The model crossed the two offered passages, detected amber already present
and placed the missing mint signal. The two simulated browser participants
saw the completion. The real isolated owner returned the model's exact
answer once after the simulated provider sent a covering result. A
different original could not read the action receipt, and the correct
original recovered it after releasing its source. Production routing and
physical-device acceptance remain separate.

The harness overwrites the two captures and one
structured result in that directory on repeated checks.

```sh
HOLODECK_STAGE="$PACKAGE_STAGE" \
HOLODECK_PLAYWRIGHT="$PLAYWRIGHT_INSTALLATION" \
HOLODECK_CONVERSATION_RELEASE="$CONVERSATION_RELEASE" \
HOLODECK_FIXTURE_TLS="$FIXTURE_TLS" HOLODECK_EVIDENCE_DIR="$EVIDENCE_DIR" \
node tools/browser-situated-action-check.cjs
```

Room access alone does not authorize an exact protected gallery reference as
a Conversation attachment. The visitor catalog checks Nexus with the human
visitor's session. Sharing the edition locator with a paired being requires
an independent check of that being's access to the exact table and version.


A Matter worktable reference from an admitted original is available on that
original's active native return lane as `referredWorktable`. It matches the
edition, scene and part in the prepared attachment. Later changes to the
table do not replace it. This observation grants no Home viewer permission
and provides no geometry. Other originals and ordinary room observation
do not include the speaker's reference.

In a short landscape viewport, the workshop Conversation panel uses the
available horizontal space within the display safe area. The regular
side panel and the phone portrait rules continue to follow their respective
layout constraints. The selected-worker browser fixture checked the full
reply and its close control at four viewport sizes.

## Direct conversation in a topic room

A generated topic room opens general Conversation by default. The visitor can
choose to talk directly to the current topic or return to general Conversation
without leaving. The frame resolves the current authorized Session Workspace
destination. Holodeck shows the confirmed audience and restores the general
audience on departure or when a fresh Conversation document connects.
The general companion portrait steps aside after the frame confirms direct
mode. The topic name remains visible as the recipient. A return to general
Conversation restores the portrait in the same room. The avatar uses the
paired being's registered artwork, with a companion light as its fallback.
Reduced-motion settings remove the transition. This indicator is local to
the visitor, and the visitor's drafts and sends stay in Conversation.

A mobile Chromium fixture exercises entry, direct selection, return on exit
and refusal after room discovery is revoked through the real frame protocol.
The selector in that browser fixture is controlled. The Session Workspace
fixture separately tests the actual destination selector and exact reference.
Native admission and the corresponding return for a direct original still need
live acceptance.

### Projects in a generated topic room

The project table reads the paired Gateway's current topic checkpoint on
each opening. Repositories are grouped under their project identity and
display their exact linked Git commit. The visitor can move among pages
without leaving the room. The active room and current source access are
checked on each page. If the catalogue changes while paging, the table
returns to the refreshed first page. Closing the table or leaving the room
discards its browser view. A backend without the project reader reports the
table unavailable. Opening a project from the table rechecks its selected
repository link and shows only the project's currently visible repositories,
including those outside the visible table page. Returning to the table
reads its catalogue again. The view is read-only. The room draws one
door per project represented on the first catalogue page, on entry and
on a fresh first-page table read. A door opens the same project view and
rechecks the selected link. The scene owns the displayed doors and
discards them on departure. Additional projects remain accessible through
the paged table. Separate project interiors and editing surfaces remain
part of the topic-room roadmap.

On a table read, the exact visited room can also receive the paired
Gateway's current work observation. The status shows observed work or
queue activity, retained human questions and the presence of a canonical
result. A stale native observation does not say that the daimon is
working. The catalogue, other rooms and older owners receive no new
details. The table reads no details. The table reads no transcript and starts no turn. **Ver resultado
del topic** opens the current result through the paired Conversation frame.
Only the selected room and a correlation reference cross into the frame.
Conversation reads the retained result and opens it without changing the
recipient or composing a reply. Leaving the room or closing the panel
cancels the read. Answering a question still uses Conversation's own controls.

The project view offers the questbook when the project is the one selected
by the receiving card writer and the visitor has its read grant. Its pages
and revisioned actions revalidate the room and the linked repository before
using the same DaimonCards writer as the workshop journal. The writer
continues to enforce the individual card and edit grants. Leaving the
topic closes its journal. No new card store or model work is required.

The receiving card writer supplies at most eight exact revision candidates
from the selected mission privately to the owner-side host. For candidates
missing from the current page, the host asks the already-authorized project
reader to resolve retained Git evidence and rechecks the room and card
access before rendering. The browser receives only the revisions matched
to that mission. An expired citation, another project's repository or an
unregistered commit cannot be rendered as project evidence. A displayed
historical commit refers to verification at registration, with current
visibility checked on opening.
