# Architecture decision 001: reuse MML for the first candidate

Inspected upstream revision: b3fed99f3bae267a23c66e195794ac22e2b81107.
Packages pinned to 0.28.0, Networked DOM 0.26.1. MIT implementation.

The upstream server provides an authenticator seam, custom messages, independent
Networked DOM documents and DeltaNet avatar presence. Client provides collision,
locomotion, animation, joystick and reconnect. No concrete mismatch justifies
rewriting these systems. The protected trial reuses MML. A bounded protected token-hash/actor/time registry
lets its existing reconnect recover across application restarts within the fixed
session lifetime. Fresh shared-Home identity/audience remains mandatory; stored
bindings carry no credentials or rights. Software-browser
movement and editing have passed controlled checks; two independently signed-in
humans report shared movement and the same edited light. Physical-device performance
and headset suitability remain unqualified. Gateway
HTTP/WebSocket access refusal is verified separately from positive shared use.

| Domain | Authority | Projection/consumer |
| --- | --- | --- |
| Locomotion/collision | MML client mechanics | DeltaNet presence; not authoritative gameplay proof |
| Avatar presence | MML networking | Other clients; separate from semantic revision |
| Cooperative activity and edits | Holodeck Room | Read-only MML geometry generated from Room |
| Semantic events | Room bounded ordered journal | Situation observations, activity view |
| Native dialogue/identity | Existing native/Avatar owner | Holodeck integration, not a second chat agent |
| Shared admission/audience | Existing Home/Matrix authority | Production Home identity/service audience; anonymous actors only in loopback development |
| Durable editions/releases | Existing Homes/Nexus writers | Not replaced by prototype package metadata |
| Saves | Bounded atomic Room checkpoint | Distinct from package edition and presence; uncertain post-commit writes fence further mutation |
| Physical device observation/control | Existing Daimon Integrators / receiving device owner | Holodeck sensory/anchor projection; see sensory-integration.md |

Room/run, immutable edition, semantic cursor and entity revisions are independent.
Unrelated movement never invalidates a command. A reset creates a new run.
Mutation IDs retain exact outcomes for a bounded retry horizon. Execution checks
server-resolved rights and relevant target preconditions. The local adapter is a
development harness only, not a source of identity or companion grants.

The live renderer can reuse up to three visited-room entries bound to the
browser session's actor and the exact server-generated scene revision. A
retained entry can start loading the exact static room model after the server
accepts entry, while presence reconnects. Its handle never mounts a model by
itself.
Every move still requires a current server acknowledgement and a matching
presence scope. Changed editions, denied destinations, eviction, access loss
and unexpected disconnects release retained handles. The cache lives in page
memory, outside browser storage, and does not retain presence or private exhibit
payloads. The private art endpoint continues to use its live-room check and
`no-store`.

Situation capture belongs to the moment of an utterance. The observation records
the delivered cursor, actor, room/run/edition, relevant public events, participants,
activity and mutable entities. It reports gaps explicitly. Structured room overview
is a declared access scope, not simulated eye sight or proof of human attention.
Private paired conversation is never room context. No event starts a model turn.

Native integration must preserve exact human originals and source provenance,
busy/queued turn behavior, authority and outcome receipts. The current Avatar
native context source is transcript-specific; adding arbitrary room JSON to that
sealed source would misrepresent its provenance. An explicit situated-context
adapter now retains an immutable application-authored attachment through the
existing native original/file writer. An actual human-triggered situated input
and direct native observation/projection/edit have retained evidence. The next
complete conversational return and device/revisit acceptance remain open; no
fabricated NPC response substitutes for those observations.

Preserve meters, anchors, semantic targets and input actions for future XR. No
promise of Oculus compatibility follows from using Three.js. Scenario assets are
optional inputs; generation subscriptions are not the multiplayer runtime.

## First-class native experience

The initial model entry is turn-based Conversation, not a dependency on Avatar or
live voice. The world adapter captures the human interaction and situation while
independent locomotion continues. It offers the daimon direct structured perception,
spatial queries, typed world operations and projection control. A daimon's native
perception scope is explicit; no browser puppeteering or simulated human viewpoint.
All projections derive from one semantic authority. Client delivery and actual
rendering need separate cursors; until an acknowledgment exists, rendered cursor
is unknown. A readable HUD must use actual native turn states.

For physical perception and augmentation, reuse the human-selected
[Daimon Integrators boundary](sensory-integration.md). Device-use status, sensor
samples, derived world facts and model perception are distinct observations.

## Live work in shared spaces

A room, outdoor place or individual object can present the current work and
retained results of an authorized task. Keep a stable place and subject
reference, the originating task/session binding, and a revision of the
projected state. The owning application or task publisher advances that
state as work changes, including when no visitor is present. Retain enough
state to open the latest projection after an absence, then subscribe to
incremental updates with a fresh snapshot on a gap. Work can publish changes
through its existing write path without starting another model turn.

