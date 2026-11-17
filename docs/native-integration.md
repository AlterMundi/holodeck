# Native turn integration: inspected seam and remaining work

## Implemented adapter, 2026-11-17

`src/native-conversation.mjs` exports `nativeFactory({room,stateDir,receiving})`.
It exposes availability, submit, status, explicit exact-original retry and
authorizeWorldRequest. The HTTP server supplies authenticated human actors;
browsers cannot select a paired being, provider configuration or native binding.
The adapter freezes the original text and server situation before any native
write. A compact optional MML client view is retained as client-reported evidence,
not authoritative position, eyesight, rendering or understanding.

The owner-private intent journal has at most32records and1.8MiB of live JSON,
plus at most1.8MiB atomic staging. Each observation is at most16KiB, selected from
the current snapshot and last16 semantic events; original text is at most32KiB.
Restart and duplicate submission use the same retained identity/context. Status
does not resubmit. Unknown outcomes remain retained. At capacity new admission
stops; operators must reconcile/archive confirmed native-owner sources before
retiring app intents. No uncertain record is automatically evicted or replayed.

`integrations/native_bridge.py` is a narrow owner-local Unix bridge to the existing
DaimonApp Provider. SO_PEERCRED restricts it to the selected dedicated Holodeck
service UID. It runs as the existing native owner, not root or the web app, and
supports inspect/submit/status only. The actual shared-authority `daimon-home
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

Controlled qualification: four Node adapter tests and six Python bridge tests
pass, covering exact original/context capture, unknown-write restart/status,
foreign actors/binding changes, direct native authority and request-specific
result isolation. A real read-only receiving inspection also verified current
pairing and established native binding. These are **not** proof of a real human
situated turn, model uptake or a performed world action; those require the actual
hosted round trip. Do not invent a human test prompt or replay an old human
original to manufacture that evidence.

Routed work is read through its exact original-scoped trace. The general entry's
acknowledgment does not complete a turn delegated to a work conversation. Only a
current associated worker result is shown as that routed answer; excerpts retain
their source/revision and partial flag. The fifth Python bridge test qualifies
this distinction. Native reply completion is not proof of a game effect or MVP
acceptance. A failed status read shows unavailable/unknown current status rather
than presenting old running evidence as fresh activity.
Direct native updates are capped at4096UTF8bytes each, including multibyte text,
so eight source excerpts and the selected answer fit the128KiB wire envelope.

Run `node --test test/native-conversation.test.mjs` and
`python3 -B -m unittest discover -s test -p '*_test.py'` for these focused contracts.
The sections below preserve the inspected owning seams and acceptance limits.

The initial interaction is an explicit turn in the continuing Conversation.
Free human exploration continues while that turn runs. Native daimon perception,
projection and actions are direct APIs, independent of human UI or Avatar mode.

`DaimonPort` exposes observe/project/act/result and requires a receiving authority
resolver on each call. Room does not issue identities or infer a paired being.
This port is implemented and tested with fixtures. It is **not installed as a
native tool or connected to a live conversation**. Its tests establish contract
behavior, not real daimon participation. Navigation goals and richer perceptual
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
