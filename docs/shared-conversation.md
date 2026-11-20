# Canonical Conversation inside Holodeck

Human direction20November: directly reuse Conversation rather than repeatedly
copy text, microphone, transcription, original-file and chat behavior. A compact
presentation is permitted; ownership of those features remains Conversation.
Beacon work is explicitly elsewhere. This document owns the integration seam,
not a new goal or a claim of delivery.

## Current state

The selected live Holodeck still uses the earlier minimal text composer until
this integration is qualified and selected. Canonical Conversation now supplies
its own compact hosted surface through DaimonApp PR926, with the early capture/cancellation correction in
[PR927](https://github.com/AlterMundi/DaimonApp/pull/927), source dd5c0e61.
Its [v1 contract](https://github.com/AlterMundi/DaimonApp/blob/dd5c0e6199780efd11be03782d16af795552ea2e/docs/conversation-surface.md)
is the canonical protocol reference. The world-side consumer is implemented locally;
receiving installation and physical acceptance remain separate observations.

World-side code now prepares context without submitting a human original.
It is locally tested and disabled by default: receiving.sharedConversation must
not be selected until the actual shared surface/protocol is qualified. Existing
inputs, grants, accounts, services and the blocked full-MVP goal remain unchanged.

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

Select `receiving.sharedConversation: true` only after the seven compatible
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