Use the same authorized projection behind the spatial renderer and a web view
of the same places. A2UI carries incremental surfaces and actions for both
where applicable. The underlying application validates each action and
publishes the resulting state. Expensive drawing and asset loading belong to
visitors who are looking at the surface. Unseen work still advances and can
appear as soon as someone opens either view. Project only the audience-selected
progress, artifacts and meaningful state. Conversation content and other private
work data retain their own access control.

The principal CompAII avatar opens our general Conversation through the
canonical owner. A work avatar is another spatial representation of CompAII
associated with a specific ongoing task and its native session. Approaching it
and choosing to talk opens that exact conversation, with the current place,
object and observed revision attached where relevant. The conversation owner
resolves the audience and the exact receiving session. Several work avatars
can coexist. Their visible activity comes from confirmed task and artifact
events, and each scene may render independently from the same projection. A
stale or unavailable session keeps its last confirmed work visible within its
scope and offers a clear unavailable state for conversation.

### The same work through time

Live, timeline and playback views derive from the same authorized state changes.
Retain a bounded sequence of confirmed task, place and artifact changes with
source order, revisions and preserved scene references. Checkpoints plus
subsequent changes let a viewer seek to a time and reconstruct the work in
either 3D or the web work map. Temporal ordering must account for concurrent
tasks and source clock uncertainty. Rendered reconstructions distinguish
verified state, explicitly recorded views and inferred movement between work
locations. Unknown or unretained states remain visible as gaps.

A day replay can feed a selected Bitácora story or propose an evidence-backed
episode for reviewed memory consolidation, including the spatial projection
then available to a human. Preserve observation provenance and audience
restrictions. The future sensory layer can place an authorized physical
observation on the same timeline with its own resource, time, frame and evidence
type. See [work projection replay research](research/2026-11-24-work-projection-replay.md).

## Transport authentication context

The pinned upstream server callbacks now forward their actual WebSocket context.
Holodeck matches the handshake token's retained owner to that connection's fresh
Home identity and checks current authority using that socket, rather than another
session's remembered cookie. The minimal four-file adaptation and reproducible
postinstall/check are maintained in tools/mml-server-auth-context.mjs; both build
paths verify exact bytes. Browser protocol, public MML locomotion/presence and
current per-resource authority remain unchanged.

Humans receive distinct appearances from the same authenticated
MML profile path outdoors and indoors. Four licensed example rigs and four
alternate wardrobes cover all eight existing simultaneous world-session
slots. The audience that may sign in remains independent of that capacity.
Automatic appearances are assigned without reading names or inferring
physical traits. A retained world-session binding keeps the automatic
assignment across doors, reloads and reconnects. An expired or evicted lease
releases it. A participant's explicit catalog choice survives new sessions
and changes the live MML description in the active cell. Both bounded
checkpoints store only hashed actor IDs and profile slots. Native daimon
projections use their existing recipe.

## Runtime co-creation and engine maintenance

The21November human correction selects one shared engine, with creator-owned
results and runtime-created world entities. Engine-maintainer authority is not
required for ordinary creation. [Co-creation](co-creation.md) distinguishes the
working typed activity and implemented native result/playable-node contract,
including its remaining custom-representation limits. [Maintainers](maintainers.md) records actual
Oliva contribution/publisher access and the remaining delegated-selector gap.

## Shared activity and situated history

Human [activity view](world-history.md) and native `activity` read one canonical
bounded Room journal, with explicit retention gaps and separately captured current
state. Selecting a historical event freezes only an exact reference; the canonical
server resolves its retained content for Conversation. It does not invent an old
world reconstruction, human attention or a media clock. No event starts a model.

## Field integration and owned places

[Field convergence](field-integration.md) reuses Nexus's immutable graph, visit,
perspective and work contracts. A generic context portal must retain its own
context/version rather than masquerade as a report. Knowledge relationships stay
in Nexus; Room remains the spatial authority. The owned-house/parcel direction
requires a real creator namespace and space contract, not another server per
participant or implicit publication rights from visiting a place.

## Harmonic Lab projections

The Lab service owns instrument state and actions. Holodeck subscribes to the
selected workstation's A2UI 1.0 surface. Proyección maps its control catalog to
Three.js meshes in the room. Buttons and sliders use the world camera's
pointer rays. Confirmed A2UI updates are applied to the same controls regardless
of which client produced them. Tool actions keep the original surface,
component, session and confirmed revision. Local field drafts stay with the
current visit.

Opening a worktable asks the existing authorized service to prepare the selected
instrument when needed. Readiness, unavailable workstations and start failures
are displayed in the worktable. This does not select hardware or activate camera,
recording or the guitar motor. Leaving the worktable releases its event stream,
models and media. The Guitar section selects the matching part of the protected
model edition. HarMoCAP uses the selected protected video as a texture in the room.
The explicit external link remains available for the separate web projection.

Holodeck application controls use native Three.js projections. An embedded
browser is reserved for experiences whose content is a webpage.
