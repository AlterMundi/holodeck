# Native turn integration: inspected seam and remaining work

## Implemented adapter, 2026-11-17

`src/native-conversation.mjs` exports `nativeFactory({room,stateDir,receiving})`.
It exposes availability, submit, status, explicit exact-original retry and
authorizeWorldRequest. The HTTP server supplies authenticated human actors;
browsers cannot select a paired being, provider configuration or native binding.

Current native room permission is independent of a human browser session. The
existing central owner bridge accepts a UID-guarded `world-access` query for the
being already verified by the original/input authorizer and fixed return port.
Only that central bridge configures `world_service_key`; other bodies receive no
CompAII custody. Its installed `daimon-home service-access` client uses the held
Home owner's read-only `check-service-access` operation, which reuses the live
service capability, exact selected App version and current actor audience checks.
The being's own grant determines its game rights; a human's grant is not inherited.
Fresh pair/input/run/room checks remain required independently. No reader/browser
session or new grant is created. Unknown, unavailable or scope-mismatched authority
must deny rather than fall back to a human cookie or unconditional rights.
The adapter freezes the original text and server situation before any native
write. A compact optional MML client view is retained as client-reported evidence,
not authoritative position, eyesight, rendering or understanding.

The owner-private intent journal has at most32full records,128compact terminal
tombstones and1.8MiB of live JSON,
plus at most1.8MiB atomic staging. Each observation is at most32KiB, selected from
the current snapshot and last16 semantic events; original text is at most32KiB.
Restart and duplicate submission use the same retained identity/context. Status
does not resubmit. Before record-count or byte capacity is exhausted, confirmed
terminal metadata may retire to a bounded tombstone only after its original and
situation are retained by the canonical native owner. Unknown, preparing and
known-unsent originals are never evicted. Every new or locally retired ID is
checked against that canonical journal before any new capture/work: an old ID
recovers its SHA-verified original situation and status, never a new snapshot or
submission. This remains true beyond the128local tombstones. Canonical originals
and attachments keep their existing owner retention; app retirement deletes none.
If all full intents remain unresolved, new admission is rejected before capture
or native work with explicit retained/knownNotSubmitted/retryable fields.

An initial request missing from both app and canonical journals returns the
specific `not-retained` proof; a generic404 or unavailable lookup is not that
proof. Resubmission needs an explicit human retry of the same frozen original.
Interrupted preparation exposes an explicit retry using its retained text and
situation. Client-reported original capture time/view and the server's actual
admission-time snapshot stay distinct. No later snapshot is presented as an
earlier rendered view. After atomic replacement, a directory-sync failure keeps
the new bytes and in-memory intent and fences further journal writes/submits
until receiving restart/reconciliation; it never rolls the intent back silently.

`integrations/native_bridge.py` is a narrow owner-local Unix bridge to the existing
DaimonApp Provider. SO_PEERCRED restricts it to the selected dedicated Holodeck
service UID. It runs as the existing native owner, not root or the web app, and
supports inspect/submit/status and exact-ID read-only lookup only. The actual shared-authority `daimon-home
human` reader supplies the current paired human and being. The existing native
metadata operation supplies its frozen continuing Conversation binding without
reading conversation text or activating voice. No new identity/account/provider
or native conversation is created.

Submit retains one SHA-addressed application-authored JSON situation attachment,
then admits the exact unchanged human text and that attachment through the
existing native original journal. The bridge rechecks current pairing, authority
and native binding at execution. Read-only status selects only messages with this
original's `presentation_input` and local turn; another original's text is not
shown. Native acceptance, real running turn, actual final answer and world action
remain separate observations. Result bodies are bounded and retain source/item/
turn/checksum metadata; their digest is not misrepresented as a canonical
presentation revision.

`integrations/world_port.py` is the direct daimon interface, independent of human
keyboard, camera or browser cookies. It offers observe/activity/project/act/result through
the app's receiving Unix world port. The installed CLI/socket descriptor appears
in the situation attachment only when the operator has actually configured it.
Situated operations require the real retained interaction ID. The native journal
authorizer rechecks current pairing/binding and actual native admission; the app
then checks current room audience/rights before constructing a daimon actor.
Actions bind `nativeRequest` to that original ID and retain command IDs/outcomes.
No daemon or model attention is started by installing a CLI or describing it.

### Own native foreground creation

`world_port.py --socket <private-own-lane> --own observe` selects a distinct
foreground source, without a human original or a Conversation write. Its closed
wire envelope is `{ownNative:true,operation,args}`; it cannot also contain an
interaction, human, being or actor selector. The existing situated CLI continues
to use `--interaction UUID` and its unchanged source checks.

