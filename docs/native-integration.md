# Native turn integration: inspected seam and remaining work

## Implemented adapter, 2026-11-17

`src/native-conversation.mjs` exports `nativeFactory({room,stateDir,receiving})`.
It exposes availability, submit, status, explicit exact-original retry and
authorizeWorldRequest. The HTTP server supplies authenticated human actors;
browsers cannot select a paired being, provider configuration or native binding.
The adapter freezes the original text and server situation before any native
write. A compact optional MML client view is retained as client-reported evidence,
not authoritative position, eyesight, rendering or understanding.

The owner-private intent journal has at most32full records,128compact terminal
tombstones and1.8MiB of live JSON,
plus at most1.8MiB atomic staging. Each observation is at most16KiB, selected from
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
keyboard, camera or browser cookies. It offers observe/project/act/result through
the app's receiving Unix world port. The installed CLI/socket descriptor appears
in the situation attachment only when the operator has actually configured it.
Every operation requires the real retained interaction ID. The native journal
authorizer rechecks current pairing/binding and actual native admission; the app
then checks current room audience/rights before constructing a daimon actor.
Actions bind `nativeRequest` to that original ID and retain command IDs/outcomes.
No daemon or model attention is started by installing a CLI or describing it.

Configuration is supplied through `receiving.nativeSocket` and the private
operator-selected `holodeck.native-bridge/v1` contract; a public template lives in
integrations/native-bridge.example.json. Resolve source/config/UIDs from actual
maintained receiving units, not the template's placeholder paths/UID. Protect the
socket directory and grant only the selected app UID. The native world socket's
filesystem grant is separate from the browser identity and still requires the
retained interaction and current room authorization.

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

Controlled qualification: ten Node adapter tests and twelve Python bridge tests
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
current associated worker result is shown as that routed answer; excerpts retain
their source/revision and partial flag. With several routes, partial answers remain
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

`DaimonPort` exposes observe/project/act/result and requires a receiving authority
resolver on each call. Room does not issue identities or infer a paired being.
This port is implemented and tested with fixtures. The protected trial has an
installed owner CLI/bridge and direct world socket; additional paired routes are
being qualified. A fresh human-triggered native round trip remains unobserved.
Its tests establish contract behavior, not real daimon participation.
Navigation goals and richer perceptual
queries remain to be implemented against the selected runtime.

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
