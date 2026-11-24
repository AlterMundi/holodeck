# Replaying a day of projected work

Initial Holodeck research, 2026-11-24. The design question is how to replay work
in its spatial context and reuse the timeline in a work map, Bitácora, or a
reviewed memory consolidation while preserving what was actually observable.

## Findings

- Unreal Engine's replay streamers capture state for playback independent of
  the live match, with checkpoints that bound the cost of seeking. Its
  documentation describes how spreading checkpoint capture between frames
  can mix actor states from different times. For Holodeck, use a consistent
  cut of the projection across contributing sources, or expose where their
  revisions differ. [Epic replay streamers](https://dev.epicgames.com/documentation/en-us/unreal-engine/demonetdriver-and-streamers-in-unreal-engine)
- A materialized snapshot plus subsequent ordered events makes seeks bounded.
  Versioning the original event schema matters when older events are replayed
  after UI or layout changes. Holodeck can apply this to the projected facts
  while the room, work system and artifact store remain the authorities for
  their respective state. [Azure event-sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- W3C PROV supplies a vocabulary for who generated or used an artifact
  version, during what activity and when. Holodeck can use those relationships
  without adopting a graph database or a particular serialization. A source
  event, a replayed representation, a rendered frame and an observation of
  human attention carry different evidence. [W3C PROV data model](https://www.w3.org/TR/prov-dm/)
- A2UI separates component definitions from data updates and requires ordered
  application of stateful messages. Use A2UI to render a snapshot or successive
  changes. Keep replayable work facts with their producer, since a UI delta
  can outlive the catalog or renderer that interpreted it. [A2UI protocol](https://github.com/a2ui-project/a2ui/blob/main/specification/v1_0/docs/a2ui_protocol.md)
- The collective research report *R1 — Offline consolidation, capture and
  procedural learning* proposes reviewable output backed by exact/versioned
  inputs. The older report is retained under collective-research document
  `research/agent-memory/compaii/archive-2c255f22f018ed6ce20a2dfb.md`.
  For this design, a memory candidate should refer to the selected episode,
  rendering provenance and artifact evidence, while keeping source history.

## Smallest end-to-end experiment

Select one finite day window with two real task sessions that publish to two
stations. Record confirmed task, station, and artifact lifecycle events while
both viewers are closed. Pin a start snapshot, layout and appearance edition,
artifact revisions, each producer's sequence and observed/event times.
Reconstruct the exact same three time points through the 3D player and the web
work map. Confirm that a completed object appears at its historical revision and
at the observed location, including after a newer revision is published.

Inject one duplicate, one unavailable artifact, and one access withdrawal.
Measure equivalence of seek versus linear playback, time to seek, retained
bytes and the visible difference between gaps and inferred transitions. At a
time when concurrent sessions overlap, show both at their stations. When travel
between stations is inferred, present it as replay direction, with no claim of
recorded movement. The first experiment keeps one bounded episode plus
selected checkpoints and references. Use owning retention for artifacts and
the exact selection for any further editorial or memory reuse.

Bitácora should review a bounded selected episode with citations. The work map
can filter the same ordered facts by space, task and time. A reviewed memory may
retain why an episode matters together with a referenced view or saved frame
where one exists. Future physical-world signals come through the existing
[Daimon Integrators boundary](../sensory-integration.md), distinguish measured
and inferred data, and keep their scope, times, grants and uncertainty.

This research identifies candidate mechanisms and a discriminating test.
It does not establish that the work projection player already exists.