The world port derives the acting being only from its receiving-selected
`expectedBeingRef`. Own mode requires the explicit `resolveOwnNativeRights`
callback, wired to the existing central `nativeRoomAuthority` and its fresh
being service-grant check on every operation. No central authority, invalid pin,
unknown grant or query failure means refusal. The legacy human-session permission
fallback is never an own-native resolver. Receiving socket/tunnel access must
remain private to its selected native body; a path or a claimed being string is
not a signed caller identity. Successful own responses identify their authority
as `receiving-lane` plus `current-being-grant`, not a per-command signature.
Before enabling this callback, qualify the native owner's ordinary UID against
every receiving endpoint, including inherited socket ACLs after app replacement.
It must not reach another being's own-native endpoint without a privileged
operator step. Shared directory access or an inherited all-socket ACL is
insufficient. Privileged host/service operators remain trusted transport owners;
the lane contract does not claim to isolate them. Leave own mode disabled until
that concrete receiving boundary is established. Situated input verification
retains its independent existing cross-being checks.

Observe/project/act/result reuse the same Room, byte/slot limits, current rights,
observation ownership, run/edition, target revisions and bounded exact command
outcomes. For act the server rejects a supplied `nativeRequest` and records
`own-native:<command.id>` instead. This is an own action reference, never a human
input UUID or proof of semantic/model uptake. Retrying an uncertain act requires
its unchanged command ID/content or an exact result read through the same lane;
no native input is synthesized or replayed. For a situated indoor garden
action, use `holodeck-world --interaction <original> result '{"id":"<command-id>"}'`.
This also recovers recent receipts after the original completes and its
prepared source is released, while the current pair and room grants still hold.
See the [indoor source contract](shared-conversation.md#indoor-source-contract)
for retention. For a working indoor turn, `observe --json '{}'` provides
`actions` with the operation and the current arguments for the next permitted
passage or a garden signal. Supply a new command ID when asked and observe
again after each passage. This capability starts no background
attention, inference or provider session. Source tests and callback wiring do not
establish receiving deployment or an actual creator action.

The workshop advertises typed bridge, garden, focus and node operations; see
its current structured observation and [native creator guide](native-creation-quickstart.md). Updating an existing live light takes its current entity revision
and `{x,z,color}`; it preserves the same ID and advances that revision. A stale
revision or deleted target is rejected. An update remains possible at the32entity
creation ceiling, without recycling IDs or replacing an object merely to edit it.
Actual native uptake/action remains separate from the controlled contract tests.

Configuration is supplied through `receiving.nativeSocket` and the private
operator-selected `holodeck.native-bridge/v1` contract; a public template lives in
integrations/native-bridge.example.json. Resolve source/config/UIDs from actual
maintained receiving units, not the template's placeholder paths/UID. Protect the
socket directory and grant only the selected app UID. The native world socket's
filesystem grant is separate from browser identity. Situated mode retains its
original checks; explicitly selected own-native mode uses the private lane and
current being room authorization described above.

For multiple existing pairs, use the [native receiving mux](native-pairs.md):
operator-selected actor/being/Home/socket routes, actual generic Home human
references and distinct being-pinned native world-return endpoints. The legacy
single-owner socket and frozen intent schema remain compatible.

Multi-pair receivers select explicit `receiving.nativeRoutes` entries containing
`actorRef`, `beingRef`, `homeRef` and a fixed owner-bridge `socket`. Each request
selects only its authenticated human's route; an unknown actor has no fallback to
the hosting companion. Current signed pairing and native metadata must match the
selected route. Registered application/local humans use their existing validated
Home human reference rather than a synthetic Telegram-derived identity.

Each return transport has its own fixed `receiving.worldPorts` entry containing
`socket` and `beingRef`. The legacy `worldSocket` additionally requires
`worldSocketBeingRef` when native routes are enabled. At most eight unique return
paths are selected, each pinned to a configured native being. The authorizer
rejects another being's retained interaction before querying that other lane;
the world port also checks the returned actor before resolving room rights.
Knowing another interaction UUID never grants its identity. Passive transport
installation and metadata checks are not evidence of model uptake or world acts.

Controlled qualification: ten Node adapter tests, four mux tests and fourteen Python bridge tests
pass, covering exact original/context capture, unknown-write restart/status,
foreign actors/binding changes, direct native authority and request-specific
result isolation; multi-route completion; the33rd turn and byte-limit retirement;
canonical dedup beyond local tombstones; missing initial receipts; preparation
crashes and a post-replacement directory-sync fault. A real read-only receiving inspection also verified current
pairing and established native binding. These are **not** proof of a real human
situated turn, model uptake or a performed world action; those require the actual
hosted round trip. Do not invent a human test prompt or replay an old human
original to manufacture that evidence.

Routed work is read through its exact original-scoped trace. The general entry's
acknowledgment does not complete a turn delegated to a work conversation. Only a
declared result covering that exact routed instruction, with no pending correction,
settles its situated reply. Telecodex `current` covers every instruction linked to
the umbrella request; another context turn can make it false without withdrawing
this reply. Keep that flag and umbrella `completed` as `parentRequestCurrent` and
`parentRequestCompleted` metadata, separate from the situated turn's completion.
An uncovered sibling result, undeclared result or pending correction cannot settle
the turn. Excerpts retain source/revision and partial flag. With several routes, partial answers remain
available while `tracking=true`; the first finished branch does not complete the
others. A prior native problem remains a problem, including while another branch
is pending. Consumers keep polling when tracking is true even if phase is problem.
Native reply completion is not proof of a game effect or MVP
acceptance. A failed status read shows unavailable/unknown current status rather
than presenting old running evidence as fresh activity.
Direct native updates are capped at4096UTF8bytes each, including multibyte text,
so eight source excerpts and the selected answer fit the128KiB wire envelope.

The source-scoped status/world authorizer pins original text SHA256 and observation
ID, so a colliding native ID cannot stand in for a different app original. Exact
retries read an already retained canonical original before re-encoding a source;
changing an installed CLI descriptor cannot silently alter that original's file.

Run `node --test test/native-conversation.test.mjs` and
`python3 -B -m unittest discover -s test -p '*_test.py'` for these focused contracts.
The sections below preserve the inspected owning seams and acceptance limits.

The initial interaction is an explicit turn in the continuing Conversation.
Free human exploration continues while that turn runs. Native daimon perception,
projection and actions are direct APIs, independent of human UI or Avatar mode.

`DaimonPort` exposes observe/activity/project/act/result and requires a receiving authority
resolver on each call. Room does not issue identities or infer a paired being.
This port is implemented and tested with fixtures. The protected trial has an
installed owner CLI/bridge and direct world socket; additional paired routes are
being qualified. A real human-triggered round trip and native world actions have now begun; see
STATUS.md for their exact trial evidence and the remaining conversational return
loop. Contract fixtures alone do not establish that participation.
During an admitted working indoor Conversation, the world observation can
include the next permitted passage toward the room retained in the original.
Use the returned `approach.from` and `approach.to` with an explicit
`space.move`. Each step uses existing movement and current room permissions.
After an uncertain outcome, observe the current position before issuing
another move. There is no separate movement receipt. The existing garden
action retains its exact original-scoped receipt.

```sh
holodeck-world --interaction "$ORIGINAL_ID" observe
holodeck-world --interaction "$ORIGINAL_ID" act --json '{"type":"space.move","from":"outside","to":"workshop-entry"}'
```

Replace the sample endpoints with the observed passage endpoints. This
updates the daimon's room membership through the world port. Avatar
locomotion and richer perceptual queries remain separate work.

Inspected current owning app implementation (2026-11-17):

- `dashboard/app.py`: authenticated `POST /api/interaction/inputs`, CSRF;
  request status/trace retrieval; opaque immutable file upload/download.
- `dashboard/provider.py`: native input accepts binding/id/text and optional
  reply/visual/playback/files. Arbitrary `situation` is rejected. Input submission
  uses the existing native journal and its idempotency, without automatic retry.
- `dashboard/files.py`: SHA-256-addressed immutable attachments, original-source
  checks and bounded retention. Retaining an attachment does not admit work.
- The live native-context adapter handles transcript provenance specifically;
  it must not be repurposed to attribute room data as spoken human text.

The smallest candidate receiving extension is an app-owned association between
the exact retained human input and a bounded immutable room observation. Reuse
existing file/source transport if it preserves application-authored provenance,
audience and direct model retrieval; otherwise add a typed source descriptor at
the owning input/context boundary. Never concatenate room JSON into attributed
human speech. Presence does not authorize reading private conversations.

Before activating: bind the verified world actor to its existing native identity
and continuing conversation, qualify source delivery and actual model uptake,
mount DaimonPort with the existing receiving grant resolver, and return exact
world outcomes to that request. HUD follows actual retained/native states
(queued/working/result/problem), not a local progress timer. Busy turns retain
their capture; later execution rechecks current authority/preconditions.

Rendered sequence is currently unknown. Semantic fetch is not a geometry/frame
acknowledgment. Add the renderer acknowledgment with run/edition/entity references
before claiming consistent situated visual evidence. The native model may have
a structured room overview as an explicit distinct scope; human eyesight is not
the mandatory perception model.

An ephemeral local room is sufficient for foundation tests because no native work
is submitted. Before real native submission, retain intent/capture/outcome through
the owning durable input path so process loss cannot erase an uncertain effect.


## Ended execution with a missing scoped reply

A downstream Matrix selection preserves the independently selected human return
lifetime in the owning Conversation writer. It must not let an internal callback
replace a subsequent human reply marker; replacement collectors retain the same
owner/session/physical fences. Older already frozen items are not relabeled.

For a retained Matrix original with an ended local collector and no own-scoped
answer, the bridge can use the installed owner's read-only `input terminal UUID`.
That reader selects one unique physical identity frozen on this original's own
visible canonical items, not merely the collector's first turn. It reads actual
native terminal state and revalidates current ownership/boundary afterward.
Missing, ambiguous, changed, unavailable or still-running observations keep the
existing wait. The bridge revalidates every read without a terminal-state cache.

A confirmed ended execution with a missing reply remains `phase=problem`, with
`tracking=false` and separate observed execution metadata. Native acceptance,
original phase and downstream work remain unchanged. The app preserves the
original and reports that its reply was not recovered here; it releases only the
finished tracking so the human can continue typing and walking. No unscoped final
text is borrowed, no native input is replayed and no pending work is cancelled.
An older owner without this read keeps the outcome unconfirmed; do not infer
termination from local collector completion alone.

## Direct canonical Conversation extension

The human now requires direct reuse of Conversation's text/audio/files component.
[Shared Conversation](shared-conversation.md) owns this in-progress extension.
World-side context preparation reuses the same situation/file writer without
submitting a human original. The shared canonical frontend is not yet selected;
legacy input/status recovery and the existing live runtime remain preserved.

### Situated history reference

The native world `activity` operation reuses `readActivity` and the same
observe-only rights as the authenticated human GET route. It accepts only
`run`, `through`, `before` and `limit`, normalizing safe numeric JSON cursors to
the existing strict query contract. Both situated and own-native lanes keep
current receiving identity/room grant checks. Request16KiB/response128KiB and the
activity20-record/32KiB limits are unchanged. It writes no observation or journal.

An optional client view can select exactly one event with
`historyReference: {schema:'holodeck.history-reference/v1',run,edition,sequence,
panelVisible,explicit}`. It must be a bounded512-byte closed object, with a
positive safe sequence and actual boolean flags; one flag must be true. The
flags are client-reported selection, never event authorship, gaze or attention.
The UI freezes this reference before any asynchronous viewer capture. No text or
state copied by the client is accepted as the event. Raw historyReference is
removed from the optional client-view copy after server resolution.

`captureNativeSituation` resolves the exact current run/edition/sequence from
that same Room journal at capture, before native original submission. It reserves
`selectedActivity` together with inputAssociation before `room.observe` fits the
canonical world. `selectedActivity` is a machine-authored top-level context:

```json
{"schema":"holodeck.selected-activity/v1","status":"retained","reference":{"schema":"holodeck.history-reference/v1","run":"EXACT_RUN","edition":"EXACT_EDITION","sequence":130,"panelVisible":true,"explicit":false},"source":"canonical-room-journal","selectionEvidence":"client-reported reference; not attention or event authorship","event":{"sequence":130,"time":0,"type":"garden.update","author":{"ref":"EXACT_RECORDED_ACTOR","name":null,"nameSource":null,"isSelf":false},"target":"garden-EXACT_ID","eventRevision":2,"detailStatus":"available","recorded":null},"omissions":{}}
```

The example is a field contract, not a real event/actor receipt. The selected
projection excludes duplicate current state (already in the captured world).
At most2048 UTF-8 bytes are retained; optional recipe, links or recorded detail
can be omitted with `omissions.recipe`, `links` or `recordedDetail`. Essential
reference/author/type/time/target/revision remain exact. `recorded:null` is not a
preimage or reconstruction. Names remain unknown without trusted provenance.
An invalid reference returns `status: invalid`/null reference; an evicted event
returns `unavailable`; a different run or edition returns `different-run`. These
cases do not block the original, invent an event or fall forward to another one.
No reference means no selectedActivity. Observer identity remains the outer
canonical observation's observer, distinct from the recorded event author.

If malformed legacy essential identity/edition fields cannot fit even after all
optional selected detail is removed, the context reports the exact bounded
reference as unavailable rather than dropping an author silently or blocking the
original. The public activity endpoint remains the full bounded inspection route.
