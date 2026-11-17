# Native turn integration: inspected seam and remaining work

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
