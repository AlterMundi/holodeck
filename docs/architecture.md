# Architecture decision 001: reuse MML for the first candidate

Inspected upstream revision: b3fed99f3bae267a23c66e195794ac22e2b81107.
Packages pinned to 0.28.0, Networked DOM 0.26.1. MIT implementation.

The upstream server provides an authenticator seam, custom messages, independent
Networked DOM documents and DeltaNet avatar presence. Client provides collision,
locomotion, animation, joystick and reconnect. No concrete mismatch justifies
rewriting these systems. Start with MML and test the actual integration. Browser
performance, headset suitability and gateway WebSockets remain unqualified.

| Domain | Authority | Projection/consumer |
| --- | --- | --- |
| Locomotion/collision | MML client mechanics | DeltaNet presence; not authoritative gameplay proof |
| Avatar presence | MML networking | Other clients; separate from semantic revision |
| Cooperative activity and edits | Holodeck Room | Read-only MML geometry generated from Room |
| Semantic events | Room bounded ordered journal | Situation observations, activity view |
| Native dialogue/identity | Existing native/Avatar owner | Holodeck integration, not a second chat agent |
| Shared admission/audience | Existing Home/Matrix authority | Not implemented in loopback prototype |
| Durable editions/releases | Existing Homes/Nexus writers | Not replaced by prototype package metadata |
| Saves | Future bounded Room checkpoint | Distinct from package edition and presence |
| Physical device observation/control | Existing Daimon Integrators / receiving device owner | Holodeck sensory/anchor projection; see sensory-integration.md |

Room/run, immutable edition, semantic cursor and entity revisions are independent.
Unrelated movement never invalidates a command. A reset creates a new run.
Mutation IDs retain exact outcomes for a bounded retry horizon. Execution checks
server-resolved rights and relevant target preconditions. The local adapter is a
development harness only, not a source of identity or companion grants.

Situation capture belongs to the moment of an utterance. The observation records
the delivered cursor, actor, room/run/edition, relevant public events, participants,
activity and mutable entities. It reports gaps explicitly. Structured room overview
is a declared access scope, not simulated eye sight or proof of human attention.
Private paired conversation is never room context. No event starts a model turn.

Native integration must preserve exact human originals and source provenance,
busy/queued turn behavior, authority and outcome receipts. The current Avatar
native context source is transcript-specific; adding arbitrary room JSON to that
sealed source would misrepresent its provenance. An explicit situated-context
adapter is the immediate next dependency, not a fabricated NPC response.

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
